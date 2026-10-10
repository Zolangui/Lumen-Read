const path = require('path')

const { EsbuildPlugin } = require('esbuild-loader')
const esbuild = require(require.resolve('esbuild', {
  paths: [path.dirname(require.resolve('esbuild-loader'))],
}))

function createReaderMinimizer() {
  return new EsbuildPlugin({
    target: 'esnext',
    keepNames: true,
    minify: true,
    css: true,
    implementation: {
      transform(source, options) {
        // Standalone Webpack bootstraps contain path-bearing comments.
        // Esbuild's identifier frequency changes with those build directories.
        // Keep only their identifiers stable; app chunks remain fully minified.
        // Some bootstraps are added outside the parent's chunk graph.
        // Identify their generated empty-module runtime, not numeric filenames.
        const standaloneRuntime =
          options.loader !== 'css' &&
          /\b__webpack_modules__\s*=\s*\(?\s*\{\s*\}\s*\)?\s*;/.test(source)
        return esbuild.transform(source, {
          ...options,
          ...(standaloneRuntime && {
            minify: false,
            minifyWhitespace: true,
            minifySyntax: true,
            minifyIdentifiers: false,
          }),
        })
      },
    },
  })
}

module.exports = { createReaderMinimizer }
