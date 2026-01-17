/**
 * VisionAnalyst - TensorFlow.js-powered frame analysis
 *
 * Runs image classification and aesthetic scoring on video frames.
 * Uses MobileNet for classification (fast, lightweight).
 */

import * as tf from '@tensorflow/tfjs';
import { FrameMetadata, createFrameMetadata } from '../domain/models/FrameMetadata';

/**
 * Analysis results from the Vision model
 */
export interface AnalysisResult {
  /** Top classification labels */
  labels: string[];

  /** Confidence score for top label (0-1) */
  confidence: number;

  /** Aesthetic score (0-1, simulated for now) */
  aestheticScore: number;
}

/**
 * Vision model state
 */
interface ModelState {
  isLoaded: boolean;
  model: tf.GraphModel | null;
  labels: string[];
}

// Singleton model state
let modelState: ModelState = {
  isLoaded: false,
  model: null,
  labels: []
};

/**
 * Load the classification model (MobileNet v2)
 */
export async function loadModel(): Promise<void> {
  if (modelState.isLoaded) return;

  console.log('[VisionAnalyst] Loading TensorFlow.js...');

  // Set WebGL backend for GPU acceleration
  await tf.setBackend('webgl');
  await tf.ready();

  console.log(`[VisionAnalyst] Using backend: ${tf.getBackend()}`);

  // Load MobileNet v2 from TensorFlow Hub
  console.log('[VisionAnalyst] Loading MobileNet v2...');
  modelState.model = await tf.loadGraphModel(
    'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_100_224/classification/3/default/1',
    { fromTFHub: true }
  );

  // Load ImageNet labels
  const labelsResponse = await fetch(
    'https://storage.googleapis.com/download.tensorflow.org/data/ImageNetLabels.txt'
  );
  const labelsText = await labelsResponse.text();
  modelState.labels = labelsText.trim().split('\n');

  modelState.isLoaded = true;
  console.log('[VisionAnalyst] Model loaded successfully');
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
  return modelState.isLoaded;
}

/**
 * Preprocess an image for MobileNet
 * MobileNet expects 224x224 images normalized to [-1, 1]
 */
function preprocessImage(imageBitmap: ImageBitmap): tf.Tensor4D {
  return tf.tidy(() => {
    // Create canvas to read pixel data
    const canvas = new OffscreenCanvas(224, 224);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imageBitmap, 0, 0, 224, 224);

    // Convert to tensor
    const imageData = ctx.getImageData(0, 0, 224, 224);
    let tensor = tf.browser.fromPixels(imageData);

    // Normalize to [-1, 1] (MobileNet requirement)
    tensor = tensor.toFloat().div(127.5).sub(1);

    // Add batch dimension
    return tensor.expandDims(0) as tf.Tensor4D;
  });
}

/**
 * Calculate aesthetic score from image properties
 *
 * This is a simplified heuristic-based approach:
 * - Analyzes color distribution
 * - Checks for good lighting (not too dark/bright)
 * - Evaluates color harmony
 */
async function calculateAestheticScore(imageBitmap: ImageBitmap): Promise<number> {
  return new Promise((resolve) => {
    const canvas = new OffscreenCanvas(64, 64); // Downsample for speed
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imageBitmap, 0, 0, 64, 64);

    const imageData = ctx.getImageData(0, 0, 64, 64);
    const data = imageData.data;

    let totalBrightness = 0;
    let totalSaturation = 0;
    let rSum = 0, gSum = 0, bSum = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      rSum += r;
      gSum += g;
      bSum += b;

      // Calculate brightness (perceived luminance)
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      totalBrightness += brightness;

      // Calculate saturation
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      totalSaturation += saturation;
    }

    const avgBrightness = totalBrightness / pixelCount;
    const avgSaturation = totalSaturation / pixelCount;

    // Score components
    // 1. Brightness should be in the sweet spot (0.3 - 0.7)
    const brightnessScore = 1 - Math.abs(avgBrightness - 0.5) * 2;

    // 2. Some saturation is good (colorful images are more appealing)
    const saturationScore = Math.min(avgSaturation * 2, 1);

    // 3. Color variety (not monochromatic)
    const rAvg = rSum / pixelCount;
    const gAvg = gSum / pixelCount;
    const bAvg = bSum / pixelCount;
    const colorVariety = (Math.abs(rAvg - gAvg) + Math.abs(gAvg - bAvg) + Math.abs(bAvg - rAvg)) / (3 * 255);
    const varietyScore = Math.min(colorVariety * 3, 1);

    // Combine scores
    const aestheticScore = (brightnessScore * 0.4 + saturationScore * 0.35 + varietyScore * 0.25);

    resolve(Math.max(0, Math.min(1, aestheticScore)));
  });
}

/**
 * Analyze a single frame
 */
export async function analyzeFrame(
  frame: ImageBitmap,
  frameIndex: number,
  timestamp: number,
  videoDuration: number
): Promise<FrameMetadata> {
  if (!modelState.isLoaded || !modelState.model) {
    await loadModel();
  }

  // Run classification
  const inputTensor = preprocessImage(frame);
  const predictions = modelState.model!.predict(inputTensor) as tf.Tensor;
  const probabilities = await predictions.data();

  // Get top 5 predictions
  const topK = 5;
  const indices = Array.from(probabilities)
    .map((prob, i) => ({ prob, i }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, topK);

  const labels = indices.map(({ i }) => modelState.labels[i] || `class_${i}`);
  const confidence = indices[0]?.prob || 0;

  // Calculate aesthetic score
  const aestheticScore = await calculateAestheticScore(frame);

  // Cleanup tensors
  inputTensor.dispose();
  predictions.dispose();

  return createFrameMetadata({
    timestamp,
    frameIndex,
    videoDuration,
    labels,
    confidence,
    aestheticScore
  });
}

/**
 * Analyze multiple frames in batch
 */
export async function analyzeFrames(
  frames: Array<{
    frame: ImageBitmap;
    frameIndex: number;
    timestamp: number;
    videoDuration: number;
  }>,
  onProgress?: (completed: number, total: number) => void
): Promise<FrameMetadata[]> {
  const results: FrameMetadata[] = [];

  for (let i = 0; i < frames.length; i++) {
    const { frame, frameIndex, timestamp, videoDuration } = frames[i];
    const metadata = await analyzeFrame(frame, frameIndex, timestamp, videoDuration);
    results.push(metadata);

    if (onProgress) {
      onProgress(i + 1, frames.length);
    }
  }

  return results;
}
