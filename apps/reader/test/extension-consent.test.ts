import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_AI_SETTINGS } from '../src/lib/ai/config'
import { LLMService } from '../src/lib/ai/llm'
import {
  hasProviderHostPermission,
  hasRemoteDataPermission,
  requestLocalModelHostPermissions,
  requestProviderHostPermission,
  requestRemoteDataPermission,
} from '../src/lib/ai/permissions'
import {
  AI_CONTENT_DATA_PERMISSIONS,
  DROPBOX_DATA_PERMISSIONS,
  hasExtensionPermissions,
  requestExtensionPermissions,
  subscribeExtensionPermissionChanges,
} from '../src/lib/extension-permissions'
import {
  authorizeDropboxWithPkce,
  DropboxConsentDeniedError,
  ensureDropboxAccessToken,
} from '../src/sync'

function firefox() {
  const permissions = {
    contains: vi.fn().mockResolvedValue(true),
    request: vi.fn().mockResolvedValue(true),
  }
  vi.stubGlobal('browser', {
    permissions,
    runtime: {
      getManifest: () => ({
        browser_specific_settings: {
          gecko: {
            data_collection_permissions: {
              required: ['none'],
              optional: DROPBOX_DATA_PERMISSIONS,
            },
          },
        },
      }),
    },
  })
  return permissions
}

