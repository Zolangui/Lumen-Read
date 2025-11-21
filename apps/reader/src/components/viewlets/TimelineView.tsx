import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { useList, useTranslation } from '@flow/reader/hooks'
import { reader, useReaderSnapshot } from '@flow/reader/models'

import { PaneViewProps } from '../base'

dayjs.extend(relativeTime)

export const TimelineView: React.FC<PaneViewProps> = () => {
  const { focusedBookTab } = useReaderSnapshot()
  const rows = focusedBookTab?.timeline || []
  const { outerRef, innerRef, items } = useList(rows)
  const t = useTranslation('timeline')

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-4 dark:border-gray-700">
        <span className="material-symbols-outlined mr-2 text-xl text-gray-600 dark:text-gray-400">
          history
        </span>
        <h2 className="font-semibold text-gray-800 dark:text-white">
          {t('title')}
        </h2>
      </div>

      <div
        className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2"
        ref={outerRef}
      >
        <div className="space-y-0" ref={innerRef}>
          {items.map(({ index }) => {
            const row = rows[index]
            if (!row || !row.location || !row.location.start) return null

            const { location, timestamp } = row
            const { cfi, href } = location.start

            // Safely get title
            const navItem = focusedBookTab?.mapSectionToNavItem
              ? focusedBookTab.mapSectionToNavItem(href)
              : undefined

            return (
              <TimelineItem
                key={timestamp}
                title={
                  navItem?.label || t('unknown_section') || 'Unknown Section'
                }
                time={dayjs(timestamp).format('HH:mm')}
                onClick={() => {
                  reader.focusedBookTab?.display(cfi)
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface TimelineItemProps {
  title: string
  time: string
  onClick: () => void
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  title,
  time,
  onClick,
}) => {
  return (
    <a
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 rounded-md py-1 pr-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      <div className="bg-primary h-1.5 w-1.5 shrink-0 rounded-full" />
      <p className="min-w-0 flex-1 truncate text-sm leading-tight text-gray-900 dark:text-white">
        {title}
      </p>
      <span className="ml-auto shrink-0 font-mono text-xs text-gray-500 dark:text-gray-400">
        {time}
      </span>
    </a>
  )
}
