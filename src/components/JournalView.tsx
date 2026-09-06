import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Sparkles, Loader2, Save, Mic, MicOff, ShieldAlert, Palette, Paperclip, X, MapPin, ChevronDown, UserCog } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getJournal, saveJournal } from '../lib/db';
import { Journal, Message, EmotionTag, CBTDistortion } from '../types';
import EmotionTagManager from './EmotionTagManager';
import QuoteCardStudio from './QuoteCardStudio';
import ThemeToggle from './ThemeToggle';

export type AIPersona = 'neutral' | 'analytical' | 'empathetic';

export const PERSONAS: Record<AIPersona, { id: AIPersona; name: string; description: string; prompt: string }> = {
  neutral: {
    id: 'neutral',
    name: "Neutral Listener",
    description: "I listen objectively without judgment and ask clarifying questions to help you unpack your thoughts.",
    prompt: "You are a neutral, objective listener. Your goal is to provide a safe space for the user to vent. Do NOT offer advice, judgments, or deep analysis unless requested. Ask simple, clarifying questions to help the user unpack their thoughts organically."
  },
  analytical: {
    id: 'analytical',
    name: "Analytical Coach",
    description: "I am direct and logic-driven. I challenge cognitive distortions and focus on problem-solving.",
    prompt: "You are an analytical, logic-driven coach. Your goal is to identify cognitive distortions, challenge the user's assumptions, and push them toward actionable problem-solving. Be direct, objective, and somewhat firm. Use Socratic questioning to expose logical flaws or blind spots."
  },
  empathetic: {
    id: 'empathetic',
    name: "Empathetic Friend",
    description: "I am a warm companion. I offer emotional support, gentle encouragement, and validation.",
    prompt: "You are a warm, empathetic, and validating friend. Your goal is to offer emotional support and help the user feel heard and understood. Validate their feelings before asking gentle, guiding questions. Use a warm, comforting tone."
  }
};

