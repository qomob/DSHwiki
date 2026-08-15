// Registry auto-refresh tests with a stubbed global fetch — no network.
// The contract under test: a valid snapshot swaps in; every failure mode
// keeps the current registry untouched.

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRegistryRefresher } from '../src/refresh.js'
import { loadRegistry, searchRegistry, setRegistry, resetRegistryCache } from '../src/registry.js'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  resetRegistryCache() // restore the embedded snapshot for other test files
})

const tinySnapshot = {
  generatedAt: '2099-01-01T00:00:00Z',
  plugins: [
    {
      fullName: 'future/new-plugin',
      description: 'A future dsh plugin',
      stars: 1,
      url: 'https://github.com/future/new-plugin',
      category: 'toolset',
      topics: ['dsh-plugin'],
    },
  ],
}

const baseConfig = {
  registryUrl: 'https://example.com/registry.json',
  refreshTimeoutMs: 2000,
}

test('a valid downloaded snapshot replaces the active registry', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify(tinySnapshot), { status: 200 })
  const logs = []
  const refresher = createRegistryRefresher(baseConfig, { info: (m) => logs.push(m), debug: () => {} })
  const ok = await refresher.refresh('test')
  assert.equal(ok, true)
  assert.equal(loadRegistry().generatedAt, '2099-01-01T00:00:00Z')
  const hit = searchRegistry({ query: 'future', limit: 5 })
  assert.equal(hit.plugins[0].fullName, 'future/new-plugin')
  assert.ok(logs[0].includes('registry refreshed (test)'))
})

test('invalid payloads are rejected and keep the current registry', async () => {
  const before = loadRegistry().plugins.length
  const cases = [
    '{}',
    '{"generatedAt":"x","plugins":[]}',
    '{"generatedAt":"x","plugins":[{"fullName":"a/b"}]}',
    '{"generatedAt":"x","plugins":[{"fullName":"a/b","url":"https://x","stars":"lots","category":"c"}]}',
    'not json at all',
  ]
  for (const body of cases) {
    globalThis.fetch = async () => new Response(body, { status: 200 })
    const refresher = createRegistryRefresher(baseConfig)
    assert.equal(await refresher.refresh('test'), false)
  }
  assert.equal(loadRegistry().plugins.length, before)
})

test('HTTP errors, timeouts, and network failures keep the current registry', async () => {
  const before = loadRegistry().plugins.length
  globalThis.fetch = async () => new Response('nope', { status: 503 })
  assert.equal(await createRegistryRefresher(baseConfig).refresh('test'), false)

  globalThis.fetch = async () => {
    throw new Error('ECONNREFUSED')
  }
  assert.equal(await createRegistryRefresher(baseConfig).refresh('test'), false)

  assert.equal(loadRegistry().plugins.length, before)
})

test('empty registryUrl disables the refresher', async () => {
  let called = false
  globalThis.fetch = async () => {
    called = true
    return new Response('{}')
  }
  assert.equal(await createRegistryRefresher({ ...baseConfig, registryUrl: '' }).refresh('test'), false)
  assert.equal(called, false)
})

test('setRegistry guards against malformed data', () => {
  assert.throws(() => setRegistry(null))
  assert.throws(() => setRegistry({ plugins: 'nope' }))
  setRegistry({ generatedAt: 't', plugins: [] })
  assert.deepEqual(loadRegistry().plugins, [])
  resetRegistryCache()
  assert.ok(loadRegistry().plugins.length > 100)
})
