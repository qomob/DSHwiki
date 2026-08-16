import { useLang } from '../i18n/LanguageContext.jsx'
import { UI } from '../i18n/ui.js'

export default function Footer() {
  const { lang } = useLang()
  const t = UI[lang]

  return (
    <footer id="about" className="mt-24 border-t border-border-subtle">
      <div className="mx-auto max-w-[1140px] px-5 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="DSH" width={32} height={32} className="h-8 w-8 brightness-0 invert" />
              <span className="text-sm font-medium text-fg">{t.brand.name}</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-fg-muted">
              {t.footer.desc}
            </p>
            <p className="mt-4 text-xs text-fg-dim">
              {t.footer.unofficial}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-fg-dim">{t.footer.nav}</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="#blueprint" className="text-fg-muted transition-colors hover:text-fg">{t.nav.wiki}</a></li>
              <li><a href="#plugins" className="text-fg-muted transition-colors hover:text-fg">{t.nav.plugins}</a></li>
              <li><a href="#ranking" className="text-fg-muted transition-colors hover:text-fg">{t.nav.ranking}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-fg-dim">{t.footer.resources}</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="https://github.com/deepseek-ai/deepseek-harness" target="_blank" rel="noreferrer" className="text-fg-muted transition-colors hover:text-fg">
                  deepseek-ai/deepseek-harness
                </a>
              </li>
              <li>
                <a href="https://github.com/topics/dsh-plugin" target="_blank" rel="noreferrer" className="text-fg-muted transition-colors hover:text-fg">
                  topic: dsh-plugin
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border-subtle pt-6 text-xs text-fg-dim sm:flex-row">
          <span>{t.footer.source}</span>
          <a
            href="https://www.deepseek.com/harness/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-fg"
          >
            DeepSeek Harness
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </div>
        <div className="mt-3 text-center text-xs text-fg-dim">
          开源 · MIT · © 2026 Qomob.AI
        </div>
      </div>
    </footer>
  )
}
