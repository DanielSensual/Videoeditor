/**
 * RangeCoalescer - Convert frame decisions to time ranges
 *
 * Takes point-in-time decisions (1 per sampled frame) and converts them
 * to continuous time ranges for video composition.
 */

import { FrameDecision } from '../models/EditorialDecision';
import { TimeRange, createTimeRange, mergeRanges } from '../models/TimeRange';

/**
 * Configuration for range coalescing
 */
export interface CoalescerConfig {
  /**
   * How much time window to assign to each frame decision (seconds).
   * Should match the frame stride used during extraction.
   * Default: 1.0 second per frame
   */
  frameWindow: number;

  /**
   * Maximum gap between ranges that can be merged (seconds).
   * Prevents jarring cuts for brief discarded moments.
   * Default: 0.5 seconds
   */
  mergeGap: number;

  /**
   * Minimum duration for a kept segment (seconds).
   * Prevents keeping very short clips.
   * Default: 1.0 second
   */
  minSegmentDuration: number;
}

/**
 * Default coalescer configuration
 */
export const DEFAULT_COALESCER_CONFIG: CoalescerConfig = {
  frameWindow: 1.0,
  mergeGap: 0.5,
  minSegmentDuration: 1.0
};

/**
 * Convert frame decisions to time ranges
 *
 * Example:
 * - Frame at 0s: keep
 * - Frame at 1s: keep
 * - Frame at 2s: discard
 * - Frame at 3s: keep
 *
 * With frameWindow=1.0, produces:
 * - Range [0, 2) from frames 0-1
 * - Range [3, 4) from frame 3
 */
export function coalesceToRanges(
  decisions: FrameDecision[],
  config: CoalescerConfig = DEFAULT_COALESCER_CONFIG
): TimeRange[] {
  if (decisions.length === 0) return [];

  // Sort by timestamp
  const sorted = [...decisions].sort((a, b) => a.timestamp - b.timestamp);

  // Filter to only kept/highlighted decisions
  const keepDecisions = sorted.filter(d => d.decision !== 'discard');

  if (keepDecisions.length === 0) return [];

  // Convert each decision to a range
  const initialRanges: TimeRange[] = keepDecisions.map(d =>
    createTimeRange(
      d.timestamp,
      d.timestamp + config.frameWindow,
      d.priority,
      d.reason
    )
  );

  // Merge overlapping/adjacent ranges
  const merged = mergeAdjacentRanges(initialRanges, config.mergeGap);

  // Filter out segments that are too short
  const filtered = merged.filter(r =>
    (r.end - r.start) >= config.minSegmentDuration
  );

  return filtered;
}

/**
 * Merge ranges that overlap or are within mergeGap of each other
 */
function mergeAdjacentRanges(ranges: TimeRange[], mergeGap: number): TimeRange[] {
  if (ranges.length <= 1) return ranges;

  // Sort by start time
  const sorted = [...ranges].sort((a, b) => a.start - b.start);

  const result: TimeRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = result[result.length - 1];

    // Check if ranges overlap or are within mergeGap
    if (current.start <= last.end + mergeGap) {
      // Merge
      result[result.length - 1] = mergeRanges(last, current);
    } else {
      // Add as new range
      result.push(current);
    }
  }

  return result;
}

/**
 * Limit total duration by selecting highest priority ranges
 */
export function limitByDuration(
  ranges: TimeRange[],
  maxDuration: number
): TimeRange[] {
  // Sort by priority (highest first)
  const byPriority = [...ranges].sort((a, b) => b.priority - a.priority);

  const selected: TimeRange[] = [];
  let totalDuration = 0;

  for (const range of byPriority) {
    const duration = range.end - range.start;

    if (totalDuration + duration <= maxDuration) {
      selected.push(range);
      totalDuration += duration;
    }
  }

  // Sort selected by time for proper playback order
  return selected.sort((a, b) => a.start - b.start);
}

/**
 * Get summary statistics for ranges
 */
export function getRangeStats(ranges: TimeRange[], videoDuration: number): {
  segmentCount: number;
  totalKeptDuration: number;
  totalDiscardedDuration: number;
  compressionRatio: number;
} {
  const totalKeptDuration = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
  const totalDiscardedDuration = videoDuration - totalKeptDuration;

  return {
    segmentCount: ranges.length,
    totalKeptDuration,
    totalDiscardedDuration,
    compressionRatio: videoDuration > 0 ? videoDuration / totalKeptDuration : 1
  };
}
