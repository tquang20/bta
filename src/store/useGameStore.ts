import { create } from 'zustand';

export type FsmState = 0 | 1 | 2; // 0 = NEUTRAL, 1 = LEFT_PEAK, 2 = RIGHT_PEAK
export type SensitivityMode = 'forgiving' | 'standard' | 'strict';
export type HandSide = 'left' | 'right';

export interface GameStoreState {
  // Score & Game Stats
  score: number;
  reps: number;
  invalidReps: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  isOnFire: boolean;
  lastRepTime: number;
  recentRepDeltas: number[];

  // Alternating Rhythm State
  fsmState: FsmState;
  fsmStateName: 'NEUTRAL' | 'LEFT_PEAK' | 'RIGHT_PEAK';
  statusMessage: string;
  lastScoredHand: HandSide | null;
  nextExpectedHand: HandSide | 'any';

  // Real-time telemetry for reach gauges
  leftWristHeight: number; // 0 to 1+
  rightWristHeight: number;
  sensitivity: SensitivityMode;

  // Dynamic T-Pose Calibration
  isCalibrated: boolean;
  isCalibrating: boolean;
  calibrationProgress: number; // 0 to 100
  calibrationCountdown: number; // 3, 2, 1, 0
  dArm: number;
  dTorso: number;

  // Confidence & Anti-Cheat
  confidenceScore: number;
  isConfidenceLow: boolean;
  antiCheatWarning: string | null;
  botCheatFlag: boolean;

  // Match Status
  matchDuration: number; // in seconds (0 = endless practice)
  timeLeft: number;
  isPlaying: boolean;
  isCountdown: boolean;
  countdownValue: number;
  isGameOver: boolean;

  // Solo Best records (durationInSeconds -> maxReps)
  soloBestRecords: Record<number, number>;

  // Visual & Audio Sensory settings
  screenShake: boolean;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  voiceAnnounce: boolean;
  mirrorCamera: boolean;
  overlayMode: 'full' | 'game';

  // Actions
  triggerScreenShake: () => void;
  setConfidenceScore: (score: number) => void;
  setAntiCheatWarning: (warning: string | null) => void;
  setBotCheatFlag: (flag: boolean) => void;
  setFsmState: (state: FsmState, message?: string) => void;
  setTelemetry: (
    leftHeight: number,
    rightHeight: number,
    nextExpectedHand?: HandSide | 'any',
    lastHand?: HandSide
  ) => void;
  setSensitivity: (mode: SensitivityMode) => void;
  recordValidRep: (dt: number, activeHand?: HandSide, nextHand?: HandSide | 'any') => void;
  recordInvalidRep: (reason: string) => void;
  startCalibration: () => void;
  updateCalibrationProgress: (progress: number, countdown: number) => void;
  finishCalibration: (dArm: number, dTorso: number) => void;
  resetCalibration: () => void;
  startCountdown: (count: number) => void;
  setCountdownValue: (count: number) => void;
  startGame: (duration?: number) => void;
  tickTimer: () => void;
  endGame: () => void;
  winByOpponentForfeit: () => void;
  resetGame: () => void;
  toggleMirror: () => void;
  toggleSound: () => void;
  toggleHaptics: () => void;
  toggleVoiceAnnounce: () => void;
  setOverlayMode: (mode: 'full' | 'game') => void;
  setMatchDuration: (duration: number) => void;
}

// Load saved personal records from localStorage
const storedBest = typeof window !== 'undefined' ? localStorage.getItem('vibecode_solo_best') : null;
const initialBest: Record<number, number> = storedBest
  ? JSON.parse(storedBest)
  : { 15: 0, 30: 0, 60: 0, 90: 0 };

