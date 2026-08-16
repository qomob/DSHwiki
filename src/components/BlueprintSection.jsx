import { useState, useMemo, useEffect } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { UI } from '../i18n/ui.js'
import { BLUEPRINT_PARTS } from '../data/blueprint'

// 顶部阅读进度条：随滚动填充,给出"读到哪了"的反馈
function ScrollProgress({ targetId }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const el = document.getElementById(targetId)
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = el.offsetHeight - window.innerHeight
      if (total <= 0) {
        setProgress(100)
        return
      }
      const scrolled = Math.max(0, -rect.top)
      setProgress(Math.min(100, (scrolled / total) * 100))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [targetId])

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent">
      <div
        className="h-full bg-brand transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

// 可折叠的 PART 区块：默认仅展开第一个,降低认知过载
function PartBlock({ part, t, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div key={part.id} id={part.id}>
      {/* PART 标题条——收拢时紧凑单行,展开时显示完整描述 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full cursor-pointer text-left"
        aria-expanded={open}
      >
        {/* 收拢态:紧凑一行 */}
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border-subtle bg-surface-2 px-4 py-3 transition-colors hover:bg-surface-1">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="shrink-0 font-mono text-xs font-medium tracking-wider"
              style={{ color: part.accent }}
            >
              {part.label}
            </span>
            <span className="truncate text-sm font-medium text-fg">{part.title}</span>
            <span className="hidden shrink-0 items-center gap-1.5 rounded-pill border border-border-subtle bg-surface-1 px-2 py-0.5 text-[11px] text-fg-dim sm:inline-flex">
              {part.chapters.length} {t.chapters}
            </span>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`shrink-0 text-fg-dim transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* 展开态:完整描述 */}
        {open && (
          <div className="mt-3 rounded-[10px] border border-border-subtle bg-surface-1/50 px-4 py-3">
            <p className="text-sm leading-relaxed text-fg-muted">{part.desc}</p>
          </div>
        )}
      </button>

      {/* 章节卡片——展开时显示 */}
      {open && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {part.chapters.map((ch) => {
              const dividerIdx = ch.points.findIndex((p) => /^——/.test(p))
              const hasDivider = dividerIdx !== -1
              const mainPoints = hasDivider ? ch.points.slice(0, dividerIdx) : ch.points
              const advancedPoints = hasDivider ? ch.points.slice(dividerIdx + 1) : []
              const dividerText = hasDivider ? ch.points[dividerIdx] : ''

              return (
                <article
                  key={ch.num}
                  className="ds-card-hover ds-card-highlight flex flex-col rounded-[10px] border border-border-subtle bg-surface-2 p-5"
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-lg font-medium" style={{ color: part.accent }}>
                      {ch.num}
                    </span>
                    <h4 className="text-sm font-medium leading-snug text-fg">{ch.title}</h4>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-fg-muted">{ch.summary}</p>
                  <ul className="mt-3 space-y-1.5">
                    {mainPoints.map((p, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-fg-muted">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: part.accent }} />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  {hasDivider && advancedPoints.length > 0 && (
                    <div className="mt-3 rounded-[8px] border border-border-subtle bg-surface-3 px-3 py-2.5">
                      <div className="text-[10px] text-fg-dim">{dividerText.replace(/^——\s*/, '').replace(/\s*——$/, '')}</div>
                      <ul className="mt-2 space-y-1">
                        {advancedPoints.map((p, i) => (
                          <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-fg-dim">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fg-dim" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* 可复制的对话示例 */}
                  {ch.prompt && (
                    <div className="mt-auto pt-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-fg-dim">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                        {t.promptLabel}
                      </div>
                      <div className="overflow-x-auto rounded-[10px] border border-border-subtle bg-code-bg px-3 py-2">
                        <code className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-fg-secondary">{ch.prompt}</code>
                      </div>
                    </div>
                  )}
                  {/* 命令行示例 */}
                  {ch.cmd && (
                    <div className={`pt-3 ${ch.prompt ? '' : 'mt-auto'}`}>
                      <div className="overflow-x-auto rounded-[10px] border border-border-subtle bg-code-bg px-3 py-2">
                        <code className="whitespace-pre font-mono text-[11px] text-fg-secondary">{ch.cmd}</code>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
      )}

    </div>
  )
}

export default function BlueprintSection() {
  const { lang } = useLang()
  const t = UI[lang].wiki
  const parts = useMemo(() => BLUEPRINT_PARTS[lang], [lang])

  // 默认全部 PART 收拢,点击标题展开
  const [openSet, setOpenSet] = useState(() => new Set())

  // 语言切换时重置(不同语言的 parts 引用不同)
  useEffect(() => {
    setOpenSet(new Set())
  }, [parts])

  return (
    <section id="blueprint" className="relative mx-auto max-w-[1140px] px-5 py-20 sm:py-24">
      <ScrollProgress targetId="blueprint" />

      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-medium uppercase tracking-wider text-fg-dim">{t.label}</span>
        <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-fg sm:text-3xl lg:text-4xl">
          {t.title}
        </h2>
        <p className="mt-5 text-sm leading-relaxed text-fg-muted">{t.lead}</p>
      </div>

      {/* 四步沉淀流 */}
      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {t.flow.map((f, i) => {
          const partAccent = parts[i]?.accent
          return (
            <div key={f.step} className="relative rounded-[10px] border border-border-subtle bg-surface-2 p-4">
              <div className="font-mono text-2xl font-medium" style={{ color: partAccent || 'var(--color-fg-dim)' }}>{f.step}</div>
              <div className="mt-1 text-xs text-fg-secondary">{f.tag}</div>
              <div className="mt-1 text-xs leading-snug text-fg-muted">{f.text}</div>
              {i < t.flow.length - 1 && (
                <span className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-fg-dim sm:block">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* 四段路径——可折叠 */}
      <div className="mt-16 space-y-10">
        {parts.map((part) => (
          <PartBlock key={part.id} part={part} t={t} defaultOpen={openSet.has(part.id)} />
        ))}
      </div>

      {/* 结尾 CTA:承接阅读流到插件区 */}
      <div className="mt-16 rounded-[16px] border border-border-subtle bg-surface-2 px-6 py-8 text-center sm:px-10">
        <h3 className="text-base font-medium text-fg sm:text-lg">{t.ctaTitle}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-muted">{t.ctaDesc}</p>
        <a href="#plugins" className="ds-btn-primary mt-5 inline-flex items-center gap-2 !px-5 !py-2.5 !text-sm">
          {t.ctaBtn}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </a>
      </div>
    </section>
  )
}
