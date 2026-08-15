// Plugin entry contract tests — validate the exports every dsh bundle
// plugin must provide, and that the Schemastery Config fills deployment
// defaults. Requires `pnpm install` (imports @deepseek-ai/dsh-tools).

import test from 'node:test'
import assert from 'node:assert/strict'
import { name, inject, Config, apply } from '../index.js'

test('plugin entry exports the cordis contract', () => {
  assert.equal(name, 'dsh-plugin-hub')
  assert.deepEqual(inject, ['tools'])
  assert.equal(typeof apply, 'function')
})

test('Config schema validates and fills defaults', () => {
  const empty = Config({})
  assert.deepEqual(
    {
      githubToken: empty.githubToken,
      apiBaseUrl: empty.apiBaseUrl,
      maxResults: empty.maxResults,
      liveTimeoutMs: empty.liveTimeoutMs,
      systemPromptGuidance: empty.systemPromptGuidance,
      autoRefresh: empty.autoRefresh,
      registryUrl: empty.registryUrl,
      refreshIntervalHours: empty.refreshIntervalHours,
      refreshTimeoutMs: empty.refreshTimeoutMs,
    },
    {
      githubToken: '',
      apiBaseUrl: 'https://api.github.com',
      maxResults: 8,
      liveTimeoutMs: 15000,
      systemPromptGuidance: true,
      autoRefresh: true,
      registryUrl: 'https://raw.githubusercontent.com/qomob/dsh/main/plugin/data/registry.json',
      refreshIntervalHours: 24,
      refreshTimeoutMs: 10000,
    },
  )

  const filled = Config({ githubToken: 'ghp_x', maxResults: 12 })
  assert.equal(filled.githubToken, 'ghp_x')
  assert.equal(filled.maxResults, 12)
  assert.equal(filled.apiBaseUrl, 'https://api.github.com')

  // Out-of-range values are rejected loudly at load time.
  assert.throws(() => Config({ maxResults: 999 }))
  assert.throws(() => Config({ refreshIntervalHours: 0 }))
})

test('apply registers both tools against a stub tools registry', () => {
  const registered = []
  const stubCtx = {
    tools: { register: (def) => registered.push(def) },
    plugin: () => ({ dispose: async () => {} }),
    effect: (fn) => {
      const dispose = fn()
      return () => (typeof dispose === 'function' ? dispose() : undefined)
    },
  }
  // autoRefresh stays on to prove the effect wiring; the stub fetch below
  // keeps it hermetic.
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('{}', { status: 200 })
  try {
    apply(stubCtx, Config({ registryUrl: '' }))
    assert.equal(registered.length, 3)
  } finally {
    globalThis.fetch = realFetch
  }
  assert.deepEqual(
    registered.map((d) => d.name).sort(),
    ['plugin_info', 'plugin_install', 'plugin_search'],
  )
  for (const def of registered) {
    assert.equal(typeof def.execute, 'function')
    assert.ok(def.output && typeof def.output.render === 'function')
    assert.ok(def.parameters && typeof def.parameters === 'object')
  }
})
