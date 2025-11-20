import { useCallback, useEffect, useMemo } from 'react'

import { compositeColors } from '@flow/reader/color'
import { useSettings } from '@flow/reader/state'

import { useColorScheme } from './useColorScheme'
import { useTheme } from './useTheme'

export function useBackground() {
  const [{ theme }, setSettings] = useSettings()
  const { dark } = useColorScheme()
  const rawTheme = useTheme()

  const setBackground = useCallback(
    (background: number) => {
      setSettings((prev) => ({
        ...prev,
        theme: {
          ...prev.theme,
          background,
        },
      }))
    },
    [setSettings],
  )

  // [-1, 1, 3, 5]
  const level = theme?.background ?? -1

  const background = useMemo(() => {
    if (dark) return 'bg-default'

    if (level > 0) return `bg-surface${level}`

    return 'bg-default'
  }, [dark, level])

  const backgroundColor = useMemo(() => {
    if (dark === undefined) return undefined
    if (rawTheme === undefined) return undefined

    const surfaceMap: Record<number, number> = {
      1: 0.05,
      2: 0.08,
      3: 0.11,
      4: 0.12,
      5: 0.14,
    }

    const { surface, primary } = rawTheme.schemes.light

    return dark
      ? '#24292e'
      : level < 0
      ? '#fff'
      : compositeColors(surface, primary, surfaceMap[level]!)
  }, [dark, level, rawTheme])

  useEffect(() => {
    if (backgroundColor) {
      document
        .querySelector('#theme-color')
        ?.setAttribute('content', backgroundColor)
    }
  }, [backgroundColor])

  return [background, setBackground, backgroundColor] as const
}
