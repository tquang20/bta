import { io, Socket } from 'socket.io-client';
import { useRoomStore, OpponentPlayer } from '../../store/useRoomStore';
import { useGameStore } from '../../store/useGameStore';

const SESSION_TOKEN_KEY = 'king_of_aura_session_token';

function getSessionToken(): string {
  if (typeof window === 'undefined') return 'server-render-session';
  let token = window.localStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = `${crypto.randomUUID()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}

export interface GamePacket {
  type: 'score_sync' | 'ping' | 'pong';
  score: number;
  combo: number;
  reps: number;
  invalidReps: number;
  activeHand?: 'left' | 'right';
  timestamp: number;
}

export class RoomClient {
  private static instance: RoomClient | null = null;
  private socket: Socket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isInitiator: boolean = false;
  private pingInterval: any = null;
  private cameraRelayInterval: any = null;
  private frameCanvas: HTMLCanvasElement | null = null;
  private roomListListeners: Array<(rooms: any[]) => void> = [];

  public static getInstance(): RoomClient {
    if (!RoomClient.instance) {
      RoomClient.instance = new RoomClient();
    }
    return RoomClient.instance;
  }

  public connect(): Socket {
    if (!this.socket) {
      useRoomStore.getState().setConnectionStatus('connecting');

      // Connect to same origin with fast reconnect fallback
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 20,
        reconnectionDelay: 800,
        timeout: 10000,
      });

      this.setupSocketEvents();
    } else if (!this.socket.connected) {
      useRoomStore.getState().setConnectionStatus('connecting');
      this.socket.connect();
    }

    return this.socket;
  }

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    useRoomStore.getState().setLocalStream(stream);

    // If PeerConnection is active, attach local video and audio tracks
    if (this.peerConnection && stream) {
      try {
        const senders = this.peerConnection.getSenders();
        stream.getTracks().forEach((track) => {
          const alreadySending = senders.some((s) => s.track === track);
          if (!alreadySending) {
            this.peerConnection!.addTrack(track, stream);
          }
        });

        // Trigger renegotiation offer if connection is stable
        if (this.peerConnection.signalingState === 'stable') {
          this.renegotiate();
        }
      } catch (err) {
        console.warn('[Vibe Code WebRTC] Error adding local stream tracks:', err);
      }
    }
  }

  public startCameraRelay(videoElement: HTMLVideoElement) {
    if (this.cameraRelayInterval) clearInterval(this.cameraRelayInterval);
    if (!this.frameCanvas) {
      this.frameCanvas = document.createElement('canvas');
      this.frameCanvas.width = 160;
      this.frameCanvas.height = 120;
    }

    this.cameraRelayInterval = setInterval(() => {
      // If WebRTC direct video is already connected and active, skip socket relay to save bandwidth
      if (useRoomStore.getState().webrtcConnected && useRoomStore.getState().remoteStream) {
        return;
      }
      const roomCode = useRoomStore.getState().roomCode;
      if (!roomCode || !this.socket || !this.socket.connected) return;

      if (videoElement && videoElement.readyState >= 2) {
        try {
          const ctx = this.frameCanvas?.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoElement, 0, 0, 160, 120);
            const frame = this.frameCanvas?.toDataURL('image/jpeg', 0.5);
            if (frame) {
              this.socket.emit('camera:frame', { frame });
            }
          }
        } catch (e) {
          // ignore frame capture error
        }
      }
    }, 125); // 8 frames/sec fallback
  }

  public stopCameraRelay() {
    if (this.cameraRelayInterval) {
      clearInterval(this.cameraRelayInterval);
      this.cameraRelayInterval = null;
    }
  }

  private setupSocketEvents() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      useRoomStore.getState().setConnectionStatus('connected');
      this.startPingLoop();

      // Refresh the lobby list whenever a tab connects or reconnects.
      this.socket?.emit('rooms:list');

      // Auto-reconnect & restore active room on server to survive tab-sleep or server reload
      const currentCode = useRoomStore.getState().roomCode;
      const username = useRoomStore.getState().username;
      const duration = useGameStore.getState().matchDuration;
      if (currentCode && this.socket) {
        this.socket.emit('room:reconnect', {
          code: currentCode,
          username,
          duration,
          sessionToken: getSessionToken(),
        });
      }
    });

    this.socket.on('disconnect', () => {
      useRoomStore.getState().setConnectionStatus('disconnected');
      this.cleanupWebRTC();
    });

    this.socket.on('room:session_replaced', () => {
      useRoomStore.getState().leaveRoom();
      useRoomStore.getState().setJoinErrorMessage('Phiên phòng này đã được kết nối lại ở một tab khác.');
    });

    this.socket.on('room:closed', ({ message }: { code: string; message: string }) => {
      useRoomStore.getState().leaveRoom();
      useRoomStore.getState().setJoinErrorMessage(message || 'Phòng đã đóng.');
    });

    this.socket.on('connect_error', (err) => {
      useRoomStore.getState().setConnectionStatus('error', err.message);
    });

    this.socket.on('room:created', ({ room, playerId }: { room: any; playerId: string }) => {
      useRoomStore.getState().setIsJoiningRoom(false);
      useRoomStore.getState().setRoomData(room.code, playerId, true, room.name);
      useRoomStore.getState().setIsLocalReady(false);
      useGameStore.getState().setMatchDuration(room.duration);
      this.isInitiator = true;
    });

    this.socket.on('room:joined', ({ room, playerId, isHost }: { room: any; playerId: string; isHost?: boolean }) => {
      useRoomStore.getState().setIsJoiningRoom(false);
      const computedIsHost = typeof isHost === 'boolean' ? isHost : room.hostId === playerId;
      useRoomStore.getState().setRoomData(room.code, playerId, computedIsHost, room.name);
      useRoomStore.getState().setIsLocalReady(false);
      useGameStore.getState().setMatchDuration(room.duration);
      this.isInitiator = computedIsHost;

      // Extract opponent if already in room
      const otherPlayers = Object.values(room.players).filter((p: any) => p.id !== playerId);
      if (otherPlayers.length > 0) {
        useRoomStore.getState().setOpponent(otherPlayers[0] as OpponentPlayer);
        // Start WebRTC negotiation
        this.initWebRTC();
      } else {
        useRoomStore.getState().setOpponent(null);
      }
    });

    this.socket.on('rooms:list_updated', ({ rooms }: { rooms: any[] }) => {
      this.roomListListeners.forEach((cb) => cb(rooms));
    });

    this.socket.on('rooms:list_result', ({ rooms }: { rooms: any[] }) => {
      this.roomListListeners.forEach((cb) => cb(rooms));
    });

    this.socket.on('room:host_transferred', ({ newHostId, newHostUsername, message }: { newHostId: string; newHostUsername: string; message: string }) => {
      const myId = useRoomStore.getState().playerId;
      const isNowHost = myId === newHostId;
      useRoomStore.getState().setIsHost(isNowHost);
      this.isInitiator = isNowHost;
      useRoomStore.getState().setHostTransferMessage(message);
      console.log(`[Host Transferred] New host: ${newHostUsername} (me: ${isNowHost})`);
    });

    this.socket.on('room:player_left', ({ playerId }: { playerId: string }) => {
      const myId = useRoomStore.getState().playerId;
      if (playerId !== myId) {
        useRoomStore.getState().setOpponent(null);
        useRoomStore.getState().setRemoteStream(null);
        useRoomStore.getState().setRemoteFallbackFrame(null);
        this.cleanupWebRTC();
      }
    });

    this.socket.on('room:updated', ({ room }: { room: any }) => {
      const myId = useRoomStore.getState().playerId;
      if (!myId || !room) return;

      // Always synchronize isHost with server authority
      const isNowHost = room.hostId === myId;
      if (useRoomStore.getState().isHost !== isNowHost) {
        useRoomStore.getState().setIsHost(isNowHost);
        this.isInitiator = isNowHost;
        console.log(`[Host Status Synced] isHost is now: ${isNowHost}`);
      }

      if (room.players && room.players[myId]) {
        useRoomStore.getState().setIsLocalReady(room.players[myId].isReady);
      }

      const otherPlayers = Object.values(room.players || {}).filter((p: any) => p.id !== myId);
      if (otherPlayers.length > 0) {
        const opp = otherPlayers[0] as OpponentPlayer;
        useRoomStore.getState().setOpponent(opp);

        // If WebRTC is not initialized yet or renegotiation is needed
        if (!this.peerConnection) {
          this.initWebRTC();
        } else if (this.isInitiator && this.peerConnection.signalingState === 'stable') {
          this.renegotiate();
        }
      } else {
        useRoomStore.getState().setOpponent(null);
        useRoomStore.getState().setRemoteStream(null);
        useRoomStore.getState().setRemoteFallbackFrame(null);
        this.cleanupWebRTC();
      }

      if (room.duration) {
        useGameStore.getState().setMatchDuration(room.duration);
      }
    });

    this.socket.on('room:countdown_start', ({ startsIn }: { startsIn: number }) => {
      useGameStore.getState().startCountdown(startsIn);
    });

    this.socket.on('room:countdown_tick', ({ count }: { count: number }) => {
      useGameStore.getState().setCountdownValue(count);
    });

    this.socket.on('room:game_start', ({ duration }: { duration: number }) => {
      useGameStore.getState().startGame(duration);
    });

    // In-game opponent forfeit: The remaining player immediately wins!
    this.socket.on('match:opponent_forfeit', ({ message, winnerId }: { message: string; winnerId: string }) => {
      const myId = useRoomStore.getState().playerId;
      if (myId === winnerId) {
        useRoomStore.getState().setForfeitWinMessage(message);
        useGameStore.getState().winByOpponentForfeit();
      }
    });

    this.socket.on('room:game_over', () => {
      useGameStore.getState().endGame();
    });

    this.socket.on('room:error', ({ message, code }: { message: string; code?: string }) => {
      useRoomStore.getState().setIsJoiningRoom(false);
      useRoomStore.getState().setJoinErrorMessage(message);
      useRoomStore.getState().setConnectionStatus('error', message);
      if (code === 'ROOM_NOT_FOUND' || code === 'ROOM_CLOSED') {
        useRoomStore.getState().leaveRoom();
        useRoomStore.getState().setJoinErrorMessage(message);
      }
    });

    // Real-time camera snapshot fallback from opponent
    this.socket.on('camera:frame', ({ frame }: { frame: string }) => {
      useRoomStore.getState().setRemoteFallbackFrame(frame);
    });

    // WebSocket fallback for rep updates if WebRTC data channel is not active
    this.socket.on('game:peer_update', (data: any) => {
      if (useRoomStore.getState().netcodeMode !== 'webrtc') {
        useRoomStore.getState().updateOpponentScore(data);
      }
    });

    // WebRTC Signaling Relay
    this.socket.on('webrtc:signal', async ({ senderId, signal }: { senderId: string; signal: any }) => {
      this.handleWebRtcSignal(signal);
    });
  }

  // WebRTC P2P Data Channel + MediaStream Camera Video Initialization
  private initWebRTC() {
    try {
      const config: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      };

      this.peerConnection = new RTCPeerConnection(config);

      // Handle receiving opponent's real-time camera stream
      this.peerConnection.ontrack = (event) => {
        const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
        useRoomStore.getState().setRemoteStream(stream);
      };

      // Attach our local video track if available
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection?.addTrack(track, this.localStream!);
        });
      }

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.socket) {
          this.socket.emit('webrtc:signal', {
            signal: { candidate: event.candidate },
          });
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        if (state === 'connected') {
          useRoomStore.getState().setNetcodeMode('webrtc');
          useRoomStore.getState().setWebRtcConnected(true);
        } else if (state === 'disconnected' || state === 'failed') {
          useRoomStore.getState().setNetcodeMode('websocket');
          useRoomStore.getState().setWebRtcConnected(false);
        }
      };

      if (this.isInitiator) {
        // Host creates the data channel
        this.dataChannel = this.peerConnection.createDataChannel('game_twitch_channel', {
          ordered: false, // low latency twitch packet mode (like UDP)
          maxRetransmits: 0,
        });
        this.setupDataChannel(this.dataChannel);

        this.peerConnection.createOffer().then((offer) => {
          this.peerConnection?.setLocalDescription(offer);
          this.socket?.emit('webrtc:signal', {
            signal: { sdp: offer },
          });
        });
      } else {
        // Peer receives the data channel
        this.peerConnection.ondatachannel = (event) => {
          this.dataChannel = event.channel;
          this.setupDataChannel(this.dataChannel);
        };
      }
    } catch (err) {
      console.warn('[Vibe Code WebRTC] P2P initialization fallback to WebSocket:', err);
      useRoomStore.getState().setNetcodeMode('websocket');
    }
  }

  public async renegotiate() {
    if (!this.peerConnection || !this.socket) return;
    try {
      if (this.peerConnection.signalingState !== 'stable') return;
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.socket.emit('webrtc:signal', { signal: { sdp: this.peerConnection.localDescription } });
    } catch (err) {
      console.warn('[Vibe Code WebRTC] Renegotiation error:', err);
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      useRoomStore.getState().setNetcodeMode('webrtc');
      useRoomStore.getState().setWebRtcConnected(true);
    };

    channel.onclose = () => {
      useRoomStore.getState().setNetcodeMode('websocket');
      useRoomStore.getState().setWebRtcConnected(false);
    };

    channel.onmessage = (event) => {
      try {
        const packet: GamePacket = JSON.parse(event.data);
        if (packet.type === 'score_sync') {
          useRoomStore.getState().updateOpponentScore({
            score: packet.score,
            combo: packet.combo,
            reps: packet.reps,
            invalidReps: packet.invalidReps,
            activeHand: packet.activeHand,
          });

          // Calculate one-way latency
          const latency = Math.max(1, Math.round(Date.now() - packet.timestamp));
          useRoomStore.getState().setLatency(latency);
        }
      } catch (e) {
        // Ignore corrupted packet
      }
    };
  }

  private async handleWebRtcSignal(signal: any) {
    if (!this.peerConnection) {
      this.initWebRTC();
    }

    try {
      if (signal.sdp) {
        await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        // Flush pending queued ICE candidates now that remote description is set
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          if (cand && this.peerConnection) {
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {}
          }
        }

        if (signal.sdp.type === 'offer') {
          const answer = await this.peerConnection?.createAnswer();
          if (answer) {
            await this.peerConnection?.setLocalDescription(answer);
            this.socket?.emit('webrtc:signal', {
              signal: { sdp: answer },
            });
          }
        }
      } else if (signal.candidate) {
        if (this.peerConnection?.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          this.pendingCandidates.push(signal.candidate);
        }
      }
    } catch (err) {
      console.warn('[Vibe Code WebRTC] Signaling error, falling back to WebSocket:', err);
      useRoomStore.getState().setNetcodeMode('websocket');
    }
  }

  private cleanupWebRTC() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.pendingCandidates = [];
    useRoomStore.getState().setWebRtcConnected(false);
    useRoomStore.getState().setRemoteStream(null);
  }

  private startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      const start = Date.now();
      if (this.socket && this.socket.connected) {
        this.socket.volatile.emit('ping_check', () => {
          const rtt = Date.now() - start;
          useRoomStore.getState().setLatency(Math.round(rtt / 2));
        });
      }
    }, 5000);
  }

  // Broadcast twitch score packets
  public sendScoreUpdate(
    score: number,
    combo: number,
    reps: number,
    invalidReps: number,
    activeHand?: 'left' | 'right'
  ) {
    const packet: GamePacket = {
      type: 'score_sync',
      score,
      combo,
      reps,
      invalidReps,
      activeHand,
      timestamp: Date.now(),
    };

    // Prefer WebRTC Data Channel (5ms latency)
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(packet));
        return;
      } catch (e) {
        // Fallback to socket if write failed
      }
    }

    // Fallback to WebSocket
    if (this.socket && this.socket.connected) {
      this.socket.emit('game:rep_update', { score, combo, reps, invalidReps, activeHand });
    }
  }

  // Room Actions
  public onRoomListUpdated(callback: (rooms: any[]) => void): () => void {
    this.roomListListeners.push(callback);
    return () => {
      this.roomListListeners = this.roomListListeners.filter((cb) => cb !== callback);
    };
  }

  public fetchRoomList() {
    const sock = this.connect();
    if (sock.connected) {
      sock.emit('rooms:list');
    } else {
      sock.once('connect', () => sock.emit('rooms:list'));
    }
  }

  public createRoom(username: string, duration: number, roomName?: string) {
    useRoomStore.getState().setIsJoiningRoom(true);
    useRoomStore.getState().setJoinErrorMessage(null);
    const sock = this.connect();
    const payload = { username, duration, roomName, sessionToken: getSessionToken() };
    if (sock.connected) {
      sock.emit('room:create', payload);
    } else {
      sock.once('connect', () => {
        sock.emit('room:create', payload);
      });
    }

    setTimeout(() => {
      if (useRoomStore.getState().isJoiningRoom) {
        useRoomStore.getState().setJoinErrorMessage('Hết thời gian khởi tạo phòng. Vui lòng thử lại!');
      }
    }, 8000);
  }

  public joinRoom(code: string, username: string) {
    const formatted = (code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!formatted || formatted.length !== 4) {
      useRoomStore.getState().setJoinErrorMessage('Mã phòng phải gồm 4 ký tự.');
      return;
    }
    useRoomStore.getState().setIsJoiningRoom(true);
    useRoomStore.getState().setJoinErrorMessage(null);
    const sock = this.connect();
    if (sock.connected) {
      sock.emit('room:join', { code: formatted, username, sessionToken: getSessionToken() });
    } else {
      sock.once('connect', () => {
        sock.emit('room:join', { code: formatted, username, sessionToken: getSessionToken() });
      });
    }

    setTimeout(() => {
      if (useRoomStore.getState().isJoiningRoom) {
        useRoomStore.getState().setJoinErrorMessage('Hết thời gian kết nối tới phòng. Vui lòng kiểm tra lại mã hoặc thử lại!');
      }
    }, 8000);
  }

  public leaveRoom() {
    this.stopCameraRelay();
    this.cleanupWebRTC();
    this.socket?.emit('room:leave');
    useRoomStore.getState().leaveRoom();
  }

  public setDuration(duration: number) {
    this.socket?.emit('room:set_duration', { duration });
  }

  public notifyCalibrated(dArm: number, dTorso: number) {
    this.socket?.emit('player:calibrated', { dArm, dTorso });
  }

  public setReady(isReady: boolean) {
    useRoomStore.getState().setIsLocalReady(isReady);
    this.socket?.emit('player:ready', { isReady });
  }

  public startGame() {
    this.socket?.emit('room:start_game');
  }

  public transferHost(targetId?: string) {
    this.socket?.emit('room:transfer_host', { targetId });
  }

  public notifyGameOver() {
    this.socket?.emit('game:over');
  }

  public requestRematch() {
    this.socket?.emit('game:rematch');
  }
}
