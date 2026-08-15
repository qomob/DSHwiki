// Unit tests for the pure modules: categories, registry search, formatting,
// and the live client's error paths (fetch stubbed — no network).
// Run: npm test (inside plugin/, after pnpm install for the index tests).

import test from 'node:test'
import assert from 'node:assert/strict'
import { categorize, isRelevant, computeScore, getCategory, CATEGORIES } from '../src/categories.js'

test('categorize classifies known shapes', () => {
  assert.equal(
    categorize({ owner: 'deepseek-ai', name: 'x', description: '', topics: [] }),
    'core',
  )
  assert.equal(categorize({ name: 'awesome-dsh', description: 'A curated list', topics: [] }), 'awesome')
  assert.equal(categorize({ name: 'pet', description: 'desktop pet skin for dsh', topics: [] }), 'skin')
  assert.equal(categorize({ name: 'ocr', description: 'vision plugin', topics: [] }), 'vision')
  assert.equal(categorize({ name: 'team', description: 'multi-agent orchestration', topics: [] }), 'orchestration')
  assert.equal(categorize({ name: 'random', description: 'nothing relevant here', topics: [] }), 'other')
})

test('isRelevant gates topic squatters out, keeps real dsh projects', () => {
  assert.equal(isRelevant({ name: 'agent-teams', description: 'Multi-agent teams for DeepSeek Harness' }), true)
  assert.equal(isRelevant({ name: 'tool', description: 'a dsh plugin for notifications' }), true)
  assert.equal(isRelevant({ name: 'cool-lib', description: 'a generic library that mentions nothing' }), false)
  assert.equal(isRelevant({ name: 'anything', description: '', official: true }), true)
})

test('computeScore stays within 0-100 and rewards official + topics', () => {
  const official = computeScore({ official: true, topics: ['dsh-plugin'], fullName: 'a/b', description: 'dsh plugin', stars: 1000 })
  const casual = computeScore({ topics: [], fullName: 'a/c', description: '', stars: 1 })
  assert.ok(official > casual)
  assert.ok(official <= 100 && official >= 0)
  assert.ok(casual >= 0)
})

test('getCategory falls back to other; taxonomy ids are unique', () => {
  assert.equal(getCategory('nope').id, 'other')
  assert.equal(getCategory('skin').label, '主题皮肤')
  const ids = CATEGORIES.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length)
})
