import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import locales from '../locales'

const readerRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(readerRoot, '../..')

describe('offline UI and release metadata', () => {
  it('uses a repeatable export build ID and invalidates caches on version changes', () => {
    // next-transpile-modules resolves workspace dependencies from cwd. Load
    // the real config in a separate process, as the reader build does, without
    // mutating the test runner's environment or module cache.
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        "const config = require('./next.config.js'); Promise.all([config.generateBuildId(), config.generateBuildId()]).then(ids => console.log(JSON.stringify(ids)))",
      ],
      {
        cwd: readerRoot,
        env: { ...process.env, NEXT_PUBLIC_IS_EXPORT: 'true' },
        encoding: 'utf8',
        timeout: 30000,
        windowsHide: true,
      },
    )
    const version = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'apps/extension/package.json'),
        'utf8',
      ),
    ).version
    expect(JSON.parse(output.trim())).toEqual([
      `lumen-${version}`,
      `lumen-${version}`,
    ])
    const turbo = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'turbo.json'), 'utf8'),
    )
    expect(turbo.globalDependencies).toContain('apps/extension/package.json')
  }, 35000)
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
