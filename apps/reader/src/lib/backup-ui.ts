import locales from '../../locales'
import { BackupError, restoreBackup } from '../backup'
import { db } from '../db'
import { BookTab, reader } from '../models'

function backupText(key: string): string {
  let locale = 'en-US'
  try {
    locale =
      JSON.parse(window.localStorage.getItem('settings') || '{}').locale ||
      locale
  } catch {
    /* Use English for corrupt settings. */
  }
  const dictionaries = locales as unknown as Record<
    string,
    Record<string, string>
  >
  return (
    dictionaries[locale]?.[`settings.backup.${key}`] ||
    dictionaries['en-US'][`settings.backup.${key}`]
  )
}

export function confirmBackupImport() {
  return window.confirm(backupText('confirm_import'))
}

export function showBackupImportError(error: unknown) {
  window.alert(
    backupText(`error.${error instanceof BackupError ? error.code : 'failed'}`),
  )
}

/** Close stale book models before restoring; reload only after every write finished. */
export async function importLocalBackup(file: File, restoreExtras = true) {
  const count = await restoreBackup(file, db, window.localStorage, {
    restorePreferences: restoreExtras,
    restoreReadingHistory: restoreExtras,
    beforeCommit: async () => {
      for (let group = reader.groups.length - 1; group >= 0; group--) {
        for (let tab = reader.groups[group].tabs.length - 1; tab >= 0; tab--) {
          if (reader.groups[group].tabs[tab] instanceof BookTab)
            reader.removeTab(tab, group)
        }
      }
      // Let React release reading sessions before merging saved history.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    },
  })
  window.location.reload()
  return count
}
