// 部件分类定义 + 自动推断
// 分类围绕 DeepSeek Harness (dsh) 实际生态设计，原创命名

export const CATEGORIES = [
  { id: 'all', label: '全部', color: '#4d6bfe' },
  { id: 'core', label: '原厂核心', color: '#f5b942' },
  { id: 'orchestration', label: 'Agent 编排', color: '#a78bfa' },
  { id: 'interface', label: '界面交互', color: '#22d3ee' },
  { id: 'terminal', label: '终端 TUI', color: '#34d399' },
  { id: 'skin', label: '主题皮肤', color: '#fb7185' },
  { id: 'vision', label: '感知视觉', color: '#f59e0b' },
  { id: 'memory', label: '记忆检索', color: '#60a5fa' },
  { id: 'workflow', label: '工作流', color: '#c084fc' },
  { id: 'communication', label: '通讯通知', color: '#2dd4bf' },
  { id: 'engineering', label: '工程运维', color: '#94a3b8' },
  { id: 'toolset', label: '通用工具', color: '#facc15' },
  { id: 'skill', label: 'Skill 技能', color: '#f472b6' },
  { id: 'awesome', label: '精选清单', color: '#e879f9' },
  { id: 'extension', label: '扩展生态', color: '#818cf8' },
  { id: 'other', label: '其他', color: '#64748b' },
]

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id) {
  return CATEGORY_MAP[id] || CATEGORY_MAP.other
}

// 根据仓库信息推断分类（聚合脚本与前端共用）
export function categorize(repo) {
  const topics = (repo.topics || []).join(' ').toLowerCase()
  const desc = (repo.descriptionOriginal || repo.description || '').toLowerCase()
  const name = (repo.name || '').toLowerCase()
  const text = `${name} ${desc} ${topics}`

  if (repo.owner === 'deepseek-ai') return 'core'
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

export const SORT_OPTIONS = [
  { id: 'stars', label: '星标最多' },
  { id: 'updated', label: '最近更新' },
  { id: 'recent', label: '最新收录' },
  { id: 'score', label: '相关度' },
]
