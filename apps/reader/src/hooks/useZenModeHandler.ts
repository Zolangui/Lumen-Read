import { useEffect, useCallback } from 'react'

import { useZenMode } from '../state'

declare const chrome: any

export function useZenModeHandler() {
  const [isZenMode, setZenMode] = useZenMode()

  const toggleZenMode = useCallback(async () => {
    const newState = !isZenMode

    // Chrome Extension environment
    if (
      typeof chrome !== 'undefined' &&
      chrome.windows &&
      chrome.windows.update
    ) {
      try {
        const window = await chrome.windows.getCurrent()
        if (window.id) {
          await chrome.windows.update(window.id, {
            state: newState ? 'fullscreen' : 'maximized',
          })
        }
      } catch (error) {
        console.error('Failed to toggle Chrome fullscreen:', error)
      }
    } else {
      // Standard Web/Firefox environment
      if (newState) {
        try {
          if (document.fullscreenEnabled) {
            await document.body.requestFullscreen()
          }
        } catch (e) {
          console.error('Fullscreen failed:', e)
        }
      } else {
        if (document.fullscreenElement) {
          try {
            await document.exitFullscreen()
          } catch (e) {
            console.error('Exit fullscreen failed:', e)
          }
        }
      }
    }

    setZenMode(newState)
  }, [isZenMode, setZenMode])

  useEffect(() => {
    const handleFullscreenChange = () => {
      // Sync state if user exits fullscreen via ESC or browser UI
      if (!document.fullscreenElement && isZenMode) {
        // Only sync if we are NOT in Chrome extension environment (where fullscreenElement might not be set)
        // or if we want to support ESC key exiting.
        // For now, let's keep it simple: if document fullscreen exits, we exit zen mode.
        // But for Chrome windows API, this event might not fire or matter as much.
        // We'll rely on the toggle for now, but keep this for standard web.
        if (
          typeof chrome === 'undefined' ||
          !chrome.windows ||
          !chrome.windows.update
        ) {
          setZenMode(false)
        }
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        toggleZenMode()
      }
    }

    if (isZenMode) {
      document.addEventListener('keydown', handleKeyDown)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isZenMode, setZenMode, toggleZenMode])

  return { toggleZenMode }
}
