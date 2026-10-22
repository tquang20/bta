import { MotionFSM, NormalizedLandmark, FSMTransitionResult } from './MotionFSM';
import { PoseDetectorService } from './PoseDetector';
import { useGameStore } from '../../store/useGameStore';

export interface CVEngineCallback {
  onPoseDetected?: (landmarks: NormalizedLandmark[]) => void;
  onCalibrationProgress?: (progress: number, countdown: number, finished: boolean, dArm: number, dTorso: number, feedback: string) => void;
  onFsmUpdate?: (result: FSMTransitionResult) => void;
  onError?: (error: string) => void;
}

export class CVEngine {
  private detector: PoseDetectorService;
  private fsm: MotionFSM;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private callbacks: CVEngineCallback = {};
  private mode: 'calibration' | 'game' | 'idle' = 'idle';

  constructor() {
    this.detector = PoseDetectorService.getInstance();
    this.fsm = new MotionFSM();
  }

  public async initialize(): Promise<boolean> {
    return await this.detector.initialize();
  }

  public setCallbacks(callbacks: CVEngineCallback) {
    this.callbacks = callbacks;
  }

  public setMode(mode: 'calibration' | 'game' | 'idle') {
    this.mode = mode;
    if (mode === 'idle' || mode === 'calibration') {
      this.fsm.reset();
    }
  }

  public setCalibrationMetrics(dArm: number, dTorso: number) {
    this.fsm.setCalibrationMetrics(dArm, dTorso);
  }

  public setSensitivity(sensitivity: 'forgiving' | 'standard' | 'strict') {
    this.fsm.setSensitivity(sensitivity);
  }

  public start(video: HTMLVideoElement) {
    this.videoElement = video;
    this.isRunning = true;
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = () => {
    if (!this.isRunning || !this.videoElement) return;

    const now = performance.now();
    const result = this.detector.detect(this.videoElement, now);

    if (result && result.landmarks) {
      const landmarks = result.landmarks;

      if (this.callbacks.onPoseDetected) {
        this.callbacks.onPoseDetected(landmarks);
      }

      if (this.mode === 'calibration') {
        const calib = this.fsm.processCalibrationFrame(landmarks);
        if (this.callbacks.onCalibrationProgress) {
          this.callbacks.onCalibrationProgress(
            calib.progress,
            calib.countdown,
            calib.finished,
            calib.dArm,
            calib.dTorso,
            calib.feedback
          );
        }
      } else if (this.mode === 'game') {
        const gameState = useGameStore.getState();
        if (gameState.isPlaying && !gameState.isGameOver) {
          const fsmResult = this.fsm.processFrame(landmarks, now);
          if (this.callbacks.onFsmUpdate) {
            this.callbacks.onFsmUpdate(fsmResult);
          }
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  public getMotionFSM(): MotionFSM {
    return this.fsm;
  }

  public destroy() {
    this.stop();
    this.detector.destroy();
  }
}
