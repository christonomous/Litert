import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Bot, User, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../utils/cn';

export function ChatView({ messages, isLoading, chatEndRef, onActionClick, theme }) {
  return (
    <motion.div
      key="chat"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-6 lg:space-y-8 px-4 lg:px-8 pb-40 lg:pb-32"
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-full bg-brand-primary/10 mb-6">
            <MessageSquare className="h-8 w-8 text-brand-primary" />
          </div>
          <h3 className="text-2xl font-bold text-text-primary mb-2">Neural Engine Ready</h3>
          <p className="text-text-secondary max-w-sm">
            Gemma 4 E2B IT is now running on your hardware. Your conversation is private and local.
          </p>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg px-4">
            <MockAction label="Write a story about a futuristic city" onClick={() => onActionClick("Write a story about a futuristic city")} />
            <MockAction label="Explain quantum computing simply" onClick={() => onActionClick("Explain quantum computing simply")} />
            <MockAction label="Write a Python script for web scraping" onClick={() => onActionClick("Write a Python script for web scraping")} />
            <MockAction label="How to make the perfect sourdough" onClick={() => onActionClick("How to make the perfect sourdough")} />
          </div>
        </div>
      ) : (
        messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-6 p-1",
              msg.role === 'assistant' ? "items-start" : "items-start flex-row-reverse"
            )}
          >
            <div className={cn(
              "h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center shadow-lg",
              msg.role === 'assistant' ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/30" : "user-avatar"
            )}>
              {msg.role === 'assistant' ? <Bot className="h-6 w-6" /> : <User className="h-6 w-6" />}
            </div>
            <div className={cn(
              "max-w-[90%] lg:max-w-[80%] px-4 lg:px-6 py-3 lg:py-4 rounded-3xl text-sm leading-relaxed min-h-[52px]",
              msg.role === 'assistant'
                ? "glass text-text-primary"
                : "bg-brand-primary text-white shadow-xl shadow-brand-primary/10 flex items-center"
            )}>
              {msg.role === 'assistant' ? (
                <div className={cn("prose max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl", theme === 'dark' && "prose-invert")}>
                  {msg.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.isStreaming && <span className="flex gap-1.5 h-full items-center"><motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="h-4 w-1 bg-brand-primary/50 block" /></span>
                  )}
                  {msg.isStreaming && msg.content && (
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block h-4 w-1 bg-brand-primary/50 ml-1 translate-y-0.5" />
                  )}
                </div>
              ) : (
                <>{msg.content}</>
              )}
            </div>
          </motion.div>
        ))
      )}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-6 p-1 items-start"
        >
          <div className="h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center bg-brand-primary/20 border border-brand-primary/30">
            <Bot className="h-6 w-6 text-brand-primary animate-pulse" />
          </div>
          <div className="px-6 py-4 rounded-3xl glass flex items-center gap-3">
            <div className="flex gap-1.5">
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            </div>
            <span className="text-xs font-semibold text-brand-primary/80 uppercase tracking-widest">Thinking</span>
          </div>
        </motion.div>
      )}
      <div ref={chatEndRef} />
    </motion.div>
  );
}

function MockAction({ label, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between gap-4 p-4 rounded-2xl mock-btn text-left transition-all">
      <span className="text-xs font-medium text-text-secondary line-clamp-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-text-secondary shrink-0" />
    </button>
  );
}
