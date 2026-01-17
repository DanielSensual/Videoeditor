/**
 * CompositionService - FFmpeg.wasm-powered video assembly
 *
 * Takes time ranges and creates the final edited video.
 * Handles audio crossfades and video encoding.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { TimeRange, sortRangesByTime } from '../domain/models/TimeRange';

/**
 * Composition configuration
 */
export interface CompositionConfig {
  /** Output format (mp4 or webm) */
  outputFormat: 'mp4' | 'webm';

  /** Audio crossfade duration in seconds */
  crossfadeDuration: number;

  /** Output video codec (libx264 for mp4, libvpx-vp9 for webm) */
  videoCodec: string;

  /** Output audio codec (aac for mp4, libopus for webm) */
  audioCodec: string;

  /** Video quality (CRF value, lower = better, 18-28 typical) */
  quality: number;
}

/**
 * Default composition config
 */
export const DEFAULT_COMPOSITION_CONFIG: CompositionConfig = {
  outputFormat: 'mp4',
  crossfadeDuration: 0.2,
  videoCodec: 'libx264',
  audioCodec: 'aac',
  quality: 23
};

/**
 * Composition progress callback
 */
export type CompositionProgress = {
  stage: 'loading' | 'extracting' | 'concatenating' | 'encoding' | 'complete';
  progress: number;
  message: string;
};

// FFmpeg instance (singleton)
let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

/**
 * Load FFmpeg WASM
 */
export async function loadFFmpeg(
  onProgress?: (progress: CompositionProgress) => void
): Promise<void> {
  if (isLoaded && ffmpeg) return;

  onProgress?.({
    stage: 'loading',
    progress: 0,
    message: 'Loading FFmpeg...'
  });

  ffmpeg = new FFmpeg();

  // Load FFmpeg core from CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
  });

  isLoaded = true;

  onProgress?.({
    stage: 'loading',
    progress: 100,
    message: 'FFmpeg loaded'
  });
}

/**
 * Check if FFmpeg is loaded
 */
export function isFFmpegLoaded(): boolean {
  return isLoaded && ffmpeg !== null;
}

/**
 * Generate FFmpeg filter complex for concatenation with crossfades
 * Note: Reserved for future crossfade implementation
 */
function _generateFilterComplex(
  segmentCount: number,
  _crossfadeDuration: number
): string {
  if (segmentCount <= 1) {
    return '[0:v][0:a]concat=n=1:v=1:a=1[outv][outa]';
  }

  const filters: string[] = [];

  // For simplicity, we will just concatenate without crossfades for now
  // Full crossfade implementation requires more complex filter chains
  const videoInputs = Array.from({ length: segmentCount }, (_, i) => `[${i}:v]`).join('');
  const audioInputs = Array.from({ length: segmentCount }, (_, i) => `[${i}:a]`).join('');

  filters.push(`${videoInputs}concat=n=${segmentCount}:v=1:a=0[outv]`);
  filters.push(`${audioInputs}concat=n=${segmentCount}:v=0:a=1[outa]`);

  return filters.join(';');
}

// Keep reference to prevent unused warning
void _generateFilterComplex;

/**
 * Compose a video from time ranges
 */
export async function composeVideo(
  sourceFile: File,
  ranges: TimeRange[],
  config: CompositionConfig = DEFAULT_COMPOSITION_CONFIG,
  onProgress?: (progress: CompositionProgress) => void
): Promise<Blob> {
  // Ensure FFmpeg is loaded
  if (!isFFmpegLoaded()) {
    await loadFFmpeg(onProgress);
  }

  if (!ffmpeg) {
    throw new Error('FFmpeg not initialized');
  }

  // Sort ranges by time
  const sortedRanges = sortRangesByTime(ranges);

  if (sortedRanges.length === 0) {
    throw new Error('No ranges to compose');
  }

  onProgress?.({
    stage: 'extracting',
    progress: 0,
    message: 'Writing source file...'
  });

  // Write source file to FFmpeg filesystem
  const sourceData = await fetchFile(sourceFile);
  await ffmpeg.writeFile('input.mp4', sourceData);

  // Extract each segment
  const segmentFiles: string[] = [];

  for (let i = 0; i < sortedRanges.length; i++) {
    const range = sortedRanges[i];
    const segmentName = `segment_${i}.mp4`;

    onProgress?.({
      stage: 'extracting',
      progress: (i / sortedRanges.length) * 50,
      message: `Extracting segment ${i + 1}/${sortedRanges.length}`
    });

    // Extract segment - re-encode to ensure proper keyframes
    await ffmpeg.exec([
      '-ss', range.start.toString(),  // Seek BEFORE input for faster seeking
      '-i', 'input.mp4',
      '-t', (range.end - range.start).toString(),
      '-c:v', 'libx264',              // Re-encode video (not copy)
      '-c:a', 'aac',                   // Re-encode audio
      '-crf', '23',                    // Good quality
      '-preset', 'ultrafast',          // Fast encoding
      '-y',                            // Overwrite
      segmentName
    ]);

    segmentFiles.push(segmentName);
  }

  onProgress?.({
    stage: 'concatenating',
    progress: 50,
    message: 'Creating segment list...'
  });

  // Create concat file list
  const concatList = segmentFiles.map(f => `file '${f}'`).join('\n');
  await ffmpeg.writeFile('concat.txt', concatList);

  onProgress?.({
    stage: 'encoding',
    progress: 60,
    message: 'Encoding final video...'
  });

  // Concatenate segments
  const outputName = `output.${config.outputFormat}`;

  await ffmpeg.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c:v', config.videoCodec,
    '-c:a', config.audioCodec,
    '-crf', config.quality.toString(),
    '-preset', 'fast',
    outputName
  ]);

  onProgress?.({
    stage: 'complete',
    progress: 100,
    message: 'Video composition complete!'
  });

  // Read output file
  const outputData = await ffmpeg.readFile(outputName);

  // Cleanup
  await ffmpeg.deleteFile('input.mp4');
  await ffmpeg.deleteFile('concat.txt');
  for (const segment of segmentFiles) {
    await ffmpeg.deleteFile(segment);
  }
  await ffmpeg.deleteFile(outputName);

  // Convert to Blob - handle FFmpeg's FileData type
  const mimeType = config.outputFormat === 'mp4' ? 'video/mp4' : 'video/webm';
  // FFmpeg returns either string or Uint8Array; we need to handle the Uint8Array case
  if (typeof outputData === 'string') {
    return new Blob([outputData], { type: mimeType });
  }
  // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
  const buffer = new ArrayBuffer(outputData.byteLength);
  new Uint8Array(buffer).set(outputData);
  return new Blob([buffer], { type: mimeType });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Cleanup FFmpeg resources
 */
export async function disposeFFmpeg(): Promise<void> {
  if (ffmpeg) {
    ffmpeg.terminate();
    ffmpeg = null;
    isLoaded = false;
  }
}
