import React from 'react';
import { Send, Loader2 } from 'lucide-react';

export function ChatInput({ prompt, setPrompt, sendChat, isLoading }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  return (
    <div className="lg:absolute lg:bottom-10 left-0 right-0 px-4 lg:px-8 py-4 bg-slate-900/50 lg:bg-transparent backdrop-blur-lg lg:backdrop-blur-none border-t border-white/5 lg:border-none">
      <div className="mx-auto max-w-4xl relative">
        <div className="glass rounded-3xl lg:rounded-[32px] p-1.5 lg:p-2 flex items-center ring-1 ring-white/10 shadow-2xl focus-within:ring-brand-primary/50 transition-all duration-500">
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="flex-1 bg-transparent border-none outline-none px-4 lg:px-6 py-3 lg:py-4 text-white placeholder:text-slate-500 resize-none max-h-40"
            rows={1}
          />
          <button 
            onClick={sendChat}
            disabled={isLoading || !prompt.trim()}
            className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-brand-primary text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:grayscale ring-4 ring-brand-primary/10"
          >
            {isLoading ? <Loader2 className="h-4 w-4 lg:h-5 lg:w-5 animate-spin" /> : <Send className="h-4 w-4 lg:h-5 lg:w-5" />}
          </button>
        </div>
        <p className="hidden lg:block mt-3 text-center text-[10px] text-slate-500 font-medium uppercase tracking-[0.2em]">
          Edge Inference Powered by LiteRT Neural Runtime
        </p>
      </div>
    </div>
  );
}
