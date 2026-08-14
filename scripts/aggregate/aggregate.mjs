// DSH 工坊 每日聚合主流程
// 1. GitHub Search API(topic 限定) 2. 去重 3. 相关度评分 4. 分类 5. 翻译 6. 输出 repos.json
import { writeFileSync } from 'node:fs'
import { searchRepos, getRepoNoRetry, RateLimitError } from './github.mjs'
import { fetchAwesomeRepos } from './awesome.mjs'
import { translateDescriptions } from './translate.mjs'
import { SEARCH_QUERIES, ALLOWED_TOPICS, OUTPUT_PATH, OFFICIAL_OWNER } from './config.mjs'
import { categorize } from '../../src/lib/categories.js'

// 产出 schema 校验：不合法直接抛错退出,不覆盖上一次的好数据
function validateOutput(output) {
  const errors = []
  if (!output || typeof output !== 'object') {
    throw new Error('产出非对象')
  }
  if (typeof output.generatedAt !== 'string' || !output.generatedAt) {
    errors.push('generatedAt 缺失或非字符串')
  }
  if (!Array.isArray(output.repos)) {
    throw new Error('repos 非数组')
  }
  if (output.repos.length === 0) {
    throw new Error('repos 为空——可能聚合全部失败,拒绝写入空数据覆盖上次结果')
  }
  const REQUIRED = ['id', 'fullName', 'url', 'category', 'stars']
  output.repos.forEach((r, i) => {
    for (const k of REQUIRED) {
      if (r[k] == null) errors.push(`repos[${i}].${k} 缺失 (${r.fullName || r.id || 'unknown'})`)
    }
    if (typeof r.url !== 'string' || !r.url.startsWith('https://')) {
      errors.push(`repos[${i}].url 非合法 https 链接: ${r.url}`)
    }
  })
  if (!output.stats || typeof output.stats !== 'object') {
    errors.push('stats 缺失或非对象')
  }
  if (errors.length > 0) {
    throw new Error('产出校验失败:\n  - ' + errors.slice(0, 10).join('\n  - '))
  }
}

function normalize(item, source) {
  return {
    id: item.full_name,
    name: item.name,
    owner: item.owner?.login,
    fullName: item.full_name,
    url: item.html_url,
    avatar: item.owner?.avatar_url,
    descriptionOriginal: item.description || '',
    description: item.description || '',
    translated: false,
    stars: item.stargazers_count || 0,
    forks: item.forks_count || 0,
    language: item.language,
    license: item.license?.spdx_id || null,
    topics: item.topics || [],
    updatedAt: item.updated_at,
    homepage: item.homepage || null,
    category: '',
    installCmd: '',
    installType: 'plugin',
    score: 0,
    source,
    official: item.owner?.login === OFFICIAL_OWNER,
    featured: false,
  }
}

function computeScore(r, fromAwesome) {
  let s = 0
  if (r.official) s += 30
  const topics = (r.topics || []).map((t) => t.toLowerCase())
  if (topics.includes('dsh-plugin')) s += 20
  if (topics.includes('deepseek-harness')) s += 15
  const text = `${r.fullName} ${r.descriptionOriginal}`.toLowerCase()
  if (text.includes('deepseek-harness') || text.includes('dsh plugin') || text.includes('dsh-plugin')) s += 15
  if (fromAwesome) s += 10
  const starsScore = (Math.log10((r.stars || 0) + 1) / Math.log10(60000)) * 30
  s += starsScore
  if (r.updatedAt) {
    const days = (Date.now() - new Date(r.updatedAt).getTime()) / 86400000
    if (days < 30) s += 5
  }
  return Math.min(100, Math.round(s))
}

// 相关性判定：剔除蹭 topic 的非 dsh 生态项目
// 核心门槛：描述或仓库名必须真的提到 dsh / DeepSeek Harness 上下文
// (topic 命中只是搜索候选条件,不代表真的属于 dsh 生态)
function isRelevant(r) {
  if (r.official) return true
  const desc = (r.descriptionOriginal || r.description || '').toLowerCase()
  const name = (r.name || '').toLowerCase()
  const text = name + ' ' + desc
  // 强指代：明确提到框架名 或 dsh+插件/皮肤/UI/TUI/运行时等组合
  const strong =
    text.includes('deepseek-harness') ||
    text.includes('deepseek harness') ||
    text.includes('dsh plugin') ||
    text.includes('dsh-plugin') ||
    text.includes('dsh skin') ||
    text.includes('dsh web') ||
    text.includes('dsh ui') ||
    text.includes('dsh tui') ||
    text.includes('for dsh') ||
    /\bdsh[- ][a-z]+/.test(text)
  return strong
}

