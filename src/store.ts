import { useSyncExternalStore } from 'react';
import { net, type NetMessage, type NetStatus } from './lib/net';
import { loadSkins, saveSkins, applySkins } from './lib/skins';
import { loadSfxEnabled, setSfxEnabled, sfx } from './lib/sfx';
import { kickMusic, loadMusicEnabled, setMusicEnabled } from './lib/music';
import { loadVoiceEnabled, setVoiceEnabled, speak, unlockVoice } from './lib/voice';
import { loadCollection, mergeCollection, saveCollection } from './lib/collection';
import type { ChatEntry, GameAction, GameView, RoomState, SkinSettings, ToastItem } from './lib/types';

export interface RoomSummary {
  code: string;
  host: string;
  players: number;
  maxPlayers: number;
  status: string;
  createdAt: number;
}

interface Session {
  code: string;
  token: string;
  name: string;
}

interface StoreState {
  status: NetStatus;
  screen: 'lobby' | 'room' | 'game';
  name: string;
  selfId: string | null;
  session: Session | null;
  room: RoomState | null;
  game: GameView | null;
  chat: ChatEntry[];
  rooms: RoomSummary[];
  stats: { rooms: number; players: number; playing: number } | null;
  toasts: ToastItem[];
  skins: SkinSettings;
  sfxOn: boolean;
  musicOn: boolean;
  voiceOn: boolean;
  skinsOpen: boolean;
  rulesOpen: boolean;
  collectionOpen: boolean;
  unlockedCards: string[];
  pending: boolean;
  autoReconnecting: boolean;
  selectedGems: string[];
}

const NAME_KEY = 'splendor-name';
const SESSION_KEY = 'splendor-session';

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.code && parsed?.token) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function writeSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

let toastSeq = 0;
let initialized = false;

let state: StoreState = {
  status: 'connecting',
  screen: 'lobby',
  name: readName(),
  selfId: null,
  session: readSession(),
  room: null,
  game: null,
  chat: [],
  rooms: [],
  stats: null,
  toasts: [],
  skins: loadSkins(),
  sfxOn: loadSfxEnabled(),
  musicOn: loadMusicEnabled(),
  voiceOn: loadVoiceEnabled(),
  skinsOpen: false,
  rulesOpen: false,
  collectionOpen: false,
  unlockedCards: loadCollection(),
  pending: false,
  autoReconnecting: Boolean(readSession()),
  selectedGems: [],
};

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function getState() {
  return state;
}

function set(patch: Partial<StoreState>, replace = false) {
  state = replace ? ({ ...patch } as StoreState) : { ...state, ...patch };
  emit();
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useStore<T>(selector: (s: StoreState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export function notify(text: string, kind: ToastItem['kind'] = 'info') {
  const id = ++toastSeq;
  set({ toasts: [...state.toasts, { id, text, kind }] });
  if (kind === 'error') sfx('error');
  window.setTimeout(() => {
    set({ toasts: state.toasts.filter((t) => t.id !== id) });
  }, 3400);
}

export function updateName(name: string) {
  const clean = name.slice(0, 16);
  set({ name: clean });
  try {
    localStorage.setItem(NAME_KEY, clean);
  } catch {
    /* ignore */
  }
}

export function updateSkins(skins: SkinSettings) {
  set({ skins });
  applySkins(skins);
  saveSkins(skins);
}

export function toggleSfx() {
  const next = !state.sfxOn;
  setSfxEnabled(next);
  set({ sfxOn: next });
  if (next) sfx('click');
}

export function toggleVoice() {
  const next = !state.voiceOn;
  setVoiceEnabled(next);
  set({ voiceOn: next });
  if (next) {
    unlockVoice();
    speak('greet');
  }
}

export function toggleMusic() {
  const next = !state.musicOn;
  setMusicEnabled(next);
  set({ musicOn: next });
}

/** 首次点击/触摸后启动背景音乐（浏览器自动播放策略要求用户手势） */
export function armMusic() {
  if (!state.musicOn) return;
  kickMusic();
}

export function openSkins(open = true) {
  set({ skinsOpen: open });
}

export function openRules(open = true) {
  set({ rulesOpen: open });
}

export function openCollection(open = true) {
  set({ collectionOpen: open });
}

export function setSelectedGems(colors: string[]) {
  set({ selectedGems: colors });
}

export function clearChat() {
  set({ chat: [] });
}

function clearSessionState() {
  writeSession(null);
  set({
    session: null,
    selfId: null,
    room: null,
    game: null,
    screen: 'lobby',
    chat: [],
    pending: false,
    autoReconnecting: false,
    selectedGems: [],
  });
}

function handleMessage(msg: NetMessage) {
  switch (msg.type) {
    case 'welcome': {
      const session: Session = {
        code: msg.roomCode,
        token: msg.token,
        name: msg.name || state.name,
      };
      writeSession(session);
      set({
        session,
        selfId: msg.selfId,
        name: msg.name || state.name,
        autoReconnecting: false,
        pending: false,
      });
      break;
    }
    case 'room': {
      const room = msg.room as RoomState;
      const patch: Partial<StoreState> = {
        room,
        screen: room.status === 'lobby' ? 'room' : state.screen,
        pending: false,
        autoReconnecting: false,
      };
      if (room.status === 'lobby') {
        patch.game = null;
        patch.screen = 'room';
      }
      if (Array.isArray(room.chat)) patch.chat = room.chat;
      set(patch);
      break;
    }
    case 'game': {
      const game = msg.game as GameView;
      const session: Session | null = state.session
        ? { ...state.session, code: game.roomCode }
        : state.selfId
          ? { code: game.roomCode, token: '', name: state.name }
          : state.session;
      if (session) writeSession(session);

      // 只有自己实际购入的发展卡才会永久收录；保留但未购买的卡不计入图鉴。
      const viewerId = game.me?.id || state.selfId;
      const purchased = game.players.find((p) => p.id === viewerId)?.cards || [];
      const unlockedCards = mergeCollection(state.unlockedCards, purchased);
      const newCards = purchased.filter((id) => !state.unlockedCards.includes(id));
      if (newCards.length > 0) saveCollection(unlockedCards);

      set({
        game,
        screen: 'game',
        session: session || state.session,
        selfId: viewerId,
        unlockedCards,
        pending: false,
        autoReconnecting: false,
        selectedGems: [],
      });
      if (newCards.length > 0) notify(`图鉴新收录 ${newCards.length} 张发展卡`, 'success');
      break;
    }
    case 'chat': {
      const entry = msg.chat as ChatEntry;
      if (!entry || state.chat.some((c) => c.id === entry.id)) break;
      set({ chat: [...state.chat, entry].slice(-80) });
      break;
    }
    case 'toast': {
      notify(msg.text, msg.kind === 'error' ? 'error' : msg.kind || 'info');
      if (state.pending && msg.kind === 'error') set({ pending: false, autoReconnecting: false });
      break;
    }
    case 'left': {
      clearSessionState();
      break;
    }
    case 'sessionExpired': {
      writeSession(null);
      set({
        session: null,
        selfId: null,
        room: null,
        game: null,
        screen: 'lobby',
        chat: [],
        pending: false,
        autoReconnecting: false,
      });
      notify('之前的房间已关闭，已返回大厅', 'info');
      break;
    }
    case 'rematch': {
      set({ game: null, screen: 'room', chat: [] });
      break;
    }
    case 'rooms': {
      set({ rooms: msg.rooms || [], stats: msg.stats || null });
      break;
    }
    case 'pong':
      break;
    default:
      break;
  }
}

export function initStore() {
  if (initialized) return;
  initialized = true;
  applySkins(state.skins);
  net.onMessage = handleMessage;
  net.onStatus = (status) => {
    set({ status });
    if (status === 'open') {
      if (state.session) {
        net.send({ type: 'join', code: state.session.code, token: state.session.token, name: state.name });
      }
    }
  };
  net.connect();
  requestRooms();
  window.setTimeout(() => {
    if (state.autoReconnecting) set({ autoReconnecting: false });
  }, 6000);
  window.setInterval(() => {
    if (state.screen === 'lobby') requestRooms();
  }, 15000);

  const unlock = () => {
    armMusic();
    unlockVoice();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
  window.addEventListener('touchstart', unlock, { once: false, passive: true });
}

export function requestRooms() {
  net.send({ type: 'rooms' });
  fetch('/api/rooms')
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data.rooms)) set({ rooms: data.rooms });
    })
    .catch(() => {});
}

