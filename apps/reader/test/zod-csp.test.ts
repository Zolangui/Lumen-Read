import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'

import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  transformZodForCsp,
} = require('../../../scripts/loaders/zod-csp-loader')
const core = path.dirname(require.resolve('zod/v4/core'))

describe('extension-only Zod CSP adaptation', () => {
  for (const format of ['js', 'cjs']) {
    for (const name of ['util', 'doc']) {
      it(`removes the dynamic constructor in ${name}.${format}`, () => {
        const file = path.join(core, `${name}.${format}`)
        const result = transformZodForCsp(fs.readFileSync(file, 'utf8'), file)
        expect(result).not.toMatch(/\bFunction\b/)
        expect(result).toContain(
          name === 'util' ? 'return false' : 'Zod JIT is disabled',
        )
      })
    }
  }

  it('fails closed when upstream changes the known JIT implementation', () => {
    expect(() =>
      transformZodForCsp('export const allowsEval = true', 'util.js'),
    ).toThrow('needs review')
  })

  it('uses the normal interpreter for valid/invalid schemas without attempting eval', () => {
    const loaded = new Map<string, any>()
    const dynamicCode = () => {
      throw new Error('Dynamic constructor attempted')
    }
    const context = vm.createContext(
      { Function: dynamicCode },
      {
        codeGeneration: { strings: false, wasm: false },
      },
    )
    const load = (file: string): any => {
      if (loaded.has(file)) return loaded.get(file).exports
      const module = { exports: {} }
      loaded.set(file, module)
      let source = fs.readFileSync(file, 'utf8')
      if (/[/\\]core[/\\](util|doc)\.cjs$/.test(file)) {
        source = transformZodForCsp(source, file)
      }
      const wrapper = new vm.Script(
        `(function(exports, require, module) {${source}\n})`,
      ).runInContext(context)
      wrapper(
        module.exports,
        (id: string) =>
          load(require.resolve(id, { paths: [path.dirname(file)] })),
        module,
      )
      return module.exports
    }
    const { z } = load(require.resolve('zod'))
    const schema = z.object({
      name: z.string(),
      count: z.number().int().min(1),
    })
    expect(schema.parse({ name: 'Lumen', count: 2 })).toEqual({
      name: 'Lumen',
      count: 2,
    })
    expect(schema.safeParse({ name: 'Lumen', count: 0 }).success).toBe(false)
    expect(schema.safeParse({ name: 1, count: 2 }).success).toBe(false)
    expect(
      z
        .object({ nested: schema })
        .safeParse({ nested: { name: 'Lumen', count: 3 } }).success,
    ).toBe(true)
  })
})
