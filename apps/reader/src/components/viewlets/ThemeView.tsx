import clsx from 'clsx'

import {
  useAction,
  useBackground,
  useColorScheme,
  useSourceColor,
  useTranslation,
} from '@flow/reader/hooks'
import { useSettings } from '@flow/reader/state'

import { PaneViewProps } from '../base'

export const ThemeView: React.FC<PaneViewProps> = () => {
  const { scheme, setScheme } = useColorScheme()
  const { sourceColor, setSourceColor } = useSourceColor()
  const [, setBackground] = useBackground()
  const [, setAction] = useAction()
  const [{ theme }] = useSettings()
  const t = useTranslation()

  const backgroundLevel = theme?.background ?? -1

  // Background colors mapping (light mode)
  const backgroundColors = [
    { value: -1, bg: 'bg-white', label: 'White' },
    { value: 1, bg: 'bg-gray-100', label: 'Light Gray' },
    { value: 3, bg: 'bg-gray-200', label: 'Medium Gray' },
    { value: 5, bg: 'bg-gray-800', label: 'Dark Gray' },
  ]

  return (
    <div className="h-full w-full overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex h-full min-w-[220px] flex-col">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center">
            <button
              onClick={() => setAction(undefined)}
              className="rounded p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <span className="material-symbols-outlined text-xl">palette</span>
            </button>
            <h2 className="ml-2 font-semibold text-gray-800 dark:text-white">
              {t('theme.header')}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow space-y-6 overflow-y-auto p-4">
          {/* Source Color */}
          <div>
            <label
              className="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400"
              htmlFor="source-color"
            >
              {t('theme.source_color_label')}
            </label>
            <div className="flex items-center space-x-2">
              <button
                className="border-primary h-8 w-8 rounded-full border-2"
                style={{ backgroundColor: sourceColor }}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'color'
                  input.value = sourceColor
                  input.oninput = (e) =>
                    setSourceColor((e.target as HTMLInputElement).value)
                  input.click()
                }}
              ></button>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {sourceColor.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Background Color */}
          <div>
            <label
              className="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400"
              htmlFor="background-color"
            >
              {t('theme.background_color_label')}
            </label>
            <div className="flex items-center space-x-2">
              {/* Light mode backgrounds */}
              {backgroundColors.map((bg) => (
                <button
                  key={bg.value}
                  onClick={() => {
                    setScheme('light')
                    setBackground(bg.value)
                  }}
                  className={clsx(
                    'h-8 w-8 rounded-md border',
                    bg.bg,
                    scheme === 'light' && backgroundLevel === bg.value
                      ? 'border-primary ring-primary/20 border-2 ring-2'
                      : 'border-gray-300 dark:border-white/10',
                  )}
                ></button>
              ))}
              {/* Dark mode */}
              <button
                onClick={() => {
                  setScheme('dark')
                }}
                className={clsx(
                  'h-8 w-8 rounded-md border bg-black',
                  scheme === 'dark'
                    ? 'border-primary ring-primary/20 border-2 ring-2'
                    : 'border-gray-700 dark:border-gray-500',
                )}
              ></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
