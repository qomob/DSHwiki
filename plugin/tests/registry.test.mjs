// Registry snapshot search tests — offline, against the embedded snapshot.

import test from 'node:test'
import assert from 'node:assert/strict'
import { searchRegistry, findInRegistry, loadRegistry, projectEntry } from '../src/registry.js'

test('embedded snapshot loads and is non-empty', () => {
  const registry = loadRegistry()
  assert.ok(registry.plugins.length > 100, 'snapshot should carry the curated catalog')
  assert.ok(typeof registry.generatedAt === 'string')
})

test('searchRegistry matches tokens across name/description/topics (AND)', () => {
  const hit = searchRegistry({ query: 'skin', limit: 5 })
  assert.ok(hit.total > 0)
  assert.ok(hit.plugins.length <= 5)
  assert.equal(hit.source, 'registry')
  assert.equal(hit.truncated, hit.total > hit.returned)

  // Multi-token AND: each result must contain every token somewhere.
  const multi = searchRegistry({ query: 'dsh skin', limit: 10 })
  for (const p of multi.plugins) {
    const hay = `${p.fullName} ${p.description} ${p.descriptionZh || ''} ${(p.topics || []).join(' ')}`.toLowerCase()
    assert.ok(hay.includes('dsh') && hay.includes('skin'), `${p.fullName} should match both tokens`)
  }

  const miss = searchRegistry({ query: 'zzz-no-such-plugin-xyz', limit: 5 })
  assert.equal(miss.total, 0)
  assert.equal(miss.plugins.length, 0)
})

test('searchRegistry filters by category and sorts', () => {
  const filtered = searchRegistry({ category: 'skin', limit: 50 })
  assert.ok(filtered.total > 0)
  for (const p of filtered.plugins) assert.equal(p.category, 'skin')

  const byStars = searchRegistry({ sort: 'stars', limit: 50 })
  const stars = byStars.plugins.map((p) => p.stars)
  assert.deepEqual(stars, [...stars].sort((a, b) => b - a), 'stars sort must be descending')

  const byUpdated = searchRegistry({ sort: 'updated', limit: 50 })
  for (let i = 1; i < byUpdated.plugins.length; i++) {
    assert.ok(byUpdated.plugins[i - 1].updatedAt >= byUpdated.plugins[i].updatedAt)
  }
})

test('searchRegistry respects limit and reports truncation', () => {
  const all = searchRegistry({ limit: 3 })
  assert.equal(all.plugins.length, Math.min(3, all.total))
  assert.equal(all.truncated, all.total > 3)
})

test('findInRegistry is case-insensitive and validates shape', () => {
  const a = findInRegistry('deepseek-ai/deepseek-harness')
  const b = findInRegistry('DeepSeek-AI/DeepSeek-Harness')
  assert.ok(a && b)
  assert.equal(a.fullName, b.fullName)
  assert.equal(findInRegistry('not a repo!!'), undefined)
  assert.equal(findInRegistry('nope/does-not-exist'), undefined)
})

test('projectEntry always yields an install command and category label', () => {
  const community = projectEntry({ fullName: 'someone/some-dsh-tool', description: '', stars: 3, url: 'https://github.com/someone/some-dsh-tool', topics: [] })
  assert.equal(community.installCmd, 'dsh plugin add "github:someone/some-dsh-tool"')
  assert.equal(community.categoryLabel, '其他')

  const awesome = projectEntry({ fullName: 'x/awesome-dsh', installType: 'awesome', url: 'https://github.com/x/awesome-dsh', stars: 1, description: '' })
  assert.ok(awesome.installCmd.startsWith('git clone'))

  const withZh = projectEntry({ fullName: 'a/b', description: 'en', descriptionZh: '中', stars: 1, url: 'https://github.com/a/b', category: 'skin' })
  assert.equal(withZh.descriptionZh, '中')
  assert.equal(withZh.categoryLabel, '主题皮肤')
})
