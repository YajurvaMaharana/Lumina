import React, { useEffect, useState } from 'react';
import NeuralOrbit from './NeuralOrbit';

interface StartupIntroProps {
  onComplete?: () => void;
  duration?: number;
}

export default function StartupIntro({ onComplete, duration = 1600 }: StartupIntroProps) {
  const [phase, setPhase] = useState<'splash' | 'fade' | 'done'>('splash');

  useEffect(() => {
    // Stage 1: Display centered splash sequence
    const fadeTimer = setTimeout(() => {
      setPhase('fade');
    }, duration - 500);

    // Stage 2: Complete and unmount
    const doneTimer = setTimeout(() => {
      setPhase('done');
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [duration, onComplete]);

  if (phase === 'done') return null;

  return (
    <div
      aria-label="Lumina Initializing"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-500 ease-out ${
        phase === 'fade' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Dark frosted glass backdrop accentuating the background Aurora waves */}
      <div className="absolute inset-0 bg-[#05070A]/85 backdrop-blur-md" />

      {/* Centered Brand Intro Group */}
      <div className="relative z-10 flex flex-col items-center gap-5 transform transition-transform duration-700 ease-out">
        <div className="relative flex items-center justify-center p-3">
          {/* Ambient luminous glow pulse */}
          <div className="absolute inset-0 rounded-full bg-violet-600/20 blur-2xl animate-pulse" />
          <NeuralOrbit size={64} speed="normal" />
        </div>

        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight glow-text text-white drop-shadow-lg">
            Lumina
          </h1>
          <p className="text-xs uppercase tracking-widest text-violet-400/90 font-mono mt-1.5 animate-pulse">
            Neural Cognitive Journal
          </p>
        </div>
      </div>
    </div>
  );
}