function cloudService() {
  return new LLMService({
    ...DEFAULT_AI_SETTINGS,
    provider: 'openai',
    apiKey: 'test-key-not-a-real-secret',
    model: 'test-model',
    remoteDataConsent: true,
    remoteDataConsentProvider: 'openai',
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('optional extension transmission permissions', () => {
  it('requests cloud host + authentication synchronously in the gesture', async () => {
    const permissions = firefox()
    const pending = requestProviderHostPermission('openai')
    expect(permissions.request).toHaveBeenCalledWith({
      origins: ['https://api.openai.com/*'],
      data_collection: ['authenticationInfo'],
    })
    await expect(pending).resolves.toBe(true)
  })

  it('requests content separately, not when connecting or downloading models', async () => {
    const permissions = firefox()
    await requestRemoteDataPermission()
    expect(permissions.request).toHaveBeenLastCalledWith({
      data_collection: AI_CONTENT_DATA_PERMISSIONS,
    })
    await requestLocalModelHostPermissions()
    expect(permissions.request.mock.lastCall?.[0]).not.toHaveProperty(
      'data_collection',
    )
  })

  it('keeps loopback inference local without cloud data permissions', async () => {
    const permissions = firefox()
    await requestProviderHostPermission('local', 'http://localhost:8181/v1')
    expect(permissions.request).toHaveBeenCalledWith({
      origins: ['http://localhost/*'],
    })
    await hasProviderHostPermission('local', 'http://localhost:8181/v1')
    expect(permissions.contains).toHaveBeenCalledWith({
      origins: ['http://localhost/*'],
    })
  })

  it('does not send Firefox-only keys to Chromium', async () => {
    vi.stubGlobal('browser', undefined)
    const permissions = {
      request: vi.fn().mockResolvedValue(true),
      contains: vi.fn().mockResolvedValue(true),
    }
    vi.stubGlobal('chrome', { permissions })
    await requestProviderHostPermission('openai')
    expect(permissions.request).toHaveBeenCalledWith({
      origins: ['https://api.openai.com/*'],
    })
    await expect(requestRemoteDataPermission()).resolves.toBe(true)
    expect(permissions.request).toHaveBeenCalledTimes(1)
  })

  it('retains web development behavior without extension APIs', async () => {
    vi.stubGlobal('browser', undefined)
    vi.stubGlobal('chrome', undefined)
    await expect(requestRemoteDataPermission()).resolves.toBe(true)
    await expect(hasProviderHostPermission('openai')).resolves.toBe(true)
  })

  it('does not cache a permission across revocation', async () => {
    const permissions = firefox()
    permissions.contains
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    await expect(hasRemoteDataPermission()).resolves.toBe(true)
    await expect(hasRemoteDataPermission()).resolves.toBe(false)
    expect(permissions.contains).toHaveBeenCalledTimes(2)
  })

  it('fails closed on refusal, API errors and unavailable native APIs', async () => {
    const permissions = firefox()
    permissions.request.mockResolvedValueOnce(false)
    await expect(requestRemoteDataPermission()).resolves.toBe(false)
    permissions.request.mockRejectedValueOnce(new Error('denied'))
    await expect(requestRemoteDataPermission()).resolves.toBe(false)
    permissions.request.mockImplementationOnce(() => {
      throw new Error('no gesture')
    })
    await expect(requestRemoteDataPermission()).resolves.toBe(false)
    permissions.contains.mockRejectedValueOnce(new Error('unavailable'))
    await expect(hasRemoteDataPermission()).resolves.toBe(false)
    vi.stubGlobal('browser', {
      ...(globalThis as any).browser,
      permissions: {},
    })
    await expect(requestRemoteDataPermission()).resolves.toBe(false)
    await expect(hasRemoteDataPermission()).resolves.toBe(false)
  })

  it('blocks all cloud entry points without app consent, including auto-persona', async () => {
    firefox()
    const service = new LLMService({
      ...DEFAULT_AI_SETTINGS,
      provider: 'openai',
      apiKey: 'test-key',
    })
    const model = vi.spyOn(service as any, 'getModel')
    await expect(
      service.generateResponse('system', 'question'),
    ).rejects.toThrow('remote_consent_required')
    await expect(
      service.streamResponse('system', 'question').next(),
    ).rejects.toThrow('remote_consent_required')
    await expect(service.classifyBook({ title: 'book' })).rejects.toThrow(
      'remote_consent_required',
    )
    expect(model).not.toHaveBeenCalled()
  })

  it('blocks cloud transmission after native content permission is revoked', async () => {
    firefox().contains.mockResolvedValue(false)
    const service = cloudService()
    const model = vi.spyOn(service as any, 'getModel')
    await expect(
      service.generateResponse('system', 'question'),
    ).rejects.toThrow('remote_consent_required')
    expect(model).not.toHaveBeenCalled()
  })

  it('blocks an API key when native authentication permission is revoked', async () => {
    const permissions = firefox()
    permissions.contains.mockImplementation(
      async (details) =>
        !details.data_collection?.includes('authenticationInfo'),
    )
    const service = cloudService()
    const model = vi.spyOn(service as any, 'getModel')
    await expect(
      service.generateResponse('system', 'question'),
    ).rejects.toThrow('host_permission_required')
    expect(model).not.toHaveBeenCalled()
  })

  it('allows an explicitly consented cloud call without contacting a real provider', async () => {
    firefox()
    const service = cloudService()
    const invoke = vi.fn().mockResolvedValue({ content: 'ok' })
    vi.spyOn(service as any, 'getModel').mockReturnValue({ invoke })
    await expect(service.generateResponse('system', 'question')).resolves.toBe(
      'ok',
    )
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('blocks Dropbox before token refresh or OAuth when data consent is denied', async () => {
    const permissions = firefox()
    permissions.contains.mockResolvedValue(false)
    await expect(ensureDropboxAccessToken()).rejects.toThrow(
      'Dropbox transmission permission required',
    )
    permissions.request.mockResolvedValue(false)
    const pending = authorizeDropboxWithPkce()
    expect(permissions.request).toHaveBeenCalledWith({
      data_collection: DROPBOX_DATA_PERMISSIONS,
    })
    await expect(pending).rejects.toBeInstanceOf(DropboxConsentDeniedError)
  })

  it('requests/checks no empty permission object on Chromium', async () => {
    vi.stubGlobal('browser', undefined)
    const permissions = { request: vi.fn(), contains: vi.fn() }
    vi.stubGlobal('chrome', { permissions })
    await expect(requestExtensionPermissions()).resolves.toBe(true)
    await expect(hasExtensionPermissions()).resolves.toBe(true)
    expect(permissions.request).not.toHaveBeenCalled()
    expect(permissions.contains).not.toHaveBeenCalled()
  })

  it('reuses an existing Dropbox token only after explicit native consent', async () => {
    const permissions = firefox()
    const extension = (globalThis as any).browser
    extension.runtime.id = 'test-extension'
    extension.identity = { launchWebAuthFlow: vi.fn(), getRedirectURL: vi.fn() }
    extension.storage = {
      local: {
        get: vi
          .fn()
          .mockResolvedValue({ 'dropbox-refresh-token': 'test-refresh' }),
      },
    }
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'test-access', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('window', { fetch })
    await expect(authorizeDropboxWithPkce()).resolves.toBeUndefined()
    expect(permissions.request).toHaveBeenCalledWith({
      data_collection: DROPBOX_DATA_PERMISSIONS,
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://api.dropboxapi.com/oauth2/token',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(extension.identity.launchWebAuthFlow).not.toHaveBeenCalled()
  })

  it('fails closed when an installed Chromium extension loses its permission API', async () => {
    vi.stubGlobal('browser', undefined)
    vi.stubGlobal('chrome', { runtime: { id: 'test-extension' } })
    await expect(requestProviderHostPermission('openai')).resolves.toBe(false)
    await expect(hasProviderHostPermission('openai')).resolves.toBe(false)
  })

  it('subscribes to native permission changes and removes both listeners', () => {
    firefox()
    const onAdded = { addListener: vi.fn(), removeListener: vi.fn() }
    const onRemoved = { addListener: vi.fn(), removeListener: vi.fn() }
    Object.assign((globalThis as any).browser.permissions, {
      onAdded,
      onRemoved,
    })
    const listener = vi.fn()
    const unsubscribe = subscribeExtensionPermissionChanges(listener)
    expect(onAdded.addListener).toHaveBeenCalledWith(listener)
    expect(onRemoved.addListener).toHaveBeenCalledWith(listener)
    unsubscribe()
    expect(onAdded.removeListener).toHaveBeenCalledWith(listener)
    expect(onRemoved.removeListener).toHaveBeenCalledWith(listener)
  })
})
