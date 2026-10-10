import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'

import { describe, expect, it } from 'vitest'

const readerRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(readerRoot, '../..')
const requireReader = createRequire(path.join(readerRoot, 'package.json'))
const loader = requireReader(
  path.join(repoRoot, 'scripts/loaders/transformers-browser-loader.js'),
)
const original = fs.readFileSync(
  path.join(
    path.dirname(requireReader.resolve('@xenova/transformers/package.json')),
    'src/env.js',
  ),
  'utf8',
)

function browserDefaults(source: string) {
  const context: Record<string, any> = {
    fs: {},
    path: {},
    url: {},
    ONNX: { env: { wasm: {} } },
    self: { caches: {} },
  }
  vm.runInNewContext(
    source
      .replace(/^import\s+[^;]+;\s*$/gm, '')
      // vm.Script cannot parse import.meta. Its value is irrelevant here:
      // the original filesystem branch must stay unreachable in a browser.
      .replaceAll('import.meta.url', 'undefined')
      .replace('export const env =', 'const env =') +
      '\nglobalThis.result = env;',
    context,
  )
  return JSON.parse(JSON.stringify(context.result))
}

describe('Transformers.js client build adaptation', () => {
  it('removes the Node-only absolute module URL before Webpack hashing', () => {
    const cacheable = { calls: 0 }
    const adapted = loader.call(
      { cacheable: () => cacheable.calls++ },
      original,
    )
    expect(cacheable.calls).toBe(1)
    expect(adapted).not.toContain('import.meta.url')
    expect(adapted).toContain("const __dirname = './';")
  })

  it('preserves all actual browser environment and cache defaults', () => {
    const adapted = loader.call({}, original)
    expect(browserDefaults(adapted)).toEqual(browserDefaults(original))
    expect(browserDefaults(adapted)).toMatchObject({
      __dirname: './',
      localModelPath: '/models/',
      useFS: false,
      useFSCache: false,
      useBrowserCache: true,
    })
  })

  it('fails closed when the upstream Node-directory implementation changes', () => {
    expect(() => loader.call({}, 'export const env = {}')).toThrow(
      'adaptation needs review',
    )
  })
})
