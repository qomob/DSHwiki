// Formatting + presentation projection tests.

import test from 'node:test'
import assert from 'node:assert/strict'
import { formatSearchOutput, searchMetaFromValue, presentSearchResult, formatInfoOutput } from '../src/format.js'

const sampleValue = {
  source: 'registry',
  query: 'skin',
  total: 2,
  returned: 2,
  truncated: false,
  plugins: [
    {
      fullName: 'someone/dsh-skin',
      description: 'A skin plugin',
      descriptionZh: '皮肤插件',
      stars: 42,
      updatedAt: '2026-08-01T00:00:00Z',
      url: 'https://github.com/someone/dsh-skin',
      category: 'skin',
      categoryLabel: '主题皮肤',
      official: false,
      topics: ['dsh-plugin'],
      installCmd: 'dsh plugin add "github:someone/dsh-skin"',
    },
    {
      fullName: 'deepseek-ai/deepseek-harness',
      description: 'Everything is a Plugin.',
      stars: 80000,
      url: 'https://github.com/deepseek-ai/deepseek-harness',
      category: 'core',
      categoryLabel: '原厂核心',
      official: true,
      installCmd: 'npx @deepseek-ai/dsh web',
    },
  ],
}

test('formatSearchOutput renders markdown with install commands and links', () => {
  const text = formatSearchOutput(sampleValue)
  assert.ok(text.includes('**someone/dsh-skin**'))
  assert.ok(text.includes('Install: `dsh plugin add "github:someone/dsh-skin"`'))
  assert.ok(text.includes('https://github.com/someone/dsh-skin'))
  assert.ok(text.includes('皮肤插件'))
  assert.ok(text.includes('dsh plugin --profile <name>'))

  const empty = formatSearchOutput({ source: 'registry', query: 'x', total: 0, returned: 0, truncated: false, plugins: [] })
  assert.ok(empty.includes('No dsh plugins matched'))
})

test('searchMetaFromValue projects citeable sources for the web card', () => {
  const meta = searchMetaFromValue(sampleValue)
  assert.equal(meta.sources.length, 2)
  assert.equal(meta.sources[0].url, 'https://github.com/someone/dsh-skin')
  assert.equal(meta.sources[0].title, 'someone/dsh-skin')
  assert.equal(meta.truncated, false)
})

test('presentSearchResult builds a web card from result meta', () => {
  const view = presentSearchResult({ query: 'skin' }, { isError: false, meta: searchMetaFromValue(sampleValue) })
  assert.equal(view.card, 'web')
  assert.equal(view.kind, 'search')
  assert.equal(view.title, 'plugin_search: skin')
  assert.equal(view.sources.length, 2)
  // Error results and missing meta degrade to the generic card.
  assert.equal(presentSearchResult({}, { isError: true }), undefined)
  assert.equal(presentSearchResult({}, { isError: false }), undefined)
})

test('formatInfoOutput covers found / not-found / registry note', () => {
  const found = formatInfoOutput({ repo: 'someone/dsh-skin', found: true, source: 'registry', snapshotAt: '2026-08-14T00:00:00Z', plugin: sampleValue.plugins[0] })
  assert.ok(found.includes('**someone/dsh-skin**'))
  assert.ok(found.includes('embedded registry snapshot'))

  const live = formatInfoOutput({ repo: 'someone/dsh-skin', found: true, source: 'live', plugin: sampleValue.plugins[0] })
  assert.ok(live.includes('live GitHub API'))

  const missing = formatInfoOutput({ repo: 'nope/missing', found: false, source: 'live' })
  assert.ok(missing.includes('No GitHub repository found'))
})
