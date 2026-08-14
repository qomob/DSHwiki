// 聚合脚本配置：搜索关键词、精选列表源、输出路径
import { fileURLToPath } from 'node:url'

// 限定抓取范围：仅三个官方 topic
// 参考页面：
//   https://github.com/topics/dsh-plugin
//   https://github.com/topics/dsh
//   https://github.com/topics/deepseek-harness
export const SEARCH_QUERIES = [
  'topic:dsh-plugin',
  'topic:dsh',
  'topic:deepseek-harness',
]

// 允许的 topic 白名单：仓库必须命中其一才收录（双保险过滤）
export const ALLOWED_TOPICS = ['dsh-plugin', 'dsh', 'deepseek-harness']

// 融合的 awesome 精选列表已停用（范围过大），如需恢复可重新启用
export const AWESOME_SOURCES = []

export const OFFICIAL_OWNER = 'deepseek-ai'
export const OFFICIAL_REPO = 'deepseek-ai/deepseek-harness'

export const OUTPUT_PATH = fileURLToPath(
  new URL('../../src/data/repos.json', import.meta.url),
)

export const RATE_LIMIT_DELAY_MS = 2000
