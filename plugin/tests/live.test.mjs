// Live GitHub client tests with a stubbed global fetch — no network.
// Verifies header wiring, topic fallback chain, rate-limit error surface, and
// the 404 → null contract used by plugin_info.

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createGithubClient, GitHubApiError } from '../src/live.js'

const realFetch = globalThis.fetch

function jsonResponse(body, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Map(Object.entries(init.headers || {})),
    json: async () => body,
  }
}

function repoItem(fullName, description = 'A dsh plugin', extra = {}) {
  return {
    full_name: fullName,
    name: fullName.split('/')[1],
    owner: { login: fullName.split('/')[0], avatar_url: 'https://avatar' },
    description,
    stargazers_count: 10,
    forks_count: 1,
    language: 'TypeScript',
    license: { spdx_id: 'MIT' },
    topics: ['dsh-plugin'],
    updated_at: '2026-08-01T00:00:00Z',
    html_url: `https://github.com/${fullName}`,
    ...extra,
  }
}

afterEach(() => {
  globalThis.fetch = realFetch
})

test('client sends auth header when a token is configured', async () => {
  let seenHeaders = null
  globalThis.fetch = async (url, opts) => {
    seenHeaders = opts.headers
    return jsonResponse({ items: [repoItem('a/dsh-demo')] })
  }
  const client = createGithubClient({ githubToken: 'ghp_test', liveTimeoutMs: 5000 })
  const result = await client.searchPlugins({ query: '', limit: 5 })
  assert.equal(seenHeaders.Authorization, 'Bearer ghp_test')
  assert.equal(result.source, 'live')
  assert.equal(result.plugins[0].fullName, 'a/dsh-demo')
  assert.ok(result.plugins[0].installCmd.startsWith('dsh plugin add'))
})

test('searchPlugins falls through the topic chain until relevant hits appear', async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    // First topic (dsh-plugin): only irrelevant repos → keep going.
    if (url.includes('topic%3Adsh-plugin')) {
      return jsonResponse({ items: [repoItem('x/topic-squatter', 'a generic library')] })
    }
    // Second topic (dsh): a relevant repo → stop here.
    if (url.includes('topic%3Adsh')) {
      return jsonResponse({ items: [repoItem('y/dsh-helper', 'helper plugin for DeepSeek Harness')] })
    }
    return jsonResponse({ items: [] })
  }
  const client = createGithubClient({ liveTimeoutMs: 5000 })
  const result = await client.searchPlugins({ query: 'helper', limit: 5 })
  assert.equal(calls.length, 2)
  assert.equal(result.total, 1)
  assert.equal(result.plugins[0].fullName, 'y/dsh-helper')
  assert.ok(result.note.includes('topic:dsh'))
})

test('rate-limited responses raise an actionable error mentioning the token', async () => {
  globalThis.fetch = async () => jsonResponse({ message: 'API rate limit exceeded' }, { status: 403, ok: false, headers: { 'x-ratelimit-remaining': '0' } })
  const client = createGithubClient({ liveTimeoutMs: 5000 })
  await assert.rejects(
    client.searchPlugins({ query: 'skin', limit: 5 }),
    (e) => e instanceof GitHubApiError && e.rateLimited && /githubToken/.test(e.message),
  )
})

test('getRepo returns null on 404 and an entry on success', async () => {
  globalThis.fetch = async () => jsonResponse({ message: 'Not Found' }, { status: 404, ok: false })
  const client = createGithubClient({ liveTimeoutMs: 5000 })
  assert.equal(await client.getRepo('nope/missing'), null)
  assert.equal(await client.getRepo('not even a repo name'), null)

  globalThis.fetch = async () => jsonResponse(repoItem('someone/dsh-tool', 'A dsh plugin for x'))
  const entry = await client.getRepo('someone/dsh-tool')
  assert.equal(entry.fullName, 'someone/dsh-tool')
  assert.equal(entry.official, false)
  assert.equal(entry.installType, 'plugin')
})

test('network failures surface as GitHubApiError, not raw fetch crashes', async () => {
  globalThis.fetch = async () => {
    throw new Error('ECONNREFUSED boom')
  }
  const client = createGithubClient({ liveTimeoutMs: 5000 })
  await assert.rejects(client.getRepo('a/b'), (e) => e instanceof GitHubApiError && /ECONNREFUSED/.test(e.message))
})
