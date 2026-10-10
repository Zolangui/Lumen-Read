// Client-only: the Node filesystem branch of Transformers.js is unavailable
// in extension pages/workers. Webpack otherwise embeds the build machine's
// absolute file URL for import.meta.url, changing chunk hashes across folders.
const nodeDirectory =
  /const __dirname = RUNNING_LOCALLY\s*\?\s*path\.dirname\(path\.dirname\(url\.fileURLToPath\(import\.meta\.url\)\)\)\s*:\s*(['"])\.\/\1\s*;/

module.exports = function transformersBrowserLoader(source) {
  this.cacheable?.()
  if (!nodeDirectory.test(source)) {
    throw new Error('Transformers.js browser directory adaptation needs review')
  }
  return source.replace(nodeDirectory, "const __dirname = './';")
}
