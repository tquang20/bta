/**
 * Vibe Code - Web Audio API Synthesizer & Sensory Haptics
 * Zero external audio assets required; guarantees zero-latency instant feedback.
 */

class SoundFXService {
  private static instance: SoundFXService | null = null;
  private audioCtx: AudioContext | null = null;

  public static getInstance(): SoundFXService {
    if (!SoundFXService.instance) {
      SoundFXService.instance = new SoundFXService();
    }
    return SoundFXService.instance;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Valid Rep chime - alternating frequencies for Left vs Right hand
   */
  public playRepSound(combo: number, isOnFire: boolean, hand?: 'left' | 'right') {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Alternating base tone: Left Hand = crisp E5 (659Hz), Right Hand = resonant A5 (880Hz)
      const baseFreq = hand === 'left' ? 659.25 : hand === 'right' ? 880.0 : 523.25;
      const comboBonus = Math.min(250, combo * 15);
      const freq = baseFreq + comboBonus;

      osc.type = isOnFire ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.3, ctx.currentTime + 0.10);

      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);

      // Trigger tactile haptics on mobile
      this.triggerHaptic(35);
    } catch (e) {}
  }

  /**
   * Invalid rep / combo break error buzz
   */
  public playFailSound() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.28);

      // Distinct invalid haptic pattern: [100ms buzz, 50ms pause, 100ms buzz]
      this.triggerHaptic([100, 50, 100]);
    } catch (e) {}
  }

  /**
   * Countdown tick
   */
  public playCountdownTick(isGo: boolean = false) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = isGo ? 880 : 440;
      const duration = isGo ? 0.35 : 0.15;

      osc.type = isGo ? 'square' : 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);

      this.triggerHaptic(isGo ? [80, 40, 80] : 40);
    } catch (e) {}
  }

  /**
   * Calibration milestone chime
   */
  public playCalibrationComplete() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + i * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.3);
      });

      this.triggerHaptic([60, 40, 60]);
    } catch (e) {}
  }

  /**
   * Victory / Match Finished fanfare
   */
  public playVictoryFanfare() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      });

      this.triggerHaptic([100, 100, 150]);
    } catch (e) {}
  }

  private triggerHaptic(pattern: number | number[]) {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }
}

export const SoundFX = SoundFXService.getInstance();
