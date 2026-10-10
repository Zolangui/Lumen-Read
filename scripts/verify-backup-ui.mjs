import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Exercise the packaged application, not a standalone mock of its backup UI.
// Requires GECKODRIVER and an installed Firefox. Never opens the user's profile.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'apps/reader/package.json'))
const JSZip = require('jszip')
const driver = process.env.GECKODRIVER
assert(driver && existsSync(driver), 'Set GECKODRIVER to geckodriver.exe')
const binary =
  process.env.FIREFOX_BINARY ||
  'C:/Program Files/Firefox Developer Edition/firefox.exe'
assert(existsSync(binary), 'Firefox binary missing')
const archive = path.resolve(
  process.argv[2] || path.join(root, 'apps/Lumen-firefox.zip'),
)
const version = JSON.parse(
  await readFile(path.join(root, 'apps/extension/package.json'), 'utf8'),
).version
assert.equal(
  JSON.parse(
    await (await JSZip.loadAsync(await readFile(archive)))
      .file('manifest.json')
      .async('string'),
  ).version,
  version,
)
const scratch = await mkdtemp(path.join(tmpdir(), 'lumen-backup-ui-'))
const downloads = path.join(scratch, 'downloads')
await mkdir(downloads)
console.log('Isolated UI test artifacts: ' + scratch)
const listener = createServer()
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve))
const port = listener.address().port
await new Promise((resolve) => listener.close(resolve))
const child = spawn(driver, ['--port', String(port), '--allow-system-access'], {
  windowsHide: true,
  stdio: 'ignore',
})
child.on('error', (error) => console.error(error))
let session
async function request(route, payload, method = 'POST') {
  const response = await fetch(
    `http://127.0.0.1:${port}${session ? '/session/' + session : ''}${route}`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    },
  )
  const result = await response.json()
  assert(response.ok, JSON.stringify(result))
  return result.value
}
const evaluate = (script, args = []) =>
  request('/execute/sync', { script, args })
