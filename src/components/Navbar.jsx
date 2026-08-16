import { useEffect, useState } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { UI } from '../i18n/ui.js'

// 社群菜单：桌面 hover 弹出微信二维码；点击同样可切换（触屏兜底）。
function CommunityPopover({ show, onHover, onToggle }) {
  const { lang } = useLang()
  const t = UI[lang].nav
  const hint = lang === 'zh' ? '微信扫码加入社群' : 'Scan to join the WeChat group'
  return (
    <div className="relative" onMouseEnter={onHover(true)} onMouseLeave={onHover(false)}>
      <a
        href="#community"
        onClick={(e) => {
          e.preventDefault()
          onToggle()
        }}
        className="inline-block rounded-[8px] px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-1 hover:text-fg"
        aria-haspopup="true"
        aria-expanded={show}
      >
        {t.community}
      </a>
      {show && (
        <div className="absolute right-0 top-full z-40 mt-2 w-44 rounded-[12px] border border-border-subtle bg-surface-2 p-3 text-center shadow-lg">
          <img
            src="/wechat.jpg"
            alt={hint}
            width={140}
            height={140}
            className="mx-auto h-[140px] w-[140px] rounded-[8px]"
            loading="lazy"
          />
          <p className="mt-2 text-xs text-fg-muted">{hint}</p>
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { lang, toggle } = useLang()
  const t = UI[lang]
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [communityOpen, setCommunityOpen] = useState(false)

  const navItems = [
    { href: '#plugins', label: t.nav.plugins },
    { href: '#blueprint', label: t.nav.wiki },
    { href: '#ranking', label: t.nav.ranking },
    { href: '#about', label: t.nav.about },
  ]

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const hover = (v) => () => setCommunityOpen(v)
  const toggleCommunity = () => setCommunityOpen((v) => !v)

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'ds-glass border-b border-border-subtle bg-bg/80'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="DSH" width={32} height={32} className="h-8 w-8 brightness-0 invert" />
          <span className="flex flex-col leading-none">
            <span className="text-sm font-medium text-fg">{t.brand.name}</span>
            <span className="text-[10px] text-fg-dim">{t.brand.tagline}</span>
          </span>
        </a>

        {/* 桌面导航：页面锚点 + 社群 hover 弹层 */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((it) => (
            <a
              key={it.href}
              href={it.href}
              className="rounded-[8px] px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-1 hover:text-fg"
            >
              {it.label}
            </a>
          ))}
          <CommunityPopover show={communityOpen} onHover={hover} onToggle={toggleCommunity} />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="rounded-pill border border-border-subtle px-3 py-1.5 text-xs text-fg-muted transition-colors hover:bg-surface-1 hover:text-fg"
            aria-label="Toggle language"
          >
            {lang === 'zh' ? 'EN' : '中'}
          </button>
          <a
            href="https://github.com/qomob/dsh"
            target="_blank"
            rel="noreferrer"
            className="ds-btn-secondary hidden items-center gap-1.5 !px-3.5 !py-1.5 !text-xs sm:flex"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-[8px] border border-border-subtle text-fg-muted md:hidden"
            aria-label="Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {/* 移动端菜单：锚点 + 社群（点击展开二维码，复用同一组件） */}
      {open && (
        <div className="border-t border-border-subtle bg-bg/95 px-5 py-3 md:hidden">
          {navItems.map((it) => (
            <a
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className="block rounded-[8px] px-3 py-2.5 text-sm text-fg-muted hover:bg-surface-1 hover:text-fg"
            >
              {it.label}
            </a>
          ))}
          <div className="mt-1">
            <CommunityPopover show={communityOpen} onHover={hover} onToggle={toggleCommunity} />
          </div>
        </div>
      )}
    </header>
  )
}
