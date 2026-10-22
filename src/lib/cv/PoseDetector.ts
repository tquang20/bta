import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { NormalizedLandmark } from './MotionFSM';

export interface PoseDetectionResult {
  landmarks: NormalizedLandmark[];
  timestamp: number;
}

export class PoseDetectorService {
  private static instance: PoseDetectorService | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitializing: boolean = false;
  private initError: string | null = null;
  private lastVideoTime: number = -1;

  public static getInstance(): PoseDetectorService {
    if (!PoseDetectorService.instance) {
      PoseDetectorService.instance = new PoseDetectorService();
    }
    return PoseDetectorService.instance;
  }

  public async initialize(): Promise<boolean> {
    if (this.poseLandmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.initError = null;

    try {
      // Load WASM fileset from CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      // Try GPU acceleration first for zero UI thread blocking, fallback to CPU
      try {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.25,
          minPosePresenceConfidence: 0.25,
          minTrackingConfidence: 0.25,
        });
      } catch (gpuError) {
        console.warn('[Vibe Code CV] GPU delegate failed, falling back to CPU:', gpuError);
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.25,
          minPosePresenceConfidence: 0.25,
          minTrackingConfidence: 0.25,
        });
      }

      console.log('[Vibe Code CV] PoseLandmarker successfully initialized');
      this.isInitializing = false;
      return true;
    } catch (err: any) {
      console.warn('[Vibe Code CV] Notice initializing PoseLandmarker:', err?.message || err);
      this.initError = err?.message || 'Failed to load MediaPipe WASM model';
      this.isInitializing = false;
      return false;
    }
  }

  public isReady(): boolean {
    return this.poseLandmarker !== null;
  }

  public getError(): string | null {
    return this.initError;
  }

  public detect(videoElement: HTMLVideoElement, timestamp: number): PoseDetectionResult | null {
    if (!this.poseLandmarker) return null;
    if (videoElement.readyState < 2) return null;
    
    // Allow detection on every animation frame for ultra-fast reaction without dropping frames
    this.lastVideoTime = videoElement.currentTime;

    try {
      const results = this.poseLandmarker.detectForVideo(videoElement, timestamp);
      if (results && results.landmarks && results.landmarks.length > 0) {
        return {
          landmarks: results.landmarks[0] as NormalizedLandmark[],
          timestamp,
        };
      }
    } catch (err) {
      // Ignore transient frame drop
    }

    return null;
  }

  public destroy() {
    if (this.poseLandmarker) {
      try {
        this.poseLandmarker.close();
      } catch (e) {}
      this.poseLandmarker = null;
    }
  }
}
