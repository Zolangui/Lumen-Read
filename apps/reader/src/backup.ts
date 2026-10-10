import Dexie from 'dexie'
import JSZip from 'jszip'

import { db, DB, mergeIncomingBookRecord, localFileRevision } from './db'
import type { BookRecord, CoverRecord, FileRecord } from './db'
import {
  isReadingSession,
  normalizeStats,
  readingSessionDurationMinutes,
} from './hooks/useReadingTracker'
import type { ReadingSession } from './hooks/useReadingTracker'

export const DATA_FILENAME = 'data.json'
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
const MAX_EXPANDED_BYTES = 1024 * 1024 * 1024
const MAX_JSON_BYTES = 16 * 1024 * 1024
const MAX_FILE_BYTES = 256 * 1024 * 1024
const MAX_ENTRIES = 5000
const PREFERENCE_KEYS = ['settings', 'library', 'literal-color-scheme'] as const

export interface BackupOptions {
  bookIds?: string[]
  includePreferences?: boolean
  includeReadingHistory?: boolean
}

type BackupFile = {
  id: string
  path: string
  name: string
  type: string
  size: number
  lastModified: number
  revision: string
}
type BackupManifest = {
  format: 'lumen-read-backup'
  version: 1
  files: BackupFile[]
  preferences?: Record<string, string>
  readingHistory?: string
}

export class BackupError extends Error {
  constructor(
    public readonly code:
      | 'invalid'
      | 'too_large'
      | 'missing_file'
      | 'conflict'
      | 'unavailable',
  ) {
    super(`Lumen backup: ${code}`)
    this.name = 'BackupError'
  }
}
export class UnsupportedSyncDataVersionError extends BackupError {
  constructor() {
    super('invalid')
  }
}
const invalid = (): never => {
  throw new BackupError('invalid')
}
const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

function parseJSON(text: string): any {
  try {
    return JSON.parse(text, (key, value) => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) invalid()
      return value
    })
  } catch {
    return invalid()
  }
}

export function deserializeData(text: string): BookRecord[] {
  const data = parseJSON(text)
  if (!record(data)) invalid()
  const version = data.version ?? 1
  if (!Number.isInteger(version) || version < 1) invalid()
  if (version > 2) throw new UnsupportedSyncDataVersionError()
  if (!Array.isArray(data.books)) invalid()
  const ids = new Set<string>()
  for (const book of data.books) {
    if (
      !record(book) ||
      typeof book.id !== 'string' ||
      !book.id ||
      ids.has(book.id) ||
      typeof book.name !== 'string' ||
      !book.name ||
      !finite(book.size) ||
      !finite(book.createdAt) ||
      !record(book.metadata) ||
      !Array.isArray(book.annotations)
    )
      invalid()
    for (const key of ['updatedAt', 'percentage', 'pageCount', 'position'])
      if (book[key] !== undefined && !finite(book[key])) invalid()
    if (book.percentage !== undefined && book.percentage > 1) invalid()
    for (const key of ['cfi', 'locations', 'aiPersona', 'activeChatId'])
      if (book[key] !== undefined && typeof book[key] !== 'string') invalid()
    if (book.favorite !== undefined && typeof book.favorite !== 'boolean')
      invalid()
    for (const [key, value] of Object.entries(book.metadata))
      if (key !== 'minSpreadWidth' && typeof value !== 'string') invalid()
    if (book.configuration !== undefined) {
      if (!record(book.configuration)) invalid()
      if (book.configuration.typography !== undefined)
        validateTypography(book.configuration.typography)
    }
    ids.add(book.id)
    const annotationIds = new Set<string>()
    for (const annotation of book.annotations) {
      if (
        !record(annotation) ||
        typeof annotation.id !== 'string' ||
        !annotation.id ||
        annotationIds.has(annotation.id) ||
        annotation.bookId !== book.id ||
        typeof annotation.cfi !== 'string' ||
        typeof annotation.text !== 'string' ||
        !finite(annotation.createAt) ||
        !finite(annotation.updatedAt) ||
        !record(annotation.spine) ||
        !Number.isInteger(annotation.spine.index) ||
        annotation.spine.index < 0 ||
        typeof annotation.spine.title !== 'string' ||
        annotation.type !== 'highlight' ||
        !['yellow', 'red', 'green', 'blue'].includes(annotation.color) ||
        (annotation.notes !== undefined && typeof annotation.notes !== 'string')
      )
        invalid()
      annotationIds.add(annotation.id)
    }
    if (book.chatHistory !== undefined && !validMessages(book.chatHistory))
      invalid()
    if (
      book.chatSessions !== undefined &&
      (!Array.isArray(book.chatSessions) ||
        !book.chatSessions.every(
          (session: any) =>
            record(session) &&
            typeof session.id === 'string' &&
            !!session.id &&
            (session.title === undefined ||
              typeof session.title === 'string') &&
            validMessages(session.messages) &&
            finite(session.createdAt) &&
            finite(session.updatedAt),
        ))
    )
      invalid()
    if (
      book.chatSessions &&
      new Set(book.chatSessions.map((s: any) => s.id)).size !==
        book.chatSessions.length
    )
      invalid()
  }
  return data.books
}

