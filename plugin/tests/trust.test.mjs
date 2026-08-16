// Trust-tier computation tests — pure, no I/O.

import test from 'node:test'
import assert from 'node:assert/strict'
import { computeTier, isInstallAllowed, TIERS } from '../src/trust.js'

const NOW = Date.parse('2026-08-16T00:00:00Z')

const manifest = { name: 'x', dsh: { bundle: { patch: './c.yml' } } }
const repo = { archived: false, pushed_at: '2026-08-10T00:00:00Z' }

test('clean active bundle with license → verified, no signals', () => {
  const r = computeTier({ entry: { fullName: 'a/b', license: 'MIT' }, manifest, repo, now: NOW })
  assert.equal(r.tier, 'verified')
  assert.deepEqual(r.signals, [])
  assert.ok(r.auditAt)
})

test('official repos are always verified', () => {
  const r = computeTier({ entry: { official: true }, manifest: undefined, repo: undefined, now: NOW })
  assert.equal(r.tier, 'verified')
})

test('unreachable manifest → unverified with signal', () => {
  const r = computeTier({ entry: { fullName: 'a/b' }, manifest: undefined, repo: undefined, now: NOW })
  assert.equal(r.tier, 'unverified')
  assert.ok(r.signals.some((x) => x.includes('unreachable')))
})

test('install-time scripts downgrade to unverified', () => {
  const r = computeTier({ entry: {}, manifest: { ...manifest, scripts: { prepare: 'tsdown' } }, repo, now: NOW })
  assert.equal(r.tier, 'unverified')
  assert.ok(r.signals.some((x) => x.includes('install-time scripts')))
})

test('archived → unverified', () => {
  const r = computeTier({ entry: {}, manifest, repo: { ...repo, archived: true }, now: NOW })
  assert.equal(r.tier, 'unverified')
  assert.ok(r.signals.includes('repo archived'))
})

test('stale over 2 years → unverified; stale but real → community', () => {
  const stale = computeTier({ entry: {}, manifest, repo: { archived: false, pushed_at: '2024-01-01T00:00:00Z' }, now: NOW })
  assert.equal(stale.tier, 'unverified')
  assert.ok(stale.signals.some((x) => x.includes('2 years')))

  // ~590 days: past one year, under two years → community + year signal
  const mid = computeTier({ entry: { license: 'MIT' }, manifest, repo: { archived: false, pushed_at: '2025-01-02T00:00:00Z' }, now: NOW })
  assert.equal(mid.tier, 'community')
  assert.ok(mid.signals.some((x) => x.includes('over a year')))
})

test('manifest without bundle → unverified with monorepo hint', () => {
  const r = computeTier({
    entry: {},
    manifest: { workspaces: ['packages/*'] },
    repo,
    now: NOW,
  })
  assert.equal(r.tier, 'unverified')
  assert.ok(r.signals.some((x) => x.includes('subpackage')))
})

test('no license is a signal but not a downgrade', () => {
  const r = computeTier({ entry: {}, manifest, repo, now: NOW })
  // manifest clean, no license field on entry → verified + license signal
  assert.equal(r.tier, 'verified')
  assert.ok(r.signals.includes('no license declared'))
})

test('isInstallAllowed enforces verified-only policy', () => {
  assert.equal(isInstallAllowed('verified', 'verified-only'), true)
  assert.equal(isInstallAllowed('community', 'verified-only'), false)
  assert.equal(isInstallAllowed('unverified', 'verified-only'), false)
  assert.equal(isInstallAllowed('unverified', 'ask'), true)
  assert.equal(TIERS.length, 3)
})

test('normalized repo shape also feeds computeTier (archived/pushedAt)', () => {
  // live.js normalize() output uses camelCase — computeTier must accept it.
  const r = computeTier({
    entry: { license: 'MIT' },
    manifest,
    repo: { archived: true, pushedAt: '2024-01-01T00:00:00Z' },
    now: NOW,
  })
  assert.equal(r.tier, 'unverified')
  assert.ok(r.signals.includes('repo archived'))
})

test('archived detection works with normalized shape (was silently broken)', () => {
  // Before the fix, normalize() dropped `archived`, so archived repos were
  // never downgraded — this test pins the regression.
  const r = computeTier({ entry: { license: 'MIT' }, manifest, repo: { archived: true, pushedAt: '2026-08-01T00:00:00Z' }, now: NOW })
  assert.equal(r.tier, 'unverified')
  assert.ok(r.signals.includes('repo archived'))
})
