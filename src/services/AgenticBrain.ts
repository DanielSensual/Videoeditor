/**
 * AgenticBrain - The Decision Orchestrator
 *
 * Coordinates the entire video analysis pipeline:
 * 1. Ingests video frames
 * 2. Runs AI analysis on each frame
 * 3. Applies decision matrix
 * 4. Returns time ranges for composition
 *
 * This is the "brain" that orchestrates the other services.
 */

import { FrameMetadata } from '../domain/models/FrameMetadata';
import { FrameDecision } from '../domain/models/EditorialDecision';
import { TimeRange } from '../domain/models/TimeRange';
import { DecisionConfig, DEFAULT_CONFIG, decideFrame, getDecisionStats } from '../domain/logic/DecisionMatrix';
import { CoalescerConfig, DEFAULT_COALESCER_CONFIG, coalesceToRanges, limitByDuration, getRangeStats } from '../domain/logic/RangeCoalescer';
import { IngestConfig, DEFAULT_INGEST_CONFIG, ingestVideo, getVideoMetadata } from './VideoIngestService';
import { loadModel, analyzeFrame, isModelLoaded } from './VisionAnalyst';

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  ingest: IngestConfig;
  decision: DecisionConfig;
  coalescer: CoalescerConfig;

  /** Maximum duration for final edit (0 = no limit) */
  maxOutputDuration: number;
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  ingest: DEFAULT_INGEST_CONFIG,
  decision: DEFAULT_CONFIG,
  coalescer: DEFAULT_COALESCER_CONFIG,
  maxOutputDuration: 0
};

/**
 * Pipeline progress events
 */
export interface PipelineProgress {
  stage: 'loading' | 'extracting' | 'analyzing' | 'deciding' | 'complete';
  progress: number;
  message: string;
  currentFrame?: number;
  totalFrames?: number;
}

/**
 * Pipeline result
 */
export interface PipelineResult {
  /** Time ranges to keep in the final edit */
  ranges: TimeRange[];

  /** All frame metadata (for UI display) */
  frames: FrameMetadata[];

  /** All decisions (for debugging/display) */
  decisions: FrameDecision[];

  /** Statistics */
  stats: {
    videoDuration: number;
    framesAnalyzed: number;
    framesKept: number;
    framesDiscarded: number;
    outputDuration: number;
    compressionRatio: number;
  };
}

/**
 * The Agentic Brain - orchestrates the entire pipeline
 */
export class AgenticBrain {
  private config: PipelineConfig;
  private onProgress?: (progress: PipelineProgress) => void;

  constructor(
    config: Partial<PipelineConfig> = {},
    onProgress?: (progress: PipelineProgress) => void
  ) {
    this.config = {
      ...DEFAULT_PIPELINE_CONFIG,
      ...config,
      ingest: { ...DEFAULT_PIPELINE_CONFIG.ingest, ...config.ingest },
      decision: { ...DEFAULT_PIPELINE_CONFIG.decision, ...config.decision },
      coalescer: { ...DEFAULT_PIPELINE_CONFIG.coalescer, ...config.coalescer }
    };
    this.onProgress = onProgress;
  }

  /**
   * Process a video file through the entire pipeline
   */
  async process(file: File): Promise<PipelineResult> {
    const frames: FrameMetadata[] = [];
    const decisions: FrameDecision[] = [];

    // Stage 1: Load model
    this.report({ stage: 'loading', progress: 0, message: 'Loading AI model...' });
    if (!isModelLoaded()) {
      await loadModel();
    }
    this.report({ stage: 'loading', progress: 100, message: 'Model loaded' });

    // Get video metadata
    const videoMeta = await getVideoMetadata(file);
    const expectedFrames = Math.ceil(videoMeta.duration / this.config.ingest.strideSeconds);

    // Stage 2 & 3: Extract and analyze frames
    let frameCount = 0;

    for await (const frameData of ingestVideo(file, this.config.ingest)) {
      frameCount++;

      // Report extraction progress
      this.report({
        stage: 'extracting',
        progress: (frameCount / expectedFrames) * 50,
        message: `Extracting frame ${frameCount}/${expectedFrames}`,
        currentFrame: frameCount,
        totalFrames: expectedFrames
      });

      // Analyze frame
      this.report({
        stage: 'analyzing',
        progress: 50 + (frameCount / expectedFrames) * 40,
        message: `Analyzing frame ${frameCount}/${expectedFrames}`,
        currentFrame: frameCount,
        totalFrames: expectedFrames
      });

      const metadata = await analyzeFrame(
        frameData.rawFrame,
        frameData.frameIndex,
        frameData.timestamp,
        frameData.videoDuration
      );

      // Add thumbnail if available
      if (frameData.thumbnail) {
        (metadata as any).thumbnail = frameData.thumbnail;
      }

      frames.push(metadata);

      // Make decision for this frame
      const decision = decideFrame(metadata, this.config.decision);
      decisions.push(decision);

      // Cleanup raw frame
      frameData.rawFrame.close();
    }

    // Stage 4: Coalesce to ranges
    this.report({
      stage: 'deciding',
      progress: 95,
      message: 'Building edit timeline...'
    });

    let ranges = coalesceToRanges(decisions, this.config.coalescer);

    // Apply duration limit if configured
    if (this.config.maxOutputDuration > 0) {
      ranges = limitByDuration(ranges, this.config.maxOutputDuration);
    }

    // Calculate statistics
    const decisionStats = getDecisionStats(decisions);
    const rangeStats = getRangeStats(ranges, videoMeta.duration);

    this.report({
      stage: 'complete',
      progress: 100,
      message: `Complete! Kept ${rangeStats.totalKeptDuration.toFixed(1)}s of ${videoMeta.duration.toFixed(1)}s`
    });

    return {
      ranges,
      frames,
      decisions,
      stats: {
        videoDuration: videoMeta.duration,
        framesAnalyzed: decisionStats.total,
        framesKept: decisionStats.keep + decisionStats.highlight,
        framesDiscarded: decisionStats.discard,
        outputDuration: rangeStats.totalKeptDuration,
        compressionRatio: rangeStats.compressionRatio
      }
    };
  }

  /**
   * Report progress
   */
  private report(progress: PipelineProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }
}

/**
 * Create a configured brain instance
 */
export function createBrain(
  config?: Partial<PipelineConfig>,
  onProgress?: (progress: PipelineProgress) => void
): AgenticBrain {
  return new AgenticBrain(config, onProgress);
}
