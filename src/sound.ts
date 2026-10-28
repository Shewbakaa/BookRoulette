/** Tiny Web Audio synth: no audio files. iOS needs unlock() from a user tap first. */
const MUTE_KEY = 'bookroulette.muted';

function readMuted(): boolean {
  try { return globalThis.localStorage?.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

let ctx: AudioContext | null = null;
let lastTick = 0;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
}

function ready(): AudioContext | null {
  if (sound.muted || !ctx) return null;
  if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {});
  return ctx.state === 'closed' ? null : ctx;
}

function blip(c: AudioContext, freq: number, at: number, dur: number, vol: number, type: OscillatorType, glideTo?: number): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

export const sound = {
  muted: readMuted(),

  /** Call from a tap handler; creates/resumes the context and plays a silent buffer (iOS). */
  unlock(): void {
    const c = getCtx();
    if (!c) return;
    // iOS can leave the context 'interrupted' after calls/backgrounding.
    if (c.state !== 'running' && c.state !== 'closed') void c.resume().catch(() => {});
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    } catch { /* ignore */ }
  },

  /** Short high blip as a card passes the front. Throttled so fast spins don't buzz. */
  tick(): void {
    const c = ready();
    if (!c) return;
    const now = c.currentTime;
    if (now - lastTick < 0.035) return;
    lastTick = now;
    blip(c, 2300 + Math.random() * 250, now, 0.035, 0.09, 'triangle', 1500);
  },

  /** Small rising arpeggio (C major) with a sparkle on top. */
  land(): void {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + 0.01;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(c, f, t + i * 0.085, 0.28, 0.16, 'triangle'));
    blip(c, 2093, t + 0.34, 0.45, 0.05, 'sine');
  },

  toggle(): void {
    sound.muted = !sound.muted;
    try { globalThis.localStorage?.setItem(MUTE_KEY, sound.muted ? '1' : '0'); } catch { /* ignore */ }
  },
};
