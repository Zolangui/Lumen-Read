import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  MAX_PARSED_ASSET_BYTES,
  validateParsedAsset,
} = require('../../../scripts/verify-extension-output')

describe('post-build release checks', () => {
  it('rejects indirect Function constructors missed by the static submission scan', () => {
    expect(() =>
      validateParsedAsset(
        'zod.js',
        Buffer.from('const F=Function;return new F("");'),
      ),
    ).toThrow('aliased dynamic Function')
    expect(() =>
      validateParsedAsset(
        'zod.js',
        Buffer.from('const evalAllowed=()=>false;'),
      ),
    ).not.toThrow()
  })
  it('rejects oversized parsed files before packaging, not only at AMO upload', () => {
    const bytes = Buffer.alloc(MAX_PARSED_ASSET_BYTES + 1)
    expect(() => validateParsedAsset('app.js', bytes)).toThrow('parser limit')
    expect(() => validateParsedAsset('runtime.wasm', bytes)).not.toThrow()
    expect(() =>
      validateParsedAsset('app.js', bytes.subarray(0, MAX_PARSED_ASSET_BYTES)),
    ).not.toThrow()
  })

  it('rejects remote fonts and exported GTM, allowing optional AI endpoint strings', () => {
    expect(() =>
      validateParsedAsset(
        'app.css',
        Buffer.from('@import url(https://fonts.googleapis.com/css2);'),
      ),
    ).toThrow('remote UI fonts')
    expect(() =>
      validateParsedAsset(
        'index.html',
        Buffer.from('<iframe src="https://www.googletagmanager.com/ns.html">'),
      ),
    ).toThrow('analytics')
    expect(() =>
      validateParsedAsset(
        'ai.js',
        Buffer.from('https://api.openai.com/v1/models'),
      ),
    ).not.toThrow()
  })
})
