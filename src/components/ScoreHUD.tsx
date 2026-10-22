import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { useRoomStore } from '../store/useRoomStore';
import { Flame, Zap, ShieldAlert, Timer, Radio, Trophy } from 'lucide-react';

interface ScoreHUDProps {
  isMultiplayer: boolean;
}

export const ScoreHUD: React.FC<ScoreHUDProps> = ({ isMultiplayer }) => {
  const score = useGameStore((s) => s.score);
  const reps = useGameStore((s) => s.reps);
  const combo = useGameStore((s) => s.combo);
  const maxCombo = useGameStore((s) => s.maxCombo);
  const multiplier = useGameStore((s) => s.multiplier);
  const isOnFire = useGameStore((s) => s.isOnFire);
  const timeLeft = useGameStore((s) => s.timeLeft);
  const matchDuration = useGameStore((s) => s.matchDuration);
  const nextExpectedHand = useGameStore((s) => s.nextExpectedHand);
  const lastScoredHand = useGameStore((s) => s.lastScoredHand);
  const statusMessage = useGameStore((s) => s.statusMessage);
  const antiCheatWarning = useGameStore((s) => s.antiCheatWarning);
  const botCheatFlag = useGameStore((s) => s.botCheatFlag);
  const confidenceScore = useGameStore((s) => s.confidenceScore);
  const isConfidenceLow = useGameStore((s) => s.isConfidenceLow);

  const opponent = useRoomStore((s) => s.opponent);
  const netcodeMode = useRoomStore((s) => s.netcodeMode);
  const latencyMs = useRoomStore((s) => s.latencyMs);

  const opponentScore = opponent?.score ?? 0;
  const scoreDifference = score - opponentScore;

  // Format time mm:ss
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const isLowTime = timeLeft <= 5 && timeLeft > 0;

  return (
    <div className="w-full flex flex-col gap-3 select-none pointer-events-none">
      {/* Top Bar: Latency & Anti-cheat status */}
      <div className="flex items-center justify-between pointer-events-auto">
        {/* Netcode Status */}
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
          <Radio
            className={`w-3.5 h-3.5 ${
              netcodeMode === 'webrtc'
                ? 'text-emerald-400 animate-pulse'
                : isMultiplayer
                ? 'text-cyan-400'
                : 'text-slate-400'
            }`}
          />
          <span className="text-slate-300 font-medium">
            {netcodeMode === 'webrtc' ? 'WebRTC P2P (5ms)' : isMultiplayer ? 'WebSocket Sync' : 'Solo Local Engine'}
          </span>
          {isMultiplayer && (
            <span className="text-slate-500 text-[11px] tabular-nums">
              · {latencyMs}ms
            </span>
          )}
        </div>

        {/* Timer */}
        <div
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-mono font-bold text-sm tracking-wider transition-all backdrop-blur-md ${
            isLowTime
              ? 'bg-rose-500/20 border border-rose-500 text-rose-300 animate-bounce'
              : 'bg-slate-900/80 border border-slate-800 text-white'
          }`}
        >
          <Timer className="w-4 h-4 text-cyan-400" />
          <span className="tabular-nums">{timeFormatted}</span>
        </div>
      </div>

      {/* Main Score & Multiplier HUD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        {/* Player 1 (Local) Card */}
        <div
          className={`relative p-4 rounded-xl border backdrop-blur-md transition-all ${
            isOnFire
              ? 'bg-gradient-to-br from-amber-950/40 via-red-950/30 to-slate-950/80 border-amber-500/60 box-fire-glow'
              : 'bg-slate-900/85 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">You (P1)</span>
            {isOnFire && (
              <div className="flex items-center gap-1 text-amber-400 text-xs font-bold font-mono animate-pulse">
                <Flame className="w-4 h-4 fill-amber-400" />
                <span>ON FIRE!</span>
              </div>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <div className={`text-4xl font-extrabold font-mono tabular-nums tracking-tight ${isOnFire ? 'text-amber-300 text-fire-glow' : 'text-cyan-400'}`}>
              {score}
            </div>

            {/* Multiplier Badge */}
            <div
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1 ${
                multiplier >= 3
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : multiplier >= 2
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : multiplier > 1
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>{multiplier}x</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs font-mono text-slate-400">
            <span>Reps: <strong className="text-slate-200 tabular-nums">{reps}</strong></span>
            <span>·</span>
            <span>Streak: <strong className="text-slate-200 tabular-nums">{combo}</strong></span>
            <span>·</span>
            <span>Best: <strong className="text-slate-200 tabular-nums">{maxCombo}</strong></span>
          </div>
        </div>

        {/* Center: Alternating 6 7 Rhythm Guide */}
        <div className="bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-mono uppercase text-slate-400 font-bold mb-1.5">
            Nhịp Xen Kẽ (Mỗi Lần Giơ = +1)
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                nextExpectedHand === 'left' || nextExpectedHand === 'any'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 animate-pulse'
                  : 'bg-slate-800/80 text-slate-400'
              }`}
            >
              {nextExpectedHand === 'left' ? '👉 TAY TRÁI (6)' : 'Tay Trái (6)'}
            </span>
            <span className="text-slate-500 font-mono text-sm">⇄</span>
            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                nextExpectedHand === 'right' || nextExpectedHand === 'any'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 animate-pulse'
                  : 'bg-slate-800/80 text-slate-400'
              }`}
            >
              {nextExpectedHand === 'right' ? '👉 TAY PHẢI (7)' : 'Tay Phải (7)'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 mt-1 truncate max-w-xs">
            {statusMessage}
          </span>
        </div>

        {/* Multiplayer: Opponent HUD (if in room) */}
        {isMultiplayer ? (
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/85 backdrop-blur-md">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold truncate max-w-[140px]">
                {opponent?.username || 'Opponent (P2)'}
              </span>
              {scoreDifference !== 0 && (
                <span
                  className={`text-xs font-mono font-bold ${
                    scoreDifference > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {scoreDifference > 0 ? `+${scoreDifference} LEAD` : `${scoreDifference} TRAIL`}
                </span>
              )}
            </div>

            <div className="flex items-baseline justify-between">
              <div className="text-4xl font-extrabold font-mono tabular-nums tracking-tight text-slate-200">
                {opponentScore}
              </div>
              <div className="text-xs font-mono text-slate-400">
                Streak: <strong className="text-slate-200 tabular-nums">{opponent?.combo ?? 0}</strong>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2 text-xs font-mono text-slate-400">
              <span>Reps: <strong className="text-slate-200 tabular-nums">{opponent?.reps ?? 0}</strong></span>
              <span>·</span>
              <span>Status: <strong className="text-emerald-400">Live</strong></span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/85 backdrop-blur-md flex flex-col justify-center">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Match Progress</span>
              <span className="font-mono tabular-nums">{Math.round(((matchDuration - timeLeft) / matchDuration) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-300"
                style={{ width: `${((matchDuration - timeLeft) / matchDuration) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Head-to-Head Tug of War Bar (When Multiplayer) */}
      {isMultiplayer && (
        <div className="w-full bg-slate-900/80 backdrop-blur-md p-2 rounded-xl border border-slate-800 flex flex-col gap-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-400 px-1">
            <span className="text-cyan-400 font-bold">YOU ({score})</span>
            <span className="text-slate-500 font-semibold">TUG OF WAR</span>
            <span className="text-purple-400 font-bold">{opponent?.username || 'OPPONENT'} ({opponentScore})</span>
          </div>
          <div className="w-full h-2 bg-purple-500/30 rounded-full overflow-hidden flex">
            <div
              className="bg-cyan-500 h-full transition-all duration-300"
              style={{
                width: `${
                  score + opponentScore === 0
                    ? 50
                    : Math.max(5, Math.min(95, (score / (score + opponentScore)) * 100))
                }%`,
              }}
            />
            <div className="bg-purple-500 h-full flex-1" />
          </div>
        </div>
      )}

      {/* Anti-Cheat & Lighting Warnings Banner */}
      {(antiCheatWarning || isConfidenceLow || botCheatFlag) && (
        <div className="w-full bg-amber-500/15 border border-amber-500/40 text-amber-200 px-4 py-2 rounded-xl backdrop-blur-md flex items-center gap-2.5 text-xs font-medium animate-pulse">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {antiCheatWarning ||
              (isConfidenceLow ? 'Lighting is poor or camera is distant. Algorithm may be inaccurate.' : 'Anti-cheat warning')}
          </span>
        </div>
      )}
    </div>
  );
};
