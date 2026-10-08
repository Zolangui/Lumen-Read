const path = require('path')

/**
 * Extension-only adaptation of Zod v4's optional JIT path. Always select its
 * existing interpreter, without probing Function() (which itself violates CSP).
 * Also remove the unreachable compiler's dynamic constructor. Match original
 * ESM/CJS modules, not minified chunks, and fail the build if upstream changes.
 * No installed dependency files or web/server builds are modified.
 */
function transformZodForCsp(source, resourcePath) {
  const name = path.basename(resourcePath)
  const pattern = name.startsWith('util.')
    ? /((?:export const|exports\.)\s*allowsEval\s*=\s*cached\(\(\) => \{)[\s\S]*?\n\}\);/
    : / {4}compile\(\) \{[\s\S]*?\n {4}\}/
  const match = source.match(pattern)
  if (!match || !/const F = Function;/.test(match[0])) {
    throw new Error(`Zod CSP adaptation needs review: ${resourcePath}`)
  }
  const replacement = name.startsWith('util.')
    ? `${match[1]} return false; });`
    : '    compile() { throw new Error("Zod JIT is disabled in extensions"); }'
  const result = source.replace(pattern, replacement)
  if (/\bFunction\b/.test(result)) {
    throw new Error(`Unexpected dynamic constructor in ${resourcePath}`)
  }
  return result
}

module.exports = function zodCspLoader(source) {
  this.cacheable?.()
  return transformZodForCsp(source, this.resourcePath)
}
module.exports.transformZodForCsp = transformZodForCsp
