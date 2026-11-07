import { createGame, applyAction, sanitizeState, RuleError } from '../shared/rules.mjs';
import { chooseBotAction } from '../shared/bot.mjs';
import { chooseNnAction, nnAvailable, nnThought } from '../shared/nn-bot.mjs';
import { pushLog } from '../shared/rules.mjs';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BOT_NAMES = ['阿尔弗雷德', '薇奥拉', '塞巴斯蒂安', '罗莎琳德', '奥兰多', '米兰达', '费迪南', '贝特丽丝'];
const BOT_NAMES_EASY = ['学徒汉斯', '小贩莉娜', '跑腿汤姆', '学徒米娅', '新手莎拉', '小工杰克', '学徒艾米', '杂役卢卡'];
const BOT_NAMES_HARD = ['大商人科西莫', '银行家富格尔', '议员美第奇', '总督丹多洛', '大公洛伦佐', '会长斯特罗齐', '霸主维斯孔蒂', '巨头巴尔多'];

export const rooms = new Map();

let seq = 0;
const uid = (prefix = 'p') => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function makeCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  throw new Error('无法生成房间号');
}

function safeName(name) {
  const cleaned = String(name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
  return cleaned || '无名商人';
}

function sanitizeChat(text) {
  return String(text || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
}

export class Room {
  constructor({ maxPlayers = 4 } = {}) {
    this.code = makeCode();
    this.maxPlayers = Math.max(2, Math.min(4, Number(maxPlayers) || 4));
    this.createdAt = Date.now();
    this.status = 'lobby';
    this.isPublic = false;
    this.hostId = null;
    this.players = new Map();
    this.game = null;
    this.chat = [];
    this.botTimer = null;
    this.emptySince = Date.now();
    this.lastActivity = Date.now();
    rooms.set(this.code, this);
  }

  get isFull() {
    return this.players.size >= this.maxPlayers;
  }

  addPlayer({ name, socket, isBot = false, id = null, token = null, avatar = 'w1', botLevel = 'normal' }) {
    if (this.isFull) throw new Error('房间已满');
    const player = {
      id: id || uid('p'),
      token: token || uid('t'),
      name: safeName(name),
      avatar: avatar || 'w1',
      isBot,
      botLevel: isBot ? botLevel : undefined,
      socket: isBot ? null : socket,
      connected: isBot || Boolean(socket),
      joinedAt: Date.now(),
    };
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    this.lastActivity = Date.now();
    this.emptySince = null;
    return player;
  }

  addBot(level = 'normal') {
    if (this.isFull || this.status !== 'lobby') throw new Error('现在不能添加电脑');
    const used = new Set([...this.players.values()].map((p) => p.name));
    const base = level === 'easy' ? BOT_NAMES_EASY : level === 'hard' ? BOT_NAMES_HARD : BOT_NAMES;
    const name = base.find((n) => !used.has(n)) || `电脑商人${this.players.size + 1}`;
    const avatars = ['w1', 'w2', 'w3', 'b1', 'b2', 'b3', 'g1', 'g2', 'g3', 'r1', 'r2', 'r3', 'k1', 'k2', 'k3'];
    const avatar = avatars[Math.floor(Math.random() * avatars.length)];
    const bot = this.addPlayer({ name, isBot: true, avatar, botLevel: level });
    this.broadcastRoom();
    return bot;
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    this.players.delete(playerId);
    if (this.hostId === playerId) {
      const next = [...this.players.values()].find((p) => !p.isBot);
      this.hostId = next?.id || [...this.players.values()][0]?.id || null;
    }
    if (this.status === 'playing' && this.game && !this.game.finished) {
      // 游戏中离开：保留座位（由电脑接管）而不是中途破坏游戏
      const gp = this.game.players.find((p) => p.id === playerId);
      if (gp) {
        gp.isBot = true;
        gp.connected = false;
      }
      this.broadcastGame();
      this.maybeRunBot();
    }
    if (this.players.size === 0 || this.humanCount === 0) {
      this.destroy();
      return;
    }
    this.broadcastRoom();
  }

  get humanCount() {
    return [...this.players.values()].filter((p) => !p.isBot).length;
  }

  lobbyPayload() {
    const players = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      botLevel: p.isBot ? p.botLevel || 'normal' : undefined,
      connected: p.connected,
      isHost: p.id === this.hostId,
    }));
    return {
      code: this.code,
      hostId: this.hostId,
      maxPlayers: this.maxPlayers,
      status: this.status,
      isPublic: this.isPublic,
      players,
      chat: this.chat.slice(-40),
      isFull: this.isFull,
    };
  }

  send(player, msg) {
    if (!player?.socket || player.socket.readyState !== 1) return;
    try {
      player.socket.send(JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }

  broadcastRoom() {
    for (const player of this.players.values()) {
      this.send(player, { type: 'room', room: this.lobbyPayload(), selfId: player.id });
    }
  }

  viewFor(playerId) {
    if (!this.game) return null;
    const view = sanitizeState(this.game, playerId);
    const gamePlayer = this.game.players.find((p) => p.id === playerId);
    return {
      ...view,
      roomCode: this.code,
      me: gamePlayer
        ? {
            id: gamePlayer.id,
            name: gamePlayer.name,
            isBot: gamePlayer.isBot,
            avatar: gamePlayer.avatar,
            seat: gamePlayer.seat,
            isHost: gamePlayer.id === this.hostId,
          }
        : null,
      hostId: this.hostId,
      players: view.players.map((p) => {
        const rp = this.players.get(p.id);
        return {
          ...p,
          avatar: rp?.avatar || p.avatar || 'w1',
          isHost: p.id === this.hostId,
          isTurn: p.id === this.game.players[this.game.turn]?.id,
        };
      }),
    };
  }

  broadcastGame() {
    for (const player of this.players.values()) {
      const view = this.viewFor(player.id);
      if (view) this.send(player, { type: 'game', game: view });
    }
  }

  setPublic(hostId, isPublic) {
    if (this.hostId !== hostId) throw new Error('只有房主可以修改房间公开状态');
    if (this.status !== 'lobby') throw new Error('游戏开始后不能修改房间状态');
    this.isPublic = Boolean(isPublic);
    this.broadcastRoom();
    return this.isPublic;
  }

  start(hostId) {
    if (this.status !== 'lobby') throw new Error('游戏已经开始了');
    if (this.hostId !== hostId) throw new Error('只有房主可以开始游戏');
    if (this.players.size < 2) throw new Error('至少需要 2 名玩家');
    const list = [...this.players.values()];
    const startPlayer = Math.floor(Math.random() * list.length);
    this.game = createGame({
      players: list.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, botLevel: p.botLevel, connected: p.connected, avatar: p.avatar })),
      seed: `${this.code}-${Date.now()}`,
      startPlayer,
    });
    this.status = 'playing';
    this.chat = [];
    this.broadcastRoom();
    this.broadcastGame();
    this.maybeRunBot();
  }

  rematch(hostId) {
    if (this.hostId !== hostId) throw new Error('只有房主可以开始新一局');
    this.game = null;
    this.status = 'lobby';
    this.chat = [];
    this.broadcastRoom();
    for (const player of this.players.values()) {
      this.send(player, { type: 'rematch' });
    }
  }

  action(playerId, action) {
    if (this.status !== 'playing' || !this.game) throw new Error('游戏尚未开始');
    const player = this.players.get(playerId);
    if (!player) throw new Error('你不在这个房间中');
    try {
      this.game = applyAction(this.game, playerId, action);
    } catch (err) {
      if (err instanceof RuleError) {
        this.send(player, { type: 'toast', kind: 'error', text: err.message });
        return;
      }
      throw err;
    }
    this.lastActivity = Date.now();
    if (this.game.finished) this.status = 'finished';
    this.broadcastGame();
    if (this.status === 'finished') this.broadcastRoom();
    this.maybeRunBot();
  }

  maybeRunBot() {
    clearTimeout(this.botTimer);
    this.botTimer = null;
    if (this.status !== 'playing' || !this.game || this.game.finished) return;
    const turnPlayer = this.game.players[this.game.turn];
    const pendingId = this.game.pending?.playerId;
    const actorId = this.game.phase === 'action' ? turnPlayer?.id : pendingId;
    if (!actorId) return;
    const roomPlayer = this.players.get(actorId);
    const gamePlayer = this.game.players.find((p) => p.id === actorId);
    const isBot = !roomPlayer || roomPlayer.isBot || !roomPlayer.connected || gamePlayer?.isBot;
    if (!isBot) return;
    this.botTimer = setTimeout(() => {
      this.runBot(actorId);
    }, 850 + Math.random() * 700);
  }

  runBot(playerId) {
    if (this.status !== 'playing' || !this.game || this.game.finished) return;
    const inGame = this.game.players.find((p) => p.id === playerId);
    if (!inGame) return;
    try {
      const level = this.players.get(playerId)?.botLevel || 'normal';
      // 困难电脑优先使用训练好的神经网络策略
      let action = level === 'hard' && nnAvailable() ? chooseNnAction(this.game, playerId, { search: true }) : null;
      const usedNn = Boolean(action);
      if (!action) action = chooseBotAction(this.game, playerId, level);
      if (!action) return;

      // 困难电脑会"说出"它此刻的打算，让玩家感知到对手在谋划什么
      if (usedNn && this.game.phase === 'action') {
        try {
          const thought = nnThought(this.game, playerId);
          if (thought && Math.random() < 0.55) {
            const name = this.players.get(playerId)?.name || '对手';
            pushLog(this.game, playerId, `${name} 暗自盘算：${thought.label}`, 'info');
          }
        } catch {
          /* 思考失败不影响行动 */
        }
      }

      this.game = applyAction(this.game, playerId, action);
    } catch (err) {
      console.warn('[bot] action failed:', err.message);
      // 尝试一个保底动作
      try {
        const colors = ['w', 'b', 'g', 'r', 'k'].filter((c) => this.game.tokens[c] > 0).slice(0, 3);
        const fallback =
          this.game.phase === 'action'
            ? { type: 'take', colors }
            : chooseBotAction(this.game, playerId, this.players.get(playerId)?.botLevel || 'normal');
        if (fallback) this.game = applyAction(this.game, playerId, fallback);
      } catch (err2) {
        console.warn('[bot] fallback failed:', err2.message);
        return;
      }
    }
    if (this.game.finished) this.status = 'finished';
    this.broadcastGame();
    this.maybeRunBot();
  }

  chatMessage(playerId, text) {
    const player = this.players.get(playerId);
    if (!player) return;
    const clean = sanitizeChat(text);
    if (!clean) return;
    const entry = { id: uid('c'), playerId, name: player.name, text: clean, at: Date.now() };
    this.chat.push(entry);
    if (this.chat.length > 60) this.chat.splice(0, this.chat.length - 60);
    for (const p of this.players.values()) this.send(p, { type: 'chat', chat: entry });
  }

  destroy() {
    clearTimeout(this.botTimer);
    rooms.delete(this.code);
  }
}

