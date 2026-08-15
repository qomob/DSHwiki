// dsh-plugin-hub client half — the "插件" marketplace tab in the Web UI's
// conversation view ring (after 对话/轨迹).
//
// Layout mirrors dsh.qomob.ai's plugin hub: a sticky left category sidebar
// (color dot + label + mono count, card container) beside a right column
// whose top row holds search / sort / refresh and whose body is the card
// flow. Collapses to a single column with a horizontal category strip via
// container queries on narrow viewports.
//
// Marketplace behavior: embedded snapshot (offline) + on-open refresh
// (jsDelivr → raw) + installed state via the official pluginInventory
// remote + firstSeenAt-driven 新上架 / staleness signals.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Button,
  Pill,
  Input,
  Toast,
  writeClipboard,
  IconSearchOutline16,
  IconCopyOutline16,
  IconRightUpOutline14,
  IconCheckOutline14,
  IconRefreshOutline14,
  IconCordisPluginOutline14,
  IconChevronDownOutline14,
  IconWarningOutline16,
  IconBranchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import registryData from '../data/registry.json'

// Category taxonomy with the site's color system (dsh.qomob.ai sidebar dots).
const CATEGORIES = [
  { id: 'all', label: '全部', color: '#4d6bfe' },
  { id: 'core', label: '原厂核心', color: '#f5b942' },
  { id: 'orchestration', label: 'Agent 编排', color: '#a78bfa' },
  { id: 'interface', label: '界面交互', color: '#22d3ee' },
  { id: 'terminal', label: '终端 TUI', color: '#34d399' },
  { id: 'skin', label: '主题皮肤', color: '#fb7185' },
  { id: 'vision', label: '感知视觉', color: '#f59e0b' },
  { id: 'memory', label: '记忆检索', color: '#60a5fa' },
  { id: 'workflow', label: '工作流', color: '#c084fc' },
  { id: 'communication', label: '通讯通知', color: '#2dd4bf' },
  { id: 'engineering', label: '工程运维', color: '#94a3b8' },
  { id: 'toolset', label: '通用工具', color: '#facc15' },
  { id: 'skill', label: 'Skill 技能', color: '#f472b6' },
  { id: 'awesome', label: '精选清单', color: '#e879f9' },
  { id: 'extension', label: '扩展生态', color: '#818cf8' },
  { id: 'other', label: '其他', color: '#64748b' },
]

const LANGUAGE_COLORS = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Zig: '#ec915c',
  Lua: '#000080',
}

const REFRESH_URLS = [
  'https://cdn.jsdelivr.net/gh/qomob/dsh@main/plugin/data/registry.json',
  'https://raw.githubusercontent.com/qomob/dsh/main/plugin/data/registry.json',
]

const PAGE_SIZE = 24
const NEW_WITHIN_DAYS = 14
const STALE_AFTER_DAYS = 365

// --- data helpers ----------------------------------------------------------

function tokenize(query) {
  return String(query || '')
    .toLowerCase()
    .split(/[\s,，、/]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function scoreOf(entry, tokens) {
  if (tokens.length === 0) return 0
  const name = String(entry.fullName).toLowerCase()
  const topics = (entry.topics || []).join(' ').toLowerCase()
  const desc = `${entry.description || ''} ${entry.descriptionZh || ''}`.toLowerCase()
  let score = 0
  for (const token of tokens) {
    if (name.includes(token)) score += 6
    else if (topics.includes(token)) score += 4
    else if (desc.includes(token)) score += 2
    else return -1
  }
  if (entry.official) score += 3
  score += Math.log10((entry.stars || 0) + 1)
  return score
}

function daysSince(iso) {
  if (!iso) return Infinity
  const t = Date.parse(iso)
  return Number.isFinite(t) ? (Date.now() - t) / 86400000 : Infinity
}

function formatStars(n) {
  if (!Number.isFinite(n)) return '0'
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatWhen(iso) {
  const d = daysSince(iso)
  if (d === Infinity) return ''
  if (d < 1) return '今天'
  if (d < 2) return '昨天'
  if (d < 30) return `${Math.floor(d)} 天前`
  if (d < 365) return `${Math.floor(d / 30)} 个月前`
  return `${Math.floor(d / 365)} 年前`
}

function isNewcomer(entry) {
  return daysSince(entry.firstSeenAt) <= NEW_WITHIN_DAYS
}

function isStale(entry) {
  return daysSince(entry.updatedAt) >= STALE_AFTER_DAYS
}

function validateRegistryPayload(data) {
  if (data === null || typeof data !== 'object') return null
  if (!Array.isArray(data.plugins) || data.plugins.length === 0) return null
  if (typeof data.generatedAt !== 'string') return null
  for (const p of data.plugins) {
    if (typeof p.fullName !== 'string' || typeof p.url !== 'string') return null
  }
  return data
}

async function fetchFreshRegistry() {
  for (const url of REFRESH_URLS) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) continue
      const data = validateRegistryPayload(await res.json())
      if (data !== null) return data
    } catch {
      // try the next mirror silently
    }
  }
  return null
}

