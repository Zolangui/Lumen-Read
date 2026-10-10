/** Read primary keys without loading serialized vector-index payloads. */
export function indexedBookIdsFromKeys(keys: readonly unknown[]): Set<string> {
  const ids = new Set<string>()
  for (const key of keys) {
    if (Array.isArray(key)) {
      if (
        key.length === 2 &&
        typeof key[0] === 'string' &&
        key[1] === 'chunks'
      ) {
        ids.add(key[0])
      }
    } else if (typeof key === 'string') {
      // Before compound keys, the one index per book contained its chunks.
      ids.add(key)
    }
  }
  return ids
}
