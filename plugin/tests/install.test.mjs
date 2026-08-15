// Install-loop tests: manifest analysis, spec/command building, profile and
// CLI detection, and the approval-gated execute flow (approval + spawn both
// stubbed — nothing here touches the network or spawns processes).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzeInstall,
  specFromInstallCmd,
  detectProfile,
  resolveDshBin,
  buildInstallArgs,
  createInstaller,
} from '../src/install.js'

test('specFromInstallCmd preserves #path fragments from curated commands', () => {
  assert.equal(specFromInstallCmd('dsh plugin add "github:qomob/dsh#path:/plugin"'), 'github:qomob/dsh#path:/plugin')
  assert.equal(specFromInstallCmd('dsh plugin add "github:a/b"'), 'github:a/b')
  assert.equal(specFromInstallCmd('git clone https://x'), null)
  assert.equal(specFromInstallCmd(''), null)
})

test('analyzeInstall flags a clean bundle', () => {
  const out = analyzeInstall({
    fullName: 'a/good-plugin',
    manifest: { name: 'good-plugin', dsh: { bundle: { patch: './cordis.patch.yml' } }, scripts: { test: 'x' } },
    registryEntry: undefined,
  })
  assert.equal(out.kind, 'plugin')
  assert.equal(out.installable, true)
  assert.equal(out.hasBundle, true)
  assert.equal(out.hasPrepare, false)
  assert.equal(out.spec, 'github:a/good-plugin')
  assert.deepEqual(out.risks, [])
})

test('analyzeInstall warns on install-time scripts and missing manifests', () => {
  const risky = analyzeInstall({
    fullName: 'a/ts-plugin',
    manifest: { scripts: { prepare: 'tsdown' }, dsh: { bundle: { patch: './x.yml' } } },
  })
  assert.equal(risky.hasPrepare, true)
  assert.ok(risky.risks.some((r) => r.includes('authorization')))

  const monorepo = analyzeInstall({
    fullName: 'a/mono',
    manifest: { workspaces: ['packages/*'] },
  })
  assert.equal(monorepo.hasBundle, false)
  assert.ok(monorepo.risks.some((r) => r.includes('subpackage')))

  const plain = analyzeInstall({ fullName: 'a/plain', manifest: { name: 'plain' } })
  assert.ok(plain.risks.some((r) => r.includes('no config layer')))

  const unreachable = analyzeInstall({ fullName: 'a/unknown', manifest: undefined })
  assert.ok(unreachable.notes.some((n) => n.includes('unreachable')))
  assert.equal(unreachable.spec, 'github:a/unknown')
})

test('analyzeInstall routes curated awesome/runtime entries away from plugin add', () => {
  const clone = analyzeInstall({
    fullName: 'x/awesome-dsh',
    manifest: {},
    registryEntry: { installType: 'awesome', url: 'https://github.com/x/awesome-dsh' },
  })
  assert.equal(clone.kind, 'clone')
  assert.equal(clone.installable, false)

  const runtime = analyzeInstall({
    fullName: 'deepseek-ai/deepseek-harness',
    manifest: {},
    registryEntry: { official: true },
  })
  assert.equal(runtime.kind, 'runtime')
  assert.equal(runtime.installable, false)
  assert.equal(runtime.command, 'npx @deepseek-ai/dsh web')
})

test('detectProfile reads argv in both forms, defaulting to web', () => {
  assert.equal(detectProfile(['node', '/bin/dsh', 'web']), 'web')
  assert.equal(detectProfile(['node', '/bin/dsh', '--profile', 'demo', 'web']), 'demo')
  assert.equal(detectProfile(['node', '/bin/dsh', '--profile=hub']), 'hub')
  assert.equal(detectProfile(['node', '/bin/dsh', '--profile']), 'web')
})

test('resolveDshBin prefers config, env, then the running entry, then PATH', () => {
  assert.deepEqual(resolveDshBin({ config: { dshBin: '/opt/dsh' } }), { command: '/opt/dsh', prefix: [] })
  assert.deepEqual(resolveDshBin({ env: { DSH_PLUGIN_HUB_DSH_BIN: '/env/dsh' } }), { command: '/env/dsh', prefix: [] })
  assert.deepEqual(
    resolveDshBin({ argv: ['node', '/npx/hash/node_modules/.bin/dsh'] }),
    { command: '/npx/hash/node_modules/.bin/dsh', prefix: [] },
  )
  assert.deepEqual(
    resolveDshBin({ argv: ['node', '/x/@deepseek-ai/dsh/lib/cli.js'] }),
    { command: process.execPath, prefix: ['/x/@deepseek-ai/dsh/lib/cli.js'] },
  )
  assert.deepEqual(resolveDshBin({ argv: ['node', 'script.js'] }), { command: 'dsh', prefix: [] })
  assert.deepEqual(buildInstallArgs({ spec: 'github:a/b', profile: 'p' }), ['plugin', '--profile', 'p', 'add', 'github:a/b'])
})

function fakeInstaller({ manifest, registryEntry = undefined, spawnResult, repo } = {}) {
  const github = {
    async getPackageJson() {
      return manifest
    },
    async getRepo() {
      return repo ?? { archived: false, pushed_at: '2026-08-01T00:00:00Z' }
    },
  }
  const spawnImpl = async () => spawnResult ?? { ok: true, code: 0, stdout: '+ dsh-plugin-hub', stderr: '' }
  return createInstaller(
    { installTimeoutMs: 5000 },
    { github, spawnImpl, findRegistry: () => registryEntry },
  )
}

test('installer.plan merges registry spec fragments and manifest facts', async () => {
  const installer = fakeInstaller({
    manifest: { dsh: { bundle: { patch: './c.yml' } }, scripts: { prepare: 'build' } },
    registryEntry: { installCmd: 'dsh plugin add "github:qomob/dsh#path:/plugin"', installType: 'plugin' },
  })
  const plan = await installer.plan({ repo: 'qomob/dsh', profile: 'demo' })
  assert.equal(plan.spec, 'github:qomob/dsh#path:/plugin')
  assert.equal(plan.command, 'dsh plugin --profile demo add "github:qomob/dsh#path:/plugin"')
  assert.equal(plan.hasBundle, true)
  assert.equal(plan.hasPrepare, true)
  assert.ok(Array.isArray(plan.notes))
})

test('installer.run reports success, failure, and the allowBuilds hint', async () => {
  const ok = fakeInstaller({ manifest: { dsh: { bundle: {} } } })
  const plan = await ok.plan({ repo: 'a/b', profile: 'demo' })
  const done = await ok.run(plan, {})
  assert.equal(done.status, 'installed')
  assert.equal(done.exitCode, 0)

  const failing = fakeInstaller({
    manifest: {},
    spawnResult: { ok: false, code: 1, stdout: '', stderr: 'ERR_PNPM_PREPARE_SCRIPT refused to run prepare' },
  })
  const plan2 = await failing.plan({ repo: 'a/b', profile: 'demo' })
  const failed = await failing.run(plan2, {})
  assert.equal(failed.status, 'failed')
  assert.ok(failed.output.includes('allowBuilds'))

  const notInstallable = fakeInstaller({ manifest: {}, registryEntry: { installType: 'awesome', url: 'https://github.com/x/a' } })
  const plan3 = await notInstallable.plan({ repo: 'x/a', profile: 'demo' })
  assert.equal((await notInstallable.run(plan3, {})).status, 'not-installable')
})