function installCommandOf(entry) {
  if (entry.installCmd) return entry.installCmd
  if (entry.installType === 'awesome') return `git clone ${entry.url}.git`
  if (entry.official) return 'npx @deepseek-ai/dsh web'
  return `dsh plugin add "github:${entry.fullName}"`
}

const PHASE_COLORS = {
  active: 'var(--dsw-alias-state-success-primary)',
  failed: 'var(--dsw-alias-state-error-primary)',
  pending: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
  loading: 'var(--dsw-alias-brand-primary)',
  unloading: 'var(--dsw-alias-state-warn-primary)',
}

const PHASE_LABELS = {
  active: '运行中',
  failed: '加载失败',
  pending: '等待依赖',
  loading: '加载中',
  unloading: '卸载中',
}

// --- styles ----------------------------------------------------------------
// Structural styles live in a class sheet (injected per mount; identical
// rules are harmless) because hover/active and container queries cannot be
// expressed as inline styles. Colors come from --dsw-alias-* tokens so the
// tab follows the shell theme.
//
// Responsive strategy (mirrors the official shell: container queries for the
// panel, media queries as the coarse fallback):
//   · @container hub (width<=680px) — the conversation panel itself is
//     narrow: sidebar collapses into a horizontal strip (same 680px the
//     official settings inventory uses).
//   · @media (width<=720px) — phones / small windows, and the fallback for
//     browsers predating container queries: the same collapse still applies.
//   · @media (hover:hover) — hover states only where hover exists (no sticky
//     hover on touch), matching the conversation package's guard.
//   · @media (pointer:coarse) — larger touch targets for fingers.
//   · @media (prefers-reduced-motion:reduce) — no spin/transition, matching
//     the shell's motion policy.

