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

    // BGM timer & state
    this.bgmTimer = null;
    this.isMuted = false;
    this.currentSong = 'Für Elise (給愛麗絲)';
    this.bgmNotesPlayed = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    // Gentle, soft volume for Taiwan garbage truck Für Elise music box (-17 dB bus gain)
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0.14, this.ctx.currentTime);
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

    // 台灣垃圾車經典名曲：《給愛麗絲》(Beethoven - Für Elise) 電子音樂盒版
    const N = {
      REST: 0,
      C4: 261.63,
      E4: 329.63,
      F4: 349.23,
      G4: 392.00,
      Gs4: 415.30,
      A4: 440.00,
      B4: 493.88,
      C5: 523.25,
      D5: 587.33,
      Ds5: 622.25,
      E5: 659.25,
      F5: 698.46,
    };

    // Each entry: [frequency, durationInSteps] (1 step = 170ms)
    const melody = [
      // Phrase A1: E5 D#5 E5 D#5 E5 B4 D5 C5 | A4 . C4 E4 A4 | B4 . E4 G#4 B4 | C5 . E4
      [N.E5, 1], [N.Ds5, 1], [N.E5, 1], [N.Ds5, 1], [N.E5, 1], [N.B4, 1], [N.D5, 1], [N.C5, 1],
      [N.A4, 2], [N.REST, 1], [N.C4, 1], [N.E4, 1], [N.A4, 1],
      [N.B4, 2], [N.REST, 1], [N.E4, 1], [N.Gs4, 1], [N.B4, 1],
      [N.C5, 2], [N.REST, 1], [N.E4, 1],

      // Phrase A2: E5 D#5 E5 D#5 E5 B4 D5 C5 | A4 . C4 E4 A4 | B4 . E4 C5 B4 | A4 . .
      [N.E5, 1], [N.Ds5, 1], [N.E5, 1], [N.Ds5, 1], [N.E5, 1], [N.B4, 1], [N.D5, 1], [N.C5, 1],
      [N.A4, 2], [N.REST, 1], [N.C4, 1], [N.E4, 1], [N.A4, 1],
      [N.B4, 2], [N.REST, 1], [N.E4, 1], [N.C5, 1], [N.B4, 1],
      [N.A4, 3], [N.REST, 1],

      // Phrase B (Cheerful C-major bridge): B4 C5 D5 | E5 . G4 F5 E5 | D5 . F4 E5 D5 | C5 . E4 D5 C5 | B4 . .
      [N.B4, 1], [N.C5, 1], [N.D5, 1],
      [N.E5, 2], [N.REST, 1], [N.G4, 1], [N.F5, 1], [N.E5, 1],
      [N.D5, 2], [N.REST, 1], [N.F4, 1], [N.E5, 1], [N.D5, 1],
      [N.C5, 2], [N.REST, 1], [N.E4, 1], [N.D5, 1], [N.C5, 1],
      [N.B4, 2], [N.REST, 1],
    ];

    let noteIdx = 0;
    let waitSteps = 0;
    const stepSec = 0.17;

    const tickMusicBox = () => {
      if (!this.ctx || !this.isUnlocked || this.isMuted) return;

      if (waitSteps > 0) {
        waitSteps--;
        return;
      }

      const [freq, steps] = melody[noteIdx % melody.length];
      noteIdx++;
      waitSteps = Math.max(0, steps - 1);

      if (freq <= 0) return;

      this.bgmNotesPlayed++;
      const now = this.ctx.currentTime;
      const dur = steps * stepSec * 1.15;

      // Warm electronic music-box chime (triangle fundamental + soft sine octave harmonic)
      const oscMain = this.ctx.createOscillator();
      const oscChime = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gainMain = this.ctx.createGain();
      const gainChime = this.ctx.createGain();

      oscMain.type = 'triangle';
      oscMain.frequency.setValueAtTime(freq, now);

      oscChime.type = 'sine';
      oscChime.frequency.setValueAtTime(freq * 2, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);

      // Soft, pleasant volume envelope (聲音不用太大)
      gainMain.gain.setValueAtTime(0.001, now);
      gainMain.gain.linearRampToValueAtTime(0.065, now + 0.012);
      gainMain.gain.exponentialRampToValueAtTime(0.0005, now + dur);

      gainChime.gain.setValueAtTime(0.001, now);
      gainChime.gain.linearRampToValueAtTime(0.016, now + 0.008);
      gainChime.gain.exponentialRampToValueAtTime(0.0002, now + dur * 0.65);

      oscMain.connect(gainMain);
      oscChime.connect(gainChime);
      gainMain.connect(filter);
      gainChime.connect(filter);
      filter.connect(this.bgmGain);

      oscMain.start(now);
      oscChime.start(now);
      oscMain.stop(now + dur + 0.02);
      oscChime.stop(now + dur + 0.02);
    };

    this.bgmTimer = setInterval(tickMusicBox, stepSec * 1000);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const audioEngine = new AudioEngine();
