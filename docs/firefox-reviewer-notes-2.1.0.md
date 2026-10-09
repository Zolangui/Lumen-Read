# Firefox reviewer notes — Lumen Read 2.1.0

Build instructions and review context for the owner's AMO submission. Use the
new release packages, not an older ZIP with the same version label.

## Build and source

The add-on is built from React/TypeScript with Next.js/Webpack. Original source,
workspace packages, local engine, scripts, lockfile and local UI-font assets with
licenses must be included in the submitted source archive. Exclude credentials,
personal/commercial EPUBs, private audit reports, `node_modules`, generated
`.next`/`out`/`dist`, and release ZIPs from that source archive.

The currently tested build environment is Windows x64, Node 18.20.8 and pnpm
10.6.4. Node 18 is upstream end-of-life; this is a reproducibility disclosure,
not a recommendation to use it for unrelated/new deployments. A supported-Node
migration has not been validated for equivalent release output. Addons-linter
10.13.0 was run separately with Node 22.

From the root of the supplied source archive:

```sh
corepack enable
corepack prepare pnpm@10.6.4 --activate
pnpm install --frozen-lockfile
pnpm package:firefox
```

The build performs linting, type checking, production bundling, static export,
local worker/WASM generation, manifest selection and output checks. The package
is written to `apps/Lumen-firefox.zip`. `apps/extension/dist` is the unpacked
extension, not the source archive. Follow the README's installation prerequisites.
Both submitted archives must come from the same final, approved source state;
`git archive` alone excludes currently uncommitted files and new assets.

Export build IDs are derived from the extension version. Minification is
configured explicitly, including for worker compilations.
Packaged text uses LF regardless of checkout line endings. Old `sw.js` and
`workbox-*.js` web/PWA files are excluded. Compare extracted files, not ZIP
container bytes, because archive timestamps can differ.

Extension-only Zod adaptation is in `scripts/loaders/zod-csp-loader.js`, applied
to original util/doc modules before bundling. It removes an optional dynamic-code
probe and selects the existing non-JIT interpreter. It fails the build when the
known upstream implementation changes. The CSP is not relaxed. Build scripts
also remove known legacy Webpack global-detection Function fallbacks and unused
nomodule polyfills; see `scripts/build-extension.js` for the exact transformations.

## How to exercise the ordinary reader

Reading requires no Lumen account, paid service or API key. Open the extension,
import an authorized EPUB, open it, navigate via TOC/page controls, select text
to create a highlight/note, and change typography or Theme. Adaptive presentation
is an optional Beta toggle in Theme, off by default in production.

For an original, noncommercial sample, run
`node scripts/prepare-lumen-launch-demo.mjs`. It generates
`artifacts/lumen-launch/small-pages-quiet-moments.epub` for manual import; that
generated EPUB must not be included in the extension package.

AI and Dropbox are optional. No test credentials are included or invented.
The optional loopback mock is `node scripts/ai-mock-server.cjs`; configure Local,
`http://127.0.0.1:8181/v1`, and model `lumen-mock-1`, allow the loopback connection,
then run Test Connection. To exercise chat streaming without indexing, use
Book + Context scope and send Hello. This mock is transport testing, not a real
language model or substitute for genuine provider authentication.

## Privacy and permissions

Ordinary books/reading data are local by default. Published extension builds
disable GTM and Sentry and bundle their UI fonts/icons. Firefox declares required
data transmission `none`, with optional categories for user-authorized AI/sync.
Provider host access and successful API authentication are distinct UI states.
Book/chat sharing is separately controlled and rechecked before cloud requests.
Dropbox additionally asks for its data permissions before OAuth/sync. Revocation
blocks subsequent requests, not data already transmitted. See
[consent documentation](extension-data-consent.md) for exact category mapping.

## Nine addons-linter warnings: source attribution

Audit target: the production `apps/extension/dist` built and checked on
2026-10-07. Chunk names/locations identify that exact build and will change
after rebuilding. These are source-based dispositions, not a request to suppress
the validator and not an independent security certification.

