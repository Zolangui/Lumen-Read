import { describe, expect, it } from 'vitest'

import { indexedBookIdsFromKeys } from '../src/lib/indexed-book-ids'

describe('library index hints', () => {
  it('counts chunk indexes but not chapter-only indexes', () => {
    expect(
      indexedBookIdsFromKeys([
        ['ready', 'chunks'],
        ['ready', 'chapters'],
        ['not-ready', 'chapters'],
      ]),
    ).toEqual(new Set(['ready']))
  })

  it('supports legacy book-id keys and ignores malformed keys', () => {
    expect(
      indexedBookIdsFromKeys([
        'legacy',
        null,
        17,
        ['bad'],
        ['unknown', 'future'],
        [2, 'chunks'],
        [],
      ]),
    ).toEqual(new Set(['legacy']))
  })
})