async function wait(check, label, timeout = 30000) {
  const until = Date.now() + timeout
  let last
  while (Date.now() < until) {
    try {
      const result = await check()
      if (result) return result
    } catch (error) {
      last = error
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(label + ' timed out' + (last ? ': ' + last : ''))
}
const elementId = (element) => element?.['element-6066-11e4-a52e-4f735466cecf']
async function click(expression) {
  const id = elementId(await evaluate('return ' + expression))
  assert(id, 'Element missing: ' + expression)
  await request('/element/' + id + '/click', {})
}
const backupSection = `Array.from(document.querySelectorAll('section')).find(s=>s.querySelector('h2')?.textContent==='Local backup')`
async function openSettings() {
  await click(`document.querySelector('button[title="Settings"]')`)
  await wait(
    () => evaluate('return !!(' + backupSection + ')'),
    'Backup section',
  )
}
async function upload(expression, filename) {
  const id = elementId(await evaluate('return ' + expression))
  assert(id, 'File input missing')
  await request('/element/' + id + '/value', { text: filename })
}
async function database(action, value) {
  return request('/execute/async', {
    script: `const done=arguments[arguments.length-1], action=arguments[0], value=arguments[1];
    const req=indexedDB.open('re-reader'); req.onerror=()=>done({error:String(req.error)});
    req.onsuccess=()=>{const db=req.result;
      const tx=db.transaction(['books','files','covers'],action==='read'?'readonly':'readwrite');
      const result={}; tx.onerror=()=>{db.close();done({error:String(tx.error)})};
      tx.oncomplete=()=>{db.close();done(result)};
      if(action==='clear'){for(const name of ['books','files','covers'])tx.objectStore(name).clear()}
      else if(action==='seed')tx.objectStore('books').put(value);
      else for(const name of ['books','files','covers']){const r=tx.objectStore(name).getAll();
        r.onsuccess=()=>{result[name]=name==='files'?r.result.map(x=>({id:x.id,name:x.file.name,size:x.file.size})):r.result}}
    }`,
    args: [action, value ?? null],
  })
}
async function exportArchive() {
  const before = new Set(await readdir(downloads))
  await click(
    `Array.from((${backupSection}).querySelectorAll('button')).find(b=>b.textContent==='Export backup')`,
  )
  await wait(
    () =>
      evaluate(
        `return (${backupSection}).querySelector('[role="status"]')?.textContent.includes('Check your browser downloads')`,
      ),
    'Export status',
  )
  const filename = await wait(
    async () =>
      (
        await readdir(downloads)
      ).find((name) => name.endsWith('.zip') && !before.has(name)),
    'Downloaded ZIP',
  )
  const zip = await JSZip.loadAsync(
    await readFile(path.join(downloads, filename)),
  )
  return {
    filename: path.join(downloads, filename),
    zip,
    manifest: JSON.parse(await zip.file('backup.json').async('string')),
  }
}
async function importArchive(filename) {
  await upload(
    `(${backupSection}).querySelector('input[type="file"]')`,
    filename,
  )
  await wait(
    () => request('/alert/text', undefined, 'GET'),
    'Import confirmation',
  )
  await request('/alert/accept', {})
}
try {
  await wait(async () => {
    const r = await fetch(`http://127.0.0.1:${port}/status`)
    return r.ok
  }, 'WebDriver')
  const created = await request('/session', {
    capabilities: {
      alwaysMatch: {
        browserName: 'firefox',
        unhandledPromptBehavior: 'ignore',
        timeouts: { script: 30000, pageLoad: 30000 },
        'moz:firefoxOptions': {
          binary,
          args: ['-headless'],
          prefs: {
            'browser.shell.checkDefaultBrowser': false,
            'datareporting.policy.dataSubmissionEnabled': false,
            'toolkit.telemetry.enabled': false,
            'extensions.update.enabled': false,
            'browser.download.folderList': 2,
            'browser.download.dir': downloads,
            'browser.download.useDownloadDir': true,
            'browser.helperApps.neverAsk.saveToDisk':
              'application/zip,application/octet-stream',
            'network.proxy.type': 1,
            'network.proxy.http': '127.0.0.1',
            'network.proxy.http_port': 9,
            'network.proxy.ssl': '127.0.0.1',
            'network.proxy.ssl_port': 9,
            'network.proxy.no_proxies_on': 'localhost,127.0.0.1',
          },
        },
      },
    },
  })
  session = created.sessionId
  await request('/moz/addon/install', { path: archive, temporary: true })
  await request('/moz/context', { context: 'chrome' })
  const url = await evaluate(
    `return WebExtensionPolicy.getByID('lumen-read@zolangui.dev').getURL('index.html')`,
  )
  await request('/moz/context', { context: 'content' })
  await request('/url', { url })
  await wait(
    () =>
      evaluate(`return !!document.querySelector('button[title="Settings"]')`),
    'Loaded Lumen',
  )
  const original = path.join(
    root,
    'artifacts/lumen-launch/small-pages-quiet-moments.epub',
  )
  assert(
    existsSync(original),
    'Run node scripts/prepare-lumen-launch-demo.mjs first',
  )
  const secondZip = await JSZip.loadAsync(await readFile(original))
  secondZip.file(
    'OPS/package.opf',
    (await secondZip.file('OPS/package.opf').async('string')).replaceAll(
      'Small Pages, Quiet Moments',
      'Another reading sample',
    ),
  )
  const second = path.join(scratch, 'another-reading-sample.epub')
  await writeFile(second, await secondZip.generateAsync({ type: 'nodebuffer' }))
  await wait(
    () =>
      evaluate(
        `return !!document.querySelector('input[type="file"][multiple]')`,
      ),
    'Library file picker',
  )
  await upload(
    `document.querySelector('input[type="file"][multiple]')`,
    original + '\n' + second,
  )
  const before = await wait(async () => {
    const records = await database('read')
    return (
      records.books?.length === 2 && records.covers?.length === 2 && records
    )
  }, 'Two imported books')
  // Seed reading facts explicitly; exports/restores themselves use actual UI.
  const book = before.books.find(
    (b) => b.metadata.title === 'Small Pages, Quiet Moments',
  )
  assert(book)
  book.annotations = [
    {
      id: 'ui-note',
      bookId: book.id,
      cfi: 'epubcfi(/6/4!/4/2/1:0)',
      text: 'Sample',
      notes: 'Keep this note',
      createAt: 1,
      updatedAt: 2,
      spine: { index: 1, title: 'Chapter' },
      type: 'highlight',
      color: 'yellow',
    },
  ]
  book.chatSessions = [
    {
      id: 'ui-chat',
      createdAt: 1,
      updatedAt: 2,
      messages: [{ id: 'ui-message', role: 'user', content: 'Keep this chat' }],
    },
  ]
  book.configuration = { typography: { fontSize: '22px' } }
  book.cfi = 'epubcfi(/6/4!/4/2/1:0)'
  await database('seed', book)
  await evaluate(
    `localStorage.setItem('aiSettings',JSON.stringify({privateMarker:'do-not-export'})); localStorage.setItem('readingStats',JSON.stringify({sessions:[{bookId:arguments[0],date:'2026-10-10',duration:5,pagesRead:3}]}))`,
    [book.id],
  )
  await openSettings()
  await evaluate(
    `const s=Array.from(document.querySelectorAll('select')).find(s=>Array.from(s.options).some(o=>o.value==='pt-BR'));s.value='pt-BR';s.dispatchEvent(new Event('change',{bubbles:true}))`,
  )
  await wait(
    () =>
      evaluate(
        `return Array.from(document.querySelectorAll('h2')).some(h=>h.textContent==='Backup local')`,
      ),
    'Portuguese backup UI',
  )
  await evaluate(
    `const s=Array.from(document.querySelectorAll('select')).find(s=>Array.from(s.options).some(o=>o.value==='en-US'));s.value='en-US';s.dispatchEvent(new Event('change',{bubbles:true}))`,
  )
  await wait(
    () => evaluate('return !!(' + backupSection + ')'),
    'English backup UI',
  )
  const all = await exportArchive()
  assert.equal(all.manifest.files.length, 2)
  assert(!JSON.stringify(all.manifest).includes('do-not-export'))
  for (const entry of all.manifest.files) {
    const expected = entry.id === book.id ? original : second
    assert.deepEqual(
      await all.zip.file(entry.path).async('nodebuffer'),
      await readFile(expected),
    )
  }
  await evaluate(
    `const s=(${backupSection}).querySelector('select');s.value='selected';s.dispatchEvent(new Event('change',{bubbles:true}))`,
  )
  await wait(
    () =>
      evaluate(`return (${backupSection}).querySelector('button').disabled`),
    'Empty selection disabled',
  )
  await click(
    `Array.from((${backupSection}).querySelectorAll('label')).find(l=>l.textContent.includes('Small Pages, Quiet Moments')).querySelector('input')`,
  )
  const selected = await exportArchive()
  assert.equal(selected.manifest.files.length, 1)
  assert.equal(selected.manifest.files[0].id, book.id)
  await request('/window/rect', { width: 390, height: 850 })
  await request('/refresh', {})
  await wait(
    () =>
      evaluate(`return !!document.querySelector('button[title="Settings"]')`),
    'Narrow reload',
  )
  await openSettings()
  await wait(
    () =>
      evaluate(
        `return (${backupSection}).getBoundingClientRect().right <= innerWidth`,
      ),
    'Narrow backup bounds',
  )
  await evaluate(`(${backupSection}).scrollIntoView()`)
  await writeFile(
    path.join(scratch, 'backup-narrow.png'),
    Buffer.from(await request('/screenshot', undefined, 'GET'), 'base64'),
  )
  await request('/window/rect', { width: 1280, height: 900 })
  const corrupt = await JSZip.loadAsync(await readFile(all.filename))
  corrupt.file(all.manifest.files[0].path, 'damaged')
  const corruptPath = path.join(scratch, 'damaged-backup.zip')
  await writeFile(
    corruptPath,
    await corrupt.generateAsync({ type: 'nodebuffer' }),
  )
  await importArchive(corruptPath)
  await wait(
    () =>
      evaluate(
        `return (${backupSection}).querySelector('[role="status"]')?.textContent.toLowerCase().includes('invalid')`,
      ),
    'Corruption error',
  )
  assert.equal((await database('read')).books.length, 2)
  await database('clear')
  await importArchive(all.filename)
  const restored = await wait(async () => {
    const records = await database('read')
    return records.books?.length === 2 && records
  }, 'Restored library')
  const restoredBook = restored.books.find((b) => b.id === book.id)
  assert.equal(restoredBook.annotations[0].notes, 'Keep this note')
  assert.equal(
    restoredBook.chatSessions[0].messages[0].content,
    'Keep this chat',
  )
  assert.equal(restoredBook.configuration.typography.fontSize, '22px')
  assert.equal(restoredBook.cfi, book.cfi)
  assert.equal(restored.files.length, 2)
  assert.equal(restored.covers.length, 2)
  assert.equal(
    await evaluate(
      `return JSON.parse(localStorage.getItem('readingStats')).stats.totalTimeMinutes`,
    ),
    5,
  )
  await wait(
    () =>
      evaluate(`return !!document.querySelector('button[title="Settings"]')`),
    'Reload complete',
  )
  await openSettings()
  await importArchive(all.filename)
  await wait(
    () => evaluate(`return !(${backupSection})`),
    'Repeat import reload',
  )
  assert.equal(
    await evaluate(
      `return JSON.parse(localStorage.getItem('readingStats')).stats.totalTimeMinutes`,
    ),
    5,
  )
  await wait(
    () =>
      evaluate(
        `return Array.from(document.querySelectorAll('p')).some(p=>p.textContent==='Small Pages, Quiet Moments')`,
      ),
    'Restored library UI',
  )
  await click(
    `Array.from(document.querySelectorAll('p')).find(p=>p.textContent==='Small Pages, Quiet Moments')`,
  )
  await wait(
    () =>
      evaluate(
        `return Array.from(document.querySelectorAll('iframe')).some(f=>f.contentDocument?.body?.textContent?.includes('A little room to read'))`,
      ),
    'Restored book rendering',
  )
  const result = {
    passed: true,
    version,
    packagedUI: true,
    importedBooks: 2,
    originalBytes: true,
    selectedExport: true,
    emptySelection: true,
    corruptRejected: true,
    restoredNotesChatsPositionTypographyCovers: true,
    repeatedImportIdempotent: true,
    restoredBookRendered: true,
    englishPortuguese: true,
    narrowSettingsClickable: true,
    browser: created.capabilities.browserVersion,
  }
  await writeFile(
    path.join(scratch, 'report.json'),
    JSON.stringify(result, null, 2),
  )
  console.log(JSON.stringify(result))
} catch (error) {
  if (session) {
    try {
      await writeFile(
        path.join(scratch, 'failure.png'),
        Buffer.from(await request('/screenshot', undefined, 'GET'), 'base64'),
      )
    } catch {}
    try {
      console.error(
        await evaluate('return document.body.innerText.slice(0,8000)'),
      )
    } catch {}
  }
  throw error
} finally {
  if (session) {
    try {
      await request('', undefined, 'DELETE')
    } catch {}
  }
  child.kill()
}
