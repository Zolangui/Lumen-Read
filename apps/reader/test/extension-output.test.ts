import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  MAX_PARSED_ASSET_BYTES,
  normalizePackagedAssets,
  validateParsedAsset,
} = require('../../../scripts/verify-extension-output')

describe('post-build release checks', () => {
  it('rejects build-machine dependency URLs in browser workers', () => {
    for (const source of [
      'const moduleURL="file:///C:/Users/builder/node_modules/@xenova/transformers/src/env.js";',
      'const moduleURL="file:///tmp/build/node_modules/@xenova/transformers/src/env.js";',
    ]) {
      expect(() =>
        validateParsedAsset('worker.js', Buffer.from(source)),
      ).toThrow('build-machine dependency URL')
    }
    expect(() =>
      validateParsedAsset('worker.js', Buffer.from('const directory="./";')),
    ).not.toThrow()
  })
  it('rejects stale PWA workers while allowing packaged inference workers', () => {
    expect(() => validateParsedAsset('sw.js', Buffer.from(''))).toThrow('PWA')
    expect(() =>
      validateParsedAsset('workbox-abc123.js', Buffer.from('')),
    ).toThrow('PWA')
    expect(() =>
      validateParsedAsset('wasm/wllama.worker.js', Buffer.from('')),
    ).not.toThrow()
  })

  it('normalizes text line endings without modifying binary font assets', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-output-'))
    try {
      const text = path.join(directory, 'manifest.json')
      const binary = path.join(directory, 'font.woff2')
      const bytes = Buffer.from([0, 13, 10, 255])
      fs.writeFileSync(text, '{\r\n}\r\n')
      fs.writeFileSync(binary, bytes)
      normalizePackagedAssets(directory)
      expect(fs.readFileSync(text, 'utf8')).toBe('{\n}\n')
      expect(fs.readFileSync(binary)).toEqual(bytes)
      normalizePackagedAssets(directory)
      expect(fs.readFileSync(text, 'utf8')).toBe('{\n}\n')
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
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
