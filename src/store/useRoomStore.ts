import { create } from 'zustand';

export interface OpponentPlayer {
  id: string;
  username: string;
  score: number;
  combo: number;
  maxCombo: number;
  reps: number;
  invalidReps: number;
  isReady: boolean;
  isCalibrated: boolean;
  dArm: number;
  dTorso: number;
  activeHand?: 'left' | 'right';
  lastHitTime?: number;
}

export interface MatchRecord {
  id: string;
  date: string;
  duration: number;
  myScore: number;
  opponentScore: number;
  opponentName: string;
  winner: 'player' | 'opponent' | 'tie';
  eloDelta: number;
}

export interface RoomStoreState {
  roomCode: string | null;
  roomName: string | null;
  playerId: string | null;
  username: string;
  isHost: boolean;
  hostTransferMessage: string | null;
  opponent: OpponentPlayer | null;
  isLocalReady: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteFallbackFrame: string | null;
  netcodeMode: 'webrtc' | 'websocket' | 'offline';
  webrtcConnected: boolean;
  latencyMs: number;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  errorMessage: string | null;
  isJoiningRoom: boolean;
  joinErrorMessage: string | null;
  forfeitWinMessage: string | null;

  // ELO & Match History (Stored in localStorage)
  eloRating: number;
  totalMatches: number;
  totalReps: number;
  matchHistory: MatchRecord[];

  // Actions
  setUsername: (name: string) => void;
  setIsHost: (isHost: boolean) => void;
  setHostTransferMessage: (msg: string | null) => void;
  setRoomData: (code: string, playerId: string, isHost: boolean, roomName?: string) => void;
  setOpponent: (opponent: OpponentPlayer | null) => void;
  setIsLocalReady: (ready: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setRemoteFallbackFrame: (frame: string | null) => void;
  setIsJoiningRoom: (isJoining: boolean) => void;
  setJoinErrorMessage: (msg: string | null) => void;
  updateOpponentScore: (data: {
    score: number;
    combo: number;
    reps: number;
    invalidReps?: number;
    activeHand?: 'left' | 'right';
  }) => void;
  setNetcodeMode: (mode: 'webrtc' | 'websocket' | 'offline') => void;
  setWebRtcConnected: (connected: boolean) => void;
  setLatency: (ms: number) => void;
  setConnectionStatus: (status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error', error?: string) => void;
  setForfeitWinMessage: (msg: string | null) => void;
  leaveRoom: () => void;
  recordMatchResult: (match: Omit<MatchRecord, 'id' | 'date'>) => void;
}

// Load initial stats from localStorage
const storedElo = typeof window !== 'undefined' ? localStorage.getItem('vibecode_elo') : null;
const storedMatches = typeof window !== 'undefined' ? localStorage.getItem('vibecode_history') : null;
const storedUsername = typeof window !== 'undefined' ? localStorage.getItem('vibecode_user') : null;

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  roomCode: null,
  roomName: null,
  playerId: null,
  username: storedUsername || `Viber_${Math.floor(1000 + Math.random() * 9000)}`,
  isHost: false,
  hostTransferMessage: null,
  opponent: null,
  isLocalReady: false,
  localStream: null,
  remoteStream: null,
  remoteFallbackFrame: null,
  netcodeMode: 'offline',
  webrtcConnected: false,
  latencyMs: 12,
  connectionStatus: 'idle',
  errorMessage: null,
  isJoiningRoom: false,
  joinErrorMessage: null,
  forfeitWinMessage: null,

  eloRating: storedElo ? parseInt(storedElo, 10) : 1200,
  totalMatches: storedMatches ? JSON.parse(storedMatches).length : 0,
  totalReps: 0,
  matchHistory: storedMatches ? JSON.parse(storedMatches) : [],

  setUsername: (username: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vibecode_user', username);
    }
    set({ username });
  },

  setIsHost: (isHost: boolean) => {
    set({ isHost });
  },

  setHostTransferMessage: (hostTransferMessage: string | null) => {
    set({ hostTransferMessage });
  },

  setRoomData: (roomCode: string, playerId: string, isHost: boolean, roomName?: string) => {
    set({
      roomCode,
      roomName: roomName || null,
      playerId,
      isHost,
      hostTransferMessage: null,
      isLocalReady: false,
      isJoiningRoom: false,
      joinErrorMessage: null,
      connectionStatus: 'connected',
      errorMessage: null,
    });
  },

  setOpponent: (opponent: OpponentPlayer | null) => {
    set({ opponent });
  },

  setIsLocalReady: (isLocalReady: boolean) => {
    set({ isLocalReady });
  },

  setLocalStream: (localStream: MediaStream | null) => {
    set({ localStream });
  },

  setRemoteStream: (remoteStream: MediaStream | null) => {
    set({ remoteStream });
  },

  setRemoteFallbackFrame: (remoteFallbackFrame: string | null) => {
    set({ remoteFallbackFrame });
  },

  setIsJoiningRoom: (isJoiningRoom: boolean) => {
    set({ isJoiningRoom });
  },

  setJoinErrorMessage: (joinErrorMessage: string | null) => {
    set({ joinErrorMessage, isJoiningRoom: false });
  },

  updateOpponentScore: (data) => {
    const opp = get().opponent;
    if (!opp) return;
    set({
      opponent: {
        ...opp,
        score: data.score,
        combo: data.combo,
        reps: data.reps,
        invalidReps: data.invalidReps ?? opp.invalidReps,
        activeHand: data.activeHand ?? opp.activeHand,
        lastHitTime: Date.now(),
      },
    });
  },

  setNetcodeMode: (netcodeMode) => set({ netcodeMode }),
  setWebRtcConnected: (webrtcConnected) => set({ webrtcConnected }),
  setLatency: (latencyMs) => set({ latencyMs }),

  setConnectionStatus: (connectionStatus, errorMessage) => {
    set({ connectionStatus, errorMessage: errorMessage || null });
  },

  setForfeitWinMessage: (forfeitWinMessage) => {
    set({ forfeitWinMessage });
  },

  leaveRoom: () => {
    set({
      roomCode: null,
      roomName: null,
      opponent: null,
      isHost: false,
      isLocalReady: false,
      remoteStream: null,
      remoteFallbackFrame: null,
      isJoiningRoom: false,
      joinErrorMessage: null,
      forfeitWinMessage: null,
      hostTransferMessage: null,
      netcodeMode: 'offline',
      webrtcConnected: false,
      connectionStatus: 'idle',
      errorMessage: null,
    });
  },

  recordMatchResult: (matchData) => {
    const state = get();
    const newRecord: MatchRecord = {
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      ...matchData,
    };

    const newElo = Math.max(100, state.eloRating + matchData.eloDelta);
    const updatedHistory = [newRecord, ...state.matchHistory.slice(0, 19)];

    if (typeof window !== 'undefined') {
      localStorage.setItem('vibecode_elo', newElo.toString());
      localStorage.setItem('vibecode_history', JSON.stringify(updatedHistory));
    }

    set({
      eloRating: newElo,
      totalMatches: state.totalMatches + 1,
      totalReps: state.totalReps + matchData.myScore,
      matchHistory: updatedHistory,
    });
  },
}));
