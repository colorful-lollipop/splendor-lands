let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem('splendor-sfx', value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadSfxEnabled(): boolean {
  try {
    const raw = localStorage.getItem('splendor-sfx');
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

function getCtx(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, volume: number, slideTo?: number) {
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime + start;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

export type SfxKind = 'click' | 'gem' | 'buy' | 'error' | 'turn' | 'win' | 'noble';

export function sfx(kind: SfxKind) {
  if (!enabled) return;
  switch (kind) {
    case 'click':
      tone(520, 0, 0.05, 'triangle', 0.045, 380);
      break;
    case 'gem':
      tone(780, 0, 0.09, 'sine', 0.06);
      tone(1170, 0.045, 0.12, 'sine', 0.045);
      break;
    case 'buy':
      tone(392, 0, 0.14, 'triangle', 0.07);
      tone(523, 0.07, 0.16, 'triangle', 0.06);
      tone(784, 0.14, 0.22, 'sine', 0.05);
      break;
    case 'noble':
      tone(523, 0, 0.2, 'sine', 0.06);
      tone(659, 0.12, 0.22, 'sine', 0.055);
      tone(880, 0.25, 0.35, 'sine', 0.05);
      break;
    case 'error':
      tone(180, 0, 0.16, 'sawtooth', 0.035, 120);
      break;
    case 'turn':
      tone(440, 0, 0.16, 'sine', 0.05);
      tone(660, 0.12, 0.25, 'sine', 0.045);
      break;
    case 'win':
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.4, 'sine', 0.055 - i * 0.004));
      break;
  }
}