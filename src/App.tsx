import React, { useState, useEffect } from 'react';
import { MenuScreen } from './components/screens/MenuScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { GameScreen } from './components/screens/GameScreen';
import { SoloChallengeScreen } from './components/screens/SoloChallengeScreen';
import { useGameStore } from './store/useGameStore';
import { useRoomStore } from './store/useRoomStore';
import { RoomClient } from './lib/network/RoomClient';
import { Volume2, VolumeX, Smartphone, SmartphoneNfc, HelpCircle, Activity, Sparkles, ExternalLink, AlertTriangle, Crown } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'solo' | 'lobby' | 'game'>('menu');
  const [soloDuration, setSoloDuration] = useState<number>(30);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isMultiplayer, setIsMultiplayer] = useState(false);

  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const hapticsEnabled = useGameStore((s) => s.hapticsEnabled);
  const toggleHaptics = useGameStore((s) => s.toggleHaptics);

  const roomCode = useRoomStore((s) => s.roomCode);
  const joinErrorMessage = useRoomStore((s) => s.joinErrorMessage);
  const setJoinErrorMessage = useRoomStore((s) => s.setJoinErrorMessage);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);

  // Initialize socket listener and auto-join from URL parameter ?room=XXXX
  useEffect(() => {
    const client = RoomClient.getInstance();
    client.connect();

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const cleanCode = roomParam.trim().toUpperCase();
      if (cleanCode.length === 4) {
        client.joinRoom(cleanCode, useRoomStore.getState().username);
      }
    }
  }, []);

  // Synchronize screen state with roomCode
  useEffect(() => {
    if (roomCode) {
      setIsMultiplayer(true);
      if (currentScreen !== 'game') {
        setCurrentScreen('lobby');
      }
    }
  }, [roomCode]);

  const handleStartSolo = (duration: number) => {
    setIsMultiplayer(false);
    setSoloDuration(duration);
    setCurrentScreen('solo');
  };

  const handleEnterLobby = () => {
    setIsMultiplayer(true);
    setCurrentScreen('lobby');
  };

  const handleMatchStart = () => {
    setCurrentScreen('game');
  };

  const handleBackToMenu = () => {
    RoomClient.getInstance().leaveRoom();
    setIsMultiplayer(false);
    setCurrentScreen('menu');
  };

  const handleRematchToLobby = () => {
    if (isMultiplayer) {
      setCurrentScreen('lobby');
    } else {
      setCurrentScreen('solo');
    }
  };

  const currentTabUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}${roomCode ? `?room=${roomCode}` : ''}`
    : '';

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Bar Contract: Zone 1 (Brand), Zone 2 (Clean Nav), Zone 3 (Primary Actions) */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Zone 1: Single text wordmark in display face */}
          <div
            onClick={handleBackToMenu}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/25 group-hover:scale-105 transition-transform">
              <Crown className="w-5 h-5 text-slate-950 fill-slate-950" />
            </div>
            <span className="text-xl font-black tracking-tight text-white font-display uppercase bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
              King of aura
            </span>
          </div>

          {/* Zone 2: Clean unboxed text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <button
              onClick={() => setCurrentScreen('menu')}
              className={`hover:text-white transition-colors ${
                currentScreen === 'menu' ? 'text-cyan-400 font-semibold' : ''
              }`}
            >
              Trang Chủ
            </button>
            <button
              onClick={() => handleStartSolo(30)}
              className={`hover:text-white transition-colors flex items-center gap-1.5 ${
                currentScreen === 'solo' ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tự Solo Đếm 6 7</span>
            </button>
            <button
              onClick={() => setShowRulesModal(true)}
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Quy Tắc Nhịp 6 7</span>
            </button>
          </nav>

          {/* Zone 3: Sensory Controls & Action */}
          <div className="flex items-center gap-2">
            {/* AIS-DEV New Tab Link */}
            <a
              href={currentTabUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Mở thêm 1 tab trình duyệt mới (AIS Preview) để thi đấu 2 người hoặc thử nghiệm 2 màn hình"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-mono font-bold transition-all shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mở Tab Mới (AIS)</span>
            </a>

            {/* Audio Toggle */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh hiệu ứng'}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Haptics Toggle */}
            <button
              onClick={toggleHaptics}
              title={hapticsEnabled ? 'Tắt rung điện thoại' : 'Bật rung điện thoại'}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              {hapticsEnabled ? <SmartphoneNfc className="w-4 h-4 text-emerald-400" /> : <Smartphone className="w-4 h-4" />}
            </button>

            {currentScreen !== 'menu' && (
              <button
                onClick={handleBackToMenu}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-200 transition-colors border border-slate-700"
              >
                Về Menu
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Global Error Banner if join failed */}
      {joinErrorMessage && (
        <div className="bg-rose-950/90 border-b border-rose-800/80 px-4 py-2.5 flex items-center justify-between text-rose-200 text-xs font-mono z-30">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{joinErrorMessage}</span>
          </div>
          <button
            onClick={() => setJoinErrorMessage(null)}
            className="text-rose-400 hover:text-white px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1 flex flex-col justify-center">
        {currentScreen === 'menu' && (
          <MenuScreen onStartSolo={handleStartSolo} onEnterLobby={handleEnterLobby} />
        )}

        {currentScreen === 'solo' && (
          <SoloChallengeScreen
            onBackToMenu={handleBackToMenu}
            initialDuration={soloDuration}
          />
        )}

        {currentScreen === 'lobby' && (
          <LobbyScreen onBackToMenu={handleBackToMenu} onMatchStart={handleMatchStart} />
        )}

        {currentScreen === 'game' && (
          <GameScreen
            onBackToMenu={handleBackToMenu}
            onRematchToLobby={handleRematchToLobby}
            isMultiplayer={isMultiplayer}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/60 py-6 px-4 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span>Vibe Code v2.2</span>
            <span className="mx-2">·</span>
            <span>Motion Esports & Solo 6 7 Counter</span>
            <span className="mx-2">·</span>
            <span>WASM Pose Core</span>
          </div>
          <div>
            <span>WebRTC P2P Data Channels · MediaPipe Pose Engine</span>
          </div>
        </div>
      </footer>

      {/* Rules & Guide Dialog Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Hướng Dẫn Thực Hiện Cử Động 6 7 Chuẩn Xác
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-slate-400 hover:text-white font-mono text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="text-xs font-mono text-slate-300 space-y-4 leading-relaxed">
              <div>
                <h4 className="font-bold text-cyan-400 uppercase text-[11px] mb-1">
                  1. Chu kỳ 1 rep 6 7 hoàn chỉnh
                </h4>
                <p className="text-slate-400">
                  Chu kỳ gồm 4 bước: <strong>Giơ tay TRÁI (nhịp 6)</strong> ➔ <strong>Hạ tay về Neutral</strong> ➔ <strong>Giơ tay PHẢI (nhịp 7)</strong> ➔ <strong>Hạ tay về Neutral</strong>. Khi hoàn tất, hệ thống sẽ tính +1 lần và đọc to số lần.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-emerald-400 uppercase text-[11px] mb-1">
                  2. Thước đo độ cao tay (Wrist Reach Gauge)
                </h4>
                <p className="text-slate-400">
                  Hai bên màn hình có 2 cột đo độ cao tay. Khi bạn giơ tay lên vượt qua vạch chỉ tiêu, cột sẽ sáng xanh và hiển thị "ĐẠT". Vòng tròn mục tiêu trên khung xương cũng sẽ nháy sáng.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-amber-400 uppercase text-[11px] mb-1">
                  3. Tùy chỉnh độ nhạy theo không gian
                </h4>
                <p className="text-slate-400">
                  Nếu phòng nhỏ hoặc bạn chỉ muốn nhảy nhẹ nhàng, hãy chọn chế độ <strong>"Linh hoạt"</strong> (chỉ cần đưa tay cao ngang cằm/tai là đã đạt). Để thi đấu chuyên nghiệp, chọn chế độ <strong>"Chuẩn"</strong> hoặc <strong>"Khắt khe"</strong>.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-purple-400 uppercase text-[11px] mb-1">
                  4. Chế độ đọc số thành tiếng
                </h4>
                <p className="text-slate-400">
                  Hệ thống tích hợp giọng đọc (Speech Synthesis). Mỗi lần bạn hoàn thành 1 rep 6 7, loa sẽ tự động hô to số lần bạn đạt được mà không cần bạn phải liếc nhìn màn hình liên tục!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-all font-mono"
            >
              Đã Hiểu, Bắt Đầu Luyện Tập
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
