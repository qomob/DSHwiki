// 赞助展位数据过滤
// sponsors.json 条目结构：
//   id / name / desc{zh,en} / url / installCmd / placement('ranking'|'card') / expiresAt(YYYY-MM-DD)
// 过期或缺必填字段的条目一律不展示

export function activeSponsors(list, now = new Date()) {
  if (!Array.isArray(list)) return []
  return list.filter((s) => {
    if (!s || !s.id || !s.name || !s.url || !s.placement || !s.expiresAt) return false
    const exp = new Date(`${s.expiresAt}T23:59:59`)
    if (Number.isNaN(exp.getTime())) return false
    return exp >= now
  })
}

export function sponsorFor(list, placement, now = new Date()) {
  return activeSponsors(list, now).find((s) => s.placement === placement) || null
}
