import {
  contrastRatio,
  parseSrgbColor,
  relativeLuminance,
  srgbToOklch,
  type Contents,
  type SrgbColor,
} from '@flow/epubjs'

const LAYER = 'data-lumen-legacy-dark-layer'
const TARGET = 'data-lumen-legacy-dark-target'
const MAX_ELEMENTS = 2048
const MINIMUM_TEXT_CONTRAST = 4.5
const TARGET_TEXT = '#bfc8ca'
const TARGET_SURFACE = '#374151'
const FALLBACK_CANVAS = parseSrgbColor('#24292e')!
const REPAIRED_SURFACE = parseSrgbColor(TARGET_SURFACE)!

const CANDIDATE_SELECTOR = [
  'p',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'section',
  'article',
  'aside',
  'main',
  'a',
  'li',
  'blockquote',
  'em',
  'strong',
  'i',
  'b',
  'small',
  'figcaption',
  'caption',
  'td',
  'th',
  'dt',
  'dd',
  'pre',
  'code',
].join(', ')

type Target = { element: Element; previousMarker: string | null }
type Layer = { restore: () => void }
const layers = new WeakMap<Document, Layer>()

function opaqueColor(value: string): SrgbColor | undefined {
  const color = parseSrgbColor(value)
  return color && color.a >= 0.999 ? color : undefined
}

function neutral(color: SrgbColor): boolean {
  // Keep even subtle author tints. The legacy layer is intentionally narrower
  // than the Presentation Engine and only owns near-achromatic paint.
  return srgbToOklch(color).c <= 0.015
}

function neutralDark(color: SrgbColor): boolean {
  return neutral(color) && relativeLuminance(color) <= 0.35
}

function neutralLight(color: SrgbColor): boolean {
  return neutral(color) && relativeLuminance(color) >= 0.72
}

function directText(element: Element): boolean {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === 3 && Boolean(node.textContent?.trim()),
  )
}

function normalized(
  value: string | null | undefined,
  fallback: string,
): string {
  const result = value?.trim().toLowerCase()
  return result || fallback
}

/**
 * A translucent, filtered or image-backed ancestor makes the actual painted
 * surface unknowable without a full paint graph. Preserve those branches
 * instead of guessing and damaging author artwork.
 */
function hasUnsafePaintContext(element: Element, view: Window): boolean {
  let current: Element | null = element
  while (current) {
    const style = view.getComputedStyle(current)
    const opacity = Number.parseFloat(style.opacity || '1')
    if (
      style.display === 'none' ||
      style.visibility !== 'visible' ||
      normalized(style.contentVisibility, 'visible') === 'hidden' ||
      !Number.isFinite(opacity) ||
      opacity < 0.999 ||
      normalized(style.mixBlendMode, 'normal') !== 'normal' ||
      normalized(style.backgroundBlendMode, 'normal') !== 'normal' ||
      normalized(style.filter, 'none') !== 'none' ||
      normalized(style.backgroundImage, 'none') !== 'none'
    ) {
      return true
    }
    current = current.parentElement
  }
  return false
}

function effectiveSurface(
  element: Element,
  view: Window,
  repairedSurfaces: ReadonlySet<Element>,
  fallbackCanvas: SrgbColor,
): SrgbColor {
  let current: Element | null = element
  while (current) {
    if (repairedSurfaces.has(current)) return REPAIRED_SURFACE
    const background = opaqueColor(
      view.getComputedStyle(current).backgroundColor,
    )
    if (background) return background
    current = current.parentElement
  }
  return fallbackCanvas
}

export function restoreLegacyDarkRepair(document: Document): void {
  layers.get(document)?.restore()
}

/**
 * Conservative compatibility layer used only while the Presentation Engine
 * is disabled. It repairs neutral black-on-dark text and neutral light panels,
 * but preserves chromatic author colours and paint it cannot prove safe.
 *
 * Returns the number of visible direct-text elements with proven low contrast
 * that received no repair. The reader shell uses that count (which costs no
 * extra scan: it reuses this pass) to offer the adaptive engine contextually
 * instead of running a second contrast hunter per page turn.
 */
