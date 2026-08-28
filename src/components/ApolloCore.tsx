import React from 'react';
import { motion } from 'motion/react';
import { ApolloState } from '../agent/types';
import { Mic, Volume2, Cpu, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';

interface ApolloCoreProps {
  state: ApolloState;
  statusDetail?: string;
  isActive?: boolean;
  onCoreClick?: () => void;
}

export const ApolloCore: React.FC<ApolloCoreProps> = ({
  state,
  statusDetail,
  isActive = true,
  onCoreClick,
}) => {
  // Determine state-specific theme configuration
  const stateConfig = React.useMemo(() => {
    switch (state) {
      case 'LISTENING':
        return {
          label: 'Listening...',
          subtext: statusDetail || 'Listening to your voice',
          icon: Mic,
          primaryColor: '#38bdf8', // Sky blue
          glowColor: 'rgba(56, 189, 248, 0.45)',
          ringColor: 'border-sky-400/60',
          speedMultiplier: 1.5,
          scaleRange: [0.98, 1.06, 0.98],
        };
      case 'THINKING':
        return {
          label: 'Processing...',
          subtext: statusDetail || 'Formulating response',
          icon: Cpu,
          primaryColor: '#818cf8', // Indigo
          glowColor: 'rgba(129, 140, 248, 0.5)',
          ringColor: 'border-indigo-400/70',
          speedMultiplier: 2.5,
          scaleRange: [1, 1.03, 1],
        };
      case 'USING_TOOL':
        return {
          label: statusDetail || 'Using tool...',
          subtext: 'Executing agent tool',
          icon: Sparkles,
          primaryColor: '#f59e0b', // Amber/gold
          glowColor: 'rgba(245, 158, 11, 0.45)',
          ringColor: 'border-amber-400/70',
          speedMultiplier: 2.0,
          scaleRange: [0.99, 1.04, 0.99],
        };
      case 'SPEAKING':
        return {
          label: 'Speaking...',
          subtext: statusDetail || 'Audio output active',
          icon: Volume2,
          primaryColor: '#c084fc', // Purple/Violet
          glowColor: 'rgba(192, 132, 252, 0.55)',
          ringColor: 'border-purple-400/80',
          speedMultiplier: 1.8,
          scaleRange: [0.96, 1.08, 0.96],
        };
      case 'ERROR':
        return {
          label: 'Attention Required',
          subtext: statusDetail || 'System encountered an error',
          icon: AlertTriangle,
          primaryColor: '#f43f5e', // Rose/Red
          glowColor: 'rgba(244, 63, 94, 0.4)',
          ringColor: 'border-rose-500/60',
          speedMultiplier: 0.5,
          scaleRange: [1, 1.02, 1],
        };
      case 'IDLE':
      default:
        return {
          label: 'Apollo',
          subtext: statusDetail || 'Ready & Standing By',
          icon: CheckCircle2,
          primaryColor: '#38bdf8',
          glowColor: 'rgba(56, 189, 248, 0.25)',
          ringColor: 'border-sky-500/30',
          speedMultiplier: 1.0,
          scaleRange: [0.99, 1.02, 0.99],
        };
    }
  }, [state, statusDetail]);

  const IconComponent = stateConfig.icon;

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-6">
      {/* Outer Glow Backdrop */}
      <motion.div
        className="absolute w-72 h-72 rounded-full pointer-events-none blur-3xl"
        animate={{
          backgroundColor: stateConfig.glowColor,
          scale: state === 'LISTENING' || state === 'SPEAKING' ? 1.25 : 1.0,
        }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      />

      {/* Main Interactive Core Assembly */}
      <div
        onClick={onCoreClick}
        className="relative w-56 h-56 flex items-center justify-center cursor-pointer group"
        title="Apollo Core - Tap to interact"
      >
        {/* Outer Ring 1: Segmented Geometrical HUD */}
        <motion.div
          className={`absolute inset-0 rounded-full border border-dashed ${stateConfig.ringColor} opacity-70`}
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration: 28 / stateConfig.speedMultiplier,
            ease: 'linear',
          }}
        />

        {/* Outer Ring 2: Counter-rotating tick ring */}
        <motion.div
          className="absolute inset-3 rounded-full border border-sky-500/20 border-t-sky-400/80 border-b-indigo-400/80"
          animate={{ rotate: -360 }}
          transition={{
            repeat: Infinity,
            duration: 20 / stateConfig.speedMultiplier,
            ease: 'linear',
          }}
        />

        {/* Inner Ring 3: Fine Orbit */}
        <motion.div
          className="absolute inset-7 rounded-full border border-slate-700/60"
          animate={{
            scale: stateConfig.scaleRange,
          }}
          transition={{
            repeat: Infinity,
            duration: 2.5 / stateConfig.speedMultiplier,
            ease: 'easeInOut',
          }}
        />

        {/* Dynamic Waveform Visualizer (Active during LISTENING and SPEAKING) */}
        {(state === 'LISTENING' || state === 'SPEAKING') && (
          <div className="absolute inset-0 flex items-center justify-center gap-1 pointer-events-none">
            {[4, 8, 14, 22, 28, 22, 14, 8, 4].map((height, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full"
                style={{ backgroundColor: stateConfig.primaryColor }}
                animate={{
                  height: [
                    height * 0.4,
                    height * (state === 'SPEAKING' ? 1.4 : 1.1),
                    height * 0.4,
                  ],
                  opacity: [0.4, 0.95, 0.4],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.6 + (i % 3) * 0.2,
                  ease: 'easeInOut',
                  delay: i * 0.05,
                }}
              />
            ))}
          </div>
        )}

        {/* Center Sphere Core */}
        <motion.div
          className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-500 overflow-hidden"
          style={{
            background: `radial-gradient(circle, rgba(15, 23, 42, 0.95) 0%, rgba(8, 12, 20, 0.98) 100%)`,
            boxShadow: `0 0 35px ${stateConfig.glowColor}, inset 0 0 15px rgba(56, 189, 248, 0.2)`,
            border: `1.5px solid ${stateConfig.primaryColor}`,
          }}
          animate={{
            scale: state === 'SPEAKING' ? [1, 1.05, 1] : state === 'LISTENING' ? [1, 1.04, 1] : 1,
          }}
          transition={{
            repeat: Infinity,
            duration: 1.6,
            ease: 'easeInOut',
          }}
        >
          {/* Subtle Grid / Hex background in core */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:8px_8px]" />

          {/* Central Icon */}
          <motion.div
            animate={{
              scale: state === 'LISTENING' ? [1, 1.15, 1] : 1,
            }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            <IconComponent
              className="w-8 h-8 transition-colors duration-300"
              style={{ color: stateConfig.primaryColor }}
            />
          </motion.div>

          <span
            className="text-[10px] tracking-widest font-mono uppercase font-bold mt-1 transition-colors duration-300"
            style={{ color: stateConfig.primaryColor }}
          >
            APOLLO
          </span>
        </motion.div>
      </div>

      {/* State Status Banner */}
      <div className="mt-4 text-center space-y-1 z-10">
        <motion.h2
          key={stateConfig.label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-medium tracking-wide text-slate-100 font-sans"
        >
          {stateConfig.label}
        </motion.h2>

        <motion.p
          key={stateConfig.subtext}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-slate-400 font-mono tracking-wider"
        >
          {stateConfig.subtext}
        </motion.p>
      </div>
    </div>
  );
};
