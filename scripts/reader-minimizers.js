const { EsbuildPlugin } = require('esbuild-loader')

// Worker/shared asynchronous assets can undergo both worker and main-compiler
// transforms. Preserve their identifiers so re-minification does not depend on
// the frequency of characters in generated chunk hashes. Do not disable
// identifier minification in the large application entry point (AMO's 5 MiB cap).
const asynchronousChunks =
  /^static\/chunks\/(?!pages\/|(?:main|framework|webpack)-).*\.js$/

function createReaderMinimizers(extensionExport) {
  const common = { target: 'esnext', keepNames: true }
  return [
    new EsbuildPlugin({
      ...common,
      minify: true,
      css: true,
      ...(extensionExport && { exclude: asynchronousChunks }),
    }),
    ...(extensionExport
      ? [
          new EsbuildPlugin({
            ...common,
            include: asynchronousChunks,
            minifyWhitespace: true,
            minifySyntax: true,
            minifyIdentifiers: false,
          }),
        ]
      : []),
  ]
}

module.exports = { createReaderMinimizers }
