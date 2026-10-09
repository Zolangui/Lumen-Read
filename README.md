<div align="center">
  <img src="assets/icon.svg" alt="Lumen Read logo" width="120" height="120" />

# Lumen Read

A private, customizable EPUB reader for Firefox and Chromium browsers.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Firefox 142+](https://img.shields.io/badge/Firefox-142%2B-orange.svg)](apps/extension/manifests/firefox_manifest_v3.json)
[![Package manager: pnpm](https://img.shields.io/badge/package%20manager-pnpm-F69220.svg)](https://pnpm.io/)

</div>

Read your EPUBs comfortably in the browser you already use. Adjust the page to
your preferences, highlight a passage, and return to your book at your own pace.
Ordinary reading needs no Lumen account or AI key. AI and Dropbox are optional.

[Install Lumen Read from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/lumen-read/?utm_source=github&utm_medium=readme&utm_content=primary-cta&utm_campaign=reader-first)

## Start with one book

1. Install the signed Firefox add-on and open it from the browser toolbar.
2. Choose **Add New Book** in the library and select a local `.epub` file.
3. Open the book and use **Typography** and **Theme** to make reading comfortable.

No need to migrate your whole library to try it. See the
[getting-started guide](docs/readers/getting-started.md) or
[primeiros passos em português](docs/readers/primeiros-passos.md) for local
storage, optional connections and troubleshooting. EPUBs requiring DRM-specific
software are not supported; Lumen does not remove DRM.

## Highlights

- **Read your way** — customize fonts, spacing, themes, and layout globally or
  for one book at a time.
- **Stay focused** — use Zen Mode, dark mode, full-screen reading, and
  distraction-free controls.
- **Navigate confidently** — table of contents, timeline, in-book search,
  image preview, progress tracking, and reading locations.
- **Keep your notes** — highlight text, add annotations, and manage your
  reading library locally.
- **Understand your habits** — follow streaks and reading activity with a
  GitHub-style heatmap calendar.
- **Use AI only when you choose** — chat with a book, retrieve relevant
  excerpts, and use local or remote models from supported providers.

## Screenshots

<div align="center">
  <img src="assets/library.webp" alt="Lumen Read library grid" width="720" />
  <p><em>Library grid</em></p>

  <img src="assets/analytics.webp" alt="Lumen Read reading analytics" width="400" />
  <p><em>Reading analytics and activity heatmap</em></p>

</div>

## Privacy and optional connections

Lumen Read is local-first by default: books and ordinary reading data stay in
browser storage on your device.

- **AI is opt-in.** Remote AI features require you to choose a provider, grant
  the connection permission, and consent before book context is sent. The
  selected provider's own privacy terms apply to that request.
- **Keys are session-only.** Your AI API key is deliberately not persisted in
  browser `localStorage`.
- **Models are current, not hard-coded.** Choose an available model returned by
  your provider, or enter the ID offered by an approved compatible endpoint.
- **Local AI is optional.** Downloading local models and connecting to a local
  server both require an explicit action.
- **Dropbox sync is optional.** When enabled, selected library data is sent
  directly between your browser and Dropbox; it does not pass through a Lumen
  server.
- **No Sentry telemetry in extension releases.** Published extension builds do
  not include Sentry error or performance reporting.

Do not upload books unless you have the right to store, synchronize, or send
excerpts of them to the services you select.

## Install

### Firefox

Lumen Read is currently published for Firefox. Install the signed add-on from
[Firefox Add-ons](https://addons.mozilla.org/firefox/addon/lumen-read/) to receive
Mozilla-managed installation and updates.

For local development or temporary testing:

1. Build Firefox output with `pnpm build:ext:firefox:prod`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**.
4. Choose `apps/extension/dist/manifest.json`.

The `dist` folder is an unpacked development build. Temporary add-ons are removed
when Firefox restarts. The current manifest requires Firefox 142 or later.

### Chromium browsers

Lumen Read is not currently published in the Chrome Web Store. You can build and
load it manually in Chrome, Edge, Brave, and other Chromium browsers:

1. Run `pnpm build:ext:chrome:prod`.
2. Open the browser's extension page, for example `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose `apps/extension/dist`.

### Package Firefox for AMO

Build output and a distributable archive serve different purposes. `dist` is for
local temporary loading through its `manifest.json`; the ZIP is the archive to
submit to Mozilla Add-ons. Mozilla signs the submitted release, and Firefox users
install that signed release directly from the add-on page.

From the repository root (PowerShell, Bash, or another supported shell):

```bash
pnpm package:firefox
```

The archive is written to `apps/Lumen-firefox.zip`. The equivalent Chromium
command is `pnpm package:chrome`, which writes `apps/Lumen-chrome.zip`.

## Development

### Prerequisites

- A supported desktop operating system: Windows 10/11, macOS, or Linux
- Node.js 18.x (the project requires Node.js 18 or later)
- Corepack, included with supported Node.js releases
- pnpm 10.6.4, activated through Corepack below
- Git

On Windows, install the **Microsoft Visual C++ 2015-2022 Redistributable
(x64)**. Next.js uses a native SWC binary which requires this runtime.

### Setup

```bash
git clone https://github.com/Zolangui/Lumen-Read.git
cd Lumen-Read
corepack enable
corepack prepare pnpm@10.6.4 --activate
pnpm install --frozen-lockfile
```

Start the development workspace:

```bash
pnpm dev
```

### Validate and build

```bash
# Type check the reader
pnpm --filter @flow/reader exec tsc --noEmit --incremental false

# Verify AI provider configuration without API keys
pnpm verify:providers
pnpm verify:ai-release
pnpm verify:ai-mock

# Offline UI font/ligature smoke test (Windows, Edge and Firefox installed)
pnpm verify:ui-fonts

# Production builds
pnpm build:ext:chrome:prod
pnpm build:ext:firefox:prod
```

Each extension build writes browser-specific files to `apps/extension/dist`.
Build again for the target browser before loading or packaging it.

### Reproducible Firefox release build (AMO)

This repository is the source archive for the Firefox add-on. It contains the
TypeScript and React source, manifests, build scripts, and the locked dependency
graph used to create the submitted package. Generated files such as
`node_modules`, `.next`, `out`, `dist`, and release ZIP files are not source.

To reproduce the Firefox package from a clean checkout, use the following
commands from the repository root:

```bash
corepack enable
corepack prepare pnpm@10.6.4 --activate
pnpm install --frozen-lockfile
pnpm package:firefox
```

`pnpm package:firefox` runs the production Firefox build and packages its
contents as `apps/Lumen-firefox.zip`. The script invokes all
required build steps, including type checking, linting, static export, asset
copying, Firefox manifest selection, and ZIP packaging. This is the archive
submitted to Firefox Add-ons; do not submit the source archive itself as the
extension package.

For the current release verification, the tested environment is Windows x64,
Node.js 18.20.8 and pnpm 10.6.4. Node 18 is no longer supported upstream; newer
Node versions must be verified before claiming equivalent release output.
Specify the actual tested environment in the reviewer notes. Include the
vendored `apps/reader/public/fonts` directory and its licenses in source archives.

Extension exports use a version-based Next.js build ID and explicit minification
options for worker compilations, normalize packaged text to LF, and exclude
stale PWA assets. This avoids differences caused by build IDs, line endings
or leftovers from a previous web build. ZIP container timestamps
can differ; compare the extracted file contents when checking reproduction.

The extension and source archives must be produced from the same reviewed
source state. A Git archive contains committed files only: uncommitted fixes
and new font assets will not be included. Exclude personal EPUBs, credentials,
generated output and private audit documents from source submissions.

### Release smoke checks

Test the production extension, not only the presentation-test harness:

- With Adaptive disabled and enabled, open books, follow the TOC, cross chapter
  boundaries, switch books and change between single and double pages.
- Verify saved positions, Atlas totals, dark/light themes and Published fallback.
- In a fresh profile without network access, verify UI fonts and icon ligatures.
- Decline optional AI/sync permissions: local reading must remain available.
- Grant optional permissions only through their settings controls; revoke them
  in Firefox's Permissions and data panel and verify that transmissions stop.

Adaptive is opt-in in production. The presentation-test build enables it for
testing and uses a 7:1 minimum text contrast, versus 4.5:1 in production. A
Published fallback restores the published presentation; it does not silently
activate the legacy color-repair path.

## Contributing

Bug reports, usability feedback, translations, and pull requests are welcome.

1. Open an issue with reproduction steps, expected behavior, browser version,
   and extension version.
2. Keep pull requests scoped and include validation results.
3. Do not commit personal books, API keys, OAuth tokens, generated extension
   packages, or other private data.

## License and attribution

Lumen Read is licensed under [AGPL-3.0-only](LICENSE). If you distribute a
modified build, provide the corresponding source code under the same license
and keep the license and notices intact.

Lumen Read is an enhanced fork of [Flow](https://github.com/pacexy/flow).
Thanks to Flow, EPUB.js, React, Next.js, and the open-source projects that make
this reader possible.
