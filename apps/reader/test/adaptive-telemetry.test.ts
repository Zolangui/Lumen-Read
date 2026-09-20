// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import type { LumenPresentationOutcome } from '@flow/epubjs'

import {
  clearAdaptiveTelemetry,
  dismissAdaptivePill,
  getAdaptiveTelemetrySummary,
  isAdaptivePillDismissed,
  recordAdaptiveOutcome,
} from '../src/lib/adaptive-telemetry'

function outcome(
  partial: Partial<LumenPresentationOutcome>,
): LumenPresentationOutcome {
  return {
    status: 'adapted',
    purpose: 'reader',
    spineIndex: 0,
    diagnostics: [],
    ...partial,
  }
}

describe('adaptive telemetry', () => {
  beforeEach(() => {
    clearAdaptiveTelemetry()
    localStorage.clear()
  })

  it('aggregates statuses, reasons and latency buckets without book content', () => {
    recordAdaptiveOutcome(outcome({ status: 'adapted', elapsedMs: 120 }))
    recordAdaptiveOutcome(
      outcome({
        status: 'published-fallback',
        reason: 'probe-failed',
        elapsedMs: 2500,
      }),
    )
    const summary = getAdaptiveTelemetrySummary()
    expect(summary.outcomesTotal).toBe(2)
    expect(summary.statusCounts).toMatchObject({
      adapted: 1,
      'published-fallback': 1,
    })
    expect(summary.reasonCounts).toMatchObject({ 'probe-failed': 1 })
    expect(summary.latencyBuckets.under250ms).toBe(1)
    expect(summary.latencyBuckets.over2000ms).toBe(1)
    expect(JSON.stringify(summary)).not.toContain('chapter')
  })

  it('counts spines that finish with legibility debt', () => {
    recordAdaptiveOutcome(
      outcome({
        legibility: {
          modelVersion: 5,
          complete: false,
          truncated: false,
          visibleTextSamples: 2,
          visibleTextCodePoints: 20,
          nonVisibleTextSamples: 0,
          nonVisibleTextCodePoints: 0,
          provenReadableSamples: 1,
          provenReadableCodePoints: 10,
          knownLowContrastSamples: 1,
          knownLowContrastCodePoints: 10,
          unknownPaintSamples: 0,
          unknownPaintCodePoints: 0,
          visibleStrokeSides: 0,
          provenReadableStrokeSides: 0,
          knownLowContrastStrokeSides: 0,
          unknownStrokeSides: 0,
          unknownPaintByReason: {},
        },
      }),
    )
    expect(getAdaptiveTelemetrySummary().debtSpineCount).toBe(1)
  })

  it('tolerates corrupt storage and never throws', () => {
    localStorage.setItem('lumen-adaptive-telemetry-v1', '{broken')
    expect(() => recordAdaptiveOutcome(outcome({}))).not.toThrow()
    expect(getAdaptiveTelemetrySummary().outcomesTotal).toBe(1)
  })

  it('dismisses the pill per book with a cooldown', () => {
    expect(isAdaptivePillDismissed('rev-1')).toBe(false)
    dismissAdaptivePill('rev-1')
    expect(isAdaptivePillDismissed('rev-1')).toBe(true)
    expect(isAdaptivePillDismissed('rev-2')).toBe(false)
    expect(isAdaptivePillDismissed('')).toBe(false)
  })
})
