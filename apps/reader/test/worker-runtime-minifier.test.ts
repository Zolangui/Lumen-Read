import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { createReaderMinimizer } = require('../../../scripts/reader-minimizers')
const worker = `(() => {
  var __webpack_modules__ = ({});
  var __webpack_require__ = { p: './' };
  importScripts(__webpack_require__.p + 'chunk.js');
})();`

describe('worker runtime minification', () => {
  it('produces identical worker bootstraps across source-directory comments', async () => {
    const { options } = createReaderMinimizer()
    const { implementation, css, ...input } = options
    const a = await implementation.transform(
      '/* C:/Users/alice/Lumen */' + worker,
      input,
    )
    const b = await implementation.transform(
      '/* C:/Temp/source-rebuild */' + worker,
      input,
    )
    expect(a.code).toBe(b.code)
    expect(a.code).toContain('__webpack_modules__')
    expect(a.code).toContain('importScripts')
    const pageRuntime = await implementation.transform(
      worker.replace('importScripts', 'loadChunk'),
      input,
    )
    expect(pageRuntime.code).toContain('__webpack_modules__')
    expect(a.code.split('\n').length).toBeLessThan(4)
    expect(css).toBe(true)
    expect(options.minify).toBe(true)
    expect(options.keepNames).toBe(true)
  })

  it('keeps full identifier minification for application and worker modules', async () => {
    const { options } = createReaderMinimizer()
    const { implementation, css: _css, ...input } = options
    const source = `(() => {
      const longApplicationVariable = globalThis.input;
      globalThis.result = longApplicationVariable + 1;
    })();`
    const app = await implementation.transform(source, input)
    expect(app.code).not.toContain('longApplicationVariable')
    const nonemptyWorker = await implementation.transform(
      worker.replace('({})', '({123: () => globalThis.input})'),
      input,
    )
    expect(nonemptyWorker.code).not.toContain('__webpack_modules__')
  })
})
