import React, { useState } from 'react';
import { X, RotateCcw, Check, Sparkles, Sliders, Headphones } from 'lucide-react';
import { audioEngine, EQ_FREQUENCIES, EQ_PRESETS } from '../services/audioEngine';
import { AudioEngineSettings } from '../types/music';

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
  if (!isOpen) return null;

  const [activePreset, setActivePreset] = useState<string>('custom');

  const handleBandChange = (index: number, val: number) => {
    const updated = [...settings.eqGains];
    updated[index] = val;
    audioEngine.setEQGains(updated);
    onUpdateSettings({ eqGains: updated });
    setActivePreset('custom');
  };

  const handleResetBands = () => {
    const flat = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    audioEngine.setEQGains(flat);
    audioEngine.setPreampGain(0);
    onUpdateSettings({ eqGains: flat, preampGain: 0 });
    setActivePreset('flat');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-2xl bg-[#0f121a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 px-6 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">10-BAND HIFI DSP EQUALIZER</h2>
              <p className="text-[10px] text-slate-400 font-mono">Biquad Filter Pipeline • Studio Curve</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* EQ Power Switch */}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
              <span>Bypass</span>
              <input
                type="checkbox"
                checked={settings.isEqEnabled}
                onChange={(e) => handleToggleEq(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 accent-sky-500 cursor-pointer"
              />
            </label>

            <button
              onClick={handleResetBands}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Reset all bands to 0 dB"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Preset Selector */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Acoustic Tuning Presets
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EQ_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left truncate transition-colors cursor-pointer border ${
                    activePreset === preset.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-white/[0.03] text-slate-300 border-white/[0.06] hover:bg-white/[0.06]'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* 10-Band Sliders */}
          <div className="bg-black/30 border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-4 px-2">
              <span>+12 dB</span>
              <span className="text-slate-400">0 dB (Reference)</span>
              <span>-12 dB</span>
            </div>

            <div className="grid grid-cols-10 gap-2 items-center h-48">
              {EQ_FREQUENCIES.map((freqDef, i) => {
                const gain = settings.eqGains[i] || 0;
                return (
                  <div key={freqDef.freq} className="flex flex-col items-center h-full justify-between">
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
                        onChange={(e) => handleBandChange(i, parseInt(e.target.value, 10))}
                        className="w-32 -rotate-90 origin-center cursor-pointer disabled:opacity-40"
                      />
                    </div>

                    <div className="text-center mt-1">
                      <span className="text-[10px] font-mono text-slate-400 font-medium">
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
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">Preamp Gain</span>
                <span className="text-xs font-mono text-amber-400 font-bold">
                  {settings.preampGain > 0 ? `+${settings.preampGain} dB` : `${settings.preampGain} dB`}
                </span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={settings.preampGain}
                onChange={(e) => handlePreampChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 mt-2">
                Adjusts input stage gain before digital filtering.
              </span>
            </div>

            {/* Spatial Audio / Haas Staging */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-300">Binaural 3D Stage</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.isSpatialAudioEnabled}
                  onChange={(e) => handleToggleSpatial(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 accent-indigo-500 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Mid/side matrix with a 15ms Haas delay on the side signal to expand the
                stereo soundstage for headphones.
              </p>

              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-slate-400">Stereo Width</span>
                  <span className="text-[11px] font-mono text-indigo-300 font-bold">
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
                  onChange={(e) => handleStereoWidthChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full cursor-pointer disabled:opacity-40"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-600 mt-1">
                  <span>MONO</span>
                  <span>1.0 NEUTRAL</span>
                  <span>WIDE</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            32-bit floating point processing pipeline
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-500 text-black text-xs font-bold hover:bg-sky-400 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
