import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useGameStore } from '../../store/useGameStore';
import { useRoomStore } from '../../store/useRoomStore';
import { SoundFX } from '../../lib/audio/SoundFX';
import { Trophy, Flame, RotateCcw, Home, Award, Zap, TrendingUp, TrendingDown } from 'lucide-react';

interface GameOverModalProps {
  onRematch: () => void;
  onHome: () => void;
  isMultiplayer: boolean;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ onRematch, onHome, isMultiplayer }) => {
  const score = useGameStore((s) => s.score);
  const reps = useGameStore((s) => s.reps);
  const invalidReps = useGameStore((s) => s.invalidReps);
  const maxCombo = useGameStore((s) => s.maxCombo);
  const matchDuration = useGameStore((s) => s.matchDuration);

  const opponent = useRoomStore((s) => s.opponent);
  const eloRating = useRoomStore((s) => s.eloRating);
  const forfeitWinMessage = useRoomStore((s) => s.forfeitWinMessage);
  const recordMatchResult = useRoomStore((s) => s.recordMatchResult);

  const isForfeitWin = Boolean(forfeitWinMessage);
  const oppScore = opponent?.score ?? 0;
  const isWinner = isMultiplayer ? (isForfeitWin || score > oppScore) : true;
  const isTie = isMultiplayer ? (!isForfeitWin && score === oppScore) : false;

  // Calculate ELO change
  const eloDelta = isMultiplayer ? (isWinner ? 24 : isTie ? 0 : -16) : 10;

  useEffect(() => {
    SoundFX.playVictoryFanfare();

    // Trigger confetti if winner
    if (isWinner) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#06b6d4', '#10b981', '#f59e0b', '#ec4899'],
        });
      } catch (e) {}
    }

    // Record match in store history
    recordMatchResult({
      duration: matchDuration,
      myScore: score,
      opponentScore: oppScore,
      opponentName: isMultiplayer ? opponent?.username || 'Opponent' : 'Solo Target',
      winner: isMultiplayer ? (isWinner ? 'player' : isTie ? 'tie' : 'opponent') : 'player',
      eloDelta,
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Outcome Header */}
        <div className="text-center flex flex-col items-center">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-lg ${
              isWinner
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-amber-500/20'
                : isTie
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}
          >
            <Trophy className="w-8 h-8" />
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-white font-display uppercase tracking-tight">
            {isForfeitWin
              ? 'Chiến Thắng Tuyệt Đối!'
              : isMultiplayer
              ? isWinner
                ? 'Victory!'
                : isTie
                ? 'Even Match (Tie)!'
                : 'Defeat!'
              : 'Match Completed!'}
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            {isForfeitWin
              ? (forfeitWinMessage || 'Đối thủ đã thoát phòng! Bạn nhận trọn vẹn chiến thắng.')
              : isMultiplayer
              ? `Ranked 1v1 Motion Duel (${matchDuration}s)`
              : `Solo Session (${matchDuration}s)`}
          </p>
        </div>

        {/* ELO & Score Banner */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono uppercase text-slate-400">Final Score</span>
            <div className="text-3xl font-black font-mono text-cyan-400 tabular-nums">
              {score} {isMultiplayer && <span className="text-sm text-slate-500 font-normal">vs {oppScore}</span>}
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono uppercase text-slate-400">Rating Adjustment</span>
            <div
              className={`text-xl font-bold font-mono flex items-center justify-end gap-1 ${
                eloDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {eloDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{eloDelta >= 0 ? `+${eloDelta}` : eloDelta} ELO</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">New Rating: {eloRating + eloDelta}</span>
          </div>
        </div>

        {/* Performance Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <span className="text-slate-400">Total Valid Reps</span>
            <div className="text-lg font-bold text-white tabular-nums mt-0.5">{reps}</div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <span className="text-slate-400">Invalid / Skipped</span>
            <div className="text-lg font-bold text-rose-400 tabular-nums mt-0.5">{invalidReps}</div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <span className="text-slate-400">Max Rhythm Streak</span>
            <div className="text-lg font-bold text-amber-400 tabular-nums mt-0.5">{maxCombo} reps</div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <span className="text-slate-400">Rhythm Cadence</span>
            <div className="text-lg font-bold text-cyan-400 tabular-nums mt-0.5">
              {reps > 0 ? `${(matchDuration / reps).toFixed(2)}s/rep` : '--'}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onRematch}
            className="flex-1 py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rematch</span>
          </button>

          <button
            onClick={onHome}
            className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl transition-colors border border-slate-700 flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
