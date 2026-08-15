// dsh-plugin-hub — discover DeepSeek Harness (dsh) community plugins from
// inside dsh.
//
// Ships two model-facing tools:
//   plugin_search — keyword/category search over an embedded curated registry
//                   snapshot, with optional live GitHub ecosystem fallback.
//   plugin_info   — details + install command for one plugin repository.
//
// The embedded snapshot is generated from the DSHwiki aggregation pipeline
// (https://dsh.qomob.ai) and refreshed by `npm run sync-registry`.
//
// Loaded as a plain ESM module — no build step, so git installs need no
// pnpm build authorization.

import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { CATEGORIES, getCategory, isRelevant } from './src/categories.js'
import { loadRegistry, searchRegistry, findInRegistry, projectEntry } from './src/registry.js'
import { createGithubClient } from './src/live.js'
import { createRegistryRefresher } from './src/refresh.js'
import { createInstaller, analyzeInstall, detectProfile, buildRemoveArgs, resolveDshBin } from './src/install.js'
import { computeTier, isInstallAllowed, TIER_META } from './src/trust.js'
import {
  formatSearchOutput,
  searchMetaFromValue,
  presentSearchResult,
  formatInfoOutput,
  formatInstallOutput,
} from './src/format.js'

export const name = 'dsh-plugin-hub'

// Hard dependency: the tool registry (provided by @deepseek-ai/dsh-tools,
// which every dsh profile mounts via @deepseek-ai/dsh-base). The plugin stays
// PENDING until the registry is available.
export const inject = ['tools']

const CATEGORY_IDS = CATEGORIES.map((c) => c.id)

// Best-effort English keyword per category, used when a live fallback runs
// with a category filter but no free-text query.
const CATEGORY_KEYWORDS = {
  core: 'deepseek-harness',
  orchestration: 'agent',
  interface: 'ui',
  terminal: 'tui',
  skin: 'skin',
  vision: 'vision',
  memory: 'memory',
  workflow: 'workflow',
  communication: 'notification',
  engineering: 'engineering',
  toolset: 'tool',
  skill: 'skill',
  awesome: 'awesome',
  extension: 'plugin',
  other: '',
}

// Configurable knobs — every value a deployment might differ on is a config
// field (never a hardcoded constant), validated at load time.
export const Config = Schema.object({
  githubToken: Schema.string()
    .default('')
    .description('GitHub API token to raise rate limits (optional; falls back to DSH_PLUGIN_HUB_TOKEN).'),
  apiBaseUrl: Schema.string()
    .default('https://api.github.com')
    .description('GitHub API base URL — point at a proxy mirror if api.github.com is unreachable.'),
  maxResults: Schema.number()
    .default(8)
    .min(1)
    .max(20)
    .description('Default number of plugins returned by plugin_search.'),
  liveTimeoutMs: Schema.number()
    .default(15000)
    .description('Timeout budget (ms) for live GitHub API requests.'),
  systemPromptGuidance: Schema.boolean()
    .default(true)
    .description('Contribute a short system-prompt section guiding the model to use plugin_search.'),
  autoRefresh: Schema.boolean()
    .default(true)
    .description(
      'Best-effort daily download of the latest registry snapshot (published by the DSHwiki CI); keeps the embedded catalog fresh without a re-install. Failures silently keep the current snapshot.',
    ),
  registryUrl: Schema.string()
    .default('https://raw.githubusercontent.com/qomob/dsh/main/plugin/data/registry.json')
    .description(
      'Where to download refreshed snapshots from. Point at a mirror (e.g. cdn.jsdelivr.net/gh/qomob/dsh@main/plugin/data/registry.json) when raw.githubusercontent.com is unreachable.',
    ),
  refreshIntervalHours: Schema.number()
    .default(24)
    .min(1)
    .max(720)
    .description('Hours between registry refresh attempts.'),
  refreshTimeoutMs: Schema.number()
    .default(10000)
    .description('Timeout budget (ms) for each registry refresh download.'),
  installEnabled: Schema.boolean()
    .default(true)
    .description('Register the plugin_install tool (an agent-executable installer that shells out to the dsh CLI behind the approval gate).'),
  dshBin: Schema.string()
    .default('')
    .description('Explicit path to the dsh CLI used by plugin_install. Empty = auto-detect (DSH_PLUGIN_HUB_DSH_BIN env, running process, then PATH).'),
  installTimeoutMs: Schema.number()
    .default(300000)
    .description('Timeout budget (ms) for one plugin_install execution (pnpm installs can be slow).'),
  trustPolicy: Schema.union(['ask', 'verified-only'])
    .default('ask')
    .description(
      "Install trust gate for unverified plugins. 'ask' (default) shows the tier and risks but lets the approval gate decide; 'verified-only' refuses installs of non-verified tiers outright.",
    ),
})

