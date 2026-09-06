import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme, isTransitioning } = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Prioritize precise cursor coordinate if available, otherwise use center of the toggle button
    const x = e.clientX > 0 ? e.clientX : (rect.left + rect.width / 2);
    const y = e.clientY > 0 ? e.clientY : (rect.top + rect.height / 2);

    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 200);

    toggleTheme({ x, y });
  };

  return (
    <button
      id="theme-toggle-btn"
      onClick={handleClick}
      disabled={isTransitioning}
      aria-label={`Switch to ${theme === 'dark' ? 'high-contrast light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'High-Contrast Light' : 'Dark'} Mode (Radial Transition)`}
      className={`group relative inline-flex items-center gap-2 p-2 rounded-xl border transition-all duration-200 cursor-pointer select-none active:scale-95 ${
        isPressed ? 'scale-90' : ''
      } ${
        theme === 'dark'
          ? 'bg-white/5 border-white/10 text-amber-300 hover:bg-white/10 hover:text-amber-200 hover:border-amber-400/30'
          : 'bg-slate-100 border-slate-300 text-indigo-600 hover:bg-slate-200 hover:text-indigo-700 hover:border-indigo-400/40 shadow-sm'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110" />
        ) : (
          <Moon className="w-4 h-4 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
        )}
      </div>
      {showLabel && (
        <span className="text-xs font-semibold select-none">
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}

