# Firefox reviewer notes — Lumen Read 2.1.1

## Source and reproducible build

The supplied `Lumen-read-source-2.1.1.zip` is a Git archive of this release's
source commit: original React/TypeScript, local EPUB engine, scripts, lockfile
and bundled font assets/licenses. It does not contain `node_modules`, minified
build output, release ZIPs, credentials, private planning/audits or personal EPUBs.
The upstream public-domain Alice test fixtures are legitimate source fixtures.

Tested build environment: **Windows x64, Node 18.20.8, pnpm 10.6.4**.
Install Node 18.20.8 from the Node.js distribution archive and the Microsoft
Visual C++ Redistributable x64 required by Next.js's Windows SWC binary.
Node 18 is end-of-life; this documents the validated reproduction environment,
not a recommendation for new deployments. A supported-Node migration is still
separate work. Internet access is needed for the initial dependency installation.

From the extracted source directory, run:

```sh
corepack enable
corepack prepare pnpm@10.6.4 --activate
pnpm install --frozen-lockfile
pnpm package:firefox
```

The command runs lint/type checking, production bundle/static export, local
worker/WASM generation, manifest selection, output checks and ZIP packaging.
Result: `apps/Lumen-firefox.zip`. `apps/extension/dist` is the unpacked add-on.
`pnpm package:chrome` builds the separate Chromium package.

Build IDs are version-based and packaged text is normalized to LF. Compare
extracted package files, not ZIP container timestamps. Browser-only loader and
minifier choices are documented in the
[2.1.0 build notes](firefox-reviewer-notes-2.1.0.md#build-and-source).
Known Zod/legacy Webpack dynamic-code fallbacks are removed by fail-closed build
transformations; the extension CSP has not been weakened.

## Test the reader and backup

No Lumen account, subscription or API key is needed for ordinary reading or
local backups. An original noncommercial test book can be generated with:

```sh
node scripts/prepare-lumen-launch-demo.mjs
```

Import `artifacts/lumen-launch/small-pages-quiet-moments.epub` into the extension.
Open it, change chapters, close/reopen it and change typography/Theme.
Adaptive presentation (LPE) is an optional Beta toggle in Theme, off by default.

Open **Settings → Local backup**. Export the entire library or selected books;
global preferences and reading history are optional. Restore the ZIP using
**Import backup**, accepting the confirmation. Lumen validates before writing,
closes open book models before commit, and reloads after saving. A damaged ZIP
must fail with an error without removing the library. See the
[backup guide](readers/local-backup.md) for integrity checks, merge rules, old
format compatibility, size limits and crash-consistency limitations.

Additional checks:

```sh
pnpm test:reader-core
node scripts/verify-backup.mjs
```

The second command requires installed Firefox and Edge on Windows and uses
isolated temporary profiles with real File/IndexedDB.
The packaged Firefox UI smoke additionally requires geckodriver 0.37.1:

```powershell
$env:GECKODRIVER = 'C:\tools\geckodriver.exe'
$env:FIREFOX_BINARY = 'C:\Program Files\Firefox Developer Edition\firefox.exe'
node scripts/verify-backup-ui.mjs apps/Lumen-firefox.zip
```

It temporarily installs the exact package in a disposable headless profile;
it never uses the reviewer's regular browser profile. Seeded reading facts are
reported separately from the UI operations exercised. Generated screenshots/
reports remain in the named temporary directory, outside the extension/source.

## Permissions and optional services

The 2.1.0 permission/CSP model is unchanged. Books remain local by default;
production extension builds omit GTM/Sentry and use bundled UI fonts/icons.
Firefox declares required data transmission `none` and optional categories for
user-authorized AI and Dropbox. A local ZIP export performs no upload and excludes
API keys, service authorizations, downloaded models and reconstructible caches.
The ZIP itself is not encrypted and contains potentially private notes/chats.

Dropbox synchronization remains optional and asks for data permissions before
OAuth/sync. Remote AI also requires explicit access and sharing decisions.
See [the consent documentation](extension-data-consent.md) and
[2.1.0 optional-service test instructions](firefox-reviewer-notes-2.1.0.md#how-to-exercise-the-ordinary-reader).
No real service credentials are included or invented; the loopback mock only
validates transport, not model intelligence or cloud authentication.

## Validation and limitations

129 reader-core tests, production build gates, offline provider checks and AI
release-safety checks passed. The packaged UI is tested with Firefox Developer
Edition 158.0 on Windows in a disposable profile. Core backup persistence is
also tested in Edge.
The final Chromium package's backup screen, cross-browser ZIP restore and restored
book rendering passed in an isolated Edge 155 profile. The Chromium smoke accepts
the confirmation programmatically; Firefox separately exercises the native dialog.

Addons-linter 10.13.0, run separately using Node 22.21.1, reports **zero errors
and nine warnings** on the final Firefox package. Source dispositions are in
[2.1.0 reviewer notes](firefox-reviewer-notes-2.1.0.md#nine-addons-linter-warnings-source-attribution).
The DOMPurify, Next.js, ReactDOM, entity-decoder, micromark and Prism locations
are unchanged. The JSZip runtime-argument warning is now at
`_next/static/chunks/pages/_app-8efe5b403b3c11c1.js:21:144`.
These warnings are documented, not suppressed; this is not a security certification.
The reader's iframe stays sandboxed with `allow-same-origin`, without
`allow-scripts` or `allow-popups`, and uses `srcdoc` rather than DOM document.write.

Full Dropbox synchronization, genuine provider authentication, signed-AMO
first-install/upgrade consent, Firefox 142, Android/Linux and reproducibility
on other operating systems are not asserted as tested. Keep these limits in
mind when interpreting the release's verification evidence.

A clean extraction of the source archive, offline frozen-lockfile dependency
installation using the populated pnpm store, and `pnpm package:firefox` in a
separate folder reproduced all **79 extracted Firefox package files byte-for-byte**.
This checks source/build reproducibility on the environment above; archive
container timestamps were not compared. No signed-AMO artifact was produced.
