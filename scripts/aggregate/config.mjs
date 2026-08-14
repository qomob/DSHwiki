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

// 融合的 awesome 精选列表（README 中提取仓库链接）
// 注意：awesome 补全的仓库同样经过 topic 白名单 + 相关性过滤,不会失控
export const AWESOME_SOURCES = [
  { repo: '0xsline/awesome-deepseek-harness', branch: 'main' },
  { repo: 'awesome-dsh-plugin/awesome-dsh-plugin', branch: 'main' },
  { repo: 'AdamPlatin123/awesome-dsh-plugins', branch: 'main' },
]

export const OFFICIAL_OWNER = 'deepseek-ai'
export const OFFICIAL_REPO = 'deepseek-ai/deepseek-harness'

export const OUTPUT_PATH = fileURLToPath(
  new URL('../../src/data/repos.json', import.meta.url),
)

export const RATE_LIMIT_DELAY_MS = 2000