export function createRoom(maxPlayers = 4) {
  const name = state.name.trim();
  if (!name) {
    notify('请先输入你的名字', 'error');
    return;
  }
  set({ pending: true });
  net.send({ type: 'create', name, maxPlayers, avatar: state.skins.avatar });
}

export function joinRoom(code: string) {
  const name = state.name.trim();
  if (!name) {
    notify('请先输入你的名字', 'error');
    return;
  }
  const clean = code.trim().toUpperCase();
  if (clean.length !== 4) {
    notify('房间号应为 4 位字母或数字', 'error');
    return;
  }
  set({ pending: true });
  net.send({ type: 'join', code: clean, name, avatar: state.skins.avatar });
}

export function leaveRoom() {
  net.send({ type: 'leave' });
  clearSessionState();
}

export function startGame() {
  net.send({ type: 'start' });
}

export function sendAction(action: GameAction) {
  net.send({ type: 'action', action });
}

export function sendChat(text: string) {
  const clean = text.trim().slice(0, 200);
  if (!clean) return;
  net.send({ type: 'chat', text: clean });
}

export function addBot(level: 'easy' | 'normal' | 'hard' = 'normal') {
  net.send({ type: 'addBot', level });
}

export function removeBot(playerId: string) {
  net.send({ type: 'removeBot', playerId });
}

export function rematch() {
  net.send({ type: 'rematch' });
}

/** 房主开关：是否把房间放进大厅公开列表。默认私密。 */
export function setRoomPublic(isPublic: boolean) {
  net.send({ type: 'roomPublic', isPublic });
}

/** 房主设置每回合限时（秒），0 为不限。 */
export function setTurnSeconds(seconds: number) {
  net.send({ type: 'turnSeconds', seconds });
}

export function updateAvatar(avatar: string) {
  updateSkins({ ...state.skins, avatar });
  if (state.room || state.game) net.send({ type: 'avatar', avatar });
}

/** 开发调试：仅在 dev 环境暴露，用于预览各种界面状态。 */
export function devPatchGame(patch: Partial<GameView>) {
  if (!state.game) return;
  set({ game: { ...state.game, ...patch } });
}

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__splendorDev = {
    getState,
    devPatchGame,
    openSkins,
    openRules,
    music: () => {
      const ctx = (window as unknown as { __splendorAudioCtx?: AudioContext }).__splendorAudioCtx;
      return ctx ? { state: ctx.state, time: ctx.currentTime } : null;
    },
  };
}