| Count | Built location                                         | Original code and disposition                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `849-779254002a1df688.js:5:115757`                     | DOMPurify 3.3.1 `dist/purify.js` `_initDocument` fallback, around line 873. It parses input into a separate document before sanitization; this warning is inside the sanitizer, not a direct assignment of book descriptions to the app. `BookDetailsModal.tsx` uses `DOMPurify.sanitize` with a restricted tag/attribute allowlist and safe-link hook before its React HTML sink. Do not bypass that sanitization.    |
| 1     | `main-b31def3db8acf66b.js:1:14055`                     | Next.js 12.3.4 `dist/client/head-manager.js`, `reactElementToDOM`, around line 71. Framework implementation of `dangerouslySetInnerHTML` for head nodes. App-provided inline data must remain reviewed; book titles used as React text are not authorization to insert arbitrary HTML.                                                                                                                                 |
| 1     | `main-b31def3db8acf66b.js:7:2104`                      | Next.js 12.3.4 `dist/client/script.js`, around line 68: generic inline-script handling. The extension's `_document.tsx` excludes both GTM paths and loads its theme initializer from a bundled file. Strict CSP prohibits arbitrary inline/remote scripts. This branch's presence does not establish that it executes in production.                                                                                   |
| 2     | `framework-32a9d04abc1ee8ef.js:13:6524` and `:13:6584` | ReactDOM 18.0.0 HTML/SVG setting helper and its legacy SVG fallback. The concrete user-controlled application HTML sink reviewed here is the sanitized book-description path above; ordinary React text children are not HTML. Framework code was not broadly rewritten or claimed inherently safe.                                                                                                                    |
| 1     | `354.927cbc533b9bcd63.js:7:20404`                      | `decode-named-character-reference` 1.3.0, `index.dom.js`: assigns `&` + entity name + `;` to a detached element and reads `textContent`. In the reviewed Markdown path, micromark's `characterReferenceValue` tokenizer restricts named references to ASCII alphanumeric characters before the call. This is not a whole-message HTML rendering path.                                                                  |
| 1     | `354.927cbc533b9bcd63.js:9:1754`                       | mdast-util-from-markdown's `parse(options).document().write(...)`. `document()` is micromark's tokenizer factory, **not** the browser DOM document, and `write` consumes parser input to generate tokens/AST. See micromark `lib/parse.js`. The application renders Markdown with ReactMarkdown without `rehypeRaw`.                                                                                                   |
| 1     | `354.927cbc533b9bcd63.js:19:23144`                     | Prism 1.30.0 `components/prism-markdown.js`, optional autoloader hook, around line 348. It sets syntax-highlighted output; Prism's `util.encode` escapes ampersands/less-than before HTML generation. Lumen's `ChatMessage.tsx` uses PrismLight with locally registered languages; no autoloader is imported there. Keep that invariant and strict local-script CSP; do not infer safety for arbitrary future plugins. |
| 1     | `pages/_app-bef1cecf1498a167.js:21:144`                | JSZip 3.10.1's bundled Browserify/CommonJS module invocation (license header immediately precedes it). A packaging/runtime argument warning, not a dynamic-code execution finding. The reviewed occurrence does not construct code or initiate a remote request.                                                                                                                                                       |

Additional boundary checked in original source: the real EPUB renderer uses the
local engine's iframe view with `sandbox="allow-same-origin"`, **without**
`allow-scripts` or `allow-popups`. `reader.ts` explicitly sets both options false;
the view uses `srcdoc`, not browser `document.write`. Imported EPUB HTML is not
claimed sanitized like a book description; its execution boundary is the sandbox
plus strict extension CSP. The old inline view's HTML sink must not be enabled
for untrusted books without a separate security review.

## Verification limits

83 reader-core tests passed; production build/output gates passed; addons-linter
reported zero errors and the nine warnings above. Production smoke tests used
Firefox Developer Edition 158.0 on Windows in disposable profiles. Reader,
optional Adaptive on/off, consent denial/revocation, local streaming, narrow AI
setup, and local fonts were exercised. A further launch capture inspected the
reader iframe's actual sandbox value.

Signed-AMO first-install/upgrade consent, genuine cloud authentication, full
Dropbox synchronization, Firefox 142, Android/Linux and clean source-archive
reproduction are **not** represented as completed. Review the dated
[release notes and verification limits](releases/2.1.0.md) before final submission.
