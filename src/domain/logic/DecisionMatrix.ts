/**
 * DecisionMatrix - The "Real Estate" Algorithm
 *
 * Pure function that applies the editorial rules to frame metadata.
 * This is the "brain" logic without any side effects.
 */

import { FrameMetadata } from '../models/FrameMetadata';
import {
  FrameDecision,
  DECISION_PRIORITIES,
  shouldDiscard,
  shouldBoost
} from '../models/EditorialDecision';

/**
 * Configuration for the decision matrix
 */
export interface DecisionConfig {
  /** Minimum aesthetic score to keep (0-1) */
  aestheticThreshold: number;

  /** Minimum confidence to trust classification */
  confidenceThreshold: number;

  /** Whether to apply Real Estate-specific rules */
  realEstateMode: boolean;
}

/**
 * Default configuration - lenient to keep more content
 * Adjust these values to be more/less selective
 */
export const DEFAULT_CONFIG: DecisionConfig = {
  aestheticThreshold: 0.3,   // Lowered from 0.6 - keep more frames
  confidenceThreshold: 0.3,  // Lowered from 0.5 - trust more classifications
  realEstateMode: true
};

/**
 * Apply the decision matrix to a single frame
 *
 * Rules (in priority order):
 * 1. If labels contain bathroom/toilet -> DISCARD (override)
 * 2. If labels contain kitchen/pool/etc -> HIGHLIGHT (boost)
 * 3. If aesthetic score > threshold -> KEEP
 * 4. Otherwise -> DISCARD
 */
export function decideFrame(
  frame: FrameMetadata,
  config: DecisionConfig = DEFAULT_CONFIG
): FrameDecision {
  const { labels, aestheticScore, confidence } = frame;

  // Only trust high-confidence classifications
  const trustedLabels = confidence >= config.confidenceThreshold ? labels : [];

  // Rule 1: Discard blacklisted content (highest priority override)
  if (config.realEstateMode && shouldDiscard(trustedLabels)) {
    return {
      timestamp: frame.timestamp,
      decision: 'discard',
      reason: `Contains blacklisted content: ${trustedLabels.join(', ')}`,
      priority: 0
    };
  }

  // Rule 2: Boost priority content
  if (config.realEstateMode && shouldBoost(trustedLabels)) {
    return {
      timestamp: frame.timestamp,
      decision: 'highlight',
      reason: `Premium content: ${trustedLabels.join(', ')}`,
      priority: DECISION_PRIORITIES.highlight + aestheticScore * 2
    };
  }

  // Rule 3: Keep if aesthetically pleasing
  if (aestheticScore >= config.aestheticThreshold) {
    return {
      timestamp: frame.timestamp,
      decision: 'keep',
      reason: `High aesthetic score: ${(aestheticScore * 100).toFixed(0)}%`,
      priority: DECISION_PRIORITIES.keep + aestheticScore
    };
  }

  // Rule 4: Default discard
  return {
    timestamp: frame.timestamp,
    decision: 'discard',
    reason: `Low aesthetic score: ${(aestheticScore * 100).toFixed(0)}%`,
    priority: 0
  };
}

/**
 * Process a batch of frames and return decisions
 */
export function processFrameBatch(
  frames: FrameMetadata[],
  config: DecisionConfig = DEFAULT_CONFIG
): FrameDecision[] {
  return frames.map(frame => decideFrame(frame, config));
}

/**
 * Get statistics about the decisions
 */
export function getDecisionStats(decisions: FrameDecision[]): {
  total: number;
  keep: number;
  highlight: number;
  discard: number;
  keepPercentage: number;
} {
  const keep = decisions.filter(d => d.decision === 'keep').length;
  const highlight = decisions.filter(d => d.decision === 'highlight').length;
  const discard = decisions.filter(d => d.decision === 'discard').length;

  return {
    total: decisions.length,
    keep,
    highlight,
    discard,
    keepPercentage: decisions.length > 0
      ? ((keep + highlight) / decisions.length) * 100
      : 0
  };
}
