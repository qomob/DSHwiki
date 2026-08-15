// Model-facing text rendering and UI presentation projections.
// render text is what the model reads; presentationMeta/presentResult feed the
// Web UI result card (citeable sources), following the dsh web tools pattern.

function starsLabel(n) {
  if (!Number.isFinite(n)) return ''
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k★`
  return `${n}★`
}

function entryLine(entry, index) {
  const bits = [`**${entry.fullName}**`]
  const meta = [
    starsLabel(entry.stars),
    entry.categoryLabel,
    entry.official ? 'official' : '',
    entry.updatedAt ? `updated ${String(entry.updatedAt).slice(0, 10)}` : '',
  ].filter(Boolean)
  if (meta.length > 0) bits.push(`— ${meta.join(' · ')}`)
  const lines = [`${index}. ${bits.join(' ')}`]
  if (entry.description) lines.push(`   ${entry.description}`)
  if (entry.descriptionZh && entry.descriptionZh !== entry.description) {
    lines.push(`   ${entry.descriptionZh}`)
  }
  if (entry.installCmd) lines.push(`   Install: \`${entry.installCmd}\``)
  lines.push(`   ${entry.url}`)
  return lines.join('\n')
}

// plugin_search canonical value → model-facing markdown.
export function formatSearchOutput(value) {
  const plugins = Array.isArray(value.plugins) ? value.plugins : []
  const header =
    plugins.length === 0
      ? `No dsh plugins matched (source: ${value.source}${value.query ? `, query: "${value.query}"` : ''}${value.category ? `, category: ${value.category}` : ''}).`
      : [
          `Found ${value.returned} of ${value.total} dsh plugins (source: ${value.source}` +
            `${value.query ? `, query: "${value.query}"` : ''}${value.category ? `, category: ${value.categoryLabel || value.category}` : ''}` +
            `${value.truncated ? ', truncated' : ''}).`,
        ].join('')

  const body = plugins.map((p, i) => entryLine(p, i + 1)).join('\n\n')
  const notes = []
  if (value.note) notes.push(value.note)
  notes.push('Install into a named profile with `dsh plugin --profile <name> add "github:<owner>/<repo>"`.')
  return `${header}\n\n${body}${body ? '\n\n' : ''}${notes.map((n) => `> ${n}`).join('\n')}`
}

// plugin_search canonical value → presentation meta for the web result card.
// Must stay lossless JSON (the render text cannot carry structured sources).
export function searchMetaFromValue(value) {
  const plugins = Array.isArray(value.plugins) ? value.plugins : []
  return {
    sources: plugins.map((p) => ({
      url: p.url,
      title: p.fullName,
      snippet: [p.descriptionZh || p.description, p.categoryLabel, starsLabel(p.stars)]
        .filter(Boolean)
        .join(' · '),
    })),
    truncated: Boolean(value.truncated),
  }
}

// plugin_search completed result → web-style search card (citeable sources).
export function presentSearchResult(args, result) {
  if (result.isError) return undefined
  const meta = result.meta
  if (meta === undefined || meta === null || typeof meta !== 'object') return undefined
  const title = args.query || (args.category ? `${args.category}` : 'dsh plugins')
  return {
    card: 'web',
    kind: 'search',
    title: `plugin_search: ${title}`,
    sources: meta.sources,
    truncated: Boolean(meta.truncated),
  }
}

// plugin_info canonical value → model-facing markdown.
export function formatInfoOutput(value) {
  if (!value.found) {
    return `No GitHub repository found for "${value.repo}"${value.note ? ` (${value.note})` : ''}.`
  }
  const p = value.plugin
  const meta = [
    starsLabel(p.stars),
    p.categoryLabel,
    p.official ? 'official' : '',
    p.language,
    p.license,
    p.updatedAt ? `updated ${String(p.updatedAt).slice(0, 10)}` : '',
  ].filter(Boolean)
  const lines = [`**${p.fullName}** — ${meta.join(' · ')}`]
  if (p.description) lines.push(p.description)
  if (p.descriptionZh && p.descriptionZh !== p.description) lines.push(p.descriptionZh)
  if (Array.isArray(p.topics) && p.topics.length > 0) lines.push(`Topics: ${p.topics.join(', ')}`)
  if (p.homepage) lines.push(`Homepage: ${p.homepage}`)
  if (p.installCmd) lines.push(`Install: \`${p.installCmd}\``)
  lines.push(p.url)
  if (value.install !== undefined) {
    lines.push(...renderInstallSection(value.install))
  }
  if (value.source === 'registry') {
    lines.push(`_Source: embedded registry snapshot (${String(value.snapshotAt).slice(0, 10)}). Pass live: true for fresh GitHub data + install verification._`)
  } else if (value.source === 'live') {
    lines.push('_Source: live GitHub API._')
  }
  if (value.note) lines.push(`> ${value.note}`)
  return lines.join('\n')
}

function renderInstallSection(install) {
  const lines = ['', 'Install verification:']
  if (install.tier) lines.push(`- trust tier: \`${install.tier}\`${install.riskSignals?.length ? ' · signals: ' + install.riskSignals.join('; ') : ''}`)
  lines.push(`- kind: \`${install.kind}\` · dsh.bundle manifest: ${install.hasBundle ? 'yes' : 'no'} · client UI: ${install.hasClient ? 'yes' : 'no'} · install-time scripts: ${install.hasPrepare ? 'YES' : 'no'}`)
  if (install.command) lines.push(`- command: \`${install.command}\``)
  for (const risk of install.risks || []) lines.push(`- ⚠ ${risk}`)
  for (const note of install.notes || []) lines.push(`- note: ${note}`)
  return lines
}

// plugin_install canonical value → model-facing markdown.
export function formatInstallOutput(value) {
  const head = `plugin_install ${value.repo} → profile "${value.profile}": ${value.status}`
  const lines = [head]
  if (value.tier) {
    lines.push(`Trust tier: ${value.tier}${value.riskSignals?.length ? ' (' + value.riskSignals.join('; ') + ')' : ''}`)
  }
  if (value.installedAs) {
    lines.push(`Installed as: ${value.installedAs}${value.inBundles ? ' · bundle layer active' : ' · bundle layer NOT detected'}`)
  }
  if (!value.repoFound) {
    lines.push('Repository not found on GitHub.')
  }
  if (value.command) lines.push(`Command: \`${value.command}\``)
  for (const risk of value.risks || []) lines.push(`⚠ ${risk}`)
  for (const note of value.notes || []) lines.push(`· ${note}`)
  if (value.error) lines.push(`Error: ${value.error}`)
  if (value.output) lines.push('', '```', String(value.output).trim(), '```')
  if (Array.isArray(value.nextSteps) && value.nextSteps.length > 0) {
    lines.push('', 'Next:', ...value.nextSteps.map((s) => `- ${s}`))
  }
  return lines.join('\n')
}
