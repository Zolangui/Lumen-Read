import type { Theme } from '@material/material-color-utilities'

import { compositeColors } from '../color'

export const DEFAULT_LIGHT_READER_BACKGROUND = '#ffffff'
export const DEFAULT_DARK_READER_BACKGROUND = '#24292e'
/** Warm dark canvas for non-default dark levels (luminance well below 0.22). */
export const SEPIA_DARK_READER_BACKGROUND = '#1c1917'
/** Pure-black canvas for AMOLED screens (level 3 in dark scheme). */
export const OLED_DARK_READER_BACKGROUND = '#000000'
/** Deep navy canvas (level 5 in dark scheme, luminance well below 0.22). */
export const MIDNIGHT_DARK_READER_BACKGROUND = '#0f172a'
export const DEFAULT_THEME_SOURCE_COLOR = '#0ea5e9'

export const READER_BACKGROUND_LEVELS = [-1, 1, 3, 5] as const
export type ReaderBackgroundLevel = typeof READER_BACKGROUND_LEVELS[number]

export function normalizeThemeSourceColor(source: string | undefined): string {
  return source && /^#[0-9a-f]{6}$/i.test(source)
    ? source.toLowerCase()
    : DEFAULT_THEME_SOURCE_COLOR
}

const LIGHT_SURFACE_PRIMARY_OPACITY: Record<
  Exclude<ReaderBackgroundLevel, -1>,
  number
> = {
  1: 0.05,
  3: 0.11,
  5: 0.14,
}

export function normalizeReaderBackgroundLevel(
  level: number | undefined,
): ReaderBackgroundLevel {
  return READER_BACKGROUND_LEVELS.includes(level as ReaderBackgroundLevel)
    ? (level as ReaderBackgroundLevel)
    : -1
}

export function readerBackgroundClass(
  dark: boolean,
  level: number | undefined,
): string {
  const normalized = normalizeReaderBackgroundLevel(level)
  if (normalized === -1) return 'bg-default'
  // bg-surfaceN utilities are Material-based (primary overlay on surface)
  // and adapt to the dark scheme on their own.
  return `bg-surface${normalized}`
}

/**
 * Resolve the actual opaque reader canvas. Theme controls, the reader iframe
 * and LPE must all consume this function so a preview can never describe a
 * different colour from the one used for contrast analysis.
 */
export function resolveReaderBackgroundColor(
  dark: boolean,
  level: number | undefined,
  materialTheme: Pick<Theme, 'schemes'> | undefined,
): string | undefined {
  const normalized = normalizeReaderBackgroundLevel(level)
  if (dark) {
    if (normalized === -1) return DEFAULT_DARK_READER_BACKGROUND
    // Every dark level resolves to its own canvas so no two options ever
    // share a swatch: sepia, AMOLED black and midnight navy all sit
    // comfortably inside the dark surface polarity (luminance well below
    // 0.22).
    if (normalized === 1) return SEPIA_DARK_READER_BACKGROUND
    if (normalized === 3) return OLED_DARK_READER_BACKGROUND
    return MIDNIGHT_DARK_READER_BACKGROUND
  }

  if (normalized === -1) return DEFAULT_LIGHT_READER_BACKGROUND
  if (!materialTheme) return undefined

  const { surface, primary } = materialTheme.schemes.light
  return compositeColors(
    surface,
    primary,
    LIGHT_SURFACE_PRIMARY_OPACITY[normalized],
  )
}
