/**
 * EditorialDecision - The output of the Agentic Brain
 *
 * Each frame gets one of these decisions based on the analysis.
 */

export type EditorialDecision = 'keep' | 'discard' | 'highlight';

/**
 * FrameDecision - Associates a frame with its editorial decision
 */
export interface FrameDecision {
  timestamp: number;
  decision: EditorialDecision;
  reason: string;
  priority: number; // Higher = more important to include
}

/**
 * Priority weights for different decision types
 */
export const DECISION_PRIORITIES: Record<EditorialDecision, number> = {
  highlight: 10,
  keep: 5,
  discard: 0
};

/**
 * Labels that trigger automatic discard (bathrooms, toilets, etc.)
 */
export const DISCARD_LABELS = [
  'toilet',
  'bathroom',
  'restroom',
  'urinal',
  'shower curtain',
  'bathtub',
  'medicine cabinet'
];

/**
 * Labels that trigger boost (highlight) priority
 */
export const BOOST_LABELS = [
  'kitchen',
  'pool',
  'swimming pool',
  'patio',
  'backyard',
  'living room',
  'dining room',
  'fireplace',
  'ocean',
  'mountain',
  'garden',
  'balcony',
  'terrace'
];

/**
 * Check if any label matches a discard trigger
 */
export function shouldDiscard(labels: string[]): boolean {
  return labels.some(label =>
    DISCARD_LABELS.some(discard =>
      label.toLowerCase().includes(discard.toLowerCase())
    )
  );
}

/**
 * Check if any label matches a boost trigger
 */
export function shouldBoost(labels: string[]): boolean {
  return labels.some(label =>
    BOOST_LABELS.some(boost =>
      label.toLowerCase().includes(boost.toLowerCase())
    )
  );
}
