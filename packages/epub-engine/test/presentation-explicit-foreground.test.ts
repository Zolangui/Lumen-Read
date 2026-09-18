import { webcrypto } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { parseSrgbColor, srgbToOklch } from '../src/presentation-color'
import {
  analyzeExplicitForegroundContrast,
  analyzeExplicitForegroundForDarkTheme,
  applyRestoreExplicitTextPlan,
  isRestoreExplicitTextParameters,
  RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
  validateRestoredExplicitText,
} from '../src/presentation-explicit-foreground'
import {
  admitPresentationPlan,
  createPresentationPlan,
  createValidationRecord,
  PRESENTATION_PLAN_SCHEMA_VERSION,
} from '../src/presentation-plan'

import { installVisibleLayout, parseXML } from './helpers'

describe('explicit foreground repair', () => {
  beforeAll(() => vi.stubGlobal('crypto', webcrypto as unknown as Crypto))
  afterAll(() => vi.unstubAllGlobals())

  it('repairs local gray prose and preserves a chromatic accent exactly', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { color: #bfc8ca; background: transparent; }
      .gray { color: rgb(55, 55, 55); }
      .accent { color: rgb(255, 0, 130); }
    </style></head><body>
      <p class="gray">This deliberately long gray paragraph represents explicit publication prose that disappears on a dark reader canvas.</p>
      <p class="accent">This long pink accent remains authored and must never be neutralized by the local repair operation.</p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)
    const accent = rendered.querySelector('.accent')!
    const accentBefore = rendered.defaultView!.getComputedStyle(accent).color

    const analysis = await analyzeExplicitForegroundForDarkTheme({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 0,
      canvasColor: '#111827',
    })
    expect(analysis.patches).toHaveLength(1)
    expect(analysis.patches[0]!.operation).toBe('restore-explicit-text')
    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'test',
        mode: 'adaptive',
        publicationRevision: 'fixture',
        analysisFingerprint: 'explicit-v1',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    expect(plan).toBeDefined()
    const layer = await applyRestoreExplicitTextPlan(plan!, source, rendered, 0)
    expect(layer).toBeDefined()
    const validation = createValidationRecord(
      plan!,
      validateRestoredExplicitText(layer!).input,
    )
    const admission = await admitPresentationPlan(plan!, validation, {
      engineVersion: 'test',
      publicationRevision: 'fixture',
      analysisFingerprint: 'explicit-v1',
      renderingContextFingerprint: 'dark',
      validators: RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    })
    expect(admission.accepted).toBe(true)
    expect(rendered.defaultView!.getComputedStyle(accent).color).toBe(
      accentBefore,
    )
    layer!.restore()
    expect(rendered.defaultView!.getComputedStyle(accent).color).toBe(
      accentBefore,
    )
    iframe.remove()
  })

  it('preserves meaningful hierarchy between distinct neutral foregrounds', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .primary { color: #111111; }
      .secondary { color: #202020; }
      .caption { color: #303030; }
      .muted { color: #404040; }
    </style></head><body>
      <p class="primary">Primary publication prose is deliberately long enough to provide stable direct text evidence.</p>
      <p class="secondary">Secondary publication prose is deliberately long enough to provide stable direct text evidence.</p>
      <p class="caption">Caption publication prose is deliberately long enough to provide stable direct text evidence.</p>
      <p class="muted">Muted publication prose is deliberately long enough to provide stable direct text evidence.</p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 12,
      canvasColor: '#111827',
    })
    const mappings = analysis.patches.flatMap((patch) =>
      isRestoreExplicitTextParameters(patch.parameters)
        ? [patch.parameters]
        : [],
    )
    const targetColors = new Set(mappings.map((mapping) => mapping.targetText))
    const ordered = [...mappings].sort(
      (left, right) =>
        srgbToOklch(parseSrgbColor(left.sourceText)!).l -
        srgbToOklch(parseSrgbColor(right.sourceText)!).l,
    )
    const targetLightness = ordered.map(
      (mapping) => srgbToOklch(parseSrgbColor(mapping.targetText)!).l,
    )

    expect(mappings).toHaveLength(4)
    expect(targetColors.size).toBe(4)
    expect(targetLightness).toEqual([...targetLightness].sort((a, b) => b - a))

    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'neutral-hierarchy-test',
        mode: 'adaptive',
        publicationRevision: 'neutral-hierarchy-fixture',
        analysisFingerprint: 'explicit-neutral-hierarchy-v1',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(
      plan!,
      source,
      rendered,
      12,
    )
    expect(validateRestoredExplicitText(layer!).input.passed).toBe(true)
    layer!.restore()
    iframe.remove()
  })

  it('mirrors a meaningful light neutral hierarchy onto a light canvas', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .primary { color: #eeeeee; }
      .secondary { color: #dddddd; }
      .caption { color: #cccccc; }
      .muted { color: #bbbbbb; }
    </style></head><body>
      <p class="primary">Primary publication prose is deliberately long enough to provide stable direct text evidence.</p>
      <p class="secondary">Secondary publication prose is deliberately long enough to provide stable direct text evidence.</p>
      <p class="caption">Caption publication prose is deliberately long enough to provide stable direct text evidence.</p>
      <p class="muted">Muted publication prose is deliberately long enough to provide stable direct text evidence.</p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 13,
      canvasColor: '#ffffff',
    })
    const mappings = analysis.patches.flatMap((patch) =>
      isRestoreExplicitTextParameters(patch.parameters)
        ? [patch.parameters]
        : [],
    )
    const targetColors = new Set(mappings.map((mapping) => mapping.targetText))
    const ordered = [...mappings].sort(
      (left, right) =>
        srgbToOklch(parseSrgbColor(left.sourceText)!).l -
        srgbToOklch(parseSrgbColor(right.sourceText)!).l,
    )
    const targetLightness = ordered.map(
      (mapping) => srgbToOklch(parseSrgbColor(mapping.targetText)!).l,
    )

    expect(mappings).toHaveLength(4)
    expect(targetColors.size).toBe(4)
    // On a light canvas, prominence grows toward darker targets: the
    // strongest (darkest) source must keep the darkest target.
    expect(targetLightness).toEqual([...targetLightness].sort((a, b) => a - b))

    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'neutral-light-hierarchy-test',
        mode: 'adaptive',
        publicationRevision: 'neutral-light-hierarchy-fixture',
        analysisFingerprint: 'explicit-neutral-light-hierarchy-v1',
        renderingContextFingerprint: 'light',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(
      plan!,
      source,
      rendered,
      13,
    )
    expect(validateRestoredExplicitText(layer!).input.passed).toBe(true)
    layer!.restore()
    iframe.remove()
  })

  it('outranks a more-specific host link rule that also uses important', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { color: #000000; background: transparent; }
    </style></head><body>
      <p>Substantial black publication prose must remain repairable together with <a href="#chapter-1">Capítulo 1</a>.</p>
      <p>More black prose makes this reproduce a normal reflowable chapter rather than a synthetic isolated label.</p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    const hostStyle = rendered.createElement('style')
    hostStyle.textContent = 'a:any-link { color: #3b82f6 !important; }'
    rendered.head.appendChild(hostStyle)
    installVisibleLayout(rendered)
    const link = rendered.querySelector('a')!
    const hostLinkColor = rendered.defaultView!.getComputedStyle(link).color

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 6,
      canvasColor: '#24292e',
    })
    expect(analysis.patches.length).toBeGreaterThanOrEqual(2)
    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'specificity-test',
        mode: 'adaptive',
        publicationRevision: 'specificity-fixture',
        analysisFingerprint: 'explicit-specificity-v1',
        renderingContextFingerprint: 'dark-24292e',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(plan!, source, rendered, 6)

    expect(rendered.defaultView!.getComputedStyle(link).color).not.toBe(
      hostLinkColor,
    )
    expect((link as HTMLElement).style.getPropertyPriority('color')).toBe(
      'important',
    )
    expect(validateRestoredExplicitText(layer!).input.passed).toBe(true)

    layer!.restore()
    expect(rendered.defaultView!.getComputedStyle(link).color).toBe(
      hostLinkColor,
    )
    expect(link.hasAttribute('style')).toBe(false)
    iframe.remove()
  })

  it('coalesces distributed links with identical proven paint into one candidate', async () => {
    const entries = Array.from(
      { length: 40 },
      (_, index) =>
        `<p>Index entry ${index} points to <a href="#chapter-${index}">Capítulo ${index}</a> and keeps substantial surrounding prose.</p>`,
    ).join('')
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>body { color:#000; background:transparent; }</style></head><body>${entries}</body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    const hostStyle = rendered.createElement('style')
    hostStyle.textContent = 'a:any-link { color:#3b82f6 !important; }'
    rendered.head.appendChild(hostStyle)
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 27,
      canvasColor: '#24292e',
      maxCandidates: 2,
    })
    expect(analysis.candidateGroups).toBe(2)
    expect(analysis.patches).toHaveLength(2)
    expect(analysis.truncatedGroups).toBe(0)
    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'distributed-link-test',
        mode: 'adaptive',
        publicationRevision: 'distributed-link-fixture',
        analysisFingerprint: 'explicit-v9',
        renderingContextFingerprint: 'dark-24292e',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(
      plan!,
      source,
      rendered,
      27,
    )

    expect(validateRestoredExplicitText(layer!).input.passed).toBe(true)
    layer!.restore()
    iframe.remove()
  })

  it('lightens low-contrast chromatic prose while preserving its hue', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .publisher-copy { color: #3b3f66; }
    </style></head><body>
      <p class="publisher-copy">A deliberately substantial publisher message uses a dark purple foreground that is readable on paper but disappears against a dark reader canvas.</p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)
    const view = rendered.defaultView!
    const prose = rendered.querySelector('.publisher-copy')!
    const before = view.getComputedStyle(prose).color

    const analysis = await analyzeExplicitForegroundForDarkTheme({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 1,
      canvasColor: '#24292e',
    })

    expect(analysis.patches).toHaveLength(1)
    expect(analysis.findings[0]!.kind).toBe(
      'explicit-text-with-insufficient-contrast',
    )
    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'test',
        mode: 'adaptive',
        publicationRevision: 'chromatic-fixture',
        analysisFingerprint: 'explicit-chromatic-v1',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(plan!, source, rendered, 1)

    expect(view.getComputedStyle(prose).color).not.toBe(before)
    expect(validateRestoredExplicitText(layer!).input.passed).toBe(true)
    layer!.restore()
    expect(view.getComputedStyle(prose).color).toBe(before)
    iframe.remove()
  })

  it('darkens proven light-on-light text without flattening its hue', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .pale { color: #f1e9ff; }
    </style></head><body>
      <p class="pale">This pale violet publication text disappears against a light reader canvas and requires a scheme-neutral contrast repair.</p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)
    const view = rendered.defaultView!
    const prose = rendered.querySelector('.pale')!
    const before = view.getComputedStyle(prose).color

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 8,
      canvasColor: '#ffffff',
    })
    expect(analysis.patches).toHaveLength(1)
    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'test',
        mode: 'adaptive',
        publicationRevision: 'light-fixture',
        analysisFingerprint: 'explicit-light-v1',
        renderingContextFingerprint: 'light',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(plan!, source, rendered, 8)

    expect(view.getComputedStyle(prose).color).not.toBe(before)
    expect(validateRestoredExplicitText(layer!).input.passed).toBe(true)
    layer!.restore()
    expect(view.getComputedStyle(prose).color).toBe(before)
    iframe.remove()
  })

  it('repairs prose and a saturated accent only when each is unreadable', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { color: #bfc8ca; background: transparent; }
      .intro { color: rgb(40, 40, 40); }
      .accent { color: rgb(236, 0, 140); }
    </style></head><body>
      <section class="intro">
        <p><em>This long nested introduction reproduces EPUB chapters where a container owns the dark color while the actual prose lives entirely inside an italic child.</em></p>
        <p class="accent">This pink authored accent keeps its identity while becoming readable.</p>
      </section>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)
    const view = rendered.defaultView!
    const prose = rendered.querySelector('em')!
    const accent = rendered.querySelector('.accent')!
    const proseBefore = view.getComputedStyle(prose).color
    const accentBefore = view.getComputedStyle(accent).color

    const analysis = await analyzeExplicitForegroundForDarkTheme({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 3,
      canvasColor: '#111827',
    })
    expect(analysis.patches).toHaveLength(2)
    expect(analysis.patches[0]!.target.source.sourcePath).toEqual([1])
    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'test',
        mode: 'adaptive',
        publicationRevision: 'nested-fixture',
        analysisFingerprint: 'explicit-v2',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(plan!, source, rendered, 3)

    expect(view.getComputedStyle(prose).color).not.toBe(proseBefore)
    expect(view.getComputedStyle(accent).color).not.toBe(accentBefore)
    expect(validateRestoredExplicitText(layer!).input.passed).toBe(true)
    layer!.restore()
    expect(view.getComputedStyle(prose).color).toBe(proseBefore)
    expect(view.getComputedStyle(accent).color).toBe(accentBefore)
    iframe.remove()
  })

  it('repairs repeated body color and a separate unreadable saturated accent', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { color: rgb(20, 20, 20); background: transparent; }
      .intro, .intro em { color: rgb(20, 20, 20); }
      .accent { color: rgb(236, 0, 140); }
    </style></head><body>
      <h2 class="accent">Sereia</h2>
      <p class="intro"><em>This long italic introduction repeats the body foreground explicitly, so changing only the inherited body color cannot make it readable.</em></p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)
    const view = rendered.defaultView!
    const prose = rendered.querySelector('em')!
    const accent = rendered.querySelector('.accent')!
    const proseBefore = view.getComputedStyle(prose).color
    const accentBefore = view.getComputedStyle(accent).color

    const analysis = await analyzeExplicitForegroundForDarkTheme({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 4,
      canvasColor: '#111827',
    })

    expect(analysis.patches).toHaveLength(2)
    expect(
      analysis.patches.some(
        (patch) => patch.target.source.sourcePath.length === 0,
      ),
    ).toBe(true)
    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'test',
        mode: 'adaptive',
        publicationRevision: 'repeated-body-color-fixture',
        analysisFingerprint: 'explicit-v3',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(plan!, source, rendered, 4)

    expect(view.getComputedStyle(prose).color).not.toBe(proseBefore)
    expect(view.getComputedStyle(accent).color).not.toBe(accentBefore)
    expect(validateRestoredExplicitText(layer!).input.passed).toBe(true)
    layer!.restore()
    expect(view.getComputedStyle(prose).color).toBe(proseBefore)
    expect(view.getComputedStyle(accent).color).toBe(accentBefore)
    iframe.remove()
  })

  it('keeps root text and matching explicit descendants in the same proof', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { color: rgb(20, 20, 20); background: transparent; }
      em { color: rgb(20, 20, 20); }
    </style></head><body>
      This deliberately long root-level introduction is authored directly in the body and must remain part of the repair proof.
      <p><em>This equally substantial descendant repeats the same explicit foreground and must be repaired with the root text.</em></p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundForDarkTheme({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 5,
      canvasColor: '#111827',
    })
    expect(analysis.patches).toHaveLength(1)
    expect(analysis.patches[0]!.target.source.sourcePath).toEqual([])

    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'test',
        mode: 'adaptive',
        publicationRevision: 'root-text-fixture',
        analysisFingerprint: 'explicit-root-v1',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(plan!, source, rendered, 5)

    expect(layer!.targets[0]!.samples).toHaveLength(2)
    expect(validateRestoredExplicitText(layer!).input.passed).toBe(true)
    layer!.restore()
    iframe.remove()
  })

  it('declares explicit color groups that exceed the candidate budget', async () => {
    const paragraphs = Array.from(
      { length: 20 },
      (_, index) =>
        `<p style="color:rgb(${20 + index},${20 + index},${
          20 + index
        })">Distinct low-contrast group ${index} contains enough authored text to require an explicit repair.</p>`,
    ).join('')
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>${paragraphs}</body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 8,
      canvasColor: '#111827',
      maxCandidates: 16,
    })

    expect(analysis.candidateGroups).toBe(20)
    expect(analysis.patches).toHaveLength(16)
    expect(analysis.truncatedGroups).toBe(4)
    expect(analysis.diagnostics).toContain('explicit-groups-truncated')
    iframe.remove()
  })

  it('allocates one unpredictable marker base for all samples in a layer', async () => {
    const paragraphs = Array.from(
      { length: 40 },
      (_, index) =>
        `<p>Low-contrast sample ${index} belongs to the same authored color root and must be marked without rescanning the document.</p>`,
    ).join('')
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>.group { color:rgb(20,20,20); }</style></head><body><section class="group">${paragraphs}</section></body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)
    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 9,
      canvasColor: '#111827',
    })
    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'marker-allocation-test',
        mode: 'adaptive',
        publicationRevision: 'marker-allocation-fixture',
        analysisFingerprint: 'explicit-v8',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const querySelector = vi.spyOn(rendered, 'querySelector')

    const layer = await applyRestoreExplicitTextPlan(plan!, source, rendered, 9)
    const markerLookups = querySelector.mock.calls.filter(([selector]) =>
      String(selector).startsWith('[data-lumen-explicit-text-target='),
    )

    expect(analysis.patches).toHaveLength(1)
    expect(markerLookups).toHaveLength(1)
    layer!.restore()
    iframe.remove()
  })

  it('rejects inherited color changes outside the proven explicit samples', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .intro { color: rgb(20, 20, 20); }
      .art { background-image: linear-gradient(#ffffff, #777777); }
    </style></head><body>
      <p class="intro">This direct paragraph text is intentionally long enough to produce a local explicit foreground repair.
        <span class="art">This nested text inherits that color over paint which cannot be reduced to one solid surface.</span>
      </p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)
    const analysis = await analyzeExplicitForegroundForDarkTheme({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 6,
      canvasColor: '#111827',
    })
    expect(analysis.patches).toHaveLength(1)
    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'test',
        mode: 'adaptive',
        publicationRevision: 'explicit-collateral-fixture',
        analysisFingerprint: 'explicit-collateral-v1',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(plan!, source, rendered, 6)

    const validation = validateRestoredExplicitText(layer!).input
    expect(validation.passed).toBe(false)
    expect(validation.probes[0]?.metrics.collateralColorChanges).toBe(1)
    layer!.restore()
    iframe.remove()
  })

  it('refuses an explicit-text patch whose declared effects are inconsistent', async () => {
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      .gray { color: rgb(35, 35, 35); }
    </style></head><body><p class="gray">This long explicit dark paragraph is sufficient evidence for a local foreground repair candidate.</p></body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)
    const analysis = await analyzeExplicitForegroundForDarkTheme({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 7,
      canvasColor: '#111827',
    })
    const plan = (await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'explicit-effects-v1',
        mode: 'adaptive',
        publicationRevision: 'explicit-effects-fixture',
        analysisFingerprint: 'explicit-effects-analysis',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    ))!
    const corrupt = {
      ...plan,
      patches: plan.patches.map((patch, index) =>
        index === 0
          ? {
              ...patch,
              effects: { ...patch.effects, semantics: 'presentation-only' },
            }
          : patch,
      ),
    }

    await expect(
      applyRestoreExplicitTextPlan(corrupt, source, rendered, 7),
    ).rejects.toThrow(/Unsupported explicit-text operation/)
    expect(rendered.querySelector('[data-lumen-presentation-layer]')).toBeNull()
    iframe.remove()
  })

  it('partitions the same source gray by surface polarity and preserves hierarchy in both', async () => {
    const prose =
      'Publication prose long enough to provide stable direct text evidence for the analyzer.'
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .primary { color: #727272; }
      .secondary { color: #7e7e7e; }
      .callout { background-color: #f3f4f6; }
    </style></head><body>
      <p class="primary">${prose}</p>
      <p class="secondary">${prose}</p>
      <div class="callout">
        <p class="primary">${prose}</p>
        <p class="secondary">${prose}</p>
      </div>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 20,
      canvasColor: '#111827',
    })
    const mappings = analysis.patches.flatMap((patch) =>
      isRestoreExplicitTextParameters(patch.parameters)
        ? [patch.parameters]
        : [],
    )
    // Two source grays x two surface polarities = four independent repairs.
    expect(mappings).toHaveLength(4)
    const dark = mappings.filter((m) => m.surfacePolarity === 'dark')
    const light = mappings.filter((m) => m.surfacePolarity === 'light')
    expect(dark).toHaveLength(2)
    expect(light).toHaveLength(2)
    // Each partition carries only its own surfaces.
    for (const mapping of dark) {
      expect(mapping.surfaces).toEqual(['#111827'])
    }
    for (const mapping of light) {
      expect(mapping.surfaces).toEqual(['#f3f4f6'])
    }
    // Dark partition moves toward white; light partition toward black.
    for (const mapping of dark) {
      expect(
        srgbToOklch(parseSrgbColor(mapping.targetText)!).l,
      ).toBeGreaterThan(0.6)
    }
    for (const mapping of light) {
      expect(srgbToOklch(parseSrgbColor(mapping.targetText)!).l).toBeLessThan(
        0.55,
      )
    }
    // Hierarchy preserved inside each polarity: the stronger source gray
    // keeps the stronger target in both directions.
    const darkOrdered = [...dark].sort(
      (a, b) =>
        srgbToOklch(parseSrgbColor(a.sourceText)!).l -
        srgbToOklch(parseSrgbColor(b.sourceText)!).l,
    )
    expect(
      srgbToOklch(parseSrgbColor(darkOrdered[0]!.targetText)!).l,
    ).toBeGreaterThan(
      srgbToOklch(parseSrgbColor(darkOrdered[1]!.targetText)!).l,
    )
    const lightOrdered = [...light].sort(
      (a, b) =>
        srgbToOklch(parseSrgbColor(a.sourceText)!).l -
        srgbToOklch(parseSrgbColor(b.sourceText)!).l,
    )
    // Light surfaces preserve prominence toward darker targets: the
    // stronger (darker) source keeps the darker target.
    expect(
      srgbToOklch(parseSrgbColor(lightOrdered[0]!.targetText)!).l,
    ).toBeLessThan(srgbToOklch(parseSrgbColor(lightOrdered[1]!.targetText)!).l)

    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'polarity-test',
        mode: 'adaptive',
        publicationRevision: 'polarity-fixture',
        analysisFingerprint: 'explicit-polarity-v1',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(
      plan!,
      source,
      rendered,
      20,
    )
    expect(layer).toBeDefined()
    const validation = validateRestoredExplicitText(layer!).input
    expect(validation.passed).toBe(true)
    const hierarchyProbe = validation.probes.find(
      (probe) => probe.id === 'explicit-text-neutral-hierarchy',
    )
    expect(hierarchyProbe?.metrics.collisions).toBe(0)
    expect(hierarchyProbe?.metrics.orderingViolations).toBe(0)
    layer!.restore()
    iframe.remove()
  })

  it('repairs mid-band surfaces at the mandatory floor and declares the hierarchy debt', async () => {
    const prose =
      'Publication prose long enough to provide stable direct text evidence for the analyzer.'
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .midbox { background-color: #8a8a8a; }
      .primary { color: #404040; }
      .secondary { color: #555555; }
    </style></head><body>
      <div class="midbox">
        <p class="primary">${prose}</p>
        <p class="secondary">${prose}</p>
      </div>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 21,
      canvasColor: '#111827',
    })
    const mappings = analysis.patches.flatMap((patch) =>
      isRestoreExplicitTextParameters(patch.parameters)
        ? [patch.parameters]
        : [],
    )
    expect(mappings.length).toBeGreaterThan(0)
    for (const mapping of mappings) {
      expect(mapping.surfacePolarity).toBe('mid')
    }
    // The mid-band findings declare the hierarchy debt explicitly.
    for (const finding of analysis.findings) {
      const evidence = finding.evidence as Record<string, unknown>
      expect(evidence.surfacePolarity).toBe('mid')
      expect(evidence.hierarchyStatus).toBe('constrained-narrow-gamut')
      expect(typeof evidence.hierarchyDebtCodePoints).toBe('number')
    }

    const plan = await createPresentationPlan(
      {
        schemaVersion: PRESENTATION_PLAN_SCHEMA_VERSION,
        engineVersion: 'mid-band-test',
        mode: 'adaptive',
        publicationRevision: 'mid-band-fixture',
        analysisFingerprint: 'explicit-mid-v1',
        renderingContextFingerprint: 'dark',
        findings: analysis.findings,
        patches: analysis.patches,
      },
      RESTORE_EXPLICIT_TEXT_OPERATION_VALIDATORS,
    )
    const layer = await applyRestoreExplicitTextPlan(
      plan!,
      source,
      rendered,
      21,
    )
    expect(layer).toBeDefined()
    const validation = validateRestoredExplicitText(layer!).input
    expect(validation.passed).toBe(true)
    const hierarchyProbe = validation.probes.find(
      (probe) => probe.id === 'explicit-text-neutral-hierarchy',
    )
    expect(hierarchyProbe?.metrics.constrainedMidGroups).toBe(mappings.length)
    expect(
      hierarchyProbe?.metrics.constrainedMidCodePoints as number,
    ).toBeGreaterThan(0)
    layer!.restore()
    iframe.remove()
  })

  it('prioritizes larger text masses when the candidate budget truncates', async () => {
    const longProse =
      'Main chapter prose deliberately long enough to dominate the candidate budget ordering by a wide margin of code points.'
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .main { color: #111111; }
      .note { color: #222222; }
      .label { color: #333333; }
    </style></head><body>
      <p class="main">${longProse}</p>
      <p class="note">A secondary note with enough text to matter here.</p>
      <p class="label">Tiny label.</p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 22,
      canvasColor: '#111827',
      maxCandidates: 2,
    })
    expect(analysis.patches).toHaveLength(2)
    expect(analysis.diagnostics).toContain('explicit-groups-truncated')
    const sources = analysis.patches
      .map((patch) =>
        isRestoreExplicitTextParameters(patch.parameters)
          ? patch.parameters.sourceText
          : undefined,
      )
      .sort()
    // The tiny label loses the budget race; the two larger masses win.
    expect(sources).toEqual(['#111111', '#222222'])
    iframe.remove()
  })

  it('preserves hierarchy when sibling colors have different sample counts', async () => {
    const prose =
      'Publication prose long enough to provide stable direct text evidence for the analyzer.'
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .primary { color: #111111; }
      .secondary { color: #404040; }
    </style></head><body>
      <p class="primary">${prose}</p>
      <p class="primary">${prose}</p>
      <p class="primary">${prose}</p>
      <p class="secondary">${prose}</p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 23,
      canvasColor: '#111827',
    })
    const mappings = analysis.patches.flatMap((patch) =>
      isRestoreExplicitTextParameters(patch.parameters)
        ? [patch.parameters]
        : [],
    )
    expect(mappings).toHaveLength(2)
    // Different sample counts must not split the hierarchy family: the
    // stronger source still earns the stronger target.
    const primary = mappings.find((m) => m.sourceText === '#111111')!
    const secondary = mappings.find((m) => m.sourceText === '#404040')!
    expect(srgbToOklch(parseSrgbColor(primary.targetText)!).l).toBeGreaterThan(
      srgbToOklch(parseSrgbColor(secondary.targetText)!).l,
    )
    iframe.remove()
  })

  it('distributes multi-tier dark neutral candidates without clamp collisions', async () => {
    const prose =
      'Publication prose long enough to provide stable direct text evidence for the analyzer.'
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .t0 { color: #000000; }
      .t1 { color: #222222; }
      .t2 { color: #444444; }
      .t3 { color: #666666; }
    </style></head><body>
      <p class="t0">${prose}</p>
      <p class="t1">${prose}</p>
      <p class="t2">${prose}</p>
      <p class="t3">${prose}</p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 24,
      canvasColor: '#24292e',
    })
    const mappings = analysis.patches.flatMap((patch) =>
      isRestoreExplicitTextParameters(patch.parameters)
        ? [patch.parameters]
        : [],
    )
    expect(mappings).toHaveLength(4)
    // Every tier must receive a distinct target (no clamp collision at 0.82)
    const distinctTargets = new Set(mappings.map((m) => m.targetText))
    expect(distinctTargets.size).toBe(4)

    // Strictly monotonic: darker source gets lighter target on dark canvas
    const sorted = [...mappings].sort(
      (a, b) =>
        srgbToOklch(parseSrgbColor(a.sourceText)!).l -
        srgbToOklch(parseSrgbColor(b.sourceText)!).l,
    )
    for (let i = 1; i < sorted.length; i++) {
      const stronger = sorted[i - 1]!
      const weaker = sorted[i]!
      expect(
        srgbToOklch(parseSrgbColor(stronger.targetText)!).l,
      ).toBeGreaterThan(srgbToOklch(parseSrgbColor(weaker.targetText)!).l)
    }
    iframe.remove()
  })

  it('preserves neutral hierarchy symmetrically on light surfaces without floor collisions', async () => {
    const prose =
      'Publication prose long enough to provide stable direct text evidence for the analyzer.'
    const markup = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><style>
      body { background: transparent; }
      .light-t0 { color: #ffffff; }
      .light-t1 { color: #eeeeee; }
      .light-t2 { color: #cccccc; }
    </style></head><body>
      <p class="light-t0">${prose}</p>
      <p class="light-t1">${prose}</p>
      <p class="light-t2">${prose}</p>
    </body></html>`
    const source = parseXML(markup, 'application/xhtml+xml')
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const rendered = iframe.contentDocument!
    rendered.documentElement.innerHTML = source.documentElement.innerHTML
    installVisibleLayout(rendered)

    const analysis = await analyzeExplicitForegroundContrast({
      sourceDocument: source,
      renderedDocument: rendered,
      spineIndex: 25,
      canvasColor: '#ffffff',
    })
    const mappings = analysis.patches.flatMap((patch) =>
      isRestoreExplicitTextParameters(patch.parameters)
        ? [patch.parameters]
        : [],
    )
    expect(mappings).toHaveLength(3)
    const distinctTargets = new Set(mappings.map((m) => m.targetText))
    expect(distinctTargets.size).toBe(3)

    // On light canvas, target lightness must stay at or above MIN_NEUTRAL_TARGET_LIGHTNESS_LIGHT (0.18)
    for (const m of mappings) {
      const targetL = srgbToOklch(parseSrgbColor(m.targetText)!).l
      expect(targetL).toBeGreaterThanOrEqual(0.18)
    }

    // Strictly monotonic: darker source gets darker target, lighter source gets lighter target
    const sorted = [...mappings].sort(
      (a, b) =>
        srgbToOklch(parseSrgbColor(a.sourceText)!).l -
        srgbToOklch(parseSrgbColor(b.sourceText)!).l,
    )
    for (let i = 1; i < sorted.length; i++) {
      const darkerSource = sorted[i - 1]!
      const lighterSource = sorted[i]!
      expect(
        srgbToOklch(parseSrgbColor(darkerSource.targetText)!).l,
      ).toBeLessThan(srgbToOklch(parseSrgbColor(lighterSource.targetText)!).l)
    }
    iframe.remove()
  })
})
