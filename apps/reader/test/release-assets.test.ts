import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { describe, expect, it } from 'vitest'

import locales from '../locales'

const readerRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(readerRoot, '../..')

describe('offline UI and release metadata', () => {
  it('translates every local-backup control and outcome in all supported languages', () => {
    const keys = Object.keys(locales['en-US']).filter((key) =>
      key.startsWith('settings.backup.'),
    )
    expect(keys.length).toBeGreaterThan(20)
    for (const dictionary of Object.values(locales))
      for (const key of keys)
        expect((dictionary as Record<string, string>)[key]).toBeTruthy()
  })
  it('uses a repeatable export build ID and invalidates caches on version changes', async () => {
    const version = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'apps/extension/package.json'),
        'utf8',
      ),
    ).version
    // This unit tests the real config's ID contract. Full package builds test
    // its plugin integration separately; do not load their timers/watchers in
    // the unit runner or depend on its cwd/environment.
    const configModule: { exports: Record<string, any> } = { exports: {} }
    vm.runInNewContext(
      fs.readFileSync(path.join(readerRoot, 'next.config.js'), 'utf8'),
      {
        module: configModule,
        __dirname: readerRoot,
        process: {
          env: { NEXT_PUBLIC_IS_EXPORT: 'true', NODE_ENV: 'production' },
        },
        require: (name: string) => {
          if (name === 'path') return path
          if (name === '../extension/package.json') return { version }
          if (name === '@sentry/nextjs') {
            return { withSentryConfig: (config: unknown) => config }
          }
          if (
            [
              '@next/bundle-analyzer',
              'next-pwa',
              'next-transpile-modules',
            ].includes(name)
          ) {
            return () => (config: unknown) => config
          }
          throw new Error(`Unexpected config dependency: ${name}`)
        },
      },
    )
    expect(await configModule.exports.generateBuildId()).toBe(
      `lumen-${version}`,
    )
    expect(await configModule.exports.generateBuildId()).toBe(
      `lumen-${version}`,
    )
    const turbo = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'turbo.json'), 'utf8'),
    )
    expect(turbo.globalDependencies).toContain('apps/extension/package.json')
  })
  it('localizes all Dropbox authorization outcomes in every supported language', () => {
    for (const dictionary of Object.values(locales)) {
      for (const status of [
        'pending',
        'authorized',
        'denied',
        'failed',
        'disconnected',
        'permission_required',
      ]) {
        expect(
          (dictionary as Record<string, string>)[
            `settings.synchronization.status.${status}`
          ],
        ).toBeTruthy()
      }
    }
  })

  it('labels provider selection neutrally, without claiming a tested connection', () => {
    const sidebar = fs.readFileSync(
      path.join(readerRoot, 'src/components/ChatbotSidebar.tsx'),
      'utf8',
    )
    expect(sidebar).not.toContain("t('chatbot.connected_to')")
    expect(sidebar).toContain("{t('provider')}: {settings.provider}")
  })
  it('uses eight local WOFF2 faces instead of external font imports', () => {
    const css = fs.readFileSync(
      path.join(readerRoot, 'src/pages/styles.css'),
      'utf8',
    )
    expect(css).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/)
    const urls = Array.from(css.matchAll(/url\('\/fonts\/([^']+\.woff2)'\)/g))
    expect(urls).toHaveLength(8)
    for (const [, name] of urls) {
      const bytes = fs.readFileSync(path.join(readerRoot, 'public/fonts', name))
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOF2')
      expect(bytes.length).toBeGreaterThan(1000)
    }
    expect(css).toContain("font-family: 'Material Symbols Outlined'")
    expect(css).toContain("font-feature-settings: 'liga'")
    for (const name of ['Inter-OFL.txt', 'Material-Symbols-LICENSE.txt']) {
      expect(
        fs.readFileSync(path.join(readerRoot, 'public/fonts', name), 'utf8')
          .length,
      ).toBeGreaterThan(1000)
    }
  })

  it('keeps both browser manifests and package metadata on the same version', () => {
    const extensionRoot = path.join(repoRoot, 'apps/extension')
    const version = JSON.parse(
      fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'),
    ).version
    for (const browser of ['firefox', 'chrome']) {
      const manifest = JSON.parse(
        fs.readFileSync(
          path.join(extensionRoot, 'manifests', `${browser}_manifest_v3.json`),
          'utf8',
        ),
      )
      expect(manifest.version).toBe(version)
      if (browser === 'firefox') {
        expect(
          manifest.browser_specific_settings.gecko.data_collection_permissions
            .required,
        ).toEqual(['none'])
        expect(
          manifest.browser_specific_settings.gecko.data_collection_permissions
            .optional,
        ).toEqual([
          'authenticationInfo',
          'personalCommunications',
          'websiteContent',
          'technicalAndInteraction',
        ])
      }
    }
  })

  it('blocks both GTM paths in extension exports', () => {
    const document = fs.readFileSync(
      path.join(readerRoot, 'src/pages/_document.tsx'),
      'utf8',
    )
    expect(
      document.match(/if \(!GTM_ID \|\| IS_EXTENSION_EXPORT\) return null/g),
    ).toHaveLength(2)
  })
})
