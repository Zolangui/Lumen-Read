import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { describe, expect, it } from 'vitest'

describe('worker runtime minification', () => {
  it('keeps identifiers only for Webpack standalone worker runtimes', () => {
    let options: any
    let onCompilation: any
    let prepareAssets: any
    let stage: number | undefined
    let pluginApplied = false
    const configModule: { exports: any } = { exports: {} }
    const fakeRequire = Object.assign(
      (name: string) => {
        if (name === 'path') return path
        if (name === 'esbuild') {
          return { transform: (_source: string, input: any) => input }
        }
        if (name === 'esbuild-loader') {
          return {
            EsbuildPlugin: class {
              constructor(input: any) {
                options = input
              }
              apply() {
                pluginApplied = true
              }
            },
          }
        }
        throw new Error(`Unexpected minimizer dependency: ${name}`)
      },
      { resolve: (name: string) => name },
    )
    vm.runInNewContext(
      fs.readFileSync(
        path.resolve(__dirname, '../../../scripts/reader-minimizers.js'),
        'utf8',
      ),
      { module: configModule, require: fakeRequire },
    )
    const plugin = configModule.exports.createReaderMinimizer()
    plugin.apply({
      webpack: { Compilation: { PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE: 400 } },
      hooks: {
        compilation: {
          tap: (_name: string, callback: any) => (onCompilation = callback),
        },
      },
    })
    expect(pluginApplied).toBe(true)
    const chunk = (file: string, runtime: boolean, loading: string) => ({
      files: [file],
      hasRuntime: () => runtime,
      getEntryOptions: () => ({ chunkLoading: loading }),
    })
    onCompilation({
      chunks: [
        chunk('worker.js', true, 'import-scripts'),
        chunk('app.js', true, 'jsonp'),
        chunk('worker-module.js', false, 'import-scripts'),
      ],
      hooks: {
        processAssets: {
          tap: (input: any, callback: any) => {
            stage = input.stage
            prepareAssets = callback
          },
        },
      },
    })
    expect(stage).toBe(399)
    prepareAssets()
    const transform = options.implementation.transform
    expect(transform('', { sourcefile: 'worker.js', minify: true })).toEqual({
      sourcefile: 'worker.js',
      minify: true,
      minifyIdentifiers: false,
    })
    for (const sourcefile of ['app.js', 'worker-module.js', 'styles.css']) {
      expect(transform('', { sourcefile, minify: true })).toEqual({
        sourcefile,
        minify: true,
      })
    }
    expect(options.minify).toBe(true)
    expect(options.keepNames).toBe(true)
  })
})
