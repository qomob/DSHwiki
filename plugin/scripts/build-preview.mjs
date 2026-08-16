// Bundle the preview harness (HubView + primitives + react inlined) into
// docs/screenshots/preview.js, plus the preview.html wrapper that applies
// theme.json tokens. Run before screenshot.mjs.
import esbuild from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'screenshots')
mkdirSync(OUT, { recursive: true })

await esbuild.build({
  entryPoints: ['scripts/preview-entry.jsx'],
  outfile: join(OUT, 'preview.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  minify: true,
  logLevel: 'error',
  loader: { '.woff': 'file', '.woff2': 'file', '.ttf': 'file' },
  assetNames: 'fonts/[name]',
})

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
  #root { height: 100vh; }
</style>
</head>
<body>
<div id="root"></div>
<script src="./preview.js"></script>
</body>
</html>`
writeFileSync(join(OUT, 'preview.html'), html)
console.log('preview built →', join(OUT, 'preview.js'))
