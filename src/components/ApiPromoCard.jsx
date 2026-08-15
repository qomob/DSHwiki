import { useState } from 'react'
import { useLang } from '../i18n/LanguageContext.jsx'
import { UI } from '../i18n/ui.js'
import { API_PROVIDERS } from '../data/promos'
import AdBadge from './AdBadge'

// API 分销推荐位：嵌在手册 PART 01 章节末尾——用户刚学到"要配 API Key"的环节，转化意图最高
// 带推广标识与佣金披露；env 变量名与站内聚合管道一致
export default function ApiPromoCard() {
  const { lang } = useLang()
  const t = UI[lang].wiki
  const [activeId, setActiveId] = useState(API_PROVIDERS[0].id)
  const p = API_PROVIDERS.find((x) => x.id === activeId) || API_PROVIDERS[0]
  const keyPlaceholder = lang === 'zh' ? 'sk-你的密钥' : 'sk-your-key'

  return (
    <div className="mt-4 rounded-[10px] border border-brand/40 bg-surface-2 p-5">
      {/* 标题 + 推广标识 */}
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-fg">{t.apiPromoTitle}</h4>
        <AdBadge label={t.apiPromoAd} />
      </div>

      {/* 供应商切换 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {API_PROVIDERS.map((x) => {
          const active = x.id === p.id
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setActiveId(x.id)}
              className={`rounded-pill border px-3 py-1 text-xs transition-colors ${
                active
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-border-subtle text-fg-muted hover:text-fg'
              }`}
            >
              {x.name}
            </button>
          )
        })}
      </div>

      {/* 关键信息 */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] text-fg-dim">{t.apiPromoModel}</div>
          <div className="mt-1 truncate font-mono text-xs text-fg-secondary" title={p.model}>{p.model}</div>
        </div>
        <div>
          <div className="text-[10px] text-fg-dim">{t.apiPromoPrice}</div>
          <div className="mt-1 truncate text-xs text-fg-secondary">{p.price[lang]}</div>
        </div>
        <div>
          <div className="text-[10px] text-fg-dim">{t.apiPromoBonus}</div>
          <div className="mt-1 truncate text-xs text-fg-secondary">{p.bonus[lang]}</div>
        </div>
      </div>

      {/* 环境变量示例——与聚合管道实际用到的变量名一致 */}
      <div className="mt-4 overflow-x-auto rounded-[10px] border border-border-subtle bg-code-bg px-3 py-2.5">
        <code className="whitespace-pre font-mono text-[11px] leading-relaxed text-fg-secondary">
{`export LLM_API_KEY=${keyPlaceholder}
export LLM_API_BASE=`}<span className="text-brand">{p.baseUrl}</span>{`
export LLM_MODEL=`}<span className="text-brand">{p.model}</span>
        </code>
      </div>

      {/* CTA + 佣金披露 */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href={p.url}
          target="_blank"
          rel={p.affiliate ? 'noreferrer sponsored' : 'noreferrer'}
          className="ds-btn-primary !px-4 !py-2 !text-xs"
        >
          {t.apiPromoCta}
        </a>
        <span className="text-[11px] leading-relaxed text-fg-dim">{t.apiPromoDisclosure}</span>
      </div>
      <div className="mt-1.5 text-[10px] text-fg-dim">{t.apiPromoNote}</div>
    </div>
  )
}
