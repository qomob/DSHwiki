// Install closing the loop: turn a discovered plugin into an actually
// installed bundle. Three layers:
//
//   1. Pure analysis — read the target repo's package.json manifest and the
//      curated registry entry, produce the REAL install spec plus risk flags
//      (build authorization, missing dsh.bundle, monorepo subdirectory).
//   2. Command building — dsh CLI resolution + current-profile detection.
//   3. Execution — spawn `dsh plugin --profile <name> add <spec>` with a
//      timeout, capturing bounded output. Gated upstream by the approval
//      service (see index.js), never by anything in here.

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findInRegistry } from './registry.js'
import { computeTier } from './trust.js'

const INSTALL_SCRIPT_KEYS = ['prepare', 'preinstall', 'install', 'postinstall']

// --- 1. Pure manifest analysis -------------------------------------------

// Extract a github: install spec from a known registry installCmd, preserving
// #path:/#ref fragments the curation pipeline recorded.
export function specFromInstallCmd(installCmd) {
  const m = /github:([^\s"]+)/.exec(String(installCmd || ''))
  return m ? `github:${m[1]}` : null
}

// Analyze a repo's package.json (may be null when unreachable) together with
// the curated registry entry (may be undefined). Returns the install plan's
// verification core — pure, no I/O.
export function analyzeInstall({ fullName, manifest, registryEntry }) {
  const risks = []
  const notes = []

  // Non-plugin install kinds from the curated entry.
  const kind = registryEntry?.installType === 'awesome'
    ? 'clone'
    : registryEntry?.official
      ? 'runtime'
      : 'plugin'

  if (kind === 'clone') {
    return {
      kind,
      spec: null,
      command: null,
      installable: false,
      risks: ['curated as an awesome list — git clone it instead of installing'],
      hasBundle: false,
      hasClient: false,
      hasPrepare: false,
    }
  }
  if (kind === 'runtime') {
    return {
      kind,
      spec: null,
      command: 'npx @deepseek-ai/dsh web',
      installable: false,
      risks: [],
      hasBundle: false,
      hasClient: false,
      hasPrepare: false,
    }
  }

  const hasBundle = Boolean(manifest?.dsh?.bundle)
  const hasClient = Boolean(manifest?.dsh?.client)
  const scripts = manifest?.scripts ?? {}
  const hasPrepare = INSTALL_SCRIPT_KEYS.some((k) => typeof scripts[k] === 'string' && scripts[k].trim() !== '')
  const workspaces = Array.isArray(manifest?.workspaces) && manifest.workspaces.length > 0

  // Spec: prefer the curated fragment-bearing spec, else plain github:<repo>.
  const spec = specFromInstallCmd(registryEntry?.installCmd) ?? `github:${fullName}`

  if (manifest === null || manifest === undefined) {
    notes.push('target package.json unreachable — spec derived from the catalog, manifest unverified')
  } else if (!hasBundle) {
    if (workspaces) {
      risks.push(
        'repo root has no dsh.bundle but declares workspaces — the bundle likely lives in a subpackage; the plain github: spec may install nothing (dsh warns, no layer). Verify the subpath and use github:<owner>/<repo>#path:/<sub>',
      )
    } else {
      risks.push(
        'repo root declares no dsh.bundle — it installs as a plain dependency and activates no config layer (dsh warns)',
      )
    }
  }
  if (hasPrepare) {
    risks.push(
      'repo defines install-time scripts (prepare/preinstall/…) — a git install will request pnpm build authorization, which RUNS THE REPO\'S CODE on this machine at install time. Only proceed if the source is trusted; prefer pinning a commit.',
    )
  }

  const command = `dsh plugin --profile <profile> add "${spec}"`

  return { kind, spec, command, installable: true, risks, notes, hasBundle, hasClient, hasPrepare }
}

// --- 2. Command building ---------------------------------------------------

export function detectProfile(argv = process.argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--profile') {
      const next = argv[i + 1]
      if (next && !next.startsWith('-')) return next
    } else if (a.startsWith('--profile=')) {
      const v = a.slice('--profile='.length)
      if (v) return v
    }
  }
  return 'web'
}

// Resolve how to invoke the dsh CLI from inside the running process.
export function resolveDshBin({ config = {}, env = process.env, argv = process.argv } = {}) {
  if (config.dshBin) return { command: config.dshBin, prefix: [] }
  if (env.DSH_PLUGIN_HUB_DSH_BIN) return { command: env.DSH_PLUGIN_HUB_DSH_BIN, prefix: [] }
  const entry = argv[1] ?? ''
  const base = entry.split('/').pop()
  if (base === 'dsh') return { command: entry, prefix: [] }
  if (entry.includes('@deepseek-ai/dsh/')) {
    // A JS entry inside the CLI package: run it with the current interpreter.
    return { command: process.execPath, prefix: [entry] }
  }
  return { command: 'dsh', prefix: [] }
}

export function buildInstallArgs({ spec, profile }) {
  return ['plugin', '--profile', profile, 'add', spec]
}

export function buildRemoveArgs({ pkg, profile }) {
  return ['plugin', '--profile', profile, 'remove', pkg]
}

// --- 3. Execution ----------------------------------------------------------

