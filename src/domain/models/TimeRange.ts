/**
 * TimeRange - Represents a segment of video to keep or process
 */

export interface TimeRange {
  /** Start time in seconds */
  start: number;

  /** End time in seconds */
  end: number;

  /** Priority for ordering (higher = include first if time-constrained) */
  priority: number;

  /** Reason/label for this segment */
  label?: string;
}

/**
 * Create a TimeRange with validation
 */
export function createTimeRange(start: number, end: number, priority = 5, label?: string): TimeRange {
  if (start < 0) throw new Error('Start time cannot be negative');
  if (end < start) throw new Error('End time must be after start time');

  return { start, end, priority, label };
}

/**
 * Get the duration of a TimeRange in seconds
 */
export function getRangeDuration(range: TimeRange): number {
  return range.end - range.start;
}

/**
 * Get total duration of multiple TimeRanges
 */
export function getTotalDuration(ranges: TimeRange[]): number {
  return ranges.reduce((sum, range) => sum + getRangeDuration(range), 0);
}

/**
 * Check if two ranges overlap
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Merge two overlapping or adjacent ranges
 */
export function mergeRanges(a: TimeRange, b: TimeRange): TimeRange {
  return {
    start: Math.min(a.start, b.start),
    end: Math.max(a.end, b.end),
    priority: Math.max(a.priority, b.priority),
    label: a.label || b.label
  };
}

/**
 * Sort ranges by start time
 */
export function sortRangesByTime(ranges: TimeRange[]): TimeRange[] {
  return [...ranges].sort((a, b) => a.start - b.start);
}

/**
 * Sort ranges by priority (highest first)
 */
export function sortRangesByPriority(ranges: TimeRange[]): TimeRange[] {
  return [...ranges].sort((a, b) => b.priority - a.priority);
}
