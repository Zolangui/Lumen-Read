import { proxy } from 'valtio'
import { describe, expect, it } from 'vitest'

import {
  CANONICAL_MODEL_VERSION,
  PROGRESS_METRIC_ALGORITHM_ID,
  PROGRESS_METRIC_ALGORITHM_VERSION,
} from '@flow/epubjs'

import {
  isSupportedCanonicalProgressRecord,
  mergeIncomingBookRecord,
} from '../src/db'
import type { BookRecord, CanonicalProgressRecord } from '../src/db'
import { persistableBookChanges } from '../src/lib/book-persistence'
import { deserializeData, UnsupportedSyncDataVersionError } from '../src/sync'

function progress(
  cfi: string,
  completedUnits: number,
): CanonicalProgressRecord {
  return {
    schemaVersion: 1,
    position: {
      canonicalModelVersion: CANONICAL_MODEL_VERSION,
      kind: 'text',
      spineIndex: 0,
      spineItemId: 'chapter',
      resourceHref: 'chapter.xhtml',
      segmentId: 'text:0.0',
      cfi,
      codePointOffset: completedUnits,
      domUtf16Offset: completedUnits,
      isCodePointBoundary: true,
    },
    metric: {
      algorithmId: PROGRESS_METRIC_ALGORITHM_ID,
      algorithmVersion: PROGRESS_METRIC_ALGORITHM_VERSION,
      completedUnits,
      totalUnits: 100,
    },
    updatedAt: completedUnits,
  }
}

function book(overrides: Partial<BookRecord>): BookRecord {
  return {
    id: 'book',
    name: 'Book.epub',
    size: 0,
    metadata: {} as BookRecord['metadata'],
    createdAt: 1,
    annotations: [],
    ...overrides,
  }
}

describe('canonical persistence', () => {
  it('captures reactive canonical progress as a structured-cloneable record', () => {
    const reactiveProgress = proxy(progress('current-page', 30))
    expect(() => structuredClone(reactiveProgress)).toThrow()

    const captured = persistableBookChanges({
      canonicalProgress: reactiveProgress,
    })
    expect(structuredClone(captured)).toEqual({
      canonicalProgress: progress('current-page', 30),
    })
    reactiveProgress.position.cfi = 'later-page'
    expect(captured.canonicalProgress?.position.cfi).toBe('current-page')
  })

  it('preserves explicit field clearing and nested reactive restore locations', () => {
    const captured = persistableBookChanges({
      pageCount: undefined,
      pageCountLayoutKey: undefined,
      restoreLocation: proxy({
        schemaVersion: 1 as const,
        cfi: 'restored-page',
        updatedAt: 10,
      }),
    })
    const stored = structuredClone(captured)
    expect(stored).toHaveProperty('pageCount', undefined)
    expect(stored).toHaveProperty('pageCountLayoutKey', undefined)
    expect(stored.restoreLocation?.cfi).toBe('restored-page')
  })

  it('fails closed when a backup uses a future data version', () => {
    expect(() =>
      deserializeData(JSON.stringify({ version: 999, books: [] })),
    ).toThrow(UnsupportedSyncDataVersionError)
  })

  it('merges restore location independently from reading-order progress', () => {
    const merged = mergeIncomingBookRecord(
      book({
        restoreLocation: { schemaVersion: 1, cfi: 'local-cfi', updatedAt: 20 },
        canonicalProgress: progress('local-progress', 80),
      }),
      book({
        restoreLocation: {
          schemaVersion: 1,
          cfi: 'non-linear-appendix',
          updatedAt: 90,
        },
        canonicalProgress: progress('remote-progress', 30),
      }),
    )

    expect(merged.restoreLocation?.cfi).toBe('non-linear-appendix')
    expect(merged.cfi).toBe('non-linear-appendix')
    expect(merged.canonicalProgress?.position.cfi).toBe('local-progress')
    expect(merged.percentage).toBe(0.8)
  })

  it('rejects future canonical semantics but preserves their opaque payload', () => {
    const future = {
      ...progress('future', 50),
      position: {
        ...progress('future', 50).position,
        canonicalModelVersion: 999,
      },
    } as unknown as CanonicalProgressRecord

    expect(isSupportedCanonicalProgressRecord(future)).toBe(false)
    const merged = mergeIncomingBookRecord(
      book({}),
      book({ canonicalProgress: future }),
    )
    expect(merged.canonicalProgress).toEqual(future)
  })
})
