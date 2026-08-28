import React, { useState, useEffect } from 'react';
import { VoiceManager, VOICE_PRESETS } from '../voice/voice-manager';
import { VoiceSettings, VoiceProfilePreset } from '../voice/types';
import { ProviderManager } from '../ai/provider';
import { SessionStorage } from '../storage/sessions';
import { ApolloMemory } from '../memory/memory';
import { db } from '../storage/database';
import { Settings as SettingsIcon, Volume2, Cpu, Sliders, Trash2, X, RefreshCw, Check, AlertCircle, Bot, Sparkles, Mic } from 'lucide-react';

interface SettingsProps {
  onClose?: () => void;
  onDataChanged?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose, onDataChanged }) => {
  const voiceManager = VoiceManager.getInstance();
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(voiceManager.getSettings());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; model?: string; error?: string } | null>(null);
  const [testingAi, setTestingAi] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);

  useEffect(() => {
    // Load voices
    const updateVoices = () => {
      const available = voiceManager.getAvailableVoices();
      setVoices(available);
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    // Check AI status
    checkAi();
  }, []);

  const checkAi = async () => {
    setTestingAi(true);
    const provider = ProviderManager.getProvider();
    const status = await provider.isAvailable();
    setAiStatus({
      available: status.available,
      error: status.error,
      model: provider.name,
    });
    setTestingAi(false);
  };

  const handleVoiceSettingChange = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    const updated = { ...voiceSettings, [key]: value };
    setVoiceSettings(updated);
    voiceManager.updateSettings({ [key]: value });
  };

  const handleSelectPreset = (presetKey: VoiceProfilePreset) => {
    voiceManager.applyPreset(presetKey);
    setVoiceSettings(voiceManager.getSettings());
  };

  const handleTestSpeech = () => {
    setTestingVoice(true);
    const testPhrase =
      voiceSettings.voicePreset === 'titan_mech'
        ? 'Welcome. Protocol accepted. Systems online. Apollo cyber-robotic voice matrix engaged.'
        : voiceSettings.voicePreset === 'deep_robotic'
        ? 'Apollo deep male robotic voice synthesizer online. All systems initialized and standing by.'
        : voiceSettings.voicePreset === 'ultra_deep'
        ? 'Apollo sub-bass robotic synthesis active. All core systems operational.'
        : voiceSettings.voicePreset === 'jarvis'
        ? 'Good day. J.A.R.V.I.S. neural speech synthesis active. All systems calibrated and ready for your command.'
        : 'Apollo natural male vocal matrix active and ready.';
        
    voiceManager.speakResponse(testPhrase, () => {
      setTestingVoice(false);
    });
  };

  const handleClearSessions = () => {
    if (window.confirm('Are you sure you want to delete all chat conversations?')) {
      SessionStorage.clearAllSessions();
      onDataChanged?.();
    }
  };

  const handleClearMemory = () => {
    if (window.confirm('Are you sure you want to erase all Apollo long-term memories?')) {
      ApolloMemory.clearMemory();
      onDataChanged?.();
    }
  };

  const handleClearAllData = () => {
    if (window.confirm('WARNING: This will permanently delete all Apollo sessions, memories, and custom configurations. Proceed?')) {
      db.clearAllApolloData();
      onDataChanged?.();
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-slate-100">Apollo System Settings</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:text-slate-100 text-slate-400 rounded-lg hover:bg-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
        {/* Section 1: AI Provider */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm border-b border-slate-800/80 pb-1.5">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>AI Intelligence Provider</span>
          </div>

          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-300 font-medium font-sans">Active Model:</span>
                <p className="text-slate-400 font-mono text-[11px]">{aiStatus?.model || 'Google Gemini (Flash Cascade)'}</p>
              </div>
              <button
                type="button"
                onClick={checkAi}
                disabled={testingAi}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 font-mono text-[11px] transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${testingAi ? 'animate-spin' : ''}`} />
                <span>Test Link</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2 text-[11px] font-mono">
              {aiStatus ? (
                aiStatus.available ? (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Gemini API Online & Configured</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{aiStatus.error || 'Gemini is not configured.'}</span>
                  </div>
                )
              ) : (
                <span className="text-slate-500">Checking status...</span>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Voice & Speech */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm border-b border-slate-800/80 pb-1.5">
            <Volume2 className="w-4 h-4 text-purple-400" />
            <span>Voice & Audio Synthesis (J.A.R.V.I.S. Engine)</span>
          </div>

          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
            {/* Voice Enabled Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-200 font-medium block">Voice Output Enabled</span>
                <span className="text-slate-500 text-[11px]">Speak Apollo responses aloud in deep Jarvis/robotic tone</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceSettings.voiceEnabled}
                  onChange={(e) => handleVoiceSettingChange('voiceEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>

            {/* Voice Presets Grid */}
            <div>
              <label className="text-slate-400 block mb-1.5 text-xs font-medium">Voice Archetype Preset</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(VOICE_PRESETS) as VoiceProfilePreset[])
                  .filter((k) => k !== 'custom')
                  .map((presetKey) => {
                    const preset = VOICE_PRESETS[presetKey];
                    const isSelected = voiceSettings.voicePreset === presetKey;
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => handleSelectPreset(presetKey)}
                        className={`p-2.5 text-left rounded-lg border transition-all text-xs flex flex-col justify-between ${
                          isSelected
                            ? 'bg-sky-950/60 border-sky-500/80 text-sky-200 shadow-sm shadow-sky-500/20'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                            {presetKey === 'titan_mech' && <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
                            {presetKey === 'deep_robotic' && <Bot className="w-3.5 h-3.5 text-sky-400" />}
                            {presetKey === 'ultra_deep' && <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
                            {presetKey === 'jarvis' && <Bot className="w-3.5 h-3.5 text-indigo-400" />}
                            {presetKey === 'standard_male' && <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                            {preset.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" />}
                        </div>
                        <span className="text-[10.5px] text-slate-400 line-clamp-2 leading-relaxed">
                          {preset.description}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Sound FX Telemetry Switch */}
            <div className="flex items-center justify-between py-1">
              <div>
                <label className="text-slate-300 font-medium text-xs block">Robotic Telemetry Audio Effects</label>
                <span className="text-slate-500 text-[11px] block">Play cybernetic comms activation chirp before speech</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceSettings.soundEffectsEnabled !== false}
                  onChange={(e) => handleVoiceSettingChange('soundEffectsEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            {/* Direct Hands-Free Voice Detection Switch */}
            <div className="flex items-center justify-between py-1 border-t border-slate-800/60 pt-2">
              <div>
                <label className="text-slate-200 font-medium text-xs block flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  Direct Hands-Free Voice Detection
                </label>
                <span className="text-slate-400 text-[11px] block">Detect voice continuously without repeatedly pressing "Tap to Speak"</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceSettings.continuousListening !== false}
                  onChange={(e) => handleVoiceSettingChange('continuousListening', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Wake Word Filter Toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <label className="text-slate-300 font-medium text-xs block">Wake Word Activation Only</label>
                <span className="text-slate-500 text-[11px] block">Require &ldquo;Apollo&rdquo; or &ldquo;Hey Apollo&rdquo; vs Open Mic direct speech</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(voiceSettings.wakeWordEnabled)}
                  onChange={(e) => handleVoiceSettingChange('wakeWordEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Voice Selection */}
            {voices.length > 0 && (
              <div>
                <label className="text-slate-400 block mb-1">Synthesizer Voice Device</label>
                <select
                  value={voiceSettings.selectedVoiceURI}
                  onChange={(e) => {
                    handleVoiceSettingChange('selectedVoiceURI', e.target.value);
                    handleVoiceSettingChange('voicePreset', 'custom');
                  }}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-sky-500 font-sans text-xs"
                >
                  <option value="">Auto-Select Best Male / J.A.R.V.I.S. Voice (Recommended)</option>
                  {voices.map((v, idx) => (
                    <option key={`${v.voiceURI || v.name}-${v.lang}-${idx}`} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sliders: Pitch (Deep / Low frequency resonance) */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1 font-mono text-[11px]">
                <span className="flex items-center gap-1.5">
                  Pitch (Vocal Depth)
                  {voiceSettings.pitch <= 0.30 ? (
                    <span className="text-cyan-400 text-[10px] font-sans font-medium px-1 bg-cyan-950/40 rounded border border-cyan-800/40">Titan Sub-Bass</span>
                  ) : voiceSettings.pitch <= 0.55 ? (
                    <span className="text-amber-400 text-[10px] font-sans font-medium px-1 bg-amber-950/40 rounded border border-amber-800/40">Deep Baritone</span>
                  ) : voiceSettings.pitch <= 0.82 ? (
                    <span className="text-sky-400 text-[10px] font-sans font-medium px-1 bg-sky-950/40 rounded border border-sky-800/40">J.A.R.V.I.S.</span>
                  ) : (
                    <span className="text-slate-400 text-[10px] font-sans font-medium px-1 bg-slate-800 rounded">Standard</span>
                  )}
                </span>
                <span>{voiceSettings.pitch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.30"
                step="0.02"
                value={voiceSettings.pitch}
                onChange={(e) => {
                  handleVoiceSettingChange('pitch', parseFloat(e.target.value));
                  handleVoiceSettingChange('voicePreset', 'custom');
                }}
                className="w-full accent-cyan-500 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>0.10 (Titan Mech)</span>
                <span>0.44 (Deep Robotic)</span>
                <span>0.76 (Jarvis)</span>
                <span>1.30 (High)</span>
              </div>
            </div>

            {/* Sliders: Speech Rate */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1 font-mono text-[11px]">
                <span>Speech Cadence</span>
                <span>{voiceSettings.speechRate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.02"
                value={voiceSettings.speechRate}
                onChange={(e) => {
                  handleVoiceSettingChange('speechRate', parseFloat(e.target.value));
                  handleVoiceSettingChange('voicePreset', 'custom');
                }}
                className="w-full accent-sky-500 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Sliders: Volume */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1 font-mono text-[11px]">
                <span>Volume</span>
                <span>{Math.round(voiceSettings.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={voiceSettings.volume}
                onChange={(e) => handleVoiceSettingChange('volume', parseFloat(e.target.value))}
                className="w-full accent-sky-500 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Test Voice Button */}
            <button
              type="button"
              onClick={handleTestSpeech}
              disabled={testingVoice || !voiceSettings.voiceEnabled}
              className="w-full py-2 bg-sky-950/60 hover:bg-sky-900/70 border border-sky-700/60 text-sky-200 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Volume2 className="w-4 h-4 text-sky-400 animate-pulse" />
              <span>{testingVoice ? 'Speaking Test Audio...' : 'Test Deep Voice Output'}</span>
            </button>
          </div>
        </div>

        {/* Section 3: Data Management */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm border-b border-slate-800/80 pb-1.5">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Data Storage & Privacy</span>
          </div>

          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-slate-200 block font-medium">Clear Conversations</span>
                <span className="text-slate-500 text-[11px]">Delete all chat sessions</span>
              </div>
              <button
                type="button"
                onClick={handleClearSessions}
                className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 border border-slate-700 rounded text-slate-300 transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
              <div>
                <span className="text-slate-200 block font-medium">Clear Long-Term Memory</span>
                <span className="text-slate-500 text-[11px]">Wipe saved facts and keys</span>
              </div>
              <button
                type="button"
                onClick={handleClearMemory}
                className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 border border-slate-700 rounded text-slate-300 transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
              <div>
                <span className="text-rose-400 block font-medium">Reset All Apollo Data</span>
                <span className="text-slate-500 text-[11px]">Restore factory settings</span>
              </div>
              <button
                type="button"
                onClick={handleClearAllData}
                className="px-2.5 py-1 bg-rose-900/40 hover:bg-rose-900 text-rose-200 border border-rose-700/60 rounded transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
