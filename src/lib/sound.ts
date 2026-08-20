/**
 * צלילים מסונתזים ב-WebAudio — בלי קבצי אודיו, בלי המתנה לטעינה.
 */
let ctx: AudioContext | null = null;
let enabled = true;

try {
  enabled = localStorage.getItem('shm:sound') !== 'off';
} catch {
  /* ignore */
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
  try {
    localStorage.setItem('shm:sound', v ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  if (v) ac();
}

type ToneOptions = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweepTo?: number;
};

function tone({ freq, duration, type = 'sine', gain = 0.2, delay = 0, sweepTo }: ToneOptions) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise(duration: number, gain = 0.12, delay = 0, filterHz = 1400) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const frames = Math.floor(a.sampleRate * duration);
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterHz;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t0);
}

export const sfx = {
  unlock() {
    ac();
  },
  move() {
    if (!enabled) return;
    noise(0.06, 0.14, 0, 2200);
    tone({ freq: 210, duration: 0.07, type: 'triangle', gain: 0.13, sweepTo: 150 });
  },
  capture() {
    if (!enabled) return;
    noise(0.13, 0.24, 0, 900);
    tone({ freq: 130, duration: 0.14, type: 'square', gain: 0.09, sweepTo: 70 });
  },
  castle() {
    if (!enabled) return;
    noise(0.06, 0.12, 0, 2000);
    noise(0.07, 0.12, 0.09, 1600);
  },
  check() {
    if (!enabled) return;
    tone({ freq: 880, duration: 0.16, type: 'sine', gain: 0.16 });
    tone({ freq: 1320, duration: 0.24, type: 'sine', gain: 0.1, delay: 0.07 });
  },
  win() {
    if (!enabled) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, duration: 0.5, type: 'sine', gain: 0.15, delay: i * 0.1 }),
    );
  },
  lose() {
    if (!enabled) return;
    [440, 349.23, 261.63].forEach((f, i) =>
      tone({ freq: f, duration: 0.55, type: 'sine', gain: 0.14, delay: i * 0.14 }),
    );
  },
  draw() {
    if (!enabled) return;
    [392, 392].forEach((f, i) => tone({ freq: f, duration: 0.4, type: 'sine', gain: 0.13, delay: i * 0.22 }));
  },
  notify() {
    if (!enabled) return;
    tone({ freq: 1046.5, duration: 0.1, type: 'sine', gain: 0.12 });
    tone({ freq: 1396.9, duration: 0.14, type: 'sine', gain: 0.1, delay: 0.09 });
  },
  connect() {
    if (!enabled) return;
    [523.25, 783.99].forEach((f, i) => tone({ freq: f, duration: 0.25, type: 'sine', gain: 0.13, delay: i * 0.11 }));
  },
  disconnect() {
    if (!enabled) return;
    [523.25, 349.23].forEach((f, i) => tone({ freq: f, duration: 0.3, type: 'sine', gain: 0.12, delay: i * 0.11 }));
  },
  tick() {
    if (!enabled) return;
    tone({ freq: 1500, duration: 0.04, type: 'square', gain: 0.05 });
  },
  illegal() {
    if (!enabled) return;
    tone({ freq: 160, duration: 0.12, type: 'sawtooth', gain: 0.07, sweepTo: 110 });
  },
};
