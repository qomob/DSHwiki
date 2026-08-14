// GitHub Search / Repos API 封装
import { RATE_LIMIT_DELAY_MS } from './config.mjs'

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ''

const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function ghFetch(url, attempt = 0) {
  const res = await fetch(url, { headers: HEADERS })
  if (res.status === 403 || res.status === 429) {
    const remain = res.headers.get('x-ratelimit-remaining')
    const reset = res.headers.get('x-ratelimit-reset')
    const MAX_RETRIES = 3
    // 仅在 remaining=0、reset 合法且未超重试上限时才等待重试
    const resetValid = reset && Number(reset) > 0 && Number.isFinite(Number(reset))
    if (remain === '0' && resetValid && attempt < MAX_RETRIES) {
      const wait = Math.max(0, Number(reset) * 1000 - Date.now()) + 1000
      console.warn(`GitHub 限流，等待 ${Math.round(wait / 1000)}s 至重置 (重试 ${attempt + 1}/${MAX_RETRIES})…`)
      await sleep(Math.min(wait, 1000 * 60 * 15))
      return ghFetch(url, attempt + 1)
    }
    const reason = !resetValid ? 'reset 头缺失或非法' : `已达最大重试 (${MAX_RETRIES})`
    throw new Error(`GitHub 限流 (remaining=${remain}, ${reason})`)
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${url}`)
  return res.json()
}

export async function searchRepos(query, perPage = 50) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`
  const data = await ghFetch(url)
  await sleep(RATE_LIMIT_DELAY_MS)
  return data.items || []
}

export async function getRepo(owner, repo) {
  try {
    return await ghFetch(`https://api.github.com/repos/${owner}/${repo}`)
  } catch (e) {
    // 限流耗尽：抛专门错误，让上层短路跳过剩余请求
    if (/限流/.test(e.message)) throw new RateLimitError(e.message)
    console.warn(`获取仓库失败 ${owner}/${repo}: ${e.message}`)
    return null
  }
}

// awesome 补全专用：限流时等待 reset 后重试,而不是短路放弃
// 只有 reset 头缺失/非法(无法计算等待)才停止——避免一次抖动丢掉全部 awesome
export async function getRepoNoRetry(owner, repo) {
  try {
    return await ghFetchNoRetry(`https://api.github.com/repos/${owner}/${repo}`)
  } catch (e) {
    if (/限流/.test(e.message)) throw new RateLimitError(e.message)
    console.warn(`获取仓库失败 ${owner}/${repo}: ${e.message}`)
    return null
  }
}

async function ghFetchNoRetry(url, attempt = 0) {
  const res = await fetch(url, { headers: HEADERS })
  if (res.status === 403 || res.status === 429) {
    const remain = res.headers.get('x-ratelimit-remaining')
    const reset = res.headers.get('x-ratelimit-reset')
    const resetValid = reset && Number(reset) > 0 && Number.isFinite(Number(reset))
    // 配额真的耗尽(reset 有效):等待至重置后重试(最多 2 次)
    if (remain === '0' && resetValid && attempt < 2) {
      const wait = Math.max(0, Number(reset) * 1000 - Date.now()) + 1000
      console.warn(`GitHub 限流等待 ${Math.round(wait / 1000)}s (awesome 补全, 重试 ${attempt + 1}/2)…`)
      await sleep(Math.min(wait, 1000 * 60 * 10))
      return ghFetchNoRetry(url, attempt + 1)
    }
    // reset 非法或已达重试上限:停止(不影响已补全的)
    const reason = !resetValid ? 'reset 头缺失/非法' : '已达重试上限'
    throw new Error(`GitHub 限流 (remaining=${remain}, ${reason})`)
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${url}`)
  return res.json()
}

// 限流耗尽标记：外层循环捕获后停止补全，避免逐仓库等 reset
export class RateLimitError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RateLimitError'
  }
}