const entryOutputProperties = {
  fullName: { type: 'string', required: true },
  description: { type: 'string', required: true },
  descriptionZh: { type: 'string' },
  stars: { type: 'integer', required: true },
  updatedAt: { type: 'string' },
  url: { type: 'string', required: true },
  category: { type: 'string', required: true },
  categoryLabel: { type: 'string', required: true },
  official: { type: 'boolean', required: true },
  topics: { type: 'array', items: { type: 'string' } },
  installCmd: { type: 'string', required: true },
  homepage: { type: 'string' },
  language: { type: 'string' },
  license: { type: 'string' },
  tier: { type: 'string' },
  auditAt: { type: 'string' },
  riskSignals: { type: 'array', items: { type: 'string' } },
}

const entryOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: entryOutputProperties,
}

function clampLimit(value, fallback) {
  const n = Number.isFinite(value) ? value : fallback
  return Math.max(1, Math.min(20, Math.round(n)))
}

function friendlyLiveError(e) {
  return `live GitHub search unavailable: ${e?.message || String(e)}`
}

const installAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', required: true },
    spec: { type: 'string' },
    command: { type: 'string', required: true },
    installable: { type: 'boolean', required: true },
    hasBundle: { type: 'boolean', required: true },
    hasClient: { type: 'boolean', required: true },
    hasPrepare: { type: 'boolean', required: true },
    risks: { type: 'array', required: true, items: { type: 'string' } },
    notes: { type: 'array', required: true, items: { type: 'string' } },
  },
}

const installNextSteps = (profile) => [
  `restart dsh (or relaunch the profile) so the new bundle mounts: dsh --profile ${profile}`,
  `verify the layer: dsh --profile ${profile} --dump-config`,
]

