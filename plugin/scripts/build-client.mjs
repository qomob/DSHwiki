// Build the browser bundle for the 插件 tab. Output format matches the dsh
// client module system exactly: one script that registers a lazy CJS factory
// via window.__ModuleLoader__.load({ id, factory }). React and the shell's
// @deepseek-ai/* modules stay external — the shell's module table provides
// them at runtime.
//
// The artifact (client.js) is COMMITTED so git installs need no build step.
// Rebuild after changing client-src/:  npm run build-client

import esbuild from 'esbuild'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const id = pkg.name

await esbuild.build({
  entryPoints: ['client-src/index.jsx'],
  outfile: 'client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'info',
  external: ['react', 'react/*', 'react-dom', 'react-dom/*', '@deepseek-ai/*'],
  banner: {
    js:
      `window.__ModuleLoader__.load({\n` +
      `\tid: ${JSON.stringify(id)},\n` +
      `\tfactory: (require) => {\n` +
      `\t\tvar module = { exports: {} };\n` +
      `\t\tvar exports = module.exports;`,
  },
  footer: {
    js: '\n\t\treturn module.exports;\n\t},\n});',
  },
})

console.log(`built client.js for ${id} — commit the artifact so installs stay build-free`)
