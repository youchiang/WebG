/**
 * Procedural Web Audio Sound Engine for Drift Downhill 3D
 * Zero external asset dependencies, low latency, mobile-friendly.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isUnlocked = false;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;

    // Engine loop nodes
    this.engineOsc = null;
    this.engineGain = null;

    // Tire squeal noise nodes
    this.tireNoiseNode = null;
    this.tireFilter = null;
    this.tireGain = null;

    // BGM timer
    this.bgmTimer = null;
    this.isMuted = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    this.bgmGain.connect(this.masterGain);

    this.setupEngineSynth();
    this.setupTireNoiseSynth();
  }

  unlock() {
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.isUnlocked = true;
        this.startBgm();
      });
    } else {
      this.isUnlocked = true;
      this.startBgm();
    }
  }

  setupEngineSynth() {
    if (!this.ctx) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low purr

      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.setValueAtTime(260, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.engineOsc.start();
    } catch (e) {
      console.warn('Engine synth init error:', e);
    }
  }

  setupTireNoiseSynth() {
    if (!this.ctx) return;
    try {
      // 1-second white noise buffer loop
      const bufferSize = this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.tireNoiseNode = this.ctx.createBufferSource();
      this.tireNoiseNode.buffer = noiseBuffer;
      this.tireNoiseNode.loop = true;

      this.tireFilter = this.ctx.createBiquadFilter();
      this.tireFilter.type = 'bandpass';
      this.tireFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      this.tireFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

      this.tireGain = this.ctx.createGain();
      this.tireGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      this.tireNoiseNode.connect(this.tireFilter);
      this.tireFilter.connect(this.tireGain);
      this.tireGain.connect(this.sfxGain);

      this.tireNoiseNode.start();
    } catch (e) {
      console.warn('Tire noise synth init error:', e);
    }
  }

  updateCarTelemetry(speedNormalized, isDrifting, slipAngleRad) {
    if (!this.ctx || !this.isUnlocked) return;
    const now = this.ctx.currentTime;

    // Modulate engine pitch with speed
    if (this.engineOsc && this.engineGain) {
      const targetFreq = 50 + speedNormalized * 110;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
      const targetGain = 0.04 + speedNormalized * 0.08;
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
    }

    // Modulate tire squeal
    if (this.tireGain && this.tireFilter) {
      if (isDrifting && Math.abs(slipAngleRad) > 0.15) {
        const driftIntensity = Math.min(1.0, Math.abs(slipAngleRad) / 0.8);
        const targetTireGain = 0.18 * driftIntensity;
        this.tireGain.gain.setTargetAtTime(targetTireGain, now, 0.05);
        this.tireFilter.frequency.setTargetAtTime(1200 + driftIntensity * 800, now, 0.05);
      } else {
        this.tireGain.gain.setTargetAtTime(0.0001, now, 0.1);
      }
    }
  }

  playYeet(type = 'human') {
    if (!this.ctx || !this.isUnlocked) return;
    const now = this.ctx.currentTime;

    try {
      // Cartoon spring "boing" / slide whistle
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type === 'cat' ? 'triangle' : 'sine';
      const startFreq = type === 'cat' ? 600 : (type === 'cone' ? 300 : 220);
      const endFreq = type === 'cat' ? 1800 : (type === 'cone' ? 120 : 880);

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.28);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.35);

      // Cute pop accent
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(800, now);
      popOsc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
      popGain.gain.setValueAtTime(0.25, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      popOsc.connect(popGain);
      popGain.connect(this.sfxGain);
      popOsc.start(now);
      popOsc.stop(now + 0.1);
    } catch (e) {
      console.warn('Yeet sound error:', e);
    }
  }

  playGuardrailBump() {
    if (!this.ctx || !this.isUnlocked) return;
    const now = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {}
  }

  playFinishFanfare() {
    if (!this.ctx || !this.isUnlocked) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = this.ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.25, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.45);
    });
  }

  startBgm() {
    if (this.bgmTimer || !this.ctx) return;

    // Upbeat pastel pentatonic arpeggio (C Major Pentatonic: C4, D4, E4, G4, A4)
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    const pattern = [0, 2, 4, 2, 3, 1, 4, 3, 0, 3, 2, 5];
    let step = 0;

    const playNote = () => {
      if (!this.ctx || !this.isUnlocked || this.isMuted) return;
      const now = this.ctx.currentTime;
      const freq = scale[pattern[step % pattern.length]];
      step++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(now);
      osc.stop(now + 0.25);
    };

    this.bgmTimer = setInterval(playNote, 250); // 120 BPM 8th notes
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const audioEngine = new AudioEngine();
