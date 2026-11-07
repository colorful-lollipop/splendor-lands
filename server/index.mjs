import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoom, joinRoom, findRoom, roomList, onlineStats, Room } from './rooms.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((info) => info && info.family === 'IPv4' && !info.internal)
    .map((info) => info.address);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()), ...onlineStats() });
});

app.get('/api/rooms', (req, res) => {
  res.json({ rooms: roomList() });
});

if (existsSync(join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { maxAge: '1h', index: false }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.sendFile(join(distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res
      .status(200)
      .type('html')
      .send(
        `<!doctype html><meta charset="utf-8"><title>璀璨宝石</title><body style="background:#14100c;color:#e9d7a8;font-family:serif;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1>璀璨宝石 · Splendor</h1><p>开发模式请访问 <a style="color:#e0a63a" href="http://localhost:5173">http://localhost:5173</a></p><p>或先运行 <code>npm run build</code> 再启动服务器。</p></div></body>`,
      );
  });
}

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });

const HEARTBEAT_MS = 30000;

function safeSend(ws, msg) {
  if (ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    /* ignore */
  }
}

function toast(ws, text, kind = 'error') {
  safeSend(ws, { type: 'toast', kind, text });
}

function attach(ws, room, player) {
  ws.roomCode = room.code;
  ws.playerId = player.id;
  ws.isAlive = true;
  player.socket = ws;
  player.connected = true;
  safeSend(ws, {
    type: 'welcome',
    token: player.token,
    selfId: player.id,
    roomCode: room.code,
    name: player.name,
    reconnect: room.status !== 'lobby',
  });
  room.broadcastRoom();
  if (room.status !== 'lobby' && room.game) {
    const view = room.viewFor(player.id);
    safeSend(ws, { type: 'game', game: view });
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.msgTimes = [];
  ws.roomCode = null;
  ws.playerId = null;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    const now = Date.now();
    ws.msgTimes = ws.msgTimes.filter((t) => now - t < 4000);
    if (ws.msgTimes.length > 40) {
      toast(ws, '操作太频繁，请稍后再试');
      return;
    }
    ws.msgTimes.push(now);

    try {
      switch (msg.type) {
        case 'ping':
          safeSend(ws, { type: 'pong', at: Date.now() });
          return;
        case 'rooms':
          safeSend(ws, { type: 'rooms', rooms: roomList(), stats: onlineStats() });
          return;
        case 'create': {
          if (ws.roomCode) throw new Error('你已经在房间中');
          const { room, player } = createRoom({ maxPlayers: msg.maxPlayers, name: msg.name, socket: ws, avatar: msg.avatar, turnSeconds: msg.turnSeconds });
          attach(ws, room, player);
          room.broadcastRoom();
          return;
        }
        case 'avatar': {
          const room = findRoom(ws.roomCode);
          if (!room) return;
          const player = room.players.get(ws.playerId);
          if (!player) return;
          if (typeof msg.avatar === 'string' && /^[a-z0-9-]{2,24}$/.test(msg.avatar)) {
            player.avatar = msg.avatar;
            const gp = room.game?.players.find((p) => p.id === player.id);
            if (gp) gp.avatar = msg.avatar;
          }
          room.broadcastRoom();
          if (room.game) room.broadcastGame();
          return;
        }
        case 'join': {
          if (ws.roomCode) {
            const current = findRoom(ws.roomCode);
            if (current) {
              const p = current.players.get(ws.playerId);
              if (p && (p.token === msg.token || !msg.token)) {
                // 同一连接重复加入
                if (current.status === 'lobby') {
                  attach(ws, current, p);
                  return;
                }
              }
            }
          }
          const { room, player, reconnected } = joinRoom({
            code: msg.code,
            name: msg.name,
            token: msg.token,
            socket: ws,
            avatar: msg.avatar,
          });
          attach(ws, room, player);
          if (reconnected) toast(ws, '已重新连接', 'info');
          if (room.status === 'playing') room.scheduleTurnTimer();
          return;
        }
        case 'leave': {
          const room = findRoom(ws.roomCode);
          if (!room) return;
          const player = room.players.get(ws.playerId);
          if (!player) return;
          ws.roomCode = null;
          ws.playerId = null;
          player.socket = null;
          room.removePlayer(player.id);
          safeSend(ws, { type: 'left' });
          return;
        }
        case 'roomPublic': {
          const room = findRoom(ws.roomCode);
          if (!room) throw new Error('你不在房间中');
          room.setPublic(ws.playerId, msg.isPublic);
          for (const client of wss.clients) {
            if (client.roomCode) continue;
            safeSend(client, { type: 'rooms', rooms: roomList(), stats: onlineStats() });
          }
          return;
        }
        case 'turnSeconds': {
          const room = findRoom(ws.roomCode);
          if (!room) throw new Error('你不在房间中');
          room.setTurnSeconds(ws.playerId, msg.seconds);
          return;
        }
        case 'start': {
          const room = findRoom(ws.roomCode);
          if (!room) throw new Error('你不在房间中');
          room.start(ws.playerId);
          return;
        }
        case 'rematch': {
          const room = findRoom(ws.roomCode);
          if (!room) throw new Error('你不在房间中');
          room.rematch(ws.playerId);
          return;
        }
        case 'addBot': {
          const room = findRoom(ws.roomCode);
          if (!room) throw new Error('你不在房间中');
          if (room.hostId !== ws.playerId) throw new Error('只有房主可以添加电脑玩家');
          room.addBot(msg.level === 'easy' || msg.level === 'hard' ? msg.level : 'normal');
          return;
        }
        case 'removeBot': {
          const room = findRoom(ws.roomCode);
          if (!room) throw new Error('你不在房间中');
          if (room.hostId !== ws.playerId) throw new Error('只有房主可以操作');
          const bot = room.players.get(msg.playerId);
          if (!bot || !bot.isBot) throw new Error('玩家不存在');
          if (room.status !== 'lobby') throw new Error('游戏进行中不能移除电脑');
          room.removePlayer(bot.id);
          return;
        }
        case 'action': {
          const room = findRoom(ws.roomCode);
          if (!room) throw new Error('你不在房间中');
          room.action(ws.playerId, msg.action || {});
          return;
        }
        case 'chat': {
          const room = findRoom(ws.roomCode);
          if (!room) throw new Error('你不在房间中');
          room.chatMessage(ws.playerId, msg.text);
          return;
        }
        case 'state':
          return;
        default:
          return;
      }
    } catch (err) {
      toast(ws, err?.message || '操作失败');
      if (msg.type === 'join' && msg.token) {
        safeSend(ws, { type: 'sessionExpired' });
      }
    }
  });

  ws.on('close', () => {
    const room = findRoom(ws.roomCode);
    if (!room) return;
    const player = room.players.get(ws.playerId);
    if (!player) return;
    if (player.socket && player.socket !== ws) return; // 已被新连接取代
    player.connected = false;
    player.socket = null;
    room.lastActivity = Date.now();
    room.broadcastRoom();
    if (room.status === 'playing' && room.game) {
      room.maybeRunBot();
    }
  });

  ws.on('error', () => {});
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }
}, HEARTBEAT_MS);
heartbeat.unref?.();

wss.on('close', () => clearInterval(heartbeat));

export { server, wss };

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  端口 ${port} 已被占用：可能已经有一个服务器在运行。`);
      console.error('  先运行 停止游戏.bat，或改用其它端口：$env:PORT=3002; npm start\n');
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, host, () => {
    console.log(`\n  璀璨宝石 · Splendor server`);
    console.log(`  监听：${host}:${port}  (ws: /ws)`);
    console.log(`  本机：http://localhost:${port}`);
    for (const address of lanAddresses()) {
      console.log(`  局域网：http://${address}:${port}`);
    }
    console.log('');
  });
}

// 避免未使用导入告警
void Room;