const MAX_OUTPUT = 64 * 1024

export function spawnCapture({ command, args, timeoutMs, signal, spawnImpl }) {
  if (spawnImpl) return spawnImpl({ command, args, timeoutMs, signal })
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false })
    } catch (e) {
      resolve({ ok: false, error: `failed to start ${command}: ${e?.message || e}` })
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    let killedByTimeout = false
    const timer = setTimeout(() => {
      killedByTimeout = true
      child.kill('SIGKILL')
    }, Math.max(1000, timeoutMs))
    const onAbort = () => child.kill('SIGKILL')
    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }
    child.stdout.on('data', (d) => {
      if (stdout.length < MAX_OUTPUT) stdout += String(d)
    })
    child.stderr.on('data', (d) => {
      if (stderr.length < MAX_OUTPUT) stderr += String(d)
    })
    child.on('error', (e) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ ok: false, error: String(e?.message || e) })
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve({
        ok: code === 0 && !killedByTimeout,
        code,
        timedOut: killedByTimeout,
        stdout: stdout.slice(-4000),
        stderr: stderr.slice(-4000),
      })
    })
  })
}

// --- Installer facade -------------------------------------------------------

export function createInstaller(config, { github, spawnImpl, findRegistry = findInRegistry, log } = {}) {
  const timeoutMs = Math.max(10000, Number(config.installTimeoutMs) || 300000)

  // Verification pass: registry knowledge + live manifest fetch (best effort).
  async function plan({ repo, profile, signal }) {
    const fullName = String(repo || '').trim().replace(/^github:\s*/, '')
    const registryEntry = findRegistry(fullName)
    let manifest
    let repoFound = true
    if (github) {
      try {
        manifest = await github.getPackageJson(fullName, signal)
      } catch {
        manifest = undefined // unreachable — analysis notes it
      }
      if (manifest === null) repoFound = false // 404 from the contents API
    }
    const analysis = analyzeInstall({ fullName, registryEntry, manifest })
    const command = analysis.command
      ? analysis.command.replace('<profile>', profile)
      : registryEntry
        ? `git clone ${registryEntry.url}.git`
        : `git clone https://github.com/${fullName}.git`
    // Trust tier from the same verification pass (best effort; failures
    // degrade to unverified rather than crash the plan).
    let tier
    let riskSignals = []
    try {
      const repo = await github.getRepo(fullName, signal)
      const computed = computeTier({ entry: registryEntry ?? {}, manifest, repo })
      tier = computed.tier
      riskSignals = computed.signals
    } catch {
      tier = 'unverified'
      riskSignals = ['live metadata unreachable during verification']
    }
    return {
      repo: fullName,
      profile,
      repoFound,
      ...analysis,
      notes: analysis.notes ?? [],
      command,
      tier,
      riskSignals,
    }
  }

  // Execution pass. `approval` (when provided by the composition) must have
  // already granted; this layer only runs and reports.
  async function run(planResult, { signal } = {}) {
    if (!planResult.installable) {
      return { status: 'not-installable', output: planResult.command, exitCode: null }
    }
    const { command, prefix } = resolveDshBin({ config })
    const args = [...prefix, ...buildInstallArgs({ spec: planResult.spec, profile: planResult.profile })]
    if (log) log.debug(`running: ${command} ${args.join(' ')}`)
    const result = await spawnCapture({ command, args, timeoutMs, signal, spawnImpl })
    if (result.ok) {
      return {
        status: 'installed',
        exitCode: result.code,
        output: `${result.stdout || ''}${result.stderr ? `\n${result.stderr}` : ''}`.trim().slice(-3000),
      }
    }
    const reason = result.timedOut
      ? `timed out after ${Math.round(timeoutMs / 1000)}s`
      : result.error || `exit code ${result.code}`
    const hint = /allowBuilds|ERR_PNPM_.*PREPARE|refuses to run/.test(String(result.stderr) + String(result.stdout))
      ? '\nHint: pnpm build authorization is required — add the printed package key to that profile\'s pnpm-workspace.yaml (allowBuilds), then retry.'
      : ''
    return {
      status: 'failed',
      exitCode: result.code ?? null,
      error: String(reason),
      output: `${result.stdout || ''}${result.stderr || ''}`.trim().slice(-3000) + hint,
    }
  }

  async function runCommand({ command, args, signal }) {
    return spawnCapture({ command, args, timeoutMs, signal, spawnImpl })
  }

  return {
    plan,
    run,
    runCommand,
    // Structural verification after a successful install: diff the profile's
    // dependency keys before/after, so we can report the actual installed
    // package name and whether its bundle layer landed. The new bundle only
    // loads after restart — this is the honest pre-restart check.
    profileSnapshot(profile) {
      try {
        const pkg = JSON.parse(readFileSync(profilePkgPath(profile), 'utf8'))
        return {
          deps: Object.keys(pkg?.dependencies ?? {}),
          bundles: pkg?.dsh?.profile?.bundles ?? [],
        }
      } catch {
        return null
      }
    },
  }
}

function profilePkgPath(profile) {
  const home = process.env.DSH_HOME || join(process.env.HOME || '', '.dsh')
  return join(home, 'profiles', profile, 'package.json')
}
