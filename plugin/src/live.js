// Live GitHub search path. Mirrors the aggregation pipeline's search strategy
// (topic whitelist + relevance gate), but answers one tool call: no waiting out
// rate-limit resets — surface a clear, actionable error instead.

import { isRelevant, categorize, computeScore } from './categories.js'
import { findInRegistry, projectEntry } from './registry.js'

const TOPIC_CHAIN = ['dsh-plugin', 'dsh', 'deepseek-harness']
const USER_AGENT = 'dsh-plugin-hub (DeepSeek Harness plugin discovery)'

// Combine the caller's cancellation signal with a timeout, without holding a
// reference to either. AbortSignal.any is Node >= 20.3; older runtimes get a
// manual controller.
function withTimeout(signal, timeoutMs) {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)].filter(Boolean))
  }
  const controller = new AbortController()
  const abort = (reason) => controller.abort(reason)
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', () => abort(signal.reason), { once: true })
  }
  const timer = setTimeout(() => abort(new Error('live search timed out')), timeoutMs)
  return { signal: controller.signal, cancel: () => clearTimeout(timer) }
}

export class GitHubApiError extends Error {
  constructor(message, { status, rateLimited } = {}) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
    this.rateLimited = Boolean(rateLimited)
  }
}

// Create a client bound to the plugin config. All methods accept the tool
// execution signal and settle only after their owned work is done.
export function createGithubClient(config) {
  const baseUrl = String(config.apiBaseUrl || 'https://api.github.com').replace(/\/+$/, '')
  const timeoutMs = Math.max(1000, Number(config.liveTimeoutMs) || 15000)

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': USER_AGENT,
  }
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`

  async function fetchJson(path, signal) {
    const wrapped = withTimeout(signal, timeoutMs)
    const theSignal = wrapped.signal ?? wrapped
    let res
    try {
      res = await fetch(`${baseUrl}${path}`, { headers, signal: theSignal })
    } catch (e) {
      if (theSignal.aborted && String(theSignal.reason || e?.message || '').includes('timed out')) {
        throw new GitHubApiError(`GitHub request timed out after ${timeoutMs}ms (${path})`)
      }
      if (theSignal.aborted) throw e
      throw new GitHubApiError(`GitHub request failed: ${e?.message || e} (${path})`, {})
    } finally {
      if (wrapped.cancel) wrapped.cancel()
    }
    if (res.status === 403 || res.status === 429) {
      const remaining = res.headers.get('x-ratelimit-remaining')
      const rateLimited = remaining === '0'
      throw new GitHubApiError(
        rateLimited
          ? 'GitHub API rate limit exhausted. Set the githubToken config (or DSH_PLUGIN_HUB_TOKEN env var) to raise the limit, or use source: "registry".'
          : `GitHub API rejected the request (HTTP ${res.status}). A githubToken config may fix this.`,
        { status: res.status, rateLimited },
      )
    }
    if (res.status === 404) return null
    if (!res.ok) throw new GitHubApiError(`GitHub API HTTP ${res.status} (${path})`, { status: res.status })
    return res.json()
  }

  // Normalize a GitHub repo API item into a registry-shaped entry.
  // Trust-audit fields (archived/pushedAt/publishedAt/repoSizeKb) must be
  // preserved here — computeTier and the nightly audit read them.
  function normalize(item) {
    return {
      fullName: item.full_name,
      name: item.name,
      owner: item.owner?.login,
      description: item.description || '',
      descriptionOriginal: item.description || '',
      stars: item.stargazers_count || 0,
      forks: item.forks_count || 0,
      language: item.language || undefined,
      license: item.license?.spdx_id || undefined,
      topics: item.topics || [],
      updatedAt: item.updated_at,
      pushedAt: item.pushed_at || undefined,
      archived: Boolean(item.archived),
      publishedAt: item.created_at || undefined,
      repoSizeKb: typeof item.size === 'number' && item.size > 0 ? item.size : undefined,
      homepage: item.homepage || undefined,
      url: item.html_url,
      official: item.owner?.login === 'deepseek-ai',
      installType: 'plugin',
    }
  }

  // Live ecosystem search. Tries the topic whitelist in turn (most specific
  // first) and stops at the first topic that yields relevant hits, so a single
  // call usually costs one search request.
  async function searchPlugins({ query, limit = 8, signal }) {
    const keywords = String(query || '')
      .toLowerCase()
      .split(/[\s,，、/]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    const cap = Math.max(1, Math.min(20, Number(limit) || 8))

    let items = []
    let usedTopic = null
    for (const topic of TOPIC_CHAIN) {
      const q = [...keywords, `topic:${topic}`].join(' ')
      const data = await fetchJson(
        `/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`,
        signal,
      )
      const hits = Array.isArray(data?.items) ? data.items : []
      const relevant = hits.map(normalize).filter(isRelevant)
      if (relevant.length > 0) {
        items = relevant
        usedTopic = topic
        break
      }
    }

    // Merge curated registry info (zh description, vetted install command)
    // over live results when the repo is already known.
    const merged = items.map((entry) => {
      const known = findInRegistry(entry.fullName)
      if (!known) return entry
      return {
        ...entry,
        descriptionZh: known.descriptionZh,
        installCmd: known.installCmd,
        installType: known.installType,
        category: known.category,
        homepage: entry.homepage || known.homepage,
      }
    })

    const scored = merged
      .map((entry) => ({ entry, score: computeScore(entry) }))
      .sort((a, b) => b.score - a.score || (b.entry.stars || 0) - (a.entry.stars || 0))
      .slice(0, cap)

    const out = {
      source: 'live',
      total: merged.length,
      returned: scored.length,
      truncated: merged.length > scored.length,
      plugins: scored.map((s) => projectEntry(s.entry)),
    }
    if (usedTopic) out.note = `Live GitHub results via topic:${usedTopic}`
    return out
  }

  // Fetch one repository by 'owner/name'. Returns null when it does not exist.
  async function getRepo(fullName, signal) {
    const clean = String(fullName || '').trim().replace(/^github:\s*/, '')
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(clean)) return null
    const item = await fetchJson(`/repos/${clean}`, signal)
    if (item === null || typeof item.full_name !== 'string') return null
    return normalize(item)
  }

  // Fetch the repo root package.json for install verification.
  // Returns the parsed manifest, null on 404, undefined when unreadable.
  async function getPackageJson(fullName, signal) {
    const clean = String(fullName || '').trim().replace(/^github:\s*/, '')
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(clean)) return null
    let data
    try {
      data = await fetchJson(`/repos/${clean}/contents/package.json`, signal)
    } catch (e) {
      if (e instanceof GitHubApiError && e.rateLimited) throw e
      return undefined // transient — caller treats as unverified
    }
    if (data === null || data.encoding !== 'base64' || typeof data.content !== 'string') return null
    try {
      const parsed = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'))
      return parsed !== null && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }

  return { searchPlugins, getRepo, getPackageJson }
}