function validMessages(messages: unknown): boolean {
  return (
    Array.isArray(messages) &&
    new Set(messages.map((m) => m?.id)).size === messages.length &&
    messages.every(
      (m) =>
        record(m) &&
        typeof m.id === 'string' &&
        !!m.id &&
        ['user', 'assistant'].includes(m.role) &&
        typeof m.content === 'string',
    )
  )
}

function validateTypography(value: unknown): void {
  if (!record(value)) return invalid()
  for (const field of ['fontSize', 'fontFamily'])
    if (value[field] !== undefined && typeof value[field] !== 'string')
      invalid()
  for (const field of [
    'fontWeight',
    'lineHeight',
    'zoom',
    'contentWidthPercent',
  ])
    if (value[field] !== undefined && !finite(value[field])) invalid()
  if (
    value.spread !== undefined &&
    !['auto', 'none', 'always'].includes(value.spread)
  )
    invalid()
}

function safePreferences(raw: unknown): Record<string, string> {
  if (!record(raw)) invalid()
  const result: Record<string, string> = {}
  for (const [key, text] of Object.entries(raw)) {
    if (
      !(PREFERENCE_KEYS as readonly string[]).includes(key) ||
      typeof text !== 'string'
    )
      invalid()
    const value = parseJSON(text)
    if (key === 'literal-color-scheme') {
      if (!['system', 'light', 'dark'].includes(value)) invalid()
    } else if (key === 'library') {
      if (
        !record(value) ||
        !['grid', 'list'].includes(value.viewMode) ||
        !['All', 'Favorites', 'Unread', 'In Progress', 'Finished'].includes(
          value.filter,
        )
      )
        invalid()
    } else {
      if (!record(value)) invalid()
      const allowed = [
        'theme',
        'locale',
        'fontSize',
        'fontWeight',
        'fontFamily',
        'lineHeight',
        'spread',
        'zoom',
        'contentWidthPercent',
      ]
      if (Object.keys(value).some((field) => !allowed.includes(field)))
        invalid()
      for (const field of ['locale', 'fontSize', 'fontFamily'])
        if (value[field] !== undefined && typeof value[field] !== 'string')
          invalid()
      for (const field of [
        'fontWeight',
        'lineHeight',
        'zoom',
        'contentWidthPercent',
      ])
        if (value[field] !== undefined && !finite(value[field])) invalid()
      if (
        value.spread !== undefined &&
        !['auto', 'none', 'always'].includes(value.spread)
      )
        invalid()
      if (
        value.theme !== undefined &&
        (!record(value.theme) ||
          Object.keys(value.theme).some(
            (field) =>
              !['source', 'background', 'adaptivePresentation'].includes(field),
          ) ||
          (value.theme.source !== undefined &&
            !/^#[0-9a-f]{6}$/i.test(value.theme.source)) ||
          (value.theme.background !== undefined &&
            (!Number.isInteger(value.theme.background) ||
              value.theme.background < -1 ||
              value.theme.background > 5)) ||
          (value.theme.adaptivePresentation !== undefined &&
            typeof value.theme.adaptivePresentation !== 'boolean'))
      )
        invalid()
    }
    result[key] = JSON.stringify(value)
  }
  return result
}

function history(text: string) {
  const raw = parseJSON(text)
  if (
    !record(raw) ||
    (raw.schemaVersion !== undefined && raw.schemaVersion !== 2)
  )
    invalid()
  const value = raw.schemaVersion === 2 ? raw.stats : raw
  if (
    !record(value) ||
    !Array.isArray(value.sessions) ||
    !value.sessions.every(isReadingSession)
  )
    invalid()
  return normalizeStats(value)
}

function mergeHistory(local: string | null, incoming: string): string {
  const original = local ? history(local) : normalizeStats({})
  const imported = history(incoming)
  const sessions = new Map<string, ReadingSession>()
  for (const session of [...original.sessions, ...imported.sessions]) {
    const key =
      'schemaVersion' in session && session.schemaVersion === 2
        ? `v2:${session.id || JSON.stringify(session)}`
        : `v1:${session.bookId}:${session.date}`
    const previous = sessions.get(key)
    if (
      previous &&
      !('schemaVersion' in session) &&
      !('schemaVersion' in previous)
    ) {
      sessions.set(key, {
        ...session,
        duration: Math.max(session.duration, previous.duration),
        pagesRead: Math.max(session.pagesRead, previous.pagesRead),
      })
      continue
    }
    if (
      !previous ||
      readingSessionDurationMinutes(session) >
        readingSessionDurationMinutes(previous) ||
      (readingSessionDurationMinutes(session) ===
        readingSessionDurationMinutes(previous) &&
        'unitsRead' in session &&
        'unitsRead' in previous &&
        session.unitsRead > previous.unitsRead)
    )
      sessions.set(key, session)
  }
  const combined = [...sessions.values()]
  const days = [...new Set(combined.map((s) => s.date))].sort()
  let streak = days.length ? 1 : 0
  for (let i = days.length - 1; i > 0; i--) {
    if (
      Date.parse(`${days[i]}T00:00:00Z`) -
        Date.parse(`${days[i - 1]}T00:00:00Z`) !==
      86400000
    )
      break
    streak++
  }
  return JSON.stringify({
    schemaVersion: 2,
    stats: {
      totalTimeMinutes: combined.reduce(
        (n, s) => n + readingSessionDurationMinutes(s),
        0,
      ),
      currentStreak: streak,
      lastReadDate: days[days.length - 1] || '',
      sessions: combined,
    },
  })
}

function localStorageOrNull(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}
function databaseOrThrow(database: DB | null): DB {
  if (!database) throw new BackupError('unavailable')
  return database
}

function exportableBook(book: BookRecord): BookRecord {
  const exported = { ...book }
  // Old releases placed derived local layout/location caches on BookRecord.
  // Keep durable reading facts, not obsolete caches or viewport-specific totals.
  delete exported.locations
  delete exported.pageCountLayouts
  delete exported.pageCountLayoutKey
  if (exported.pageCountSource === 'layout-atlas') {
    delete exported.pageCount
    delete exported.pageCountSource
    delete exported.pageCountEstimated
  }
  return exported
}

/** Snapshot all three stores in one read transaction, then encode outside it. */
export async function createBackup(
  options: BackupOptions = {},
  database: DB | null = db,
  storage: Storage | null = localStorageOrNull(),
): Promise<Uint8Array> {
  const databaseValue = databaseOrThrow(database)
  const snapshot = await databaseValue.transaction(
    'r',
    databaseValue.books,
    databaseValue.files,
    databaseValue.covers,
    async () => {
      const selected =
        options.bookIds === undefined ? undefined : new Set(options.bookIds)
      const books = (await databaseValue.books.toArray()).filter(
        (b) => !selected || selected.has(b.id),
      )
      const ids = books.map((b) => b.id)
      return {
        books,
        files: await databaseValue.files.bulkGet(ids),
        covers: (await databaseValue.covers.bulkGet(ids)).filter(
          (c): c is CoverRecord => !!c,
        ),
      }
    },
  )
  const ids =
    options.bookIds === undefined
      ? new Set(snapshot.books.map((b) => b.id))
      : new Set(options.bookIds)
  const books = snapshot.books
    .filter((book) => ids.has(book.id))
    .map(exportableBook)
  if (!books.length || books.length !== ids.size) invalid()
  if (books.length + 4 > MAX_ENTRIES) throw new BackupError('too_large')
  const zip = new JSZip()
  const manifest: BackupManifest = {
    format: 'lumen-read-backup',
    version: 1,
    files: [],
  }
  let size = 0
  for (const [index, book] of books.entries()) {
    const file = snapshot.files.find((f) => f?.id === book.id)?.file
    if (!file) throw new BackupError('missing_file')
    size += file.size
    if (file.size > MAX_FILE_BYTES || size > MAX_EXPANDED_BYTES)
      throw new BackupError('too_large')
    const revision = await localFileRevision(file)
    if (!revision.startsWith('lumen-file-sha256-v1:'))
      throw new BackupError('unavailable')
    const path = `files/${index}.epub`
    zip.file(path, await file.arrayBuffer())
    manifest.files.push({
      id: book.id,
      path,
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      revision,
    })
  }
  if (options.includePreferences && storage) {
    const preferences: Record<string, string> = {}
    for (const key of PREFERENCE_KEYS) {
      const value = storage.getItem(key)
      if (value !== null) preferences[key] = value
    }
    manifest.preferences = safePreferences(preferences)
  }
  if (options.includeReadingHistory && storage?.getItem('readingStats')) {
    const stats = history(storage.getItem('readingStats')!)
    if (options.bookIds !== undefined)
      stats.sessions = stats.sessions.filter((session) =>
        ids.has(session.bookId),
      )
    manifest.readingHistory = mergeHistory(
      null,
      JSON.stringify({ schemaVersion: 2, stats }),
    )
  }
  const data = JSON.stringify({
    version: 2,
    dbVersion: databaseValue.verno,
    books,
  })
  deserializeData(data)
  for (const [path, text] of [
    [DATA_FILENAME, data],
    [
      'covers.json',
      JSON.stringify(snapshot.covers.filter((c) => ids.has(c.id))),
    ],
    ['backup.json', JSON.stringify(manifest)],
  ]) {
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES)
      throw new BackupError('too_large')
    zip.file(path, text)
  }
  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'STORE',
  })
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new BackupError('too_large')
  return bytes
}

