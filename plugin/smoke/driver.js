// Smoke driver: mounts after the tools registry, waits for dsh-plugin-hub's
// tools, then drives real executions through the full tool pipeline and prints
// the model-facing content. Mirrors the official cordis-tutorial chapter 7
// pattern (ctx.tools.execute + CallId).

import { CallId } from '@deepseek-ai/dsh-llm'

export const name = 'dsh-plugin-hub-smoke-driver'
export const inject = ['tools']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForTool(ctx, toolName, tries = 100) {
  for (let i = 0; i < tries; i++) {
    if (ctx.tools.get(toolName) !== undefined) return
    await sleep(50)
  }
  throw new Error(`tool ${toolName} never registered`)
}

function run(ctx, callId, name, args) {
  return ctx.tools.execute({
    callId: CallId(callId),
    name,
    arguments: args,
    signal: new AbortController().signal,
  })
}

function text(result) {
  return result.content
    .map((b) => (b.type === 'text' ? b.text : `<${b.type}>`))
    .join('')
}

export function apply(ctx) {
  void (async () => {
    const failures = []
    try {
      await waitForTool(ctx, 'plugin_search')
      await waitForTool(ctx, 'plugin_info')

      // 1) registry-backed search (offline path — must pass)
      const search = await run(ctx, 'smoke-search-1', 'plugin_search', { query: 'skin', limit: 3 })
      console.log('=== plugin_search {query: "skin", limit: 3} ===')
      console.log(text(search))
      if (search.isError) failures.push('registry plugin_search failed')

      // 2) category browse + zh matching
      const zh = await run(ctx, 'smoke-search-2', 'plugin_search', { query: '通知', limit: 2 })
      console.log('\n=== plugin_search {query: "通知"} ===')
      console.log(text(zh))
      if (zh.isError) failures.push('zh query plugin_search failed')

      // 3) plugin_info from the embedded registry (offline — must pass)
      const info = await run(ctx, 'smoke-info-1', 'plugin_info', { repo: 'deepseek-ai/deepseek-harness' })
      console.log('\n=== plugin_info {repo: "deepseek-ai/deepseek-harness"} ===')
      console.log(text(info))
      if (info.isError) failures.push('registry plugin_info failed')

      // 4) live GitHub search (best-effort: network/rate limits may block)
      try {
        const live = await run(ctx, 'smoke-live-1', 'plugin_search', { query: 'terminal', limit: 3, source: 'live' })
        console.log('\n=== plugin_search {query: "terminal", source: "live"} ===')
        console.log(text(live))
        if (live.isError) failures.push('live plugin_search failed')
      } catch (e) {
        console.log(`\n(live search skipped: ${e.message})`)
      }

      // 5) plugin_install dryRun — full verification pass, no execution.
      // Our own repo: the bundle lives in a subdirectory, so verification must
      // flag the no-bundle-at-root risk instead of blind-recommending.
      try {
        const plan = await run(ctx, 'smoke-install-1', 'plugin_install', { repo: 'qomob/DSHwiki', dryRun: true })
        console.log('\n=== plugin_install {repo: "qomob/DSHwiki", dryRun: true} (monorepo case) ===')
        console.log(text(plan))
        if (plan.isError) failures.push('plugin_install dryRun (monorepo) failed')
        if (!/no dsh\.bundle|subpackage/.test(text(plan))) failures.push('monorepo risk not flagged')
      } catch (e) {
        console.log(`\n(plugin_install monorepo dryRun skipped: ${e.message})`)
        failures.push('plugin_install dryRun threw')
      }

      // 6) plugin_install dryRun on a registry-known repo: spec + live manifest.
      try {
        const plan = await run(ctx, 'smoke-install-2', 'plugin_install', { repo: 'NanmiCoder/dsh-agent-teams', dryRun: true })
        console.log('\n=== plugin_install {repo: "NanmiCoder/dsh-agent-teams", dryRun: true} ===')
        console.log(text(plan))
        if (plan.isError) failures.push('plugin_install dryRun (known repo) failed')
        if (!/dsh plugin --profile web add "github:NanmiCoder\/dsh-agent-teams"/.test(text(plan))) {
          failures.push('known-repo plan lost the exact install command')
        }
      } catch (e) {
        console.log(`\n(plugin_install known-repo dryRun skipped: ${e.message})`)
        failures.push('plugin_install known-repo dryRun threw')
      }
    } catch (e) {
      failures.push(`driver error: ${e?.stack || e}`)
    }

    console.log(`\nSMOKE ${failures.length === 0 ? 'PASSED' : 'FAILED'}${failures.length ? `: ${failures.join('; ')}` : ''}`)
    process.exit(failures.length === 0 ? 0 : 1)
  })()
}
