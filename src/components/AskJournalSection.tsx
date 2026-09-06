import React, { useState } from 'react';
import { Search, Sparkles, AlertCircle, MessageSquareText, ChevronRight } from 'lucide-react';
import NeuralOrbit, { NeuralOrbitLoader } from './NeuralOrbit';
import { Journal } from '../types';
import { auth } from '../lib/firebase';

interface AskJournalSectionProps {
  journals: Journal[];
  onSelectJournal: (id: string) => void;
}

interface SearchResponse {
  answer: string;
  relevantEntryIds: string[];
}

export default function AskJournalSection({ journals, onSelectJournal }: AskJournalSectionProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract unique emotions for quick filters
  const allEmotions = journals.flatMap(j => j.emotions?.map(e => e.name) || []);
  const uniqueEmotions = Array.from(new Set(allEmotions)).slice(0, 8);

  const handleSearch = async (e?: React.FormEvent, presetQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = presetQuery || query;
    if (!searchQuery.trim()) return;

    if (journals.length === 0) {
      setError("No journal entries available to search.");
      return;
    }

    setQuery(searchQuery);
    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const entriesPayload = journals.map(j => ({
        id: j.id,
        date: new Date(j.createdAt).toLocaleDateString(),
        title: j.title,
        summary: j.summary,
        text: j.messages.map(m => `${m.role === 'user' ? 'Me' : 'Lumina'}: ${m.content}`).join('\n')
      }));

      // Fetch the firebase token using static import if possible or just use the passed user prop if we add it. 
      // Actually, since we're inside a component, we can just use the auth instance directly.
      const currentUser = auth.currentUser;
      const tokenStr = currentUser ? await currentUser.getIdToken() : '';

      const res = await fetch('/api/journal/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenStr}`
        },
        body: JSON.stringify({ query: searchQuery, entries: entriesPayload })
      });

      if (!res.ok) {
        throw new Error('Failed to perform semantic search');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during search.');
    } finally {
      setIsSearching(false);
    }
  };

  const relevantJournals = result?.relevantEntryIds
    ?.map(id => journals.find(j => j.id === id))
    .filter((j): j is Journal => Boolean(j)) || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            Ask Your Journal
          </h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Semantic search powered by AI. Ask questions about your past entries, patterns, and emotions.
          </p>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSearch} className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-32 py-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all text-sm shadow-inner"
            placeholder="e.g., When was the last time I felt extremely anxious about work?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSearching}
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-2 top-2 bottom-2 px-6 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-violet-900/20 flex items-center justify-center min-w-[70px]"
          >
            {isSearching ? <NeuralOrbit size={18} speed="fast" glow={false} /> : 'Ask'}
          </button>
        </form>

        {isSearching && (
          <div className="mt-8 py-6">
            <NeuralOrbitLoader size={48} label="Synthesizing memories with Gemini AI..." />
          </div>
        )}

        {uniqueEmotions.length > 0 && !result && !isSearching && (
          <div className="mt-6">
            <p className="text-xs font-medium text-[var(--text-faint)] mb-3 uppercase tracking-wider">Quick Filters</p>
            <div className="flex flex-wrap gap-2">
              {uniqueEmotions.map((emotion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(undefined, `Show me entries where I felt ${emotion}`)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] text-xs font-medium hover:bg-violet-500/10 hover:text-violet-400 hover:border-violet-500/30 transition-all cursor-pointer"
                >
                  {emotion}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-6">
            <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border-color)] shadow-inner">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-violet-500/10 rounded-lg shrink-0 mt-0.5">
                  <MessageSquareText className="w-4 h-4 text-violet-400" />
                </div>
                <div className="text-[var(--text-primary)] text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {result.answer}
                </div>
              </div>
            </div>

            {relevantJournals.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-faint)] uppercase tracking-wider mb-4">
                  Referenced Entries ({relevantJournals.length})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {relevantJournals.map(journal => (
                    <button
                      key={journal.id}
                      onClick={() => onSelectJournal(journal.id)}
                      className="group flex flex-col items-start text-left bg-[var(--bg-primary)] p-4 rounded-xl hover:bg-[var(--bg-card-hover)] transition-all border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-violet-500/40 relative"
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">
                          {new Date(journal.createdAt).toLocaleDateString()}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)] group-hover:text-violet-400 transition-colors" />
                      </div>
                      <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1 line-clamp-1 group-hover:text-violet-400 transition-colors">
                        {journal.title || "Untitled Entry"}
                      </h4>
                      <p className="text-[var(--text-muted)] text-xs line-clamp-2">
                        {journal.summary || "No summary available."}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
