import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Original demonstration content, not an imported commercial publication.
// Generated EPUBs stay outside the extension output and are gitignored.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'apps/reader/package.json'))
const JSZip = require('jszip')
const output = path.join(root, 'artifacts/lumen-launch')
const zip = new JSZip()
const stamp = new Date('2026-10-07T00:00:00Z')
const add = (name, text, compression = 'DEFLATE') =>
  zip.file(name, text, { date: stamp, compression })
const paragraphs = [
  'A book does not ask you to finish it today. It asks for a little attention: a quiet corner, a page, and enough time to notice what the words are doing. Reading can begin with something smaller than a plan.',
  'Choose a place that feels comfortable. Let the light fall beside you rather than straight into your eyes. There is no perfect arrangement that works for everyone. A useful arrangement is one that lets you return to the next sentence without thinking about the screen.',
  'Some days you will read a chapter. On other days you will stop after a paragraph because a thought needs room. Both are ways of spending time with a book. The number of pages is a record of movement, not a measure of the value of the visit.',
  'When a sentence stays with you, give it a place to live. Mark the passage and write a short note in your own words. A useful note can be a question rather than an answer. Later, it will remind you not only what you read, but what you were wondering about.',
  'The shape of a page can change without changing its words. A larger font may ask for more room. Two columns may become one. What matters is keeping your place while finding a shape that makes the next line easy to follow.',
  'A small pause is part of reading. Look away from the screen and let your eyes rest. When you return, you do not need to make up for lost time. The page will still be there, with the same invitation to pay attention.',
  'Leave yourself an easy beginning for tomorrow. A bookmark, a note, or an unfinished question can make returning feel natural. Consistency is often built from welcoming beginnings rather than demanding endings.',
  'You can close the book without closing the conversation. An idea may follow you into a walk, a meal, or a talk with a friend. Reading is not only what happens while the page is open; it is also what you notice afterwards.',
]
const titles = [
  'A little room to read',
  'A sentence worth keeping',
  'Return at your own pace',
]
const stylesheet = `body { font-family: Georgia, serif; line-height: 1.65; color: #242124; }
h1 { font-size: 1.7em; line-height: 1.2; color: #225a88; }
p { margin: 0 0 1em; }
.eyebrow { font: 0.8em sans-serif; letter-spacing: .12em; color: #225a88; }
.callout { background: #f5d6e2; color: #241b20; border-left: 3px solid #b83c70; padding: 1em; margin: 1.3em 0; }
.callout strong { color: #9f2055; }
.cover { text-align: center; }
.cover img { max-width: 100%; max-height: 85vh; }
`
const xhtml = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title><link rel="stylesheet" href="style.css"/></head><body>${body}</body></html>`
add('mimetype', 'application/epub+zip', 'STORE')
add(
  'META-INF/container.xml',
  '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
)
add('OPS/style.css', stylesheet)
add(
  'OPS/cover.svg',
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850"><rect width="600" height="850" fill="#e6eef0"/><rect x="36" y="36" width="528" height="778" rx="12" fill="none" stroke="#28566d" stroke-width="2"/><text x="300" y="132" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#28566d">LUMEN READ · ORIGINAL DEMO</text><text x="300" y="342" text-anchor="middle" font-family="Georgia,serif" font-size="63" fill="#203746">Small Pages,</text><text x="300" y="415" text-anchor="middle" font-family="Georgia,serif" font-size="63" fill="#203746">Quiet Moments</text><path d="M210 505 Q255 480 300 505 Q345 480 390 505 L390 600 Q345 575 300 600 Q255 575 210 600 Z M300 505 L300 600" fill="none" stroke="#28566d" stroke-width="4"/><text x="300" y="708" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#28566d">A short reading sample</text></svg>',
)
add(
  'OPS/cover.xhtml',
  xhtml(
    'Small Pages, Quiet Moments',
    '<div class="cover"><img src="cover.svg" alt="Small Pages, Quiet Moments — original Lumen Read demonstration"/></div>',
  ),
)
titles.forEach((title, index) => {
  const content = paragraphs
    .map(
      (text, p) =>
        `<p>${text}</p>${
          p === 2
            ? '<aside class="callout"><strong>A reading pause</strong><p>Keep the colours of a book meaningful. A note, a heading, and a callout need not all become the same shade.</p></aside>'
            : ''
        }`,
    )
    .join('')
  add(
    `OPS/chapter${index + 1}.xhtml`,
    xhtml(
      title,
      `<p class="eyebrow">SMALL PAGES, QUIET MOMENTS · ${
        index + 1
      }</p><h1>${title}</h1>${content}<p><em>Original demonstration text prepared for Lumen Read. This is not an excerpt from a commercial book.</em></p>`,
    ),
  )
})
add(
  'OPS/nav.xhtml',
  `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="cover.xhtml">Cover</a></li>${titles
    .map((title, i) => `<li><a href="chapter${i + 1}.xhtml">${title}</a></li>`)
    .join('')}</ol></nav></body></html>`,
)
add(
  'OPS/package.opf',
  `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:lumen:launch:original-demo:2026-10</dc:identifier><dc:title>Small Pages, Quiet Moments</dc:title><dc:creator>Lumen Read demo</dc:creator><dc:language>en-US</dc:language><dc:description>Original, AI-assisted demonstration text for screenshots. No commercial book excerpts or personal information.</dc:description><meta property="dcterms:modified">2026-10-07T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/><item id="image" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" properties="svg"/>${titles
    .map(
      (_, i) =>
        `<item id="c${i + 1}" href="chapter${
          i + 1
        }.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join('')}</manifest><spine><itemref idref="cover"/>${titles
    .map((_, i) => `<itemref idref="c${i + 1}"/>`)
    .join('')}</spine></package>`,
)
await mkdir(output, { recursive: true })
const file = path.join(output, 'small-pages-quiet-moments.epub')
await writeFile(
  file,
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
)
console.log(file)
