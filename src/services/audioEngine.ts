import { AudioEngineSettings, EQPreset, Track } from '../types/music';

/**
 * iPhone and iPad (iPadOS reports itself as a Mac, but has touch). WebKit
 * suspends Web Audio when the app goes to the background, which silences
 * anything routed through an AudioContext. There, the player skips the
 * effects graph and plays the media element directly so music keeps going.
 */
export const isAppleMobile =
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0));

/** EQ, preamp and stereo width need Web Audio; off on iPhone and iPad. */
export const supportsAudioEffects = !isAppleMobile;

/** iOS ignores media-element volume; only the hardware buttons change it. */
export const supportsVolumeControl = !isAppleMobile;

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
  private spatialInput: GainNode | null = null;
  private spatialSplitter: ChannelSplitterNode | null = null;
  private spatialMerger: ChannelMergerNode | null = null;
  private spatialDelay: DelayNode | null = null;
  private spatialMidGain: GainNode | null = null;
  private spatialSideLGain: GainNode | null = null;
  private spatialSideRGain: GainNode | null = null;
  private spatialSideSum: GainNode | null = null;
  private spatialWidthPos: GainNode | null = null;
  private spatialWidthNeg: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

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
    spatialStereoWidth: 1.5,
    visualizerMode: 'spectrum',
    playbackRate: 1,
  };

  private currentBlobUrl: string | null = null;

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.preload = 'auto';

    // Safari 16.4+: declare a music-playback session, so audio continues in
    // the background and ignores the ring/silent switch.
    const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (audioSession) {
      try {
        audioSession.type = 'playback';
      } catch {
        // Older WebKit exposes the object but rejects the type.
      }
    }

    this.audioElement.addEventListener('timeupdate', () => {
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.audioElement.currentTime, this.audioElement.duration || 0);
      }
      this.updateMediaSessionPosition();
    });
    this.audioElement.addEventListener('ratechange', () => this.updateMediaSessionPosition());
    this.audioElement.addEventListener('loadedmetadata', () => this.updateMediaSessionPosition());

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
   * Initializes AudioContext upon user gesture. Returns null on iPhone and
   * iPad, where the element plays directly (see isAppleMobile).
   */
  public async ensureContext(): Promise<AudioContext | null> {
    if (!supportsAudioEffects) return null;
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

    // 4. Spatial / Stereo expansion stage (mid-side matrix)
    //
    //    L_out = M + S * width        M = (L + R) / 2
    //    R_out = M - S * width        S = (L - R) / 2
    //
    // At width = 1 and zero side delay this matrix is an exact identity, so the
    // stage stays permanently wired and "bypass" simply means neutral settings.
    // The Haas delay sits on the side signal only, which widens the image
    // without unbalancing the left/right levels.
    const spatialInput = ctx.createGain();
    // Force a stereo frame so mono sources are up-mixed to both channels before
    // the splitter (which is 'discrete' and would otherwise leave R silent).
    spatialInput.channelCount = 2;
    spatialInput.channelCountMode = 'explicit';
    spatialInput.channelInterpretation = 'speakers';

    const spatialSplitter = ctx.createChannelSplitter(2);
    const spatialMerger = ctx.createChannelMerger(2);

    const spatialMidGain = ctx.createGain();
    spatialMidGain.gain.value = 0.5;

    const spatialSideLGain = ctx.createGain();
    spatialSideLGain.gain.value = 0.5;
    const spatialSideRGain = ctx.createGain();
    spatialSideRGain.gain.value = -0.5;
    const spatialSideSum = ctx.createGain();
    spatialSideSum.gain.value = 1;

    const spatialDelay = ctx.createDelay(0.05);
    spatialDelay.delayTime.value = 0; // neutral until spatial audio is enabled

    const initialWidth = this.settings.isSpatialAudioEnabled
      ? this.settings.spatialStereoWidth
      : 1;
    const spatialWidthPos = ctx.createGain();
    spatialWidthPos.gain.value = initialWidth;
    const spatialWidthNeg = ctx.createGain();
    spatialWidthNeg.gain.value = -initialWidth;

    this.spatialInput = spatialInput;
    this.spatialSplitter = spatialSplitter;
    this.spatialMerger = spatialMerger;
    this.spatialMidGain = spatialMidGain;
    this.spatialSideLGain = spatialSideLGain;
    this.spatialSideRGain = spatialSideRGain;
    this.spatialSideSum = spatialSideSum;
    this.spatialDelay = spatialDelay;
    this.spatialWidthPos = spatialWidthPos;
    this.spatialWidthNeg = spatialWidthNeg;

    // 5. Master Gain node
    this.masterGainNode = ctx.createGain();
    const vol = this.settings.isMuted ? 0 : this.settings.volume;
    this.masterGainNode.gain.setValueAtTime(vol, ctx.currentTime);

    // 6. Analyser node for FFT and waveform visualizers
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 512;
    this.analyserNode.smoothingTimeConstant = 0.82;

    // Connect chain:
    // Source -> Preamp -> EQ 0..9 -> Spatial M/S -> Master Gain -> Analyser -> Destination
    let prevNode: AudioNode = this.sourceNode;

    prevNode.connect(this.preampGainNode);
    prevNode = this.preampGainNode;

    for (const filter of this.eqFilters) {
      prevNode.connect(filter);
      prevNode = filter;
    }

    prevNode.connect(spatialInput);

    // Mid: both channels summed at 0.5 -> (L + R) / 2
    spatialInput.connect(spatialSplitter);
    spatialSplitter.connect(spatialMidGain, 0);
    spatialSplitter.connect(spatialMidGain, 1);

    // Side: (L - R) / 2, then delayed and scaled by width
    spatialSplitter.connect(spatialSideLGain, 0);
    spatialSplitter.connect(spatialSideRGain, 1);
    spatialSideLGain.connect(spatialSideSum);
    spatialSideRGain.connect(spatialSideSum);
    spatialSideSum.connect(spatialDelay);
    spatialDelay.connect(spatialWidthPos);
    spatialDelay.connect(spatialWidthNeg);

    // Recombine: left = M + S*w, right = M - S*w
    spatialMidGain.connect(spatialMerger, 0, 0);
    spatialWidthPos.connect(spatialMerger, 0, 0);
    spatialMidGain.connect(spatialMerger, 0, 1);
    spatialWidthNeg.connect(spatialMerger, 0, 1);

    spatialMerger.connect(this.masterGainNode);
    this.masterGainNode.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);
  }

  public async loadTrack(track: Track, autoPlay: boolean = true): Promise<void> {
    await this.ensureContext();
    this.currentTrack = track;

    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    this.updateMediaSession(track);

    if (track.audioBlob) {
      this.currentBlobUrl = URL.createObjectURL(track.audioBlob);
      this.audioElement.src = this.currentBlobUrl;
    } else if (track.audioUrl) {
      this.audioElement.src = track.audioUrl;
    } else {
      this.audioElement.pause();
      this.audioElement.removeAttribute('src');
      return;
    }

    this.audioElement.load();
    // load() resets the rate to defaultPlaybackRate; set both so it sticks.
    this.applyPlaybackRate();
    if (autoPlay) {
      try {
        await this.audioElement.play();
      } catch {
        // Autoplay policy or an interrupting load; state events report it.
      }
    }
  }

  /**
   * Id of the track currently loaded into the engine, or null if loadTrack has
   * never run. Callers use this to tell "paused" apart from "nothing loaded".
   */
  public getLoadedTrackId(): string | null {
    return this.currentTrack?.id ?? null;
  }

  public async play(): Promise<void> {
    // Nothing has been loaded yet: calling play() on the empty audio element
    // would only reject, so leave it to the caller to loadTrack first.
    if (!this.currentTrack) return;

    await this.ensureContext();
    try {
      await this.audioElement.play();
    } catch {
      // AbortError when a pause() or a new load() interrupts this play();
      // the 'pause' listener already reports the resulting state.
      return;
    }
    this.updateMediaSessionPlaybackState('playing');
    this.onStateChangeCallback?.(true);
  }

  public pause(): void {
    this.audioElement.pause();
  }

  public isPlaying(): boolean {
    return !this.audioElement.paused && !this.audioElement.ended;
  }

  public seek(seconds: number): void {
    this.audioElement.currentTime = Math.max(0, Math.min(seconds, this.audioElement.duration || seconds));
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(seconds, this.getDuration());
    }
  }

  public getCurrentTime(): number {
    return this.audioElement.currentTime || 0;
  }

  public getDuration(): number {
    return this.audioElement.duration || this.currentTrack?.duration || 0;
  }

  public setPlaybackRate(rate: number): void {
    this.settings.playbackRate = Math.max(0.25, Math.min(4, rate || 1));
    this.applyPlaybackRate();
  }

  private applyPlaybackRate(): void {
    this.audioElement.preservesPitch = true;
    this.audioElement.defaultPlaybackRate = this.settings.playbackRate;
    this.audioElement.playbackRate = this.settings.playbackRate;
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
    this.applySpatialStage();
  }

  /**
   * Stereo width for the mid/side stage. 0 = mono, 1 = untouched, 2 = very wide.
   * Only takes effect while spatial audio is enabled.
   */
  public setStereoWidth(width: number): void {
    this.settings.spatialStereoWidth = Math.max(0, Math.min(2, width));
    this.applySpatialStage();
  }

  /**
   * Pushes the current spatial settings into the M/S matrix. Disabled means
   * width = 1 and no side delay, which is a bit-exact identity.
   */
  private applySpatialStage(): void {
    if (!this.ctx || !this.spatialWidthPos || !this.spatialWidthNeg || !this.spatialDelay) {
      return;
    }

    const enabled = this.settings.isSpatialAudioEnabled;
    const width = enabled ? this.settings.spatialStereoWidth : 1;
    const sideDelay = enabled ? 0.015 : 0; // 15ms Haas delay on the side signal only
    const now = this.ctx.currentTime;

    // Short ramps instead of hard steps so toggling does not click.
    this.spatialWidthPos.gain.setTargetAtTime(width, now, 0.015);
    this.spatialWidthNeg.gain.setTargetAtTime(-width, now, 0.015);
    this.spatialDelay.delayTime.setTargetAtTime(sideDelay, now, 0.015);
  }

  /**
   * Restores saved settings. Safe before the audio graph exists: the graph
   * reads these values when it is built on the first play.
   */
  public applySettings(saved: Partial<AudioEngineSettings>): void {
    this.settings = { ...this.settings, ...saved };
    this.setVolume(this.settings.volume);
    this.setMuted(this.settings.isMuted);
    this.setPreampGain(this.settings.preampGain);
    this.setEQGains(this.settings.eqGains);
    this.applySpatialStage();
    this.setPlaybackRate(this.settings.playbackRate ?? 1);
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
        album: track.album,
        artwork: track.coverArtUrl
          ? [{ src: track.coverArtUrl, sizes: '512x512', type: track.coverArtBlob?.type || 'image/jpeg' }]
          : [],
      });
    }
  }

  /** Feeds the lock screen / Control Center scrubber. */
  private updateMediaSessionPosition(): void {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const duration = this.audioElement.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: this.audioElement.playbackRate || 1,
        position: Math.min(this.audioElement.currentTime, duration),
      });
    } catch {
      // Out-of-range values during a source change; the next update fixes it.
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
