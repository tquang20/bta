import React, { useEffect, useRef } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { Radio, User, ShieldAlert, Sparkles, Check, Flame } from 'lucide-react';

interface OpponentVideoViewProps {
  className?: string;
  zoomAndBlur?: boolean;
  showOverlay?: boolean;
}

export const OpponentVideoView: React.FC<OpponentVideoViewProps> = ({
  className = '',
  zoomAndBlur = false,
  showOverlay = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const opponent = useRoomStore((s) => s.opponent);
  const remoteStream = useRoomStore((s) => s.remoteStream);
  const remoteFallbackFrame = useRoomStore((s) => s.remoteFallbackFrame);
  const netcodeMode = useRoomStore((s) => s.netcodeMode);
  const latencyMs = useRoomStore((s) => s.latencyMs);

  // Hook remoteStream to video element
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      if (videoRef.current.srcObject !== remoteStream) {
        videoRef.current.srcObject = remoteStream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const hasVideoStream = Boolean(
    remoteStream && remoteStream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)
  );

  return (
    <div
      className={`relative w-full h-full bg-slate-950 overflow-hidden select-none ${className}`}
    >
      {/* Video Stream Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-all duration-700 ease-out ${
          zoomAndBlur ? 'scale-115 filter blur-md' : 'scale-100 filter blur-0'
        } ${hasVideoStream ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}
      />

      {/* Live Snapshot Camera Relay (Fallback when WebRTC P2P is connecting or firewalled) */}
      {!hasVideoStream && remoteFallbackFrame && (
        <img
          src={remoteFallbackFrame}
          alt="Luồng Camera Đối Thủ"
          className={`w-full h-full object-cover transition-all duration-700 ease-out ${
            zoomAndBlur ? 'scale-115 filter blur-md' : 'scale-100 filter blur-0'
          }`}
        />
      )}

      {/* Fallback Viewport if neither WebRTC nor snapshot is active */}
      {!hasVideoStream && !remoteFallbackFrame && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center transition-all duration-700 ease-out ${
            zoomAndBlur ? 'scale-115 filter blur-md' : 'scale-100 filter blur-0'
          }`}
        >
          {/* High-tech animated radar scanner backdrop */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-950/20 via-slate-950 to-slate-950" />
          <div className="absolute inset-0 bg-cyber-grid bg-[length:24px_24px] opacity-20 pointer-events-none" />

          {opponent ? (
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-purple-500/20">
                  <User className="w-10 h-10" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
                  <span>{opponent.username}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    P2 (ONLINE)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-1 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  Đang đồng bộ luồng video WebRTC...
                </p>
              </div>

              {/* Opponent Live Status Bar */}
              <div className="mt-2 flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono">
                <span className="text-slate-400">Trạng thái:</span>
                <span className={opponent.isReady ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {opponent.isReady ? 'ĐÃ SẴN SÀNG' : 'CHƯA SẴN SÀNG'}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Độ trễ: {latencyMs}ms</span>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <User className="w-8 h-8 opacity-40 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-300">Đang chờ đối thủ vào phòng</h4>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Chia sẻ mã phòng 4 ký tự để đối thủ kết nối và bật camera đối kháng
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Active Floating Overlay (Name + Ping + Live Hand Indicator) */}
      {showOverlay && opponent && (
        <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between z-10">
          {/* Top Bar: Opponent Identity & Connection badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-slate-950/75 backdrop-blur-md border border-slate-800/80 rounded-xl px-2.5 py-1 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-white font-bold">{opponent.username}</span>
              <span className="text-slate-500 text-[10px]">P2</span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold backdrop-blur-md border ${
                  opponent.isReady
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {opponent.isReady ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>SẴN SÀNG</span>
                  </>
                ) : (
                  <span>CHỜ SẴN SÀNG</span>
                )}
              </div>

              <div className="bg-slate-950/75 backdrop-blur-md border border-slate-800/80 rounded-xl px-2 py-1 text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <Radio className="w-3 h-3 text-purple-400" />
                <span>{latencyMs}ms</span>
              </div>
            </div>
          </div>

          {/* Bottom Feedback: Real-time hand action (6 vs 7) */}
          <div className="flex items-center justify-between">
            {opponent.activeHand ? (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-black backdrop-blur-md border shadow-lg animate-bounce ${
                  opponent.activeHand === 'left'
                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400/50'
                    : 'bg-pink-500/30 text-pink-300 border-pink-400/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {opponent.activeHand === 'left' ? 'VỪA GIƠ TAY TRÁI (6)' : 'VỪA GIƠ TAY PHẢI (7)'}
                </span>
              </div>
            ) : (
              <div />
            )}

            {/* Opponent Score HUD in mini badge */}
            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1 flex items-baseline gap-2 font-mono">
              <span className="text-[10px] text-slate-400">ĐIỂM:</span>
              <span className="text-base font-extrabold text-purple-400 tabular-nums">
                {opponent.score}
              </span>
              {opponent.combo > 1 && (
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-0.5">
                  <Flame className="w-3 h-3" />
                  {opponent.combo}x
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
