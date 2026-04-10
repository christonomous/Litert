import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, ChevronRight } from 'lucide-react';

export function SetupView({ status, triggerDownload }) {
  return (
    <motion.div 
      key="setup"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="mx-auto mt-10 lg:mt-20 max-w-2xl text-center flex flex-col items-center px-4"
    >
      <div className="mb-6 lg:mb-8 flex h-20 w-20 lg:h-24 lg:w-24 items-center justify-center rounded-3xl bg-brand-primary/10 shadow-inner">
        <Cpu className="h-10 w-10 lg:h-12 lg:w-12 text-brand-primary" />
      </div>
      <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Initialize Intelligence</h2>
      <p className="text-slate-400 text-base lg:text-lg mb-8 lg:mb-12">
        To run <span className="text-white">Gemma 4 E2B IT</span> locally, we need to finalize the neural weights. 
        This is a one-time process for ultra-low latency inference on your device.
      </p>

      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
        {status.status === 'downloading' ? (
          <div className="space-y-6">
            <div className="flex justify-between text-sm font-semibold">
              <span>Downloading Weights</span>
              <span className="text-brand-primary font-mono">{status.progress}%</span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary"
                initial={{ width: 0 }}
                animate={{ width: `${status.progress}%` }}
                transition={{ type: "spring", stiffness: 30, damping: 10 }}
              />
            </div>
            <p className="text-xs text-slate-500 text-center animate-pulse tracking-wide uppercase">
              Establishing secure connection to HuggingFace
            </p>
          </div>
        ) : (
          <button 
            onClick={triggerDownload}
            className="btn-primary w-full text-lg group"
          >
            <span className="flex items-center justify-center gap-2">
              Download Now 
              <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        )}
        {status.error && (
          <p className="mt-4 text-sm text-brand-accent font-medium">Error: {status.error}</p>
        )}
      </div>
    </motion.div>
  );
}
