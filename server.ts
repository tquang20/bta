import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server, Socket } from 'socket.io';
import dotenv from 'dotenv';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Socket IDs are ephemeral. Rooms are kept in memory for fast access and
// persisted with stable session tokens so a dev reload/server restart does
// not invalidate a room code that is still visible to users.
const ROOMS_FILE = path.join(__dirname, 'rooms-store.json');
const activeRooms: Record<string, Room> = {};

function loadRooms(): Record<string, Room> {
  return activeRooms;
}

function saveRooms(roomsObj: Record<string, Room>) {
  try {
    const cleanObj: Record<string, any> = {};
    for (const [code, room] of Object.entries(roomsObj)) {
      room.lastActivity = Date.now();
      cleanObj[code] = {
        code: room.code,
        name: room.name,
        hostId: room.hostId,
        duration: room.duration,
        status: room.status,
        startedAt: room.startedAt,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity,
        players: room.players,
      };
    }
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(cleanObj, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Room Store] Failed to persist rooms:', error);
  }
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

app.use(express.json());

interface PlayerState {
  id: string;
  sessionToken: string;
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
  latencyMs?: number;
}

interface Room {
  code: string;
  name: string;
  hostId: string;
  duration: number;
  status: 'lobby' | 'calibrating' | 'countdown' | 'playing' | 'gameover';
  startedAt?: number;
  createdAt: number;
  players: Record<string, PlayerState>;
  lastActivity?: number;
}

restoreRooms();

function restoreRooms() {
  try {
    if (!fs.existsSync(ROOMS_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf-8'));
    const now = Date.now();
    for (const [code, room] of Object.entries(parsed || {})) {
      const candidate = room as Room;
      if (!candidate || candidate.code !== code || !candidate.players) continue;
      // Abandoned rooms should not survive forever, but normal reloads keep
      // the invite code valid long enough for both browsers to reconnect.
      if (now - (candidate.lastActivity || candidate.createdAt || now) > 30 * 60 * 1000) continue;
      activeRooms[code] = candidate;
    }
  } catch (error) {
    console.error('[Room Store] Failed to restore rooms:', error);
  }
}

function broadcastRoomList() {
  const rooms = loadRooms();
  const activeList = Object.values(rooms).map((r) => ({
    code: r.code,
    name: r.name || `Phòng của ${r.players[r.hostId]?.username || 'Chủ Phòng'}`,
    hostUsername: r.players[r.hostId]?.username || 'Chủ Phòng',
    playerCount: Object.keys(r.players).length,
    status: r.status,
    duration: r.duration,
    createdAt: r.createdAt,
  }));
  io.emit('rooms:list_updated', { rooms: activeList });
}

app.get('/api/rooms', (_req, res) => {
  const rooms = loadRooms();
  const activeList = Object.values(rooms).map((r) => ({
    code: r.code,
    name: r.name || `Phòng của ${r.players[r.hostId]?.username || 'Chủ Phòng'}`,
    hostUsername: r.players[r.hostId]?.username || 'Chủ Phòng',
    playerCount: Object.keys(r.players).length,
    status: r.status,
    duration: r.duration,
    createdAt: r.createdAt,
  }));
  res.json({ rooms: activeList });
});

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function createPlayer(socket: Socket, username: string, sessionToken: string): PlayerState {
  return {
    id: socket.id,
    sessionToken,
    username: username.trim() || 'Người chơi',
    score: 0,
    combo: 0,
    maxCombo: 0,
    reps: 0,
    invalidReps: 0,
    isReady: false,
    isCalibrated: false,
    dArm: 0,
    dTorso: 0,
  };
}

function roomError(socket: Socket, message: string, code: string) {
  socket.emit('room:error', { message, code });
}

function emitRoomUpdated(room: Room) {
  io.to(room.code).emit('room:updated', { room });
  broadcastRoomList();
}

io.on('connection', (socket: Socket) => {
  let currentRoomCode: string | null = null;

  const leaveCurrentRoom = (isExplicitLeave = false) => {
    const rooms = loadRooms();
    const roomCode = currentRoomCode;
    currentRoomCode = null;
    socket.data.roomCode = null;

    if (roomCode && rooms[roomCode]) {
      const room = rooms[roomCode];
      // An old socket can disconnect after a session has been reattached to a
      // new socket. It must not remove the new socket's player entry.
      if (!room.players[socket.id]) return;

      delete room.players[socket.id];
      socket.leave(roomCode);

      const remainingPlayers = Object.keys(room.players);
      if (remainingPlayers.length === 0) {
        delete rooms[roomCode];
        console.log(`[Room Purge] Room ${roomCode} deleted immediately (0 players left)`);
        io.to(roomCode).emit('room:closed', {
          code: roomCode,
          message: 'Phòng đã đóng vì không còn người chơi.',
        });
        broadcastRoomList();
      } else {
        if (room.status === 'playing' || room.status === 'countdown') {
          room.status = 'gameover';
          io.to(roomCode).emit('match:opponent_forfeit', {
            leaverId: socket.id,
            winnerId: remainingPlayers[0],
            message: 'Đối thủ đã thoát phòng! Bạn lập tức giành CHIẾN THẮNG TUYỆT ĐỐI (Victory by Forfeit)!',
          });
        }

        const wasHost = room.hostId === socket.id;
        if (wasHost || !room.players[room.hostId]) {
          const newHostId = remainingPlayers[0];
          room.hostId = newHostId;
          const newHostUsername = room.players[newHostId]?.username || 'Chủ Phòng';
          console.log(`[Host Transfer] Room ${roomCode}: Host ${socket.id} left. Transferred host to ${newHostId} (${newHostUsername})`);

          io.to(roomCode).emit('room:host_transferred', {
            newHostId,
            newHostUsername,
            message: `Chủ phòng đã thoát. Bạn hiện là Chủ Phòng mới và có quyền Bắt Đầu trận đấu!`,
          });
        }

        saveRooms(rooms);
        io.to(roomCode).emit('room:player_left', { playerId: socket.id });
        emitRoomUpdated(room);
      }
    }
  };

  socket.on('room:leave', () => {
    leaveCurrentRoom(true);
  });

  socket.on('rooms:list', () => {
    const rooms = loadRooms();
    const list = Object.values(rooms).map((r) => ({
      code: r.code,
      name: r.name || `Phòng của ${r.players[r.hostId]?.username || 'Chủ Phòng'}`,
      hostUsername: r.players[r.hostId]?.username || 'Chủ Phòng',
      playerCount: Object.keys(r.players).length,
      status: r.status,
      duration: r.duration,
      createdAt: r.createdAt,
    }));
    socket.emit('rooms:list_result', { rooms: list });
  });

  socket.on('room:reconnect', ({
    code,
    username,
    duration = 30,
    sessionToken,
  }: {
    code: string;
    username: string;
    duration?: number;
    sessionToken?: string;
  }) => {
    const formattedCode = (code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!formattedCode || formattedCode.length !== 4 || !sessionToken) {
      roomError(socket, 'Phiên phòng không hợp lệ. Vui lòng tham gia lại bằng mã phòng.', 'INVALID_SESSION');
      return;
    }

    const rooms = loadRooms();
    const room = rooms[formattedCode];
    if (!room) {
      roomError(socket, 'Phòng không còn tồn tại. Hãy tạo hoặc tham gia một phòng mới.', 'ROOM_NOT_FOUND');
      return;
    }

    const existingEntry = Object.entries(room.players).find(([, player]) => player.sessionToken === sessionToken);
    if (!existingEntry && Object.keys(room.players).length >= 2) {
      roomError(socket, `Phòng "${room.name || formattedCode}" đã đủ 2 người chơi.`, 'ROOM_FULL');
      return;
    }

    if (existingEntry) {
      const [oldSocketId, oldPlayer] = existingEntry;
      if (oldSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        oldSocket?.emit('room:session_replaced', { code: formattedCode });
        oldSocket?.disconnect(true);
        delete room.players[oldSocketId];
        if (room.hostId === oldSocketId) room.hostId = socket.id;
      }
      room.players[socket.id] = {
        ...oldPlayer,
        id: socket.id,
        sessionToken,
        username: username.trim() || oldPlayer.username,
      };
    } else {
      room.players[socket.id] = createPlayer(socket, username || 'Người chơi', sessionToken);
    }

    if (!room.players[room.hostId]) room.hostId = socket.id;
    saveRooms(rooms);
    currentRoomCode = formattedCode;
    socket.data.roomCode = formattedCode;
    socket.data.sessionToken = sessionToken;
    socket.join(formattedCode);
    socket.emit('room:joined', { room, playerId: socket.id, isHost: room.hostId === socket.id });
    emitRoomUpdated(room);
  });

  socket.on('room:create', ({
    username,
    duration = 30,
    roomName,
    sessionToken,
  }: {
    username: string;
    duration: number;
    roomName?: string;
    sessionToken?: string;
  }) => {
    leaveCurrentRoom(true);

    if (!sessionToken) {
      roomError(socket, 'Không thể tạo phòng vì thiếu mã phiên người chơi.', 'INVALID_SESSION');
      return;
    }

    const rooms = loadRooms();
    let code = generateRoomCode();
    while (rooms[code]) {
      code = generateRoomCode();
    }

    const hostName = (username || '').trim() || 'Chủ Phòng';
    const finalRoomName = (roomName || '').trim() || `Phòng của ${hostName}`;

    const room: Room = {
      code,
      name: finalRoomName,
      hostId: socket.id,
      duration,
      status: 'lobby',
      createdAt: Date.now(),
      players: {
        [socket.id]: createPlayer(socket, hostName, sessionToken),
      },
    };

    rooms[code] = room;
    saveRooms(rooms);
    currentRoomCode = code;
    socket.data.roomCode = code;
    socket.data.sessionToken = sessionToken;
    socket.join(code);

    socket.emit('room:created', { room, playerId: socket.id });
    broadcastRoomList();
  });

  socket.on('room:join', ({ code, username, sessionToken }: { code: string; username: string; sessionToken?: string }) => {
    leaveCurrentRoom(true);

    const formattedCode = (code || '').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    if (!formattedCode || formattedCode.length !== 4) {
      roomError(socket, 'Mã phòng phải gồm đúng 4 ký tự chữ và số!', 'INVALID_ROOM_CODE');
      return;
    }
    if (!sessionToken) {
      roomError(socket, 'Không thể tham gia phòng vì thiếu mã phiên người chơi.', 'INVALID_SESSION');
      return;
    }

    const rooms = loadRooms();
    const room = rooms[formattedCode];
    if (!room) {
      roomError(socket, 'Phòng không tồn tại hoặc đã đóng. Hãy tải lại danh sách phòng.', 'ROOM_NOT_FOUND');
      return;
    }

    const currentPlayers = Object.keys(room.players);
    const existingEntry = Object.entries(room.players).find(([, player]) => player.sessionToken === sessionToken);
    if (currentPlayers.length >= 2 && !existingEntry) {
      roomError(socket, `Phòng "${room.name || formattedCode}" đã đủ 2 người chơi (tối đa 2 người đối kháng).`, 'ROOM_FULL');
      return;
    }

    if (existingEntry) {
      const [oldSocketId, oldPlayer] = existingEntry;
      if (oldSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        oldSocket?.emit('room:session_replaced', { code: formattedCode });
        oldSocket?.disconnect(true);
        delete room.players[oldSocketId];
        if (room.hostId === oldSocketId) room.hostId = socket.id;
      }
      room.players[socket.id] = {
        ...oldPlayer,
        id: socket.id,
        sessionToken,
        username: (username || '').trim() || oldPlayer.username,
      };
    } else {
      room.players[socket.id] = createPlayer(
        socket,
        (username || '').trim() || (currentPlayers.length === 0 ? 'Chủ Phòng' : 'Người Thách Đấu'),
        sessionToken,
      );
    }

    if (!room.hostId || !room.players[room.hostId]) {
      room.hostId = socket.id;
    }

    saveRooms(rooms);
    currentRoomCode = formattedCode;
    socket.data.roomCode = formattedCode;
    socket.data.sessionToken = sessionToken;
    socket.join(formattedCode);

    socket.emit('room:joined', { room, playerId: socket.id, isHost: room.hostId === socket.id });
    emitRoomUpdated(room);
  });

  socket.on('room:transfer_host', ({ targetId }: { targetId?: string }) => {
    if (!currentRoomCode) return;
    const rooms = loadRooms();
    const room = rooms[currentRoomCode];
    if (!room || room.hostId !== socket.id) return;

    const playerIds = Object.keys(room.players);
    const newHostId = targetId && room.players[targetId] ? targetId : playerIds.find((id) => id !== socket.id);
    if (newHostId && room.players[newHostId]) {
      room.hostId = newHostId;
      const newHostUsername = room.players[newHostId]?.username || 'Chủ Phòng';
      console.log(`[Host Manual Transfer] Room ${currentRoomCode}: Host transferred to ${newHostId} (${newHostUsername})`);

      saveRooms(rooms);
      io.to(currentRoomCode).emit('room:host_transferred', {
        newHostId: room.hostId,
        newHostUsername,
        message: `Chủ phòng đã chuyển giao quyền chủ phòng cho ${newHostUsername}!`,
      });
      io.to(currentRoomCode).emit('room:updated', { room });
      broadcastRoomList();
    }
  });

  socket.on('room:set_duration', ({ duration }: { duration: number }) => {
    if (!currentRoomCode) return;
    const rooms = loadRooms();
    const room = rooms[currentRoomCode];
    if (!room || room.hostId !== socket.id) return;
    room.duration = duration;
    saveRooms(rooms);
    io.to(currentRoomCode).emit('room:updated', { room });
  });

  socket.on('player:calibrated', ({ dArm, dTorso }: { dArm: number; dTorso: number }) => {
    if (!currentRoomCode) return;
    const rooms = loadRooms();
    const room = rooms[currentRoomCode];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].isCalibrated = true;
    room.players[socket.id].dArm = dArm;
    room.players[socket.id].dTorso = dTorso;
    saveRooms(rooms);
    io.to(currentRoomCode).emit('room:updated', { room });
  });

  socket.on('player:ready', ({ isReady }: { isReady: boolean }) => {
    if (!currentRoomCode) return;
    const rooms = loadRooms();
    const room = rooms[currentRoomCode];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].isReady = isReady;
    saveRooms(rooms);
    io.to(currentRoomCode).emit('room:updated', { room });
  });

  socket.on('room:start_game', () => {
    if (!currentRoomCode) return;
    const rooms = loadRooms();
    const room = rooms[currentRoomCode];
    if (!room) return;

    // Self-healing host check: If hostId is invalid or not in room.players, assign first player
    if (!room.players[room.hostId]) {
      const pids = Object.keys(room.players);
      if (pids.length > 0) {
        room.hostId = pids[0];
        saveRooms(rooms);
        io.to(currentRoomCode).emit('room:host_transferred', {
          newHostId: room.hostId,
          newHostUsername: room.players[room.hostId]?.username || 'Chủ Phòng',
          message: 'Tự động khôi phục quyền chủ phòng cho người chơi.',
        });
        io.to(currentRoomCode).emit('room:updated', { room });
      }
    }

    if (room.hostId !== socket.id) {
      socket.emit('room:error', {
        message: 'Chỉ chủ phòng mới có quyền bấm Bắt Đầu trận đấu!',
      });
      return;
    }

    const playersList = Object.values(room.players);
    if (playersList.length < 2) {
      socket.emit('room:error', {
        message: 'Cần đủ 2 người chơi trong phòng để bắt đầu trận đấu đối kháng!',
      });
      return;
    }

    const allReady = playersList.every((p) => p.isReady);
    if (!allReady) {
      socket.emit('room:error', {
        message: 'Cả hai người chơi đều phải bấm SẴN SÀNG trước khi chủ phòng bấm Bắt Đầu!',
      });
      return;
    }

    room.status = 'countdown';
    saveRooms(rooms);
    const roomCodeTarget = currentRoomCode;
    io.to(roomCodeTarget).emit('room:countdown_start', { startsIn: 3 });

    setTimeout(() => {
      const rMap = loadRooms();
      const r = rMap[roomCodeTarget];
      if (r && r.status === 'countdown') {
        io.to(roomCodeTarget).emit('room:countdown_tick', { count: 2 });
      }
    }, 1000);

    setTimeout(() => {
      const rMap = loadRooms();
      const r = rMap[roomCodeTarget];
      if (r && r.status === 'countdown') {
        io.to(roomCodeTarget).emit('room:countdown_tick', { count: 1 });
      }
    }, 2000);

    setTimeout(() => {
      const rMap = loadRooms();
      const activeRoom = rMap[roomCodeTarget];
      if (activeRoom && activeRoom.status === 'countdown') {
        activeRoom.status = 'playing';
        activeRoom.startedAt = Date.now();
        saveRooms(rMap);
        io.to(roomCodeTarget).emit('room:countdown_tick', { count: 0 });
        io.to(roomCodeTarget).emit('room:game_start', {
          duration: activeRoom.duration,
          startedAt: activeRoom.startedAt,
        });
      }
    }, 3000);
  });

  socket.on('camera:frame', ({ frame }: { frame: string }) => {
    if (!currentRoomCode) return;
    socket.to(currentRoomCode).emit('camera:frame', {
      senderId: socket.id,
      frame,
    });
  });

  socket.on(
    'game:rep_update',
    (data: {
      score: number;
      combo: number;
      reps: number;
      invalidReps: number;
      activeHand?: 'left' | 'right';
      reason?: string;
    }) => {
      if (!currentRoomCode) return;
      const rooms = loadRooms();
      const room = rooms[currentRoomCode];
      if (!room || !room.players[socket.id]) return;

      const player = room.players[socket.id];
      player.score = data.score;
      player.combo = data.combo;
      player.maxCombo = Math.max(player.maxCombo, data.combo);
      player.reps = data.reps;
      player.invalidReps = data.invalidReps;
      saveRooms(rooms);

      socket.to(currentRoomCode).emit('game:peer_update', {
        playerId: socket.id,
        ...data,
        timestamp: Date.now(),
      });
    }
  );

  socket.on('game:over', () => {
    if (!currentRoomCode) return;
    const rooms = loadRooms();
    const room = rooms[currentRoomCode];
    if (!room) return;

    room.status = 'gameover';
    saveRooms(rooms);
    io.to(currentRoomCode).emit('room:game_over', { room });
  });

  socket.on('game:rematch', () => {
    if (!currentRoomCode) return;
    const rooms = loadRooms();
    const room = rooms[currentRoomCode];
    if (!room) return;

    room.status = 'lobby';
    for (const pid of Object.keys(room.players)) {
      room.players[pid].score = 0;
      room.players[pid].combo = 0;
      room.players[pid].reps = 0;
      room.players[pid].invalidReps = 0;
      room.players[pid].isReady = false;
    }

    saveRooms(rooms);
    io.to(currentRoomCode).emit('room:updated', { room });
  });

  socket.on('webrtc:signal', ({ targetId, signal }: { targetId?: string; signal: any }) => {
    if (!currentRoomCode) return;
    const rooms = loadRooms();
    const room = rooms[currentRoomCode];
    if (!room) return;

    if (targetId) {
      io.to(targetId).emit('webrtc:signal', {
        senderId: socket.id,
        signal,
      });
    } else {
      socket.to(currentRoomCode).emit('webrtc:signal', {
        senderId: socket.id,
        signal,
      });
    }
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(false);
  });
});

async function startServer() {
  const distPath = path.join(__dirname, 'dist');
  const distIndexPath = path.join(distPath, 'index.html');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distIndexPath);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback in case a route isn't handled by vite.middlewares
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexHtmlPath = path.join(__dirname, 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
          const rawHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
          const transformedHtml = await vite.transformIndexHtml(url, rawHtml);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(transformedHtml);
        } else {
          next();
        }
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexPath);
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[King of aura] Server running on port ${PORT} (${isProd ? 'production' : 'vite-middleware dev mode'})`);
  });
}

startServer().catch((err) => {
  console.error('[King of aura] Failed to start server:', err);
});
