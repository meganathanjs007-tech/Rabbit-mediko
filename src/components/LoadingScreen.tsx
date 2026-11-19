import { motion } from 'motion/react';
import { BrandLogo } from './BrandLogo';

export function LoadingScreen({ message = 'Loading Rabbit Mediko...' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen w-full overflow-hidden bg-[#0B0B11] text-white flex flex-col items-center justify-center px-6 py-10 relative"
    >
      {/* Subtle Ambient Radial Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center gap-7 max-w-xs w-full"
      >
        {/* Orbital Ring + Brand Logo */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <motion.div
            aria-hidden="true"
            animate={{ rotate: 360 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-2 border-white/10 border-t-emerald-400 border-r-violet-400/70"
          />
          <motion.div
            aria-hidden="true"
            animate={{ rotate: -360 }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-2 rounded-full border border-white/5 border-b-emerald-500/50"
          />
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <BrandLogo size="xl" className="ring-1 ring-white/15 shadow-2xl shadow-emerald-950/60" />
          </motion.div>
        </div>

        {/* Title + Live Status */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-white">Rabbit Mediko</h1>
          <p className="text-sm text-slate-400 leading-relaxed min-h-[20px]">{message}</p>
        </div>

        {/* Smooth Sliding Progress Track */}
        <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden relative">
          <motion.div
            aria-hidden="true"
            initial={{ x: '-100%' }}
            animate={{ x: '220%' }}
            transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-violet-400"
          />
        </div>
      </motion.div>
    </div>
  );
}
