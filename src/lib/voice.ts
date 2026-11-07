/**
 * 可扩展的角色语音系统。
 *
 * 设计要点：
 * 1. `VoicePlugin` 是一个插件接口：只需要实现 `speak(event, ctx)` 返回一句台词。
 *    内置的 `classic` 插件用浏览器 SpeechSynthesis 合成（无音频文件依赖），
 *    以后想接真人录音 / 服务器 TTS，只要 `registerVoicePlugin(另一个插件)` 即可。
 * 2. 音色由角色头像派生（pitch/rate 抖动），所以同一个角色每次说话音色一致，
 *    不同角色之间音色不同 —— 形成"人物感"。
 * 3. 事件由游戏层触发：拿宝石、买卡、预订、贵族来访、轮到自己、胜负。
 */

export type VoiceEvent =
  | 'take'
  | 'buy'
  | 'reserve'
  | 'noble'
  | 'turn'
  | 'win'
  | 'lose'
  | 'error'
  | 'greet';

export interface VoiceContext {
  /** 说话的角色（玩家名 + 头像 key，头像用来推导音色） */
  speaker?: { name: string; avatar?: string };
  /** 追加信息，例如卡名、贵族名 */
  detail?: string;
  /** 贵族来访时传入贵族 id，用于选专属台词 */
  nobleId?: string;
}

export interface VoiceLine {
  text: string;
  /** 0.5 - 2，覆盖默认音高 */
  pitch?: number;
  /** 0.6 - 1.6 */
  rate?: number;
  /** 语音性别倾向（仅提示插件，浏览器实现不区分） */
  tone?: 'female' | 'male' | 'neutral';
}

export interface VoicePlugin {
  id: string;
  name: string;
  desc: string;
  speak(event: VoiceEvent, ctx: VoiceContext): VoiceLine | null;
}

const plugins = new Map<string, VoicePlugin>();
let activeId = 'classic';

export function registerVoicePlugin(plugin: VoicePlugin) {
  plugins.set(plugin.id, plugin);
}

export function listVoicePlugins(): VoicePlugin[] {
  return [...plugins.values()];
}

export function setVoicePlugin(id: string) {
  if (plugins.has(id)) activeId = id;
}

export function getVoicePlugin(): VoicePlugin | undefined {
  return plugins.get(activeId);
}

/* ------------------------------------------------------------------ *
 * 内置插件：classic
 * ------------------------------------------------------------------ */

const NOBLE_LINES: Record<string, string[]> = {
  mary: ['苏格兰的玛丽，向你致意。', '王冠与宝石，都归于一室。'],
  suleiman: ['苏莱曼大帝，赏识你的远见。', '帝国的宝库，为你敞开。'],
  machiavelli: ['马基雅维利，欣赏你的手腕。', '权谋与宝石，同样精妙。'],
  isabella: ['伊莎贝拉女王，认可你的勤勉。', '卡斯蒂利亚的荣光，与你同在。'],
  henry: ['亨利八世，愿与你共谋大业。', '英格兰的金库，需要你这样的人才。'],
  catherine: ['凯瑟琳王后，垂青你的品味。', '美第奇的血脉，懂得何为珍贵。'],
  anne: ['布列塔尼的安妮，向你微笑。', '女公爵的宫廷，欢迎有识之士。'],
  elisabeth: ['奥地利的伊丽莎白，向你点头。', '法兰西的王后，记住了你的名字。'],
  francis: ['弗朗索瓦国王，愿你位列朝堂。', '法兰西的骑士，也需要宝石。'],
  charles: ['查理五世，与你结成同盟。', '神圣罗马的皇帝，认可你的实力。'],
};

const LINES = {
  take: ['这几枚，我收下了。', '宝石在手，天下我有。', '一枚一枚，都要算清。', '好颜色，先到先得。'],
  buy: ['这笔买卖，成交。', '这张卡，正合我意。', '工匠归我了。', '又一位能人为我效劳。'],
  reserve: ['这张，我先留着。', '预订一手，免得被人抢了。', '黄金在手，后会有期。'],
  turn: ['轮到我了。', '该我出手了。', '轮到本商人说话了。'],
  win: ['荣耀归于我！', '这一局，我赢得漂亮。', '全欧洲最耀眼的珠宝商，是我。'],
  lose: ['这一局，你更胜一筹。', '下次再来。', '输赢常在，牌桌不散。'],
  error: ['这一步走不通。', '不可，不可。', '规则不允许。'],
  greet: ['愿宝石与你同在。', '来一局？', '入席吧，商人。'],
};

