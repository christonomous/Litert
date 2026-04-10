import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Edit2, Trash2, Check, X } from 'lucide-react';
import { cn } from '../utils/cn';

export function ConversationItem({ 
  chat, 
  active, 
  onClick, 
  onRename, 
  onDelete 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleRenameSubmit = (e) => {
    if (e) e.stopPropagation();
    if (editTitle.trim() && editTitle !== chat.title) {
      onRename(chat.id, editTitle.trim());
    } else {
      setEditTitle(chat.title);
    }
    setIsEditing(false);
  };

  const cancelRename = (e) => {
    if (e) e.stopPropagation();
    setEditTitle(chat.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleRenameSubmit(e);
    if (e.key === 'Escape') cancelRename(e);
  };

  return (
    <div 
      className={cn(
        "group relative flex items-center justify-between gap-3 rounded-xl p-3 cursor-pointer transition-all duration-200 overflow-hidden",
        active ? "bg-brand-primary/10 text-brand-primary" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
      )}
      onClick={() => {
        if (!isEditing) onClick();
      }}
    >
      <div className="flex items-center gap-3 flex-1 overflow-hidden min-w-0">
        <MessageSquare className="h-5 w-5 shrink-0" />
        {isEditing ? (
          <div className="flex items-center w-full gap-1 min-w-0" onClick={e => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-black/30 border border-brand-primary/50 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-brand-primary min-w-0 w-full"
            />
            <button onClick={handleRenameSubmit} className="text-emerald-400 hover:text-emerald-300 p-1 shrink-0">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={cancelRename} className="text-slate-400 hover:text-slate-200 p-1 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span className="text-sm font-semibold truncate block w-full text-left pr-2">
            {chat.title}
          </span>
        )}
      </div>

      {!isEditing && (
        <div 
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center bg-black/40 backdrop-blur-xl rounded-lg shadow-sm border border-white/10 p-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="p-1.5 text-slate-300 hover:text-white transition-colors rounded-md hover:bg-white/10"
              title="Rename"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(chat.id, e); }}
              className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-md hover:bg-red-400/20"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
