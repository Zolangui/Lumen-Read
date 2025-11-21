import clsx from 'clsx'
import { useCallback, useRef, useState } from 'react'

import { RenditionSpread } from '@flow/epubjs/types/rendition'
import { useAction, useTranslation } from '@flow/reader/hooks'
import { reader, useReaderSnapshot } from '@flow/reader/models'
import {
  defaultSettings,
  TypographyConfiguration,
  useSettings,
} from '@flow/reader/state'

import { PaneViewProps } from '../base'

enum TypographyScope {
  Book,
  Global,
}

export const TypographyView: React.FC<PaneViewProps> = () => {
  const { focusedBookTab } = useReaderSnapshot()
  const [settings, setSettings] = useSettings()
  const [scope, setScope] = useState(TypographyScope.Book)
  const t = useTranslation('typography')
  const [, setAction] = useAction()

  const [localFonts, setLocalFonts] = useState<string[]>()

  const {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    zoom,
    spread,
    contentWidthPercent,
  } =
    scope === TypographyScope.Book
      ? focusedBookTab?.book.configuration?.typography ?? defaultSettings
      : settings

  const setTypography = useCallback(
    <K extends keyof TypographyConfiguration>(
      k: K,
      v: TypographyConfiguration[K],
    ) => {
      if (scope === TypographyScope.Book) {
        const bookTab = reader.focusedBookTab
        if (bookTab) {
          const newConfiguration = JSON.parse(
            JSON.stringify(bookTab.book.configuration || {}),
          )
          if (!newConfiguration.typography) {
            newConfiguration.typography = {}
          }
          newConfiguration.typography[k] = v
          bookTab.updateBook({
            configuration: newConfiguration,
          })
        }
      } else {
        setSettings((prev) => ({
          ...prev,
          [k]: v,
        }))
      }
    },
    [scope, setSettings],
  )

  const queryLocalFonts = useCallback(async () => {
    if (localFonts) return
    if (!('queryLocalFonts' in window)) {
      console.error('queryLocalFonts is not available')
      return
    }

    try {
      const fonts = await window.queryLocalFonts()
      const uniqueFonts = Array.from(new Set(fonts.map((f) => f.family)))
      setLocalFonts(uniqueFonts)
    } catch (error) {
      console.error('Error querying local fonts:', error)
    }
  }, [localFonts])

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center">
          <button
            onClick={() => setAction(undefined)}
            className="rounded p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-xl">
              text_fields
            </span>
          </button>
          <h2 className="ml-2 font-semibold text-gray-800 dark:text-white">
            Typography
          </h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setScope(TypographyScope.Book)}
          className={clsx(
            'flex-1 py-2 text-sm font-semibold transition-colors',
            scope === TypographyScope.Book
              ? 'border-primary text-primary border-b-2 dark:text-white'
              : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          {t('scope.book')}
        </button>
        <button
          onClick={() => setScope(TypographyScope.Global)}
          className={clsx(
            'flex-1 py-2 text-sm font-semibold transition-colors',
            scope === TypographyScope.Global
              ? 'border-primary text-primary border-b-2 dark:text-white'
              : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          {t('scope.global')}
        </button>
      </div>

      {/* Controls */}
      <div
        className="flex-grow space-y-5 overflow-y-auto p-4"
        key={`${scope}${focusedBookTab?.id}`}
      >
        {/* Page View */}
        <div>
          <label
            className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
            htmlFor="page-view"
          >
            {t('page_view')}
          </label>
          <div className="relative">
            <select
              className="focus:ring-primary focus:border-primary w-full appearance-none rounded-md border-gray-300 bg-gray-100 py-2 pl-3 pr-8 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              id="page-view"
              value={spread ?? RenditionSpread.Auto}
              onChange={(e) =>
                setTypography('spread', e.target.value as RenditionSpread)
              }
            >
              <option value={RenditionSpread.Auto}>
                {t('page_view.double_page')}
              </option>
              <option value={RenditionSpread.None}>
                {t('page_view.single_page')}
              </option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              expand_more
            </span>
          </div>
        </div>

        {/* Font Family */}
        <div>
          <label
            className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
            htmlFor="font-family"
          >
            {t('font_family')}
          </label>
          <input
            type="text"
            list="local-fonts"
            className="focus:ring-primary focus:border-primary w-full rounded-md border border-gray-300 bg-gray-100 py-2 px-3 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            id="font-family"
            value={fontFamily || ''}
            placeholder="default"
            onFocus={queryLocalFonts}
            onMouseEnter={queryLocalFonts}
            onChange={(e) => setTypography('fontFamily', e.target.value)}
          />
          {localFonts && (
            <datalist id="local-fonts">
              {localFonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </datalist>
          )}
        </div>

        {/* Font Size */}
        <NumberField
          name={t('font_size')}
          min={14}
          max={28}
          defaultValue={fontSize && parseInt(fontSize)}
          onChange={(v) => {
            setTypography('fontSize', v ? v + 'px' : undefined)
          }}
        />

        {/* Font Weight */}
        <NumberField
          name={t('font_weight')}
          min={100}
          max={900}
          step={100}
          defaultValue={fontWeight}
          onChange={(v) => {
            setTypography('fontWeight', v || undefined)
          }}
        />

        {/* Line Height */}
        <NumberField
          name={t('line_height')}
          min={1}
          step={0.1}
          defaultValue={lineHeight}
          onChange={(v) => {
            setTypography('lineHeight', v || undefined)
          }}
        />

        {/* Content Width */}
        <NumberField
          name={t('content_width')}
          min={50}
          max={100}
          step={5}
          defaultValue={contentWidthPercent || 90}
          onChange={(v) => {
            setTypography('contentWidthPercent', v || undefined)
          }}
        />

        {/* Zoom */}
        <NumberField
          name={t('zoom')}
          min={1}
          step={0.1}
          defaultValue={zoom}
          onChange={(v) => {
            setTypography('zoom', v || undefined)
          }}
        />
      </div>

      {/* Footer removed - use settings icon in main sidebar instead */}
    </div>
  )
}

interface NumberFieldProps {
  name: string
  onChange: (v?: number) => void
  min?: number
  max?: number
  step?: number
  defaultValue?: number
}

const NumberField: React.FC<NumberFieldProps> = ({
  name,
  onChange,
  min,
  max,
  step,
  defaultValue,
}) => {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
        {name}
      </label>
      <div className="flex items-center rounded-md border border-gray-300 dark:border-gray-600">
        <button
          onClick={() => {
            if (!ref.current) return
            ref.current.stepDown()
            onChange(Number(ref.current.value))
          }}
          className="rounded-l-md px-3 py-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          -
        </button>
        <input
          ref={ref}
          type="number"
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue}
          placeholder="default"
          className="w-full border-0 bg-transparent py-1.5 text-center text-sm text-gray-800 [appearance:textfield] focus:outline-none dark:text-white [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          onBlur={(e) => {
            onChange(Number(e.target.value))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onChange(Number(e.currentTarget.value))
            }
          }}
        />
        <button
          onClick={() => {
            if (!ref.current) return
            ref.current.stepUp()
            onChange(Number(ref.current.value))
          }}
          className="rounded-r-md px-3 py-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          +
        </button>
      </div>
    </div>
  )
}
