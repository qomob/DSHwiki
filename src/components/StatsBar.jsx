import { useLang } from '../i18n/LanguageContext.jsx'
import { UI } from '../i18n/ui.js'

export default function StatsBar({ stats, generatedAt }) {
  const { lang } = useLang()
  const t = UI[lang]

  const items = [
    { label: t.stats.total, value: stats?.total ?? 0 },
    { label: t.stats.stars, value: stats?.totalStars ?? 0 },
    { label: t.stats.cats, value: stats?.categories ?? 0 },
    {
      label: t.stats.date,
      value: generatedAt
        ? new Date(generatedAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')
        : '-',
    },
  ]

  return (
    <section className="relative mx-auto max-w-[1140px] px-5">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-border-subtle bg-border-subtle md:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="bg-bg px-5 py-6 text-center">
            <div className="font-mono text-2xl font-medium text-fg sm:text-3xl">
              {typeof it.value === 'number'
                ? it.value >= 1000
                  ? `${(it.value / 1000).toFixed(0)}k`
                  : it.value
                : it.value}
            </div>
            <div className="mt-1.5 text-xs text-fg-dim">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
