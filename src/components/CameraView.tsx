import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SkeletalOverlay } from './SkeletalOverlay';
import { CVEngine } from '../lib/cv/MediaPipeWorker';
import { NormalizedLandmark } from '../lib/cv/MotionFSM';
import { useGameStore, SensitivityMode } from '../store/useGameStore';
import { useRoomStore } from '../store/useRoomStore';
import { RoomClient } from '../lib/network/RoomClient';
import { Camera, RefreshCw, AlertTriangle, VideoOff, SunMedium, Sliders, Check, Keyboard, Play } from 'lucide-react';

interface CameraViewProps {
  mode: 'full' | 'game';
  isCalibrating?: boolean;
  onValidRep?: (dt: number, activeHand?: 'left' | 'right', nextHand?: 'left' | 'right' | 'any') => void;
  onInvalidRep?: (reason: string) => void;
  onCalibrationProgress?: (progress: number, countdown: number, finished: boolean, dArm: number, dTorso: number, feedback: string) => void;
  className?: string;
  showMeters?: boolean;
  zoomAndBlur?: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  mode,
  isCalibrating = false,
  onValidRep,
  onInvalidRep,
  onCalibrationProgress,
  className = '',
  showMeters = true,
  zoomAndBlur = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CVEngine | null>(null);

  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [cameraState, setCameraState] = useState<'requesting' | 'active' | 'denied' | 'error' | 'fallback_keys'>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });
  const [showSettings, setShowSettings] = useState(false);
  const [lastHitPopup, setLastHitPopup] = useState<{ hand: 'left' | 'right'; time: number } | null>(null);

  const mirrorCamera = useGameStore((s) => s.mirrorCamera);
  const toggleMirror = useGameStore((s) => s.toggleMirror);
  const currentState = useGameStore((s) => s.fsmState);
  const dArm = useGameStore((s) => s.dArm);
  const dTorso = useGameStore((s) => s.dTorso);
  const calibrationProgress = useGameStore((s) => s.calibrationProgress);
  const sensitivity = useGameStore((s) => s.sensitivity);
  const setSensitivity = useGameStore((s) => s.setSensitivity);
  const nextExpectedHand = useGameStore((s) => s.nextExpectedHand);
  const leftWristHeight = useGameStore((s) => s.leftWristHeight);
  const rightWristHeight = useGameStore((s) => s.rightWristHeight);

  const setConfidenceScore = useGameStore((s) => s.setConfidenceScore);
  const setAntiCheatWarning = useGameStore((s) => s.setAntiCheatWarning);
  const setBotCheatFlag = useGameStore((s) => s.setBotCheatFlag);
  const setFsmState = useGameStore((s) => s.setFsmState);
  const setTelemetry = useGameStore((s) => s.setTelemetry);

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth > 0 && clientHeight > 0) {
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    }
  }, []);

  const startCamera = async () => {
    setCameraState('requesting');
    setErrorMessage(null);

    try {
      let stream: MediaStream;
      const existingStream = useRoomStore.getState().localStream;

      if (existingStream && existingStream.active && existingStream.getVideoTracks().some((t) => t.readyState === 'live')) {
        stream = existingStream;
      } else {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraState('denied');
          setErrorMessage('Thiết bị hoặc trình duyệt không hỗ trợ camera. Bạn có thể chơi bằng bàn phím hoặc chạm màn hình.');
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user',
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraState('active');
        updateDimensions();
        // Register local stream for real-time WebRTC 1v1 video transmission
        RoomClient.getInstance().setLocalStream(stream);
        RoomClient.getInstance().startCameraRelay(videoRef.current);
      }
    } catch (err: any) {
      const isDismissedOrDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.name === 'AbortError' ||
        err?.name === 'NotReadableError' ||
        err?.message?.toLowerCase().includes('dismissed') ||
        err?.message?.toLowerCase().includes('denied');

      if (isDismissedOrDenied) {
        setCameraState('denied');
        setErrorMessage('Hộp thoại quyền Camera đã bị đóng hoặc từ chối. Bạn có thể nhấn "Bật Lại Camera" hoặc chơi ngay bằng phím ảo (A / D).');
      } else {
        setCameraState('error');
        setErrorMessage(err?.message || 'Không thể kết nối đến thiết bị camera.');
      }
    }
  };

  // Keyboard and Tap Simulation Trigger (Fail-safe for no-camera or dismissed permission)
  const triggerSimulatedHand = useCallback((hand: 'left' | 'right') => {
    const expected = useGameStore.getState().nextExpectedHand;
    if (expected === 'any' || expected === hand) {
      setLastHitPopup({ hand, time: Date.now() });
      if (onValidRep) {
        onValidRep(300, hand, hand === 'left' ? 'right' : 'left');
      }
    } else {
      if (onInvalidRep) {
        onInvalidRep(`Phải xen kẽ: Hãy giơ ${expected === 'left' ? 'Tay Trái (6)' : 'Tay Phải (7)'}!`);
      }
    }
  }, [onValidRep, onInvalidRep]);

  // Setup Keyboard shortcuts (A / Left Arrow for Left, D / Right Arrow for Right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        triggerSimulatedHand('left');
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        triggerSimulatedHand('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSimulatedHand]);

  useEffect(() => {
    const engine = new CVEngine();
    engineRef.current = engine;
    engine.setSensitivity(sensitivity);

    engine.setCallbacks({
      onPoseDetected: (detectedLandmarks) => {
        setLandmarks(detectedLandmarks);
      },
      onCalibrationProgress: (progress, countdown, finished, arm, torso, feedback) => {
        if (onCalibrationProgress) {
          onCalibrationProgress(progress, countdown, finished, arm, torso, feedback);
        }
      },
      onFsmUpdate: (result) => {
        setConfidenceScore(result.confidence);
        setAntiCheatWarning(result.antiCheatWarning);
        setBotCheatFlag(result.botCheatFlag);
        setTelemetry(result.leftWristHeight, result.rightWristHeight, result.nextExpectedHand, result.activeHand);

        if (result.stateChanged) {
          setFsmState(result.state);
        }

        if (result.isValidRep) {
          if (result.activeHand) {
            setLastHitPopup({ hand: result.activeHand, time: Date.now() });
          }
          if (onValidRep && result.dt) {
            onValidRep(result.dt, result.activeHand, result.nextExpectedHand);
          }
        } else if (result.isInvalidRep && onInvalidRep && result.reason) {
          onInvalidRep(result.reason);
        }
      },
    });

    engine.initialize().then(() => {
      if (videoRef.current && cameraState === 'active') {
        engine.start(videoRef.current);
      }
    });

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSensitivity(sensitivity);
    }
  }, [sensitivity]);

  useEffect(() => {
    if (engineRef.current) {
      if (isCalibrating) {
        engineRef.current.setMode('calibration');
      } else if (mode === 'game') {
        engineRef.current.setMode('game');
        engineRef.current.setCalibrationMetrics(dArm, dTorso);
      } else {
        engineRef.current.setMode('idle');
      }
    }
  }, [mode, isCalibrating, dArm, dTorso]);

  useEffect(() => {
    if (cameraState === 'active' && videoRef.current && engineRef.current) {
      engineRef.current.start(videoRef.current);
    }
  }, [cameraState]);

  useEffect(() => {
    startCamera();

    const handleResize = () => updateDimensions();
    window.addEventListener('resize', handleResize);

    const handleVisibility = () => {
      if (document.hidden) {
        engineRef.current?.stop();
      } else if (videoRef.current && cameraState === 'active') {
        engineRef.current?.start(videoRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center ${className}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        onLoadedMetadata={updateDimensions}
        className={`w-full h-full object-cover select-none pointer-events-none transition-all duration-700 ease-out ${
          mirrorCamera ? '-scale-x-100' : 'scale-x-100'
        } ${zoomAndBlur ? 'scale-115 filter blur-md' : 'scale-100 filter blur-0'}`}
      />

      {/* Skeletal Canvas Overlay */}
      {cameraState === 'active' && (
        <div
          className={`absolute inset-0 pointer-events-none transition-all duration-700 ease-out ${
            zoomAndBlur ? 'opacity-25 filter blur-sm' : 'opacity-100 filter blur-0'
          }`}
        >
          <SkeletalOverlay
            landmarks={landmarks}
            mode={mode}
            isCalibrating={isCalibrating}
            calibrationProgress={calibrationProgress}
            dArm={dArm}
            dTorso={dTorso}
            currentState={currentState}
            nextExpectedHand={nextExpectedHand}
            mirror={mirrorCamera}
            width={dimensions.width}
            height={dimensions.height}
          />
        </div>
      )}

      {/* Real-time Hand Reach Height Gauges (Left = 6, Right = 7) */}
      {showMeters && cameraState === 'active' && mode === 'game' && (
        <>
          {/* Left Hand (6) Gauge */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 bg-slate-950/75 backdrop-blur-md px-2 py-3 rounded-2xl border border-slate-800 pointer-events-none shadow-lg">
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">Tay 6</span>
            <div className="w-3.5 h-36 bg-slate-900 rounded-full relative overflow-hidden border border-slate-700 flex flex-col justify-end">
              {/* Target Line at 1.0 (100%) */}
              <div className="absolute top-[25%] left-0 right-0 h-0.5 bg-emerald-400/80 z-10" />
              {/* Current Height Fill */}
              <div
                className={`w-full transition-all duration-75 rounded-b-full ${
                  leftWristHeight >= 1.0 ? 'bg-emerald-400 shadow-lg shadow-emerald-400/80' : 'bg-emerald-600/70'
                }`}
                style={{ height: `${Math.min(100, Math.round(leftWristHeight * 75))}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono font-bold tabular-nums ${leftWristHeight >= 1.0 ? 'text-emerald-300' : 'text-slate-400'}`}>
              {leftWristHeight >= 1.0 ? 'ĐẠT' : `${Math.round(leftWristHeight * 100)}%`}
            </span>
          </div>

          {/* Right Hand (7) Gauge */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 bg-slate-950/75 backdrop-blur-md px-2 py-3 rounded-2xl border border-slate-800 pointer-events-none shadow-lg">
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">Tay 7</span>
            <div className="w-3.5 h-36 bg-slate-900 rounded-full relative overflow-hidden border border-slate-700 flex flex-col justify-end">
              {/* Target Line at 1.0 (100%) */}
              <div className="absolute top-[25%] left-0 right-0 h-0.5 bg-cyan-400/80 z-10" />
              {/* Current Height Fill */}
              <div
                className={`w-full transition-all duration-75 rounded-b-full ${
                  rightWristHeight >= 1.0 ? 'bg-cyan-400 shadow-lg shadow-cyan-400/80' : 'bg-cyan-600/70'
                }`}
                style={{ height: `${Math.min(100, Math.round(rightWristHeight * 75))}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono font-bold tabular-nums ${rightWristHeight >= 1.0 ? 'text-cyan-300' : 'text-slate-400'}`}>
              {rightWristHeight >= 1.0 ? 'ĐẠT' : `${Math.round(rightWristHeight * 100)}%`}
            </span>
          </div>

          {/* Floating +1 Hit Badge on Screen */}
          {lastHitPopup && Date.now() - lastHitPopup.time < 500 && (
            <div
              key={lastHitPopup.time}
              className={`absolute top-1/3 ${
                (lastHitPopup.hand === 'left' && mirrorCamera) || (lastHitPopup.hand === 'right' && !mirrorCamera)
                  ? 'left-1/4'
                  : 'right-1/4'
              } z-30 pointer-events-none animate-bounce flex items-center gap-1.5 px-4 py-2 rounded-2xl font-black font-mono text-base shadow-2xl transition-all ${
                lastHitPopup.hand === 'left'
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/50'
                  : 'bg-cyan-500 text-slate-950 shadow-cyan-500/50'
              }`}
            >
              <span>+1</span>
              <span className="text-xs uppercase font-bold">
                {lastHitPopup.hand === 'left' ? 'Tay Trái (6)' : 'Tay Phải (7)'}
              </span>
            </div>
          )}
        </>
      )}

      {/* Top Toolbar Controls */}
      {cameraState === 'active' && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          {/* Quick Sensitivity Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 hover:text-white transition-colors"
              title="Độ nhạy nhận diện động tác"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="capitalize">
                {sensitivity === 'forgiving' ? 'Dễ (Linh hoạt)' : sensitivity === 'strict' ? 'Khắt khe' : 'Chuẩn'}
              </span>
            </button>

            {showSettings && (
              <div className="absolute right-0 top-10 w-52 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl z-40 flex flex-col gap-1 text-xs font-mono">
                <span className="px-2 py-1 text-[11px] text-slate-400 font-bold uppercase">Độ nhạy bắt cử động:</span>
                {(
                  [
                    { id: 'forgiving', label: 'Linh hoạt (Dễ đạt)', desc: 'Tay chỉ cần giơ cao ngang cằm/tai' },
                    { id: 'standard', label: 'Chuẩn (Khuyên dùng)', desc: 'Ngang trán/đầu, chuẩn điệu nhảy' },
                    { id: 'strict', label: 'Esports Khắt khe', desc: 'Duỗi thẳng tay qua khỏi đầu' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSensitivity(opt.id);
                      setShowSettings(false);
                    }}
                    className={`flex flex-col text-left px-2.5 py-1.5 rounded-xl transition-all ${
                      sensitivity === opt.id ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{opt.label}</span>
                      {sensitivity === opt.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mirror Toggle */}
          <button
            onClick={toggleMirror}
            title={mirrorCamera ? 'Gương soi: Bật' : 'Gương soi: Tắt'}
            className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 hover:text-cyan-400 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{mirrorCamera ? 'Gương' : 'Thường'}</span>
          </button>
        </div>
      )}

      {/* Lighting Indicator in Lobby */}
      {cameraState === 'active' && mode === 'full' && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
          <SunMedium className="w-3.5 h-3.5 text-amber-400" />
          <span>Ánh sáng: Tốt</span>
        </div>
      )}

      {/* Camera State Overlays */}
      {cameraState === 'requesting' && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
          <Camera className="w-10 h-10 text-cyan-400 animate-pulse mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">Đang khởi động Camera</h3>
          <p className="text-xs text-slate-400 max-w-xs mb-4">
            Kết nối cảm biến hình ảnh để nhận diện cử động 6 7...
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCameraState('fallback_keys')}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition-colors border border-slate-700 flex items-center gap-1.5"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Chơi bằng phím ảo</span>
            </button>
          </div>
        </div>
      )}

      {/* Denied / Dismissed State */}
      {cameraState === 'denied' && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Bật Camera để Bắt Cử Động</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
            {errorMessage || 'Hộp thoại quyền Camera đã bị đóng hoặc chưa được cấp phép. Bạn có thể bấm nút bên dưới để cấp quyền hoặc chơi ngay bằng phím ảo!'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <button
              onClick={startCamera}
              className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>Bật Lại Camera</span>
            </button>
            <button
              onClick={() => setCameraState('fallback_keys')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5"
            >
              <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Giao Diện Phím Đầy Đủ</span>
            </button>
          </div>

          {/* Quick inline buttons so user can tap right away */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-mono text-slate-400">Hoặc chạm để đếm:</span>
            <button
              onClick={() => triggerSimulatedHand('left')}
              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold active:scale-95 transition-all"
            >
              Tay Trái (6) [A]
            </button>
            <button
              onClick={() => triggerSimulatedHand('right')}
              className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono font-bold active:scale-95 transition-all"
            >
              Tay Phải (7) [D]
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {cameraState === 'error' && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Thông Báo Camera</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-5">{errorMessage}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={startCamera}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-all"
            >
              Thử Lại Camera
            </button>
            <button
              onClick={() => setCameraState('fallback_keys')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors border border-slate-700"
            >
              Chơi Bằng Phím Ảo (A / D)
            </button>
          </div>
        </div>
      )}

      {/* Interactive Fallback Virtual Buttons (Always Playable Even Without Camera) */}
      {cameraState === 'fallback_keys' && (
        <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-between p-6">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Keyboard className="w-4 h-4" />
              <span>Chế độ phím ảo / Cảm ứng (Nhấn phím A và D hoặc Chạm nút)</span>
            </div>
            <button
              onClick={startCamera}
              className="text-xs font-mono text-slate-400 hover:text-white underline transition-colors"
            >
              Thử kết nối lại Camera
            </button>
          </div>

          {/* Big Interactive Tap Buttons for Alternating 6 7 */}
          <div className="w-full max-w-lg grid grid-cols-2 gap-4 my-auto">
            <button
              onClick={() => triggerSimulatedHand('left')}
              className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                nextExpectedHand === 'left' || nextExpectedHand === 'any'
                  ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-xl shadow-emerald-500/20 animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <span className="text-2xl font-black font-mono">TAY TRÁI (6)</span>
              <span className="text-xs font-mono text-slate-400">Phím A hoặc ←</span>
              {(nextExpectedHand === 'left' || nextExpectedHand === 'any') && (
                <span className="text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-bold">
                  BẤM NÚT NÀY (+1)
                </span>
              )}
            </button>

            <button
              onClick={() => triggerSimulatedHand('right')}
              className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                nextExpectedHand === 'right' || nextExpectedHand === 'any'
                  ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-xl shadow-cyan-500/20 animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <span className="text-2xl font-black font-mono">TAY PHẢI (7)</span>
              <span className="text-xs font-mono text-slate-400">Phím D hoặc →</span>
              {(nextExpectedHand === 'right' || nextExpectedHand === 'any') && (
                <span className="text-[10px] bg-cyan-500 text-slate-950 px-2 py-0.5 rounded font-bold">
                  BẤM NÚT NÀY (+1)
                </span>
              )}
            </button>
          </div>

          <div className="text-center text-xs font-mono text-slate-500">
            Mỗi lần bấm xen kẽ Trái ➔ Phải ➔ Trái ➔ Phải sẽ tính +1 lần!
          </div>
        </div>
      )}
    </div>
  );
};
