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

// First-seen bookkeeping with honest semantics:
//   · no previous snapshot (catalog bootstrap) → OMIT firstSeenAt entirely:
//     the catalog's birth date is not each repo's first-seen date, so nothing
//     may claim to be "new".
//   · previous entry exists with firstSeenAt → preserve it.
//   · previous entry exists WITHOUT firstSeenAt (pre-tracking legacy entry)
//     → keep omitting it: we don't know the real first-seen date.
//   · previous entry absent → genuinely newly collected today → record today.
function firstSeenOf(r, generatedAt) {
  if (previous === null) return undefined
  const prev = previous.get(r.fullName)
  if (prev !== undefined) return prev.firstSeenAt
  return generatedAt
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
  const firstSeenAt = firstSeenOf(r, generatedAt)
  if (firstSeenAt !== undefined) entry.firstSeenAt = firstSeenAt
  // Sticky audit fields: the nightly audit enriches these; a sync must not
  // wipe them just because one night's audit run was skipped or failed.
  // (tier, auditAt, riskSignals, version)
  // publishedAt/repoSizeKb are FACTS carried by the aggregation itself
  // (GitHub search returns created_at/size) — prefer the fresh daily value,
  // fall back to the previous snapshot so new pipelines stay backfilled.
  const prevAudit = previous?.get(r.fullName)
  if (prevAudit?.tier) entry.tier = prevAudit.tier
  if (prevAudit?.auditAt) entry.auditAt = prevAudit.auditAt
  if (Array.isArray(prevAudit?.riskSignals)) entry.riskSignals = prevAudit.riskSignals
  if (prevAudit?.version) entry.version = prevAudit.version
  const publishedAt = r.publishedAt || prevAudit?.publishedAt
  if (publishedAt) entry.publishedAt = publishedAt
  const repoSizeKb = r.repoSizeKb || prevAudit?.repoSizeKb
  if (repoSizeKb) entry.repoSizeKb = repoSizeKb
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
