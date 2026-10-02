import { Dialog } from "./Dialog";
import React, { useState } from "react";
import {
  X,
  RotateCcw,
  Check,
  Sparkles,
  Sliders,
  Headphones,
} from "lucide-react";
import {
  audioEngine,
  EQ_FREQUENCIES,
  EQ_PRESETS,
} from "../services/audioEngine";
import { AudioEngineSettings } from "../types/music";

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AudioEngineSettings;
  onUpdateSettings: (newSettings: Partial<AudioEngineSettings>) => void;
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activePreset, setActivePreset] = useState<string>("custom");
  if (!isOpen) return null;

  const handleBandChange = (index: number, val: number) => {
    const updated = [...settings.eqGains];
    updated[index] = val;
    audioEngine.setEQGains(updated);
    onUpdateSettings({ eqGains: updated });
    setActivePreset("custom");
  };

  const handleResetBands = () => {
    const flat = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    audioEngine.setEQGains(flat);
    audioEngine.setPreampGain(0);
    onUpdateSettings({ eqGains: flat, preampGain: 0 });
    setActivePreset("flat");
  };

  const handleApplyPreset = (presetId: string) => {
    const p = EQ_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    audioEngine.setEQGains(p.gains);
    onUpdateSettings({ eqGains: p.gains });
    setActivePreset(p.id);
  };

  const handlePreampChange = (dB: number) => {
    audioEngine.setPreampGain(dB);
    onUpdateSettings({ preampGain: dB });
  };

  const handleToggleEq = (enabled: boolean) => {
    audioEngine.setEQEnabled(enabled);
    onUpdateSettings({ isEqEnabled: enabled });
  };

  const handleToggleSpatial = (enabled: boolean) => {
    audioEngine.setSpatialAudioEnabled(enabled);
    onUpdateSettings({ isSpatialAudioEnabled: enabled });
  };

  const handleStereoWidthChange = (width: number) => {
    audioEngine.setStereoWidth(width);
    onUpdateSettings({ spatialStereoWidth: width });
  };

  return (
    <Dialog onClose={onClose} label="Sound studio" className="standard-dialog">
      <div className="w-full max-w-2xl bg-[#fffdf9] border border-stone-900/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 px-6 border-b border-stone-900/[0.08] flex items-center justify-between bg-stone-900/[0.02]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-700" />
            <div>
              <h2 className="text-sm font-bold text-stone-800 tracking-wide">
                Your sound, your way.
              </h2>
              <p className="text-[10px] text-stone-500 font-mono">
                Equalizer & listening preferences
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* EQ Power Switch */}
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-600 cursor-pointer">
              <span>EQ on</span>
              <input
                type="checkbox"
                checked={settings.isEqEnabled}
                onChange={(e) => handleToggleEq(e.target.checked)}
                className="w-4 h-4 rounded bg-stone-200 accent-sky-500 cursor-pointer"
              />
            </label>

            <button
              onClick={handleResetBands}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-900/[0.06] transition-colors"
              title="Reset all bands to 0 dB"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              aria-label="Close dialog"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-900/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Preset Selector */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
              Acoustic Tuning Presets
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EQ_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left truncate transition-colors cursor-pointer border ${
                    activePreset === preset.id
                      ? "bg-amber-500/20 text-amber-700 border-amber-500/40 shadow-sm"
                      : "bg-stone-900/[0.03] text-stone-600 border-stone-900/[0.06] hover:bg-stone-900/[0.06]"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* 10-Band Sliders */}
          <div className="bg-stone-900/[0.03] border border-stone-900/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 mb-4 px-2">
              <span>+12 dB</span>
              <span className="text-stone-500">0 dB (Reference)</span>
              <span>-12 dB</span>
            </div>

            <div className="eq-bands">
              {EQ_FREQUENCIES.map((freqDef, i) => {
                const gain = settings.eqGains[i] || 0;
                return (
                  <div
                    key={freqDef.freq}
                    className="flex flex-col items-center h-full justify-between"
                  >
                    <span className="text-[10px] font-mono-numbers text-sky-400 font-semibold">
                      {gain > 0 ? `+${gain}` : gain}
                    </span>

                    {/* Vertical Range Slider */}
                    <div className="relative flex-1 flex items-center justify-center w-full py-2">
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={gain}
                        disabled={!settings.isEqEnabled}
                        onChange={(e) =>
                          handleBandChange(i, parseInt(e.target.value, 10))
                        }
                        aria-label={`${freqDef.label} gain`}
                        className="cursor-pointer disabled:opacity-40"
                      />
                    </div>

                    <div className="text-center mt-1">
                      <span className="text-[10px] font-mono text-stone-500 font-medium">
                        {freqDef.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preamp & Spatial Audio controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Preamp Gain */}
            <div className="bg-stone-900/[0.02] border border-stone-900/[0.06] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-stone-600">
                  Preamp Gain
                </span>
                <span className="text-xs font-mono text-amber-700 font-bold">
                  {settings.preampGain > 0
                    ? `+${settings.preampGain} dB`
                    : `${settings.preampGain} dB`}
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={settings.preampGain}
                onChange={(e) => handlePreampChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-stone-900/10 rounded-full cursor-pointer"
              />
              <span className="text-[10px] text-stone-500 mt-2">
                Adjusts input stage gain before digital filtering.
              </span>
            </div>

            {/* Spatial Audio / Haas Staging */}
            <div className="bg-stone-900/[0.02] border border-stone-900/[0.06] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-semibold text-stone-600">
                    Binaural 3D Stage
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.isSpatialAudioEnabled}
                  onChange={(e) => handleToggleSpatial(e.target.checked)}
                  className="w-4 h-4 rounded bg-stone-200 accent-indigo-500 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-stone-500 leading-relaxed">
                Mid/side matrix with a 15ms Haas delay on the side signal to
                expand the stereo soundstage for headphones.
              </p>

              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-stone-500">
                    Stereo Width
                  </span>
                  <span className="text-[11px] font-mono text-indigo-700 font-bold">
                    {settings.spatialStereoWidth.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={settings.spatialStereoWidth}
                  disabled={!settings.isSpatialAudioEnabled}
                  onChange={(e) =>
                    handleStereoWidthChange(parseFloat(e.target.value))
                  }
                  className="w-full h-1.5 bg-stone-900/10 rounded-full cursor-pointer disabled:opacity-40"
                />
                <div className="flex justify-between text-[9px] font-mono text-stone-400 mt-1">
                  <span>MONO</span>
                  <span>1.0 NEUTRAL</span>
                  <span>WIDE</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-stone-900/[0.02] border-t border-stone-900/[0.06] flex items-center justify-between">
          <span className="text-[11px] text-stone-500 font-mono">
            32-bit floating point processing pipeline
          </span>
          <button
            aria-label="Close dialog"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-bold hover:bg-sky-400 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
};
