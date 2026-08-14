// 从 awesome 精选列表 README 中提取 GitHub 仓库链接
import { AWESOME_SOURCES } from './config.mjs'

const NON_REPO_SEGMENTS = new Set([
  'issues', 'pull', 'pulls', 'blob', 'tree', 'releases', 'actions', 'settings',
  'search', 'topics', 'orgs', 'explore', 'notifications', 'login', 'signup',
  'new', 'about', 'pricing', 'features', 'security', 'team', 'enterprise',
  'sponsors', 'marketplace', 'apps', 'collections', 'events', 'stars', 'watch',
  'gist', 'assets', 'favicon', 'avatars',
])

export function extractRepos(md) {
  const set = new Set()
  // lookahead 加 / 以支持带子路径的链接(如 .../owner/repo/issues)
  const re = /github\.com\/([\w.-]+)\/([\w.-]+?)(?=[)\s"'#?/]|$)/g
  let m
  while ((m = re.exec(md))) {
    const owner = m[1]
    let repo = m[2]
    repo = repo.replace(/\.git$/, '')
    if (NON_REPO_SEGMENTS.has(owner.toLowerCase())) continue
    if (NON_REPO_SEGMENTS.has(repo.toLowerCase())) continue
    if (owner.length > 39) continue // GitHub 用户名上限 39
    set.add(`${owner}/${repo}`)
  }
  return [...set]
}

export async function fetchAwesomeRepos() {
  const all = new Map() // fullName -> true
  for (const s of AWESOME_SOURCES) {
    const url = `https://raw.githubusercontent.com/${s.repo}/${s.branch}/README.md`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.warn(`awesome 列表抓取失败 ${s.repo}: ${res.status}`)
        continue
      }
      const md = await res.text()
      const repos = extractRepos(md)
      console.log(`awesome ${s.repo}: 发现 ${repos.length} 个候选`)
      repos.forEach((full) => all.set(full, true))
    } catch (e) {
      console.warn(`awesome 抓取异常 ${s.repo}: ${e.message}`)
    }
  }
  return all
}
