// 聚合脚本配置：搜索关键词、精选列表源、输出路径
import { fileURLToPath } from 'node:url'

// 围绕 deepseek-harness 生态的关键词，覆盖官方 topic 与自然语言表述
export const SEARCH_QUERIES = [
  'deepseek-harness',
  'topic:dsh-plugin',
  'topic:deepseek-harness',
  'dsh plugin',
  'deepseek skill',
  'dsh-plugin',
]

// 融合的 awesome 精选列表（README 中提取仓库链接）
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
