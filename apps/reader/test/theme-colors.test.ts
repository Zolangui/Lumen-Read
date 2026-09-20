import type { Theme } from '@material/material-color-utilities'
import { describe, expect, it } from 'vitest'

import locales from '../locales'
import {
  DEFAULT_DARK_READER_BACKGROUND,
  DEFAULT_LIGHT_READER_BACKGROUND,
  DEFAULT_THEME_SOURCE_COLOR,
  MIDNIGHT_DARK_READER_BACKGROUND,
  normalizeReaderBackgroundLevel,
  normalizeThemeSourceColor,
  OLED_DARK_READER_BACKGROUND,
  readerBackgroundClass,
  resolveReaderBackgroundColor,
  SEPIA_DARK_READER_BACKGROUND,
} from '../src/lib/theme-colors'

const monochromeTheme = {
  schemes: {
    light: {
      surface: 0xffffffff,
      primary: 0xff000000,
    },
  },
} as unknown as Pick<Theme, 'schemes'>

describe('reader theme colours', () => {
  it('normalizes persisted accent colours before Material parsing', () => {
    expect(normalizeThemeSourceColor('#A1B2C3')).toBe('#a1b2c3')
    expect(normalizeThemeSourceColor('not-a-colour')).toBe(
      DEFAULT_THEME_SOURCE_COLOR,
    )
    expect(normalizeThemeSourceColor(undefined)).toBe(
      DEFAULT_THEME_SOURCE_COLOR,
    )
  })

  it('normalizes persisted background values to supported levels', () => {
    expect(normalizeReaderBackgroundLevel(-1)).toBe(-1)
    expect(normalizeReaderBackgroundLevel(1)).toBe(1)
    expect(normalizeReaderBackgroundLevel(3)).toBe(3)
    expect(normalizeReaderBackgroundLevel(5)).toBe(5)
    expect(normalizeReaderBackgroundLevel(2)).toBe(-1)
    expect(normalizeReaderBackgroundLevel(Number.NaN)).toBe(-1)
    expect(normalizeReaderBackgroundLevel(undefined)).toBe(-1)
  })

  it('uses stable opaque canvases before the Material theme is ready', () => {
    expect(resolveReaderBackgroundColor(false, -1, undefined)).toBe(
      DEFAULT_LIGHT_READER_BACKGROUND,
    )
    expect(resolveReaderBackgroundColor(true, -1, undefined)).toBe(
      DEFAULT_DARK_READER_BACKGROUND,
    )
    expect(resolveReaderBackgroundColor(true, 1, undefined)).toBe(
      SEPIA_DARK_READER_BACKGROUND,
    )
    expect(resolveReaderBackgroundColor(true, 3, undefined)).toBe(
      OLED_DARK_READER_BACKGROUND,
    )
    expect(resolveReaderBackgroundColor(true, 5, undefined)).toBe(
      MIDNIGHT_DARK_READER_BACKGROUND,
    )
  })

  it('resolves the exact tonal colours represented by the light swatches', () => {
    expect(resolveReaderBackgroundColor(false, 1, monochromeTheme)).toBe(
      '#f2f2f2',
    )
    expect(resolveReaderBackgroundColor(false, 3, monochromeTheme)).toBe(
      '#e2e2e2',
    )
    expect(resolveReaderBackgroundColor(false, 5, monochromeTheme)).toBe(
      '#dbdbdb',
    )
  })

  it('resolves a distinct canvas per dark level so no option is missing', () => {
    const canvases = ([-1, 1, 3, 5] as const).map((level) =>
      resolveReaderBackgroundColor(true, level, undefined),
    )
    expect(new Set(canvases).size).toBe(canvases.length)
  })

  it('keeps fallback classes aligned with the selected canvas', () => {
    expect(readerBackgroundClass(false, -1)).toBe('bg-default')
    expect(readerBackgroundClass(false, 3)).toBe('bg-surface3')
    expect(readerBackgroundClass(true, -1)).toBe('bg-default')
    expect(readerBackgroundClass(true, 1)).toBe('bg-surface1')
    expect(readerBackgroundClass(true, 3)).toBe('bg-surface3')
  })

  it('keeps every Theme control translated in every bundled locale', () => {
    const keys = [
      'theme.close',
      'theme.color_scheme_label',
      'theme.scheme_light',
      'theme.scheme_dark',
      'theme.scheme_system',
      'theme.source_color_help',
      'theme.apply_source_color',
      'theme.background_default',
      'theme.background_soft',
      'theme.background_tinted',
      'theme.background_deep',
      'theme.background_dark_default',
      'theme.background_dark_soft',
      'theme.background_dark_tinted',
      'theme.background_dark_deep',
      'theme.background_color_help',
    ] as const

    Object.values(locales).forEach((locale) => {
      keys.forEach((key) => expect(locale[key]).toBeTruthy())
    })
  })
})
