// Embedded registry snapshot access. data/registry.json is generated from the
// DSHwiki aggregation pipeline (src/data/repos.json) by scripts/sync-registry.mjs,
// so the plugin works fully offline with the same curated data the site shows.

import { readFileSync } from 'node:fs'
import { getCategory } from './categories.js'

let cached = null

// Load and cache the embedded snapshot. Shape:
// { generatedAt, count, plugins: RegistryEntry[] }
export function loadRegistry() {
  if (cached === null) {
    const raw = readFileSync(new URL('../data/registry.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(raw)
    cached = {
      generatedAt: parsed.generatedAt,
      plugins: Array.isArray(parsed.plugins) ? parsed.plugins : [],
    }
  }
  return cached
}

// Test-only: reset the module cache (fresh read after regenerating data).
export function resetRegistryCache() {
  cached = null
}

// Swap the active registry (runtime auto-refresh path). `data` must already
// be validated by the caller; the swap is atomic for concurrent searches.
export function setRegistry(data) {
  if (data === null || typeof data !== 'object' || !Array.isArray(data.plugins)) {
    throw new Error('setRegistry: data.plugins must be an array')
  }
  cached = { generatedAt: data.generatedAt ?? null, plugins: data.plugins }
}

function tokenize(query) {
  return String(query || '')
    .toLowerCase()
    .split(/[\s,，、/]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function haystack(entry) {
  return [
    entry.fullName,
    entry.name || entry.fullName.split('/')[1] || '',
    entry.description || '',
    entry.descriptionZh || '',
    (entry.topics || []).join(' '),
  ]
    .join(' \n ')
    .toLowerCase()
}

// Relevance for query hits: token coverage plus field boosts (name match
// outweighs topic match outweighs description match), then popularity and
// freshness nudges.
function matchScore(entry, tokens) {
  if (tokens.length === 0) return 0
  const name = `${entry.fullName}`.toLowerCase()
  const topics = (entry.topics || []).join(' ').toLowerCase()
  const desc = `${entry.description || ''} ${entry.descriptionZh || ''}`.toLowerCase()
  let score = 0
  for (const token of tokens) {
    if (name.includes(token)) score += 6
    else if (topics.includes(token)) score += 4
    else if (desc.includes(token)) score += 2
    else return -1 // every token must match somewhere (AND semantics)
  }
  if (entry.official) score += 3
  score += Math.log10((entry.stars || 0) + 1)
  return score
}

function daysSince(iso) {
  if (!iso) return Infinity
  const t = Date.parse(iso)
  return Number.isFinite(t) ? (Date.now() - t) / 86400000 : Infinity
}

// Search the embedded snapshot. Pure — safe to unit test.
// Returns { source, total, returned, truncated, note?, plugins }.
export function searchRegistry({ query, category, sort = 'relevance', limit = 8 }) {
  const registry = loadRegistry()
  const tokens = tokenize(query)
  const cap = Math.max(1, Math.min(50, Number(limit) || 8))

  let matches = registry.plugins.map((entry) => ({ entry, score: matchScore(entry, tokens) }))
  if (tokens.length > 0) matches = matches.filter((m) => m.score >= 0)
  if (category && category !== 'all') {
    matches = matches.filter((m) => (m.entry.category || 'other') === category)
  }

  const sorters = {
    relevance: (a, b) =>
      b.score - a.score ||
      (b.entry.stars || 0) - (a.entry.stars || 0) ||
      daysSince(a.entry.updatedAt) - daysSince(b.entry.updatedAt),
    stars: (a, b) => (b.entry.stars || 0) - (a.entry.stars || 0),
    updated: (a, b) => daysSince(a.entry.updatedAt) - daysSince(b.entry.updatedAt),
  }
  matches.sort(sorters[sort] || sorters.relevance)

  const total = matches.length
  const top = matches.slice(0, cap)
  return {
    source: 'registry',
    total,
    returned: top.length,
    truncated: total > top.length,
    snapshotAt: registry.generatedAt,
    plugins: top.map((m) => projectEntry(m.entry)),
  }
}

// Find one entry by full name (case-insensitive, accepts 'owner/name').
export function findInRegistry(fullName) {
  const wanted = String(fullName || '').trim().toLowerCase().replace(/^github:\s*/, '')
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(wanted)) return undefined
  return loadRegistry().plugins.find((p) => p.fullName.toLowerCase() === wanted)
}

// Canonical projection shared by both search sources.
export function projectEntry(entry) {
  const category = getCategory(entry.category)
  const out = {
    fullName: entry.fullName,
    description: entry.description || '',
    stars: entry.stars || 0,
    url: entry.url || `https://github.com/${entry.fullName}`,
    category: category.id,
    categoryLabel: category.label,
    official: Boolean(entry.official),
  }
  if (entry.descriptionZh) out.descriptionZh = entry.descriptionZh
  if (entry.updatedAt) out.updatedAt = entry.updatedAt
  if (Array.isArray(entry.topics)) out.topics = entry.topics.slice(0, 8)
  if (entry.installCmd) out.installCmd = entry.installCmd
  else if (entry.installType === 'awesome') out.installCmd = `git clone ${out.url}.git`
  else if (entry.official) out.installCmd = 'npx @deepseek-ai/dsh web'
  else out.installCmd = `dsh plugin add "github:${entry.fullName}"`
  if (entry.homepage) out.homepage = entry.homepage
  if (entry.language) out.language = entry.language
  if (entry.license) out.license = entry.license
  if (entry.tier) out.tier = entry.tier
  if (entry.auditAt) out.auditAt = entry.auditAt
  if (Array.isArray(entry.riskSignals) && entry.riskSignals.length > 0) out.riskSignals = entry.riskSignals
  return out
}
