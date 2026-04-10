import React from 'react';
import { Settings, Menu, X } from 'lucide-react';

export function Header({ isOpen, setIsOpen }) {
  return (
    <header className="flex shrink-0 h-20 items-center justify-between px-4 lg:px-8 border-b border-white/5 bg-white/[0.02] backdrop-blur-md">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        >
          {isOpen ? <X className="h-5 w-5 text-slate-400" /> : <Menu className="h-5 w-5 text-slate-400" />}
        </button>
        
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">Online</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="hidden sm:flex rounded-full bg-white/5 p-2 transition-hover hover:bg-white/10">
          <Settings className="h-5 w-5 text-slate-400" />
        </button>
        <div className="h-10 w-10 rounded-full border-2 border-brand-primary/30 p-0.5 shadow-inner">
          <div className="h-full w-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600" />
        </div>
      </div>
    </header>
  );
}
