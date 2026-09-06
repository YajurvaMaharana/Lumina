import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';

type Theme = 'dark' | 'light';

export interface ThemeTransitionOptions {
  x?: number;
  y?: number;
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (options?: ThemeTransitionOptions) => void;
  setTheme: (theme: Theme, options?: ThemeTransitionOptions) => void;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('lumina_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Apply theme class to DOM root
  const applyThemeToDOM = (t: Theme) => {
    const root = document.documentElement;
    if (t === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('lumina_theme', t);
  };

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const applyThemeWithRadialAnimation = useCallback((nextTheme: Theme, options?: ThemeTransitionOptions) => {
    if (typeof window === 'undefined') {
      setThemeState(nextTheme);
      return;
    }

    const x = options?.x ?? (window.innerWidth / 2);
    const y = options?.y ?? (window.innerHeight / 2);

    // Calculate maximum radius to the furthest corner
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const isViewTransitionSupported = 
      typeof document !== 'undefined' && 
      'startViewTransition' in document &&
      typeof (document as any).startViewTransition === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isViewTransitionSupported) {
      // Fallback: Radial ripple DOM overlay for older browsers or iframes
      createFallbackRipple(nextTheme, x, y, endRadius);
      setThemeState(nextTheme);
      applyThemeToDOM(nextTheme);
      return;
    }

    setIsTransitioning(true);

    try {
      const transition = (document as any).startViewTransition(() => {
        flushSync(() => {
          setThemeState(nextTheme);
          applyThemeToDOM(nextTheme);
        });
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 520,
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      }).catch((err: any) => {
        console.warn('View Transition animation error:', err);
      });

      transition.finished.finally(() => {
        setIsTransitioning(false);
      });
    } catch (err) {
      console.warn('View Transition execution error:', err);
      setThemeState(nextTheme);
      applyThemeToDOM(nextTheme);
      setIsTransitioning(false);
    }
  }, []);

  const toggleTheme = useCallback((options?: ThemeTransitionOptions) => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    applyThemeWithRadialAnimation(nextTheme, options);
  }, [theme, applyThemeWithRadialAnimation]);

  const setTheme = useCallback((newTheme: Theme, options?: ThemeTransitionOptions) => {
    if (newTheme === theme) return;
    applyThemeWithRadialAnimation(newTheme, options);
  }, [theme, applyThemeWithRadialAnimation]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Fallback radial ripple overlay for environments where startViewTransition is unsupported
function createFallbackRipple(nextTheme: Theme, x: number, y: number, endRadius: number) {
  if (typeof document === 'undefined') return;
  
  const ripple = document.createElement('div');
  ripple.id = 'theme-radial-ripple-fallback';
  ripple.style.position = 'fixed';
  ripple.style.inset = '0';
  ripple.style.zIndex = '999999';
  ripple.style.pointerEvents = 'none';
  ripple.style.backgroundColor = nextTheme === 'light' ? '#f8fafc' : '#05070A';
  ripple.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  ripple.style.transition = 'clip-path 500ms cubic-bezier(0.25, 1, 0.5, 1), opacity 200ms ease 450ms';
  
  document.body.appendChild(ripple);
  
  requestAnimationFrame(() => {
    ripple.style.clipPath = `circle(${endRadius}px at ${x}px ${y}px)`;
  });
  
  setTimeout(() => {
    ripple.style.opacity = '0';
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 220);
  }, 480);
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