const STYLE_SHEET = `
.hub-root { container-type: inline-size; container-name: hub; height: 100%; display: flex; flex-direction: column; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-family: inherit; min-height: 0; }
.hub-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 20px 8px; }
.hub-layout { display: grid; grid-template-columns: 172px minmax(0, 1fr); gap: 16px; max-width: 980px; margin: 0 auto; }
.hub-side { position: sticky; top: 0; align-self: start; max-height: calc(100vh - 130px); overflow-y: auto; scrollbar-width: thin; }
.hub-side-card { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 12px; padding: 10px; }
.hub-side-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); padding: 2px 6px 8px; }
.hub-side-nav { display: flex; flex-direction: column; gap: 1px; }
.hub-cat { display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 8px; border: 0; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 12px; text-align: left; cursor: pointer; transition: background .12s ease, color .12s ease; }
.hub-cat-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; display: inline-block; }
.hub-cat-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hub-cat-count { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Cascadia Mono', 'Liberation Mono', 'DejaVu Sans Mono', monospace; font-size: 10px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }
.hub-cat.active { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-weight: 600; }
.hub-cat.active .hub-cat-count { color: var(--dsw-alias-label-secondary); }
.hub-side-sep { height: 1px; background: var(--dsw-alias-border-l1); margin: 8px 4px; }
.hub-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; max-width: 980px; margin: 0 auto 10px; width: 100%; box-sizing: border-box; padding: 0 20px; }
.hub-search { flex: 1 1 240px; min-width: 160px; display: flex; }
.hub-select { padding: 0 8px; height: 28px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 12px; cursor: pointer; }
.hub-meta { font-size: 11.5px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); margin: 0 0 10px; }
.hub-list { display: flex; flex-direction: column; gap: 8px; }
.hub-more { display: flex; justify-content: center; margin: 14px 0 6px; }
.hub-sec { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary); margin: 18px 0 8px; display: flex; align-items: center; gap: 6px; }
.hub-footer { display: flex; align-items: center; gap: 8px; justify-content: center; padding: 10px 0 18px; font-size: 11px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); flex-wrap: wrap; }

/* Hover only where hover exists — no sticky hover on touch devices. */
@media (hover:hover) {
  .hub-cat:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
  .hub-topic:hover { border-style: solid; color: var(--dsw-alias-label-primary); }
}

/* Panel-level collapse. */
@container hub (width<=680px) {
  .hub-layout { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .hub-side { position: static; max-height: none; overflow: visible; }
  .hub-side-card { padding: 8px; }
  .hub-side-nav { display: flex; flex-direction: row; gap: 4px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
  .hub-cat { width: auto; flex: 0 0 auto; padding: 4px 8px; }
  .hub-cat-count { display: none; }
  .hub-side-sep { display: none; }
}

/* Viewport-level collapse: phones, small windows, and the fallback for
   browsers without container-query support (they skip the block above but
   still get the single-column layout from here). */
@media (width<=720px) {
  .hub-layout { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .hub-side { position: static; max-height: none; overflow: visible; }
  .hub-side-card { padding: 8px; }
  .hub-side-nav { display: flex; flex-direction: row; gap: 4px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
  .hub-cat { width: auto; flex: 0 0 auto; padding: 4px 8px; }
  .hub-cat-count { display: none; }
  .hub-side-sep { display: none; }
  .hub-scroll { padding: 12px 12px 8px; }
  .hub-toolbar { padding: 0 12px; }
}

/* Fingers get bigger targets (pointer users keep the compact paddings). */
@media (pointer:coarse) {
  .hub-cat { padding: 8px 10px; }
  .hub-topic { padding: 4px 9px; }
}

.hub-chevron { transition: transform .15s ease; }

/* Respect the user's motion preference, like the shell does. */
@media (prefers-reduced-motion:reduce) {
  .hub-cat { transition: none; }
  .hub-chevron { transition: none; }
  .hub-spin { animation: none !important; }
}
@keyframes dsh-plugin-hub-spin { to { transform: rotate(360deg) } }
`

