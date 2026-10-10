import { File as NodeFile } from 'node:buffer'
import { webcrypto } from 'node:crypto'

import 'fake-indexeddb/auto'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createBackup, restoreBackup } from '../src/backup'
import { DB } from '../src/db'
import type { BookRecord } from '../src/db'

const nativeClone = globalThis.structuredClone
// Node 18 clones File as Blob and loses its name/mtime. Browsers retain them.
function browserClone(value: any, options?: any): any {
  if (value?.file instanceof NodeFile) {
    const cloned = nativeClone({ ...value, file: undefined }, options)
    cloned.file = new NodeFile([value.file], value.file.name, {
      type: value.file.type,
      lastModified: value.file.lastModified,
    })
    return cloned
  }
  return nativeClone(value, options)
}
function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (k) => values.get(k) ?? null,
    key: (i) => [...values.keys()][i] ?? null,
    removeItem: (k) => {
      values.delete(k)
    },
    setItem: (k, v) => {
      values.set(k, v)
    },
  }
}
function book(id: string): BookRecord {
  return {
    id,
    name: 'same.epub',
    size: 3,
    createdAt: 1,
    metadata: { title: id } as any,
    cfi: 'saved-page',
    annotations: [
      {
        id: `note-${id}`,
        bookId: id,
        cfi: 'note-page',
        text: 'Quote',
        notes: 'My note',
        createAt: 1,
        updatedAt: 2,
        spine: { index: 0, title: 'Chapter' },
        type: 'highlight',
        color: 'yellow',
      },
    ],
    configuration: { typography: { fontSize: '20px' } },
    chatSessions: [
      {
        id: 'conversation',
        createdAt: 1,
        updatedAt: 2,
        messages: [{ id: 'message', role: 'user', content: 'Saved question' }],
      },
    ],
  }
}
function file(bytes: Uint8Array | string, name = 'backup.zip'): File {
  return new NodeFile([bytes], name, {
    type: name.endsWith('.zip') ? 'application/zip' : 'application/epub+zip',
    lastModified: 123,
  }) as unknown as File
}
const databases: DB[] = []
async function database(): Promise<DB> {
  const result = new DB(
    `lumen-backup-test-${databases.length}-${Math.random()}`,
  )
  databases.push(result)
  await result.open()
  return result
}
async function populate(databaseValue: DB, ids = ['one', 'two']) {
  for (const id of ids) {
    await databaseValue.books.put(book(id))
    await databaseValue.files.put({ id, file: file(id, 'same.epub') })
    await databaseValue.covers.put({
      id,
      cover: 'data:image/png;base64,aGVsbG8=',
    })
  }
}
async function rewrite(
  bytes: Uint8Array,
  change: (zip: JSZip) => void | Promise<void>,
) {
  const zip = await JSZip.loadAsync(bytes)
  await change(zip)
  return file(await zip.generateAsync({ type: 'uint8array' }))
}

beforeEach(() => {
  vi.stubGlobal('File', NodeFile)
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('structuredClone', browserClone)
})
afterEach(async () => {
  vi.restoreAllMocks()
  for (const databaseValue of databases.splice(0)) await databaseValue.delete()
  vi.unstubAllGlobals()
})

