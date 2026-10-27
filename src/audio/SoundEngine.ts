const SOUND_ENABLED_KEY = 'apex-sound-enabled';
const SOUND_VOLUME_KEY = 'apex-sound-volume';

class SoundEngine {
  private ctx: AudioContext | null = null;

  isEnabled(): boolean {
    return localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';
  }

  setEnabled(enabled: boolean): void {
    localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }

  getVolume(): number {
    const raw = Number(localStorage.getItem(SOUND_VOLUME_KEY) ?? '0.5');
    return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
  }

  setVolume(volume: number): void {
    localStorage.setItem(SOUND_VOLUME_KEY, String(Math.max(0, Math.min(1, volume))));
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined' || !this.isEnabled()) return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playUiClick(): void {
    this.tone(720, 420, 0.032, 'triangle', 0.14);
  }

  playRadioBeep(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolume() * 0.22;
    const now = ctx.currentTime;
    this.scheduleNote(ctx, 1380, now, 0.045, 'sine', vol);
    this.scheduleNote(ctx, 1840, now + 0.05, 0.065, 'sine', vol);
  }

  playPitStop(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolume() * 0.2;
    const now = ctx.currentTime;
    this.scheduleNote(ctx, 280, now, 0.09, 'sawtooth', vol);
    this.scheduleNote(ctx, 340, now + 0.11, 0.09, 'sawtooth', vol);
    this.scheduleNote(ctx, 960, now + 0.23, 0.08, 'triangle', vol);
  }

  playFastestLap(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getContext() ? this.getVolume() * 0.2 : 0;
    const now = ctx.currentTime;
    this.scheduleNote(ctx, 587.33, now, 0.08, 'triangle', vol);
    this.scheduleNote(ctx, 880, now + 0.09, 0.14, 'triangle', vol);
  }

  playFlagAlert(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolume() * 0.24;
    const now = ctx.currentTime;
    this.scheduleNote(ctx, 440, now, 0.11, 'square', vol * 0.6);
    this.scheduleNote(ctx, 370, now + 0.13, 0.14, 'square', vol * 0.6);
  }

  playCheckeredFlag(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const vol = this.getVolume() * 0.24;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.scheduleNote(ctx, freq, now + idx * 0.09, 0.18, 'triangle', vol);
    });
  }

  private tone(startFreq: number, endFreq: number, duration: number, type: OscillatorType, baseGain: number): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    gain.gain.setValueAtTime(baseGain * this.getVolume(), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  private scheduleNote(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (volume <= 0.001) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const soundEngine = new SoundEngine();
