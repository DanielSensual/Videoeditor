/**
 * FrameMetadata - Core data structure for frame analysis results
 *
 * This is the output of the VisionAnalyst and input to the DecisionMatrix.
 * It's a pure data structure with no methods or side effects.
 */

export interface FrameMetadata {
  /** Timestamp in seconds from video start */
  timestamp: number;

  /** Aesthetic score from 0-1 (higher = more visually appealing) */
  aestheticScore: number;

  /** Classification labels from the ML model (e.g., "kitchen", "pool", "bathroom") */
  labels: string[];

  /** Confidence score for the top classification (0-1) */
  confidence: number;

  /** Optional thumbnail for UI preview */
  thumbnail?: ImageBitmap;

  /** Frame index in the original video */
  frameIndex: number;

  /** Duration of the video in seconds (for context) */
  videoDuration: number;
}

/**
 * Create a FrameMetadata object with defaults
 */
export function createFrameMetadata(
  partial: Partial<FrameMetadata> & Pick<FrameMetadata, 'timestamp' | 'frameIndex' | 'videoDuration'>
): FrameMetadata {
  return {
    aestheticScore: 0,
    labels: [],
    confidence: 0,
    ...partial
  };
}

/**
 * Serialize FrameMetadata for storage (strips non-serializable fields)
 */
export function serializeFrameMetadata(frame: FrameMetadata): Omit<FrameMetadata, 'thumbnail'> {
  const { thumbnail, ...rest } = frame;
  return rest;
}
