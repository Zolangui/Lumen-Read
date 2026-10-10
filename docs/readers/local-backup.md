# Local backups

Open **Settings → Local backup**. Automatic Dropbox synchronization remains a
separate, optional feature; exporting a ZIP does not connect to Dropbox or upload
anything. You may store the downloaded ZIP yourself.

## Choose what to export

- **Entire library** or **Selected books**.
- EPUB files, available covers, annotations and notes, saved chats, reading
  positions, favourites and per-book typography are included for the chosen books.
- **Global appearance and library preferences** can be included or omitted.
- **Reading history and calendar** can be included or omitted. When exporting
  selected books, only their recorded reading sessions are included.

API keys, service credentials and permissions, downloaded AI models, vector
indexes and visual pagination caches are not exported. The ZIP is **not
encrypted**: treat it as private, especially if it contains notes or chats.

## Restore a backup

Use **Import backup** in the same section. You can decline restoration of global
preferences and reading history while still recovering the books and their own
settings. Importing a single ZIP through the library file picker also works;
that path restores included preferences and history.

After validation, open book tabs close to prevent stale reading models from
overwriting restored data. Lumen reloads only after saving has completed.

Books already in the library are matched by their internal IDs. Newer saved
positions are retained, annotations and conversations are merged by ID and
timestamp, and unrelated books are not removed. Global preferences, when
accepted, replace the exported preference groups rather than merging each field.
If an existing ID belongs to different EPUB bytes, import stops instead of
replacing that book. Identical EPUB bytes can share a filename without collision.

Reading sessions are merged rather than blindly added again. Canonical session
IDs and legacy book/day records prevent repeated imports of the same backup from
inflating totals. Independent devices with overlapping, already-compacted
histories cannot always be reconciled exactly; this is not a multi-device
reading-session synchronization protocol.

## Validation, limits and older backups

New backups verify EPUB bytes with SHA-256. Archive contents are decoded and
validated before writes; books, EPUBs, covers and cache changes commit in one
IndexedDB transaction. A handled failure also attempts to restore the previous
preference/history values. IndexedDB and localStorage cannot form one
crash-atomic transaction, so
power loss or another open Lumen window can still interfere: close other Lumen
windows during a restore and keep the original ZIP.

Limits are 512 MiB per backup ZIP, 256 MiB per embedded EPUB, 1 GiB expanded
archive data, 16 MiB per JSON entry and 5,000 archive entries. Export a smaller
selection if needed. The complete file must be available locally; missing books
cause an explicit error, not an apparently successful but incomplete backup.

Legacy v1/v2 ZIPs with `data.json`, `covers.json` and `files/<filename>` remain
supported. They lack the new byte checksums. An old ZIP that has already lost one
of two same-named EPUB files cannot recover that missing file; export a fresh
backup from a complete library.

The additive `backup.json` manifest identifies the new local archive format.
Do not assume an older Lumen installation can restore a newly generated ZIP.
