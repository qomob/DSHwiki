// Category taxonomy + auto-inference, ported from the DSHwiki aggregation
// pipeline (src/lib/categories.js + scripts/aggregate/aggregate.mjs) so live
// GitHub results are classified exactly like the curated registry snapshot.

export const CATEGORIES = [
  { id: 'core', label: '原厂核心' },
  { id: 'orchestration', label: 'Agent 编排' },
  { id: 'interface', label: '界面交互' },
  { id: 'terminal', label: '终端 TUI' },
  { id: 'skin', label: '主题皮肤' },
  { id: 'vision', label: '感知视觉' },
  { id: 'memory', label: '记忆检索' },
  { id: 'workflow', label: '工作流' },
  { id: 'communication', label: '通讯通知' },
  { id: 'engineering', label: '工程运维' },
  { id: 'toolset', label: '通用工具' },
  { id: 'skill', label: 'Skill 技能' },
  { id: 'awesome', label: '精选清单' },
  { id: 'extension', label: '扩展生态' },
  { id: 'other', label: '其他' },
]

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id) {
  return CATEGORY_MAP.get(id) ?? CATEGORY_MAP.get('other')
}

// Infer a category from repo name / description / topics. Shared by the
// aggregation pipeline and the plugin's live search path.
export function categorize(repo) {
  const topics = (repo.topics || []).join(' ').toLowerCase()
  const desc = (repo.descriptionOriginal || repo.description || '').toLowerCase()
  const repoName = (repo.name || '').toLowerCase()
  const text = `${repoName} ${desc} ${topics}`

  if (repo.owner === 'deepseek-ai' || repo.official) return 'core'
  if (/awesome|curated list|精选列表|精选目录/.test(text)) return 'awesome'
  if (/\btui\b|terminal|终端|cli/.test(text)) return 'terminal'
  if (/skin|theme|皮肤|涂装|maid-atelier/.test(text)) return 'skin'
  if (/vision|ocr|image|视觉|图片|screenshot|grounding/.test(text)) return 'vision'
  if (/memory|context|rag|记忆|上下文|embedding|vector/.test(text)) return 'memory'
  if (/workflow|flow|工作流/.test(text)) return 'workflow'
  if (/notif|webhook|通知|通讯|broadcast|push|alert/.test(text)) return 'communication'
  if (/lint|test|debug|ci\/cd|engineering|检修|benchmark|profiler/.test(text)) return 'engineering'
  if (/skill|技能/.test(text)) return 'skill'
  if (/agent.?team|multi.?agent|编排|协作|collab|sub.?agent|delegation/.test(text)) return 'orchestration'
  if (/web.?ui|sidebar|panel|dashboard|界面|驾驶舱|modal|tab/.test(text)) return 'interface'
  if (/tool|kit|util|工具|helper|wrapper/.test(text)) return 'toolset'
  if (/plugin|extension|生态|adapter|integration/.test(text)) return 'extension'
  return 'other'
}

// Relevance gate: topic hits only make a repo a search candidate; the name or
// description must actually reference the dsh ecosystem. Ported verbatim from
// the aggregation pipeline so live results match curated inclusion rules.
export function isRelevant(repo) {
  if (repo.official) return true
  const desc = (repo.descriptionOriginal || repo.description || '').toLowerCase()
  const repoName = (repo.name || '').toLowerCase()
  const text = `${repoName} ${desc}`
  return (
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
  )
}

// 0–100 ecosystem relevance score, ported from the aggregation pipeline.
export function computeScore(repo) {
  let s = 0
  if (repo.official) s += 30
  const topics = (repo.topics || []).map((t) => t.toLowerCase())
  if (topics.includes('dsh-plugin')) s += 20
  if (topics.includes('deepseek-harness')) s += 15
  const text = `${repo.fullName} ${repo.descriptionOriginal || repo.description || ''}`.toLowerCase()
  if (text.includes('deepseek-harness') || text.includes('dsh plugin') || text.includes('dsh-plugin')) s += 15
  const starsScore = (Math.log10((repo.stars || 0) + 1) / Math.log10(60000)) * 30
  s += starsScore
  if (repo.updatedAt) {
    const days = (Date.now() - new Date(repo.updatedAt).getTime()) / 86400000
    if (days < 30) s += 5
  }
  return Math.min(100, Math.round(s))
}
