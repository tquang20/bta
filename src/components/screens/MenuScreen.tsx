import React, { useState, useEffect } from 'react';
import { useRoomStore } from '../../store/useRoomStore';
import { useGameStore } from '../../store/useGameStore';
import { RoomClient } from '../../lib/network/RoomClient';
import {
  Trophy,
  Swords,
  Zap,
  Activity,
  ArrowRight,
  ShieldCheck,
  Clock,
  Award,
  Timer,
  Sliders,
  Flame,
  ExternalLink,
  Copy,
  Check,
  Users,
  RefreshCw,
  Share2,
  Crown,
} from 'lucide-react';

interface MenuScreenProps {
  onStartSolo: (duration: number) => void;
  onEnterLobby: () => void;
}

interface ActiveRoomItem {
  code: string;
  name?: string;
  hostUsername: string;
  playerCount: number;
  status: string;
  duration: number;
  createdAt?: number;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ onStartSolo, onEnterLobby }) => {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomNameInput, setRoomNameInput] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [activeRooms, setActiveRooms] = useState<ActiveRoomItem[]>([]);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);

  const username = useRoomStore((s) => s.username);
  const setUsername = useRoomStore((s) => s.setUsername);
  const eloRating = useRoomStore((s) => s.eloRating);
  const totalMatches = useRoomStore((s) => s.totalMatches);
  const totalReps = useRoomStore((s) => s.totalReps);
  const matchHistory = useRoomStore((s) => s.matchHistory);
  const roomCode = useRoomStore((s) => s.roomCode);
  const isJoiningRoom = useRoomStore((s) => s.isJoiningRoom);
  const joinErrorMessage = useRoomStore((s) => s.joinErrorMessage);

  const soloBestRecords = useGameStore((s) => s.soloBestRecords);
  const sensitivity = useGameStore((s) => s.sensitivity);
  const setSensitivity = useGameStore((s) => s.setSensitivity);

  const roomClient = RoomClient.getInstance();

  // Real-time synchronization of open rooms via Socket.io & REST fallback
  useEffect(() => {
    // 1. Listen for real-time room list broadcast from server
    const cleanup = roomClient.onRoomListUpdated((rooms) => {
      if (Array.isArray(rooms)) {
        setActiveRooms(rooms);
      }
    });

    // 2. Fetch initial room list
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.rooms)) {
            setActiveRooms(data.rooms);
          }
        }
      } catch (e) {
        // ignore polling errors
      }
    };
    fetchRooms();
    roomClient.fetchRoomList();

    // 3. Fallback poll every 2.5s
    const timer = setInterval(fetchRooms, 2500);
    return () => {
      cleanup();
      clearInterval(timer);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshingRooms(true);
    roomClient.fetchRoomList();
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.rooms)) {
          setActiveRooms(data.rooms);
        }
      }
    } catch (e) {}
    setTimeout(() => setIsRefreshingRooms(false), 500);
  };

  const handleOpenPreviewTab = () => {
    window.open(window.location.href, '_blank');
  };

  // Once server confirms room is created or joined, navigate to lobby
  React.useEffect(() => {
    if (roomCode) {
      onEnterLobby();
    }
  }, [roomCode, onEnterLobby]);

  const handleCreateRoom = () => {
    setJoinError(null);
    const finalRoomName = roomNameInput.trim() || `Phòng của ${username || 'Chủ Phòng'}`;
    roomClient.createRoom(username, selectedDuration, finalRoomName);
  };

  const handleJoinWithCode = (targetCode: string) => {
    const cleanCode = targetCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleanCode || cleanCode.length !== 4) {
      setJoinError('Vui lòng nhập đúng mã phòng gồm 4 ký tự.');
      return;
    }
    setJoinError(null);
    roomClient.joinRoom(cleanCode, username);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    handleJoinWithCode(roomCodeInput);
  };

  const handleSoloGame = (duration: number) => {
    onStartSolo(duration);
  };

  const waitingRooms = activeRooms.filter(
    (r) => r.status === 'lobby' && r.playerCount === 1
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Hero Showcase Section */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/60 shadow-2xl">
        <div className="relative h-64 md:h-80 w-full overflow-hidden">
          <img
            src="/src/assets/images/vibecode_motion_arena_1791250526760.jpg"
            alt="Vibe Code Motion Arena"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center filter brightness-90 contrast-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090b10] via-[#090b10]/60 to-transparent" />

          <div className="absolute bottom-6 left-6 right-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400 mb-2">
                <span>Nhận diện cử động AI Studio</span>
                <span>·</span>
                <span>Chuẩn xác nhịp 6 7</span>
                <span>·</span>
                <span>Tự solo & Đấu Online</span>
              </div>
              <div className="flex items-center gap-3">
                <Crown className="w-8 h-8 md:w-12 md:h-12 text-amber-400 fill-amber-400 drop-shadow-md" />
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white font-display uppercase bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                  King of aura
                </h1>
              </div>
              <p className="text-sm md:text-base text-slate-300 max-w-xl mt-1">
                Thử thách điệu nhảy 6 7 thời gian thực: Tự solo đếm số lần hoàn thành trong thời gian chỉ định hoặc đối kháng 1v1 online không độ trễ.
              </p>
            </div>

            {/* User ELO & Record Card */}
            <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex items-center gap-4 shrink-0 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400 font-mono">Xếp hạng & Điểm</div>
                <div className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
                  {eloRating} <span className="text-xs text-slate-500 font-normal">ELO</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Kỷ lục 30s: <strong className="text-white">{soloBestRecords[30] || 0} lần</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile & Settings Bar */}
        <div className="p-4 md:p-6 bg-slate-900/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-mono text-slate-400">Tên người chơi:</label>
            <input
              type="text"
              value={username}
              maxLength={16}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-cyan-500 transition-colors w-40"
              placeholder="Tên của bạn"
            />
            <button
              onClick={handleOpenPreviewTab}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold transition-all shadow-md shadow-cyan-500/10"
              title="Mở app ở tab mới (AIS Preview Mode)"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở Tab Preview</span>
            </button>
          </div>

          {/* Sensitivity Setting Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Độ nhạy bắt cử động:
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(
                [
                  { id: 'forgiving', label: 'Linh hoạt' },
                  { id: 'standard', label: 'Chuẩn' },
                  { id: 'strict', label: 'Khắt khe' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setSensitivity(mode.id)}
                  className={`px-3 py-1 text-xs font-mono font-semibold rounded-md transition-all ${
                    sensitivity === mode.id
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mode 1: TỰ SOLO ĐẾM SỐ LẦN 6 7 (New & Highlighted) */}
        <div className="bg-gradient-to-br from-emerald-950/30 via-slate-900/80 to-slate-900/90 border-2 border-emerald-500/40 rounded-3xl p-6 flex flex-col justify-between hover:border-emerald-400 transition-all shadow-xl shadow-emerald-500/5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/10">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white font-display">Tự Solo Đếm 6 7</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      CHẾ ĐỘ MỚI
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">Đếm số lần thực hiện trong thời gian chỉ định</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              Bật camera và thực hiện nhịp 6 7 liên tục. Thuật toán cải tiến tự động đếm từng rep chuẩn xác, hiển thị thước đo độ cao sải tay và đọc to số lần đạt được!
            </p>

            {/* Time Presets Selector */}
            <div className="flex flex-col gap-2 mb-6 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              <span className="text-xs font-mono text-slate-400 flex items-center justify-between">
                <span>Chọn mốc thời gian thử thách:</span>
                <span className="text-emerald-400 font-bold">Kỷ lục hiện tại: {soloBestRecords[selectedDuration] || 0} lần</span>
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {[15, 30, 60, 90, 0].map((dur) => (
                  <button
                    key={dur}
                    onClick={() => setSelectedDuration(dur)}
                    className={`py-2 px-1 text-center rounded-xl font-mono text-xs font-bold transition-all ${
                      selectedDuration === dur
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {dur === 0 ? 'Vô tận' : `${dur}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => handleSoloGame(selectedDuration)}
              className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm rounded-2xl transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 group"
            >
              <span>VÀO THỬ THÁCH SOLO ({selectedDuration === 0 ? 'VÔ TẬN' : `${selectedDuration} GIÂY`})</span>
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Mode 2: 1v1 Online Competitive Battle */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between hover:border-cyan-500/40 transition-all">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Swords className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white font-display">Đối Kháng 1v1 Online</h2>
                <p className="text-xs text-slate-400 font-mono">Thi đấu thời gian thực qua P2P WebRTC</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              So tài trực tiếp cùng bạn bè. Tạo phòng đấu riêng hoặc nhập mã 4 ký tự để vào trận đấu xếp hạng ELO không độ trễ.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t border-slate-800/80">
            {/* Custom Room Name Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1 text-cyan-400 font-bold">
                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Đặt Tên Phòng:
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Dễ phân biệt khi thi đấu</span>
              </label>
              <input
                type="text"
                placeholder={`Ví dụ: Sàn đấu của ${username || 'bạn'}`}
                maxLength={28}
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                className="bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs font-semibold text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              />
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={isJoiningRoom}
              className="w-full py-3.5 px-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-700 disabled:cursor-not-allowed text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 group"
            >
              <span>{isJoiningRoom ? 'Đang khởi tạo phòng...' : 'Tạo Phòng Đấu 1v1'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                placeholder="MÃ PHÒNG (4 CHỮ)"
                maxLength={4}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center font-mono font-bold tracking-widest text-white uppercase placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 text-sm"
              />
              <button
                type="submit"
                disabled={isJoiningRoom}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors border border-slate-700"
              >
                {isJoiningRoom ? 'Đang vào...' : 'Vào Phòng'}
              </button>
            </form>

            {(joinError || joinErrorMessage) && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2 animate-shake">
                <span>⚠️</span>
                <span>{joinError || joinErrorMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DEDICATED LIVE ROOM LIST: Phòng đang có 1 user đang đợi - List phòng trắng có thể vào liền */}
      <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 border-2 border-cyan-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white font-display tracking-tight">
                  Phòng Đang Chờ Người Chơi
                </h2>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> TRỰC TIẾP TỪ SERVER
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Các phòng có 1 người đang đợi đối thủ — Bấm "VÀO CHIẾN NGAY" để vào phòng lập tức không cần gõ mã!
              </p>
            </div>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshingRooms}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono transition-all"
            title="Làm mới danh sách phòng trên server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRooms ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{isRefreshingRooms ? 'Đang cập nhật...' : 'Làm Mới'}</span>
          </button>
        </div>

        {waitingRooms.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5">
            {waitingRooms.map((r) => (
              <div
                key={r.code}
                className="bg-white text-slate-950 rounded-2xl p-4 md:p-5 shadow-xl hover:shadow-cyan-500/20 border-2 border-transparent hover:border-cyan-500 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Room Info */}
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-base md:text-lg font-black font-display text-slate-950 uppercase tracking-tight truncate">
                      {r.name || `Phòng của ${r.hostUsername}`}
                    </span>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> 1 người đang đợi bạn
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600">
                    <span className="flex items-center gap-1 font-semibold text-slate-800">
                      <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      Chủ phòng: <strong className="text-slate-950">{r.hostUsername}</strong>
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Thời lượng: <strong className="text-slate-950">{r.duration} giây</strong>
                    </span>
                  </div>
                </div>

                {/* Room Code & Action Button */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 bg-slate-900 text-cyan-300 px-3 py-1.5 rounded-xl font-mono font-black text-sm tracking-widest border border-slate-700 shadow-inner">
                    <span className="text-[10px] text-slate-400 tracking-normal font-sans">MÃ:</span>
                    <span>{r.code}</span>
                  </div>

                  <button
                    onClick={() => handleJoinWithCode(r.code)}
                    disabled={isJoiningRoom}
                    className="px-6 py-3 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all transform active:scale-95 group-hover:shadow-amber-500/50"
                  >
                    <span>{isJoiningRoom ? 'Đang vào...' : 'VÀO CHIẾN NGAY'}</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-300">
                Hiện chưa có phòng nào đang mở đợi đối thủ
              </p>
              <p className="text-xs text-slate-500 font-mono mt-1 max-w-md">
                Hãy đặt tên và bấm <strong>"Tạo Phòng Đấu 1v1"</strong> ở phía trên để mở phòng mới, hoặc nhập mã 4 ký tự do bạn bè chia sẻ!
              </p>
            </div>
            <button
              onClick={handleCreateRoom}
              disabled={isJoiningRoom}
              className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-slate-700 text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-1.5"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Tạo Phòng Mới Ngay</span>
            </button>
          </div>
        )}
      </div>

      {/* Rhythm Instructions Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6">
        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" /> Hướng Dẫn Bắt Cử Động 6 7 Chuẩn Xác Nhất
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono text-slate-300">
          <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/80">
            <div className="text-emerald-400 font-bold mb-1">1. Đứng rõ trước Camera</div>
            <p className="text-slate-400 leading-relaxed">
              Đặt camera cách 1.5m - 2.5m để nhìn thấy từ ngực/hông trở lên. Đảm bảo phòng đủ ánh sáng để camera nhận diện khớp vai và cổ tay.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/80">
            <div className="text-cyan-400 font-bold mb-1">2. Giơ tay chạm vòng mục tiêu</div>
            <p className="text-slate-400 leading-relaxed">
              Nhịp 6: Giơ tay trái chạm vòng xanh trên màn hình. Sau đó hạ tay xuống. Nhịp 7: Giơ tay phải chạm vòng xanh dương.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/80">
            <div className="text-amber-400 font-bold mb-1">3. Chỉnh độ nhạy phù hợp</div>
            <p className="text-slate-400 leading-relaxed">
              Nếu phòng chật hoặc không thể giơ tay quá cao, chuyển độ nhạy sang <strong>"Linh hoạt"</strong> để tính điểm dễ dàng hơn!
            </p>
          </div>
        </div>
      </div>

      {/* Match History Table */}
      {matchHistory.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" /> Lịch Sử Đấu Gần Đây
            </h3>
            <span className="text-xs font-mono text-slate-400">{matchHistory.length} Trận đã lưu</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Thời gian</th>
                  <th className="py-2.5 px-3">Đối thủ</th>
                  <th className="py-2.5 px-3">Kết quả</th>
                  <th className="py-2.5 px-3 text-right">Điểm số</th>
                  <th className="py-2.5 px-3 text-right">Thay đổi ELO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {matchHistory.slice(0, 5).map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-slate-400">{m.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-white">{m.opponentName}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          m.winner === 'player'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : m.winner === 'opponent'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {m.winner === 'player' ? 'THẮNG' : m.winner === 'opponent' ? 'THUA' : 'HÒA'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-200">
                      {m.myScore} - {m.opponentScore}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                        m.eloDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {m.eloDelta >= 0 ? `+${m.eloDelta}` : m.eloDelta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
