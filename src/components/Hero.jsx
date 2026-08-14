import { useState } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { UI } from '../i18n/ui.js'

export default function Hero() {
  const { lang } = useLang()
  const t = UI[lang]
  const [tab, setTab] = useState('quick')

  const code =
    tab === 'quick'
      ? 'npx @deepseek-ai/dsh web'
      : 'git clone https://github.com/deepseek-ai/deepseek-harness'

  return (
    <section id="top" className="relative overflow-hidden pt-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-white/[0.03] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1140px] px-5 pb-20 pt-24 sm:pt-32">
        <div className="grid items-center gap-12 lg:grid-cols-[60fr_40fr]">
          {/* 左：文案 */}
          <div>
            <span className="ds-gradient-border inline-flex items-center gap-2 rounded-pill px-3.5 py-1.5 text-xs text-fg-secondary">
              {t.hero.badge}
            </span>

            <h1 className="mt-6 font-display text-[32px] font-medium leading-[1.2] tracking-[0.2px] text-fg sm:text-[46px] lg:text-[56px]">
              {t.hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
              {t.hero.desc}
            </p>
            <p className="mt-3 text-xs text-fg-dim">{t.hero.unofficial}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#plugins" className="ds-btn-primary inline-flex items-center gap-2">
                {t.hero.ctaPlugins}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a href="#blueprint" className="ds-btn-secondary inline-flex items-center gap-2">
                {t.hero.ctaWiki}
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-fg-dim">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/50" />
                {t.hero.feat1}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/50" />
                {t.hero.feat2}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/50" />
                {t.hero.feat3}
              </span>
            </div>
          </div>

          {/* 右：代码卡 */}
          <div className="ds-code-block p-1.5">
            <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-2">
              <button
                type="button"
                onClick={() => setTab('quick')}
                className={`rounded-[8px] px-2.5 py-1 text-xs transition-colors ${
                  tab === 'quick' ? 'bg-surface-raised text-fg' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {t.hero.codeQuick}
              </button>
              <button
                type="button"
                onClick={() => setTab('source')}
                className={`rounded-[8px] px-2.5 py-1 text-xs transition-colors ${
                  tab === 'source' ? 'bg-surface-raised text-fg' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {t.hero.codeSource}
              </button>
            </div>
            <div className="px-4 py-4">
              <div className="overflow-x-auto">
                <code className="block whitespace-pre font-mono text-sm text-fg">
                  <span className="text-fg-muted">$</span> {code}
                </code>
              </div>
              <p className="mt-3 text-xs text-fg-dim">{t.hero.codeHint}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
