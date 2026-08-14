import { useMemo, useState } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { UI } from '../i18n/ui.js'
import RepoCard from './RepoCard'
import { CATEGORIES, SORT_OPTIONS, getCategory } from '../lib/categories'
import { formatNumber } from '../lib/format'
import repoData from '../data/repos.json'

// 防御聚合数据异常：确保 repos 始终是数组
const repos = Array.isArray(repoData?.repos) ? repoData.repos : []
const generatedAt = typeof repoData?.generatedAt === 'string' ? repoData.generatedAt : null

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
    () => [...repos].sort((a, b) => b.stars - a.stars).slice(0, 5),
    [],
  )

  return (
    <section id="plugins" className="relative border-t border-border-subtle">
      <div className="mx-auto max-w-[1140px] px-5 py-20 sm:py-24">
        {/* 标题 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-fg-dim">{t.label}</span>
            <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-fg sm:text-3xl lg:text-4xl">
              {t.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
              {t.desc}
              <span className="mt-1 block text-fg-dim">{t.newTip}</span>
            </p>
          </div>
          <div className="shrink-0 rounded-[10px] border border-border-subtle bg-surface-2 px-4 py-3 text-xs text-fg-dim">
            <div>{t.updateDate}</div>
            <div className="mt-0.5 font-mono text-sm text-fg-secondary">
              {generatedAt ? new Date(generatedAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US') : '-'}
            </div>
          </div>
        </div>

        {/* 精选榜 Top 5 */}
        <div id="ranking" className="mt-12 scroll-mt-20">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-fg-muted">
              <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3" />
            </svg>
            <h3 className="text-sm font-medium text-fg">{t.ranking}</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {topRepos.map((r, i) => {
              const c = getCategory(r.category)
              return (
                <a
                  key={r.id}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ds-card-hover group flex flex-col rounded-[10px] border border-border-subtle bg-surface-2 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-medium text-fg-dim">#{i + 1}</span>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                  </div>
                  <div className="mt-2 truncate text-sm text-fg group-hover:text-brand" title={r.fullName}>
                    {r.name}
                  </div>
                  <div className="truncate text-[11px] text-fg-dim">@{r.owner}</div>
                  <div className="mt-auto pt-3 flex items-center gap-1 text-xs text-fg-muted">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                    {formatNumber(r.stars)}
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="mt-12 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const count = c.id === 'all' ? repos.length : catCounts.get(c.id) || 0
              if (c.id !== 'all' && count === 0) return null
              const active = cat === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCat(c.id); resetVisible() }}
                  className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? 'border-border-secondary bg-surface-raised text-fg'
                      : 'border-border-subtle bg-surface-2 text-fg-muted hover:text-fg'
                  }`}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                  {c.label}
                  <span className="text-fg-dim">{count}</span>
                </button>
              )
            })}
          </div>

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
        </div>

        {/* 结果计数 */}
        <div className="mt-6 text-xs text-fg-dim">
          {t.showing} <span className="font-mono text-fg-secondary">{filtered.length}</span> {t.of} {repos.length} {t.plugins}
        </div>

        {/* 卡片网格——分页显示 */}
        {filtered.length > 0 ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <span className="font-mono text-xs text-fg-dim">
                    ({filtered.length - visibleCount})
                  </span>
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
          <div className="mt-10 rounded-[16px] border border-border-subtle border-dashed bg-surface-2 py-16 text-center">
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
    </section>
  )
}
