import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class FakeCtx {
  state = 'suspended';
  currentTime = 0;
  destination = {};
  resume = vi.fn(() => { this.state = 'running'; return Promise.resolve(); });
  createBufferSource = () => ({ connect: vi.fn(), start: vi.fn(), buffer: null });
  createBuffer = () => ({});
}

describe('sound.unlock on iPhone', () => {
  const nav = navigator as unknown as { audioSession?: { type: string } };

  beforeEach(() => {
    vi.resetModules();
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
  });
  afterEach(() => {
    delete nav.audioSession;
  });

  it('asks for the playback audio session so the silent switch does not mute it', async () => {
    nav.audioSession = { type: 'auto' };
    const { sound } = await import('./sound');
    sound.unlock();
    expect(nav.audioSession.type).toBe('playback');
  });

  it('still unlocks where audioSession is not supported', async () => {
    const { sound } = await import('./sound');
    expect(() => sound.unlock()).not.toThrow();
  });
});