export const useGameStore = create<GameStoreState>((set, get) => ({
  score: 0,
  reps: 0,
  invalidReps: 0,
  combo: 0,
  maxCombo: 0,
  multiplier: 1,
  isOnFire: false,
  lastRepTime: 0,
  recentRepDeltas: [],

  fsmState: 0,
  fsmStateName: 'NEUTRAL',
  statusMessage: 'Giơ tay Trái hoặc tay Phải để bắt đầu đếm nhịp 6 7!',
  lastScoredHand: null,
  nextExpectedHand: 'any',

  leftWristHeight: 0,
  rightWristHeight: 0,
  sensitivity: 'standard',

  isCalibrated: false,
  isCalibrating: false,
  calibrationProgress: 0,
  calibrationCountdown: 3,
  dArm: 0.35, // fallback normalized
  dTorso: 0.45,

  confidenceScore: 0.95,
  isConfidenceLow: false,
  antiCheatWarning: null,
  botCheatFlag: false,

  matchDuration: 30,
  timeLeft: 30,
  isPlaying: false,
  isCountdown: false,
  countdownValue: 3,
  isGameOver: false,

  soloBestRecords: initialBest,

  screenShake: false,
  hapticsEnabled: true,
  soundEnabled: true,
  voiceAnnounce: true,
  mirrorCamera: true,
  overlayMode: 'full',

  triggerScreenShake: () => {
    set({ screenShake: true });
    setTimeout(() => {
      set({ screenShake: false });
    }, 280);
  },

  setConfidenceScore: (score: number) => {
    const isLow = score < 0.65;
    set({
      confidenceScore: score,
      isConfidenceLow: isLow,
    });
  },

  setAntiCheatWarning: (warning: string | null) => {
    set({ antiCheatWarning: warning });
  },

  setBotCheatFlag: (flag: boolean) => {
    set({ botCheatFlag: flag });
  },

  setFsmState: (state: FsmState, message?: string) => {
    const names: Record<FsmState, 'NEUTRAL' | 'LEFT_PEAK' | 'RIGHT_PEAK'> = {
      0: 'NEUTRAL',
      1: 'LEFT_PEAK',
      2: 'RIGHT_PEAK',
    };
    set({
      fsmState: state,
      fsmStateName: names[state],
      statusMessage: message || `Trạng thái: ${names[state]}`,
    });
  },

  setTelemetry: (
    leftHeight: number,
    rightHeight: number,
    nextExpectedHand?: HandSide | 'any',
    lastHand?: HandSide
  ) => {
    set({
      leftWristHeight: leftHeight,
      rightWristHeight: rightHeight,
      nextExpectedHand: nextExpectedHand ?? get().nextExpectedHand,
      lastScoredHand: lastHand ?? get().lastScoredHand,
    });
  },

  setSensitivity: (sensitivity: SensitivityMode) => {
    set({ sensitivity });
  },

  recordValidRep: (dt: number, activeHand?: HandSide, nextHand?: HandSide | 'any') => {
    const state = get();
    const newReps = state.reps + 1;
    const newCombo = state.combo + 1;
    const newMaxCombo = Math.max(state.maxCombo, newCombo);

    // Multipliers: 1x (0-2), 1.5x (3-5), 2x (6-9), 3x (10+)
    let multiplier = 1;
    if (newCombo >= 10) multiplier = 3.0;
    else if (newCombo >= 6) multiplier = 2.0;
    else if (newCombo >= 3) multiplier = 1.5;

    // Check if "ON FIRE": 3 reps done with rhythm dt < 650ms
    const recent = [...state.recentRepDeltas.slice(-4), dt];
    const fastReps = recent.filter((d) => d < 650).length;
    const isOnFire = newCombo >= 3 && fastReps >= 3;

    const basePoints = 50; // 50 points per alternating hand
    const speedBonus = dt < 450 ? 25 : dt < 700 ? 10 : 0;
    const addedScore = Math.round((basePoints + speedBonus) * multiplier);

    if (isOnFire || newCombo % 5 === 0) {
      get().triggerScreenShake();
    }

    // Voice announcement if enabled (cancel prior to prevent backlog lag)
    if (state.voiceAnnounce && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`${newReps}`);
        utterance.rate = 1.45;
        utterance.volume = 0.7;
        window.speechSynthesis.speak(utterance);
      } catch (e) {}
    }

    // Check if new personal best for this duration
    const currentBest = state.soloBestRecords[state.matchDuration] || 0;
    let updatedBest = state.soloBestRecords;
    if (newReps > currentBest) {
      updatedBest = { ...state.soloBestRecords, [state.matchDuration]: newReps };
      if (typeof window !== 'undefined') {
        localStorage.setItem('vibecode_solo_best', JSON.stringify(updatedBest));
      }
    }

    const nextHandLabel = nextHand === 'left' ? 'TAY TRÁI (6)' : nextHand === 'right' ? 'TAY PHẢI (7)' : 'Tùy chọn';
    const handName = activeHand === 'left' ? 'Tay Trái (6)' : activeHand === 'right' ? 'Tay Phải (7)' : 'Cử động';

    set({
      score: state.score + addedScore,
      reps: newReps,
      combo: newCombo,
      maxCombo: newMaxCombo,
      multiplier,
      isOnFire,
      lastRepTime: Date.now(),
      recentRepDeltas: recent,
      soloBestRecords: updatedBest,
      lastScoredHand: activeHand ?? state.lastScoredHand,
      nextExpectedHand: nextHand ?? state.nextExpectedHand,
      statusMessage: `+1 lần (${handName})! Tiếp theo: ${nextHandLabel}`,
      antiCheatWarning: null,
    });
  },

  recordInvalidRep: (reason: string) => {
    const state = get();
    set({
      invalidReps: state.invalidReps + 1,
      combo: 0,
      multiplier: 1,
      isOnFire: false,
      statusMessage: `Chú ý: ${reason}`,
    });
  },

  startCalibration: () => {
    set({
      isCalibrating: true,
      calibrationProgress: 0,
      calibrationCountdown: 3,
      antiCheatWarning: null,
      statusMessage: 'Đứng tư thế chữ T (T-Pose), dang 2 tay sang ngang giữ 3 giây...',
    });
  },

  updateCalibrationProgress: (progress: number, countdown: number) => {
    set({
      calibrationProgress: Math.min(100, Math.max(0, progress)),
      calibrationCountdown: countdown,
    });
  },

  finishCalibration: (dArm: number, dTorso: number) => {
    set({
      isCalibrated: true,
      isCalibrating: false,
      calibrationProgress: 100,
      calibrationCountdown: 0,
      dArm,
      dTorso,
      statusMessage: `Đã hiệu chuẩn xong cơ thể! (Sải tay: ${dArm.toFixed(2)})`,
    });
  },

  resetCalibration: () => {
    set({
      isCalibrated: false,
      isCalibrating: false,
      calibrationProgress: 0,
      calibrationCountdown: 3,
    });
  },

  startCountdown: (count: number) => {
    set({
      isCountdown: true,
      countdownValue: count,
      statusMessage: `Bắt đầu sau ${count}...`,
    });
  },

  setCountdownValue: (count: number) => {
    set({ countdownValue: count });
  },

  startGame: (duration?: number) => {
    const finalDuration = duration !== undefined ? duration : get().matchDuration;
    set({
      isPlaying: true,
      isCountdown: false,
      isGameOver: false,
      matchDuration: finalDuration,
      timeLeft: finalDuration,
      score: 0,
      reps: 0,
      invalidReps: 0,
      combo: 0,
      multiplier: 1,
      isOnFire: false,
      recentRepDeltas: [],
      overlayMode: 'game',
      lastScoredHand: null,
      nextExpectedHand: 'any',
      statusMessage: 'BẮT ĐẦU! Giơ tay Trái hoặc Phải, sau đó đổi xen kẽ liên tục!',
    });
  },

  tickTimer: () => {
    const current = get().timeLeft;
    // If endless (duration == 0), don't count down
    if (get().matchDuration === 0) {
      set({ timeLeft: current + 1 });
      return;
    }

    if (current <= 1) {
      get().endGame();
    } else {
      set({ timeLeft: current - 1 });
    }
  },

  endGame: () => {
    set({
      isPlaying: false,
      isGameOver: true,
      timeLeft: 0,
      overlayMode: 'full',
      statusMessage: 'HẾT GIỜ! Hoàn thành lượt chơi.',
    });
  },

  winByOpponentForfeit: () => {
    set({
      isPlaying: false,
      isGameOver: true,
      isCountdown: false,
      timeLeft: 0,
      overlayMode: 'full',
      statusMessage: 'ĐỐI THỦ THOÁT PHÒNG! BẠN CHIẾN THẮNG TUYỆT ĐỐI!',
    });
  },

  resetGame: () => {
    set({
      score: 0,
      reps: 0,
      invalidReps: 0,
      combo: 0,
      multiplier: 1,
      isOnFire: false,
      timeLeft: get().matchDuration,
      isPlaying: false,
      isCountdown: false,
      isGameOver: false,
      lastScoredHand: null,
      nextExpectedHand: 'any',
      statusMessage: 'Sẵn sàng đếm nhịp xen kẽ 6 7',
    });
  },

  toggleMirror: () => {
    set((state) => ({ mirrorCamera: !state.mirrorCamera }));
  },

  toggleSound: () => {
    set((state) => ({ soundEnabled: !state.soundEnabled }));
  },

  toggleHaptics: () => {
    set((state) => ({ hapticsEnabled: !state.hapticsEnabled }));
  },

  toggleVoiceAnnounce: () => {
    set((state) => ({ voiceAnnounce: !state.voiceAnnounce }));
  },

  setOverlayMode: (mode: 'full' | 'game') => {
    set({ overlayMode: mode });
  },

  setMatchDuration: (duration: number) => {
    set({ matchDuration: duration, timeLeft: duration });
  },
}));
