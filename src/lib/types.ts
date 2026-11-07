export type Color = 'w' | 'b' | 'g' | 'r' | 'k';
export type TokenColor = Color | 'gold';
export type Phase = 'action' | 'noble' | 'discard' | 'finished';

export type Tokens = Record<TokenColor, number>;
export type Bonuses = Record<Color, number>;

export interface CardData {
  id: string;
  tier: 1 | 2 | 3;
  bonus: Color;
  points: number;
  art: string;
  name: string;
  cost: Record<Color, number>;
}

export interface NobleData {
  id: string;
  name: string;
  nameEn: string;
  title: string;
  points: number;
  art: string;
  cost: Record<Color, number>;
}

export interface LogEntry {
  id: string;
  playerId: string | null;
  text: string;
  kind: 'system' | 'info' | 'action' | 'turn' | 'noble' | 'end';
  at: number;
}

export interface PlayerView {
  id: string;
  name: string;
  avatar: string;
  seat: number;
  isBot: boolean;
  botLevel?: 'easy' | 'normal' | 'hard';
  connected: boolean;
  isHost: boolean;
  isTurn: boolean;
  points: number;
  tokens: Tokens;
  bonuses: Bonuses;
  cards: string[];
  cardCount: number;
  nobles: string[];
  reserved: string[];
  reservedCount: number;
  reservedHidden: { tier: number }[];
}

export type BoardSource =
  | { kind: 'board'; tier: number; index: number }
  | { kind: 'deck'; tier: number }
  | { kind: 'reserved'; cardId: string };

export type GameAction =
  | { type: 'take'; colors: Color[] }
  | { type: 'reserve'; source: { kind: 'board'; tier: number; index: number } | { kind: 'deck'; tier: number } }
  | { type: 'buy'; source: { kind: 'board'; tier: number; index: number } | { kind: 'reserved'; cardId: string } }
  | { type: 'chooseNoble'; nobleId: string }
  | { type: 'returnTokens'; tokens: Partial<Tokens> };

export interface PendingState {
  type: 'noble' | 'discard';
  playerId: string;
  options?: string[];
  mustReturn?: number;
}

export interface GameView {
  seed: string;
  playerCount: number;
  decks: Record<string, number>;
  board: Record<string, (string | null)[]>;
  nobles: string[];
  tokens: Tokens;
  players: PlayerView[];
  turn: string | null;
  startPlayerId: string | null;
  phase: Phase;
  pending: PendingState | null;
  turnCount: number;
  round: number;
  endTriggered: boolean;
  finished: boolean;
  winners: string[];
  log: LogEntry[];
  lastAction: { playerId: string; text: string; at: number } | null;
  createdAt: number;
  you: { id: string; seat: number } | null;
  canAct: boolean;
  roomCode: string;
  me: { id: string; name: string; isBot: boolean; seat: number; isHost: boolean; avatar?: string } | null;
  hostId: string;
}

export type BotLevel = 'easy' | 'normal' | 'hard';

export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  botLevel?: BotLevel;
  connected: boolean;
  isHost: boolean;
}

export interface ChatEntry {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'finished';
  isPublic: boolean;
  players: RoomPlayer[];
  chat: ChatEntry[];
  isFull: boolean;
}

export interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

export type ArtSkin = 'legend' | 'glass' | 'anime';
export type GemSkin = 'faceted' | 'coin' | 'crystal' | 'rune';
export type BackSkin = 'emerald' | 'crimson' | 'astral';
export type TableSkin = 'tavern' | 'astral' | 'velvet' | 'ember';
export type FrameSkin = 'gilded' | 'jade' | 'frost' | 'abyss';
export type NobleSkin = 'oil' | 'glass';

export interface SkinSettings {
  frame: FrameSkin;
  art: ArtSkin;
  gems: GemSkin;
  back: BackSkin;
  table: TableSkin;
  noble: NobleSkin;
  avatar: string;
}