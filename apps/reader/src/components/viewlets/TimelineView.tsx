import dayjs from 'dayjs'
import React, { useMemo } from 'react'

import {
  useAction,
  useReadingTracker,
  useTranslation,
} from '@flow/reader/hooks'
import { useReaderSnapshot } from '@flow/reader/models'

import { PaneViewProps } from '../base'

export const TimelineView: React.FC<PaneViewProps> = () => {
  const [, setAction] = useAction()
  const { stats, todayTime } = useReadingTracker()
  const { focusedBookTab } = useReaderSnapshot()
  const t = useTranslation()

  // Calculate current book progress
  const currentBook = focusedBookTab?.book
  const totalPages = currentBook?.pageCount || 400 // Fallback to 400 if not calculated yet
  const isEstimated = currentBook?.pageCountEstimated ?? false
  const pagesRead = focusedBookTab?.book.percentage
    ? Math.round((focusedBookTab.book.percentage as number) * totalPages)
    : 0
  const progress = totalPages > 0 ? (pagesRead / totalPages) * 100 : 0

  // Calculate average speed and estimated finish
  const totalSessions = stats.sessions.filter(
    (s) => s.bookId === currentBook?.id,
  )
  const totalMinutes = totalSessions.reduce((sum, s) => sum + s.duration, 0)
  const avgSpeed =
    totalMinutes > 0 ? Math.round((pagesRead / totalMinutes) * 60) : 0 // pages/hr

  // Cap display at 200+ to avoid unrealistic numbers breaking layout
  const avgSpeedDisplay = avgSpeed > 200 ? '200+' : avgSpeed.toString()

  const remainingPages = totalPages - pagesRead
  const estFinishMinutes =
    avgSpeed > 0 && avgSpeed <= 200
      ? Math.round((remainingPages / avgSpeed) * 60)
      : 0
  const estFinishHours = Math.floor(estFinishMinutes / 60)
  const estFinishMins = estFinishMinutes % 60

  // Generate heatmap data (last 12 weeks = 84 days)
  const heatmapData = useMemo(() => {
    const today = dayjs()
    const data: { [key: string]: number } = {}

    // Initialize all days to 0
    for (let i = 0; i < 84; i++) {
      const date = today.subtract(83 - i, 'day').format('YYYY-MM-DD')
      data[date] = 0
    }

    // Fill in actual reading data
    stats.sessions.forEach((session) => {
      if (data[session.date] !== undefined) {
        data[session.date] += session.duration
      }
    })

    return data
  }, [stats.sessions])

  // Calculate grid position for each day
  const heatmapGrid = useMemo(() => {
    const today = dayjs()
    const grid: Array<{
      date: string
      col: number
      row: number
      intensity: number
    }> = []

    for (let i = 0; i < 84; i++) {
      const date = today.subtract(83 - i, 'day')
      const dayOfWeek = date.day() // 0 = Sunday
      const weekIndex = Math.floor(i / 7)

      const minutes = heatmapData[date.format('YYYY-MM-DD')] || 0
      let intensity = 0
      if (minutes > 0 && minutes <= 15) intensity = 1
      else if (minutes > 15 && minutes <= 30) intensity = 2
      else if (minutes > 30 && minutes <= 60) intensity = 3
      else if (minutes > 60) intensity = 4

      grid.push({
        date: date.format('YYYY-MM-DD'),
        col: weekIndex + 2, // +2 because column 1 is the day labels
        row: dayOfWeek + 1, // +1 for 1-indexed grid
        intensity,
      })
    }

    return grid
  }, [heatmapData])

  const getIntensityClass = (intensity: number) => {
    switch (intensity) {
      case 1:
        return 'bg-primary/20'
      case 2:
        return 'bg-primary/40'
      case 3:
        return 'bg-primary/70'
      case 4:
        return 'bg-primary'
      default:
        return 'bg-gray-200 dark:bg-gray-700/50'
    }
  }

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
              <span className="material-symbols-outlined text-xl">
                bar_chart
              </span>
            </button>
            <h2 className="ml-2 font-semibold text-gray-800 dark:text-white">
              {t('timeline.header')}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 rounded-lg bg-white p-3 shadow-sm dark:bg-gray-800">
              <div className="text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">
                  schedule
                </span>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('timeline.today_time')}
                </p>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {todayTime} min
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg bg-white p-3 shadow-sm dark:bg-gray-800">
              <div className="text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">
                  local_fire_department
                </span>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('timeline.streak')}
                </p>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {stats.currentStreak}{' '}
                {stats.currentStreak === 1
                  ? t('timeline.day')
                  : t('timeline.days')}
              </p>
            </div>
          </div>

          {/* Current Book Progress */}
          {currentBook && (
            <div className="border-y border-gray-200 py-4 dark:border-gray-800">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                {t('timeline.current_book_progress')}
              </h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('timeline.pages_read')}
                  </p>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {pagesRead} / {totalPages}
                    {isEstimated ? ' ~' : ''}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t('timeline.avg_speed')}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {avgSpeedDisplay} pgs/hr
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t('timeline.est_finish')}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {estFinishHours > 0 || estFinishMins > 0
                      ? `~${estFinishHours}h ${estFinishMins}m`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reading Calendar */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('timeline.reading_calendar')}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{t('timeline.less')}</span>
                <div className="flex gap-1">
                  <div className="size-2.5 rounded-sm bg-gray-200 dark:bg-gray-700"></div>
                  <div className="bg-primary/20 size-2.5 rounded-sm"></div>
                  <div className="bg-primary/40 size-2.5 rounded-sm"></div>
                  <div className="bg-primary/70 size-2.5 rounded-sm"></div>
                  <div className="bg-primary size-2.5 rounded-sm"></div>
                </div>
                <span>{t('timeline.more')}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {/* Month labels */}
              <div className="grid grid-cols-[1.5rem_repeat(12,1fr)] gap-1 text-center text-[10px] text-gray-500 dark:text-gray-400">
                <div></div>
                <span>J</span>
                <span>F</span>
                <span>M</span>
                <span>A</span>
                <span>M</span>
                <span>J</span>
                <span>J</span>
                <span>A</span>
                <span>S</span>
                <span>O</span>
                <span>N</span>
                <span>D</span>
              </div>
              {/* Heatmap grid */}
              <div className="grid-rows-7 grid grid-cols-[1.5rem_repeat(12,1fr)] gap-0.5">
                {/* Day labels */}
                <span className="self-center text-right text-[10px] text-gray-500 dark:text-gray-400">
                  S
                </span>
                <span className="self-center text-right text-[10px] text-gray-500 dark:text-gray-400">
                  M
                </span>
                <span className="self-center text-right text-[10px] text-gray-500 dark:text-gray-400">
                  T
                </span>
                <span className="self-center text-right text-[10px] text-gray-500 dark:text-gray-400">
                  W
                </span>
                <span className="self-center text-right text-[10px] text-gray-500 dark:text-gray-400">
                  T
                </span>
                <span className="self-center text-right text-[10px] text-gray-500 dark:text-gray-400">
                  F
                </span>
                <span className="self-center text-right text-[10px] text-gray-500 dark:text-gray-400">
                  S
                </span>
                {/* Heatmap cells */}
                {heatmapGrid.map((cell) => (
                  <div
                    key={cell.date}
                    className={`size-2.5 rounded-sm ${getIntensityClass(
                      cell.intensity,
                    )}`}
                    style={{ gridColumn: cell.col, gridRow: cell.row }}
                    title={`${cell.date}: ${heatmapData[cell.date] || 0} min`}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
