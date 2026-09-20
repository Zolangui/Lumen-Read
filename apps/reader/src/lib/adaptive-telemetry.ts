import type { LumenPresentationOutcome } from '@flow/epubjs'

/**
 * Local-only aggregate telemetry for the adaptive presentation engine.
 *
 * No book content, titles, URLs, CFIs or identifiers are ever stored: only
 * outcome counters, fallback reasons and latency buckets. There is no
 * network involved; the summary can be copied to the clipboard for manual
 * bug reports. This respects the "no telemetry in extension releases"
 * policy: nothing leaves the device unless the user pastes it.
 */

export type AdaptiveLatencyBucket =
  | 'under250ms'
  | '250to500ms'
  | '500to1000ms'
  | '1000to2000ms'
  | 'over2000ms'

export type AdaptiveTelemetrySummary = {
  version: 1
  outcomesTotal: number
  statusCounts: Record<string, number>
  reasonCounts: Record<string, number>
  latencyBuckets: Record<AdaptiveLatencyBucket, number>
  debtSpineCount: number
}

const STORAGE_KEY = 'lumen-adaptive-telemetry-v1'
const DISMISS_KEY_PREFIX = 'lumen-adaptive-pill-dismiss:'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

const EMPTY_SUMMARY = (): AdaptiveTelemetrySummary => ({
  version: 1,
  outcomesTotal: 0,
  statusCounts: {},
  reasonCounts: {},
  latencyBuckets: {
    under250ms: 0,
    '250to500ms': 0,
    '500to1000ms': 0,
    '1000to2000ms': 0,
    over2000ms: 0,
  },
  debtSpineCount: 0,
})

function latencyBucket(elapsedMs: number | undefined): AdaptiveLatencyBucket {
  if (elapsedMs === undefined) return 'over2000ms'
  if (elapsedMs < 250) return 'under250ms'
  if (elapsedMs < 500) return '250to500ms'
  if (elapsedMs < 1000) return '500to1000ms'
  if (elapsedMs < 2000) return '1000to2000ms'
  return 'over2000ms'
}

function readSummary(): AdaptiveTelemetrySummary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_SUMMARY()
    const parsed = JSON.parse(raw) as Partial<AdaptiveTelemetrySummary>
    if (parsed?.version !== 1) return EMPTY_SUMMARY()
    const base = EMPTY_SUMMARY()
    return {
      ...base,
      ...parsed,
      statusCounts: { ...(parsed.statusCounts ?? {}) },
      reasonCounts: { ...(parsed.reasonCounts ?? {}) },
      latencyBuckets: {
        ...base.latencyBuckets,
        ...(parsed.latencyBuckets ?? {}),
      },
    }
  } catch {
    return EMPTY_SUMMARY()
  }
}

function bump(counts: Record<string, number>, key: string | undefined): void {
  if (!key) return
  counts[key] = (counts[key] ?? 0) + 1
}

/** Record one engine outcome. Safe to call from any outcome callback. */
export function recordAdaptiveOutcome(outcome: LumenPresentationOutcome): void {
  try {
    const summary = readSummary()
    summary.outcomesTotal += 1
    bump(summary.statusCounts, outcome.status)
    bump(summary.reasonCounts, outcome.reason)
    summary.latencyBuckets[latencyBucket(outcome.elapsedMs)] += 1
    if ((outcome.legibility?.knownLowContrastSamples ?? 0) > 0) {
      summary.debtSpineCount += 1
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(summary))
  } catch {
    // Telemetry must never break reading.
  }
}

export function getAdaptiveTelemetrySummary(): AdaptiveTelemetrySummary {
  return readSummary()
}

export function clearAdaptiveTelemetry(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export async function copyAdaptiveTelemetryToClipboard(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(
      JSON.stringify(getAdaptiveTelemetrySummary(), null, 2),
    )
    return true
  } catch {
    return false
  }
}

/** Dismissal of the contextual discovery pill, per book revision. */
export function isAdaptivePillDismissed(publicationRevision: string): boolean {
  if (!publicationRevision) return false
  try {
    const raw = localStorage.getItem(DISMISS_KEY_PREFIX + publicationRevision)
    if (!raw) return false
    return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS
  } catch {
    return false
  }
}

export function dismissAdaptivePill(publicationRevision: string): void {
  if (!publicationRevision) return
  try {
    localStorage.setItem(
      DISMISS_KEY_PREFIX + publicationRevision,
      String(Date.now()),
    )
  } catch {
    // ignore
  }
}
