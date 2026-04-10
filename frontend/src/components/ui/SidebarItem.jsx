import React from 'react';
import { cn } from '../../utils/cn';

export function SidebarItem({ icon, label, active = false, open = true, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-all duration-200",
        active ? "bg-brand-primary/10 text-brand-primary" : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
        !open && "justify-center"
      )}
    >
      {React.cloneElement(icon, { className: "h-5 w-5" })}
      {open && <span className="text-sm font-semibold">{label}</span>}
    </div>
  );
}
