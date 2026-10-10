import { proxy, snapshot } from 'valtio'

import type { BookRecord } from '../db'

/** Capture nested reactive fields before IndexedDB's structured clone boundary. */
export function persistableBookChanges(
  changes: Partial<BookRecord>,
): Partial<BookRecord> {
  // A shallow spread does not unwrap canonical positions/metric identities.
  // Keep undefined values: they intentionally clear obsolete persisted fields.
  return snapshot(proxy(changes)) as Partial<BookRecord>
}
