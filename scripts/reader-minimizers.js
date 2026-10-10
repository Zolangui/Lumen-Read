const path = require('path')

const { EsbuildPlugin } = require('esbuild-loader')
const esbuild = require(require.resolve('esbuild', {
  paths: [path.dirname(require.resolve('esbuild-loader'))],
}))

function createReaderMinimizer() {
  const workerRuntimes = new Set()
  const plugin = new EsbuildPlugin({
    target: 'esnext',
    keepNames: true,
    minify: true,
    css: true,
    implementation: {
      transform(source, options) {
        // Standalone Webpack worker bootstraps contain path-bearing comments.
        // Esbuild's identifier frequency changes with those build directories.
        // Keep only their identifiers stable; app chunks remain fully minified.
        return esbuild.transform(source, {
          ...options,
          ...(workerRuntimes.has(options.sourcefile) && {
            minifyIdentifiers: false,
          }),
        })
      },
    },
  })
  const apply = plugin.apply.bind(plugin)
  plugin.apply = (compiler) => {
    compiler.hooks.compilation.tap(
      'LumenWorkerRuntimeMinifier',
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'LumenWorkerRuntimeMinifier',
            stage:
              compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE -
              1,
          },
          () => {
            workerRuntimes.clear()
            for (const chunk of compilation.chunks) {
              if (
                chunk.hasRuntime() &&
                chunk.getEntryOptions()?.chunkLoading === 'import-scripts'
              ) {
                for (const file of chunk.files) workerRuntimes.add(file)
              }
            }
          },
        )
      },
    )
    apply(compiler)
  }
  return plugin
}

module.exports = { createReaderMinimizer }
