// Preview harness entry: mounts the REAL HubView (same source the shipped
// client.js bundles) with real registry data and a stubbed installed set, so
// screenshots are faithful renderings of the production component.
// Loads docs/screenshots/theme.json (extracted from the live shell) and
// applies the requested theme's --dsw-alias-* tokens before rendering.

import React from 'react'
import { createRoot } from 'react-dom/client'
import { HubView } from '../client-src/index.jsx'

const params = new URLSearchParams(location.search)
const theme = params.get('theme') || 'dark'

const FALLBACK = {
  dark: {
    'bg-base': '#0a0a0a', 'bg-layer-1': '#141414', 'bg-layer-2': '#1e1e1e', 'bg-overlay': '#181818',
    'border-l1': 'rgba(255,255,255,0.08)', 'border-l2': 'rgba(255,255,255,0.16)',
    'label-primary': '#f2f2f2', 'label-secondary': 'rgba(255,255,255,0.66)', 'label-tertiary': 'rgba(255,255,255,0.42)',
    'brand-primary': '#4d6bfe', 'state-success-primary': '#22c55e', 'state-error-primary': '#ef4444', 'state-warn-primary': '#f59e0b',
  },
  light: {
    'bg-base': '#fafafa', 'bg-layer-1': '#ffffff', 'bg-layer-2': '#f0f0f0', 'bg-overlay': '#ffffff',
    'border-l1': 'rgba(0,0,0,0.10)', 'border-l2': 'rgba(0,0,0,0.18)',
    'label-primary': '#18181b', 'label-secondary': 'rgba(0,0,0,0.62)', 'label-tertiary': 'rgba(0,0,0,0.40)',
    'brand-primary': '#4d6bfe', 'state-success-primary': '#16a34a', 'state-error-primary': '#dc2626', 'state-warn-primary': '#d97706',
  },
}

// Installed-state stub so the screenshot shows the 已安装 badge + dot.
const installed = new Map([
  ['dsh-plugin-hub', 'active'],
  ['zhu1090093659/dsh-web-ui', 'active'],
  ['dsh-tui/dsh-tui', 'failed'],
])

async function boot() {
  let tokens = FALLBACK[theme] || FALLBACK.dark
  try {
    const res = await fetch('./theme.json')
    if (res.ok) {
      const t = await res.json()
      if (t[theme]) tokens = { ...tokens, ...t[theme] }
    }
  } catch { /* fallback */ }
  const el = document.documentElement
  for (const [k, v] of Object.entries(tokens)) {
    if (v) el.style.setProperty(`--dsw-alias-${k}`, v)
  }
  el.dataset.theme = theme

  const root = createRoot(document.getElementById('root'))
  root.render(React.createElement(HubView, { listInstalled: async () => installed }))
  window.__previewReady = true
}

boot()
