import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Sparkles, Loader2, Save } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getJournal, saveJournal } from '../lib/db';
import { Journal, Message } from '../types';

export default function JournalView({ journalId, onBack }: { journalId: string | 'new', onBack: () => void }) {
  const { user } = useAuth();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (journalId === 'new') {
      const newJournal: Journal = {
        id: crypto.randomUUID(),
        userId: user!.uid,
        title: 'New Reflection',
        summary: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: []
      };
      setJournal(newJournal);

      // Attempt to get location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const idToken = await user!.getIdToken();
              const response = await fetch('/api/geocode', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                })
              });
              if (response.ok) {
                const data = await response.json();
                if (data.location) {
                  setJournal((prev) => prev ? { ...prev, location: data.location } : prev);
                }
              }
            } catch (err) {
              console.error("Failed to fetch location:", err);
            }
          },
          (err) => {
            console.log("Geolocation error or denied:", err);
          }
        );
      }
    } else {
      loadJournal();
    }
  }, [journalId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [journal?.messages, isTyping]);

  const loadJournal = async () => {
    try {
      const data = await getJournal(user!.uid, journalId);
      if (data) setJournal(data);
      else {
        setError("Journal entry not found.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load journal entry.");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !journal || !user) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    const updatedMessages = [...journal.messages, userMessage];
    
    // Auto-generate a title from the first message if it's new
    let newTitle = journal.title;
    if (updatedMessages.length === 1) {
      newTitle = userMessage.content.slice(0, 40) + (userMessage.content.length > 40 ? '...' : '');
    }

    const updatedJournal: Journal = {
      ...journal,
      title: newTitle,
      messages: updatedMessages
    };

    setJournal(updatedJournal);
    setInput('');
    setIsTyping(true);
    setError(null);

    // Save to Firestore optimistically
    try {
      setIsSaving(true);
      await saveJournal(user.uid, updatedJournal);
      setIsSaving(false);
    } catch (err: any) {
      console.error("Failed to save user message", err);
      setError(err.message || "Failed to save message. Please check your connection.");
      setIsSaving(false);
      setIsTyping(false);
      return; // Stop execution if encryption fails
    }

    try {
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/journal/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          message: userMessage.content,
          history: journal.messages, // Only send previous history
          systemPrompt: `You are an empathetic, insightful, and concise journaling companion. 
          Help the user reflect on their thoughts. Ask guiding questions if appropriate, or offer new perspectives.
          ${journal.location ? `The user is currently writing from: ${journal.location}. Consider if their physical environment or location might be influencing their mood or thoughts, and gently weave this into your reflection if relevant.` : ''} 
          Keep your responses relatively brief (1-3 paragraphs max) unless the user asks for a deep dive.`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        content: data.text,
        timestamp: Date.now()
      };

      const finalMessages = [...updatedMessages, aiMessage];
      const finalJournal = {
        ...updatedJournal,
        messages: finalMessages,
        // Update summary based on last few messages
        summary: "Contains " + finalMessages.length + " interactions."
      };

      setJournal(finalJournal);
      
      // Save AI response to Firestore
      setIsSaving(true);
      try {
        await saveJournal(user.uid, finalJournal);
      } catch (err: any) {
        console.error("Failed to save AI response", err);
        setError(err.message || "Failed to save AI response.");
      }
      setIsSaving(false);

    } catch (err) {
      console.error(err);
      setError("Failed to get response from AI.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (error && !journal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#05070A] text-[#E0E6ED]">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={onBack} className="text-white/60 hover:text-white underline">Go Back</button>
      </div>
    );
  }

  if (!journal) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#05070A] text-[#E0E6ED]">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#05070A] text-[#E0E6ED] font-sans relative overflow-hidden">
      <div className="absolute inset-0 atmosphere pointer-events-none"></div>
      
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-white/5 flex-shrink-0 relative z-10 glass">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-white/40 hover:text-white/80 transition-colors p-2 -ml-2 rounded-xl hover:bg-white/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="text-xs uppercase tracking-[0.2em] text-white/30 font-bold hidden sm:block">Active Session</div>
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>
            <div className="text-sm font-medium text-violet-400 line-clamp-1 max-w-[200px] sm:max-w-xs">{journal.title}</div>
            {journal.location && (
              <>
                <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>
                <div className="text-xs text-white/40 flex items-center gap-1 line-clamp-1 max-w-[150px]">
                  <span className="hidden sm:inline">from</span> {journal.location}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center text-xs font-medium text-white/30 gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isSaving ? 'Saving...' : 'Saved'}
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative z-10 px-4 sm:px-10 reflection-mask">
        <div className="max-w-3xl w-full mx-auto flex flex-col gap-10 overflow-y-auto pt-10 pb-4 h-full scrollbar-hide">
          {journal.messages.length === 0 ? (
            <div className="text-center py-20 m-auto">
              <div className="w-16 h-16 bg-white/5 border border-white/10 text-white/40 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm transform -rotate-6">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-2xl serif text-white/90 mb-3 glow-text">How are you feeling today?</h3>
              <p className="text-white/50 max-w-md mx-auto leading-relaxed text-sm">
                Start writing whatever is on your mind. The AI will listen, reflect, and help you gain insights into your thoughts.
              </p>
            </div>
          ) : (
            journal.messages.map((msg) => (
              msg.role === 'user' ? (
                <div key={msg.id} className="space-y-4 opacity-80 self-end max-w-[90%] sm:max-w-[80%]">
                  <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold text-right">You</div>
                  <p className="serif text-xl sm:text-2xl leading-relaxed italic text-white/90 whitespace-pre-wrap">
                    "{msg.content}"
                  </p>
                </div>
              ) : (
                <div key={msg.id} className="space-y-6 pt-4 border-t border-white/10 self-start w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_#a78bfa]"></div>
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold">Gemini Analysis</div>
                  </div>
                  <p className="serif text-xl sm:text-2xl leading-snug text-white/95 glow-text whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              )
            ))
          )}

          {isTyping && (
            <div className="space-y-4 pt-4 border-t border-white/10 self-start w-full">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_#a78bfa]"></div>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold">Gemini Analysis</div>
              </div>
              <div className="flex items-center gap-1.5 pt-2">
                <div className="w-2 h-2 rounded-full bg-violet-400/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-violet-400/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-violet-400/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          {error && (
            <div className="text-center text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 py-2 px-4 rounded-xl self-center">
              {error}
            </div>
          )}
          <div ref={messagesEndRef} className="pb-8" />
        </div>
      </main>

      {/* Input Area */}
      <footer className="h-28 px-4 sm:px-10 pb-8 flex items-end justify-center relative z-10 bg-gradient-to-t from-[#05070A] to-transparent shrink-0">
        <div className="w-full max-w-3xl glass rounded-2xl p-2 flex items-center gap-4 focus-within:ring-2 ring-violet-500/40 transition-all shadow-lg shadow-black/50">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Continue your reflection..."
            className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm text-white placeholder-white/20"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 text-white/80" />
          </button>
        </div>
      </footer>
    </div>
  );
}