export function findRoom(code) {
  return rooms.get(String(code || '').toUpperCase().trim());
}

export function createRoom({ maxPlayers, name, socket, avatar }) {
  const room = new Room({ maxPlayers });
  const player = room.addPlayer({ name, socket, avatar });
  room.broadcastRoom();
  return { room, player };
}

export function joinRoom({ code, name, token, socket, avatar }) {
  const room = findRoom(code);
  if (!room) throw new Error('房间不存在，请检查房间号');
  // 重连
  if (token) {
    const existing = [...room.players.values()].find((p) => p.token === token);
    if (existing) {
      if (existing.socket && existing.socket !== socket) {
        try {
          existing.socket.close();
        } catch {
          /* ignore */
        }
      }
      existing.socket = socket;
      existing.connected = true;
      if (name) existing.name = safeName(name);
      if (avatar) existing.avatar = avatar;
      room.emptySince = null;
      return { room, player: existing, reconnected: true };
    }
  }
  if (room.status !== 'lobby') throw new Error('游戏已经开始了，无法加入');
  if (room.isFull) throw new Error('房间已满');
  const player = room.addPlayer({ name, socket, avatar });
  room.broadcastRoom();
  return { room, player, reconnected: false };
}

export function roomList() {
  return [...rooms.values()]
    .filter((r) => r.status === 'lobby' && r.humanCount > 0 && r.isPublic)
    .map((r) => ({
      code: r.code,
      host: [...r.players.values()].find((p) => p.id === r.hostId)?.name || '—',
      players: r.players.size,
      maxPlayers: r.maxPlayers,
      status: r.status,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
}

export function onlineStats() {
  let players = 0;
  let playing = 0;
  for (const room of rooms.values()) {
    players += room.humanCount;
    if (room.status === 'playing') playing += 1;
  }
  return { rooms: rooms.size, players, playing };
}

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const humans = [...room.players.values()].filter((p) => !p.isBot);
    const anyOnline = humans.some((p) => p.connected);
    if (anyOnline) {
      room.emptySince = null;
      continue;
    }
    if (!room.emptySince) room.emptySince = now;
    if (now - room.emptySince > 30 * 60 * 1000) room.destroy();
  }
}, 60 * 1000).unref?.();