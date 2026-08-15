// Runtime registry auto-refresh: the embedded snapshot ships with the package
// and is frozen at install time; this module best-effort re-downloads the
// latest snapshot (published daily by the DSHwiki aggregation CI) so an
// installed plugin keeps serving fresh data without a re-install.
//
// Contract: every failure keeps the current registry untouched — the refresh
// must never take the plugin down or degrade it below its embedded baseline.

import { setRegistry, loadRegistry } from './registry.js'

const MAX_REGISTRY_BYTES = 5 * 1024 * 1024

// Validate a downloaded registry payload before trusting it. Mirrors the
// sync script's required fields; anything malformed is rejected wholesale.
function validateDownload(data) {
  if (data === null || typeof data !== 'object') return 'payload is not an object'
  if (!Array.isArray(data.plugins) || data.plugins.length === 0) return 'plugins missing or empty'
  if (typeof data.generatedAt !== 'string' || data.generatedAt.length === 0) return 'generatedAt missing'
  for (let i = 0; i < data.plugins.length; i++) {
    const p = data.plugins[i]
    if (typeof p.fullName !== 'string' || typeof p.url !== 'string') {
      return `plugins[${i}] missing fullName/url`
    }
    if (typeof p.stars !== 'number' || typeof p.category !== 'string') {
      return `plugins[${p.fullName}] missing stars/category`
    }
  }
  return null
}

// Fetch + validate one snapshot. Throws on any failure; never mutates state.
async function downloadRegistry(url, timeoutMs, signal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('registry refresh timed out')), timeoutMs)
  const onCallerAbort = () => controller.abort(signal.reason)
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer)
      throw new Error('registry refresh cancelled')
    }
    signal.addEventListener('abort', onCallerAbort, { once: true })
  }
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'dsh-plugin-hub (registry refresh)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const length = Number(res.headers.get('content-length') || 0)
    if (length > MAX_REGISTRY_BYTES) throw new Error(`payload too large (${length} bytes)`)
    const text = await res.text()
    if (text.length > MAX_REGISTRY_BYTES) throw new Error(`payload too large (${text.length} bytes)`)
    const data = JSON.parse(text)
    const problem = validateDownload(data)
    if (problem) throw new Error(`invalid snapshot: ${problem}`)
    return data
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onCallerAbort)
  }
}

// Create the refresher bound to config. Returns a single fire-and-forget
// `refresh(reason)` — callers own scheduling (see index.js). `log`, when
// given, is a { info, debug } facade; successes log info, skips log debug.
export function createRegistryRefresher(config, log) {
  const url = String(config.registryUrl || '')
  const timeoutMs = Math.max(1000, Number(config.refreshTimeoutMs) || 10000)

  async function refresh(reason = 'scheduled') {
    if (!url) return false
    try {
      const data = await downloadRegistry(url, timeoutMs)
      const before = loadRegistry()
      setRegistry(data)
      if (log) {
        log.info(
          `registry refreshed (${reason}): ${before.plugins.length} → ${data.plugins.length} plugins, snapshot ${data.generatedAt}`,
        )
      }
      return true
    } catch (e) {
      // Best-effort by design: keep the embedded/current snapshot silently.
      if (log) log.debug(`registry refresh skipped (${reason}): ${e?.message || e}`)
      return false
    }
  }

  return { refresh }
}