function mergeBook(
  local: BookRecord | undefined,
  incoming: BookRecord,
): BookRecord {
  const merged = mergeIncomingBookRecord(local, incoming)
  const annotations = new Map((local?.annotations || []).map((a) => [a.id, a]))
  for (const annotation of incoming.annotations) {
    if (
      !annotations.has(annotation.id) ||
      annotation.updatedAt >= annotations.get(annotation.id)!.updatedAt
    )
      annotations.set(annotation.id, annotation)
  }
  merged.annotations = [...annotations.values()]
  const chats = new Map(
    (local?.chatSessions || []).map((session) => [session.id, session]),
  )
  for (const session of incoming.chatSessions || []) {
    if (
      !chats.has(session.id) ||
      session.updatedAt >= chats.get(session.id)!.updatedAt
    )
      chats.set(session.id, session)
  }
  if (chats.size) merged.chatSessions = [...chats.values()]
  const messages = new Map((local?.chatHistory || []).map((m) => [m.id, m]))
  for (const message of incoming.chatHistory || []) {
    if (
      !messages.has(message.id) ||
      (incoming.updatedAt ?? incoming.createdAt) >=
        (local?.updatedAt ?? local?.createdAt ?? 0)
    )
      messages.set(message.id, message)
  }
  if (messages.size) merged.chatHistory = [...messages.values()]
  return merged
}

