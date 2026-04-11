import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SetupView } from './components/SetupView';
import { ChatView } from './components/ChatView';
import { ChatInput } from './components/ChatInput';

const API_BASE = `http://${window.location.hostname}:8000`;

function App() {
  const [status, setStatus] = useState({ progress: 0, status: 'idle', error: null });
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem('litert_conversations');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeId, setActiveId] = useState(() => {
    return localStorage.getItem('litert_active_id');
  });
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [systemLogs, setSystemLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // Keep for now but will use for setup vs chat
  const [theme, setTheme] = useState('dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pollingRef = useRef(null);
  const chatEndRef = useRef(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('litert_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (activeId) {
      localStorage.setItem('litert_active_id', activeId);
    }
  }, [activeId]);

  const activeConversation = conversations.find(c => c.id === activeId) || null;
  const messages = activeConversation?.messages || [];

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');

    const themeListener = (e) => setTheme(e.matches ? 'dark' : 'light');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeListener);

    return () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', themeListener);
    };
  }, []);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Poll for status
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      setStatus(data);
      if (data.status === 'complete' && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } catch (err) {
      console.error("Status polling failed", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    if (status.status === 'downloading') {
      pollingRef.current = setInterval(fetchStatus, 1000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    return () => pollingRef.current && clearInterval(pollingRef.current);
  }, [status.status]);

  // Connect to system logs
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/system-logs`);
    eventSource.onmessage = (event) => {
      setSystemLogs(prev => [...prev.slice(-99), event.data]);
    };
    eventSource.onerror = () => {
      console.warn("System logs connection lost. Reconnecting...");
    };
    return () => eventSource.close();
  }, []);

  const createNewConversation = () => {
    const newChat = {
      id: Date.now().toString(),
      title: "New Conversation",
      messages: [],
      timestamp: Date.now()
    };
    setConversations(prev => [newChat, ...prev]);
    setActiveId(newChat.id);
    setIsMobileMenuOpen(false);
  };

  const renameConversation = (id, newTitle) => {
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, title: newTitle } : c
    ));
  };

  const deleteConversation = (id, e) => {
    if (e) e.stopPropagation();
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (activeId === id) {
        setActiveId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const triggerDownload = async () => {
    try {
      await fetch(`${API_BASE}/start-download`, { method: 'POST' });
      fetchStatus();
    } catch (err) {
      setStatus(prev => ({ ...prev, error: "Failed to connect to backend" }));
    }
  };

  const sendChat = async (directPrompt = null) => {
    const textToSubmit = typeof directPrompt === 'string' ? directPrompt : prompt;
    if (!textToSubmit.trim()) return;

    let currentId = activeId;
    const conversationExists = conversations.some(c => c.id === currentId);

    if (!currentId || !conversationExists) {
      const newChat = {
        id: Date.now().toString(),
        title: textToSubmit.slice(0, 30) + (textToSubmit.length > 30 ? "..." : ""),
        messages: [],
        timestamp: Date.now()
      };
      setConversations(prev => [newChat, ...prev]);
      setActiveId(newChat.id);
      currentId = newChat.id;
    }

    const userMessage = { id: Date.now().toString(), role: 'user', content: textToSubmit };

    const activeConv = conversations.find(c => c.id === currentId);
    const allMessages = activeConv ? [...activeConv.messages, userMessage] : [userMessage];
    const apiMessages = allMessages.map(m => ({ role: m.role, content: m.content }));

    setConversations(prev => prev.map(c =>
      c.id === currentId
        ? { ...c, messages: [...c.messages, userMessage], title: c.messages.length === 0 ? (textToSubmit.slice(0, 30) + (textToSubmit.length > 30 ? "..." : "")) : c.title }
        : c
    ));

    setPrompt("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });

      if (!response.ok) throw new Error("Backend unavailable");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      setIsLoading(false); // Stop "thinking" indicator once stream starts

      // Add placeholder assistant message for streaming now that we have a response
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessagePlaceholder = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true
      };

      setConversations(prev => prev.map(c =>
        c.id === currentId
          ? { ...c, messages: [...c.messages, assistantMessagePlaceholder] }
          : c
      ));

      let accumulatedContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                accumulatedContent += `Error: ${data.error}`;
              } else if (data.text) {
                accumulatedContent += data.text;
                // Update the placeholder message
                setConversations(prev => prev.map(c =>
                  c.id === currentId
                    ? {
                      ...c,
                      messages: c.messages.map(msg =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    }
                    : c
                ));
              }
            } catch (e) {
              console.warn("Error parsing stream chunk", e);
            }
          }
        }
      }

      // Finalize message
      setConversations(prev => prev.map(c =>
        c.id === currentId
          ? {
            ...c,
            messages: c.messages.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, isStreaming: false }
                : msg
            )
          }
          : c
      ));
    } catch (err) {
      setConversations(prev => prev.map(c =>
        c.id === currentId
          ? {
            ...c,
            messages: [...c.messages, {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: `Connection failed: ${err.message}`,
              isStreaming: false
            }]
          }
          : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const isReady = status.status === 'complete';

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden text-text-primary">
      <Sidebar
        isOpen={isMobileMenuOpen}
        setIsOpen={setIsMobileMenuOpen}
        isReady={isReady}
        theme={theme}
        conversations={conversations}
        activeId={activeId}
        setActiveId={setActiveId}
        createNewConversation={createNewConversation}
        renameConversation={renameConversation}
        deleteConversation={deleteConversation}
        setTheme={setTheme}
      />

      <main className="relative flex-1 flex flex-col min-w-0 h-full">
        <div className="flex-1 min-h-0 overflow-y-auto p-8 relative">
          <AnimatePresence mode="wait">
            {!isReady ? (
              <SetupView status={status} triggerDownload={triggerDownload} />
            ) : activeTab === 'logs' ? (
              <LogView systemLogs={systemLogs} />
            ) : (
              <ChatView messages={messages} isLoading={isLoading} chatEndRef={chatEndRef} onActionClick={sendChat} theme={theme} />
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
          )}
        </AnimatePresence>

        {isReady && (
          <ChatInput
            prompt={prompt}
            setPrompt={setPrompt}
            sendChat={sendChat}
            isLoading={isLoading}
          />
        )}
      </main>
    </div>
  );
}

function LogView({ systemLogs }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [systemLogs]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto h-[calc(100vh-250px)] flex flex-col"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">System Diagnostics</h2>
      </div>

      <div className="flex-1 glass rounded-2xl p-6 font-mono text-xs overflow-y-auto space-y-2 border border-white/5 shadow-2xl">
        {systemLogs.length === 0 ? (
          <div className="text-slate-500 italic">Awaiting telemetry data...</div>
        ) : (
          systemLogs.map((log, i) => (
            <div key={i} className="flex gap-4 group">
              <span className="text-slate-600 shrink-0 select-none">[{i + 1}]</span>
              <span className="text-slate-300 group-hover:text-brand-primary transition-colors">{log}</span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </motion.div>
  );
}

export default App;