export default function JournalView({ journalId, onBack }: { journalId: string | 'new', onBack: () => void }) {
  const { user } = useAuth();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTradeMode, setIsTradeMode] = useState(false);
  const [btcPrice, setBtcPrice] = useState<{ usd: number; usd_24h_change: number } | null>(null);
  const [thesis, setThesis] = useState('');
  const [invalidation, setInvalidation] = useState('');
  const [emotionalState, setEmotionalState] = useState('');
  const [isAnalyzingEmotion, setIsAnalyzingEmotion] = useState(false);
  const [showQuoteStudio, setShowQuoteStudio] = useState(false);
  
  const [mediaFile, setMediaFile] = useState<{ url: string; base64: string; mimeType: string } | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Guardrail modal and countdown timer states
  const [showCoolDownModal, setShowCoolDownModal] = useState(false);
  const [coolDownTime, setCoolDownTime] = useState(0); // In seconds
  const [challengeQuestion, setChallengeQuestion] = useState('');
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [isEvaluatingTrade, setIsEvaluatingTrade] = useState(false);
  const [biasWarning, setBiasWarning] = useState<any>(null);
  const [hasPassedEvaluation, setHasPassedEvaluation] = useState(false);
  const [activePersona, setActivePersona] = useState<AIPersona>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lumina_preferred_persona') as AIPersona;
      if (saved && PERSONAS[saved]) return saved;
    }
    return 'analytical';
  });
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Active 15-minute countdown interval
  useEffect(() => {
    let interval: any = null;
    if (showCoolDownModal) {
      interval = setInterval(() => {
        setCoolDownTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setShowCoolDownModal(false);
            setHasPassedEvaluation(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showCoolDownModal]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isTradeMode) {
      const getBtc = async () => {
        try {
          const idToken = await user!.getIdToken();
          const response = await fetch('/api/market/btc', {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
          if (response.ok) {
            const data = await response.json();
            setBtcPrice(data);
          }
        } catch (err) {
          console.error("Failed to fetch BTC price", err);
        }
      };
      getBtc();
      // Refresh every 60s
      const interval = setInterval(getBtc, 60000);
      return () => clearInterval(interval);
    }
  }, [isTradeMode, user]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window))) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Only one sentence at a time to avoid weird duplications
      recognition.interimResults = false;
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(prev => prev + (prev ? ' ' : '') + transcript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // Normal behavior when no speech is detected after a while
          setIsRecording(false);
          return;
        }
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access was denied. Please allow microphone access to use voice typing.');
        } else if (event.error === 'audio-capture') {
          alert('No microphone was found. Please ensure a microphone is connected and enabled.');
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported or was blocked by the browser. Please type your thoughts manually.');
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start recording:', err);
        alert('Failed to start microphone. Please ensure microphone permissions are granted or type your thoughts manually.');
        setIsRecording(false);
      }
    }
  };

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const requestLocation = () => {
    if (!journal || journal.location) return; // already have it
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsFetchingLocation(true);
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
              const updatedJournal = { ...journal, location: data.location };
              setJournal(updatedJournal);
              await saveJournal(user!.uid, updatedJournal);
            }
          }
        } catch (err) {
          console.error("Failed to fetch location:", err);
          setError("Failed to fetch location data.");
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (err) => {
        console.log("Geolocation error or denied:", err);
        setError("Location permission denied or unavailable.");
        setIsFetchingLocation(false);
      }
    );
  };

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
    } else {
      loadJournal();
    }
  }, [journalId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [journal?.messages?.length, isTyping]);

  const loadJournal = async () => {
    try {
      const data = await getJournal(user!.uid, journalId);
      if (data) {
        setJournal(data);
        if (data.messages && data.messages.length > 0 && (!data.emotions || data.emotions.length === 0)) {
          analyzeEmotionForEntry(data.messages[0].content, data);
        }
      } else {
        setError("Journal entry not found.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load journal entry.");
    }
  };

  const analyzeEmotionForEntry = async (text: string, currentJournal: Journal, mediaBase64?: string, mediaMimeType?: string) => {
    if (!user || (!text.trim() && !mediaBase64)) return;
    setIsAnalyzingEmotion(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/journal/analyze-emotion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          text,
          mediaBase64,
          mediaMimeType,
          context: {
            isTradeMode,
            title: currentJournal.title,
            location: currentJournal.location
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const updatedJournal: Journal = {
          ...currentJournal,
          emotions: data.emotions || [],
          cbtDistortions: data.cbtDistortions || []
        };
        setJournal(updatedJournal);
        // Persist with encryption to Firestore
        await saveJournal(user.uid, updatedJournal);
      }
    } catch (err) {
      console.error('Failed to analyze emotion:', err);
    } finally {
      setIsAnalyzingEmotion(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise((resolve) => (img.onload = resolve));

        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = dataUrl.split(',')[1];
        setMediaFile({
          url: dataUrl,
          base64: base64Data,
          mimeType: 'image/jpeg'
        });
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          setMediaFile({
            url: result,
            base64: base64Data,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error("Failed to process file:", err);
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChangeEmotions = async (newEmotions: EmotionTag[]) => {
    if (!journal || !user) return;
    const updatedJournal: Journal = {
      ...journal,
      emotions: newEmotions
    };
    setJournal(updatedJournal);
    setIsSaving(true);
    try {
      await saveJournal(user.uid, updatedJournal);
    } catch (err: any) {
      console.error('Failed to update emotion tags', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFeedback = async (isAccurate: boolean) => {
    if (!journal || !user) return;
    const updatedJournal: Journal = {
      ...journal,
      userFeedback: {
        isAccurate,
        timestamp: Date.now()
      }
    };
    setJournal(updatedJournal);
    setIsSaving(true);
    try {
      await saveJournal(user.uid, updatedJournal);
    } catch (err: any) {
      console.error('Failed to save feedback', err);
    } finally {
      setIsSaving(false);
    }
  };

  const checkClientRiskTriggers = (entry: string, th: string, inv: string, emo: string) => {
    const combined = `${entry} ${th} ${inv} ${emo}`.toLowerCase();
    const fomoKeywords = ["fomo", "fear of missing out", "missing out", "pump", "pumping", "moon", "flying", "catch the move", "chasing", "green candle", "rocket"];
    const revengeKeywords = ["revenge", "recover losses", "recover loss", "get even", "lost so much", "win it back", "win back", "make it back", "payback", "loss recovery", "tilted", "anger", "frustrated", "revenge trade"];
    const lossAversionKeywords = ["panic", "desperate", "stop out", "scared", "can't take the loss", "cant take the loss", "afraid of losing", "anxious", "fear"];
    const overconfidenceKeywords = ["all-in", "all in", "can't lose", "cant lose", "100x", "guaranteed", "easy money", "free money", "max leverage", "double down", "ape", "aping", "sure thing", "no way it drops", "risk free"];
    
    const hasFomo = fomoKeywords.some(k => combined.includes(k));
    const hasRevenge = revengeKeywords.some(k => combined.includes(k));
    const hasLossAversion = lossAversionKeywords.some(k => combined.includes(k));
    const hasOverconfidence = overconfidenceKeywords.some(k => combined.includes(k));

    if (hasRevenge) {
      return {
        requiresCooldown: true,
        isFlagged: true,
        highestBias: "Revenge Trading",
        challengeQuestion: "Are you attempting to immediately recover prior losses rather than trading a calculated, rule-based edge?",
        scores: { fomo: 40, revengeTrading: 95, lossAversion: 60, overconfidence: 70, recencyBias: 50 }
      };
    }
    if (hasFomo) {
      return {
        requiresCooldown: true,
        isFlagged: true,
        highestBias: "FOMO / Impulsive Chasing",
        challengeQuestion: "Are you entering because price is already surging rapidly, or does this strictly fulfill your pre-defined setup criteria?",
        scores: { fomo: 92, revengeTrading: 30, lossAversion: 50, overconfidence: 65, recencyBias: 60 }
      };
    }
    if (hasOverconfidence) {
      return {
        requiresCooldown: true,
        isFlagged: true,
        highestBias: "Overconfidence / High Leverage",
        challengeQuestion: "What specific, objective market conditions prove this thesis wrong, and have you sized this position so a full stop-out won't damage your capital?",
        scores: { fomo: 60, revengeTrading: 40, lossAversion: 30, overconfidence: 94, recencyBias: 55 }
      };
    }
    if (hasLossAversion) {
      return {
        requiresCooldown: true,
        isFlagged: true,
        highestBias: "Loss Aversion / Panic",
        challengeQuestion: "Are you acting out of panic and fear of loss rather than honoring your predetermined stop-loss rules?",
        scores: { fomo: 35, revengeTrading: 50, lossAversion: 88, overconfidence: 25, recencyBias: 40 }
      };
    }
    return null;
  };

  const handleUnlockWithChallenge = () => {
    if (challengeAnswer.trim().length >= 10) {
      setShowCoolDownModal(false);
      setCoolDownTime(0);
      setHasPassedEvaluation(true);
      setChallengeAnswer('');
      setError(null);
    } else {
      alert('Please provide a thoughtful reflection (at least 10 characters) answering the mentor question to unlock your trade log.');
    }
  };

  const handleSend = async () => {
    if (!journal || !user) return;

    // Check if cooldown timer is active
    if (showCoolDownModal || coolDownTime > 0) {
      setError(`Cool-down active (${formatTime(coolDownTime)} remaining). Please wait for the timer to expire or answer the challenge question.`);
      return;
    }

    const trimmedInput = input.trim();
    if (!trimmedInput && !isTradeMode) return;

    // Trade mode pre-trade check
    if (isTradeMode && journal.messages.length === 0 && !hasPassedEvaluation) {
      if (!thesis.trim() || !invalidation.trim() || !emotionalState.trim()) {
        setError("Please complete the pre-trade checklist (Thesis, Invalidation, Emotional State).");
        return;
      }
      
      try {
        setIsEvaluatingTrade(true);
        let evalData: any = null;

        try {
          const idToken = await user.getIdToken();
          const evalRes = await fetch('/api/trade/evaluate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              entry: trimmedInput || `Thesis: ${thesis} | Invalidation: ${invalidation} | Emotion: ${emotionalState}`,
              thesis,
              invalidation,
              emotionalState
            })
          });
          
          if (evalRes.ok) {
            evalData = await evalRes.json();
          }
        } catch (fetchErr) {
          console.warn("Network error during trade evaluation, using client-side bias check", fetchErr);
        }

        // Fallback to client-side risk trigger detection if server evaluation is unavailable or missing
        if (!evalData) {
          evalData = checkClientRiskTriggers(trimmedInput, thesis, invalidation, emotionalState);
        }

        const scores = evalData?.scores || {};
        const maxScore = Math.max(
          scores.fomo || 0,
          scores.revengeTrading || 0,
          scores.lossAversion || 0,
          scores.overconfidence || 0,
          scores.recencyBias || 0
        );

        // Active State Switch: Flag if cooldown_required or high bias scores
        const isCooldownRequired = evalData && (
          evalData.risk_flag === "cooldown_required" ||
          evalData.requiresCooldown === true || 
          maxScore > 70
        );

        if (isCooldownRequired) {
          const question = evalData.suggested_reflection_prompt || 
            evalData.challengeQuestion || 
            "Are you entering this trade out of emotional urgency rather than your disciplined, risk-managed trading system?";
          
          const cooldownMinutes = evalData.cooldown_minutes || 15;
          setBiasWarning(evalData);
          setChallengeQuestion(question);
          setCoolDownTime(cooldownMinutes * 60);
          setShowCoolDownModal(true);
          setError(`High Cognitive Bias Detected: Tilt Risk. A ${cooldownMinutes}-minute cool-down is in effect.`);
          setIsEvaluatingTrade(false);
          return; // Physically halt trade finalization
        } else if (evalData && evalData.risk_flag === "caution") {
          // Caution flag - warn the user with feedback
          setError(`Trading Psychology Caution: ${evalData.reasoning || "Please double check your risk parameters before executing."}`);
        }
      } catch (err) {
        console.error("Evaluation failed", err);
      } finally {
        setIsEvaluatingTrade(false);
      }
    }

    const tradeNote = trimmedInput || `Pre-trade position setup: ${thesis}`;

    const compiledInput = (isTradeMode && journal.messages.length === 0) 
      ? `BTC/USD Price: $${btcPrice?.usd || 'Unknown'} (24h: ${btcPrice?.usd_24h_change?.toFixed(2) || '0'}%)
Thesis: ${thesis}
Invalidation: ${invalidation}
Emotional State: ${emotionalState}

Entry Notes: ${tradeNote}`
      : tradeNote;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: compiledInput,
      timestamp: Date.now(),
      ...(mediaFile && { mediaBase64: mediaFile.base64, mediaMimeType: mediaFile.mimeType })
    };

    const currentMediaFile = mediaFile;
    setMediaFile(null); // Clear preview early

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
          persona: activePersona,
          mediaBase64: currentMediaFile?.base64,
          mediaMimeType: currentMediaFile?.mimeType,
          history: journal.messages, // Only send previous history
          systemPrompt: `You are an insightful journaling mentor acting strictly as the "${PERSONAS[activePersona].name}".
Core Philosophy & Style: ${PERSONAS[activePersona].prompt}

CRITICAL RULES:
- Respond consistently in the distinctive style and tone of the "${PERSONAS[activePersona].name}".
- Analyze the user's reflection (and any attached media) deeply and objectively.
- Avoid generic platitudes. Provide focused, actionable, and perceptive mentorship.
${journal.location ? `- The user is currently writing from: ${journal.location}. Consider this in context.` : ''} 
- Keep your response concise (1-2 paragraphs), finishing with a thoughtful follow-up question.`
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

      // Concurrently run Granular Emotion & CBT Analysis on original user reflection
      if (updatedMessages.length > 0) {
        analyzeEmotionForEntry(updatedMessages[0].content, finalJournal, currentMediaFile?.base64, currentMediaFile?.mimeType);
      }

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
      if (!isTyping && !showCoolDownModal && coolDownTime <= 0 && !isEvaluatingTrade) {
        handleSend();
      }
    }
  };

  if (error && !journal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] text-[var(--text-secondary)]">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={onBack} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] underline">Go Back</button>
      </div>
    );
  }

  if (!journal) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)] text-[var(--text-secondary)]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-secondary)] font-sans relative overflow-hidden transition-colors duration-200">
      <div className="absolute inset-0 atmosphere pointer-events-none"></div>
      
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-[var(--border-color)] flex-shrink-0 relative z-50 glass bg-[var(--header-glass-bg)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-2 -ml-2 rounded-xl hover:bg-[var(--bg-card-hover)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-faint)] font-bold hidden sm:block">Active Session</div>
            <div className="h-4 w-[1px] bg-[var(--border-color)] hidden sm:block"></div>
            <div className="text-sm font-medium text-violet-600 dark:text-violet-400 line-clamp-1 max-w-[200px] sm:max-w-xs">{journal.title}</div>
            {journal.location && (
              <>
                <div className="h-4 w-[1px] bg-[var(--border-color)] hidden sm:block"></div>
                <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 line-clamp-1 max-w-[150px]">
                  <span className="hidden sm:inline">from</span> {journal.location}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Persona Selector */}
          <div className="relative">
            <button
              onClick={() => setShowPersonaDropdown(!showPersonaDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)] transition-colors"
              title="Select Mentor Persona"
            >
              <UserCog className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="hidden sm:inline">{PERSONAS[activePersona].name}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </button>
            {showPersonaDropdown && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#0c1017] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="p-2 bg-slate-50 dark:bg-[#111827] border-b border-[var(--border-color)]">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider px-2">Mentor Style</h4>
                </div>
                <div className="p-1">
                  {(Object.values(PERSONAS) as (typeof PERSONAS[AIPersona])[]).map(persona => (
                    <button
                      key={persona.id}
                      onClick={() => {
                        setActivePersona(persona.id);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('lumina_preferred_persona', persona.id);
                        }
                        setShowPersonaDropdown(false);
                      }}
                      className={`w-full text-left p-3 rounded-lg mb-1 last:mb-0 transition-colors ${
                        activePersona === persona.id 
                          ? 'bg-violet-600/10 border border-violet-500/20' 
                          : 'hover:bg-slate-100 dark:hover:bg-[#1f2937] border border-transparent'
                      }`}
                    >
                      <div className={`text-sm font-medium ${activePersona === persona.id ? 'text-violet-600 dark:text-violet-400' : 'text-[var(--text-primary)]'}`}>
                        {persona.name}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                        {persona.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ThemeToggle />

          <button
            onClick={() => setShowQuoteStudio(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-xs font-semibold text-violet-700 dark:text-violet-300 transition-colors"
            title="Artwork & Quote Card Studio"
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Artwork & Card</span>
          </button>

          <div className="flex items-center text-xs font-medium text-[var(--text-muted)] gap-1.5 bg-[var(--bg-card)] px-3 py-1.5 rounded-lg border border-[var(--border-color)]">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Saved'}
          </div>
        </div>
      </header>

      {/* Quote Card Studio Modal */}
      {showQuoteStudio && journal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-auto animate-scaleUp">
            <QuoteCardStudio
              journal={journal}
              onClose={() => setShowQuoteStudio(false)}
            />
          </div>
        </div>
      )}

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative z-10 px-4 sm:px-10">
        <div className="max-w-3xl w-full mx-auto flex flex-col gap-10 overflow-y-auto pt-10 pb-4 h-full">
          {journal.messages.length === 0 ? (
            <div className="w-full flex flex-col items-center">
              <div className="flex gap-2 mb-8 bg-white/5 p-1 rounded-xl">
                <button 
                  onClick={() => setIsTradeMode(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!isTradeMode ? 'bg-violet-600 text-white' : 'text-white/40 hover:text-white/80'}`}
                >
                  Standard Journal
                </button>
                <button 
                  onClick={() => setIsTradeMode(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isTradeMode ? 'bg-violet-600 text-white' : 'text-white/40 hover:text-white/80'}`}
                >
                  Trade Log
                </button>
              </div>

              {isTradeMode && (
                <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left space-y-4 shadow-xl">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium text-white/90">Pre-Trade Checklist</h3>
                    {btcPrice && (
                       <div className="text-sm px-2 py-1 bg-white/10 rounded text-white/80 font-mono">
                         BTC: ${btcPrice.usd.toLocaleString()} <span className={btcPrice.usd_24h_change >= 0 ? "text-green-400" : "text-red-400"}>({btcPrice.usd_24h_change >= 0 ? "+" : ""}{btcPrice.usd_24h_change.toFixed(2)}%)</span>
                       </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-white/50 uppercase font-bold tracking-wider block mb-1">What is your thesis?</label>
                      <input type="text" value={thesis} onChange={e => setThesis(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50" placeholder="e.g. Breaking out of multi-week resistance..." />
                    </div>
                    <div>
                      <label className="text-xs text-white/50 uppercase font-bold tracking-wider block mb-1">What proves you wrong?</label>
                      <input type="text" value={invalidation} onChange={e => setInvalidation(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50" placeholder="e.g. Daily close below $64,000..." />
                    </div>
                    <div>
                      <label className="text-xs text-white/50 uppercase font-bold tracking-wider block mb-1">What is your current emotional state?</label>
                      <input type="text" value={emotionalState} onChange={e => setEmotionalState(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50" placeholder="e.g. A bit anxious, feeling like I might miss out..." />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-[10px] text-white/30 text-center sm:text-left">
                      Educational & cognitive bias guardrail system.
                    </div>
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!thesis.trim() || !invalidation.trim() || !emotionalState.trim() || isEvaluatingTrade || showCoolDownModal || coolDownTime > 0}
                      className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-violet-900/30"
                    >
                      {isEvaluatingTrade ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Evaluating Bias...</span>
                        </>
                      ) : coolDownTime > 0 ? (
                        <span>Cool-down Active ({formatTime(coolDownTime)})</span>
                      ) : (
                        <span>Finalize & Log Trade</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {!isTradeMode && (
                <div className="text-center m-auto mt-10">
                  <div className="w-16 h-16 bg-white/5 border border-white/10 text-white/40 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm transform -rotate-6">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl serif text-white/90 mb-3 glow-text">How are you feeling today?</h3>
                  <p className="text-white/50 max-w-md mx-auto leading-relaxed text-sm">
                    Start writing whatever is on your mind. The AI will listen, reflect, and help you gain insights into your thoughts.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-8 w-full max-w-3xl mx-auto">
              {/* Primary Entry */}
              {journal.messages.length > 0 && (
                <div className="space-y-4 opacity-90">
                  <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Original Entry</div>
                  <p className="serif text-2xl sm:text-3xl leading-relaxed italic text-white/90 whitespace-pre-wrap pl-4 border-l-2 border-white/10">
                    "{journal.messages[0].content}"
                  </p>
                  {journal.messages[0].mediaBase64 && journal.messages[0].mediaMimeType && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-white/10 max-w-sm shadow-lg">
                      {journal.messages[0].mediaMimeType.startsWith('image/') ? (
                        <img src={`data:${journal.messages[0].mediaMimeType};base64,${journal.messages[0].mediaBase64}`} alt="Attached media" className="w-full h-auto object-cover" />
                      ) : (
                         <div className="p-4 bg-white/5 text-white/60 text-xs font-mono">Attachment: {journal.messages[0].mediaMimeType}</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Granular Emotion Tags & CBT Distortion Alerts */}
              {journal.messages.length > 0 && (
                <EmotionTagManager
                  emotions={journal.emotions || []}
                  cbtDistortions={journal.cbtDistortions || []}
                  userFeedback={journal.userFeedback}
                  onChangeEmotions={handleChangeEmotions}
                  onFeedback={handleFeedback}
                  onReanalyze={() => {
                    if (journal.messages.length > 0) {
                      analyzeEmotionForEntry(journal.messages[0].content, journal);
                    }
                  }}
                  isAnalyzing={isAnalyzingEmotion}
                />
              )}

              {/* Initial AI Reflection */}
              {journal.messages.length > 1 && (
                <div className="space-y-6 pt-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-violet-400" />
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold">Mentorship Reflection</div>
                  </div>
                  <p className="serif text-xl sm:text-2xl leading-snug text-white/95 glow-text whitespace-pre-wrap">
                    {journal.messages[1].content}
                  </p>
                </div>
              )}

              {/* Follow-up Chat Thread */}
              {journal.messages.length > 2 && (
                <div className="mt-8 pt-8 border-t border-dashed border-white/10 flex flex-col gap-6">
                  <div className="text-xs uppercase tracking-widest text-white/30 font-bold text-center mb-4">Follow-up Thread</div>
                  {journal.messages.slice(2).map((msg) => (
                    msg.role === 'user' ? (
                      <div key={msg.id} className="space-y-2 opacity-80 self-end max-w-[85%] bg-white/5 p-4 rounded-2xl rounded-tr-sm">
                        <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold text-right">You</div>
                        <p className="text-base leading-relaxed text-white/90 whitespace-pre-wrap">
                          {msg.content}
                        </p>
                        {msg.mediaBase64 && msg.mediaMimeType && (
                          <div className="mt-3 rounded-lg overflow-hidden border border-white/10 max-w-[200px] ml-auto">
                            {msg.mediaMimeType.startsWith('image/') ? (
                              <img src={`data:${msg.mediaMimeType};base64,${msg.mediaBase64}`} alt="Attached media" className="w-full h-auto object-cover" />
                            ) : (
                               <div className="p-2 bg-white/5 text-white/60 text-[10px] font-mono">Attachment: {msg.mediaMimeType}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div key={msg.id} className="space-y-2 self-start max-w-[85%] bg-violet-500/10 border border-violet-500/10 p-4 rounded-2xl rounded-tl-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_#a78bfa]"></div>
                          <div className="text-[10px] uppercase tracking-widest text-violet-300 font-bold">Mentor</div>
                        </div>
                        <p className="text-base leading-relaxed text-white/90 whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
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
          <div ref={messagesEndRef} className="pb-32" />
        </div>
      </main>

      {/* Input Area */}
      <footer className="h-auto min-h-[7rem] pt-4 px-4 sm:px-10 pb-8 flex flex-col justify-end items-center relative z-10 bg-gradient-to-t from-[var(--bg-primary)] to-transparent shrink-0">
        <div className="w-full max-w-3xl glass bg-[var(--bg-card)] rounded-2xl p-2 flex flex-col focus-within:ring-2 ring-violet-500/40 transition-all shadow-lg border border-[var(--border-color)]">
          {mediaFile && (
            <div className="w-full flex items-center gap-2 px-2 pt-1 pb-2 border-b border-white/5 mb-2">
              <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-white/10 group bg-black/20">
                {mediaFile.mimeType.startsWith('image/') ? (
                  <img src={mediaFile.url} alt="Attachment preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-mono">MEDIA</div>
                )}
                <button onClick={() => setMediaFile(null)} className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
          <div className="w-full flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
              accept="image/*,video/*,audio/*"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                isCompressing 
                  ? 'bg-violet-500/20 text-violet-500 animate-pulse' 
                  : 'bg-white/5 dark:bg-white/5 text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]'
              }`}
              title="Attach media"
            >
              {isCompressing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleRecording}
              className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                isRecording 
                  ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse' 
                  : 'bg-white/5 dark:bg-white/5 text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]'
              }`}
              title="Toggle voice input"
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={requestLocation}
              disabled={isFetchingLocation || !!journal.location}
              className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                journal.location 
                  ? 'bg-green-500/10 text-green-400' 
                  : isFetchingLocation
                  ? 'bg-violet-500/20 text-violet-500 animate-pulse'
                  : 'bg-white/5 dark:bg-white/5 text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]'
              }`}
              title={journal.location ? `Location attached: ${journal.location}` : "Auto-attach location data"}
            >
              {isFetchingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isTradeMode && journal.messages.length === 0 ? "Enter trade notes or thesis rationale..." : "Continue your reflection..."}
              className="flex-1 bg-transparent border-none outline-none px-2 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)]"
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !isTradeMode && !mediaFile) || isTyping || showCoolDownModal || coolDownTime > 0 || isEvaluatingTrade}
              className="w-10 h-10 shrink-0 bg-violet-600 hover:bg-violet-500 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-violet-900/20"
              title={coolDownTime > 0 ? `Cool-down active (${formatTime(coolDownTime)})` : "Send / Log Entry"}
            >
              {isEvaluatingTrade ? (
                <Loader2 className="w-4 h-4 animate-spin text-white/70" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Behavioral Guardrail Overlay Modal */}
      {showCoolDownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05070A]/95 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0A0D14] border border-red-500/40 w-full max-w-xl rounded-2xl p-6 sm:p-8 shadow-2xl shadow-red-950/60 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl shrink-0">
                <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Behavioral Guardrail Triggered</h2>
                <p className="text-xs text-red-400 font-medium">Cognitive bias detected — mandatory cool-down in effect</p>
              </div>
            </div>
            
            <div className="bg-red-500/10 text-red-200 p-4 rounded-xl border border-red-500/20 text-sm leading-relaxed space-y-3">
              <div>
                Flagged Cognitive Pattern: <strong className="text-red-400 font-bold">{biasWarning?.highestBias || "Emotional Tilt / Impulse"}</strong>
              </div>
              
              {biasWarning?.reasoning && (
                <div className="text-xs text-white/80 italic bg-black/30 p-2.5 rounded-lg border border-white/5">
                  "{biasWarning.reasoning}"
                </div>
              )}

              {biasWarning?.detected_biases && biasWarning.detected_biases.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-semibold text-red-400 uppercase tracking-wider">Detected Signals:</div>
                  <div className="space-y-1.5">
                    {biasWarning.detected_biases.map((b: any, idx: number) => (
                      <div key={idx} className="text-xs bg-black/40 p-2 rounded-lg border border-red-500/20 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-red-300 capitalize">{b.type?.replace('_', ' ')}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                            b.confidence === 'high' ? 'bg-red-500/30 text-red-300 border border-red-500/40' :
                            b.confidence === 'medium' ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' :
                            'bg-white/10 text-white/60'
                          }`}>
                            {b.confidence} confidence
                          </span>
                        </div>
                        {b.evidence && (
                          <div className="text-white/60 text-[11px] italic">
                            Evidence: "{b.evidence}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {biasWarning?.scores && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs">
                  {Object.entries(biasWarning.scores).map(([bias, score]: [string, any]) => (
                    <div key={bias} className={`p-2 rounded-lg border ${score > 70 ? 'bg-red-950/60 border-red-500/40 text-red-300 font-bold' : 'bg-black/30 border-white/5 text-white/50'}`}>
                      <div className="capitalize truncate">{bias.replace(/([A-Z])/g, ' $1')}</div>
                      <div className="text-sm font-mono">{score}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center justify-center py-4 bg-black/40 rounded-xl border border-red-500/20">
              <div className="text-4xl sm:text-5xl font-mono text-red-400 tracking-widest font-bold">{formatTime(coolDownTime)}</div>
              <div className="text-xs uppercase tracking-widest text-red-400/70 mt-2 font-bold">Cool-down Timer</div>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-white/80 font-semibold block">AI Mentorship Challenge Question:</label>
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-white/95 italic text-sm leading-relaxed">
                "{challengeQuestion || biasWarning?.challengeQuestion || 'Are you trading your rules or trading your emotions?'}"
              </div>
              <textarea 
                value={challengeAnswer}
                onChange={e => setChallengeAnswer(e.target.value)}
                placeholder="Reflect on the challenge question and write your honest assessment to unlock early..."
                className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/60 min-h-[100px] resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
              <div className="text-xs text-white/40 text-center sm:text-left">
                {coolDownTime > 0 ? `Submissions locked for ${formatTime(coolDownTime)}` : 'Cool-down period expired'}
              </div>
              <button 
                onClick={handleUnlockWithChallenge}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-red-900/40 hover:shadow-red-800/60 cursor-pointer"
              >
                Submit Reflection to Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
