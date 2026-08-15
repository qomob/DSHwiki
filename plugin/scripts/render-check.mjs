// Render smoke: execute the built client bundle's factory exactly like the
// browser module table would, then server-render HubView to catch any
// import/registration/render-time crash that would leave the tab blank.
//
// Also audits every @deepseek-ai/dsh-client-ui-primitives symbol imported by
// client-src: a missing export (e.g. an icon variant that does not exist)
// renders as an undefined element type — a crash that only fires when the
// using branch renders (e.g. after an async refresh fails), which SSR alone
// cannot reach. This gate catches it statically.
//
// Run: node --import ./scripts/render-hooks.mjs scripts/render-check.mjs
// (after npm run build-client)

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToString } from 'react-dom/server'

const nodeRequire = createRequire(import.meta.url)

// --- gate 1: every primitives symbol imported by client-src really exists ---
{
  const src = readFileSync(new URL('../client-src/index.jsx', import.meta.url), 'utf8')
  const m = src.match(/import\s*\{([^}]+)\}\s*from\s*'@deepseek-ai\/dsh-client-ui-primitives'/s)
  if (m === null) {
    console.error('FAIL: no primitives import found in client-src')
    process.exit(1)
  }
  const wanted = m[1].split(',').map((s) => s.trim()).filter(Boolean)
  const primitives = nodeRequire('@deepseek-ai/dsh-client-ui-primitives')
  const missing = wanted.filter((name) => primitives[name] === undefined || primitives[name] === null)
  if (missing.length > 0) {
    console.error(`FAIL: client-src imports nonexistent primitives symbols: ${missing.join(', ')}`)
    console.error('     (an undefined component renders fine until its branch executes, then crashes the view)')
    process.exit(1)
  }
  console.log(`✓ all ${wanted.length} primitives symbols exist (${wanted.filter((n) => n.startsWith('Icon')).length} icons)`)
}

let registered = null
globalThis.window = {
  __ModuleLoader__: {
    load: (mod) => {
      registered = mod
    },
  },
}

nodeRequire(new URL('../client.js', import.meta.url).pathname)
if (registered === null) {
  console.error('FAIL: bundle did not register a module with window.__ModuleLoader__')
  process.exit(1)
}
console.log('✓ module registered:', registered.id)

// The browser require: react from the shell's React, primitives from the
// shell's static module table (simulated with the installed package).
const shellRequire = (name) => {
  if (name === 'react') return React
  if (name === 'react/jsx-runtime') return nodeRequire('react/jsx-runtime')
  if (name.startsWith('@deepseek-ai/dsh-client-ui-primitives')) return nodeRequire(name)
  throw new Error(`unexpected require: ${name}`)
}

const exports = registered.factory(shellRequire)
console.log('✓ factory executed; exports:', Object.keys(exports).join(', '))

if (typeof exports.HubView !== 'function') {
  console.error('FAIL: HubView export missing')
  process.exit(1)
}

const html = renderToString(React.createElement(exports.HubView, {}))
console.log('✓ HubView rendered to string, length:', html.length)
console.log('  contains search placeholder:', html.includes('搜索插件'))
console.log('  contains category chips:', html.includes('原厂核心') || html.includes('全部'))
console.log('  contains plugin cards:', /github\.com/.test(html))
console.log('  contains footer:', html.includes('DSH 工坊') || html.includes('DSH'))

// Also exercise the apply() registration path against a stub slots service
// (the plugin-level inject declares 'slots', so apply may use ctx.slots).
const registered2 = []
const ctx2 = {
  slots: {
    inject: (_key, fn) => {
      fn()
    },
    register: (opts, component) => {
      registered2.push({ opts, component })
    },
  },
}
exports.apply(ctx2)
if (registered2.length !== 1) {
  console.error('FAIL: apply did not register the view', registered2.length)
  process.exit(1)
}
const { opts, component } = registered2[0]
console.log('✓ slot registration:', JSON.stringify({ name: opts.name, id: opts.id, order: opts.order, label: opts.label }))
const viewHtml = renderToString(React.createElement(component, {}))
console.log('✓ registered view renders, length:', viewHtml.length)
console.log('\nRENDER CHECK PASSED')
