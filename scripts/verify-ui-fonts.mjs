import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fonts = path.join(root, 'apps/reader/public/fonts')
const css = (
  await readFile(path.join(root, 'apps/reader/src/pages/styles.css'), 'utf8')
).split('@tailwind')[0]
const bootstrap = `
(async () => {
  try {
    const text = 'Lumen Olá seleção Ā Ελληνικά ἀ Привет Ѡ Việt';
    for (const weight of [400, 500, 700]) {
      const faces = await document.fonts.load(weight + ' 16px Inter', text);
      if (!faces.length || faces.some(face => face.status !== 'loaded')) throw new Error('Inter failed: ' + weight);
    }
    const symbols = await document.fonts.load('400 24px "Material Symbols Outlined"', 'smart_toy');
    if (!symbols.length || symbols.some(face => face.status !== 'loaded')) throw new Error('Symbols failed');
    const context = document.createElement('canvas').getContext('2d');
    context.font = '400 24px "Material Symbols Outlined"';
    for (const icon of ['smart_toy', 'menu', 'chevron_left', 'library_books', 'settings']) {
      const width = context.measureText(icon).width;
      if (width < 20 || width > 32) throw new Error('Broken icon ligature: ' + icon + ' width=' + width);
    }
    if (performance.getEntriesByType('resource').some(entry => !entry.name.startsWith(location.origin + '/'))) throw new Error('Remote font request');
    await fetch('/result', { method: 'POST', body: JSON.stringify({ passed: true, weights: [400, 500, 700], ligatures: 5, remoteResources: 0 }) });
  } catch (error) {
    await fetch('/result', { method: 'POST', body: JSON.stringify({ passed: false, error: String(error) }) });
  }
})();`
const html =
  '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/fonts.css"></head><body><span class="material-symbols-outlined">smart_toy</span><script src="/check.js"></script></body></html>'
let receive
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname
    if (pathname === '/result' && request.method === 'POST') {
      let body = ''
      for await (const chunk of request) {
        body += chunk
        if (body.length > 4096) throw new Error('Oversized result')
      }
      receive?.(JSON.parse(body))
      response.writeHead(204).end()
      return
    }
    let body, type
    if (pathname === '/') {
      body = html
      type = 'text/html; charset=utf-8'
    } else if (pathname === '/fonts.css') {
      body = css
      type = 'text/css'
    } else if (pathname === '/check.js') {
      body = bootstrap
      type = 'text/javascript'
    } else if (/^\/fonts\/[a-z-]+\.woff2$/.test(pathname)) {
      body = await readFile(path.join(fonts, path.basename(pathname)))
      type = 'font/woff2'
    } else {
      response.writeHead(404).end()
      return
    }
    response
      .writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'",
      })
      .end(body)
  } catch (error) {
    response.writeHead(500).end(String(error))
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'lumen-ui-fonts-'))
try {
  const edge = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync)
  const firefox = [
    'C:/Program Files/Mozilla Firefox/firefox.exe',
    'C:/Program Files/Firefox Developer Edition/firefox.exe',
  ].find(existsSync)
  assert(
    edge && firefox,
    'This smoke runner requires installed Edge and Firefox on Windows',
  )
  const url = 'http://127.0.0.1:' + server.address().port
  for (const [name, executable] of [
    ['edge', edge],
    ['firefox', firefox],
  ]) {
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
    let timer
    let child
    try {
      const result = new Promise((resolve, reject) => {
        receive = resolve
        timer = setTimeout(
          () => reject(new Error(name + ' font smoke timed out')),
          45000,
        )
        child = spawn(executable, args, { windowsHide: true, stdio: 'ignore' })
        child.once('error', reject)
        child.once('exit', (code) =>
          reject(new Error(name + ' exited before result: ' + code)),
        )
      })
      const report = await result
      assert(report.passed, JSON.stringify(report))
      console.log(name + ': local UI fonts passed ' + JSON.stringify(report))
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
