import { Fragment, useMemo, useState } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { UI } from '../i18n/ui.js'
import RepoCard from './RepoCard'
import { SponsorRankRow, SponsorCard } from './SponsorSlot'
import { CATEGORIES, SORT_OPTIONS, getCategory } from '../lib/categories'
import { formatNumber } from '../lib/format'
import { sponsorFor } from '../lib/sponsors'
import repoData from '../data/repos.json'
import sponsorData from '../data/sponsors.json'

// 防御聚合数据异常：确保 repos 始终是数组
const repos = Array.isArray(repoData?.repos) ? repoData.repos : []
const generatedAt = typeof repoData?.generatedAt === 'string' ? repoData.generatedAt : null

// 赞助数据（过期/缺字段条目已在过滤时剔除，无有效赞助则对应展位不渲染）
const sponsorList = Array.isArray(sponsorData?.sponsors) ? sponsorData.sponsors : []

export default function HubSection() {
  const { lang } = useLang()
  const t = UI[lang].plugins
  const [cat, setCat] = useState('all')
  const [selLang, setSelLang] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('stars')
  const [visibleCount, setVisibleCount] = useState(18)
  const PAGE_SIZE = 18

  // 筛选条件变化时重置可见数量
  const resetVisible = () => setVisibleCount(PAGE_SIZE)

  const languages = useMemo(() => {
    const m = new Map()
    repos.forEach((r) => r.language && m.set(r.language, (m.get(r.language) || 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [])

  const catCounts = useMemo(() => {
    const m = new Map()
    repos.forEach((r) => m.set(r.category, (m.get(r.category) || 0) + 1))
    return m
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = repos.filter((r) => {
      if (cat !== 'all' && r.category !== cat) return false
      if (selLang !== 'all' && r.language !== selLang) return false
      if (q) {
        const hay = `${r.fullName} ${r.description} ${r.descriptionOriginal || ''} ${(r.topics || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      if (sort === 'stars') return b.stars - a.stars
      if (sort === 'updated') return new Date(b.updatedAt) - new Date(a.updatedAt)
      if (sort === 'score') return b.score - a.score
      return 0
    })
    return list
  }, [cat, selLang, query, sort])

  const topRepos = useMemo(
    () => [...repos].sort((a, b) => b.stars - a.stars).slice(0, 10),
    [],
  )

  const rankingSponsor = useMemo(() => sponsorFor(sponsorList, 'ranking'), [])
  const cardSponsor = useMemo(() => sponsorFor(sponsorList, 'card'), [])

  return (
    <section id="plugins" className="relative border-t border-border-subtle">
      <div className="mx-auto max-w-[1280px] px-5 py-16 sm:py-20">
        {/* 区块标题 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-fg-dim">{t.label}</span>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-fg sm:text-3xl">
              {t.title}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-fg-muted">
              {t.desc}
              <span className="mt-1 block text-fg-dim">{t.newTip}</span>
            </p>
          </div>
          <div className="shrink-0 rounded-[10px] border border-border-subtle bg-surface-2 px-4 py-2.5 text-xs text-fg-dim">
            <div>{t.updateDate}</div>
            <div className="mt-0.5 font-mono text-sm text-fg-secondary">
              {generatedAt ? new Date(generatedAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US') : '-'}
            </div>
          </div>
        </div>

        {/* ===== 双栏布局：左侧分类侧边栏 + 右侧内容 ===== */}
        <div className="mt-10 grid gap-8 md:grid-cols-[220px_1fr]">

          {/* 左侧：粘性分类侧边栏 */}
          <aside className="md:sticky md:top-20 md:self-start md:max-h-[calc(100vh-110px)] md:overflow-y-auto">
            <div className="rounded-[14px] border border-border-subtle bg-surface-2 p-4">
              <div className="mb-3 px-1 text-[11px] font-medium uppercase tracking-wider text-fg-dim">
                {t.categories || '分类'}
              </div>
              <nav className="space-y-0.5">
                {CATEGORIES.map((c) => {
                  const count = c.id === 'all' ? repos.length : catCounts.get(c.id) || 0
                  if (c.id !== 'all' && count === 0) return null
                  const active = cat === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCat(c.id); resetVisible() }}
                      className={`flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-xs transition-colors ${
                        active
                          ? 'bg-surface-raised text-fg'
                          : 'text-fg-muted hover:bg-surface-1 hover:text-fg'
                      }`}
                    >
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                      <span className="flex-1 truncate">{c.label}</span>
                      <span className={`font-mono text-[10px] ${active ? 'text-fg-secondary' : 'text-fg-dim'}`}>{count}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* 右侧：内容区 */}
          <div className="min-w-0">
            {/* 工具行：搜索 + 语言 + 排序 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-dim"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); resetVisible() }}
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-[10px] border border-border-subtle bg-surface-2 py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-dim focus:border-border-secondary focus:outline-none"
                />
              </div>
              <select
                value={selLang}
                onChange={(e) => { setSelLang(e.target.value); resetVisible() }}
                className="rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-fg-muted focus:border-border-secondary focus:outline-none"
              >
                <option value="all">{t.allLangs}</option>
                {languages.map(([l, n]) => (
                  <option key={l} value={l}>
                    {l} ({n})
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); resetVisible() }}
                className="rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-fg-muted focus:border-border-secondary focus:outline-none"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 结果计数 */}
            <div className="mt-4 text-xs text-fg-dim">
              {t.showing} <span className="font-mono text-fg-secondary">{filtered.length}</span> {t.of} {repos.length} {t.plugins}
            </div>

            {/* 热榜横条（Top 10） */}
            <div id="ranking" className="mt-5 scroll-mt-20 rounded-[14px] border border-border-subtle bg-surface-2/60 p-4">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-fg-muted">
                  <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3" />
                </svg>
                <h3 className="text-xs font-medium text-fg">{t.ranking}</h3>
                <span className="text-[10px] text-fg-dim">{t.rankingHint || '按星标'}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {topRepos.map((r, i) => {
                  return (
                    <Fragment key={r.id}>
                      {/* 赞助内嵌行——固定在第 3、4 名之间，不参与星标排序 */}
                      {i === 3 && <SponsorRankRow sponsor={rankingSponsor} />}
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ds-card-hover group flex min-w-[140px] flex-1 items-center gap-2.5 rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2.5"
                      >
                        <span className="font-mono text-base font-medium text-fg-dim">#{i + 1}</span>
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: getCategory(r.category).color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-fg group-hover:text-brand" title={r.fullName}>{r.name}</span>
                          <span className="flex items-center gap-1 text-[10px] text-fg-dim">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                            {formatNumber(r.stars)}
                          </span>
                        </span>
                      </a>
                    </Fragment>
                  )
                })}
              </div>
            </div>

            {/* 赞助规则 + 申请入口 */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-fg-dim">
              <span>{t.sponsorRules}</span>
              <a
                href="https://github.com/qomob/dsh/issues"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-fg-muted"
              >
                {t.sponsorApply}
              </a>
            </div>

            {/* 卡片网格——分页显示 */}
            {filtered.length > 0 ? (
              <>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {/* 赞助置顶卡——不参与筛选与自然排序 */}
                  <SponsorCard sponsor={cardSponsor} />
                  {filtered.slice(0, visibleCount).map((r) => (
                    <RepoCard key={r.id} repo={r} />
                  ))}
                </div>

                {/* 加载更多 */}
                {visibleCount < filtered.length && (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                      className="ds-btn-secondary inline-flex items-center gap-2 !px-6 !py-2.5 !text-sm"
                    >
                      {t.loadMore}
                      <span className="font-mono text-xs text-fg-dim">({filtered.length - visibleCount})</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12l7 7 7-7" />
                      </svg>
                    </button>
                  </div>
                )}
                {visibleCount >= filtered.length && filtered.length > PAGE_SIZE && (
                  <div className="mt-8 text-center text-xs text-fg-dim">{t.loadedAll}</div>
                )}
              </>
            ) : (
              <div className="mt-6 rounded-[16px] border border-border-subtle border-dashed bg-surface-2 py-14 text-center">
                <div className="text-sm text-fg-muted">{t.noMatch}</div>
                <button
                  type="button"
                  onClick={() => {
                    setCat('all')
                    setSelLang('all')
                    setQuery('')
                    resetVisible()
                  }}
                  className="ds-btn-secondary mt-3 !px-3 !py-1.5 !text-xs"
                >
                  {t.reset}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}