/** 由头像 key 稳定派生的音色参数 */
function voiceOf(avatar = 'w1') {
  let h = 0;
  for (let i = 0; i < avatar.length; i += 1) h = (h * 31 + avatar.charCodeAt(i)) % 9973;
  const genderHint = /^[wbg]/.test(avatar) ? 0 : 1; // 白/蓝/绿偏轻，红/黑偏低
  return {
    pitch: 0.82 + (h % 47) / 100 + genderHint * 0.12,
    rate: 0.92 + ((h >> 3) % 20) / 100,
  };
}

function pick(list: string[], seed: number) {
  return list[Math.abs(seed) % list.length];
}

export const classicVoice: VoicePlugin = {
  id: 'classic',
  name: '说书人（浏览器合成）',
  desc: '无需下载音频，用人声合成朗读角色台词，音色随角色头像变化。',
  speak(event, ctx) {
    const av = ctx.speaker?.avatar || 'w1';
    const v = voiceOf(av);
    if (event === 'noble') {
      const pool = (ctx.nobleId && NOBLE_LINES[ctx.nobleId]) || ['贵族来访，愿为你效力。'];
      return { text: pick(pool, (ctx.detail || '').length + av.length), pitch: 0.86, rate: 0.9, tone: 'neutral' };
    }
    const pool = LINES[event as keyof typeof LINES];
    if (!pool) return null;
    const base = pick(pool, av.charCodeAt(1) + event.length + (ctx.detail?.length || 0));
    const text = ctx.detail && event === 'buy' ? `${ctx.detail}。${base}` : base;
    return { text, pitch: v.pitch, rate: v.rate };
  },
};

registerVoicePlugin(classicVoice);

/* ------------------------------------------------------------------ *
 * 播放层
 * ------------------------------------------------------------------ */

let enabled = false;
let volume = 0.85;
let synth: SpeechSynthesis | null = null;
let zhVoice: SpeechSynthesisVoice | null = null;
const queue: VoiceLine[] = [];
let speaking = false;

function ensureSynth() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (!synth) {
    synth = window.speechSynthesis;
    const load = () => {
      const voices = synth!.getVoices();
      zhVoice =
        voices.find((v) => /zh[-_]CN|Chinese|Mandarin|Xiaoxiao|Yunxi/i.test(v.lang + v.name)) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('zh')) ||
        null;
    };
    load();
    synth.addEventListener?.('voiceschanged', load);
  }
  return synth;
}

export function loadVoiceEnabled(): boolean {
  try {
    return localStorage.getItem('splendor-voice') === 'on';
  } catch {
    return false;
  }
}

export function setVoiceEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem('splendor-voice', on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  if (!on) {
    queue.length = 0;
    synth?.cancel();
    speaking = false;
  } else {
    ensureSynth();
  }
}

export function voiceEnabled() {
  return enabled;
}

export function setVoiceVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
}

export function speak(event: VoiceEvent, ctx: VoiceContext = {}) {
  if (!enabled) return;
  const s = ensureSynth();
  if (!s) return;
  const plugin = getVoicePlugin();
  if (!plugin) return;
  const line = plugin.speak(event, ctx);
  if (!line || !line.text) return;
  queue.push(line);
  if (queue.length > 4) queue.shift();
  if (!speaking) drain();
}

function drain() {
  const s = ensureSynth();
  if (!s) return;
  const line = queue.shift();
  if (!line) {
    speaking = false;
    return;
  }
  speaking = true;
  const u = new SpeechSynthesisUtterance(line.text);
  u.lang = zhVoice?.lang || 'zh-CN';
  if (zhVoice) u.voice = zhVoice;
  u.volume = volume;
  u.pitch = Math.max(0.4, Math.min(2, line.pitch ?? 1));
  u.rate = Math.max(0.6, Math.min(1.8, line.rate ?? 1));
  u.onend = () => drain();
  u.onerror = () => drain();
  s.speak(u);
}

/** 首次用户手势后解锁语音（部分浏览器要求） */
export function unlockVoice() {
  if (!enabled) return;
  const s = ensureSynth();
  if (s && s.paused) s.resume();
}
