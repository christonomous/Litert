import { 
  Cpu, 
  MessageSquare, 
  Plus,
  CheckCircle2, 
  Download, 
  Sun, 
  Moon,
  X,
  History
} from 'lucide-react';
import { SidebarItem } from './ui/SidebarItem';
import { ConversationItem } from './ConversationItem';
import { cn } from '../utils/cn';

export function Sidebar({ 
  isOpen, 
  setIsOpen,
  isReady, 
  theme, 
  conversations,
  activeId,
  setActiveId,
  createNewConversation,
  renameConversation,
  deleteConversation,
  setTheme
}) {
  return (
    <aside 
      className={cn(
        "glass z-50 flex flex-col border-r border-white/5 transition-all duration-500 ease-in-out",
        "fixed inset-y-0 left-0 w-80 lg:relative lg:translate-x-0 lg:flex",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow-lg shadow-brand-primary/20">
            <Cpu className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Litert <span className="text-brand-primary">AI</span>
          </h1>
        </div>
        
        <button 
          onClick={() => setIsOpen(false)}
          className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-slate-400"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
        <button 
          onClick={createNewConversation}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-brand-primary/30 transition-all group mb-8"
        >
          <div className="h-8 w-8 rounded-xl bg-brand-primary/20 flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
            <Plus className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold">New Conversation</span>
        </button>

        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <History className="h-3 w-3" />
            Recent History
          </div>
          
          <div className="space-y-1">
            {conversations.length === 0 ? (
              <div className="px-4 py-8 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
                <p className="text-xs text-slate-500">No conversations yet</p>
              </div>
            ) : (
              conversations.map((chat) => (
                <ConversationItem 
                  key={chat.id}
                  chat={chat} 
                  active={activeId === chat.id} 
                  onClick={() => {
                    setActiveId(chat.id);
                    setIsOpen(false);
                  }}
                  onRename={renameConversation}
                  onDelete={deleteConversation}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto p-4 space-y-4">
        <div className={cn(
          "rounded-2xl p-4 transition-all duration-300 bg-brand-primary/10 border border-brand-primary/20",
          isReady && "bg-emerald-500/10 border border-emerald-500/20"
        )}>
          {isReady ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-emerald-400">Ready</p>
                <p className="text-[10px] text-emerald-400/60 uppercase tracking-widest">Gemma 4 E2B IT</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-brand-primary" />
              <div>
                <p className="text-xs font-semibold text-brand-primary">Setup required</p>
                <p className="text-[10px] text-brand-primary/60 uppercase tracking-widest">Action needed</p>
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex w-full items-center gap-3 rounded-xl p-3 hover:bg-white/5 transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="text-sm font-medium">Switch Theme</span>
        </button>
      </div>
    </aside>
  );
}