export function apply(ctx, config) {
  const github = createGithubClient({
    ...config,
    githubToken: config.githubToken || process.env.DSH_PLUGIN_HUB_TOKEN || '',
  })
  // Warm the embedded snapshot eagerly; a missing file degrades to an empty
  // registry (live search keeps working) instead of failing the plugin.
  loadRegistry()

  // Install verification shared by plugin_info (reporting) and plugin_install
  // (execution): registry knowledge + best-effort live manifest fetch.
  async function verifyInstall(fullName, registryEntry, signal) {
    let manifest
    try {
      manifest = await github.getPackageJson(fullName, signal)
    } catch {
      manifest = undefined
    }
    const analysis = analyzeInstall({ fullName, registryEntry, manifest })
    let tier
    let riskSignals
    try {
      const repo = await github.getRepo(fullName, signal)
      const computed = computeTier({ entry: registryEntry ?? {}, manifest, repo })
      tier = computed.tier
      riskSignals = computed.signals
    } catch {
      tier = 'unverified'
      riskSignals = ['live metadata unreachable']
    }
    return { ...analysis, tier, riskSignals }
  }

  const installer = createInstaller(config, { github })

  // Runtime registry auto-refresh: one attempt at startup, then once per
  // refreshIntervalHours. Best-effort — any failure keeps the current
  // snapshot. The timer is unref'd so short-lived sessions never linger.
  if (config.autoRefresh) {
    const log = ctx.logger ? ctx.logger('dsh-plugin-hub') : undefined
    const refresher = createRegistryRefresher(config, log ? { info: (m) => log.info(m), debug: (m) => log.debug(m) } : undefined)
    ctx.effect(() => {
      let stopped = false
      void refresher.refresh('startup')
      const timer = setInterval(() => {
        if (!stopped) void refresher.refresh('scheduled')
      }, Math.max(1, config.refreshIntervalHours) * 3600 * 1000)
      if (typeof timer.unref === 'function') timer.unref()
      return () => {
        stopped = true
        clearInterval(timer)
      }
    })
  }

  ctx.tools.register(
    defineTool({
      name: 'plugin_search',
      description:
        'Search the DeepSeek Harness (dsh) community plugin ecosystem. Returns matching plugins with description, stars, category, repository URL, and an install command. Uses an embedded curated registry snapshot by default; set source to "live" for a fresh GitHub search.',
      parameters: {
        query: {
          type: 'string',
          description:
            'Free-text keywords, matched against plugin name, description (English and Chinese), and topics. May be omitted when browsing by category.',
        },
        category: {
          type: 'string',
          enum: [...CATEGORY_IDS, 'all'],
          description: `Filter by category: ${CATEGORY_IDS.join(', ')}, or all.`,
        },
        sort: {
          type: 'string',
          enum: ['relevance', 'stars', 'updated'],
          description: 'Result ordering (default: relevance).',
        },
        limit: {
          type: 'integer',
          description: 'Max plugins to return, 1–20 (default from plugin config).',
        },
        source: {
          type: 'string',
          enum: ['registry', 'live', 'auto'],
          description:
            '"registry" answers offline from the embedded snapshot; "live" queries GitHub; "auto" (default) uses the registry and falls back to live GitHub only when it has no match.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: 'string' },
            category: { type: 'string' },
            categoryLabel: { type: 'string' },
            source: { type: 'string', required: true },
            total: { type: 'integer', required: true },
            returned: { type: 'integer', required: true },
            truncated: { type: 'boolean', required: true },
            snapshotAt: { type: 'string' },
            note: { type: 'string' },
            plugins: { type: 'array', required: true, items: entryOutputSchema },
          },
        },
        render: (_args, value) => [{ type: 'text', text: formatSearchOutput(value) }],
        presentationMeta: (_args, value) => searchMetaFromValue(value),
      },
      timeoutMs: Math.max(20000, (config.liveTimeoutMs || 15000) + 5000),
      isConcurrencySafe: () => true,
      presentCall: (args) => ({
        card: 'generic',
        title: `plugin_search: ${args.query || args.category || 'all'}`,
        kind: 'search',
        rawInput: args.query || args.category || '',
      }),
      presentResult: (args, result) => presentSearchResult(args, result),
      async execute(args, exec) {
        const limit = clampLimit(args.limit, config.maxResults)
        const query = (args.query || '').trim()
        const category = args.category && args.category !== 'all' ? args.category : undefined
        const sort = args.sort || 'relevance'
        const source = args.source || 'auto'

        const base = {}
        if (query) base.query = query
        if (category) base.category = category

        if (source === 'live') {
          return decorate(
            { ...base },
            await github.searchPlugins({ query, limit, signal: exec.signal }),
          )
        }

        const registryResult = searchRegistry({ query, category, sort, limit })
        const labeled = { ...registryResult, ...base }
        if (category) labeled.categoryLabel = getCategory(category).label

        if (source === 'registry' || registryResult.total > 0 || (!query && !category)) {
          return labeled
        }

        // auto + no registry hit → one live attempt, best effort.
        try {
          const liveKeywords = query || CATEGORY_KEYWORDS[category] || ''
          const live = await github.searchPlugins({ query: liveKeywords, limit, signal: exec.signal })
          if (live.total > 0) return decorate({ ...base }, live)
          return { ...labeled, note: 'No match in the embedded registry or on live GitHub.' }
        } catch (e) {
          return { ...labeled, note: friendlyLiveError(e) }
        }
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'plugin_info',
      description:
        'Get details for one dsh community plugin: description, stars, topics, category, repository URL, and its install command. Accepts "owner/name". Answers from the embedded registry; pass live: true to fetch fresh GitHub data (or when the repo is not in the registry).',
      parameters: {
        repo: {
          type: 'string',
          required: true,
          description: 'Repository full name, e.g. "NanmiCoder/dsh-agent-teams".',
        },
        live: {
          type: 'boolean',
          description: 'Fetch fresh data from the GitHub API instead of the embedded snapshot.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            repo: { type: 'string', required: true },
            found: { type: 'boolean', required: true },
            source: { type: 'string', required: true },
            snapshotAt: { type: 'string' },
            note: { type: 'string' },
            plugin: entryOutputSchema,
            install: installAnalysisSchema,
          },
        },
        render: (_args, value) => [{ type: 'text', text: formatInfoOutput(value) }],
      },
      timeoutMs: Math.max(20000, (config.liveTimeoutMs || 15000) + 5000),
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const repo = String(args.repo || '').trim()
        const known = findInRegistry(repo)
        const snapshotAt = loadRegistry().generatedAt

        if (args.live) {
          try {
            const item = await github.getRepo(repo, exec.signal)
            if (item !== null) {
              const install = await verifyInstall(item.fullName, known, exec.signal)
              if (isRelevant(item)) {
                const merged = known
                  ? { ...item, descriptionZh: known.descriptionZh, installCmd: known.installCmd, installType: known.installType, category: known.category, homepage: item.homepage || known.homepage }
                  : item
                return {
                  repo: item.fullName,
                  found: true,
                  source: 'live',
                  plugin: projectEntry(merged),
                  install,
                }
              }
              return {
                repo: item.fullName,
                found: true,
                source: 'live',
                plugin: projectEntry(item),
                install,
                note: 'Repository exists on GitHub but does not look like part of the dsh ecosystem.',
              }
            }
            if (known) {
              return {
                repo: known.fullName,
                found: true,
                source: 'registry',
                snapshotAt,
                plugin: projectEntry(known),
                note: 'Live GitHub lookup returned 404; showing the embedded registry entry.',
              }
            }
            return { repo, found: false, source: 'live' }
          } catch (e) {
            if (known) {
              return {
                repo: known.fullName,
                found: true,
                source: 'registry',
                snapshotAt,
                plugin: projectEntry(known),
                note: friendlyLiveError(e),
              }
            }
            throw e
          }
        }

        if (known) {
          return {
            repo: known.fullName,
            found: true,
            source: 'registry',
            snapshotAt,
            plugin: projectEntry(known),
          }
        }

        // Not in the snapshot → try live before answering "not found".
        try {
          const item = await github.getRepo(repo, exec.signal)
          if (item === null) return { repo, found: false, source: 'live' }
          return {
            repo: item.fullName,
            found: true,
            source: 'live',
            plugin: projectEntry(item),
            install: await verifyInstall(item.fullName, undefined, exec.signal),
          }
        } catch (e) {
          return { repo, found: false, source: 'registry', note: friendlyLiveError(e) }
        }
      },
    }),
  )

  // Agent-executable installer: verify the target's manifest, then run
  // `dsh plugin --profile <name> add <spec>` behind the approval gate.
  if (config.installEnabled) {
    ctx.tools.register(
      defineTool({
        name: 'plugin_install',
        description:
          'Install a dsh community plugin bundle into a profile. Verifies the target repository (dsh.bundle manifest, install-time scripts, monorepo subpath) to produce the real install command and its risks, then — after user approval — runs it. Use plugin_search first, confirm the choice with the user, then call this. Pass dryRun: true to preview the exact command and risks without executing.',
        parameters: {
          repo: {
            type: 'string',
            required: true,
            description: 'Target repository full name, e.g. "NanmiCoder/dsh-agent-teams".',
          },
          profile: {
            type: 'string',
            description: 'Target profile name (default: the profile this dsh process is running).',
          },
          dryRun: {
            type: 'boolean',
            description: 'Only verify and return the exact command + risks; do not execute.',
          },
          confirm: {
            type: 'boolean',
            description:
              'Explicit user confirmation, required to execute when the approval service is unavailable (e.g. headless). Always ask the user first.',
          },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              repo: { type: 'string', required: true },
              profile: { type: 'string', required: true },
              status: { type: 'string', required: true },
              repoFound: { type: 'boolean', required: true },
              kind: { type: 'string', required: true },
              spec: { type: 'string' },
              command: { type: 'string', required: true },
              installable: { type: 'boolean', required: true },
              hasBundle: { type: 'boolean', required: true },
              hasClient: { type: 'boolean', required: true },
              hasPrepare: { type: 'boolean', required: true },
              risks: { type: 'array', required: true, items: { type: 'string' } },
              notes: { type: 'array', required: true, items: { type: 'string' } },
              exitCode: { type: 'integer' },
              error: { type: 'string' },
              output: { type: 'string' },
              tier: { type: 'string' },
              riskSignals: { type: 'array', items: { type: 'string' } },
              installedAs: { type: 'string' },
              inBundles: { type: 'boolean' },
              nextSteps: { type: 'array', required: true, items: { type: 'string' } },
            },
          },
          render: (_args, value) => [{ type: 'text', text: formatInstallOutput(value) }],
        },
        timeoutMs: Math.max(config.installTimeoutMs || 300000, 120000),
        isConcurrencySafe: () => false,
        presentCall: (args) => ({
          card: 'generic',
          title: `plugin_install: ${args.repo || ''}${args.profile ? ` → ${args.profile}` : ''}`,
          kind: 'execute',
          rawInput: args.repo || '',
        }),
        async execute(args, exec) {
          const profile = (args.profile || '').trim() || detectProfile()
          const planResult = await installer.plan({ repo: args.repo, profile, signal: exec.signal })

          if (args.dryRun) {
            return {
              ...planResult,
              notes: planResult.notes,
              status: 'plan',
              nextSteps: [`run it: ${planResult.command}`],
            }
          }

          if (!planResult.repoFound) {
            return {
              ...planResult,
              status: 'not-found',
              nextSteps: ['check the repository name with plugin_info first'],
            }
          }
          if (!planResult.installable) {
            return {
              ...planResult,
              status: 'not-installable',
              nextSteps: [planResult.command],
            }
          }

          // Trust gate: verified-only policy refuses non-verified installs.
          if (config.trustPolicy === 'verified-only' && planResult.tier !== 'verified') {
            return {
              ...planResult,
              status: 'blocked-by-trust-policy',
              nextSteps: [
                `policy is verified-only and this plugin's tier is ${planResult.tier}${planResult.riskSignals?.length ? ' (' + planResult.riskSignals.join('; ') + ')' : ''}`,
                're-run with trustPolicy: "ask" in the profile config, or install manually',
              ],
            }
          }

          // Approval gate: the composition's approval service when present
          // (interactive prompt in the Web UI); an explicit confirm otherwise.
          const approval = ctx.get('approval')
          if (approval !== undefined && exec.agent !== undefined) {
            let outcome
            try {
              outcome = await approval.request({
                agent: exec.agent,
                toolName: 'plugin_install',
                callId: exec.callId,
                reason: `Install ${planResult.spec} into profile "${profile}"${planResult.hasPrepare ? ' — the repo runs install-time scripts, grant only if trusted' : ''}`,
                signal: exec.signal,
              })
            } catch {
              outcome = undefined // no open turn / audit failure → confirm path
            }
            if (outcome !== 'allowed-once') {
              return {
                ...planResult,
                status: outcome === undefined ? 'needs-confirmation' : `approval-${outcome}`,
                nextSteps: [`ask the user, then retry with confirm: true or run: ${planResult.command}`],
              }
            }
          } else if (args.confirm !== true) {
            return {
              ...planResult,
              status: 'needs-confirmation',
              nextSteps: [
                'confirm with the user, then retry with confirm: true',
                `or run it directly: ${planResult.command}`,
              ],
            }
          }

          const result = await installer.run(planResult, { signal: exec.signal })
          if (result.status !== 'installed') {
            return {
              ...planResult,
              ...result,
              nextSteps: [`retry after fixing the error, or run manually: ${planResult.command}`],
            }
          }

          // Structural verification: diff the profile's dependency keys before
          // vs after, so we report the ACTUAL installed package name and
          // whether its bundle layer landed. The fiber itself only appears
          // after restart — the "Plugins" tab / settings show it then.
          const before = installer.profileSnapshot(profile)
          const after = installer.profileSnapshot(profile)
          const installedAs = after
            ? (after.deps || []).find((d) => !(before?.deps || []).includes(d))
            : undefined
          const inBundles = after?.bundles?.includes(installedAs) ?? false
          return {
            ...planResult,
            status: 'installed',
            exitCode: result.exitCode,
            output: result.output,
            installedAs,
            inBundles,
            nextSteps: [
              ...installNextSteps(profile),
              ...(inBundles ? [] : ['the package installed but its bundle layer may not be active — check with: dsh --profile ' + profile + ' --dump-config']),
            ],
          }
        },
      }),
    )
  }

  // Agent-executable uninstaller, symmetric to plugin_install.
  if (config.installEnabled) {
    ctx.tools.register(
      defineTool({
        name: 'plugin_remove',
        description:
          'Remove a dsh plugin bundle from a profile. Confirm the package name with the user (the "Plugins" tab installed list or Settings → Plugins shows it), then — after approval — runs `dsh plugin --profile <name> remove <pkg>`. Pass dryRun: true to preview without executing.',
        parameters: {
          pkg: {
            type: 'string',
            required: true,
            description: 'Package name as installed, e.g. "dsh-plugin-hub".',
          },
          profile: {
            type: 'string',
            description: 'Target profile name (default: the profile this dsh process is running).',
          },
          dryRun: {
            type: 'boolean',
            description: 'Only verify and return the exact command; do not execute.',
          },
          confirm: {
            type: 'boolean',
            description:
              'Explicit user confirmation, required to execute when the approval service is unavailable (e.g. headless). Always ask the user first.',
          },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              pkg: { type: 'string', required: true },
              profile: { type: 'string', required: true },
              status: { type: 'string', required: true },
              command: { type: 'string', required: true },
              exitCode: { type: 'integer' },
              error: { type: 'string' },
              output: { type: 'string' },
              removedFromBundles: { type: 'boolean' },
              nextSteps: { type: 'array', required: true, items: { type: 'string' } },
            },
          },
          render: (_args, value) => [
            {
              type: 'text',
              text: [
                `plugin_remove ${value.pkg} → profile "${value.profile}": ${value.status}`,
                value.command ? `Command: \`${value.command}\`` : '',
                value.error ? `Error: ${value.error}` : '',
                value.output ? `\`\`\`\n${String(value.output).trim()}\n\`\`\`` : '',
                '',
                'Next:',
                ...value.nextSteps.map((s) => `- ${s}`),
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        },
        timeoutMs: Math.max(config.installTimeoutMs || 300000, 120000),
        isConcurrencySafe: () => false,
        presentCall: (args) => ({
          card: 'generic',
          title: `plugin_remove: ${args.pkg || ''}${args.profile ? ` → ${args.profile}` : ''}`,
          kind: 'execute',
          rawInput: args.pkg || '',
        }),
        async execute(args, exec) {
          const profile = (args.profile || '').trim() || detectProfile()
          const pkg = String(args.pkg || '').trim()
          if (!pkg) return { pkg: '', profile, status: 'bad-request', command: '', nextSteps: ['provide the package name'] }

          const { command: bin, prefix } = resolveDshBin({ config })
          const command = `${bin} ${[...prefix, ...buildRemoveArgs({ pkg, profile })].join(' ')}`

          if (args.dryRun) {
            return { pkg, profile, status: 'plan', command, nextSteps: [`run it: ${command}`] }
          }

          // Approval gate, same semantics as plugin_install.
          const approval = ctx.get('approval')
          if (approval !== undefined && exec.agent !== undefined) {
            let outcome
            try {
              outcome = await approval.request({
                agent: exec.agent,
                toolName: 'plugin_remove',
                callId: exec.callId,
                reason: `Remove ${pkg} from profile "${profile}"`,
                signal: exec.signal,
              })
            } catch {
              outcome = undefined
            }
            if (outcome !== 'allowed-once') {
              return {
                pkg,
                profile,
                status: outcome === undefined ? 'needs-confirmation' : `approval-${outcome}`,
                command,
                nextSteps: [`ask the user, then retry with confirm: true or run: ${command}`],
              }
            }
          } else if (args.confirm !== true) {
            return {
              pkg,
              profile,
              status: 'needs-confirmation',
              command,
              nextSteps: [`confirm with the user, then retry with confirm: true or run: ${command}`],
            }
          }

          const before = installer.profileSnapshot(profile)
          const result = await installer.runCommand({ command: bin, args: [...prefix, ...buildRemoveArgs({ pkg, profile })], signal: exec.signal })
          const after = installer.profileSnapshot(profile)
          const removedFromBundles = after !== null && before !== null && before.bundles.includes(pkg) && !after.bundles.includes(pkg)
          if (!result.ok) {
            return {
              pkg,
              profile,
              status: 'failed',
              command,
              exitCode: result.code ?? null,
              error: result.timedOut ? 'timed out' : result.error || `exit code ${result.code}`,
              output: `${result.stdout || ''}${result.stderr || ''}`.trim().slice(-3000),
              removedFromBundles,
              nextSteps: [`retry after fixing the error, or run manually: ${command}`],
            }
          }
          return {
            pkg,
            profile,
            status: 'removed',
            command,
            exitCode: result.code,
            output: `${result.stdout || ''}${result.stderr ? `\n${result.stderr}` : ''}`.trim().slice(-3000),
            removedFromBundles,
            nextSteps: [
              `restart dsh (or relaunch the profile) so the bundle layer unmounts: dsh --profile ${profile}`,
              ...(removedFromBundles ? [] : ['the bundle may still be listed — verify with: dsh --profile ' + profile + ' --dump-config']),
            ],
          }
        },
      }),
    )
  }

  // Optional system-prompt guidance. Mounted as a child plugin with
  // inject: ['systemPrompt'], so it stays PENDING in compositions without the
  // service and mounts automatically wherever it appears — no ctx.get probing.
  if (config.systemPromptGuidance) {
    ctx.plugin({
      name: 'dsh-plugin-hub-guidance',
      inject: ['systemPrompt'],
      apply(guidanceCtx) {
        guidanceCtx.effect(() =>
          guidanceCtx.systemPrompt.section({
            name: 'tool:plugin_search',
            order: 112,
            text: 'Use the plugin_search tool to discover DeepSeek Harness (dsh) community plugins (skins/themes, tools, agent orchestration, UI extensions, skills) and plugin_info for one plugin\'s details including install verification. To actually install, confirm the choice with the user, then call plugin_install (dryRun first when unsure); it verifies the target manifest, surfaces install risks, and runs behind user approval. Only run installs with the user\'s confirmation, and prefer the "github:<owner>/<repo>" form.',
          }),
        )
      },
    })
  }
}

// Stamp the caller's filter fields onto a search result so the value echoes
// what was asked (query/category/categoryLabel), keeping schema shape.
function decorate(base, result) {
  const out = { ...base, ...result }
  if (base.category) out.categoryLabel = getCategory(base.category).label
  return out
}
