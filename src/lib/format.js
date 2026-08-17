// 格式化工具
export function formatNumber(n) {
  if (n == null) return '-'
  if (n >= 1000) {
    return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k'
  }
  return String(n)
}

// 日历日差（本地时区）：昨天就是昨天，不随当前时刻的钟点漂移。
// 修复旧版按流逝小时数计算导致的“日期串与相对标签错位”问题。
export function relativeDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000)
  if (diff <= 0) return '今天更新'
  if (diff === 1) return '昨天更新'
  if (diff < 7) return `${diff} 天前`
  if (diff < 30) return `${Math.floor(diff / 7)} 周前`
  if (diff < 365) return `${Math.floor(diff / 30)} 个月前`
  return `${Math.floor(diff / 365)} 年前`
}

// GitHub 主流语言色卡
export const LANG_COLORS = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  HTML: '#e34c26',
  Shell: '#89e051',
  Rust: '#dea584',
  'C#': '#178600',
  Swift: '#F05138',
  PowerShell: '#012456',
  Go: '#00ADD8',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  CSS: '#563d7c',
  MDX: '#fcb32c',
  Batchfile: '#C1F12E',
  Astro: '#ff5a03',
}

export function langColor(lang) {
  return LANG_COLORS[lang] || '#64748b'
}
