/**
 * Dashboard - Main application view
 *
 * Orchestrates the UI for the video editing pipeline:
 * - Upload zone for video input
 * - Processing view with progress indication
 * - Results view with timeline and export
 */

import { AgenticBrain, PipelineProgress, PipelineResult } from '../services/AgenticBrain';
import { composeVideo, downloadBlob, loadFFmpeg } from '../services/CompositionService';
import { FrameMetadata } from '../domain/models/FrameMetadata';
import { FrameDecision } from '../domain/models/EditorialDecision';
import { TimeRange } from '../domain/models/TimeRange';

/**
 * Application state
 */
type AppState = 'idle' | 'processing' | 'results' | 'exporting';

/**
 * Dashboard component
 */
export class Dashboard {
  private container: HTMLElement;
  private state: AppState = 'idle';
  private currentFile: File | null = null;
  private result: PipelineResult | null = null;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.render();
  }

  /**
   * Main render method
   */
  private render(): void {
    switch (this.state) {
      case 'idle':
        this.renderUploadView();
        break;
      case 'processing':
        this.renderProcessingView();
        break;
      case 'results':
        this.renderResultsView();
        break;
      case 'exporting':
        this.renderExportingView();
        break;
    }
  }

  /**
   * Render the upload view
   */
  private renderUploadView(): void {
    this.container.innerHTML = `
      <div class="app-container">
        ${this.renderHeader()}
        <main class="app-main">
          <div class="upload-zone" id="uploadZone">
            <div class="upload-zone-icon">VIDEO</div>
            <div class="upload-zone-title">Drop your video here</div>
            <div class="upload-zone-subtitle">or click to browse files</div>
            <div class="upload-zone-formats">
              <span>MP4</span>
              <span>MOV</span>
              <span>WebM</span>
              <span>AVI</span>
            </div>
            <input type="file" id="fileInput" accept="video/*" hidden>
          </div>

          <div class="mt-6 text-center text-secondary" style="max-width: 600px; margin: var(--space-6) auto 0;">
            <p style="font-size: 0.875rem;">
              <strong>AntiGravity</strong> uses on-device AI to analyze your video and automatically
              create a highlight reel. All processing happens locally in your browser, and your video
              never leaves your device.
            </p>
          </div>
        </main>
      </div>
    `;

    this.setupUploadHandlers();
  }

  /**
   * Setup upload zone event handlers
   */
  private setupUploadHandlers(): void {
    const zone = document.getElementById('uploadZone')!;
    const input = document.getElementById('fileInput') as HTMLInputElement;

    // Click to upload
    zone.addEventListener('click', () => input.click());

    // File selected
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.handleFileUpload(file);
    });

    // Drag and drop
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer?.files[0];
      if (file && file.type.startsWith('video/')) {
        this.handleFileUpload(file);
      }
    });
  }

  /**
   * Handle file upload and start processing
   */
  private async handleFileUpload(file: File): Promise<void> {
    this.currentFile = file;
    this.state = 'processing';
    this.render();

    try {
      const brain = new AgenticBrain({}, (progress) => {
        this.updateProgress(progress);
      });

      this.result = await brain.process(file);
      this.state = 'results';
      this.render();
    } catch (error) {
      console.error('Processing failed:', error);
      this.showToast('Processing failed: ' + (error as Error).message, 'error');
      this.state = 'idle';
      this.render();
    }
  }

  /**
   * Render the processing view
   */
  private renderProcessingView(): void {
    this.container.innerHTML = `
      <div class="app-container">
        ${this.renderHeader()}
        <main class="app-main">
          <div class="processing-container">
            <div class="processing-card">
              <div class="processing-video-preview" id="videoPreview">
                <video id="previewVideo" muted autoplay loop></video>
              </div>

              <h2 style="margin-bottom: var(--space-2);">Analyzing Video</h2>
              <p class="text-secondary" style="margin-bottom: var(--space-6);">
                ${this.currentFile?.name || 'video.mp4'}
              </p>

              <div class="processing-progress-container">
                <div class="processing-ring-container">
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#1f9fa8"/>
                        <stop offset="100%" style="stop-color:#f07f48"/>
                      </linearGradient>
                    </defs>
                    <circle class="processing-ring-bg" cx="60" cy="60" r="52"/>
                    <circle class="processing-ring-progress" id="progressRing" cx="60" cy="60" r="52"
                      stroke-dasharray="326.73" stroke-dashoffset="326.73"/>
                  </svg>
                  <div class="processing-ring-text">
                    <div class="processing-ring-percent" id="progressPercent">0%</div>
                    <div class="processing-ring-label" id="progressLabel">Starting...</div>
                  </div>
                </div>

                <div class="processing-status" id="processingStatus">Initializing AI model...</div>
              </div>

              <div class="processing-stage-indicator">
                <div class="processing-stage active" id="stageLoad">
                  <div class="processing-stage-icon">AI</div>
                  <div class="processing-stage-label">Load Model</div>
                </div>
                <div class="processing-stage" id="stageExtract">
                  <div class="processing-stage-icon">FRM</div>
                  <div class="processing-stage-label">Extract Frames</div>
                </div>
                <div class="processing-stage" id="stageAnalyze">
                  <div class="processing-stage-icon">ANL</div>
                  <div class="processing-stage-label">Analyze</div>
                </div>
                <div class="processing-stage" id="stageDecide">
                  <div class="processing-stage-icon">EDT</div>
                  <div class="processing-stage-label">Build Edit</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;

    // Load video preview
    if (this.currentFile) {
      const video = document.getElementById('previewVideo') as HTMLVideoElement;
      video.src = URL.createObjectURL(this.currentFile);
    }
  }

  /**
   * Update progress indicators
   */
  private updateProgress(progress: PipelineProgress): void {
    const ring = document.getElementById('progressRing');
    const percent = document.getElementById('progressPercent');
    const label = document.getElementById('progressLabel');
    const status = document.getElementById('processingStatus');

    if (ring) {
      const circumference = 326.73;
      const offset = circumference - (progress.progress / 100) * circumference;
      ring.style.strokeDashoffset = String(offset);
    }

    if (percent) percent.textContent = `${Math.round(progress.progress)}%`;
    if (label) label.textContent = progress.stage;
    if (status) status.textContent = progress.message;

    // Update stage indicators
    const stages = ['loading', 'extracting', 'analyzing', 'deciding', 'complete'];
    const stageIds = ['stageLoad', 'stageExtract', 'stageAnalyze', 'stageDecide'];
    const currentIdx = stages.indexOf(progress.stage);

    stageIds.forEach((id, idx) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('active', 'complete');
        if (idx < currentIdx) el.classList.add('complete');
        else if (idx === currentIdx) el.classList.add('active');
      }
    });
  }

  /**
   * Render the results view
   */
  private renderResultsView(): void {
    if (!this.result) return;

    const { stats, frames, decisions, ranges } = this.result;

    this.container.innerHTML = `
      <div class="app-container">
        ${this.renderHeader()}
        <main class="app-main">
          <div class="results-container">
            <div class="results-preview-wrapper">
              <div class="results-preview">
                <div class="results-video">
                  <video id="resultVideo" controls></video>
                </div>
              </div>

              <div class="timeline-container mt-6">
                <div class="timeline-header">
                  <div class="timeline-title">Analysis Timeline</div>
                  <div class="timeline-legend">
                    <div class="timeline-legend-item">
                      <div class="timeline-legend-dot highlight"></div>
                      <span>Highlight</span>
                    </div>
                    <div class="timeline-legend-item">
                      <div class="timeline-legend-dot keep"></div>
                      <span>Keep</span>
                    </div>
                    <div class="timeline-legend-item">
                      <div class="timeline-legend-dot discard"></div>
                      <span>Discard</span>
                    </div>
                  </div>
                </div>

                <div class="timeline-track" id="timelineTrack">
                  ${this.renderTimelineSegments(decisions, stats.videoDuration)}
                </div>

                <div class="timeline-thumbnails" id="timelineThumbnails">
                  ${this.renderThumbnails(frames, decisions)}
                </div>
              </div>

              <div class="actions-bar">
                <button class="btn btn-secondary" id="btnStartOver">
                  Start Over
                </button>
                <button class="btn btn-primary btn-lg" id="btnExport">
                  Export Edited Video
                </button>
              </div>
            </div>

            <div class="results-sidebar">
              <div class="results-stats-card">
                <div class="results-stats-title">Analysis Summary</div>
                <div class="results-stats-grid">
                  <div class="results-stat">
                    <div class="results-stat-value">${this.formatTime(stats.videoDuration)}</div>
                    <div class="results-stat-label">Original</div>
                  </div>
                  <div class="results-stat">
                    <div class="results-stat-value success">${this.formatTime(stats.outputDuration)}</div>
                    <div class="results-stat-label">Final Edit</div>
                  </div>
                  <div class="results-stat">
                    <div class="results-stat-value accent">${stats.framesAnalyzed}</div>
                    <div class="results-stat-label">Frames Analyzed</div>
                  </div>
                  <div class="results-stat">
                    <div class="results-stat-value warning">${stats.compressionRatio.toFixed(1)}x</div>
                    <div class="results-stat-label">Compression</div>
                  </div>
                </div>
              </div>

              <div class="results-stats-card">
                <div class="results-stats-title">Segments</div>
                <div style="max-height: 300px; overflow-y: auto;">
                  ${this.renderSegmentList(ranges)}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;

    // Load video
    if (this.currentFile) {
      const video = document.getElementById('resultVideo') as HTMLVideoElement;
      video.src = URL.createObjectURL(this.currentFile);
    }

    // Setup event handlers
    document.getElementById('btnStartOver')?.addEventListener('click', () => {
      this.state = 'idle';
      this.currentFile = null;
      this.result = null;
      this.render();
    });

    document.getElementById('btnExport')?.addEventListener('click', () => {
      this.handleExport();
    });
  }

  /**
   * Render timeline segments
   */
  private renderTimelineSegments(decisions: FrameDecision[], duration: number): string {
    return decisions.map(d => {
      const left = (d.timestamp / duration) * 100;
      const width = (1 / duration) * 100;
      return `<div class="timeline-segment ${d.decision}"
        style="left: ${left}%; width: ${Math.max(width, 1)}%;"
        title="${d.reason}"></div>`;
    }).join('');
  }

  /**
   * Render thumbnail strip
   */
  private renderThumbnails(frames: FrameMetadata[], decisions: FrameDecision[]): string {
    // Only show every 5th frame to avoid overwhelming the UI
    const sparse = frames.filter((_, i) => i % 5 === 0);

    return sparse.map((frame, i) => {
      const decision = decisions.find(d =>
        Math.abs(d.timestamp - frame.timestamp) < 0.5
      );
      const className = decision?.decision || 'keep';

      return `<div class="timeline-thumbnail ${className}"
        data-timestamp="${frame.timestamp}"
        title="${this.formatTime(frame.timestamp)} - ${decision?.reason || 'Unknown'}">
        <canvas id="thumb_${i}" width="80" height="45"></canvas>
      </div>`;
    }).join('');
  }

  /**
   * Render segment list
   */
  private renderSegmentList(ranges: TimeRange[]): string {
    if (ranges.length === 0) {
      return '<p class="text-muted text-center p-4">No segments to keep</p>';
    }

    return ranges.map((range) => `
      <div class="frame-analysis-card" style="margin-bottom: var(--space-2);">
        <div class="frame-analysis-header">
          <div class="frame-analysis-time">
            ${this.formatTime(range.start)} -> ${this.formatTime(range.end)}
          </div>
          <div class="frame-analysis-decision highlight">
            ${(range.end - range.start).toFixed(1)}s
          </div>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">
          ${range.label || 'High quality segment'}
        </div>
      </div>
    `).join('');
  }

  /**
   * Render exporting view
   */
  private renderExportingView(): void {
    this.container.innerHTML = `
      <div class="app-container">
        ${this.renderHeader()}
        <main class="app-main">
          <div class="processing-container">
            <div class="processing-card">
              <div class="processing-video-preview">
                <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                  <span style="font-size: 2rem; letter-spacing: 0.2rem;">CUT</span>
                </div>
              </div>

              <h2 style="margin-bottom: var(--space-2);">Exporting Video</h2>
              <p class="text-secondary" style="margin-bottom: var(--space-6);">
                This may take a few minutes...
              </p>

              <div class="processing-progress-container">
                <div class="processing-status animate-pulse" id="exportStatus">
                  Loading FFmpeg...
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  /**
   * Handle video export
   */
  private async handleExport(): Promise<void> {
    if (!this.currentFile || !this.result) return;

    this.state = 'exporting';
    this.render();

    const statusEl = document.getElementById('exportStatus');

    try {
      // Load FFmpeg
      await loadFFmpeg((progress) => {
        if (statusEl) statusEl.textContent = progress.message;
      });

      // Compose video
      if (statusEl) statusEl.textContent = 'Composing video segments...';

      const blob = await composeVideo(
        this.currentFile,
        this.result.ranges,
        undefined,
        (progress) => {
          if (statusEl) statusEl.textContent = progress.message;
        }
      );

      // Download
      const filename = this.currentFile.name.replace(/\.[^.]+$/, '_edited.mp4');
      downloadBlob(blob, filename);

      this.showToast('Video exported successfully!', 'success');
      this.state = 'results';
      this.render();
    } catch (error) {
      console.error('Export failed:', error);
      this.showToast('Export failed: ' + (error as Error).message, 'error');
      this.state = 'results';
      this.render();
    }
  }

  /**
   * Render the header
   */
  private renderHeader(): string {
    return `
      <header class="app-header">
        <div class="app-logo">
          <div class="app-logo-icon">AG</div>
          <div class="app-logo-text">AntiGravity</div>
        </div>
        <div class="text-secondary" style="font-size: 0.875rem;">
          AI-powered Video Editor
        </div>
      </header>
    `;
  }

  /**
   * Format seconds to MM:SS
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Show a toast notification
   */
  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    // Create container if needed
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? 'OK' : 'X'}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close">X</button>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => toast.remove(), 5000);

    // Close button
    toast.querySelector('.toast-close')?.addEventListener('click', () => toast.remove());
  }
}

/**
 * Initialize the dashboard
 */
export function initDashboard(containerId: string = 'app'): Dashboard {
  return new Dashboard(containerId);
}
