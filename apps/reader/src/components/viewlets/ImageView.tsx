import clsx from 'clsx'
import { useMemo, useState } from 'react'

import {
  ISection,
  ISectionSnapshot,
  reader,
  useReaderSnapshot,
} from '@flow/reader/models'

import { PaneViewProps } from '../base'

export const ImageView: React.FC<PaneViewProps> = () => {
  const { focusedBookTab } = useReaderSnapshot()

  const sections = useMemo(() => {
    if (!focusedBookTab?.sections) return []
    // Cast to any to avoid "Type instantiation is excessively deep" error with Valtio proxies
    const allSections = Array.from(
      focusedBookTab.sections as any,
    ) as ISectionSnapshot[]
    return allSections.filter((s) => s.images && s.images.length > 0)
  }, [focusedBookTab?.sections])

  if ((sections?.length ?? 0) > 500) return null

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-4 dark:border-gray-700">
        <span className="material-symbols-outlined mr-2 text-xl text-gray-600 dark:text-gray-400">
          image
        </span>
        <h2 className="font-semibold text-gray-800 dark:text-white">Imagens</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {sections?.map((s) => (
            <Block key={s.href} section={s} />
          ))}
        </div>
      </div>
    </div>
  )
}

interface BlockProps {
  section: ISectionSnapshot
}

const Block: React.FC<BlockProps> = ({ section }) => {
  const { focusedBookTab } = useReaderSnapshot()
  const [expanded, setExpanded] = useState(false)

  const resources = focusedBookTab?.epub?.resources
  if (!resources) return null

  const blobs = resources.replacementUrls
  const assets = resources.assets
  const imageCount = section.images.length

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          'flex cursor-pointer items-center space-x-3 rounded-lg p-2 transition-colors',
          expanded
            ? 'bg-primary/10'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800',
        )}
      >
        <span
          className={clsx(
            'material-symbols-outlined text-lg',
            expanded ? 'text-primary' : 'text-gray-500 dark:text-gray-400',
          )}
        >
          {expanded ? 'expand_more' : 'chevron_right'}
        </span>
        <span
          className={clsx(
            'flex-1 text-sm font-medium',
            expanded ? 'text-primary' : 'text-gray-900 dark:text-white',
          )}
        >
          {section.navitem?.label || 'Seção sem título'}
        </span>
        <span
          className={clsx(
            'rounded-full px-2 py-0.5 font-mono text-xs',
            expanded
              ? 'bg-primary/20 text-primary'
              : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
          )}
        >
          {imageCount}
        </span>
      </div>

      {expanded && (
        <div className="pl-8 pt-3">
          {section.images.map((src) => {
            const i = assets.findIndex((a: any) => src.includes(a.href))
            const asset = assets[i]
            const blob = blobs[i]

            if (!blob) return null
            return (
              <img
                className="w-full cursor-pointer rounded-md border border-gray-200 object-cover shadow-md transition-shadow hover:shadow-lg dark:border-gray-700"
                key={i}
                src={blob}
                alt={asset.href}
                onClick={() => {
                  const bookSections = reader.focusedBookTab?.sections
                  if (!bookSections) return

                  // Cast to ISection[] because displayFromSelector needs the full object with methods, not just the snapshot
                  const sectionsArray = Array.from(
                    bookSections as any,
                  ) as ISection[]
                  const realSection = sectionsArray.find(
                    (s) => s.href === section.href,
                  )
                  if (realSection) {
                    const filename = src.split('/').pop()
                    reader.focusedBookTab?.displayFromSelector(
                      `img[src*="${filename}"]`,
                      realSection,
                    )
                  }
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
