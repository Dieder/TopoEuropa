import { VehicleType } from '../types/game';

class FlightSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;

  // Engine loop nodes
  private engineActive: boolean = false;
  private currentVehicle: VehicleType = 'helicopter';
  private engineGroupGain: GainNode | null = null;
  private primaryOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private lfoDepth: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;

  private lastPingTime = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.45;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.45, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Soft pink/brown noise blend for pleasant rotor/jet air texture
      data[i] = (lastOut + 0.08 * white) / 1.08;
      lastOut = data[i];
      data[i] *= 2.8;
    }
    return buffer;
  }

  public startEngine(vehicle: VehicleType): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    if (this.engineActive && this.currentVehicle === vehicle) {
      return;
    }
    this.stopEngine();

    this.currentVehicle = vehicle;
    this.engineActive = true;

    const now = ctx.currentTime;
    const group = ctx.createGain();
    group.gain.setValueAtTime(0.001, now);
    group.gain.exponentialRampToValueAtTime(0.24, now + 0.25);
    group.connect(this.masterGain);
    this.engineGroupGain = group;

    // Air / rotor noise bed
    const noiseBuffer = this.createNoiseBuffer(ctx);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'lowpass';
    nFilter.frequency.value = vehicle === 'helicopter' ? 260 : vehicle === 'airplane' ? 380 : 520;

    const nGain = ctx.createGain();
    nGain.gain.value = vehicle === 'helicopter' ? 0.35 : vehicle === 'airplane' ? 0.18 : 0.42;

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(group);
    noise.start(now);

    this.noiseSource = noise;
    this.noiseFilter = nFilter;
    this.noiseGain = nGain;

    // Tonal engine core
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = vehicle === 'helicopter' ? 170 : vehicle === 'airplane' ? 240 : 190;
    filter.connect(group);
    this.engineFilter = filter;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();

    if (vehicle === 'helicopter') {
      osc1.type = 'triangle';
      osc1.frequency.value = 62;
      osc2.type = 'sine';
      osc2.frequency.value = 31;

      // Rotor blade chop LFO modulating both tone filter and noise gain
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 11.5; // Rotor chop Hz

      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.28;

      const filterLfoGain = ctx.createGain();
      filterLfoGain.gain.value = 130;

      lfo.connect(lfoGain);
      lfoGain.connect(nGain.gain);
      lfo.connect(filterLfoGain);
      filterLfoGain.connect(nFilter.frequency);

      lfo.start(now);
      this.lfoOsc = lfo;
      this.lfoDepth = lfoGain;
    } else if (vehicle === 'airplane') {
      osc1.type = 'sawtooth';
      osc1.frequency.value = 96;
      osc2.type = 'triangle';
      osc2.frequency.value = 144; // Fifth harmonic hum
    } else {
      // Rocket
      osc1.type = 'sawtooth';
      osc1.frequency.value = 54;
      osc2.type = 'sine';
      osc2.frequency.value = 108;
    }

    const oscGain = ctx.createGain();
    oscGain.gain.value = vehicle === 'helicopter' ? 0.22 : vehicle === 'airplane' ? 0.14 : 0.16;

    osc1.connect(oscGain);
    osc2.connect(oscGain);
    oscGain.connect(filter);

    osc1.start(now);
    osc2.start(now);
    this.primaryOsc = osc1;
    this.subOsc = osc2;
  }

  public updateEngine(speedRatio: number, vehicle: VehicleType): void {
    if (!this.engineActive || !this.ctx) return;
    const clamped = Math.max(0, Math.min(1.5, speedRatio));
    const now = this.ctx.currentTime;

    if (this.engineGroupGain) {
      // Slightly quieter when hovering still, fuller when flying fast
      const targetVol = vehicle === 'helicopter' ? 0.18 + clamped * 0.14 : 0.12 + clamped * 0.18;
      this.engineGroupGain.gain.setTargetAtTime(targetVol, now, 0.08);
    }

    if (vehicle === 'helicopter') {
      if (this.lfoOsc) {
        this.lfoOsc.frequency.setTargetAtTime(10.5 + clamped * 5.2, now, 0.08);
      }
      if (this.primaryOsc) {
        this.primaryOsc.frequency.setTargetAtTime(58 + clamped * 16, now, 0.08);
      }
      if (this.noiseFilter) {
        this.noiseFilter.frequency.setTargetAtTime(220 + clamped * 210, now, 0.08);
      }
    } else if (vehicle === 'airplane') {
      if (this.primaryOsc) {
        this.primaryOsc.frequency.setTargetAtTime(88 + clamped * 44, now, 0.1);
      }
      if (this.subOsc) {
        this.subOsc.frequency.setTargetAtTime(132 + clamped * 66, now, 0.1);
      }
      if (this.noiseFilter) {
        this.noiseFilter.frequency.setTargetAtTime(280 + clamped * 420, now, 0.1);
      }
    } else {
      // Rocket
      if (this.primaryOsc) {
        this.primaryOsc.frequency.setTargetAtTime(48 + clamped * 26, now, 0.08);
      }
      if (this.noiseFilter) {
        this.noiseFilter.frequency.setTargetAtTime(340 + clamped * 540, now, 0.08);
      }
    }
  }

  public stopEngine(): void {
    if (!this.engineActive) return;
    this.engineActive = false;

    const nodesToStop = [this.primaryOsc, this.subOsc, this.lfoOsc, this.noiseSource];
    for (const node of nodesToStop) {
      if (node) {
        try {
          node.stop();
          node.disconnect();
        } catch {
          // Ignore already stopped nodes
        }
      }
    }
    this.engineGroupGain?.disconnect();
    this.engineFilter?.disconnect();
    this.noiseFilter?.disconnect();
    this.noiseGain?.disconnect();
    this.lfoDepth?.disconnect();

    this.primaryOsc = null;
    this.subOsc = null;
    this.lfoOsc = null;
    this.lfoDepth = null;
    this.noiseSource = null;
    this.noiseFilter = null;
    this.noiseGain = null;
    this.engineFilter = null;
    this.engineGroupGain = null;
  }

  public playProximityPing(): void {
    const nowMs = performance.now();
    if (nowMs - this.lastPingTime < 350) return;
    this.lastPingTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playSuccess(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.24, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  public playPenalty(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    [0, 0.14].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const start = now + offset;
      osc.frequency.setValueAtTime(195, start);
      osc.frequency.linearRampToValueAtTime(145, start + 0.11);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.14);
    });
  }

  public playLevelComplete(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.26, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.48);
    });
  }
}

export const soundEngine = new FlightSoundEngine();
