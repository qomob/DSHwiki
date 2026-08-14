import { useState } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { UI } from '../i18n/ui.js'
import { getCategory } from '../lib/categories'
import { relativeDate, langColor } from '../lib/format'

function formatNumber(n) {
  if (n == null) return '-'
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`
  return String(n)
}

function Avatar({ repo, size = 36 }) {
  if (repo.avatar) {
    return (
      <img
        src={repo.avatar}
        alt={repo.owner}
        width={size}
        height={size}
        loading="lazy"
        className="rounded-[8px] border border-border-subtle bg-surface-1 object-cover"
        style={{ width: size, height: size }}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    )
  }
  const initial = (repo.owner || '?').slice(0, 2).toUpperCase()
  return (
    <div
      className="grid place-items-center rounded-[8px] border border-border-subtle bg-surface-1 font-mono text-xs text-fg-muted"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  )
}

function CopyButton({ text, label, copiedLabel }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 忽略剪贴板权限失败
    }
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      className="shrink-0 px-2 py-1 text-[11px] text-fg-dim transition-colors hover:text-fg-muted"
      aria-label={label}
    >
      {copied ? copiedLabel : label}
    </button>
  )
}

export default function RepoCard({ repo, rank }) {
  const { lang } = useLang()
  const t = UI[lang].plugins
  const cat = getCategory(repo.category)
  const showOriginal =
    repo.translated && repo.descriptionOriginal && repo.descriptionOriginal !== repo.description

  const installLabel =
    repo.installType === 'runtime'
      ? t.installRuntime
      : repo.installType === 'clone'
        ? t.installClone
        : t.installCommunity

  return (
    <article className="ds-card-hover ds-card-highlight flex flex-col rounded-[10px] border border-border-subtle bg-surface-3 p-4">
      {/* 角标 */}
      <div className="flex justify-end gap-1.5">
        {repo.official && (
          <span className="rounded-pill border border-border-secondary bg-surface-1 px-1.5 py-0.5 text-[10px] text-fg-secondary">
            {lang === 'zh' ? '官方' : 'Official'}
          </span>
        )}
        {repo.featured && !repo.official && (
          <span className="rounded-pill border border-border-secondary bg-surface-1 px-1.5 py-0.5 text-[10px] text-fg-secondary">
            {lang === 'zh' ? '精选' : 'Featured'}
          </span>
        )}
      </div>

      {/* 头部 */}
      <div className="-mt-2 flex items-start gap-3">
        <Avatar repo={repo} />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs text-fg-dim">
            <span className="truncate">@{repo.owner}</span>
            {repo.language && (
              <>
                <span className="text-fg-dim">·</span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: langColor(repo.language) }} />
                  {repo.language}
                </span>
              </>
            )}
          </div>
          <a
            href={repo.url}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block truncate text-sm text-fg transition-colors hover:text-brand"
            title={repo.fullName}
          >
            {repo.fullName}
          </a>
        </div>
      </div>

      {/* 分类 + 排名 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-1 px-2 py-0.5 text-[11px] text-fg-secondary">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />
          {cat.label}
        </span>
        {rank && <span className="font-mono text-[11px] text-fg-dim">#{rank}</span>}
      </div>

      {/* 简介 */}
      <p
        className="mt-3 line-clamp-3 min-h-[3.6rem] text-sm leading-relaxed text-fg-muted"
        title={showOriginal ? `${lang === 'zh' ? '原文' : 'Original'}: ${repo.descriptionOriginal}` : undefined}
      >
        {repo.description || (lang === 'zh' ? '暂无简介' : 'No description')}
      </p>
      {showOriginal && (
        <p className="mt-1 hidden text-[11px] leading-relaxed text-fg-dim group-hover:block">
          <span className="text-fg-dim">{lang === 'zh' ? '原文' : 'Original'}: </span>
          {repo.descriptionOriginal}
        </p>
      )}

      {/* 统计 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-dim">
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
          {formatNumber(repo.stars)}
        </span>
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 3v12a3 3 0 003 3h9M6 3a3 3 0 100 6 3 3 0 000-6zM18 21a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
          {formatNumber(repo.forks)}
        </span>
        {repo.license && (
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2l9 4v6c0 5-3.5 9-9 10-5.5-1-9-5-9-10V6z" />
            </svg>
            {repo.license}
          </span>
        )}
        <span className="ml-auto">{relativeDate(repo.updatedAt)}</span>
      </div>

      {/* topics */}
      {repo.topics?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {repo.topics.slice(0, 4).map((tp) => (
            <span key={tp} className="rounded-[8px] bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-fg-dim">
              {tp}
            </span>
          ))}
        </div>
      )}

      {/* 安装命令 */}
      <div className="mt-auto pt-4">
        <div className="mb-1.5 text-[10px] text-fg-dim">{installLabel}</div>
        <div className="overflow-x-auto rounded-[10px] border border-border-subtle bg-code-bg px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <code className="whitespace-pre font-mono text-[11px] text-fg-secondary">{repo.installCmd}</code>
            <CopyButton text={repo.installCmd} label={t.copy} copiedLabel={t.copied} />
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <a
            href={repo.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-fg-dim transition-colors hover:text-fg-secondary"
          >
            {t.viewGithub}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  )
}
