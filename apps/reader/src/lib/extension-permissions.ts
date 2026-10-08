/** Optional transmission categories; local reading requires none of them. */
export type DataCollectionPermission =
  | 'authenticationInfo'
  | 'personalCommunications'
  | 'websiteContent'
  | 'technicalAndInteraction'

export const AI_AUTH_DATA_PERMISSIONS: DataCollectionPermission[] = [
  'authenticationInfo',
]
export const AI_CONTENT_DATA_PERMISSIONS: DataCollectionPermission[] = [
  'personalCommunications',
  'websiteContent',
]
export const DROPBOX_DATA_PERMISSIONS: DataCollectionPermission[] = [
  ...AI_AUTH_DATA_PERMISSIONS,
  ...AI_CONTENT_DATA_PERMISSIONS,
  'technicalAndInteraction',
]

type PermissionDetails = {
  origins?: string[]
  data_collection?: DataCollectionPermission[]
}

function getApi() {
  const globals = globalThis as any
  const extension = globals.browser || globals.chrome
  const permissions = extension?.permissions
  // Our Firefox manifest requires 142+, where native data consent is supported.
  // Detect its declaration synchronously: awaiting getAll() before request()
  // would lose the user gesture. Chromium must never receive this Firefox key.
  const nativeDataConsent = Boolean(
    globals.browser?.runtime?.getManifest?.()?.browser_specific_settings?.gecko
      ?.data_collection_permissions?.optional,
  )
  const isExtension = Boolean(extension?.runtime?.id || nativeDataConsent)
  return { permissions, nativeDataConsent, isExtension }
}

function detailsFor(
  origins: string[],
  data: DataCollectionPermission[],
  nativeDataConsent: boolean,
): PermissionDetails {
  return {
    ...(origins.length ? { origins } : {}),
    ...(nativeDataConsent && data.length ? { data_collection: data } : {}),
  }
}

/** Recheck on every transmission so revocation in about:addons takes effect. */
export async function hasExtensionPermissions(
  origins: string[] = [],
  data: DataCollectionPermission[] = [],
): Promise<boolean> {
  try {
    const { permissions, nativeDataConsent, isExtension } = getApi()
    const details = detailsFor(origins, data, nativeDataConsent)
    if (!Object.keys(details).length) return true
    // Browser development has no extension permissions API.
    if (!permissions?.contains) return !isExtension
    return await permissions.contains(details)
  } catch {
    return false
  }
}

/** Call directly from a click/change handler, with no preceding await. */
export function requestExtensionPermissions(
  origins: string[] = [],
  data: DataCollectionPermission[] = [],
): Promise<boolean> {
  try {
    const { permissions, nativeDataConsent, isExtension } = getApi()
    const details = detailsFor(origins, data, nativeDataConsent)
    if (!Object.keys(details).length) return Promise.resolve(true)
    if (!permissions?.request) return Promise.resolve(!isExtension)
    return Promise.resolve(permissions.request(details)).catch(() => false)
  } catch {
    return Promise.resolve(false)
  }
}

export function subscribeExtensionPermissionChanges(
  listener: () => void,
): () => void {
  const { permissions } = getApi()
  permissions?.onAdded?.addListener(listener)
  permissions?.onRemoved?.addListener(listener)
  return () => {
    permissions?.onAdded?.removeListener(listener)
    permissions?.onRemoved?.removeListener(listener)
  }
}
