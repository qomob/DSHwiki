// Extract the shell's real --dsw-alias-* token values from the running Web UI.
// Writes docs/screenshots/theme.json for the preview harness.
import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'node:fs'

const URL = process.argv[2] || 'http://127.0.0.1:3080'
const TOKENS = [
  'bg-base', 'bg-layer-1', 'bg-layer-2', 'bg-overlay',
  'border-l1', 'border-l2',
  'label-primary', 'label-secondary', 'label-tertiary',
  'brand-primary',
  'state-success-primary', 'state-error-primary', 'state-warn-primary',
]
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const readTokens = (page) =>
  page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement)
    const out = {}
    for (const n of names) out[n] = cs.getPropertyValue(`--dsw-alias-${n}`).trim()
    return out
  }, TOKENS)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
const cdp = await page.createCDPSession()
await cdp.send('Page.enable')
await cdp.send('Page.navigate', { url: URL })
await new Promise((r) => setTimeout(r, 7000))
await page.bringToFront().catch(() => {})
await new Promise((r) => setTimeout(r, 2000))

const dark = await readTokens(page)
let light = null
for (const sel of ['[aria-label*="theme" i]', '[aria-label*="主题"]', '[aria-label*="外观"]', '[data-theme]', 'button:has(svg)']) {
  try {
    const el = await page.$(sel)
    if (el) {
      await el.click()
      await new Promise((r) => setTimeout(r, 1200))
      light = await readTokens(page)
      if (light['bg-base'] && light['bg-base'] !== dark['bg-base']) break
      light = null
    }
  } catch { /* try next selector */ }
}

writeFileSync(new URL('../docs/screenshots/theme.json', import.meta.url).pathname,
  JSON.stringify({ url: URL, dark, light }, null, 2))
console.log('dark:', JSON.stringify(dark))
console.log('light:', light ? JSON.stringify(light) : '(未切换，仅暗色)')
await browser.close()
