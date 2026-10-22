import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { CameraView } from '../CameraView';
import { useGameStore, SensitivityMode } from '../../store/useGameStore';
import { SoundFX } from '../../lib/audio/SoundFX';
import {
  Timer,
  Flame,
  Zap,
  RotateCcw,
  ArrowLeft,
  Volume2,
  VolumeX,
  Trophy,
  Sliders,
  CheckCircle,
  Play,
  Pause,
  Award,
} from 'lucide-react';

interface SoloChallengeScreenProps {
  onBackToMenu: () => void;
  initialDuration: number;
}

export const SoloChallengeScreen: React.FC<SoloChallengeScreenProps> = ({
  onBackToMenu,
  initialDuration,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number>(initialDuration);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [hasNewRecord, setHasNewRecord] = useState(false);
  const timerRef = useRef<any>(null);

  const score = useGameStore((s) => s.score);
  const reps = useGameStore((s) => s.reps);
  const combo = useGameStore((s) => s.combo);
  const maxCombo = useGameStore((s) => s.maxCombo);
  const multiplier = useGameStore((s) => s.multiplier);
  const isOnFire = useGameStore((s) => s.isOnFire);
  const timeLeft = useGameStore((s) => s.timeLeft);
  const matchDuration = useGameStore((s) => s.matchDuration);
  const fsmState = useGameStore((s) => s.fsmState);
  const nextExpectedHand = useGameStore((s) => s.nextExpectedHand);
  const lastScoredHand = useGameStore((s) => s.lastScoredHand);
  const statusMessage = useGameStore((s) => s.statusMessage);
  const sensitivity = useGameStore((s) => s.sensitivity);
  const setSensitivity = useGameStore((s) => s.setSensitivity);
  const voiceAnnounce = useGameStore((s) => s.voiceAnnounce);
  const toggleVoiceAnnounce = useGameStore((s) => s.toggleVoiceAnnounce);
  const soloBestRecords = useGameStore((s) => s.soloBestRecords);
  const tickTimer = useGameStore((s) => s.tickTimer);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.resetGame);
  const recordValidRep = useGameStore((s) => s.recordValidRep);
  const recordInvalidRep = useGameStore((s) => s.recordInvalidRep);

  const personalBest = soloBestRecords[selectedDuration] || 0;

  // Initialize or restart session
  const startSession = (duration: number) => {
    setSelectedDuration(duration);
    resetGame();
    setIsPaused(false);
    setSessionFinished(false);
    setHasNewRecord(false);
    startGame(duration);
  };

  useEffect(() => {
    startSession(initialDuration);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer loop
  useEffect(() => {
    if (!isPaused && !sessionFinished) {
      timerRef.current = setInterval(() => {
        const currTime = useGameStore.getState().timeLeft;
        const dur = useGameStore.getState().matchDuration;

        if (dur > 0 && currTime <= 1) {
          // Time expired!
          setSessionFinished(true);
          const finalReps = useGameStore.getState().reps;
          const best = useGameStore.getState().soloBestRecords[dur] || 0;
          if (finalReps > best) {
            setHasNewRecord(true);
            try {
              confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
            } catch (e) {}
          }
          SoundFX.playVictoryFanfare();
        } else {
          tickTimer();
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, sessionFinished]);

  const handleValidRep = (dt: number, activeHand?: 'left' | 'right', nextHand?: 'left' | 'right' | 'any') => {
    if (isPaused || sessionFinished) return;
    recordValidRep(dt, activeHand, nextHand);
    const curr = useGameStore.getState();
    SoundFX.playRepSound(curr.combo, curr.isOnFire, activeHand);

    // Check if new record achieved during match
    if (selectedDuration > 0 && curr.reps > personalBest && !hasNewRecord) {
      setHasNewRecord(true);
    }
  };

  const handleInvalidRep = (reason: string) => {
    if (isPaused || sessionFinished) return;
    recordInvalidRep(reason);
    SoundFX.playFailSound();
  };

  // Format time mm:ss
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  // Calculate Cadence (reps/minute)
  const elapsedSeconds = selectedDuration > 0 ? selectedDuration - timeLeft : timeLeft;
  const repsPerMin = elapsedSeconds > 2 ? Math.round((reps / elapsedSeconds) * 60) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">
      {/* Top Header & Duration Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/85 border border-slate-800 rounded-2xl p-3.5 backdrop-blur-md">
        <button
          onClick={onBackToMenu}
          className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về Trang Chủ</span>
        </button>

        {/* Duration Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <span className="text-xs font-mono text-slate-500 px-2 flex items-center gap-1">
            <Timer className="w-3.5 h-3.5 text-cyan-400" /> Thời gian:
          </span>
          {[15, 30, 60, 90, 0].map((dur) => (
            <button
              key={dur}
              onClick={() => startSession(dur)}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                selectedDuration === dur
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {dur === 0 ? 'Vô tận (Endless)' : `${dur}s`}
            </button>
          ))}
        </div>

        {/* Quick controls: Pause, Voice Announce, Restart */}
        <div className="flex items-center gap-2">
          {selectedDuration > 0 && (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs font-mono flex items-center gap-1.5"
              title={isPaused ? 'Tiếp tục' : 'Tạm dừng'}
            >
              {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4" />}
              <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
            </button>
          )}

          <button
            onClick={toggleVoiceAnnounce}
            className={`p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-mono ${
              voiceAnnounce
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Đọc số lần thành tiếng (Speech Synthesis)"
          >
            {voiceAnnounce ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">Giọng đọc số</span>
          </button>

          <button
            onClick={() => startSession(selectedDuration)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Bắt đầu lại"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Rep Counter Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Giant Rep Counter */}
        <div
          className={`col-span-2 p-4 rounded-2xl border backdrop-blur-md flex items-center justify-between transition-all ${
            isOnFire
              ? 'bg-gradient-to-r from-amber-950/60 via-red-950/40 to-slate-950/80 border-amber-500/70 box-fire-glow'
              : 'bg-slate-900/85 border-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400">
                SỐ LẦN 6 7 HOÀN THÀNH
              </span>
              {isOnFire && (
                <span className="text-[11px] font-mono text-amber-400 font-bold flex items-center gap-1 animate-pulse">
                  <Flame className="w-3.5 h-3.5 fill-amber-400" /> CHÁY QUÁ!
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              <div
                className={`text-5xl md:text-6xl font-black font-mono tabular-nums tracking-tight ${
                  isOnFire ? 'text-amber-300 text-fire-glow' : 'text-cyan-400'
                }`}
              >
                {reps}
              </div>
              <span className="text-xs font-mono text-slate-400">LẦN</span>
            </div>

            {hasNewRecord && (
              <div className="text-[11px] font-mono font-bold text-amber-400 flex items-center gap-1 mt-1 animate-bounce">
                <Trophy className="w-3.5 h-3.5" /> PHÁ KỶ LỤC CÁ NHÂN!
              </div>
            )}
          </div>

          {/* Rhythm Streak */}
          <div className="text-right">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Chuỗi nhịp (Streak)</span>
            <div className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums">
              {combo}
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Hệ số: <strong className="text-white">{multiplier}x</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Timer */}
        <div className="p-4 rounded-2xl bg-slate-900/85 border border-slate-800 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{selectedDuration === 0 ? 'Thời gian tập' : 'Thời gian còn lại'}</span>
            <Timer className="w-4 h-4 text-cyan-400" />
          </div>
          <div
            className={`text-3xl font-extrabold font-mono tabular-nums tracking-tight mt-1 ${
              selectedDuration > 0 && timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-white'
            }`}
          >
            {timeFormatted}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {selectedDuration === 0 ? 'Chế độ không giới hạn' : `Tổng thời gian: ${selectedDuration}s`}
          </div>
        </div>

        {/* Card 3: Speed (Cadence) & Record */}
        <div className="p-4 rounded-2xl bg-slate-900/85 border border-slate-800 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Tốc độ nhịp</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-300 tabular-nums tracking-tight mt-1">
            {repsPerMin} <span className="text-xs text-slate-500 font-normal">reps/phút</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Kỷ lục ({selectedDuration}s):</span>
            <strong className="text-cyan-400 tabular-nums">{personalBest} lần</strong>
          </div>
        </div>
      </div>

      {/* Rhythm Sequence Guide Bar */}
      <div className="w-full bg-slate-900/85 border border-slate-800 rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold uppercase">QUY TẮC 6 7:</span>
          <span className="text-slate-300">Mỗi lần giơ tay Trái hoặc Phải = <strong className="text-white">+1 lần</strong> (Phải xen kẽ liên tục)</span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              nextExpectedHand === 'left' || nextExpectedHand === 'any'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 animate-pulse'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {nextExpectedHand === 'left' ? '👉 CẦN GIƠ TAY TRÁI (6)' : 'Tay Trái (6)'}
          </div>
          <span className="text-slate-500 font-bold text-sm">⇄</span>
          <div
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              nextExpectedHand === 'right' || nextExpectedHand === 'any'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 animate-pulse'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {nextExpectedHand === 'right' ? '👉 CẦN GIƠ TAY PHẢI (7)' : 'Tay Phải (7)'}
          </div>
        </div>
      </div>

      {/* Interactive Camera Viewport */}
      <div className="relative aspect-[16/9] w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
        <CameraView
          mode="game"
          onValidRep={handleValidRep}
          onInvalidRep={handleInvalidRep}
          className="w-full h-full"
          showMeters={true}
        />

        {/* Big On-screen Rep Flash Effect */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center">
          <div className="text-6xl font-black font-mono text-white/90 drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] tabular-nums">
            {reps}
          </div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400 bg-slate-950/80 px-3 py-0.5 rounded-full border border-slate-800">
            Số lần 6 7
          </span>
        </div>
      </div>

      {/* Session Finished Summary Modal */}
      {sessionFinished && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center mb-3 shadow-lg shadow-cyan-500/20">
                <Trophy className="w-8 h-8" />
              </div>

              <h2 className="text-2xl font-black text-white font-display uppercase tracking-tight">
                Hoàn Thành Thử Thách Solo!
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-1">
                Thời gian: {selectedDuration} giây
              </p>
            </div>

            {/* Score & Records */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase text-slate-400">Tổng Số Lần 6 7</span>
                <div className="text-4xl font-black font-mono text-cyan-400 tabular-nums">
                  {reps} <span className="text-xs text-slate-500 font-normal">lần</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono uppercase text-slate-400">Tốc độ bình quân</span>
                <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                  {repsPerMin} <span className="text-xs text-slate-500 font-normal">reps/p</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {hasNewRecord ? '🏆 Đã lập kỷ lục mới!' : `Kỷ lục cũ: ${personalBest} lần`}
                </span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-slate-400">Chuỗi cao nhất</span>
                <div className="text-lg font-bold text-emerald-400 tabular-nums mt-0.5">{maxCombo} reps</div>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-slate-400">Tổng điểm tích lũy</span>
                <div className="text-lg font-bold text-white tabular-nums mt-0.5">{score} pts</div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => startSession(selectedDuration)}
                className="flex-1 py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Thử Lại Ngay</span>
              </button>

              <button
                onClick={onBackToMenu}
                className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl transition-colors border border-slate-700"
              >
                Trang Chủ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
