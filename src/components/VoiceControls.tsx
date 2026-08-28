import React from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Square, Radio, Volume2 } from 'lucide-react';
import { ApolloState } from '../agent/types';
import { VoiceManager } from '../voice/voice-manager';

interface VoiceControlsProps {
  state: ApolloState;
  isListening: boolean;
  isSupported: boolean;
  liveTranscript?: string;
  isContinuous?: boolean;
  onToggleContinuous?: (enabled: boolean) => void;
  onStartListening: () => void;
  onStopListening: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  state,
  isListening,
  isSupported,
  liveTranscript,
  isContinuous = true,
  onToggleContinuous,
  onStartListening,
  onStopListening,
}) => {
  const isBusy = state === 'THINKING' || state === 'USING_TOOL';
  const isSpeaking = state === 'SPEAKING';

  const handleClick = () => {
    if (isListening) {
      onStopListening();
    } else {
      onStartListening();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2.5">
      {/* Live Transcript Banner */}
      {isListening && liveTranscript && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="max-w-lg px-4 py-1.5 bg-slate-900/90 border border-cyan-500/50 rounded-full text-xs text-cyan-200 font-mono text-center truncate backdrop-blur-md shadow-lg shadow-cyan-950/40"
        >
          <span className="text-cyan-400 font-semibold mr-1.5">VOICE DETECTED:</span>
          &ldquo;{liveTranscript}&rdquo;
        </motion.div>
      )}

      {/* Main Microphone Button & Radar Rings */}
      <div className="relative flex items-center justify-center">
        {/* Pulsing Sonar Ripple Rings when Listening */}
        {isListening && (
          <>
            <motion.div
              className="absolute w-24 h-24 rounded-full border border-cyan-400/60 pointer-events-none"
              animate={{ scale: [1, 1.6, 1.9], opacity: [0.9, 0.3, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute w-24 h-24 rounded-full border border-sky-400/40 pointer-events-none"
              animate={{ scale: [1, 1.4, 1.7], opacity: [0.8, 0.2, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut', delay: 0.4 }}
            />
          </>
        )}

        {/* Audio Frequency Wave Bars when Active */}
        {isListening && !isSpeaking && (
          <div className="absolute -bottom-2 flex items-center gap-1 z-10 pointer-events-none">
            {[0.4, 0.8, 1.2, 0.6, 1.0, 0.7, 0.3].map((delay, idx) => (
              <motion.span
                key={idx}
                className="w-1 bg-cyan-400 rounded-full"
                animate={{ height: ['4px', '16px', '6px', '18px', '4px'] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: delay * 0.15, ease: 'easeInOut' }}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={!isSupported || isBusy}
          onClick={handleClick}
          className={`relative group flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 shadow-xl focus:outline-none focus:ring-2 ${
            isListening
              ? 'bg-gradient-to-tr from-cyan-600 to-sky-500 hover:from-cyan-500 hover:to-sky-400 text-white shadow-cyan-900/60 ring-4 ring-cyan-500/30'
              : !isSupported
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : isBusy
              ? 'bg-indigo-900/70 text-indigo-300 border border-indigo-500/30 cursor-wait'
              : isSpeaking
              ? 'bg-emerald-600 text-white border border-emerald-400 ring-4 ring-emerald-500/30'
              : 'bg-gradient-to-tr from-slate-800 to-slate-700 hover:from-cyan-700 hover:to-sky-600 text-slate-200 hover:text-white shadow-slate-950/80 hover:scale-105 active:scale-95 border border-slate-600/50'
          }`}
          title={
            !isSupported
              ? 'Speech recognition unsupported'
              : isListening
              ? isContinuous
                ? 'Direct Voice Active (Tap to pause listening)'
                : 'Listening... (Tap to finish)'
              : 'Activate Direct Voice Detection'
          }
        >
          {isListening ? (
            <Radio className="w-6 h-6 animate-pulse text-white" />
          ) : isSpeaking ? (
            <Volume2 className="w-6 h-6 animate-bounce" />
          ) : !isSupported ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6 group-hover:scale-110 transition-transform" />
          )}
        </button>
      </div>

      {/* Status & Hands-Free Badge */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          {isListening ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 shadow-sm shadow-cyan-900/30">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              {isContinuous ? 'DIRECT VOICE ACTIVE • Speak freely' : 'Listening...'}
            </span>
          ) : isSpeaking ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-950/80 border border-emerald-500/50 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Apollo Speaking Response...
            </span>
          ) : isBusy ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-indigo-950/80 border border-indigo-500/50 text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              Apollo Processing...
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-mono tracking-wider">
              {!isSupported ? 'Microphone API Unavailable' : 'Tap to Activate Direct Voice'}
            </span>
          )}
        </div>

        {/* Hands-Free Mode Toggle Pill */}
        {isSupported && onToggleContinuous && (
          <button
            type="button"
            onClick={() => onToggleContinuous(!isContinuous)}
            className={`text-[10px] font-mono tracking-tight px-2 py-0.5 rounded transition-colors ${
              isContinuous
                ? 'text-cyan-400 hover:text-cyan-300 bg-slate-900/60 hover:bg-slate-900'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            Mode: {isContinuous ? 'Hands-Free Continuous (Auto-Detect)' : 'Push-to-Talk'}
          </button>
        )}
      </div>
    </div>
  );
};

