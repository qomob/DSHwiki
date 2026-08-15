import { useLang } from '../i18n/LanguageContext.jsx'
import { UI } from '../i18n/ui.js'
import AdBadge from './AdBadge'

// 赞助展位（P0 变现 · 付费展示）
// 原则：明示「赞助」标签 · 不伪造星标 · 不参与自然排序 · 过期自动下线（见 lib/sponsors.js）
// 链接统一 rel="sponsored"，符合搜索引擎付费链接规范

// 热榜内嵌行：插在热榜第 3、4 名之间，整行可点
export function SponsorRankRow({ sponsor }) {
  const { lang } = useLang()
  const t = UI[lang].plugins
  if (!sponsor) return null

  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noreferrer sponsored"
      className="ds-card-hover group flex w-full items-center gap-2.5 rounded-[10px] border border-brand/40 bg-brand-soft/60 px-3 py-2.5"
      title={sponsor.desc?.[lang] || sponsor.name}
    >
      <AdBadge label={t.sponsored} />
      <span className="shrink-0 text-xs font-medium text-fg group-hover:text-brand">{sponsor.name}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">{sponsor.desc?.[lang]}</span>
      <span className="shrink-0 text-[11px] text-brand">{t.sponsorLearnMore}</span>
    </a>
  )
}

// 卡片流置顶卡：与 RepoCard 同构，品牌色边框 + 赞助标识区分
export function SponsorCard({ sponsor }) {
  const { lang } = useLang()
  const t = UI[lang].plugins
  if (!sponsor) return null

  return (
    <article className="ds-card-hover ds-card-highlight flex flex-col rounded-[10px] border border-brand/40 bg-surface-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="mt-0.5 truncate text-sm font-medium text-fg" title={sponsor.name}>{sponsor.name}</h4>
        <AdBadge label={t.sponsored} />
      </div>
      <p className="mt-2 line-clamp-3 min-h-[3.6rem] text-sm leading-relaxed text-fg-muted">
        {sponsor.desc?.[lang] || sponsor.desc?.zh || sponsor.desc?.en}
      </p>
      {sponsor.installCmd && (
        <div className="mt-auto pt-4">
          <div className="mb-1.5 text-[10px] text-fg-dim">{t.installCommunity}</div>
          <div className="overflow-x-auto rounded-[10px] border border-border-subtle bg-code-bg px-3 py-2">
            <code className="whitespace-pre font-mono text-[11px] text-fg-secondary">{sponsor.installCmd}</code>
          </div>
        </div>
      )}
      <div className={`flex justify-end ${sponsor.installCmd ? 'mt-2' : 'mt-auto pt-4'}`}>
        <a
          href={sponsor.url}
          target="_blank"
          rel="noreferrer sponsored"
          className="inline-flex items-center gap-1 text-[11px] text-fg-dim transition-colors hover:text-fg-secondary"
        >
          {t.viewGithub}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </a>
      </div>
    </article>
  )
}