/** Validate/decode EVERYTHING before any write. Books, covers and files commit together. */
export async function restoreBackup(
  file: File,
  database: DB | null = db,
  storage: Storage | null = localStorageOrNull(),
  options: {
    restorePreferences?: boolean
    restoreReadingHistory?: boolean
    beforeCommit?: () => Promise<void>
  } = {},
): Promise<number> {
  const databaseValue = databaseOrThrow(database)
  if (file.size > MAX_ARCHIVE_BYTES) throw new BackupError('too_large')
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    return invalid()
  }
  const entries = Object.values(zip.files)
  if (entries.length > MAX_ENTRIES) throw new BackupError('too_large')
  let expanded = 0
  for (const entry of entries) {
    // JSZip sanitizes '..'. Reject the original name too, not just its normalized alias.
    const original = (entry as any).unsafeOriginalName || entry.name
    if (
      original.startsWith('/') ||
      original.includes('\\') ||
      original.split('/').includes('..')
    )
      invalid()
    const declared = (entry as any)._data?.uncompressedSize || 0
    expanded += declared
    if (
      !finite(declared) ||
      declared > MAX_FILE_BYTES ||
      expanded > MAX_EXPANDED_BYTES
    )
      throw new BackupError('too_large')
  }
  const readJSON = async (path: string): Promise<string> => {
    const entry = zip.file(path)
    if (!entry) invalid()
    if ((entry as any)._data?.uncompressedSize > MAX_JSON_BYTES)
      throw new BackupError('too_large')
    const bytes = await entry.async('uint8array')
    if (bytes.byteLength > MAX_JSON_BYTES) throw new BackupError('too_large')
    return new TextDecoder().decode(bytes)
  }
  const books = deserializeData(await readJSON(DATA_FILENAME))
  if (!books.length) invalid()
  const ids = new Set(books.map((b) => b.id))
  const covers: CoverRecord[] = parseJSON(await readJSON('covers.json'))
  if (!Array.isArray(covers)) invalid()
  const covered = new Set<string>()
  for (const cover of covers) {
    if (
      !record(cover) ||
      !ids.has(cover.id) ||
      covered.has(cover.id) ||
      (cover.cover !== null &&
        cover.cover !== undefined &&
        (typeof cover.cover !== 'string' ||
          !/^data:(?:image\/[a-z0-9.+-]+|application\/octet-stream);base64,[a-z0-9+/=\s]+$/i.test(
            cover.cover,
          )))
    )
      invalid()
    covered.add(cover.id)
  }
  const manifest: BackupManifest | undefined = zip.file('backup.json')
    ? parseJSON(await readJSON('backup.json'))
    : undefined
  if (
    manifest !== undefined &&
    (!record(manifest) ||
      manifest.format !== 'lumen-read-backup' ||
      manifest.version !== 1 ||
      !Array.isArray(manifest.files) ||
      manifest.files.length !== books.length ||
      !manifest.files.every((f) => record(f) && typeof f.id === 'string'))
  )
    invalid()
  const files: FileRecord[] = []
  const paths = new Set<string>()
  for (const book of books) {
    const descriptor = manifest?.files.find((f) => f.id === book.id)
    if (
      manifest &&
      (!descriptor ||
        !/^files\/[0-9]+\.epub$/.test(descriptor.path) ||
        typeof descriptor.name !== 'string' ||
        typeof descriptor.type !== 'string' ||
        !finite(descriptor.size) ||
        !finite(descriptor.lastModified) ||
        typeof descriptor.revision !== 'string' ||
        !/^lumen-file-sha256-v1:[0-9a-f]{64}$/.test(descriptor.revision))
    )
      invalid()
    const path = descriptor?.path || `files/${book.name}`
    if (paths.has(path)) invalid() // Old exports cannot disambiguate duplicate filenames.
    paths.add(path)
    const entry = zip.file(path)
    if (!entry) throw new BackupError('missing_file')
    const bytes = await entry.async('uint8array')
    if (bytes.byteLength > MAX_FILE_BYTES) throw new BackupError('too_large')
    if (descriptor && bytes.byteLength !== descriptor.size) invalid()
    const epub = new File(
      [new Uint8Array(bytes).buffer],
      descriptor?.name || book.name,
      {
        type: descriptor?.type || 'application/epub+zip',
        lastModified: descriptor?.lastModified ?? file.lastModified,
      },
    )
    const publicationRevision = await localFileRevision(epub)
    if (descriptor && publicationRevision !== descriptor.revision) invalid()
    files.push({ id: book.id, file: epub, publicationRevision })
    book.size = epub.size
  }
  const preferences =
    manifest?.preferences === undefined
      ? undefined
      : safePreferences(manifest.preferences)
  if (manifest?.readingHistory !== undefined) {
    if (typeof manifest.readingHistory !== 'string') invalid()
    history(manifest.readingHistory)
  }
  // Prove collisions before closing the user's open books or changing preferences.
  for (const incoming of files) {
    const existing = await databaseValue.files.get(incoming.id)
    if (
      existing &&
      (await localFileRevision(existing.file)) !== incoming.publicationRevision
    )
      throw new BackupError('conflict')
  }
  await options.beforeCommit?.()
  const writes: Record<string, string> = {}
  if (manifest?.preferences !== undefined) {
    if (options.restorePreferences !== false) Object.assign(writes, preferences)
  }
  if (manifest?.readingHistory !== undefined) {
    if (options.restoreReadingHistory !== false)
      writes.readingStats = mergeHistory(
        storage?.getItem('readingStats') || null,
        manifest.readingHistory,
      )
  }
  const previous = new Map<string, string | null>()
  try {
    for (const [key, value] of Object.entries(writes)) {
      if (!storage) throw new BackupError('unavailable')
      previous.set(key, storage.getItem(key))
      storage.setItem(key, value)
    }
    await databaseValue.transaction(
      'rw',
      [
        databaseValue.books,
        databaseValue.files,
        databaseValue.covers,
        databaseValue.canonicalLocationIndices,
        databaseValue.layoutAtlases,
        databaseValue.indices,
        databaseValue.vectors,
      ],
      async () => {
        for (const incoming of books) {
          const existing = await databaseValue.files.get(incoming.id)
          const staged = files.find((f) => f.id === incoming.id)!
          // Keep the transaction alive while proving the current bytes, including
          // changes made by another tab between preflight and this transaction.
          if (
            existing &&
            (await Dexie.waitFor(localFileRevision(existing.file))) !==
              staged.publicationRevision
          )
            throw new BackupError('conflict')
          await databaseValue.books.put(
            mergeBook(await databaseValue.books.get(incoming.id), incoming),
          )
          await databaseValue.files.put(
            existing
              ? { ...existing, publicationRevision: staged.publicationRevision }
              : staged,
          )
          // Valid caches for identical bytes remain usable. Orphan caches cannot
          // be proved to describe the newly recovered file and must be rebuilt.
          if (!existing) {
            await databaseValue.canonicalLocationIndices.delete(incoming.id)
            await databaseValue.layoutAtlases
              .where('bookId')
              .equals(incoming.id)
              .delete()
            await databaseValue.indices
              .where('bookId')
              .equals(incoming.id)
              .delete()
            await databaseValue.vectors
              .where('bookId')
              .equals(incoming.id)
              .delete()
          }
        }
        for (const cover of covers)
          if (!(await databaseValue.covers.get(cover.id))?.cover)
            await databaseValue.covers.put(cover)
      },
    )
  } catch (error) {
    for (const [key, value] of previous) {
      try {
        if (storage?.getItem(key) === value) continue
        value === null ? storage?.removeItem(key) : storage?.setItem(key, value)
      } catch {
        // Try every key even when storage is unusable. Preserve the original
        // failure; two independent browser stores cannot be crash-atomic.
        console.warn('Unable to roll back a local backup preference')
      }
    }
    throw error
  }
  return books.length
}
