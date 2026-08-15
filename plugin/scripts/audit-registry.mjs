// Nightly supply-chain audit: enrich every registry entry with a trust tier.
// Reads each repo's root package.json + GitHub metadata, computes the tier
// (see src/trust.js), and writes tier/auditAt/signals back into
// data/registry.json. Runs in CI with GH_TOKEN (2 requests per plugin);
// without a token it audits only a bounded sample and prints a hint.
//
// Failure semantics: transient per-repo errors KEEP the previous tier
// (no churn from flaky networks); only decisive facts downgrade.

import { readFileSync, writeFileSync } from 'node:fs'
import { createGithubClient } from '../src/live.js'
import { computeTier } from '../src/trust.js'

const REGISTRY = new URL('../data/registry.json', import.meta.url)
const SAMPLE_LIMIT = 30

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ''
const github = createGithubClient({ githubToken: token, liveTimeoutMs: 12000 })

async function main() {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'))
  const plugins = Array.isArray(registry.plugins) ? registry.plugins : []
  const limited = !token && plugins.length > SAMPLE_LIMIT
  const targets = limited ? plugins.slice(0, SAMPLE_LIMIT) : plugins
  console.log(`auditing ${targets.length}/${plugins.length} plugins${limited ? ' (no GH_TOKEN — sample only)' : ''}`)

  let audited = 0
  let failed = 0
  for (const entry of targets) {
    try {
      const repo = await github.getRepo(entry.fullName, new AbortController().signal)
      const manifest = await github.getPackageJson(entry.fullName, new AbortController().signal)
      const result = computeTier({ entry, manifest, repo })
      entry.tier = result.tier
      entry.auditAt = result.auditAt
      entry.riskSignals = result.signals
      audited += 1
    } catch (e) {
      // Keep previous tier on transient failures; decisive facts only downgrade.
      failed += 1
      if (!entry.tier) {
        entry.tier = 'unverified'
        entry.auditAt = new Date().toISOString()
        entry.riskSignals = [`audit failed: ${String(e?.message || e).slice(0, 80)}`]
      }
    }
  }

  registry.auditedAt = new Date().toISOString()
  writeFileSync(REGISTRY, `${JSON.stringify(registry, null, 1)}\n`)
  const byTier = {}
  for (const p of plugins) byTier[p.tier || 'pending'] = (byTier[p.tier || 'pending'] || 0) + 1
  console.log(`done: audited=${audited} failed=${failed} tiers=${JSON.stringify(byTier)}${limited ? ' (sample)' : ''}`)
}

main().catch((e) => {
  console.error('audit-registry failed:', e)
  process.exit(1)
})