const css = {
  card: {
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--dsw-alias-border-l1)',
    background: 'var(--dsw-alias-bg-layer-1)',
  },
  cardInstalled: { borderColor: 'var(--dsw-alias-state-success-primary)' },
  cardTop: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  repoLink: {
    fontSize: '13.5px',
    fontWeight: 600,
    color: 'var(--dsw-alias-brand-primary)',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  badgeInstalled: {
    fontSize: '10.5px',
    padding: '1px 7px',
    borderRadius: '999px',
    color: 'var(--dsw-alias-state-success-primary)',
    border: '1px solid var(--dsw-alias-state-success-primary)',
    opacity: 0.9,
    lineHeight: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  badgeNew: {
    fontSize: '10.5px',
    padding: '1px 7px',
    borderRadius: '999px',
    color: 'var(--dsw-alias-brand-primary)',
    border: '1px solid var(--dsw-alias-brand-primary)',
    lineHeight: '16px',
  },
  badgeStale: {
    fontSize: '10.5px',
    padding: '1px 7px',
    borderRadius: '999px',
    color: 'var(--dsw-alias-state-warn-primary)',
    border: '1px solid var(--dsw-alias-state-warn-primary)',
    lineHeight: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
  },
  badgeOfficial: {
    fontSize: '10.5px',
    padding: '1px 7px',
    borderRadius: '999px',
    color: 'var(--dsw-alias-state-success-primary)',
    border: '1px solid var(--dsw-alias-state-success-primary)',
    opacity: 0.9,
    lineHeight: '16px',
  },
  dim: { fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary)' },
  langDot: { width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', flex: '0 0 auto' },
  langWrap: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--dsw-alias-label-secondary)' },
  desc: { marginTop: '7px', fontSize: '12.5px', lineHeight: 1.55 },
  descEn: { marginTop: '3px', fontSize: '12px', lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary)' },
  actions: { marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  topicRow: { marginTop: '9px', display: 'flex', gap: '5px', flexWrap: 'wrap' },
  topic: {
    fontSize: '10.5px',
    padding: '1px 7px',
    borderRadius: '999px',
    border: '1px dashed var(--dsw-alias-border-l2)',
    background: 'transparent',
    color: 'var(--dsw-alias-label-secondary)',
    cursor: 'pointer',
  },
  detail: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px dashed var(--dsw-alias-border-l1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  detailRow: { display: 'flex', gap: '8px', fontSize: '12px', alignItems: 'baseline', flexWrap: 'wrap' },
  detailKey: {
    flex: '0 0 64px',
    color: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))',
    fontSize: '11px',
  },
  cmdBlock: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '11.5px',
    padding: '6px 9px',
    borderRadius: '7px',
    background: 'var(--dsw-alias-bg-layer-2)',
    border: '1px solid var(--dsw-alias-border-l1)',
    wordBreak: 'break-all',
  },
  centerState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    padding: '56px 0 40px',
    color: 'var(--dsw-alias-label-secondary)',
  },
  centerIcon: { opacity: 0.5 },
  centerTitle: { fontSize: '13.5px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
  centerHint: { fontSize: '12px', textAlign: 'center', lineHeight: 1.6 },
  moduleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px dashed var(--dsw-alias-border-l1)',
    fontSize: '12px',
    color: 'var(--dsw-alias-label-secondary)',
    flexWrap: 'wrap',
  },
  phaseDot: { width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block', flex: '0 0 auto' },
  secHint: { fontWeight: 400, fontSize: '11px' },
  warnInline: { display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--dsw-alias-state-warn-primary)' },
  metaDot: { display: 'inline-block', verticalAlign: 'middle', marginRight: '5px', borderRadius: '50%', width: '8px', height: '8px' },
}

// --- components ------------------------------------------------------------

function CopyButton({ text, size = 'sm' }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(undefined)
  useEffect(() => () => clearTimeout(timerRef.current), [])
  const onCopy = useCallback(async () => {
    const ok = await writeClipboard(text)
    if (ok) {
      setCopied(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1600)
    }
  }, [text])
  return (
    <Button
      variant="outline"
      size={size}
      icon={copied ? <IconCheckOutline14 /> : <IconCopyOutline16 />}
      onClick={onCopy}
      aria-label={`复制安装命令：${text}`}
    >
      {copied ? '已复制' : '复制安装命令'}
    </Button>
  )
}

function ExternalLink({ url, title }) {
  return (
    <a
      style={css.repoLink}
      href={url}
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={`在 GitHub 打开 ${title}`}
    >
      {title}
      <IconRightUpOutline14 size={12} />
    </a>
  )
}

function DetailRow({ label, children }) {
  return (
    <div style={css.detailRow}>
      <span style={css.detailKey}>{label}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  )
}