describe('local library backups', () => {
  it('merges canonical session IDs idempotently and keeps the more complete snapshot', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    const storage = memoryStorage()
    const position = {
      canonicalModelVersion: 2,
      spineIndex: 0,
      resourceHref: 'chapter.xhtml',
      segmentId: 'p1',
      cfi: 'saved-page',
      kind: 'text',
      codePointOffset: 0,
      domUtf16Offset: 0,
      isCodePointBoundary: true,
    }
    const metric = {
      algorithmId: 'lumen-progress-metric',
      algorithmVersion: 1,
      completedUnits: 0,
      totalUnits: 1000,
    }
    const session = {
      schemaVersion: 2,
      id: 'canonical-session',
      bookId: 'one',
      date: '2026-10-10',
      startedAt: 1,
      endedAt: 60001,
      durationSeconds: 60,
      startPosition: position,
      endPosition: position,
      startMetric: metric,
      endMetric: metric,
      unitsRead: 100,
    }
    storage.setItem(
      'readingStats',
      JSON.stringify({ schemaVersion: 2, stats: { sessions: [session] } }),
    )
    const bytes = await createBackup(
      { includeReadingHistory: true },
      source,
      storage,
    )
    storage.setItem(
      'readingStats',
      JSON.stringify({
        schemaVersion: 2,
        stats: { sessions: [{ ...session, unitsRead: 10 }] },
      }),
    )
    await restoreBackup(file(bytes), target, storage)
    await restoreBackup(file(bytes), target, storage)
    const stats = JSON.parse(storage.getItem('readingStats')!).stats
    expect(stats.sessions).toHaveLength(1)
    expect(stats.sessions[0].unitsRead).toBe(100)
    expect(stats.totalTimeMinutes).toBe(1)
  })
  it('rejects a file-ID race during commit and restores global preferences', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    await populate(target, ['one'])
    const storage = memoryStorage()
    storage.setItem('settings', JSON.stringify({ fontSize: '24px' }))
    const bytes = await createBackup(
      { includePreferences: true },
      source,
      storage,
    )
    storage.setItem('settings', '{}')
    await expect(
      restoreBackup(file(bytes), target, storage, {
        beforeCommit: async () => {
          await target.files.put({
            id: 'one',
            file: file('changed during import', 'same.epub'),
          })
        },
      }),
    ).rejects.toThrow('conflict')
    expect(storage.getItem('settings')).toBe('{}')
    expect(await (await target.files.get('one'))!.file.text()).toBe(
      'changed during import',
    )
  })
  it('excludes legacy layout caches without mutating the library record', async () => {
    const source = await database()
    await populate(source, ['one'])
    await source.books.update('one', {
      locations: 'legacy-cache',
      pageCountSource: 'layout-atlas',
      pageCount: 400,
      pageCountLayoutKey: 'old-screen',
      pageCountLayouts: {},
    })
    const zip = await JSZip.loadAsync(await createBackup({}, source, null))
    const saved = JSON.parse(await zip.file('data.json')!.async('string'))
      .books[0]
    expect(saved.locations).toBeUndefined()
    expect(saved.pageCountLayouts).toBeUndefined()
    expect(saved.pageCountLayoutKey).toBeUndefined()
    expect(saved.pageCount).toBeUndefined()
    expect((await source.books.get('one'))!.locations).toBe('legacy-cache')
  })
  it('accepts existing fallback covers with an octet-stream MIME type', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    const cover = 'data:application/octet-stream;base64,aGVsbG8='
    await source.covers.put({ id: 'one', cover })
    await restoreBackup(
      file(await createBackup({}, source, null)),
      target,
      null,
    )
    expect((await target.covers.get('one'))!.cover).toBe(cover)
  })
  it('round-trips duplicate filenames, original bytes, covers, notes, chats and saved pages', async () => {
    const source = await database()
    const target = await database()
    await populate(source)
    const bytes = await createBackup({}, source, null)
    expect(await restoreBackup(file(bytes), target, null)).toBe(2)
    for (const id of ['one', 'two']) {
      expect(await target.books.get(id)).toMatchObject(book(id))
      expect((await target.files.get(id))!.file.name).toBe('same.epub')
      expect(await (await target.files.get(id))!.file.text()).toBe(id)
      expect((await target.covers.get(id))!.cover).toBe(
        'data:image/png;base64,aGVsbG8=',
      )
    }
  })
  it('exports only selected books and their history, excluding credentials and download consents', async () => {
    const source = await database()
    await populate(source)
    const storage = memoryStorage()
    storage.setItem(
      'settings',
      JSON.stringify({ locale: 'pt-BR', fontSize: '22px' }),
    )
    storage.setItem('literal-color-scheme', JSON.stringify('dark'))
    storage.setItem(
      'aiSettings',
      JSON.stringify({ apiKey: 'NEVER_EXPORT', remoteDataConsent: true }),
    )
    storage.setItem('dropbox-refresh-token', 'NEVER_EXPORT')
    storage.setItem(
      'readingStats',
      JSON.stringify({
        sessions: ['one', 'two'].map((bookId) => ({
          date: '2026-10-10',
          bookId,
          duration: 5,
          pagesRead: 2,
        })),
      }),
    )
    const bytes = await createBackup(
      {
        bookIds: ['two'],
        includePreferences: true,
        includeReadingHistory: true,
      },
      source,
      storage,
    )
    const zip = await JSZip.loadAsync(bytes)
    const manifest = JSON.parse(await zip.file('backup.json')!.async('string'))
    expect(manifest.files.map((f: any) => f.id)).toEqual(['two'])
    expect(manifest.preferences).toEqual({
      settings: storage.getItem('settings'),
      'literal-color-scheme': storage.getItem('literal-color-scheme'),
    })
    expect(
      JSON.parse(manifest.readingHistory).stats.sessions.map(
        (s: any) => s.bookId,
      ),
    ).toEqual(['two'])
    expect(JSON.parse(manifest.readingHistory).stats.totalTimeMinutes).toBe(5)
    expect(JSON.stringify(manifest)).not.toContain('NEVER_EXPORT')
  })
  it('restores preferences and merges history idempotently without touching AI settings', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    const storage = memoryStorage()
    storage.setItem('settings', JSON.stringify({ fontSize: '24px' }))
    storage.setItem(
      'readingStats',
      JSON.stringify({
        sessions: [
          { bookId: 'one', date: '2026-10-10', duration: 5, pagesRead: 3 },
        ],
      }),
    )
    const bytes = await createBackup(
      { includePreferences: true, includeReadingHistory: true },
      source,
      storage,
    )
    storage.setItem('settings', '{}')
    storage.setItem('aiSettings', 'private-session')
    await restoreBackup(file(bytes), target, storage)
    await restoreBackup(file(bytes), target, storage)
    expect(storage.getItem('settings')).toBe(
      JSON.stringify({ fontSize: '24px' }),
    )
    expect(storage.getItem('aiSettings')).toBe('private-session')
    expect(
      JSON.parse(storage.getItem('readingStats')!).stats.sessions,
    ).toHaveLength(1)
    expect(await target.books.count()).toBe(1)
  })
  it('keeps newer local notes and reading positions when importing an older backup', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    const bytes = await createBackup({}, source, null)
    await restoreBackup(file(bytes), target, null)
    await target.books.update('one', {
      restoreLocation: { schemaVersion: 1, cfi: 'newer-page', updatedAt: 99 },
      annotations: [
        {
          ...book('one').annotations[0],
          updatedAt: 99,
          notes: 'Newer local note',
        },
      ],
    })
    await restoreBackup(file(bytes), target, null)
    expect((await target.books.get('one'))!.cfi).toBe('newer-page')
    expect((await target.books.get('one'))!.annotations[0].notes).toBe(
      'Newer local note',
    )
  })
  it('awaits pending reading-session flushes before merging history', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    const storage = memoryStorage()
    storage.setItem('readingStats', JSON.stringify({ sessions: [] }))
    const bytes = await createBackup(
      { includeReadingHistory: true },
      source,
      storage,
    )
    await restoreBackup(file(bytes), target, storage, {
      beforeCommit: async () => {
        storage.setItem(
          'readingStats',
          JSON.stringify({
            sessions: [
              { date: '2026-10-10', bookId: 'one', duration: 10, pagesRead: 1 },
            ],
          }),
        )
      },
    })
    expect(
      JSON.parse(storage.getItem('readingStats')!).stats.totalTimeMinutes,
    ).toBe(10)
  })
  it.each(['missing', 'corrupt', 'future', 'traversal'])(
    'rejects %s archives before writing anything',
    async (kind) => {
      const source = await database()
      const target = await database()
      await populate(source, ['one'])
      const bytes = await createBackup({}, source, null)
      const bad = await rewrite(bytes, (zip) => {
        if (kind === 'missing') zip.remove('files/0.epub')
        if (kind === 'corrupt') zip.file('files/0.epub', 'bad')
        if (kind === 'future')
          zip.file('data.json', JSON.stringify({ version: 999, books: [] }))
        if (kind === 'traversal') zip.file('../outside.epub', 'bad')
      })
      await expect(restoreBackup(bad, target, null)).rejects.toThrow()
      expect(await target.books.count()).toBe(0)
      expect(await target.files.count()).toBe(0)
    },
  )
  it('rolls back every store and preferences if a late write fails', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    const storage = memoryStorage()
    storage.setItem('settings', JSON.stringify({ fontSize: '20px' }))
    const bytes = await createBackup(
      { includePreferences: true },
      source,
      storage,
    )
    storage.setItem('settings', '{}')
    vi.spyOn(target.covers, 'put').mockRejectedValue(new Error('disk full'))
    await expect(restoreBackup(file(bytes), target, storage)).rejects.toThrow(
      'disk full',
    )
    expect(await target.books.count()).toBe(0)
    expect(await target.files.count()).toBe(0)
    expect(storage.getItem('settings')).toBe('{}')
  })
  it('does not overwrite a different EPUB that happens to have the same library ID', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    await populate(target, ['one'])
    await target.files.put({
      id: 'one',
      file: file('different bytes', 'same.epub'),
    })
    await expect(
      restoreBackup(file(await createBackup({}, source, null)), target, null),
    ).rejects.toThrow('conflict')
    expect(await (await target.files.get('one'))!.file.text()).toBe(
      'different bytes',
    )
  })
  it.each([1, 2])(
    'reads old v%s ZIP backups and can import the same legacy backup twice',
    async (version) => {
      const target = await database()
      const zip = new JSZip()
      zip.file(
        'data.json',
        JSON.stringify({ version, books: [book('legacy')] }),
      )
      zip.file('covers.json', '[]')
      zip.file('files/same.epub', 'legacy')
      const legacy = file(await zip.generateAsync({ type: 'uint8array' }))
      await restoreBackup(legacy, target, null)
      await restoreBackup(legacy, target, null)
      expect(await target.files.count()).toBe(1)
      expect((await target.books.get('legacy'))!.annotations[0].notes).toBe(
        'My note',
      )
    },
  )
  it('fails explicitly instead of producing an incomplete export for missing files', async () => {
    const source = await database()
    await source.books.put(book('missing'))
    await expect(createBackup({}, source, null)).rejects.toThrow('missing_file')
  })
  it.each([-1, 1, 3, 5])(
    'round-trips the actual theme background level %s',
    async (background) => {
      const source = await database()
      const target = await database()
      await populate(source, ['one'])
      const storage = memoryStorage()
      storage.setItem(
        'settings',
        JSON.stringify({
          theme: { background, source: '#0EA5E9', adaptivePresentation: true },
        }),
      )
      const bytes = await createBackup(
        { includePreferences: true },
        source,
        storage,
      )
      storage.clear()
      await restoreBackup(file(bytes), target, storage)
      expect(JSON.parse(storage.getItem('settings')!).theme.background).toBe(
        background,
      )
    },
  )
  it('lets the user skip global preferences and history without losing per-book settings', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    const storage = memoryStorage()
    storage.setItem('settings', JSON.stringify({ fontSize: '24px' }))
    storage.setItem('readingStats', JSON.stringify({ sessions: [] }))
    const bytes = await createBackup(
      { includePreferences: true, includeReadingHistory: true },
      source,
      storage,
    )
    storage.setItem('settings', JSON.stringify({ fontSize: '16px' }))
    storage.setItem('readingStats', 'keep-history')
    await restoreBackup(file(bytes), target, storage, {
      restorePreferences: false,
      restoreReadingHistory: false,
    })
    expect(storage.getItem('settings')).toBe(
      JSON.stringify({ fontSize: '16px' }),
    )
    expect(storage.getItem('readingStats')).toBe('keep-history')
    expect(
      (await target.books.get('one'))!.configuration?.typography?.fontSize,
    ).toBe('20px')
  })
  it.each([
    'null-manifest',
    'bad-title',
    'duplicate-annotation',
    'bad-typography',
    'credential-preference',
  ])(
    'rejects malformed %s before closing books or changing storage',
    async (kind) => {
      const source = await database()
      const target = await database()
      await populate(source, ['one'])
      const bytes = await createBackup({}, source, null)
      const bad = await rewrite(bytes, async (zip) => {
        if (kind === 'null-manifest') {
          zip.file('backup.json', 'null')
        } else if (kind === 'credential-preference') {
          const manifest = JSON.parse(
            await zip.file('backup.json')!.async('string'),
          )
          manifest.preferences = { aiSettings: '{"apiKey":"secret"}' }
          zip.file('backup.json', JSON.stringify(manifest))
        } else {
          const data = JSON.parse(await zip.file('data.json')!.async('string'))
          if (kind === 'bad-title')
            data.books[0].metadata.title = { invalid: true }
          if (kind === 'duplicate-annotation')
            data.books[0].annotations.push(data.books[0].annotations[0])
          if (kind === 'bad-typography')
            data.books[0].configuration.typography.fontSize = {}
          zip.file('data.json', JSON.stringify(data))
        }
      })
      const beforeCommit = vi.fn(async () => {})
      await expect(
        restoreBackup(bad, target, null, { beforeCommit }),
      ).rejects.toThrow('invalid')
      expect(beforeCommit).not.toHaveBeenCalled()
      expect(await target.books.count()).toBe(0)
    },
  )
  it('preserves valid local caches and unrelated books when restoring identical EPUB bytes', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    await populate(target, ['one', 'unrelated'])
    await target.canonicalLocationIndices.put({
      bookId: 'one',
      revision: 'valid-cache',
    } as any)
    await target.layoutAtlases.put({
      bookId: 'one',
      revision: 'valid-cache',
      fingerprintKey: 'screen',
    } as any)
    await target.indices.put({ bookId: 'one', kind: 'chunks', data: 'cached' })
    await target.vectors.put({ id: 'vector', bookId: 'one', index: 0 } as any)
    await restoreBackup(
      file(await createBackup({}, source, null)),
      target,
      null,
    )
    expect(await target.canonicalLocationIndices.get('one')).toBeTruthy()
    expect(await target.layoutAtlases.count()).toBe(1)
    expect(await target.indices.count()).toBe(1)
    expect(await target.vectors.count()).toBe(1)
    expect(await target.books.get('unrelated')).toBeTruthy()
  })
  it('rebuilds orphan caches when recovering a missing EPUB file', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    await target.canonicalLocationIndices.put({
      bookId: 'one',
      revision: 'unknown-old-file',
    } as any)
    await target.indices.put({ bookId: 'one', kind: 'chunks', data: 'orphan' })
    await restoreBackup(
      file(await createBackup({}, source, null)),
      target,
      null,
    )
    expect(await target.canonicalLocationIndices.count()).toBe(0)
    expect(await target.indices.count()).toBe(0)
  })
  it('keeps the larger legacy page count when equal-duration history snapshots are merged', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    const storage = memoryStorage()
    const session = {
      bookId: 'one',
      date: '2026-10-10',
      duration: 5,
      pagesRead: 9,
    }
    storage.setItem('readingStats', JSON.stringify({ sessions: [session] }))
    const bytes = await createBackup(
      { includeReadingHistory: true },
      source,
      storage,
    )
    storage.setItem(
      'readingStats',
      JSON.stringify({ sessions: [{ ...session, pagesRead: 1 }] }),
    )
    await restoreBackup(file(bytes), target, storage)
    const stats = JSON.parse(storage.getItem('readingStats')!).stats
    expect(stats.sessions[0].pagesRead).toBe(9)
    expect(stats.totalTimeMinutes).toBe(5)
  })
  it('does not commit books when localStorage runs out of space', async () => {
    const source = await database()
    const target = await database()
    await populate(source, ['one'])
    const storage = memoryStorage()
    storage.setItem('settings', JSON.stringify({ fontSize: '24px' }))
    const bytes = await createBackup(
      { includePreferences: true },
      source,
      storage,
    )
    storage.setItem('settings', '{}')
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    await expect(restoreBackup(file(bytes), target, storage)).rejects.toThrow(
      'quota',
    )
    expect(await target.books.count()).toBe(0)
    expect(storage.getItem('settings')).toBe('{}')
  })
})
