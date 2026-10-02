import { AudioEngineSettings, EQBand, EQPreset, Track } from '../types/music';

export const EQ_FREQUENCIES: { freq: number; label: string; type: BiquadFilterType }[] = [
  { freq: 32, label: '32Hz', type: 'lowshelf' },
  { freq: 64, label: '64Hz', type: 'peaking' },
  { freq: 125, label: '125Hz', type: 'peaking' },
  { freq: 250, label: '250Hz', type: 'peaking' },
  { freq: 500, label: '500Hz', type: 'peaking' },
  { freq: 1000, label: '1kHz', type: 'peaking' },
  { freq: 2000, label: '2kHz', type: 'peaking' },
  { freq: 4000, label: '4kHz', type: 'peaking' },
  { freq: 8000, label: '8kHz', type: 'peaking' },
  { freq: 16000, label: '16kHz', type: 'highshelf' },
];

export const EQ_PRESETS: EQPreset[] = [
  { id: 'flat', name: 'Flat Reference', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'hires-clarity', name: 'Hi-Res Air & Clarity', gains: [1, 2, 0, -1, 0, 1, 3, 4, 5, 6] },
  { id: 'audiophile-warmth', name: 'Audiophile Vinyl Warmth', gains: [4, 4, 3, 2, 1, 0, -1, -1, 1, 2] },
  { id: 'bass-boost', name: 'Deep Sub-Bass Boost', gains: [7, 6, 4, 2, 0, 0, 0, 0, 1, 1] },
  { id: 'vocal-presence', name: 'Acoustic Vocal Stage', gains: [-2, -1, 0, 2, 4, 4, 3, 2, 1, 0] },
  { id: 'electronic-club', name: 'Electronic & D&B Club', gains: [6, 5, 2, 0, -1, 2, 3, 4, 5, 4] },
  { id: 'classical-hall', name: 'Concert Hall Spatial', gains: [3, 2, 1, 0, 0, 1, 2, 3, 4, 4] },
  { id: 'jazz-lounge', name: 'Late Night Jazz Lounge', gains: [3, 3, 1, 2, -1, 1, 2, 3, 2, 1] },
];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private audioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private preampGainNode: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private spatialSplitter: ChannelSplitterNode | null = null;
  private spatialMerger: ChannelMergerNode | null = null;
  private spatialDelay: DelayNode | null = null;
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  // Synthesizer node for procedural audiophile tracks when no audio blob exists
  private synthGainNode: GainNode | null = null;
  private synthIntervalId: number | null = null;
  private synthStartTime: number = 0;
  private isSynthPlaying: boolean = false;
  private currentTrack: Track | null = null;

  private onTimeUpdateCallback: ((time: number, duration: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onStateChangeCallback: ((isPlaying: boolean) => void) | null = null;

  private settings: AudioEngineSettings = {
    volume: 0.85,
    isMuted: false,
    preampGain: 0,
    eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    isEqEnabled: true,
    isSpatialAudioEnabled: false,
    spatialStereoWidth: 1.0,
    visualizerMode: 'spectrum',
  };

  private currentBlobUrl: string | null = null;

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.preload = 'auto';

    this.audioElement.addEventListener('timeupdate', () => {
      if (this.onTimeUpdateCallback && !this.isSynthPlaying) {
        this.onTimeUpdateCallback(this.audioElement.currentTime, this.audioElement.duration || 0);
      }
    });

    this.audioElement.addEventListener('ended', () => {
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    });

    this.audioElement.addEventListener('play', () => {
      this.updateMediaSessionPlaybackState('playing');
      this.onStateChangeCallback?.(true);
    });

    this.audioElement.addEventListener('pause', () => {
      this.updateMediaSessionPlaybackState('paused');
      this.onStateChangeCallback?.(false);
    });
  }

  /**
   * Initializes AudioContext upon user gesture
   */
  public async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.setupAudioGraph(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    return this.ctx;
  }

  private setupAudioGraph(ctx: AudioContext) {
    // 1. Source node from HTMLAudioElement
    this.sourceNode = ctx.createMediaElementSource(this.audioElement);

    // 2. Preamp gain node
    this.preampGainNode = ctx.createGain();
    const preampVal = Math.pow(10, this.settings.preampGain / 20);
    this.preampGainNode.gain.setValueAtTime(preampVal, ctx.currentTime);

    // 3. 10-Band EQ filters
    this.eqFilters = EQ_FREQUENCIES.map((freqDef, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = freqDef.type;
      filter.frequency.value = freqDef.freq;
      filter.Q.value = freqDef.type === 'peaking' ? 1.4 : 0.7;
      const gain = this.settings.isEqEnabled ? this.settings.eqGains[i] || 0 : 0;
      filter.gain.value = gain;
      return filter;
    });

    // 4. Spatial / Stereo expansion nodes
    this.spatialDelay = ctx.createDelay(0.05);
    this.spatialDelay.delayTime.value = 0.015; // 15ms Haas effect delay

    // 5. Master Gain node
    this.masterGainNode = ctx.createGain();
    const vol = this.settings.isMuted ? 0 : this.settings.volume;
    this.masterGainNode.gain.setValueAtTime(vol, ctx.currentTime);

    // 6. Analyser node for FFT and waveform visualizers
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.82;

    // Connect chain:
    // Source -> Preamp -> EQ Filter 0..9 -> Master Gain -> Analyser -> Destination
    let prevNode: AudioNode = this.sourceNode;

    prevNode.connect(this.preampGainNode);
    prevNode = this.preampGainNode;

    for (const filter of this.eqFilters) {
      prevNode.connect(filter);
      prevNode = filter;
    }

    prevNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);

    // Synth Gain node connects to Preamp as well so procedural audio travels through EQ and Analyser
    this.synthGainNode = ctx.createGain();
    this.synthGainNode.gain.setValueAtTime(0.4, ctx.currentTime);
    this.synthGainNode.connect(this.preampGainNode);
  }

  public async loadTrack(track: Track, autoPlay: boolean = true): Promise<void> {
    await this.ensureContext();
    this.currentTrack = track;
    this.stopSynth();

    // Revoke previous blob URL if needed
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    this.updateMediaSession(track);

    if (track.audioBlob) {
      this.currentBlobUrl = URL.createObjectURL(track.audioBlob);
      this.audioElement.src = this.currentBlobUrl;
      this.audioElement.load();
      if (autoPlay) {
        try {
          await this.audioElement.play();
        } catch {
          // Playback interaction policy
        }
      }
    } else if (track.audioUrl) {
      this.audioElement.src = track.audioUrl;
      this.audioElement.load();
      if (autoPlay) {
        try {
          await this.audioElement.play();
        } catch {
          // Playback error
        }
      }
    } else {
      // Procedural audiophile master synthesis
      this.audioElement.pause();
      this.audioElement.src = '';
      if (autoPlay) {
        this.startSynth(track);
      }
    }
  }

  /**
   * Generates rich audiophile synthesized acoustic/electronic pieces
   * in real-time when playing demo tracks offline.
   */
  private startSynth(track: Track) {
    if (!this.ctx || !this.synthGainNode) return;
    this.isSynthPlaying = true;
    this.synthStartTime = this.ctx.currentTime;
    this.updateMediaSessionPlaybackState('playing');
    this.onStateChangeCallback?.(true);

    const bpm = track.bpm || 100;
    const intervalMs = (60 / bpm) * 500; // 8th notes

    // Chord progressions per track style
    const isMajor = track.key?.includes('Major');
    const rootFreq = track.id.includes('solaris') ? 138.59 : track.id.includes('shibuya') ? 155.56 : track.id.includes('forest') ? 110.0 : 146.83; // D, Eb, A, D

    const scaleIntervals = isMajor ? [0, 4, 7, 11, 12, 16, 19] : [0, 3, 7, 10, 12, 15, 19];
    let step = 0;

    const playStep = () => {
      if (!this.isSynthPlaying || !this.ctx || !this.synthGainNode) return;

      const elapsed = this.ctx.currentTime - this.synthStartTime;
      const duration = track.duration || 120;

      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(elapsed % duration, duration);
      }

      if (elapsed >= duration) {
        this.stopSynth();
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
        return;
      }

      // Generate lush chord note
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      const noteOffset = scaleIntervals[step % scaleIntervals.length];
      const octaveMult = (step % 4 === 0) ? 0.5 : (step % 3 === 0) ? 2 : 1;
      const freq = rootFreq * Math.pow(2, noteOffset / 12) * octaveMult;

      osc.type = track.id.includes('solaris') ? 'triangle' : track.id.includes('hyperdrive') ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(track.id.includes('shibuya') ? 1800 : 3800, this.ctx.currentTime);

      const now = this.ctx.currentTime;
      const attack = 0.08;
      const release = (intervalMs / 1000) * 1.5;

      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.exponentialRampToValueAtTime(0.25, now + attack);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + release);

      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.synthGainNode);

      osc.start(now);
      osc.stop(now + release);

      // Sub-bass kick on 1 and 3 beats
      if (step % 2 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(rootFreq * 0.5, now);
        bassOsc.frequency.exponentialRampToValueAtTime(35, now + 0.3);

        bassGain.gain.setValueAtTime(0.35, now);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        bassOsc.connect(bassGain);
        bassGain.connect(this.synthGainNode);
        bassOsc.start(now);
        bassOsc.stop(now + 0.35);
      }

      step++;
    };

    playStep();
    this.synthIntervalId = window.setInterval(playStep, intervalMs);
  }

  private stopSynth() {
    this.isSynthPlaying = false;
    if (this.synthIntervalId !== null) {
      clearInterval(this.synthIntervalId);
      this.synthIntervalId = null;
    }
  }

  public async play(): Promise<void> {
    await this.ensureContext();
    if (this.currentTrack && !this.currentTrack.audioBlob && !this.currentTrack.audioUrl) {
      if (!this.isSynthPlaying) {
        this.startSynth(this.currentTrack);
      }
    } else {
      await this.audioElement.play();
    }
    this.updateMediaSessionPlaybackState('playing');
    this.onStateChangeCallback?.(true);
  }

  public pause(): void {
    if (this.isSynthPlaying) {
      this.stopSynth();
      this.onStateChangeCallback?.(false);
      this.updateMediaSessionPlaybackState('paused');
    } else {
      this.audioElement.pause();
    }
  }

  public isPlaying(): boolean {
    if (this.isSynthPlaying) return true;
    return !this.audioElement.paused && !this.audioElement.ended;
  }

  public seek(seconds: number): void {
    if (this.isSynthPlaying) {
      if (this.ctx) {
        this.synthStartTime = this.ctx.currentTime - seconds;
      }
    } else {
      this.audioElement.currentTime = Math.max(0, Math.min(seconds, this.audioElement.duration || seconds));
    }
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(seconds, this.getDuration());
    }
  }

  public getCurrentTime(): number {
    if (this.isSynthPlaying) {
      if (!this.ctx) return 0;
      const elapsed = this.ctx.currentTime - this.synthStartTime;
      const dur = this.currentTrack?.duration || 120;
      return elapsed % dur;
    }
    return this.audioElement.currentTime || 0;
  }

  public getDuration(): number {
    if (this.isSynthPlaying) {
      return this.currentTrack?.duration || 120;
    }
    return this.audioElement.duration || this.currentTrack?.duration || 0;
  }

  public setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    if (!this.settings.isMuted && this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setValueAtTime(this.settings.volume, this.ctx.currentTime);
    }
    this.audioElement.volume = this.settings.volume;
  }

  public setMuted(isMuted: boolean): void {
    this.settings.isMuted = isMuted;
    if (this.masterGainNode && this.ctx) {
      const vol = isMuted ? 0 : this.settings.volume;
      this.masterGainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
    this.audioElement.muted = isMuted;
  }

  public setPreampGain(dB: number): void {
    this.settings.preampGain = Math.max(-12, Math.min(12, dB));
    if (this.preampGainNode && this.ctx) {
      const val = Math.pow(10, this.settings.preampGain / 20);
      this.preampGainNode.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  public setEQGains(gains: number[]): void {
    this.settings.eqGains = [...gains];
    if (!this.ctx) return;
    this.eqFilters.forEach((filter, i) => {
      const gain = this.settings.isEqEnabled ? gains[i] || 0 : 0;
      filter.gain.setValueAtTime(gain, this.ctx!.currentTime);
    });
  }

  public setEQEnabled(enabled: boolean): void {
    this.settings.isEqEnabled = enabled;
    this.setEQGains(this.settings.eqGains);
  }

  public setSpatialAudioEnabled(enabled: boolean): void {
    this.settings.isSpatialAudioEnabled = enabled;
    // When spatial audio is enabled, adjust Q and slight stereo width
    if (this.spatialDelay && this.ctx) {
      this.spatialDelay.delayTime.setValueAtTime(enabled ? 0.02 : 0, this.ctx.currentTime);
    }
  }

  public getSettings(): AudioEngineSettings {
    return { ...this.settings };
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  // Callbacks
  public onTimeUpdate(cb: (time: number, duration: number) => void): void {
    this.onTimeUpdateCallback = cb;
  }

  public onEnded(cb: () => void): void {
    this.onEndedCallback = cb;
  }

  public onStateChange(cb: (isPlaying: boolean) => void): void {
    this.onStateChangeCallback = cb;
  }

  // Native macOS MediaSession API integration
  private updateMediaSession(track: Track): void {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: `${track.album} • [${track.format} ${track.bitDepth}b/${Math.round(track.sampleRate / 1000)}kHz]`,
        artwork: track.coverArtUrl
          ? [{ src: track.coverArtUrl, sizes: '512x512', type: 'image/svg+xml' }]
          : [],
      });
    }
  }

  private updateMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none'): void {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  public registerMediaSessionHandlers(handlers: {
    play: () => void;
    pause: () => void;
    prev: () => void;
    next: () => void;
    seek: (to: number) => void;
  }): void {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', handlers.play);
        navigator.mediaSession.setActionHandler('pause', handlers.pause);
        navigator.mediaSession.setActionHandler('previoustrack', handlers.prev);
        navigator.mediaSession.setActionHandler('nexttrack', handlers.next);
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            handlers.seek(details.seekTime);
          }
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skipTime = details.seekOffset || 5;
          handlers.seek(Math.max(0, this.getCurrentTime() - skipTime));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skipTime = details.seekOffset || 5;
          handlers.seek(Math.min(this.getDuration(), this.getCurrentTime() + skipTime));
        });
      } catch {
        // Some handlers might not be supported in every browser
      }
    }
  }
}

export const audioEngine = new AudioEngine();
