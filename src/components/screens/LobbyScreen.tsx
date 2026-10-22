import React, { useEffect, useState } from 'react';
import { CameraView } from '../CameraView';
import { OpponentVideoView } from '../OpponentVideoView';
import { useRoomStore } from '../../store/useRoomStore';
import { useGameStore } from '../../store/useGameStore';
import { RoomClient } from '../../lib/network/RoomClient';
import { SoundFX } from '../../lib/audio/SoundFX';
import {
  Copy,
  Check,
  ArrowLeft,
  Play,
  UserCheck,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Swords,
  Radio,
  User,
  Share2,
  Crown,
  ExternalLink,
} from 'lucide-react';

interface LobbyScreenProps {
  onBackToMenu: () => void;
  onMatchStart: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ onBackToMenu, onMatchStart }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [calibrationFeedback, setCalibrationFeedback] = useState<string>('Đứng hoặc ngồi trước camera để hiệu chuẩn');

  const roomCode = useRoomStore((s) => s.roomCode);
  const roomName = useRoomStore((s) => s.roomName);
  const isHost = useRoomStore((s) => s.isHost);
  const hostTransferMessage = useRoomStore((s) => s.hostTransferMessage);
  const setHostTransferMessage = useRoomStore((s) => s.setHostTransferMessage);
  const opponent = useRoomStore((s) => s.opponent);
  const username = useRoomStore((s) => s.username);
  const isLocalReady = useRoomStore((s) => s.isLocalReady);
  const netcodeMode = useRoomStore((s) => s.netcodeMode);
  const latencyMs = useRoomStore((s) => s.latencyMs);

  const isCalibrated = useGameStore((s) => s.isCalibrated);
  const isCalibrating = useGameStore((s) => s.isCalibrating);
  const calibrationProgress = useGameStore((s) => s.calibrationProgress);
  const calibrationCountdown = useGameStore((s) => s.calibrationCountdown);
  const dArm = useGameStore((s) => s.dArm);
  const dTorso = useGameStore((s) => s.dTorso);
  const startCalibration = useGameStore((s) => s.startCalibration);
  const updateCalibrationProgress = useGameStore((s) => s.updateCalibrationProgress);
  const finishCalibration = useGameStore((s) => s.finishCalibration);
  const matchDuration = useGameStore((s) => s.matchDuration);
  const isPlaying = useGameStore((s) => s.isPlaying);
  const isCountdown = useGameStore((s) => s.isCountdown);
  const countdownValue = useGameStore((s) => s.countdownValue);

  const roomClient = RoomClient.getInstance();

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyInviteLink = () => {
    if (roomCode) {
      const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleLeaveRoom = () => {
    roomClient.leaveRoom();
    onBackToMenu();
  };

  const handleCalibrationProgress = (
    progress: number,
    countdown: number,
    finished: boolean,
    arm: number,
    torso: number,
    feedback: string
  ) => {
    setCalibrationFeedback(feedback);
    updateCalibrationProgress(progress, countdown);

    if (finished && !isCalibrated) {
      finishCalibration(arm, torso);
      SoundFX.playCalibrationComplete();
      roomClient.notifyCalibrated(arm, torso);
    }
  };

  const handleToggleReady = () => {
    const nextState = !isLocalReady;
    roomClient.setReady(nextState);
  };

  const handleStartMatch = () => {
    roomClient.startGame();
  };

  // Play countdown audio ticks when countdown active
  useEffect(() => {
    if (isCountdown && countdownValue > 0) {
      SoundFX.playCountdownTick(countdownValue === 1);
    }
  }, [isCountdown, countdownValue]);

  // If game starts, notify parent to switch screen
  useEffect(() => {
    if (isPlaying) {
      onMatchStart();
    }
  }, [isPlaying, onMatchStart]);

  // Both players ready condition
  const hasOpponent = Boolean(opponent);
  const isOpponentReady = Boolean(opponent?.isReady);
  const areBothPlayersReady = hasOpponent && isLocalReady && isOpponentReady;
  const canHostStart = isHost && areBothPlayersReady;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between bg-slate-900/85 border border-slate-800 rounded-2xl p-4 gap-3 shadow-lg">
        <button
          onClick={handleLeaveRoom}
          className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Rời Phòng</span>
        </button>

        {/* Room Code Display & Google Meet Style Invite Link */}
        {roomCode && (
          <div className="flex flex-wrap items-center gap-2.5">
            {roomName && (
              <span className="text-xs font-bold font-display uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                {roomName}
              </span>
            )}
            <span className="text-xs font-mono text-slate-400">Mã:</span>
            <div className="flex items-center gap-2 bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-1.5 font-mono text-cyan-400 font-extrabold text-sm tracking-widest shadow-inner">
              <span>{roomCode}</span>
              <button
                onClick={handleCopyCode}
                title="Sao chép mã phòng"
                className="hover:text-white transition-colors ml-1 text-cyan-400"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Google Meet Share Link Button */}
            <button
              onClick={handleCopyInviteLink}
              title="Sao chép đường link phòng để bạn bè trên máy khác chỉ cần bấm vào là tự động vào phòng"
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md ${
                copiedLink
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-white'
              }`}
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>{copiedLink ? '✓ Đã chép Link Mời!' : 'Sao Chép Link (Meet)'}</span>
            </button>

            {/* Direct Open in New Tab Button for instantaneous 2-player testing */}
            <a
              href={`${window.location.origin}${window.location.pathname}?room=${roomCode}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Mở thêm 1 tab mới trên trình duyệt này để đối kháng thử nghiệm 2 người lập tức"
              className="px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mở Tab P2 Mới</span>
            </a>
          </div>
        )}

        {/* Status badges */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>P2P WebRTC ({latencyMs}ms)</span>
          </div>
          <div className="text-slate-400">
            Thời lượng: <strong className="text-white">{matchDuration}s</strong>
          </div>
        </div>
      </div>

      {/* Host Transfer Notification Banner */}
      {hostTransferMessage && (
        <div className="bg-amber-950/80 border border-amber-500/50 rounded-2xl px-4 py-3 flex items-center justify-between text-amber-200 text-xs font-mono shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Crown className="w-4 h-4 fill-amber-400" />
            </div>
            <span className="font-semibold">{hostTransferMessage}</span>
          </div>
          <button
            onClick={() => setHostTransferMessage(null)}
            className="text-amber-400 hover:text-white px-2 py-1 text-sm font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Dual Camera Arena - Both players see each other face-to-face */}
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {/* CAMERA 1: YOU (Player 1) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-2 text-xs font-mono">
              <div className="flex items-center gap-2 font-bold text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>BẠN: {username}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold ${
                    isHost
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {isHost && <Crown className="w-3 h-3 text-amber-400 fill-amber-400 inline" />}
                  {isHost ? 'CHỦ PHÒNG' : 'THÀNH VIÊN (P2)'}
                </span>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                  isLocalReady
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {isLocalReady ? '✓ BẠN ĐÃ SẴN SÀNG' : 'CHƯA SẴN SÀNG'}
              </span>
            </div>

            <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
              <CameraView
                mode="full"
                isCalibrating={isCalibrating}
                onCalibrationProgress={handleCalibrationProgress}
                zoomAndBlur={isCountdown}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* CAMERA 2: OPPONENT (Player 2) via Live WebRTC Video */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-2 text-xs font-mono">
              <div className="flex items-center gap-2 font-bold text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                <span>ĐỐI THỦ: {opponent ? opponent.username : 'Đang đợi tham gia...'}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold ${
                    !isHost && opponent
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}
                >
                  {!isHost && opponent && <Crown className="w-3 h-3 text-amber-400 fill-amber-400 inline" />}
                  {!isHost ? 'CHỦ PHÒNG' : 'THÀNH VIÊN (P2)'}
                </span>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                  opponent?.isReady
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {opponent?.isReady ? '✓ ĐỐI THỦ ĐÃ SẴN SÀNG' : 'CHỜ ĐỐI THỦ SẴN SÀNG'}
              </span>
            </div>

            <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
              <OpponentVideoView
                zoomAndBlur={isCountdown}
                showOverlay={true}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* Central VS Badge */}
        <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 border-2 border-slate-900 flex items-center justify-center font-black font-display text-white text-xl shadow-2xl shadow-cyan-500/40">
            VS
          </div>
        </div>

        {/* Dramatic 3s Countdown Zoom & Blur Overlay */}
        {isCountdown && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md rounded-3xl animate-screen-shake">
            <div className="flex items-center gap-2 text-xs md:text-sm font-mono text-cyan-400 uppercase tracking-widest mb-3 animate-pulse">
              <Swords className="w-5 h-5 text-amber-400" />
              <span>TRẬN ĐẤU BẮT ĐẦU SAU</span>
            </div>

            <div
              key={countdownValue}
              className="text-8xl md:text-9xl font-black font-display text-white drop-shadow-2xl animate-in zoom-in-50 duration-200 transition-all select-none"
            >
              {countdownValue === 0 ? 'CHIẾN!' : countdownValue}
            </div>

            <p className="text-xs font-mono text-slate-300 mt-4 max-w-sm text-center">
              Chuẩn bị giơ tay xen kẽ: Tay Trái (6) và Tay Phải (7)!
            </p>
          </div>
        )}
      </div>

      {/* Control Station: Calibration, Ready Button & Start Match */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* T-Pose Calibration Action Card */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                  isCalibrated
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                }`}
              >
                {isCalibrated ? <ShieldCheck className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Hiệu Chuẩn Nhận Diện Cử Động</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {isCalibrated
                    ? `Đã hiệu chuẩn chuẩn xác (dArm: ${dArm.toFixed(2)}, dTorso: ${dTorso.toFixed(2)})`
                    : calibrationFeedback}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isCalibrated && (
                <button
                  onClick={() => finishCalibration(0.45, 0.55)}
                  className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-xs font-mono text-cyan-400 rounded-xl transition-all border border-slate-700"
                  title="Sử dụng chỉ số chuẩn mà không cần T-Pose"
                >
                  Dùng Mặc Định (Bỏ qua)
                </button>
              )}
              <button
                onClick={startCalibration}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-white rounded-xl transition-all border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin' : ''}`} />
                <span>{isCalibrated ? 'Hiệu Chuẩn Lại' : 'Giữ 3s T-Pose'}</span>
              </button>
            </div>
          </div>

          {/* Calibration Progress Bar */}
          {isCalibrating && (
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between text-xs font-mono text-cyan-400">
                <span>Giữ hai tay ngang vai trong tư thế chữ T...</span>
                <span className="tabular-nums font-bold">
                  {calibrationProgress}% ({calibrationCountdown}s)
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-emerald-400 h-full transition-all duration-150"
                  style={{ width: `${calibrationProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Panel: Ready Button & Master Start Match Button */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Tiến độ phòng đối kháng:</span>
            <span className="text-white font-bold">
              {hasOpponent
                ? `2/2 Người chơi (${(isLocalReady ? 1 : 0) + (isOpponentReady ? 1 : 0)}/2 Sẵn sàng)`
                : '1/2 Người chơi (Đang đợi đối thủ vào)'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* 1. NÚT SẴN SÀNG CHO MỖI NGƯỜI CHƠI (EACH USER MUST PRESS READY) */}
            <button
              onClick={handleToggleReady}
              className={`flex-1 w-full py-3.5 px-5 rounded-2xl font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 border ${
                isLocalReady
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
              }`}
            >
              {isLocalReady ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>BẠN ĐÃ SẴN SÀNG (Bấm để hủy)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>BẤM SẴN SÀNG (READY)</span>
                </>
              )}
            </button>

            {/* 2. NÚT BẮT ĐẦU: CHỈ CHỦ PHÒNG MỚI BẤM ĐƯỢC KHI CẢ 2 ĐỀU ĐÃ SẴN SÀNG */}
            {isHost ? (
              canHostStart ? (
                <button
                  onClick={handleStartMatch}
                  className="flex-1 w-full py-3.5 px-5 rounded-2xl font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 text-slate-950 shadow-xl shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] border border-emerald-300 animate-pulse"
                >
                  <Swords className="w-4 h-4" />
                  <span>BẮT ĐẦU TRẬN ĐẤU (CHỦ PHÒNG)</span>
                </button>
              ) : (
                <div className="flex-1 w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-500 text-xs font-mono text-center flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400/60 animate-ping" />
                  <span>CHỜ CẢ 2 BẤM SẴN SÀNG</span>
                </div>
              )
            ) : (
              areBothPlayersReady ? (
                <div className="flex-1 w-full py-3.5 px-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-mono text-center flex items-center justify-center gap-2 animate-pulse">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>CẢ 2 ĐÃ SẴN SÀNG · ĐANG CHỜ CHỦ PHÒNG BẮT ĐẦU...</span>
                </div>
              ) : (
                <div className="flex-1 w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-500 text-xs font-mono text-center flex items-center justify-center gap-2">
                  <span>BẤM SẴN SÀNG ĐỂ CHỦ PHÒNG CÓ THỂ BẮT ĐẦU</span>
                </div>
              )
            )}
          </div>

          {/* Voluntary Host Transfer Button */}
          {isHost && hasOpponent && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => roomClient.transferHost(opponent?.id)}
                title="Chuyển quyền chủ phòng cho đối thủ"
                className="text-[11px] font-mono text-amber-400/90 hover:text-amber-300 flex items-center gap-1.5 transition-colors bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-xl"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Nhường quyền Chủ Phòng cho đối thủ ({opponent?.username})</span>
              </button>
            </div>
          )}

          {/* Status Note */}
          <div className="text-[11px] font-mono text-slate-400 text-center">
            {!hasOpponent ? (
              <span className="text-amber-400">
                Hãy bấm <strong>"Sao Chép Link Mời (Như Meet)"</strong> hoặc gửi mã phòng cho bạn bè ở máy tính khác để cả hai bật camera thấy mặt nhau.
              </span>
            ) : !areBothPlayersReady ? (
              <span className="text-slate-400">
                {!isLocalReady && !isOpponentReady
                  ? 'Cả hai bạn cần bấm "BẤM SẴN SÀNG" để chủ phòng có thể bắt đầu trận đấu.'
                  : !isLocalReady
                  ? 'Đối thủ đã sẵn sàng! Bạn hãy bấm "BẤM SẴN SÀNG".'
                  : 'Bạn đã sẵn sàng! Đang chờ đối thủ bấm "BẤM SẴN SÀNG"...'}
              </span>
            ) : isHost ? (
              <span className="text-emerald-400 font-bold">
                ✓ Cả hai đấu thủ đã sẵn sàng! Chủ phòng hãy bấm "BẮT ĐẦU TRẬN ĐẤU" để khởi động đếm ngược 3s!
              </span>
            ) : (
              <span className="text-emerald-400 font-bold">
                ✓ Cả hai đấu thủ đã sẵn sàng! Đang chờ Chủ phòng bấm Bắt Đầu Trận Đấu...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

