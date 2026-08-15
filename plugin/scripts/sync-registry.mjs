// Regenerate plugin/data/registry.json from the DSHwiki aggregation output
// (src/data/repos.json). Run after `npm run aggregate` at the repo root, or
// let CI run it — the embedded snapshot is what plugin_search serves offline.
//
// Mirrors the aggregation pipeline's safety rule: invalid input aborts without
// touching the previous good snapshot.

import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = new URL('../../src/data/repos.json', import.meta.url)
const TARGET = new URL('../data/registry.json', import.meta.url)

// Previous snapshot, if present: preserves each repo's firstSeenAt across
// daily syncs so the marketplace can tell "new this week" from long-standing.
let previous = null
try {
  const old = JSON.parse(readFileSync(TARGET, 'utf8'))
  if (old && Array.isArray(old.plugins)) {
    previous = new Map(old.plugins.map((p) => [p.fullName, p]))
  }
} catch {
  previous = null // first bootstrap or unreadable — fall back per repo
}

// Compact a repos.json entry to the fields the plugin actually serves.
function project(r, generatedAt) {
  const entry = {
    fullName: r.fullName,
    description: r.descriptionOriginal || r.description || '',
    stars: r.stars || 0,
    updatedAt: r.updatedAt || undefined,
    category: r.category || 'other',
    topics: Array.isArray(r.topics) ? r.topics.slice(0, 8) : [],
    official: Boolean(r.official),
    installType: r.installType || 'plugin',
    installCmd: r.installCmd || '',
    url: r.url,
  }
  // First-seen bookkeeping: keep the recorded date, else the repo's last
  // update as a conservative bootstrap, else the snapshot date.
  const prev = previous?.get(r.fullName)
  entry.firstSeenAt = prev?.firstSeenAt || r.updatedAt || generatedAt
  if (r.translated && r.description && r.description !== r.descriptionOriginal) {
    entry.descriptionZh = r.description
  }
  if (r.homepage) entry.homepage = r.homepage
  if (r.language) entry.language = r.language
  if (r.license) entry.license = r.license
  // Drop undefined values so the JSON stays compact.
  return Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined))
}

function validate(repos) {
  const errors = []
  if (!Array.isArray(repos) || repos.length === 0) {
    throw new Error('repos.json has no entries — refusing to overwrite the snapshot with empty data')
  }
  repos.forEach((r, i) => {
    for (const key of ['fullName', 'url', 'category', 'stars']) {
      if (r[key] == null) errors.push(`repos[${i}].${key} missing (${r.fullName || 'unknown'})`)
    }
    if (typeof r.url !== 'string' || !r.url.startsWith('https://')) {
      errors.push(`repos[${i}].url invalid: ${r.url}`)
    }
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(r.fullName || '')) {
      errors.push(`repos[${i}].fullName invalid: ${r.fullName}`)
    }
  })
  if (errors.length > 0) {
    throw new Error(`snapshot validation failed:\n  - ${errors.slice(0, 10).join('\n  - ')}`)
  }
}

const source = JSON.parse(readFileSync(SOURCE, 'utf8'))
validate(source.repos)

const seen = new Set()
const plugins = []
for (const r of source.repos) {
  if (seen.has(r.fullName)) continue // dedupe, first occurrence wins
  seen.add(r.fullName)
  plugins.push(project(r, source.generatedAt || new Date().toISOString()))
}

const output = {
  generatedAt: source.generatedAt || new Date().toISOString(),
  source: 'DSHwiki aggregation pipeline (https://dsh.qomob.ai)',
  count: plugins.length,
  plugins,
}

writeFileSync(TARGET, `${JSON.stringify(output, null, 1)}\n`)
console.log(`synced ${plugins.length} plugins → plugin/data/registry.json (snapshot ${output.generatedAt})`)
