/**
 * Synthetic Stress Test EPUB Generator for Lumen Presentation Engine (LPE).
 *
 * Generates a valid EPUB 3 archive designed for interactive human testing in apps/reader.
 *
 * Chapter <-> Fixture Correspondence Mapping:
 * - Capítulo 1: Hierarquia Neutra Multi-Nível  <-> multi-level-neutrals.xhtml
 * - Capítulo 2: Callouts e Polaridade Invertida <-> mixed-callouts.xhtml
 * - Capítulo 3: Superfícies Mid-Band           <-> midband-surfaces.xhtml
 * - Capítulo 4: Blocos de Código e Sintaxe      <-> adversarial-colors.xhtml (.mixed code)
 * - Capítulo 5: Herança Aninhada e Variáveis   <-> adversarial-colors.xhtml (.nested-inheritance)
 * - Capítulo 6: Tabelas Zebradas e Traços      <-> stroke-contrast.xhtml / wide-table.xhtml
 * - Capítulo 7: Notas de Rodapé e Epígrafes    <-> pink-callout.xhtml (subordinate notes)
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const JSZip = require('../packages/epub-engine/node_modules/jszip')

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(scriptDir, '..')
const defaultOutputPath = path.join(workspaceRoot, 'artifacts', 'stress-test.epub')

async function generateStressEpub(outputPath = defaultOutputPath) {
  const zip = new JSZip()

  // 1. mimetype MUST be first and STORE (uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  )

  // 3. EPUB/styles.css
  const stylesCss = `
body {
  margin: 0;
  padding: 28px;
  background: transparent;
  color: #000000;
  font: 16px/1.6 system-ui, -apple-system, sans-serif;
}
h1 {
  font-size: 26px;
  font-weight: 700;
  color: #000000;
  margin-top: 0;
  margin-bottom: 24px;
  border-bottom: 2px solid #eaeaea;
  padding-bottom: 8px;
}
h2 {
  font-size: 20px;
  font-weight: 600;
  color: #000000;
  margin-top: 28px;
  margin-bottom: 16px;
}
p {
  margin-top: 0;
  margin-bottom: 16px;
}

/* Multi-level neutral hierarchy */
.neutral-0 { color: #000000; }
.neutral-1 { color: #1a1a1a; }
.neutral-2 { color: #333332; }
.neutral-3 { color: #4d4d4b; }
.neutral-4 { color: #666666; }
.neutral-5 { color: #808080; }

/* Inverted callout boxes */
.callout-light {
  background-color: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 16px 20px;
  margin: 20px 0;
}
.callout-light p {
  color: #1f2328;
  margin-bottom: 8px;
}
.callout-light .note {
  color: #656d76;
  font-size: 14px;
  margin-bottom: 0;
}

.callout-warning {
  background-color: #fff8c5;
  border: 1px solid #d4a72c;
  border-left: 5px solid #bf8700;
  border-radius: 6px;
  padding: 14px 18px;
  margin: 20px 0;
}
.callout-warning strong {
  color: #7d4e00;
}
.callout-warning p {
  color: #7d4e00;
  margin-top: 6px;
  margin-bottom: 0;
}

.callout-dark {
  background-color: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 16px 20px;
  margin: 20px 0;
}
.callout-dark h3 {
  color: #333333; /* Low-contrast author bug */
  margin-top: 0;
  margin-bottom: 8px;
}
.callout-dark p {
  color: #444444; /* Low-contrast author bug */
  margin-bottom: 0;
}

/* Mid-band surfaces */
.midband-surface {
  background-color: #9299a1;
  border-radius: 8px;
  padding: 16px;
  margin: 20px 0;
}
.midband-surface p.dark-text {
  color: #111111;
  margin-bottom: 8px;
}
.midband-surface p.light-text {
  color: #eeeeee;
  margin-bottom: 0;
}

/* Code blocks */
pre.code-block {
  background-color: #24292e;
  border-radius: 6px;
  padding: 14px 18px;
  margin: 20px 0;
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", monospace;
  font-size: 14px;
  line-height: 1.5;
  overflow-x: auto;
}
pre.code-block code {
  color: #e1e4e8;
}
pre.code-block .kw { color: #f97583; font-weight: 600; }
pre.code-block .fn { color: #b392f0; }
pre.code-block .str { color: #9ecbff; }
pre.code-block .cm { color: #6a737d; font-style: italic; }

code.inline-code {
  background-color: rgba(175, 184, 193, 0.2);
  color: #101010;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  font-size: 85%;
}

/* Tables */
table.stress-table {
  width: 100%;
  border-collapse: collapse;
  margin: 24px 0;
}
table.stress-table th, table.stress-table td {
  padding: 10px 14px;
  border: 1px solid #d0d7de;
  text-align: left;
}
table.stress-table th {
  background-color: #f6f8fa;
  color: #1f2328;
  font-weight: 600;
}
table.stress-table tr:nth-child(even) td {
  background-color: #fcfcfc;
}
table.stress-table tr:nth-child(odd) td {
  background-color: #ffffff;
}

/* Footnotes & Epigraphs */
.epigraph {
  font-style: italic;
  color: #555555;
  border-left: 3px solid #ccc;
  padding-left: 16px;
  margin: 20px 0 24px 20px;
}
.footnote-ref {
  font-size: 75%;
  vertical-align: super;
  line-height: 0;
  color: #0969da;
  text-decoration: none;
  font-weight: 600;
}
.footnotes-section {
  margin-top: 40px;
  padding-top: 16px;
  border-top: 1px solid #e1e4e8;
  font-size: 14px;
}
.footnotes-section p {
  color: #656d76;
  margin-bottom: 8px;
}
`
  zip.file('EPUB/styles.css', stylesCss)

  // 4. Chapter XHTML Files
  const chapters = [
    {
      id: 'ch1',
      filename: 'ch1.xhtml',
      title: 'Capítulo 1: Hierarquia Neutra Multi-Nível',
      content: `
<h1>Capítulo 1: Hierarquia Neutra Multi-Nível</h1>
<p class="neutral-0"><strong>Nível 0 (#000000):</strong> Texto principal dominante em preto puro. Este parágrafo representa a narrativa principal e a maior massa de texto da publicação.</p>
<p class="neutral-1"><strong>Nível 1 (#1a1a1a):</strong> Subtítulo ou parágrafo de ênfase primária em cinza quase preto. A LPE deve manter este nível logo abaixo do nível 0.</p>
<p class="neutral-2"><strong>Nível 2 (#333332):</strong> Seção secundária ou introdução de citação em cinza escuro. Usado frequentemente em epígrafes editoriais.</p>
<p class="neutral-3"><strong>Nível 3 (#4d4d4b):</strong> Metadados de capítulo, autoria ou sumários parciais em cinza médio-escuro.</p>
<p class="neutral-4"><strong>Nível 4 (#666666):</strong> Notas de rodapé e números de referência. Em temas escuros, deve permanecer subordinado mas legível.</p>
<p class="neutral-5"><strong>Nível 5 (#808080):</strong> Informações secundárias de copyright e números de página impressa.</p>
`,
    },
    {
      id: 'ch2',
      filename: 'ch2.xhtml',
      title: 'Capítulo 2: Callouts e Polaridade Invertida',
      content: `
<h1>Capítulo 2: Callouts e Polaridade Invertida</h1>
<p>Este capítulo testa o particionamento de superfícies com polaridades opostas inseridas na mesma página.</p>

<div class="callout-light">
  <p><strong>Caixa Clara em Canvas Escuro:</strong> Esta caixa tem fundo explícito claro (#f6f8fa) e texto escuro (#1f2328).</p>
  <p class="note">A LPE NÃO deve inverter este texto para branco quando o leitor estiver no modo escuro, pois a superfície local já é clara.</p>
</div>

<div class="callout-warning">
  <strong>Alerta Amarelo Autoral:</strong>
  <p>Fundo âmbar suave (#fff8c5) com texto marrom escuro (#7d4e00). Possui alto contraste original e deve preservar suas cores cromáticas.</p>
</div>

<div class="callout-dark">
  <h3>Caixa Escura Autoral com Texto Ilegível</h3>
  <p>Esta caixa possui fundo escuro (#161b22) e texto também escuro (#444444). A LPE deve detectar o baixo contraste e reparar o texto para claro.</p>
</div>
`,
    },
    {
      id: 'ch3',
      filename: 'ch3.xhtml',
      title: 'Capítulo 3: Superfícies Mid-Band de Gamut Restrito',
      content: `
<h1>Capítulo 3: Superfícies Mid-Band</h1>
<p>Superfícies no intervalo 0.22 &lt; Y &lt; 0.40 (cinza médio) não suportam matematicamente o contraste preferencial de 7:1 em nenhuma direção.</p>

<div class="midband-surface">
  <p class="dark-text"><strong>Texto Escuro (#111111):</strong> Em fundo cinza médio (#9299a1). A LPE deve degradar graciosamente para o piso 4.5:1 e registrar dívida explícita.</p>
  <p class="light-text"><strong>Texto Claro (#eeeeee):</strong> Em fundo cinza médio (#9299a1). A adaptação deve garantir que nenhuma linha se torne ilegível.</p>
</div>
`,
    },
    {
      id: 'ch4',
      filename: 'ch4.xhtml',
      title: 'Capítulo 4: Blocos de Código e Sintaxe',
      content: `
<h1>Capítulo 4: Blocos de Código</h1>
<p>Livros técnicos frequentemente misturam blocos de código com fontes monoespaçadas e código inline no meio do parágrafo, como o comando <code class="inline-code">git checkout -b feature</code> ou <code class="inline-code">npm install</code>.</p>

<pre class="code-block"><code><span class="cm">// Simulação de highlight de sintaxe</span>
<span class="kw">function</span> <span class="fn">adaptColor</span>(sourceColor, surface) {
  <span class="kw">const</span> luminance = getLuminance(surface);
  <span class="kw">return</span> luminance &lt; 0.22 ? <span class="str">"#b4b4b4"</span> : <span class="str">"#1a1a1a"</span>;
}</code></pre>

<p>O texto após o bloco de código volta a ter o estilo normal do parágrafo narrativo.</p>
`,
    },
    {
      id: 'ch5',
      filename: 'ch5.xhtml',
      title: 'Capítulo 5: Herança Aninhada e Variáveis CSS',
      content: `
<h1>Capítulo 5: Herança Aninhada</h1>
<p>Cenário onde estilos se propagam por múltiplos níveis de tags com seletores complexos:</p>

<div style="color: #222222; padding: 12px; border-left: 3px solid #0969da;">
  Nível 1 (div #222222)
  <div style="color: inherit; margin-left: 16px; margin-top: 8px;">
    Nível 2 (inherit)
    <p style="color: currentColor; margin-left: 16px; margin-top: 8px;">
      Nível 3 (currentColor) — <span style="color: #666666;">Nível 4 (span com cor explícita cinza #666666)</span>.
    </p>
  </div>
</div>
`,
    },
    {
      id: 'ch6',
      filename: 'ch6.xhtml',
      title: 'Capítulo 6: Tabelas Zebradas e Traços',
      content: `
<h1>Capítulo 6: Tabelas Zebradas e Traços</h1>
<p>Tabelas com linhas alternadas e bordas finas exigem análise semântica de traço (stroke contrast):</p>

<table class="stress-table">
  <thead>
    <tr>
      <th>Comando / Módulo</th>
      <th>Polaridade</th>
      <th>Contraste Alvo</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>preserveNeutralHierarchy</code></td>
      <td>Dark Canvas</td>
      <td>7:1 (AAA)</td>
      <td>Ativo</td>
    </tr>
    <tr>
      <td><code>classifySurfacePolarity</code></td>
      <td>Mid-band</td>
      <td>4.5:1 (AA)</td>
      <td>Degradado</td>
    </tr>
    <tr>
      <td><code>restore-visible-stroke</code></td>
      <td>Bordas / Linhas</td>
      <td>3:1 (Mínimo)</td>
      <td>Reparado</td>
    </tr>
    <tr>
      <td><code>contain-overflow</code></td>
      <td>Wide Tables</td>
      <td>Layout</td>
      <td>Contido</td>
    </tr>
  </tbody>
</table>
`,
    },
    {
      id: 'ch7',
      filename: 'ch7.xhtml',
      title: 'Capítulo 7: Notas de Rodapé e Epígrafes',
      content: `
<h1>Capítulo 7: Notas de Rodapé e Epígrafes</h1>

<div class="epigraph">
  "A simplicidade é o último grau de sofisticação."<br/>
  — Leonardo da Vinci
</div>

<p>
  A narrativa de não-ficção clássica frequentemente insere citações e números sobrescritos<a href="#fn1" class="footnote-ref" id="ref1">1</a> 
  ao longo de parágrafos extensos de prosa. Quando o leitor avança pelo texto, referências históricas<a href="#fn2" class="footnote-ref" id="ref2">2</a>
  complementam os argumentos do autor.
</p>

<p>
  Este padrão testa se o corpo dominante permanece estável e se os números e notas secundárias não se tornam ofuscantes nem ilegíveis.
</p>

<div class="footnotes-section">
  <p id="fn1"><strong>[1]</strong> Nota sobre manuscritos renascentistas e anotações originais em código espelho.</p>
  <p id="fn2"><strong>[2]</strong> Referência arquivística do tratado sobre pintura e proporção áurea.</p>
</div>
`,
    },
  ]

  for (const chapter of chapters) {
    const chapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${chapter.title}</title>
    <link rel="stylesheet" type="text/css" href="styles.css" />
  </head>
  <body>
    ${chapter.content.trim()}
  </body>
</html>`
    zip.file(`EPUB/${chapter.filename}`, chapterXhtml)
  }

  // 5. EPUB/toc.xhtml (EPUB 3 Navigation Document)
  const tocNavItems = chapters
    .map(
      (ch) =>
        `      <li><a href="${ch.filename}">${ch.title}</a></li>`,
    )
    .join('\n')

  const tocXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <title>Sumário</title>
    <link rel="stylesheet" type="text/css" href="styles.css" />
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Sumário de Casos Extremos LPE</h1>
      <ol>
${tocNavItems}
      </ol>
    </nav>
  </body>
</html>`
  zip.file('EPUB/toc.xhtml', tocXhtml)

  // 6. EPUB/package.opf
  const manifestItems = [
    '    <item id="styles" href="styles.css" media-type="text/css"/>',
    '    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    ...chapters.map(
      (ch) =>
        `    <item id="${ch.id}" href="${ch.filename}" media-type="application/xhtml+xml"/>`,
    ),
  ].join('\n')

  const spineItems = chapters
    .map((ch) => `    <itemref idref="${ch.id}"/>`)
    .join('\n')

  const packageOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:lumen-lpe-stress-test-corpus-2026</dc:identifier>
    <dc:title>Lumen Presentation Engine — Stress Test Corpus</dc:title>
    <dc:language>pt</dc:language>
    <dc:creator>Lumen Engineering Team</dc:creator>
    <dc:date>2026-09-19</dc:date>
    <meta property="dcterms:modified">2026-09-19T14:45:00Z</meta>
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`
  zip.file('EPUB/package.opf', packageOpf)

  // 7. Generate zip buffer and write to disk
  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, content)
  console.log(`Successfully generated stress-test EPUB at: ${outputPath} (${content.length} bytes)`)
  return outputPath
}

// Execute if run from CLI
const targetPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultOutputPath
generateStressEpub(targetPath).catch((error) => {
  console.error('Failed to generate stress EPUB:', error)
  process.exit(1)
})
