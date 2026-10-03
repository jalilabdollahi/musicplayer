import React, { useState } from "react";
import { RotateCcw } from "lucide-react";
import { audioEngine, EQ_FREQUENCIES, EQ_PRESETS, supportsAudioEffects } from "../services/audioEngine";
import { AudioEngineSettings } from "../types/music";
import { Modal, Switch, cx } from "./ui";

interface EqualizerModalProps {
  onClose: () => void;
  settings: AudioEngineSettings;
  onUpdateSettings: (newSettings: Partial<AudioEngineSettings>) => void;
}

export function EqualizerModal({ onClose, settings, onUpdateSettings }: EqualizerModalProps) {
  const matchPreset = () => EQ_PRESETS.find((p) => p.gains.every((g, i) => g === settings.eqGains[i]))?.id ?? "custom";
  const [activePreset, setActivePreset] = useState<string>(matchPreset);

  const setBand = (index: number, value: number) => {
    const gains = [...settings.eqGains];
    gains[index] = value;
    audioEngine.setEQGains(gains);
    onUpdateSettings({ eqGains: gains });
    setActivePreset("custom");
  };

  const applyPreset = (id: string) => {
    const preset = EQ_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    audioEngine.setEQGains(preset.gains);
    onUpdateSettings({ eqGains: preset.gains });
    setActivePreset(id);
  };

  const reset = () => {
    const flat = new Array(10).fill(0);
    audioEngine.setEQGains(flat);
    audioEngine.setPreampGain(0);
    onUpdateSettings({ eqGains: flat, preampGain: 0 });
    setActivePreset("flat");
  };

  const fmt = (db: number) => (db > 0 ? `+${db}` : `${db}`);

  return (
    <Modal
      title="Equalizer"
      subtitle="Shape the sound to your headphones or speakers."
      onClose={onClose}
      width="max-w-2xl"
      actions={
        supportsAudioEffects && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-sm text-muted">{settings.isEqEnabled ? "On" : "Off"}</span>
            <Switch
              label="Equalizer on"
              checked={settings.isEqEnabled}
              onChange={(on) => {
                audioEngine.setEQEnabled(on);
                onUpdateSettings({ isEqEnabled: on });
              }}
            />
          </div>
        )
      }
    >
      {!supportsAudioEffects && (
        <p className="mb-5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm leading-relaxed">
          The equalizer isn't available on iPhone and iPad. Apple stops audio effects when the app goes to the background, so
          HighFi plays music without them to keep it playing.
        </p>
      )}
      {/* Disabling the fieldset disables every control inside it. */}
      <fieldset disabled={!supportsAudioEffects} className="m-0 min-w-0 border-0 p-0 disabled:opacity-40">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {EQ_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              disabled={!settings.isEqEnabled}
              className={cx(
                "h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition disabled:opacity-40",
                activePreset === preset.id ? "bg-fg text-bg" : "bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg",
              )}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-black/25 px-2 pt-4 pb-3 sm:px-4">
          <div className="grid grid-cols-10">
            {EQ_FREQUENCIES.map((band, i) => {
              const gain = settings.eqGains[i] || 0;
              return (
                <div key={band.freq} className="flex min-w-0 flex-col items-center">
                  <span className={cx("text-[11px] tabular-nums", gain === 0 ? "text-faint" : "font-semibold text-accent")}>{fmt(gain)}</span>
                  <div className="relative my-2 flex h-40 justify-center">
                    <span className="pointer-events-none absolute top-1/2 h-px w-4 bg-white/20" />
                    <input
                      type="range"
                      className="fader"
                      min={-12}
                      max={12}
                      step={1}
                      value={gain}
                      disabled={!settings.isEqEnabled}
                      onChange={(e) => setBand(i, parseInt(e.target.value, 10))}
                      aria-label={`${band.label} Hz`}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-muted sm:text-[11px]">{band.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Preamp</span>
              <span className="text-sm tabular-nums text-muted">{fmt(settings.preampGain)} dB</span>
            </div>
            <input
              type="range"
              className="range range-thumb mt-3"
              min={-12}
              max={12}
              step={0.5}
              value={settings.preampGain}
              onChange={(e) => {
                const db = parseFloat(e.target.value);
                audioEngine.setPreampGain(db);
                onUpdateSettings({ preampGain: db });
              }}
              aria-label="Preamp gain"
              style={{ "--progress": `${((settings.preampGain + 12) / 24) * 100}%` } as React.CSSProperties}
            />
            <p className="mt-2 text-xs text-faint">Lower it if boosted bands start to distort.</p>
          </div>

          <div className="rounded-2xl border border-line bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Wider stereo</span>
              <Switch
                label="Wider stereo"
                checked={settings.isSpatialAudioEnabled}
                onChange={(on) => {
                  audioEngine.setSpatialAudioEnabled(on);
                  onUpdateSettings({ isSpatialAudioEnabled: on });
                }}
              />
            </div>
            <input
              type="range"
              className="range range-thumb mt-3"
              min={0}
              max={2}
              step={0.05}
              value={settings.spatialStereoWidth}
              disabled={!settings.isSpatialAudioEnabled}
              onChange={(e) => {
                const width = parseFloat(e.target.value);
                audioEngine.setStereoWidth(width);
                onUpdateSettings({ spatialStereoWidth: width });
              }}
              aria-label="Stereo width"
              style={{ "--progress": `${(settings.spatialStereoWidth / 2) * 100}%` } as React.CSSProperties}
            />
            <p className="mt-2 text-xs text-faint">Opens up the stereo image on headphones. {settings.spatialStereoWidth.toFixed(2)}×</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={reset} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <RotateCcw size={14} /> Reset to flat
          </button>
        </div>
      </fieldset>
    </Modal>
  );
}
