// Raw CDP screenshot driver for the plugin tab preview (puppeteer 25.x is
// incompatible with Chrome 151's frame attachment, so we drive CDP directly).
//
// 1. Reads the shell's real --dsw-alias-* tokens from the running Web UI.
// 2. Renders the tab preview harness (collapsed + expanded, dark + light).
// 3. Saves PNGs to docs/screenshots/.
//
// Run: node scripts/screenshot.mjs   (requires the dsh Web UI on :3080 and
// the preview bundle built: npm run build-preview)

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'screenshots')
mkdirSync(OUT, { recursive: true })

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const CDP_PORT = 9333
const APP_URL = 'http://127.0.0.1:3080'
const PREVIEW = `file://${join(ROOT, 'docs', 'screenshots', 'preview.html')}?theme=`

const TOKENS = [
  'bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-overlay',
  'border-l1', 'border-l2',
  'label-primary', 'label-secondary', 'label-tertiary',
  'brand-primary',
  'state-success-primary', 'state-error-primary', 'state-warn-primary',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launchChrome() {
  const proc = spawn(CHROME, [
    '--headless', `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=/tmp/dsh-preview-chrome',
    '--no-sandbox', '--disable-gpu', '--disable-crashpad',
    '--disable-first-run', '--no-default-browser-check',
    '--window-size=960,900', 'about:blank',
  ], { stdio: 'ignore' })
  // wait for the debugging endpoint
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
      if (res.ok) return proc
    } catch { /* not up yet */ }
    await sleep(300)
  }
  throw new Error('Chrome debugging endpoint did not come up')
}

async function connectPage() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page) return new CdpClient(page.webSocketDebuggerUrl)
    } catch { /* retry */ }
    await sleep(300)
  }
  throw new Error('no page target')
}

class CdpClient {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 0
    this.pending = new Map()
    this.events = []
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
      } else if (msg.method) {
        this.events.push(msg)
      }
    })
  }
  async open() {
    if (this.ws.readyState === 1) return
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true })
      this.ws.addEventListener('error', rej, { once: true })
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  close() { try { this.ws.close() } catch {} }
}

async function evalJs(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text))
  return r.result.value
}

async function screenshot(cdp, file) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(file, Buffer.from(r.data, 'base64'))
  console.log('saved', file)
}

async function navigate(cdp, url) {
  console.log('   nav: enable…')
  await cdp.send('Page.enable').catch((e) => console.log('   Page.enable ERR', e.message))
  await cdp.send('Runtime.enable').catch((e) => console.log('   Runtime.enable ERR', e.message))
  console.log('   nav: navigate', url.slice(0, 60))
  await cdp.send('Page.navigate', { url })
  console.log('   nav: waiting…')
  await sleep(4200)
  console.log('   nav: bringToFront')
  await cdp.send('Page.bringToFront').catch(() => {})
  await sleep(600)
  console.log('   nav: done')
}

async function main() {
  console.log('A: main start')
  await launchChrome()
  console.log('B: chrome up')
  const cdp = await connectPage()
  await cdp.open()
  console.log('C: page attached')

  // 1) read real tokens from the live app
  console.log('D: navigate app')
  await navigate(cdp, APP_URL)
  console.log('E: app loaded')
  const readTokensExpr = `(() => {
    const out = {}
    // the shell may apply tokens on documentElement, body, or the app root div
    const cands = [document.documentElement, document.body, document.querySelector('#root')]
    for (const el of cands) {
      if (!el) continue
      const cs = getComputedStyle(el)
      const found = {}
      for (const n of ${JSON.stringify(TOKENS)}) { const v = cs.getPropertyValue('--dsw-alias-' + n).trim(); if (v) found[n] = v }
      if (Object.keys(found).length >= 6) Object.assign(out, found)
    }
    return out
  })()`
  const dark = await evalJs(cdp, readTokensExpr)

  // try to flip to light (settings appearance toggle is React; attempt known labels)
  let light = null
  for (const sel of ['[aria-label*="theme" i]', '[aria-label*="外观"]', '[aria-label*="主题"]', 'button[aria-label*="light" i]']) {
    try {
      const found = await evalJs(cdp, `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true })()`)
      if (found) {
        await sleep(1200)
        const l = await evalJs(cdp, readTokensExpr)
        if (l['bg-base'] && l['bg-base'] !== dark['bg-base']) { light = l; break }
      }
    } catch { /* next */ }
  }
  // The running shell's effective theme (authentic) becomes the light set;
  // dark stays the approximation the preview falls back to.
  writeFileSync(join(OUT, 'theme.json'), JSON.stringify({ url: APP_URL, light: dark, dark: null }, null, 2))
  console.log('authentic tokens:', JSON.stringify(dark))

  // 2) preview screenshots
  const viewportExpr = (w, h) => `(() => { window.resizeTo(${w},${h}); return true })()`
  const expandExpr = `(() => { const b = document.querySelector('button[aria-label*="详情"]'); if (b) { b.click(); return true } return false })()`

  // authentic (light) collapsed + expanded
  await navigate(cdp, PREVIEW + 'light')
  await evalJs(cdp, viewportExpr(960, 900))
  await sleep(800)
  await screenshot(cdp, join(OUT, 'tab-light-collapsed.png'))
  const expanded = await evalJs(cdp, expandExpr)
  await sleep(600)
  await screenshot(cdp, join(OUT, 'tab-light-detail.png'))
  console.log('expanded click ok:', expanded)

  // dark approximation
  await navigate(cdp, PREVIEW + 'dark')
  await evalJs(cdp, viewportExpr(960, 900))
  await sleep(800)
  await screenshot(cdp, join(OUT, 'tab-dark-collapsed.png'))

  cdp.close()
  console.log('done')
  process.exit(0)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
