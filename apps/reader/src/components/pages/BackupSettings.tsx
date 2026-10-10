import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'

import { BackupError } from '../../backup'
import { db } from '../../db'
import { useTranslation } from '../../hooks/useTranslation'
import { importLocalBackup } from '../../lib/backup-ui'
import { pack } from '../../sync'

export function BackupSettings() {
  const t = useTranslation('settings.backup')
  const books = useLiveQuery(() => db?.books.toArray() ?? [], [])
  const input = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const [scope, setScope] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const [preferences, setPreferences] = useState(true)
  const [history, setHistory] = useState(true)
  const [restoreExtras, setRestoreExtras] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const showError = (error: unknown) => {
    const code = error instanceof BackupError ? error.code : 'failed'
    setStatus(t(`error.${code}`))
  }
  const exportBackup = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setStatus(t('exporting'))
    try {
      await pack({
        bookIds: scope === 'selected' ? selected : undefined,
        includePreferences: preferences,
        includeReadingHistory: history,
      })
      setStatus(t('exported'))
    } catch (error) {
      showError(error)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  const importBackup = async (file: File) => {
    if (pending.current || !window.confirm(t('confirm_import'))) return
    pending.current = true
    setBusy(true)
    setStatus(t('importing'))
    try {
      await importLocalBackup(file, restoreExtras)
    } catch (error) {
      showError(error)
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <section
      className="border-b border-gray-200 pb-8 dark:border-gray-700"
      aria-busy={busy}
    >
      <h2 className="text-lg font-medium text-gray-900 dark:text-white">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {t('description')}
      </p>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {t('contents')}
      </p>
      <fieldset disabled={busy} className="mt-4 space-y-3">
        <legend className="mb-2 text-sm font-medium">{t('scope')}</legend>
        <select
          aria-label={t('scope')}
          className="w-full rounded-lg bg-gray-100 p-3 dark:bg-gray-800"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="all">{t('all')}</option>
          <option value="selected">{t('selected')}</option>
        </select>
        {scope === 'selected' && (
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            {(books || []).map((book) => (
              <label
                key={book.id}
                className="flex min-w-0 items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(book.id)}
                  onChange={(e) =>
                    setSelected((ids) =>
                      e.target.checked
                        ? [...ids, book.id]
                        : ids.filter((id) => id !== book.id),
                    )
                  }
                />
                <span className="min-w-0 truncate" title={book.name}>
                  {book.metadata.title || book.name}
                </span>
              </label>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preferences}
            onChange={(e) => setPreferences(e.target.checked)}
          />
          {t('preferences')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={history}
            onChange={(e) => setHistory(e.target.checked)}
          />
          {t('history')}
        </label>
        <button
          type="button"
          className="bg-primary text-on-primary rounded-full px-6 py-2.5 font-medium disabled:opacity-50"
          disabled={
            !books?.length || (scope === 'selected' && !selected.length)
          }
          onClick={() => void exportBackup()}
        >
          {t('export')}
        </button>
      </fieldset>
      <fieldset disabled={busy} className="mt-6 space-y-3">
        <legend className="mb-2 text-sm font-medium">{t('import')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={restoreExtras}
            onChange={(e) => setRestoreExtras(e.target.checked)}
          />
          {t('restore_extras')}
        </label>
        <input
          ref={input}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importBackup(file)
          }}
        />
        <button
          type="button"
          className="bg-primary text-on-primary rounded-full px-6 py-2.5 font-medium"
          onClick={() => input.current?.click()}
        >
          {t('import')}
        </button>
      </fieldset>
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        {t('privacy')}
      </p>
      {status && (
        <p role="status" aria-live="polite" className="mt-3 text-sm">
          {status}
        </p>
      )}
    </section>
  )
}
