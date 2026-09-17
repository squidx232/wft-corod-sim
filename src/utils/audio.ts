/**
 * Industrial Audio Synthesizer for Weatherford COROD Simulator
 * Uses native Web Audio API with safe lazy initialization on user gesture.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true; // Safe default
  private isInitialized: boolean = false;
  
  // Continuous Nodes
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private hydraulicOsc: OscillatorNode | null = null;
  private hydraulicGain: GainNode | null = null;

  // Real recorded engine-noise loop (MP3). Preferred over the synthesized
  // oscillator when available; falls back to the oscillator if it can't load.
  private engineAudioEl: HTMLAudioElement | null = null;
  private engineAudioReady = false;
  private engineAudioFailed = false;

  private ensureEngineAudio(): HTMLAudioElement | null {
    if (this.engineAudioFailed) return null;
    if (this.engineAudioEl) return this.engineAudioEl;
    if (typeof Audio === 'undefined') return null;
    try {
      const el = new Audio('/sounds/engine-loop.mp3');
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      el.addEventListener('canplaythrough', () => { this.engineAudioReady = true; });
      el.addEventListener('error', () => { this.engineAudioFailed = true; });
      this.engineAudioEl = el;
      return el;
    } catch {
      this.engineAudioFailed = true;
      return null;
    }
  }

  private initContext(): boolean {
    if (this.isMuted) return false;
    try {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.isInitialized = !!this.ctx;
      return this.isInitialized;
    } catch {
      return false;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      // Pause the recorded engine loop and silence synth nodes.
      if (this.engineAudioEl && !this.engineAudioEl.paused) {
        try { this.engineAudioEl.pause(); } catch { /* noop */ }
      }
      if (this.ctx) {
        try {
          if (this.engineGain) this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
          if (this.hydraulicGain) this.hydraulicGain.gain.setValueAtTime(0, this.ctx.currentTime);
        } catch {
          // Safe catch
        }
      }
    } else {
      this.initContext();
    }
  }

  public updateEngineSound(running: boolean, rpm: number, ptoEngaged: boolean) {
    if (this.isMuted) return;

    // Prefer the real recorded engine loop (MP3).
    const el = this.ensureEngineAudio();
    if (el && !this.engineAudioFailed) {
      try {
        if (!running) {
          // Fade out then pause.
          el.volume = 0;
          if (!el.paused) el.pause();
          return;
        }
        // Louder under load (PTO engaged); pitch/speed rises with rpm.
        const targetVol = ptoEngaged ? 0.55 : 0.4;
        el.volume = Math.max(0, Math.min(1, targetVol));
        el.playbackRate = Math.max(0.7, Math.min(1.6, 0.75 + (rpm / 1300) * 0.6));
        if (el.paused) {
          el.play().catch(() => {
            // Autoplay may be blocked until a user gesture; will retry next tick.
          });
        }
        return;
      } catch {
        // fall through to synthesized fallback
      }
    }

    // ---- Fallback: synthesized oscillator engine ----
    if (!this.isInitialized) return;
    if (!this.initContext() || !this.ctx) return;
    try {
      if (!running) {
        if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        return;
      }
      const baseFreq = 32 + (rpm / 1300) * 45;
      const targetGain = ptoEngaged ? 0.15 : 0.08;
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, this.ctx.currentTime);
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
      } else {
        this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.1);
        if (this.engineGain) this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
      }
    } catch {
      // Safe catch
    }
  }

  public updateHydraulicSound(active: boolean, pressurePsi: number) {
    if (this.isMuted || !this.isInitialized) return;
    if (!this.initContext() || !this.ctx) return;

    try {
      if (!active || pressurePsi < 100) {
        if (this.hydraulicGain) {
          this.hydraulicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        }
        return;
      }

      const freq = 220 + (pressurePsi / 5000) * 500;
      const targetGain = Math.min(0.12, (pressurePsi / 4000) * 0.12);

      if (!this.hydraulicOsc) {
        this.hydraulicOsc = this.ctx.createOscillator();
        this.hydraulicOsc.type = 'triangle';
        this.hydraulicOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        this.hydraulicGain = this.ctx.createGain();
        this.hydraulicGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);

        this.hydraulicOsc.connect(this.hydraulicGain);
        this.hydraulicGain.connect(this.ctx.destination);
        this.hydraulicOsc.start();
      } else {
        this.hydraulicOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
        if (this.hydraulicGain) {
          this.hydraulicGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
        }
      }
    } catch {
      // Safe catch
    }
  }

  public playAirHorn(durationSec: number = 1.2) {
    if (this.isMuted) return;
    if (!this.initContext() || !this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(311, t);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(370, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
      gain.gain.setValueAtTime(0.25, t + durationSec - 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + durationSec);
      osc2.stop(t + durationSec);
    } catch {
      // Safe catch
    }
  }

  public playBuzzerAlert() {
    if (this.isMuted) return;
    if (!this.initContext() || !this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.25);
    } catch {
      // Safe catch
    }
  }

  public playHiss(duration: number = 0.5) {
    if (this.isMuted) return;
    if (!this.initContext() || !this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(t);
    } catch {
      // Safe catch
    }
  }

  public playMetalTap() {
    if (this.isMuted) return;
    if (!this.initContext() || !this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.12);
    } catch {
      // Safe catch
    }
  }

  public playSuccessChime() {
    if (this.isMuted) return;
    if (!this.initContext() || !this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + idx * 0.1;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.35);
      });
    } catch {
      // Safe catch
    }
  }

  public isAudioMuted(): boolean {
    return this.isMuted;
  }

  public startEngineLoop(rpm: number = 1300) {
    this.updateEngineSound(true, rpm, true);
  }

  public stopEngineLoop() {
    this.updateEngineSound(false, 0, false);
  }

  public stopAll() {
    try {
      if (this.engineAudioEl && !this.engineAudioEl.paused) this.engineAudioEl.pause();
      if (this.engineGain && this.ctx) this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.hydraulicGain && this.ctx) this.hydraulicGain.gain.setValueAtTime(0, this.ctx.currentTime);
    } catch {
      // Safe catch
    }
  }
}

export const soundManager = new SoundSynthesizer();
