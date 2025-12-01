import clsx from 'clsx'
import { memo, useMemo, useState } from 'react'

import { useAction, useList, useTranslation } from '@flow/reader/hooks'
import {
  flatTree,
  INavItemSnapshot,
  reader,
  useReaderSnapshot,
} from '@flow/reader/models'

import { PaneViewProps } from '../base'

const EMPTY_OBJECT = {}

export const TocView: React.FC<PaneViewProps> = () => {
  return (
    <div className="h-full w-full overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex h-full min-w-[220px] flex-col">
        <TocPane />
      </div>
    </div>
  )
}

const TocPane: React.FC = () => {
  const { focusedBookTab } = useReaderSnapshot()
  const [, setAction] = useAction()
  const t = useTranslation()
  const toc = focusedBookTab?.nav?.toc as INavItemSnapshot[] | undefined
  const expandedState = focusedBookTab?.tocExpandedState ?? EMPTY_OBJECT
  const rows = useMemo(
    () => toc?.flatMap((i) => flatTree(i, 1, expandedState)),
    [toc, expandedState],
  )
  const currentNavItem = focusedBookTab?.currentNavItem as
    | INavItemSnapshot
    | undefined

  const [lastClickedHref, setLastClickedHref] = useState<string | undefined>()

  const { outerRef, innerRef, items, scrollToItem } = useList(rows)

  const bookTitle =
    focusedBookTab?.book?.metadata?.title ||
    focusedBookTab?.book?.name ||
    t('toc.header')

  return (
    <div className="flex flex-grow flex-col">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex min-w-0 items-center">
          <button
            onClick={() => setAction(undefined)}
            className="rounded p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-xl">list</span>
          </button>
          <h2 className="ml-2 truncate font-semibold text-gray-800 dark:text-white">
            {bookTitle}
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-y-auto p-4" ref={outerRef}>
        <h3 className="mb-2 px-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
          {t('toc.header')}
        </h3>
        {rows && (
          <div ref={innerRef}>
            <ul className="text-sm text-gray-500 dark:text-gray-400">
              {items.map(({ index }) => {
                const item = rows[index]
                if (!item) return null
                return (
                  <TocRow
                    key={item.id}
                    currentNavItem={currentNavItem}
                    item={item}
                    lastClickedHref={lastClickedHref}
                    setLastClickedHref={setLastClickedHref}
                    onActivate={() => scrollToItem(index)}
                  />
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

interface TocRowProps {
  currentNavItem?: INavItemSnapshot
  item: INavItemSnapshot
  lastClickedHref: string | undefined
  setLastClickedHref: (href: string) => void
  onActivate: () => void
}

const TocRow = memo<TocRowProps>(
  ({
    currentNavItem,
    item,
    lastClickedHref,
    setLastClickedHref,
    onActivate,
  }) => {
    const { label, subitems, depth, expanded, id, href } = item

    const isActive = useMemo(() => {
      if (lastClickedHref) {
        return href === lastClickedHref
      }
      return href === currentNavItem?.href
    }, [href, currentNavItem, lastClickedHref])

    const hasSubitems = subitems && subitems.length > 0
    const paddingLeft = `${(depth - 1) * 1}rem`

    return (
      <li
        className={clsx(
          'overflow-hidden rounded transition-colors',
          isActive
            ? 'bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800',
        )}
      >
        <button
          onClick={() => {
            if (href) {
              setLastClickedHref(href)
              reader.focusedBookTab?.display(href, false)
              onActivate()
            }
          }}
          className={clsx(
            'flex w-full items-center rounded px-2 py-1 text-left text-[13px]',
            isActive && 'text-primary font-semibold dark:text-white',
          )}
          style={{ paddingLeft: depth > 1 ? paddingLeft : undefined }}
        >
          {hasSubitems && (
            <span
              onClick={(e) => {
                e.stopPropagation()
                reader.focusedBookTab?.toggle(id)
              }}
              className={clsx(
                'material-symbols-outlined mr-1 text-sm transition-transform',
                expanded ? 'rotate-90' : '',
              )}
            >
              chevron_right
            </span>
          )}
          <span className="truncate">{label.trim()}</span>
        </button>
      </li>
    )
  },
)
TocRow.displayName = 'TocRow'
