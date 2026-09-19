/**
 * Industrial Audio Synthesizer for Weatherford COROD Simulator
 * Uses native Web Audio API with safe lazy initialization on user gesture.
 */

/** Keys for the recorded looping clips managed by the sound manager. */
type LoopKey = 'slip' | 'freefall' | 'pumpjack' | 'reel';

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
  //
  // IMPORTANT: We decode the MP3 into an AudioBuffer and play it through an
  // AudioBufferSourceNode with `loop = true`. This loops sample-accurately and
  // GAPLESSLY. Using an <audio loop> element instead produces an audible cut /
  // silence on every repeat because MP3 files carry encoder padding (priming
  // samples at the start and remainder padding at the end), which the media
  // element does not trim.
  private engineBuffer: AudioBuffer | null = null;
  private engineSource: AudioBufferSourceNode | null = null;
  private engineLoopGain: GainNode | null = null;
  private enginePlaybackStarted = false;
  private engineAudioReady = false;
  private engineAudioFailed = false;
  private engineDecoding = false;
  private readonly ENGINE_LOOP_URL = '/sounds/engine-loop.mp3';

  // One-shot "car starting" clip (played once, NOT looped) layered on top of
  // the looping engine sound when the engine is cranked.
  private engineStartBuffer: AudioBuffer | null = null;
  private engineStartFailed = false;
  private engineStartDecoding = false;
  private readonly ENGINE_START_URL =
    '/sounds/freesound_community-car-engine-starting-43705.mp3';

  // ---------------------------------------------------------------------------
  // Looping alarm clips (Slip / Free-Fall). These are recorded MP3 loops streamed
  // via persistent looping AudioBufferSourceNodes (same gapless technique as the
  // engine loop). Each is controlled purely via its own gain node and, per the
  // spec, plays at 50% of the source volume.
  // ---------------------------------------------------------------------------
  private readonly ALARM_LOOP_VOLUME = 0.5; // 50% of source volume

  // ---------------------------------------------------------------------------
  // Proximity gain (0..1). Driven by the 3D camera distance so sounds get
  // louder as the camera moves closer to the relevant equipment:
  //   - mgProximity      → engine / PTO / hydraulic (Mobile Gripper unit)
  //   - injectorProximity → slip / free-fall alarms (injector head)
  // Both default to 1 (full volume) so audio still works when the 3D viewport
  // isn't driving them (e.g. secondary windows / gauge-only views).
  // ---------------------------------------------------------------------------
  private mgProximity = 1;
  private injectorProximity = 1;
  // Proximity for reel-side equipment (reel rotation + background pumpjacks).
  private reelProximity = 1;

  // Which proximity channel scales each loop's volume.
  // 'injector' → injectorProximity; 'reel' → reelProximity; 'none' → no scaling.
  private loopProxChannel(key: LoopKey): 'injector' | 'reel' | 'none' {
    if (key === 'slip' || key === 'freefall') return 'injector';
    if (key === 'reel' || key === 'pumpjack') return 'reel';
    return 'none';
  }
  private proxFor(channel: 'injector' | 'reel' | 'none'): number {
    if (channel === 'injector') return this.injectorProximity;
    if (channel === 'reel') return this.reelProximity;
    return 1;
  }

  private readonly loops: Record<
    LoopKey,
    {
      url: string;
      /** Base (pre-proximity) volume for this loop. */
      baseVolume: number;
      buffer: AudioBuffer | null;
      source: AudioBufferSourceNode | null;
      gain: GainNode | null;
      started: boolean;
      failed: boolean;
      decoding: boolean;
      wanted: boolean;
    }
  > = {
    slip: {
      url: '/sounds/slip-alarm.mp3', baseVolume: this.ALARM_LOOP_VOLUME,
      buffer: null, source: null, gain: null,
      started: false, failed: false, decoding: false, wanted: false,
    },
    freefall: {
      url: '/sounds/freefall-alarm.mp3', baseVolume: this.ALARM_LOOP_VOLUME,
      buffer: null, source: null, gain: null,
      started: false, failed: false, decoding: false, wanted: false,
    },
    // Background pump-jacks: a very low, steady distant ambience.
    pumpjack: {
      url: '/sounds/pumpjack-loop.mp3', baseVolume: 0.08,
      buffer: null, source: null, gain: null,
      started: false, failed: false, decoding: false, wanted: false,
    },
    // Reel rotation: only audible while the reel is actually turning.
    reel: {
      url: '/sounds/reel-loop.mp3', baseVolume: 0.45,
      buffer: null, source: null, gain: null,
      started: false, failed: false, decoding: false, wanted: false,
    },
  };

  /**
   * Fetch + decode the engine loop into an AudioBuffer (once). Safe to call
   * repeatedly; it is a no-op while decoding, decoded, or after a failure.
   */
  private ensureEngineBuffer(): void {
    if (this.engineBuffer || this.engineAudioFailed || this.engineDecoding) return;
    if (!this.ctx) return;
    this.engineDecoding = true;
    fetch(this.ENGINE_LOOP_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => {
        if (!this.ctx) throw new Error('no audio context');
        return this.ctx.decodeAudioData(data);
      })
      .then((buffer) => {
        this.engineBuffer = buffer;
        this.engineAudioReady = true;
        this.engineDecoding = false;
      })
      .catch(() => {
        this.engineAudioFailed = true;
        this.engineDecoding = false;
      });
  }

  /**
   * Create (once) and start the looping buffer source + its gain node.
   *
   * The source is started ONCE and left running forever (looping), controlled
   * purely via `engineLoopGain`. This is deliberate: recreating the source on
   * every start/stop caused the loop to restart from the beginning and produced
   * the "cuts out then repeats" artifact. A single persistent looping source
   * loops seamlessly; we simply ramp the gain to 0 to "turn the engine off".
   */
  private ensureEngineSourcePlaying(): boolean {
    if (!this.ctx || !this.engineBuffer) return false;
    if (this.enginePlaybackStarted && this.engineSource && this.engineLoopGain) return true;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.engineBuffer;
      src.loop = true;

      // Trim a few milliseconds off each edge of the loop region so that any
      // near-silent encoder padding baked into the MP3 is skipped, hiding any
      // residual click/gap at the loop boundary.
      const dur = this.engineBuffer.duration;
      const edge = Math.min(0.04, dur * 0.02); // up to 40ms, capped at 2% of clip
      if (dur > edge * 2 + 0.05) {
        src.loopStart = edge;
        src.loopEnd = dur - edge;
      }

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, this.ctx.currentTime);

      src.connect(gain);
      gain.connect(this.ctx.destination);
      // Start playback from the loop start offset; it will loop indefinitely.
      src.start(0, src.loopStart || 0);

      this.engineSource = src;
      this.engineLoopGain = gain;
      this.enginePlaybackStarted = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fade the looping engine gain to silence WITHOUT tearing down the source, so
   * the loop keeps running seamlessly in the background and can be brought back
   * instantly. Full teardown only happens on mute()/stopAll().
   */
  private silenceEngineLoop() {
    if (this.engineLoopGain && this.ctx) {
      try {
        this.engineLoopGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      } catch { /* noop */ }
    }
  }

  /** Completely stop and discard the looping source (mute / shutdown). */
  private stopEngineBufferSource() {
    try {
      if (this.engineLoopGain && this.ctx) {
        this.engineLoopGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      }
      if (this.engineSource) {
        const src = this.engineSource;
        setTimeout(() => {
          try { src.stop(); } catch { /* noop */ }
          try { src.disconnect(); } catch { /* noop */ }
        }, 250);
      }
      this.engineSource = null;
      this.engineLoopGain = null;
      this.enginePlaybackStarted = false;
    } catch {
      // Safe catch
    }
  }

  /** Fetch + decode the one-shot engine-start clip (once). */
  private ensureEngineStartBuffer(): void {
    if (this.engineStartBuffer || this.engineStartFailed || this.engineStartDecoding) return;
    if (!this.ctx) return;
    this.engineStartDecoding = true;
    fetch(this.ENGINE_START_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => {
        if (!this.ctx) throw new Error('no audio context');
        return this.ctx.decodeAudioData(data);
      })
      .then((buffer) => {
        this.engineStartBuffer = buffer;
        this.engineStartDecoding = false;
      })
      .catch(() => {
        this.engineStartFailed = true;
        this.engineStartDecoding = false;
      });
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
      // Stop the recorded engine loop and silence synth nodes.
      this.stopEngineBufferSource();
      this.stopAllLoops();
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

  /**
   * Set proximity gain factors (0..1) from the 3D camera distance. Called each
   * frame by the 3D viewport. Smoothly re-applies live gains so volume tracks
   * the camera as it moves toward/away from the MG unit / injector.
   */
  public setProximity(mgProximity: number, injectorProximity: number, reelProximity?: number): void {
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    this.mgProximity = clamp01(mgProximity);
    this.injectorProximity = clamp01(injectorProximity);
    if (reelProximity != null) this.reelProximity = clamp01(reelProximity);
    if (this.isMuted || !this.ctx) return;
    // Re-apply live loop gains immediately so volume tracks the camera without
    // waiting for the next physics/alarm tick. (Engine/hydraulic pick up the new
    // mgProximity on their next update call.)
    try {
      (Object.keys(this.loops) as LoopKey[]).forEach((k) => {
        const L = this.loops[k];
        if (L.gain && L.wanted) {
          L.gain.gain.setTargetAtTime(
            L.baseVolume * this.proxFor(this.loopProxChannel(k)),
            this.ctx!.currentTime,
            0.08,
          );
        }
      });
    } catch {
      /* noop */
    }
  }

  public updateEngineSound(running: boolean, rpm: number, ptoEngaged: boolean) {
    if (this.isMuted) return;

    // The Web Audio buffer path requires a live AudioContext.
    if (!this.initContext() || !this.ctx) return;

    // Prefer the real recorded engine loop, played as a gapless AudioBuffer.
    this.ensureEngineBuffer();
    if (this.engineBuffer && !this.engineAudioFailed) {
      try {
        if (!running) {
          // Fade to silence but KEEP the loop source alive so it never restarts
          // from the top (which caused the "cut out then repeat" artifact).
          this.silenceEngineLoop();
          return;
        }
        if (this.ensureEngineSourcePlaying() && this.engineLoopGain && this.engineSource) {
          // Louder under load (PTO engaged); pitch/speed rises with rpm.
          // Scaled by MG-unit camera proximity so it swells as you approach.
          const targetVol = (ptoEngaged ? 0.3 : 0.2) * this.mgProximity;
          const rate = Math.max(0.7, Math.min(1.6, 0.75 + (rpm / 1300) * 0.6));
          this.engineLoopGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.15);
          this.engineSource.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.15);
        }
        return;
      } catch {
        // fall through to synthesized fallback
      }
    }

    // While the buffer is still decoding, do nothing this tick (avoid starting
    // the synth fallback which would double up once the buffer is ready).
    if (this.engineDecoding && !this.engineAudioFailed) return;

    // ---- Fallback: synthesized oscillator engine ----
    if (!this.isInitialized) return;
    if (!this.initContext() || !this.ctx) return;
    try {
      if (!running) {
        if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        return;
      }
      const baseFreq = 32 + (rpm / 1300) * 45;
      const targetGain = (ptoEngaged ? 0.08 : 0.04) * this.mgProximity;
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
      const targetGain = Math.min(0.12, (pressurePsi / 4000) * 0.12) * this.mgProximity;

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

  /**
   * Play the one-shot "car engine starting" clip a SINGLE time (never looped)
   * and, at the same moment, bring the continuous engine LOOP up to idle. The
   * two layered together sound like a real engine cranking then settling into
   * a steady idle. Safe to call on the "Start the Rig Engine" step.
   */
  public playEngineStart(idleRpm: number = 1050) {
    if (this.isMuted) return;
    if (!this.initContext() || !this.ctx) return;

    // Kick off the continuous loop simultaneously so the idle is audible the
    // instant the crank sound plays. This uses the persistent looping source.
    this.ensureEngineBuffer();
    if (this.engineBuffer && this.ensureEngineSourcePlaying() && this.engineLoopGain) {
      // Slight fade-in so the idle emerges under the crank clip.
      this.engineLoopGain.gain.setTargetAtTime(0.4, this.ctx.currentTime, 0.4);
      if (this.engineSource) {
        const rate = Math.max(0.7, Math.min(1.6, 0.75 + (idleRpm / 1300) * 0.6));
        this.engineSource.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.3);
      }
    }

    // Play the one-shot crank clip. We use a plain HTMLAudioElement here (rather
    // than a decoded AudioBuffer) because it plays a single time with zero decode
    // race — the click that triggers this is a valid user gesture, so autoplay is
    // permitted. Looping quality is irrelevant for a one-shot, so no MP3-gap
    // concern applies. This guarantees the crank sound fires immediately.
    try {
      if (typeof Audio !== 'undefined') {
        const crank = new Audio(this.ENGINE_START_URL);
        crank.loop = false;
        crank.volume = 0.9;
        crank.play().catch(() => {
          // As a last resort fall back to the decoded-buffer path.
          this.playEngineStartViaBuffer();
        });
        return;
      }
    } catch {
      // fall through to buffer path
    }
    this.playEngineStartViaBuffer();
  }

  /** Decoded-buffer fallback for the one-shot crank clip. */
  private playEngineStartViaBuffer() {
    this.ensureEngineStartBuffer();
    const playOneShot = () => {
      if (!this.ctx || !this.engineStartBuffer) return;
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.engineStartBuffer;
        src.loop = false; // one-time only
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.85, this.ctx.currentTime);
        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start();
        src.onended = () => {
          try { src.disconnect(); } catch { /* noop */ }
          try { gain.disconnect(); } catch { /* noop */ }
        };
      } catch {
        // Safe catch
      }
    };

    if (this.engineStartBuffer) {
      playOneShot();
    } else if (!this.engineStartFailed) {
      // Buffer still decoding: poll briefly so the crank still plays once ready.
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (this.engineStartBuffer) {
          clearInterval(timer);
          playOneShot();
        } else if (this.engineStartFailed || attempts > 40) {
          clearInterval(timer);
        }
      }, 50);
    }
  }

  // ---------------------------------------------------------------------------
  // Generic looping-clip control (Slip / Free-Fall alarms, pump-jacks, reel)
  // ---------------------------------------------------------------------------

  /** Fetch + decode a named loop into an AudioBuffer (once). */
  private ensureLoopBuffer(key: LoopKey): void {
    const L = this.loops[key];
    if (L.buffer || L.failed || L.decoding || !this.ctx) return;
    L.decoding = true;
    fetch(L.url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => {
        if (!this.ctx) throw new Error('no audio context');
        return this.ctx.decodeAudioData(data);
      })
      .then((buffer) => {
        L.buffer = buffer;
        L.decoding = false;
        // If the loop was requested while decoding, start it now.
        if (L.wanted && !this.isMuted) this.startLoop(key);
      })
      .catch(() => {
        L.failed = true;
        L.decoding = false;
      });
  }

  /**
   * Start (or resume) a looping clip at its base volume × proximity. Uses a
   * single persistent looping source per clip, controlled via its gain node —
   * the same gapless technique as the engine loop.
   */
  public startLoop(key: LoopKey): void {
    const L = this.loops[key];
    L.wanted = true;
    if (this.isMuted) return;
    if (!this.initContext() || !this.ctx) return;
    if (!L.buffer) {
      this.ensureLoopBuffer(key);
      return; // will auto-start once decoded
    }
    try {
      if (!L.started || !L.source || !L.gain) {
        const src = this.ctx.createBufferSource();
        src.buffer = L.buffer;
        src.loop = true;
        const dur = L.buffer.duration;
        const edge = Math.min(0.02, dur * 0.02);
        if (dur > edge * 2 + 0.05) {
          src.loopStart = edge;
          src.loopEnd = dur - edge;
        }
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(0, src.loopStart || 0);
        L.source = src;
        L.gain = gain;
        L.started = true;
      }
      L.gain.gain.setTargetAtTime(
        L.baseVolume * this.proxFor(this.loopProxChannel(key)),
        this.ctx.currentTime,
        0.05,
      );
    } catch {
      // Safe catch
    }
  }

  /** Stop a looping clip (fade to silence and tear down). */
  public stopLoop(key: LoopKey): void {
    const L = this.loops[key];
    L.wanted = false;
    try {
      if (L.gain && this.ctx) {
        L.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      if (L.source) {
        const src = L.source;
        setTimeout(() => {
          try { src.stop(); } catch { /* noop */ }
          try { src.disconnect(); } catch { /* noop */ }
        }, 200);
      }
      L.source = null;
      L.gain = null;
      L.started = false;
    } catch {
      // Safe catch
    }
  }

  // Backwards-compatible aliases for the alarm loops.
  public startAlarmLoop(key: 'slip' | 'freefall'): void { this.startLoop(key); }
  public stopAlarmLoop(key: 'slip' | 'freefall'): void { this.stopLoop(key); }

  /**
   * Drive the reel-rotation and pump-jack ambience loops. Called from the sim:
   *  - reelRotating: true only while the reel is actually turning (>0 speed).
   *  - pumpjacksActive: background pump-jack ambience (typically always on while
   *    the scene is live).
   */
  public updateReelSound(reelRotating: boolean): void {
    if (reelRotating && !this.isMuted) this.startLoop('reel');
    else this.stopLoop('reel');
  }
  public updatePumpjackSound(active: boolean): void {
    if (active && !this.isMuted) this.startLoop('pumpjack');
    else this.stopLoop('pumpjack');
  }

  /** Stop all looping alarms (used by mute / shutdown / reset). */
  public stopAllAlarmLoops(): void {
    this.stopLoop('slip');
    this.stopLoop('freefall');
  }

  /** Stop every managed loop (alarms + ambience). */
  public stopAllLoops(): void {
    (Object.keys(this.loops) as LoopKey[]).forEach((k) => this.stopLoop(k));
  }

  /**
   * Tier-3 critical lockout alarm: a harsh, unmistakable multi-tone burst.
   * Layered on TOP of any active looping alarm.
   */
  public playCriticalLockoutAlarm(): void {
    if (this.isMuted || !this.initContext() || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Three descending harsh tones.
      [880, 660, 440].forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.22);
        gain.gain.setValueAtTime(0, now + i * 0.22);
        gain.gain.linearRampToValueAtTime(0.35, now + i * 0.22 + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + i * 0.22 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + i * 0.22);
        osc.stop(now + i * 0.22 + 0.22);
      });
    } catch {
      // Safe catch
    }
  }

  public stopAll() {
    try {
      this.stopEngineBufferSource();
      this.stopAllLoops();
      if (this.engineGain && this.ctx) this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.hydraulicGain && this.ctx) this.hydraulicGain.gain.setValueAtTime(0, this.ctx.currentTime);
    } catch {
      // Safe catch
    }
  }
}

export const soundManager = new SoundSynthesizer();
