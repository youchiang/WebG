/**
 * Procedural Web Audio Synthesizer for Badminton Game Feel
 * Implements dB bus hierarchy, dual-layer smash acoustic synthesis,
 * high-tension string snap/ping, and environment collision acoustics.
 * Safe for headless environments (mock/telemetry fallback).
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.isMuted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        this.initialized = true;
        return;
      }

      this.ctx = new AudioCtx();

      // Master Dynamics Compressor to prevent clipping during aggressive rallies
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.08, this.ctx.currentTime);
      this.compressor.connect(this.ctx.destination);

      // Master Bus: 0 dB gain (linear 1.0)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGain.connect(this.compressor);

      // SFX Bus: -1.5 dB headroom (linear ~0.841)
      this.sfxGain = this.ctx.createGain();
      const sfxLinear = Math.pow(10, -1.5 / 20);
      this.sfxGain.gain.setValueAtTime(sfxLinear, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Pre-synthesize 1-second white noise buffer for string snaps and feather friction
      const bufferSize = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.initialized = true;
    } catch (err) {
      // Graceful fallback for headless test runners / browsers without audio device
      this.initialized = true;
      this.ctx = null;
    }
  }

  ensureContextRunning() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  /**
   * Triggers authentic badminton racket-to-shuttle strike acoustics.
   * Telemetry is written directly to state.effects.lastAudioEvent.
   */
  playStrikeSound(shotType = 'CLEAR', quality = 'normal', speedKmh = 120, state = null) {
    this.ensureContextRunning();

    let peakFreq = 1400;
    let volumeDb = -4.0;
    const now = performance.now();

    // 1. Determine acoustic signature by shot type
    if (shotType === 'SMASH') {
      peakFreq = 2800;
      volumeDb = quality === 'sweet_spot' ? 0.0 : -1.5;
      this.synthesizeSmashAcoustic(quality);
    } else if (shotType === 'DRIVE') {
      peakFreq = 1100;
      volumeDb = -3.0;
      this.synthesizeDriveAcoustic(quality);
    } else if (shotType === 'DROP' || shotType === 'NET_SHOT') {
      peakFreq = 950;
      volumeDb = -7.0;
      this.synthesizeDropAcoustic();
    } else {
      // CLEAR / ATTACKING_CLEAR / LIFT
      peakFreq = 1500;
      volumeDb = quality === 'sweet_spot' ? -1.0 : -3.5;
      this.synthesizeClearAcoustic(quality);
    }

    // 2. Synchronize deterministic audio event telemetry
    if (state && state.effects) {
      state.effects.lastAudioEvent = {
        type: 'strike',
        shotType,
        quality,
        speedKmh,
        volumeDb,
        peakFreq,
        timestamp: now,
      };
    }
  }

  /**
   * Dual-Layer Heavy Smash Acoustic Synthesis:
   * Layer A: High-tension string explosive crack (2800Hz bandpassed noise snap, 8ms decay)
   * Layer B: Cork deformation sub-boom (240Hz -> 55Hz pitch sweep, 65ms duration)
   */
  synthesizeSmashAcoustic(quality) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const qualityBoost = quality === 'sweet_spot' ? 1.25 : 1.0;

    // --- Layer A: String Crack (High-Tension Snap) ---
    if (this.noiseBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(2800, t);
      bandpass.Q.setValueAtTime(4.5, t);

      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(1800, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.95 * qualityBoost, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.024);

      noiseSource.connect(bandpass);
      bandpass.connect(highpass);
      highpass.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noiseSource.start(t);
      noiseSource.stop(t + 0.03);
    }

    // --- Layer B: Cork Boom / Sub Thump ---
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';

    // Pitch sweep: 240Hz punch drops rapidly to 55Hz sub-thud
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.065);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(1.0 * qualityBoost, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.10);
  }

  /**
   * Crisp String Snap / Ping for Clear and Lift shots
   */
  synthesizeClearAcoustic(quality) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const baseFreq = quality === 'sweet_spot' ? 1580 : 1380;

    // High ping oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, t + 0.06);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.75, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.07);

    // Subtle noise crack
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, t);
      filter.Q.setValueAtTime(3.0, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(t);
      noise.stop(t + 0.025);
    }
  }

  /**
   * Sharp, tight drive shot ping
   */
  synthesizeDriveAcoustic(quality) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const freq = quality === 'sweet_spot' ? 1250 : 1050;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + 0.045);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.65, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  /**
   * Gentle feather brush / slicing sound for drops and net tumbles
   */
  synthesizeDropAcoustic() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.Q.setValueAtTime(1.8, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.38, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(t);
      noise.stop(t + 0.05);
    }
  }

  /**
   * Environmental collision sounds: net cord tape, mesh, court floor tap
   */
  playEnvironmentSound(eventType = 'floor', detail = {}, state = null) {
    this.ensureContextRunning();
    const now = performance.now();
    let peakFreq = 320;
    let volumeDb = -6.0;

    if (eventType === 'net_tape') {
      peakFreq = 2200;
      volumeDb = -4.0;
      this.synthesizeNetTapeSound();
    } else if (eventType === 'net_mesh') {
      peakFreq = 180;
      volumeDb = -8.0;
      this.synthesizeNetMeshSound();
    } else {
      // floor tap
      peakFreq = 340;
      volumeDb = -5.0;
      this.synthesizeFloorTapSound();
    }

    if (state && state.effects) {
      state.effects.lastAudioEvent = {
        type: eventType,
        detail,
        volumeDb,
        peakFreq,
        timestamp: now,
      };
    }
  }

  synthesizeNetTapeSound() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.02);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  synthesizeNetMeshSound() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.045);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  synthesizeFloorTapSound() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /**
   * Pre-Strike Tension Audio Cue (synthesizes a subtle 2-note rising chime 520Hz -> 780Hz over 140ms at -10 dB).
   */
  playSmashWarningSound(state = null) {
    this.ensureContextRunning();

    if (state && state.effects) {
      state.effects.lastAudioEvent = {
        type: 'smash_warning',
        volumeDb: -10,
        peakFreq: 780,
        timestamp: Date.now(),
      };
    }

    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Note 1: 520Hz sine chime
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(520, t);
    osc1.frequency.exponentialRampToValueAtTime(580, t + 0.06);

    const gain1 = this.ctx.createGain();
    const linearVol = Math.pow(10, -10 / 20); // ~0.316
    gain1.gain.setValueAtTime(linearVol, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(t);
    osc1.stop(t + 0.075);

    // Note 2: 780Hz rising chime
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(740, t + 0.07);
    osc2.frequency.exponentialRampToValueAtTime(780, t + 0.14);

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(linearVol * 0.9, t + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(t + 0.07);
    osc2.stop(t + 0.15);
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 1.0, this.ctx.currentTime);
    }
  }
}

export const soundEngine = new SoundEngine();
