// Supply-chain trust tiers — the marketplace's "safe to install" contract.
//
// Every registry entry gets a tier from deterministic signals (repo manifest
// + GitHub metadata). Tiers are explainable: each carries its risk signals,
// so the UI and the install gate can show *why*.
//
//   verified   — official, or manifest-clean & active & unarchived
//   community  — real dsh bundle/client, active enough, not risky
//   unverified — manifest unreachable, install-time scripts, archived, or
//                too stale to recommend
//
// Pure — unit-testable, no I/O.

export const TIERS = ['verified', 'community', 'unverified']

export const TIER_META = {
  verified: { label: '已验证', en: 'Verified' },
  community: { label: '社区', en: 'Community' },
  unverified: { label: '未验证', en: 'Unverified' },
}

const DAYS = 86400000

function daysBetween(iso, now) {
  if (!iso) return Infinity
  const t = Date.parse(iso)
  return Number.isFinite(t) ? (now - t) / DAYS : Infinity
}

/**
 * Compute the trust tier and its explainable signals.
 * @param entry - registry entry (official/installType/license/updatedAt/url).
 * @param manifest - parsed repo-root package.json, undefined when unreachable.
 * @param repo - GitHub repo metadata (archived, owner, pushedAt), undefined when unreachable.
 * @param now - reference timestamp (ms) for staleness math.
 * @returns { tier, signals, auditAt } — auditAt is the caller's timestamp.
 */
export function computeTier({ entry, manifest, repo, now = Date.now() }) {
  const signals = []
  const hasBundle = Boolean(manifest?.dsh?.bundle)
  const hasClient = Boolean(manifest?.dsh?.client)
  const scripts = manifest?.scripts ?? {}
  const hasPrepare = ['prepare', 'preinstall', 'install', 'postinstall'].some(
    (k) => typeof scripts[k] === 'string' && scripts[k].trim() !== '',
  )
  const hasWorkspaces = Array.isArray(manifest?.workspaces) && manifest.workspaces.length > 0
  const archived = Boolean(repo?.archived)
  const pushedDays = daysBetween(repo?.pushed_at || entry?.updatedAt, now)

  if (!entry?.license) signals.push('no license declared')
  if (manifest !== undefined && !hasBundle && !hasClient) signals.push('no dsh manifest at repo root')
  if (hasWorkspaces && !hasBundle) signals.push('bundle may live in a subpackage (monorepo)')
  if (hasPrepare) signals.push('install-time scripts (prepare/preinstall)')
  if (archived) signals.push('repo archived')
  if (pushedDays === Infinity) signals.push('activity unknown')
  else if (pushedDays > 730) signals.push('no updates in over 2 years')
  else if (pushedDays > 365) signals.push('no updates in over a year')
  if (manifest === undefined && repo === undefined) signals.push('manifest and repo metadata unreachable')

  let tier
  if (entry?.official) {
    tier = 'verified'
  } else if (manifest === undefined) {
    tier = 'unverified'
  } else if (hasPrepare || archived || pushedDays > 730) {
    tier = 'unverified'
  } else if (hasBundle || hasClient) {
    tier = pushedDays <= 180 ? 'verified' : 'community'
  } else {
    tier = 'unverified'
  }

  return { tier, signals: [...new Set(signals)], auditAt: new Date(now).toISOString() }
}

// The tab's "verified-only" policy reads this: only verified installs pass.
export function isInstallAllowed(tier, policy) {
  if (policy === 'verified-only') return tier === 'verified'
  return true // 'ask' and defaults: tier is advisory, approval gate still applies
}
