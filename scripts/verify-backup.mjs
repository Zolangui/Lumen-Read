import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Real browser File/IndexedDB, not a fake IDB shim. Never use the user's profile.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('esbuild-loader'))('esbuild')
const source = `
import JSZip from 'jszip'
import { createBackup, restoreBackup } from './backup'
import { DB } from './db'
const databases = []
const check = (ok, message) => { if (!ok) throw new Error(message) }
async function main() {
  try {
    const source = new DB('lumen-backup-browser-source')
    const target = new DB('lumen-backup-browser-target')
    databases.push(source, target)
    await source.open()
    await target.open()
    const epub = new JSZip()
    epub.file('mimetype', 'application/epub+zip')
    epub.file('META-INF/container.xml', '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    epub.file('book.opf', '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">lumen-backup-fixture</dc:identifier><dc:title>Backup fixture</dc:title><dc:language>en</dc:language></metadata><manifest><item id="text" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="text"/></spine></package>')
    const originals = new Map()
    for (const id of ['one', 'two']) {
      epub.file('chapter.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Fixture</title></head><body><p>' + id + '</p></body></html>')
      const bytes = await epub.generateAsync({ type: 'uint8array' })
      const file = new File([bytes], 'mesmo-nome.epub', { type: 'application/epub+zip', lastModified: 123 })
      originals.set(id, Array.from(bytes).join(','))
      await source.files.put({ id, file })
      await source.books.put({
        id, name: file.name, size: file.size, createdAt: 1,
        metadata: { title: id }, cfi: 'epubcfi(/6/2!/4/2/1:0)',
        configuration: { typography: { fontSize: '22px' } },
        annotations: [{ id: 'note-' + id, bookId: id, cfi: 'epubcfi(/6/2!/4/2/1:0)', text: 'Fixture', notes: 'Saved note', createAt: 1, updatedAt: 2, spine: { index: 0, title: 'Chapter' }, type: 'highlight', color: 'yellow' }],
        chatSessions: [{ id: 'chat-' + id, createdAt: 1, updatedAt: 2, messages: [{ id: 'message', role: 'user', content: 'Saved chat' }] }]
      })
      await source.covers.put({ id, cover: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' })
    }
    localStorage.setItem('settings', JSON.stringify({ theme: { source: '#0EA5E9', background: -1, adaptivePresentation: true } }))
    localStorage.setItem('aiSettings', 'private-session-marker')
    localStorage.setItem('readingStats', JSON.stringify({ sessions: [{ bookId: 'one', date: '2026-10-10', duration: 5, pagesRead: 3 }] }))
    const bytes = await createBackup({ includePreferences: true, includeReadingHistory: true }, source, localStorage)
    const backup = new File([bytes], 'backup.zip', { type: '' })
    localStorage.setItem('settings', '{}')
    check(await restoreBackup(backup, target, localStorage) === 2, 'wrong restored count')
    check(await restoreBackup(backup, target, localStorage) === 2, 'repeat import failed')
    for (const id of ['one', 'two']) {
      const saved = await target.files.get(id)
      check(saved.file instanceof File, 'IndexedDB lost File identity')
      check(saved.file.name === 'mesmo-nome.epub' && saved.file.lastModified === 123, 'File metadata changed')
      check(Array.from(new Uint8Array(await saved.file.arrayBuffer())).join(',') === originals.get(id), 'EPUB bytes changed')
      const savedBook = await target.books.get(id)
      check(savedBook.annotations[0].notes === 'Saved note', 'note missing')
      check(savedBook.chatSessions[0].messages[0].content === 'Saved chat', 'chat missing')
      check(savedBook.configuration.typography.fontSize === '22px', 'per-book setting missing')
      check(savedBook.cfi === 'epubcfi(/6/2!/4/2/1:0)', 'position missing')
      check(!!(await target.covers.get(id)).cover, 'cover missing')
    }
    check(JSON.parse(localStorage.getItem('settings')).theme.background === -1, 'theme not restored')
    check(localStorage.getItem('aiSettings') === 'private-session-marker', 'private AI state changed')
    check(JSON.parse(localStorage.getItem('readingStats')).stats.totalTimeMinutes === 5, 'history duplicated')
    const selected = await JSZip.loadAsync(await createBackup({ bookIds: ['two'], includeReadingHistory: true }, source, localStorage))
    const manifest = JSON.parse(await selected.file('backup.json').async('string'))
    check(manifest.files.length === 1 && manifest.files[0].id === 'two', 'selection not respected')
    check(JSON.parse(manifest.readingHistory).stats.totalTimeMinutes === 0, 'unselected history leaked')
    const bad = await JSZip.loadAsync(bytes)
    bad.file('files/0.epub', 'damaged')
    let rejected = false
    try { await restoreBackup(new File([await bad.generateAsync({ type: 'uint8array' })], 'bad.zip'), target, localStorage) }
    catch { rejected = true }
    check(rejected && await target.books.count() === 2, 'damaged backup was not rejected')
    return { passed: true, books: 2, repeatedImport: true, originalBytes: true, realIndexedDB: true, selection: true, integrityFailure: true }
  } catch (error) {
    return { passed: false, error: String(error), stack: error?.stack }
  } finally {
    for (const db of databases) await db.delete()
  }
}
main().then(result => fetch('/result', { method: 'POST', body: JSON.stringify(result) }))
`
const bundle = await build({
  stdin: {
    contents: source,
    resolveDir: path.join(root, 'apps/reader/src'),
    loader: 'ts',
  },
  tsconfig: path.join(root, 'apps/reader/tsconfig.json'),
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  jsx: 'transform',
  define: {
    'process.env': JSON.stringify({
      NODE_ENV: 'production',
      NEXT_PUBLIC_IS_EXPORT: 'false',
    }),
  },
})
let receive
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/result' && request.method === 'POST') {
      let body = ''
      for await (const chunk of request) {
        body += chunk
        if (body.length > 16384) throw new Error('Oversized report')
      }
      receive?.(JSON.parse(body))
      response.writeHead(204).end()
    } else if (request.url === '/check.js') {
      response
        .writeHead(200, { 'Content-Type': 'text/javascript' })
        .end(bundle.outputFiles[0].contents)
    } else if (request.url === '/') {
      response
        .writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; connect-src 'self'",
        })
        .end(
          '<!doctype html><title>Lumen backup browser smoke</title><script src="/check.js"></script>',
        )
    } else response.writeHead(404).end()
  } catch (error) {
    response.writeHead(500).end(String(error))
  }
})
const browsers = [
  [
    'edge',
    [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    ],
  ],
  [
    'firefox',
    [
      'C:/Program Files/Mozilla Firefox/firefox.exe',
      'C:/Program Files/Firefox Developer Edition/firefox.exe',
    ],
  ],
].map(([name, paths]) => [name, paths.find(existsSync)])
assert(
  browsers.every(([, executable]) => executable),
  'Requires installed Edge and Firefox on Windows',
)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const temporaryRoot = await mkdtemp(
  path.join(tmpdir(), 'lumen-backup-browser-'),
)
try {
  const url = 'http://127.0.0.1:' + server.address().port
  for (const [name, executable] of browsers) {
    const profile = path.join(temporaryRoot, name)
    await mkdir(profile)
    const args =
      name === 'edge'
        ? [
            '--headless=new',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--user-data-dir=' + profile,
            url,
          ]
        : ['--headless', '--no-remote', '--profile', profile, url]
    let timer, child
    try {
      const result = new Promise((resolve, reject) => {
        receive = resolve
        timer = setTimeout(
          () => reject(new Error(name + ' backup smoke timed out')),
          45000,
        )
        child = spawn(executable, args, { windowsHide: true, stdio: 'ignore' })
        child.once('error', reject)
        child.once('exit', (code) =>
          reject(new Error(name + ' exited before report: ' + code)),
        )
      })
      const report = await result
      assert(report.passed, JSON.stringify(report))
      console.log(
        name + ': backup browser smoke passed ' + JSON.stringify(report),
      )
    } finally {
      receive = undefined
      clearTimeout(timer)
      if (child && child.exitCode === null) {
        const closed = new Promise((resolve) => child.once('exit', resolve))
        child.kill()
        await Promise.race([
          closed,
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ])
      }
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve))
  assert(
    path.dirname(temporaryRoot) === tmpdir(),
    'Refusing cleanup outside temporary directory',
  )
  await rm(temporaryRoot, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  })
}
