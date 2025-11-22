import { useEffect, useRef, useState } from 'react'

import { useReaderSnapshot } from '../models'

export interface ReadingSession {
  date: string // 'YYYY-MM-DD'
  bookId: string
  duration: number // minutes
  pagesRead: number
}

export interface ReadingStats {
  totalTimeMinutes: number
  currentStreak: number
  lastReadDate: string
  sessions: ReadingSession[]
}

const STORAGE_KEY = 'readingStats'
const PAGE_THRESHOLD_MS = 8000 // 8 seconds minimum to count as "read"

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

function loadStats(): ReadingStats {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading reading stats:', error)
  }
  return {
    totalTimeMinutes: 0,
    currentStreak: 0,
    lastReadDate: '',
    sessions: [],
  }
}

function saveStats(stats: ReadingStats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch (error) {
    console.error('Error saving reading stats:', error)
  }
}

function calculateStreak(lastReadDate: string, today: string): number {
  if (!lastReadDate) return 0

  const last = new Date(lastReadDate)
  const current = new Date(today)
  const diffTime = current.getTime() - last.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // If last read was today, keep current streak
  if (diffDays === 0) return -1 // Signal to keep current

  // If last read was yesterday, increment streak
  if (diffDays === 1) return 1 // Signal to increment

  // If more than 1 day ago, reset streak
  return 0
}

export function useReadingTracker() {
  const { focusedBookTab } = useReaderSnapshot()
  const [stats, setStats] = useState<ReadingStats>(loadStats)
  const [todayTime, setTodayTime] = useState(0)
  const sessionStartTime = useRef<number>(0)
  const intervalRef = useRef<NodeJS.Timeout>()

  // Page tracking with 8-second threshold
  const lastPageTimestamp = useRef<number>(0)
  const lastPercentage = useRef<number>(0)
  const qualifiedPagesRead = useRef<number>(0)

  // Initialize session when book opens
  useEffect(() => {
    if (focusedBookTab) {
      sessionStartTime.current = Date.now()
      lastPageTimestamp.current = Date.now()
      lastPercentage.current = (focusedBookTab.book.percentage as number) || 0
      qualifiedPagesRead.current = 0

      // Update time every minute
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - sessionStartTime.current) / 60000,
        )
        setTodayTime(elapsed)
      }, 60000) // Update every minute

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [focusedBookTab])

  // Track page changes - monitor percentage changes
  useEffect(() => {
    if (focusedBookTab?.book.percentage) {
      const currentPercentage = focusedBookTab.book.percentage as number

      // If percentage changed (page turn detected)
      if (
        lastPercentage.current > 0 &&
        Math.abs(currentPercentage - lastPercentage.current) > 0.001
      ) {
        const timeOnPage = Date.now() - lastPageTimestamp.current

        // Only count if user spent at least 8 seconds on the page
        if (timeOnPage >= PAGE_THRESHOLD_MS) {
          qualifiedPagesRead.current += 1
        }
      }

      // Update tracking
      lastPercentage.current = currentPercentage
      lastPageTimestamp.current = Date.now()
    }
  }, [focusedBookTab?.book.percentage])

  // Save session on unmount or when switching books
  useEffect(() => {
    return () => {
      if (sessionStartTime.current && focusedBookTab) {
        const duration = Math.floor(
          (Date.now() - sessionStartTime.current) / 60000,
        )
        if (duration > 0) {
          const today = getTodayDate()
          const updatedStats = loadStats() // Reload to get latest

          // Update or create today's session
          const existingSession = updatedStats.sessions.find(
            (s) => s.date === today && s.bookId === focusedBookTab.id,
          )

          if (existingSession) {
            existingSession.duration += duration
            existingSession.pagesRead += qualifiedPagesRead.current
          } else {
            updatedStats.sessions.push({
              date: today,
              bookId: focusedBookTab.id,
              duration,
              pagesRead: qualifiedPagesRead.current,
            })
          }

          updatedStats.totalTimeMinutes += duration

          // Update streak
          const streakChange = calculateStreak(updatedStats.lastReadDate, today)
          if (streakChange === 1) {
            updatedStats.currentStreak += 1
          } else if (streakChange === 0) {
            updatedStats.currentStreak = 1
          }
          // If -1, keep current streak

          updatedStats.lastReadDate = today

          saveStats(updatedStats)
          setStats(updatedStats)
        }
      }
    }
  }, [focusedBookTab])

  return {
    stats,
    todayTime,
  }
}
