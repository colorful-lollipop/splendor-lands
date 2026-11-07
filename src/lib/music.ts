/**
 * 程序化生成的酒馆氛围音乐。
 * 不依赖任何音频文件：用 WebAudio 合成鲁特琴般的拨弦、低音弦乐铺底与轻柔手鼓，
 * 在 D 小调五声音阶上即兴循环，营造文艺复兴集市/酒馆的感觉。
 */

type Ctx = AudioContext & { __music?: MusicEngine };

class MusicEngine {
  ctx: AudioContext;
  master: GainNode;
  padGain: GainNode;
  pluckGain: GainNode;
  drumGain: GainNode;
  reverb: ConvolverNode;
  timer: number | null = null;
  nextTime = 0;
  step = 0;
  started = false;

  // D 小调五声：D F G A C
  scale = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25];
  chords = [
    [146.83, 174.61, 220.0], // Dm
    [116.54, 146.83, 174.61], // Bb
    [130.81, 164.81, 196.0], // C
    [110.0, 130.81, 164.81], // A
  ];

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6, 2.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.reverb.connect(wet).connect(this.master);

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.16;
    this.padGain.connect(this.master);
    this.padGain.connect(this.reverb);

    this.pluckGain = ctx.createGain();
    this.pluckGain.gain.value = 0.22;
    this.pluckGain.connect(this.master);
    this.pluckGain.connect(this.reverb);

    this.drumGain = ctx.createGain();
    this.drumGain.gain.value = 0.12;
    this.drumGain.connect(this.master);
    this.drumGain.connect(this.reverb);
  }

  impulse(duration: number, decay: number) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
      }
    }
    return buf;
  }

  start() {
    if (this.started) return;
    this.started = true;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(0.55, now + 3.2);
    this.nextTime = now + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 200);
    this.schedule();
  }

  stop() {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.8);
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.started = false;
  }

  schedule() {
    const ahead = this.ctx.currentTime + 1.2;
    while (this.nextTime < ahead) {
      this.playStep(this.step, this.nextTime);
      this.step += 1;
      this.nextTime += 0.46;
    }
  }

  playStep(step: number, t: number) {
    const bar = Math.floor(step / 8);
    const beat = step % 8;

    // 铺底和弦：每两小节换一次
    if (beat === 0 && bar % 2 === 0) {
      const chord = this.chords[Math.floor(bar / 2) % this.chords.length];
      chord.forEach((f, i) => this.pad(f * (i === 2 ? 2 : 1), t, 4.4));
    }

    // 鲁特琴旋律
    const phrase = [0, 2, 3, 2, 4, 3, 2, 0];
    if (beat % 2 === 0 || Math.random() < 0.22) {
      const idx = phrase[(beat + bar * 3) % phrase.length] + (Math.random() < 0.2 ? 1 : 0);
      const freq = this.scale[Math.min(this.scale.length - 1, Math.max(0, idx))];
      this.pluck(freq, t, 0.55 + Math.random() * 0.2);
      if (Math.random() < 0.35) this.pluck(freq * 2, t + 0.06, 0.18);
    }

    // 低音
    if (beat === 0 || beat === 4) {
      const chord = this.chords[Math.floor(bar / 2) % this.chords.length];
      this.pluck(chord[0] / 2, t, 0.9);
    }

    // 手鼓
    if (beat === 0 || beat === 3 || beat === 6) this.drum(t, beat === 0 ? 0.5 : 0.3);
  }

  pluck(freq: number, t: number, amp: number) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(700, t + 0.4);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(amp, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    osc.connect(filter).connect(gain).connect(this.pluckGain);
    osc.start(t);
    osc.stop(t + 1.2);
  }

  pad(freq: number, t: number, dur: number) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 8;
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 1.2);
    gain.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter).connect(gain).connect(this.padGain);
    osc.start(t);
    osc.stop(t + dur + 0.1);
  }

  drum(t: number, amp: number) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.4;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 180;
    filter.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.value = amp;
    src.connect(filter).connect(gain).connect(this.drumGain);
    src.start(t);
  }
}

let engine: MusicEngine | null = null;
let enabled = true;

function ctxOf(): AudioContext {
  if (!engine) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    (window as unknown as { __splendorAudioCtx?: AudioContext }).__splendorAudioCtx = ctx;
    engine = new MusicEngine(ctx);
  }
  return engine.ctx;
}

export function loadMusicEnabled(): boolean {
  try {
    return localStorage.getItem('splendor-music') !== 'off';
  } catch {
    return true;
  }
}

export function setMusicEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem('splendor-music', on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  if (on) {
    ctxOf();
    void engine!.ctx.resume();
    engine!.start();
  } else {
    engine?.stop();
  }
}

/** 首次用户交互后调用，满足浏览器自动播放策略 */
export function kickMusic() {
  if (!enabled) return;
  ctxOf();
  if (engine!.ctx.state === 'suspended') void engine!.ctx.resume();
  engine!.start();
}

export function musicActive(): boolean {
  return Boolean(engine?.started);
}