function makeInstallCmd(r) {
  if (r.official) return 'npx @deepseek-ai/dsh web'
  if (r.category === 'awesome') return `git clone https://github.com/${r.fullName}.git`
  return `dsh plugin add "github:${r.fullName}"`
}

async function main() {
  console.log('=== DSH 工坊 每日聚合开始 ===')
  const repoMap = new Map()

  // 1. GitHub 搜索（仅限定 topic）
  let filteredOut = 0
  for (const q of SEARCH_QUERIES) {
    console.log(`搜索: ${q}`)
    try {
      const items = await searchRepos(q, 50)
      for (const item of items) {
        // 双保险：仓库 topics 必须命中白名单之一才收录
        const hitTopic = (item.topics || []).some((t) => ALLOWED_TOPICS.includes(t))
        if (!repoMap.has(item.full_name)) {
          if (hitTopic) {
            repoMap.set(item.full_name, normalize(item, 'github-search'))
          } else {
            filteredOut++
          }
        }
      }
      console.log(`  累计 ${repoMap.size} 个 (过滤 ${filteredOut} 个非白名单)`)
    } catch (e) {
      console.warn(`搜索失败 [${q}]: ${e.message}`)
    }
  }

  // 2. awesome 精选列表（补全的仓库同样经过 topic 白名单过滤）
  const awesomeSet = await fetchAwesomeRepos()
  console.log(`awesome 列表共 ${awesomeSet.size} 个候选，补全详情…`)
  let awesomeSkipped = 0
  let awesomeAdded = 0
  let awesomeFiltered = 0
  try {
    for (const full of awesomeSet.keys()) {
      if (repoMap.has(full)) {
        repoMap.get(full).source = 'awesome-list'
        continue
      }
      const [owner, repo] = full.split('/')
      const item = await getRepoNoRetry(owner, repo)
      if (item) {
        // 双保险：awesome 补全的仓库也必须命中 topic 白名单
        const hitTopic = (item.topics || []).some((t) => ALLOWED_TOPICS.includes(t))
        if (hitTopic) {
          repoMap.set(full, normalize(item, 'awesome-list'))
          awesomeAdded++
        } else {
          awesomeFiltered++
        }
      }
    }
  } catch (e) {
    if (e instanceof RateLimitError) {
      console.warn(`⚠️ GitHub API 配额耗尽，跳过剩余 awesome 补全 (已补全 ${awesomeAdded} 个)`)
      awesomeSkipped = awesomeSet.size - awesomeAdded
    } else {
      throw e
    }
  }
  if (awesomeSkipped > 0 || awesomeFiltered > 0) {
    console.log(`awesome 补全完成: 新增 ${awesomeAdded}, 过滤 ${awesomeFiltered} 个非白名单, 因配额跳过 ${awesomeSkipped}`)
  } else if (awesomeAdded > 0) {
    console.log(`awesome 补全完成: 新增 ${awesomeAdded} 个`)
  }

  // 3. 分类 + 评分 + 安装命令
  let repos = [...repoMap.values()].map((r) => {
    r.category = categorize(r)
    r.score = computeScore(r, awesomeSet.has(r.fullName))
    r.installType = r.official ? 'runtime' : r.category === 'awesome' ? 'clone' : 'plugin'
    r.installCmd = makeInstallCmd(r)
    return r
  })
  // 相关性过滤：剔除蹭 topic 的非 dsh 项目
  const before = repos.length
  repos = repos.filter(isRelevant)
  console.log(`相关性过滤: ${before} → ${repos.length} (剔除 ${before - repos.length} 个非 dsh 生态)`)

  // 4. 翻译
  repos = await translateDescriptions(repos)

  // 5. 排序 + featured
  repos.sort((a, b) => b.score - a.score)
  repos.slice(0, 6).forEach((r) => (r.featured = true))

  // 6. 输出
  const totalStars = repos.reduce((s, r) => s + (r.stars || 0), 0)
  const usedCats = new Set(repos.map((r) => r.category))
  const output = {
    generatedAt: new Date().toISOString(),
    sources: ['github-search', 'awesome-list'],
    stats: {
      total: repos.length,
      totalStars,
      categories: usedCats.size,
      lastRun: new Date().toISOString(),
    },
    repos,
  }

  // 写入前校验：保护上一次的好数据不被脏数据覆盖
  validateOutput(output)
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8')
  console.log(`=== 聚合完成: ${repos.length} 个部件 → ${OUTPUT_PATH} ===`)
}

main().catch((e) => {
  console.error('聚合失败:', e)
  process.exit(1)
})