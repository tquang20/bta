import React, { useEffect, useRef } from 'react';
import { CameraView } from '../CameraView';
import { OpponentVideoView } from '../OpponentVideoView';
import { ScoreHUD } from '../ScoreHUD';
import { GameOverModal } from './GameOverModal';
import { useGameStore } from '../../store/useGameStore';
import { useRoomStore } from '../../store/useRoomStore';
import { RoomClient } from '../../lib/network/RoomClient';
import { SoundFX } from '../../lib/audio/SoundFX';
import { Swords, Flame } from 'lucide-react';

interface GameScreenProps {
  onBackToMenu: () => void;
  onRematchToLobby: () => void;
  isMultiplayer: boolean;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  onBackToMenu,
  onRematchToLobby,
  isMultiplayer,
}) => {
  const timerRef = useRef<any>(null);

  const score = useGameStore((s) => s.score);
  const combo = useGameStore((s) => s.combo);
  const reps = useGameStore((s) => s.reps);
  const invalidReps = useGameStore((s) => s.invalidReps);
  const isOnFire = useGameStore((s) => s.isOnFire);
  const screenShake = useGameStore((s) => s.screenShake);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const isCountdown = useGameStore((s) => s.isCountdown);
  const countdownValue = useGameStore((s) => s.countdownValue);
  const tickTimer = useGameStore((s) => s.tickTimer);
  const recordValidRep = useGameStore((s) => s.recordValidRep);
  const recordInvalidRep = useGameStore((s) => s.recordInvalidRep);
  const resetGame = useGameStore((s) => s.resetGame);

  const opponent = useRoomStore((s) => s.opponent);
  const roomClient = RoomClient.getInstance();

  // Timer loop for match duration
  useEffect(() => {
    if (isPlaying && !isGameOver) {
      timerRef.current = setInterval(() => {
        tickTimer();
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isGameOver, tickTimer]);

  // Handle countdown audio ticks
  useEffect(() => {
    if (isCountdown && countdownValue > 0) {
      SoundFX.playCountdownTick(countdownValue === 1);
    }
  }, [isCountdown, countdownValue]);

  // Handle Valid Rep with zero latency sound, haptics, score calculation, and P2P packet transmission
  const handleValidRep = (dt: number, activeHand?: 'left' | 'right', nextHand?: 'left' | 'right' | 'any') => {
    if (!isPlaying || isGameOver) return;

    recordValidRep(dt, activeHand, nextHand);

    const nextScore = useGameStore.getState().score;
    const nextCombo = useGameStore.getState().combo;
    const nextReps = useGameStore.getState().reps;
    const nextInvalids = useGameStore.getState().invalidReps;
    const nextOnFire = useGameStore.getState().isOnFire;

    SoundFX.playRepSound(nextCombo, nextOnFire, activeHand);

    if (isMultiplayer) {
      roomClient.sendScoreUpdate(nextScore, nextCombo, nextReps, nextInvalids, activeHand);
    }
  };

  const handleInvalidRep = (reason: string) => {
    if (!isPlaying || isGameOver) return;

    recordInvalidRep(reason);
    SoundFX.playFailSound();

    if (isMultiplayer) {
      const curr = useGameStore.getState();
      roomClient.sendScoreUpdate(curr.score, curr.combo, curr.reps, curr.invalidReps);
    }
  };

  const handleRematch = () => {
    resetGame();
    if (isMultiplayer) {
      roomClient.requestRematch();
    }
    onRematchToLobby();
  };

  const handleHome = () => {
    resetGame();
    onBackToMenu();
  };

  const opponentScore = opponent?.score ?? 0;
  const leadDiff = score - opponentScore;

  return (
    <div
      className={`w-full max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3 min-h-screen justify-center ${
        screenShake ? 'animate-screen-shake' : ''
      }`}
    >
      {/* Top HUD */}
      <ScoreHUD isMultiplayer={isMultiplayer} />

      {/* Main Video Arena Viewport */}
      {isMultiplayer ? (
        /* DUAL ARENA: BẠN (Left) vs ĐỐI THỦ (Right) */
        <div className="relative w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Viewport 1: Local Player Camera (6/7 Detection Active) */}
            <div className="relative aspect-[4/3] md:aspect-[16/10] w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
              <CameraView
                mode="game"
                onValidRep={handleValidRep}
                onInvalidRep={handleInvalidRep}
                zoomAndBlur={isCountdown}
                className="w-full h-full"
              />

              {/* ON FIRE Edge Glow Filter */}
              {isOnFire && (
                <div className="absolute inset-0 pointer-events-none border-4 border-amber-500/80 box-fire-glow z-20 animate-pulse rounded-3xl" />
              )}
            </div>

            {/* Viewport 2: Remote Opponent WebRTC Camera Stream */}
            <div className="relative aspect-[4/3] md:aspect-[16/10] w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
              <OpponentVideoView
                zoomAndBlur={isCountdown}
                showOverlay={true}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Central Tug-of-War / VS Indicator */}
          <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
            <div className="flex flex-col items-center gap-1 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-800 shadow-2xl">
              <span className="text-[10px] font-mono font-bold text-slate-400">VS</span>
              {leadDiff !== 0 && (
                <span
                  className={`text-[11px] font-mono font-extrabold ${
                    leadDiff > 0 ? 'text-cyan-400' : 'text-purple-400'
                  }`}
                >
                  {leadDiff > 0 ? `+${leadDiff}` : leadDiff}
                </span>
              )}
            </div>
          </div>

          {/* 3-2-1 Countdown Overlay during Kickoff */}
          {isCountdown && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md z-40 rounded-3xl flex flex-col items-center justify-center animate-screen-shake">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Swords className="w-4 h-4 text-amber-400" /> TRẬN ĐẤU SẮP BẮT ĐẦU
              </span>
              <span
                key={countdownValue}
                className="text-8xl md:text-9xl font-black font-display text-white drop-shadow-2xl animate-in zoom-in-50 duration-200 transition-all select-none"
              >
                {countdownValue === 0 ? 'CHIẾN!' : countdownValue}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* SOLO ARENA */
        <div className="relative aspect-[16/9] md:aspect-[21/9] lg:aspect-[16/9] w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
          <CameraView
            mode="game"
            onValidRep={handleValidRep}
            onInvalidRep={handleInvalidRep}
            zoomAndBlur={isCountdown}
            className="w-full h-full"
          />

          {/* 3-2-1 Countdown Overlay */}
          {isCountdown && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-40 flex flex-col items-center justify-center">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-2">
                Bắt đầu trong
              </span>
              <span
                key={countdownValue}
                className="text-8xl md:text-9xl font-black font-display text-white drop-shadow-2xl animate-in zoom-in-50 duration-200 transition-all select-none"
              >
                {countdownValue === 0 ? 'CHIẾN!' : countdownValue}
              </span>
            </div>
          )}

          {/* ON FIRE Edge Glow Filter */}
          {isOnFire && (
            <div className="absolute inset-0 pointer-events-none border-4 border-amber-500/80 box-fire-glow z-20 animate-pulse rounded-3xl" />
          )}
        </div>
      )}

      {/* Post Match Modal */}
      {isGameOver && (
        <GameOverModal
          onRematch={handleRematch}
          onHome={handleHome}
          isMultiplayer={isMultiplayer}
        />
      )}
    </div>
  );
};
