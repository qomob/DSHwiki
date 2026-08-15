// Module hooks for the render smoke: neutralize stylesheet imports that the
// browser build handles at bundle time (katex etc.), so Node can load the
// primitives package's ESM graph for server rendering.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export default {}',
      }
    }
    return nextLoad(url, context)
  },
})