function PluginCard({ entry, installedPhase, expanded, onToggleExpanded, onTopicClick }) {
  const zh = entry.descriptionZh || ''
  const en = entry.description || ''
  const cmd = installCommandOf(entry)
  const topics = (entry.topics || []).slice(0, 6)
  const langColor = LANGUAGE_COLORS[entry.language]
  const when = formatWhen(entry.updatedAt)
  const installed = installedPhase !== undefined
  const newcomer = isNewcomer(entry)
  const stale = isStale(entry)

  return (
    <div style={{ ...css.card, ...(installed ? css.cardInstalled : null) }}>
      <div style={css.cardTop}>
        <ExternalLink url={entry.url} title={entry.fullName} />
        {installed ? (
          <span style={css.badgeInstalled} title={PHASE_LABELS[installedPhase] || '已安装'}>
            <span
              style={{
                ...css.phaseDot,
                background: PHASE_COLORS[installedPhase] || PHASE_COLORS.pending,
              }}
            />
            已安装
          </span>
        ) : null}
        {entry.official ? <span style={css.badgeOfficial}>official</span> : null}
        {newcomer ? <span style={css.badgeNew}>新上架</span> : null}
        {stale ? (
          <span style={css.badgeStale} title={`最后更新 ${formatWhen(entry.updatedAt)}`}>
            <IconWarningOutline16 size={10} />
            久未更新
          </span>
        ) : null}
        <span style={css.dim}>★ {formatStars(entry.stars ?? 0)}</span>
        {when ? (
          <span style={css.dim} title={`最后更新 ${entry.updatedAt ? String(entry.updatedAt).slice(0, 10) : ''}`}>
            更新 {when}
          </span>
        ) : null}
        {entry.language ? (
          <span style={css.langWrap}>
            <span style={{ ...css.langDot, background: langColor || 'var(--dsw-alias-border-l2)' }} />
            {entry.language}
          </span>
        ) : null}
        <span style={{ marginLeft: 'auto' }}>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            aria-label={expanded ? '收起详情' : '展开详情'}
            onClick={onToggleExpanded}
          >
            详情
            <span className="hub-chevron" style={{ display: 'inline-flex', transform: expanded ? 'rotate(180deg)' : 'none' }}>
              <IconChevronDownOutline14 size={12} />
            </span>
          </Button>
        </span>
      </div>

      {zh ? <div style={css.desc}>{zh}</div> : null}
      {en && en !== zh ? <div style={css.descEn}>{en}</div> : null}

      {topics.length > 0 ? (
        <div style={css.topicRow}>
          {topics.map((t) => (
            <button key={t} type="button" className="hub-topic" style={css.topic} onClick={() => onTopicClick(t)} title={`按 topic "${t}" 过滤`}>
              {t}
            </button>
          ))}
        </div>
      ) : null}

      <div style={css.actions}>
        <CopyButton text={cmd} />
      </div>

      {expanded ? (
        <div style={css.detail}>
          <DetailRow label="安装">
            <code style={css.cmdBlock}>{cmd}</code>
          </DetailRow>
          <DetailRow label="分类">{entry.category || 'other'}</DetailRow>
          <DetailRow label="许可证">{entry.license || '未声明'}</DetailRow>
          <DetailRow label="更新">
            {entry.updatedAt ? `${String(entry.updatedAt).slice(0, 10)}（${formatWhen(entry.updatedAt) || '未知'}）` : '未知'}
          </DetailRow>
          {entry.homepage ? (
            <DetailRow label="主页">
              <a style={{ ...css.repoLink, fontSize: '12px' }} href={entry.homepage} target="_blank" rel="noreferrer">
                {entry.homepage}
                <IconRightUpOutline14 size={11} />
              </a>
            </DetailRow>
          ) : null}
          <div style={{ ...css.detailRow, color: 'var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))', fontSize: '11px' }}>
            {installed
              ? '已在当前 profile 中；升级用 dsh plugin 重新 add，管理见 设置 → 插件。'
              : '复制命令到终端执行；或在对话里说「安装 github:owner/repo」，agent 会先核验 manifest 与安装脚本风险，再经你确认执行。'}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CenterState({ icon, title, hint, action }) {
  return (
    <div style={css.centerState}>
      <span style={css.centerIcon}>{icon}</span>
      <div style={css.centerTitle}>{title}</div>
      {hint ? <div style={css.centerHint}>{hint}</div> : null}
      {action || null}
    </div>
  )
}

// One sidebar navigation row: color dot + label + mono count (site pattern).
function CategoryButton({ label, color, count, active, onClick, title }) {
  return (
    <button type="button" className={`hub-cat${active ? ' active' : ''}`} onClick={onClick} aria-current={active ? 'true' : undefined} title={title}>
      <span className="hub-cat-dot" style={{ background: color }} />
      <span className="hub-cat-name">{label}</span>
      {count !== undefined ? <span className="hub-cat-count">{count}</span> : null}
    </button>
  )
}

// --- the marketplace view --------------------------------------------------

export function HubView({ listInstalled }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('relevance')
  const [onlyInstalled, setOnlyInstalled] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [expandedKey, setExpandedKey] = useState(null)
  const [data, setData] = useState(() => ({
    plugins: Array.isArray(registryData.plugins) ? registryData.plugins : [],
    generatedAt: registryData.generatedAt || '',
    origin: 'embedded',
  }))
  const [refreshing, setRefreshing] = useState(true)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [installed, setInstalled] = useState(null) // Map<moduleName, phase> | null
  const [toast, setToast] = useState(null)

  const loadInstalled = useCallback(async () => {
    if (typeof listInstalled !== 'function') return
    try {
      const entries = await listInstalled()
      const map = new Map()
      for (const e of entries || []) {
        if (e && typeof e.moduleName === 'string') map.set(e.moduleName, e.fiberPhase ?? null)
      }
      setInstalled(map)
    } catch {
      setInstalled(null) // remote unavailable — installed state unknown
    }
  }, [listInstalled])

  const doRefresh = useCallback(() => {
    let cancelled = false
    setRefreshing(true)
    setRefreshFailed(false)
    fetchFreshRegistry()
      .then((fresh) => {
        if (cancelled) return
        if (fresh !== null) {
          setData({ plugins: fresh.plugins, generatedAt: fresh.generatedAt, origin: 'refreshed' })
        } else {
          setRefreshFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) setRefreshFailed(true)
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false)
      })
    void loadInstalled()
    return () => {
      cancelled = true
    }
  }, [loadInstalled])

  useEffect(doRefresh, [doRefresh])

  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [query, category, sort, onlyInstalled])

  const phaseOf = useCallback(
    (entry) => {
      if (installed === null) return undefined
      if (installed.has(entry.fullName)) return installed.get(entry.fullName)
      const repo = String(entry.fullName).split('/')[1] || ''
      return installed.has(repo) ? installed.get(repo) : undefined
    },
    [installed],
  )

  const untrackedInstalled = useMemo(() => {
    if (installed === null) return []
    const known = new Set()
    for (const p of data.plugins) {
      known.add(p.fullName)
      known.add(String(p.fullName).split('/')[1] || '')
    }
    const out = []
    for (const [moduleName, phase] of installed) {
      if (moduleName.startsWith('@deepseek-ai/')) continue
      if (moduleName.startsWith('.') || moduleName.startsWith('/')) continue
      if (known.has(moduleName)) continue
      out.push({ moduleName, phase })
    }
    return out.sort((a, b) => a.moduleName.localeCompare(b.moduleName))
  }, [installed, data.plugins])

  const counts = useMemo(() => {
    const map = new Map()
    for (const p of data.plugins) {
      const c = p.category || 'other'
      map.set(c, (map.get(c) || 0) + 1)
    }
    return map
  }, [data.plugins])

  const installedCount = useMemo(() => {
    if (installed === null) return null
    let n = 0
    for (const p of data.plugins) if (phaseOf(p) !== undefined) n += 1
    return n + untrackedInstalled.length
  }, [data.plugins, phaseOf, untrackedInstalled])

  const results = useMemo(() => {
    const tokens = tokenize(query)
    let matched = data.plugins
      .map((entry) => ({ entry, score: scoreOf(entry, tokens) }))
      .filter((m) => m.score >= 0)
    if (category !== 'all') matched = matched.filter((m) => (m.entry.category || 'other') === category)
    if (onlyInstalled) matched = matched.filter((m) => phaseOf(m.entry) !== undefined)
    if (sort === 'stars') matched.sort((a, b) => (b.entry.stars || 0) - (a.entry.stars || 0))
    else if (sort === 'updated') matched.sort((a, b) => daysSince(a.entry.updatedAt) - daysSince(b.entry.updatedAt))
    else if (sort === 'newest') matched.sort((a, b) => daysSince(a.entry.firstSeenAt) - daysSince(b.entry.firstSeenAt))
    else {
      matched.sort(
        (a, b) =>
          b.score - a.score ||
          (b.entry.stars || 0) - (a.entry.stars || 0) ||
          daysSince(a.entry.updatedAt) - daysSince(b.entry.updatedAt),
      )
    }
    return matched.map((m) => m.entry)
  }, [data.plugins, query, category, sort, onlyInstalled, phaseOf])

  const visible = results.slice(0, limit)
  const hasFilter = query !== '' || category !== 'all' || onlyInstalled
  const activeCategory = CATEGORIES.find((c) => c.id === category)

  const onTopicClick = useCallback((topic) => {
    setQuery((q) => (q.includes(topic) ? q : `${q} ${topic}`.trim()))
  }, [])

  const clearFilters = useCallback(() => {
    setQuery('')
    setCategory('all')
    setOnlyInstalled(false)
  }, [])

  return (
    <div className="hub-root">
      <style>{STYLE_SHEET}</style>

      {/* 顶栏：搜索 + 排序 + 刷新 */}
      <div className="hub-toolbar">
        <span className="hub-search">
          <Input
            style={{ width: '100%' }}
            value={query}
            placeholder="搜索插件：名称 / 简介 / topics…"
            onChange={(e) => setQuery(e.target.value)}
            icon={<IconSearchOutline16 size={14} />}
            aria-label="搜索 dsh 插件"
          />
        </span>
        <select className="hub-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="排序方式">
          <option value="relevance">相关度</option>
          <option value="stars">星标</option>
          <option value="updated">最近更新</option>
          <option value="newest">新上架</option>
        </select>
        <Button
          variant="ghost"
          size="sm"
          aria-label="刷新插件目录"
          title={refreshing ? '刷新中…' : '刷新目录与已装状态'}
          onClick={doRefresh}
        >
          <span className="hub-spin" style={{ display: 'inline-flex', animation: refreshing ? 'dsh-plugin-hub-spin 1s linear infinite' : 'none' }}>
            <IconRefreshOutline14 size={13} />
          </span>
        </Button>
      </div>

      <div className="hub-scroll">
        <div className="hub-layout">
          {/* 左：粘性分类侧边栏（站点同款：色点 + 标签 + mono 计数） */}
          <aside className="hub-side">
            <div className="hub-side-card">
              <div className="hub-side-label">分类</div>
              <nav className="hub-side-nav" aria-label="插件分类">
                <CategoryButton
                  label="全部"
                  color="#4d6bfe"
                  count={data.plugins.length}
                  active={category === 'all' && !onlyInstalled}
                  onClick={() => {
                    setCategory('all')
                    setOnlyInstalled(false)
                  }}
                />
                {CATEGORIES.filter((c) => c.id !== 'all').map((c) => {
                  const count = counts.get(c.id) || 0
                  if (count === 0) return null
                  return (
                    <CategoryButton
                      key={c.id}
                      label={c.label}
                      color={c.color}
                      count={count}
                      active={category === c.id && !onlyInstalled}
                      onClick={() => {
                        setCategory(c.id)
                        setOnlyInstalled(false)
                      }}
                    />
                  )
                })}
                {installedCount !== null && installedCount > 0 ? (
                  <>
                    <div className="hub-side-sep" />
                    <button
                      type="button"
                      className={`hub-cat${onlyInstalled ? ' active' : ''}`}
                      onClick={() => setOnlyInstalled((v) => !v)}
                      aria-pressed={onlyInstalled}
                      title="只看当前 profile 已安装的"
                    >
                      <span className="hub-cat-dot" style={{ background: 'var(--dsw-alias-state-success-primary)' }} />
                      <span className="hub-cat-name">已安装</span>
                      <span className="hub-cat-count">{installedCount}</span>
                    </button>
                  </>
                ) : null}
              </nav>
            </div>
          </aside>

          {/* 右：结果计数 + 卡片流 */}
          <div style={{ minWidth: 0 }}>
            <p className="hub-meta">
              {activeCategory && category !== 'all' ? (
                <span>
                  <span className="hub-cat-dot" style={{ ...css.metaDot, background: activeCategory.color }} />
                  {activeCategory.label} ·{' '}
                </span>
              ) : null}
              {results.length} 个插件
              {query ? ` · 「${query}」` : ''}
              {onlyInstalled ? ' · 仅已安装' : ''}
              {results.length > visible.length ? ` · 显示前 ${visible.length}` : ''}
              {installed === null ? ' · 已装状态未知' : ''}
            </p>

            {visible.length === 0 ? (
              <CenterState
                icon={<IconCordisPluginOutline14 size={28} />}
                title={hasFilter ? '没有匹配的插件' : '目录为空'}
                hint={
                  hasFilter
                    ? '换个关键词试试，或清除筛选后浏览全部。'
                    : '内嵌快照不可用；点击上方刷新按钮重试，或在对话中让 agent 用 plugin_search 搜索。'
                }
                action={
                  hasFilter ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      清除筛选
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div className="hub-list">
                {visible.map((entry) => (
                  <PluginCard
                    key={entry.fullName}
                    entry={entry}
                    installedPhase={phaseOf(entry)}
                    expanded={expandedKey === entry.fullName}
                    onToggleExpanded={() => setExpandedKey((k) => (k === entry.fullName ? null : entry.fullName))}
                    onTopicClick={onTopicClick}
                  />
                ))}
              </div>
            )}

            {results.length > visible.length ? (
              <div className="hub-more">
                <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                  加载更多（还有 {results.length - visible.length} 个）
                </Button>
              </div>
            ) : null}

            {untrackedInstalled.length > 0 ? (
              <>
                <div className="hub-sec">
                  已安装 · 不在目录（{untrackedInstalled.length}）
                  <span style={css.secHint}>当前 profile 中的社区组合包</span>
                </div>
                <div className="hub-list">
                  {untrackedInstalled.map(({ moduleName, phase }) => (
                    <div key={moduleName} style={css.moduleRow}>
                      <span style={{ ...css.phaseDot, background: PHASE_COLORS[phase] || PHASE_COLORS.pending }} />
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{moduleName}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '11px' }}>{PHASE_LABELS[phase] || '未知状态'}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <div className="hub-footer">
              <span>
                共 {data.plugins.length} 个 · 数据 {String(data.generatedAt).slice(0, 10) || '未知'}
                {data.origin === 'refreshed' ? ' · 已在线更新' : ' · 内嵌快照'}
              </span>
              {refreshFailed ? (
                <span style={css.warnInline}>
                  <IconWarningOutline16 size={11} />
                  在线刷新失败，展示本地数据
                </span>
              ) : null}
              <span>·</span>
              <a style={{ color: 'inherit' }} href="https://dsh.qomob.ai" target="_blank" rel="noreferrer">
                DSH 工坊 ↗
              </a>
              <span>·</span>
              <a
                style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                href="https://github.com/qomob/dsh"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub 仓库 qomob/dsh"
              >
                <IconBranchOutline16 size={11} />
                qomob/dsh
              </a>
            </div>
          </div>
        </div>
      </div>

      {toast !== null ? <Toast key={toast.seq} text={toast.text} onDone={() => setToast(null)} /> : null}
    </div>
  )
}

export const name = 'dsh-plugin-hub-client'

// Wait for the client slots service and the typed remote (pluginInventory)
// before applying — mirrors the official ui-trajectory / settings patterns.
// Without inject the fiber can activate before the services exist and
// silently register nothing, leaving the tab blank.
export const inject = ['slots', 'remote']

export function apply(ctx) {
  // Installed-bundle reader over the official pluginInventory remote — the
  // same API the Plugins settings page uses. Failures degrade to "unknown".
  const listInstalled = async () => {
    const result = await ctx.remote.pluginInventory.list()
    if (!result.ok) {
      throw new Error(`pluginInventory.list failed: ${result.error?.code}: ${result.error?.message}`)
    }
    return result.value?.entries ?? []
  }

  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      { name: 'conversation.view', id: 'plugin-hub', order: 20, label: '插件' },
      (props) => React.createElement(HubView, { ...props, listInstalled }),
    ),
  )
}