export function applyLegacyDarkRepair(
  contents: Contents,
  dark: boolean,
  canvasColor?: string,
): number {
  const document = contents.document
  restoreLegacyDarkRepair(document)
  if (!dark) return 0
  const view = document.defaultView
  if (!view) return 0
  // The fallback canvas must track the active dark background (default,
  // sepia-dark, ...); it is only consulted for fully transparent chains.
  const fallbackCanvas =
    (canvasColor ? parseSrgbColor(canvasColor) : undefined) ?? FALLBACK_CANVAS

  const elements = Array.from(
    document.querySelectorAll(CANDIDATE_SELECTOR),
  ).slice(0, MAX_ELEMENTS)
  const safeElements = elements.filter(
    (element) =>
      !element.closest('[data-lumen-presentation-layer]') &&
      !hasUnsafePaintContext(element, view),
  )
  const repairedSurfaces = new Set<Element>()

  for (const element of safeElements) {
    const background = opaqueColor(
      view.getComputedStyle(element).backgroundColor,
    )
    if (background && neutralLight(background)) repairedSurfaces.add(element)
  }

  const declarations = new Map<Element, string[]>()
  for (const element of repairedSurfaces) {
    declarations.set(element, [
      `background-color: ${TARGET_SURFACE} !important`,
    ])
  }

  for (const element of safeElements) {
    if (!directText(element)) continue
    const foreground = opaqueColor(view.getComputedStyle(element).color)
    if (!foreground || !neutralDark(foreground)) continue
    const background = effectiveSurface(
      element,
      view,
      repairedSurfaces,
      fallbackCanvas,
    )
    if (contrastRatio(foreground, background) >= MINIMUM_TEXT_CONTRAST) continue
    const elementDeclarations = declarations.get(element) ?? []
    elementDeclarations.push(`color: ${TARGET_TEXT} !important`)
    declarations.set(element, elementDeclarations)
  }

  // Count proven low-contrast direct text left without a repair: chromatic
  // foregrounds, unsafe paint contexts and anything else this layer
  // deliberately preserves. Only opaque, measurable pairs count, so the
  // signal never fires on guesses.
  let unrepairedLowContrast = 0
  for (const element of elements) {
    if (!directText(element)) continue
    const foreground = opaqueColor(view.getComputedStyle(element).color)
    if (!foreground) continue
    const background = effectiveSurface(
      element,
      view,
      repairedSurfaces,
      fallbackCanvas,
    )
    if (contrastRatio(foreground, background) >= MINIMUM_TEXT_CONTRAST) {
      continue
    }
    if (!declarations.has(element)) unrepairedLowContrast += 1
  }

  if (declarations.size === 0) return unrepairedLowContrast
  const targets: Target[] = []
  const rules: string[] = []
  for (const [element, elementDeclarations] of declarations) {
    const marker = `l${targets.length}`
    targets.push({ element, previousMarker: element.getAttribute(TARGET) })
    element.setAttribute(TARGET, marker)
    rules.push(`[${TARGET}="${marker}"] { ${elementDeclarations.join('; ')}; }`)
  }
  const style = document.createElement('style')
  style.setAttribute(LAYER, 'v2')
  style.setAttribute('data-lumen-reader-style', 'true')
  style.textContent = rules.join('\n')
  ;(document.head ?? document.documentElement).appendChild(style)
  const restore = (): void => {
    style.remove()
    for (const target of targets) {
      if (target.previousMarker === null) target.element.removeAttribute(TARGET)
      else target.element.setAttribute(TARGET, target.previousMarker)
    }
    if (layers.get(document)?.restore === restore) layers.delete(document)
  }
  layers.set(document, { restore })
  return unrepairedLowContrast
}
