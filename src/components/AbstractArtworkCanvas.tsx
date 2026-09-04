import React, { useMemo } from 'react';
import { JournalArtwork } from '../types';

interface AbstractArtworkCanvasProps {
  artwork: JournalArtwork;
  className?: string;
  showOverlayGrain?: boolean;
  aspectRatio?: 'square' | 'wide' | 'portrait' | 'banner';
  interactive?: boolean;
}

export default function AbstractArtworkCanvas({
  artwork,
  className = '',
  showOverlayGrain = true,
  aspectRatio = 'wide',
  interactive = true
}: AbstractArtworkCanvasProps) {
  const { style, palette, seed, complexity, valence, arousal } = artwork;

  // Derive geometric & generative seed values
  const gen = useMemo(() => {
    const s = seed || 12345;
    const c1 = palette[0] || '#8B5CF6';
    const c2 = palette[1] || '#6366F1';
    const c3 = palette[2] || '#EC4899';
    const c4 = palette[3] || '#38BDF8';
    const c5 = palette[4] || '#10B981';

    // Pseudorandom generator based on seed
    const pseudoRand = (offset: number) => {
      const x = Math.sin(s + offset) * 10000;
      return x - Math.floor(x);
    };

    // Calculate dynamic curve control points
    const curves = Array.from({ length: Math.max(3, Math.min(6, complexity)) }).map((_, i) => ({
      cx1: 150 + pseudoRand(i * 3) * 300,
      cy1: 100 + pseudoRand(i * 3 + 1) * 400,
      cx2: 450 + pseudoRand(i * 3 + 2) * 300,
      cy2: 200 + pseudoRand(i * 3 + 3) * 400,
      endX: 800,
      endY: 250 + (i * 80) + pseudoRand(i) * 50,
      color: palette[i % palette.length],
      opacity: 0.35 + pseudoRand(i + 10) * 0.45,
      strokeWidth: 28 + pseudoRand(i + 20) * 40
    }));

    // Orbitals / Nodes
    const orbitals = Array.from({ length: 8 }).map((_, i) => ({
      cx: 100 + pseudoRand(i * 7) * 600,
      cy: 80 + pseudoRand(i * 7 + 1) * 440,
      r: 40 + pseudoRand(i * 7 + 2) * 120,
      color: palette[(i + 1) % palette.length],
      opacity: 0.25 + pseudoRand(i + 15) * 0.4
    }));

    // Geometric angles for prism
    const prismPolys = Array.from({ length: 5 }).map((_, i) => {
      const x1 = 100 + pseudoRand(i * 4) * 600;
      const y1 = 100 + pseudoRand(i * 4 + 1) * 400;
      const x2 = x1 + 100 + pseudoRand(i * 4 + 2) * 200;
      const y2 = y1 + 50 + pseudoRand(i * 4 + 3) * 150;
      const x3 = x1 - 50 + pseudoRand(i * 4 + 4) * 180;
      const y3 = y1 + 120 + pseudoRand(i * 4 + 5) * 180;
      return {
        points: `${x1},${y1} ${x2},${y2} ${x3},${y3}`,
        color: palette[i % palette.length],
        opacity: 0.3 + pseudoRand(i + 30) * 0.4
      };
    });

    return { c1, c2, c3, c4, c5, curves, orbitals, prismPolys, s };
  }, [seed, palette, complexity]);

  const aspectClass = {
    square: 'aspect-square',
    wide: 'aspect-[16/9]',
    portrait: 'aspect-[3/4]',
    banner: 'aspect-[21/9]'
  }[aspectRatio];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#070A12] select-none ${aspectClass} ${className} ${
        interactive ? 'group' : ''
      }`}
    >
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Gradients */}
          <radialGradient id={`bgGrad-${gen.s}`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor={gen.c2} stopOpacity="0.45" />
            <stop offset="50%" stopColor={gen.c1} stopOpacity="0.25" />
            <stop offset="100%" stopColor="#04060B" stopOpacity="0.95" />
          </radialGradient>

          <linearGradient id={`gradWave-${gen.s}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gen.c1} stopOpacity="0.8" />
            <stop offset="50%" stopColor={gen.c3} stopOpacity="0.6" />
            <stop offset="100%" stopColor={gen.c4} stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id={`neonGlass-${gen.s}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={gen.c4} stopOpacity="0.7" />
            <stop offset="100%" stopColor={gen.c1} stopOpacity="0.1" />
          </linearGradient>

          {/* Glow Filters */}
          <filter id={`blurSoft-${gen.s}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="40" result="blur" />
          </filter>
          <filter id={`blurMist-${gen.s}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="65" result="blur" />
          </filter>
        </defs>

        {/* Deep Atmosphere Base */}
        <rect width="800" height="600" fill={`url(#bgGrad-${gen.s})`} />

        {/* STYLE SPECIFIC RENDERERS */}
        {style === 'abstract_fluid' && (
          <g>
            {/* Luminous Blobs */}
            {gen.orbitals.slice(0, 4).map((orb, i) => (
              <circle
                key={`fluid-orb-${i}`}
                cx={orb.cx}
                cy={orb.cy}
                r={orb.r * 1.4}
                fill={orb.color}
                opacity={orb.opacity}
                filter={`url(#blurMist-${gen.s})`}
              />
            ))}

            {/* Fluid organic sweeping curves */}
            {gen.curves.map((c, i) => (
              <path
                key={`fluid-path-${i}`}
                d={`M 0,${150 + i * 90} Q ${c.cx1},${c.cy1} ${c.cx2},${c.cy2} T 800,${c.endY}`}
                fill="none"
                stroke={c.color}
                strokeWidth={c.strokeWidth}
                strokeLinecap="round"
                opacity={c.opacity}
                filter={`url(#blurSoft-${gen.s})`}
              />
            ))}

            {/* Sharp harmonic foreground wave */}
            <path
              d={`M -50,300 C 200,100 400,500 850,250`}
              fill="none"
              stroke={`url(#gradWave-${gen.s})`}
              strokeWidth="4"
              opacity="0.85"
            />
            <path
              d={`M -50,350 C 250,550 550,150 850,400`}
              fill="none"
              stroke={gen.c4}
              strokeWidth="2"
              strokeDasharray="6 8"
              opacity="0.6"
            />
          </g>
        )}

        {style === 'geometric_aura' && (
          <g>
            {/* Concentric Aura Energy Rings */}
            <circle cx="400" cy="300" r="280" fill="none" stroke={gen.c1} strokeWidth="1" opacity="0.2" />
            <circle cx="400" cy="300" r="220" fill="none" stroke={gen.c2} strokeWidth="2" strokeDasharray="8 6" opacity="0.35" />
            <circle cx="400" cy="300" r="160" fill="none" stroke={gen.c3} strokeWidth="1.5" opacity="0.45" />
            <circle cx="400" cy="300" r="90" fill={gen.c3} opacity="0.35" filter={`url(#blurSoft-${gen.s})`} />
            <circle cx="400" cy="300" r="45" fill={gen.c4} opacity="0.75" />

            {/* Ray spokes */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const x2 = 400 + Math.cos(angle) * 320;
              const y2 = 300 + Math.sin(angle) * 320;
              return (
                <line
                  key={`spoke-${i}`}
                  x1="400"
                  y1="300"
                  x2={x2}
                  y2={y2}
                  stroke={gen.c5}
                  strokeWidth="1"
                  opacity={i % 2 === 0 ? "0.2" : "0.08"}
                />
              );
            })}
          </g>
        )}

        {style === 'minimalist_waveform' && (
          <g>
            <rect width="800" height="600" fill="#060911" />
            {Array.from({ length: 9 }).map((_, i) => {
              const yBase = 120 + i * 45;
              const freq = 0.015 + (i * 0.003);
              const amp = 30 + Math.abs(valence) * 0.6;
              const pathD = Array.from({ length: 17 })
                .map((_, idx) => {
                  const x = idx * 50;
                  const y = yBase + Math.sin(x * freq + (i * 0.8)) * amp;
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                })
                .join(' ');

              return (
                <path
                  key={`wave-${i}`}
                  d={pathD}
                  fill="none"
                  stroke={palette[i % palette.length]}
                  strokeWidth={i === 4 ? "3" : "1.5"}
                  opacity={i === 4 ? "0.9" : 0.2 + (i * 0.07)}
                />
              );
            })}
            <circle cx="400" cy="300" r="140" fill={gen.c2} opacity="0.18" filter={`url(#blurSoft-${gen.s})`} />
          </g>
        )}

        {style === 'expressionist_prism' && (
          <g>
            {gen.prismPolys.map((p, i) => (
              <polygon
                key={`poly-${i}`}
                points={p.points}
                fill={p.color}
                opacity={p.opacity}
                stroke="#FFFFFF"
                strokeWidth="0.5"
                strokeOpacity="0.4"
              />
            ))}
            {gen.orbitals.slice(0, 3).map((orb, i) => (
              <circle
                key={`prism-orb-${i}`}
                cx={orb.cx}
                cy={orb.cy}
                r={orb.r}
                fill={orb.color}
                opacity="0.3"
                filter={`url(#blurSoft-${gen.s})`}
              />
            ))}
          </g>
        )}

        {style === 'cyberpunk_glass' && (
          <g>
            {/* Holographic Matrix Grid */}
            <pattern id={`grid-${gen.s}`} width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={gen.c4} strokeWidth="0.5" strokeOpacity="0.15" />
            </pattern>
            <rect width="800" height="600" fill={`url(#grid-${gen.s})`} />

            {/* Neon Beams */}
            <line x1="0" y1="450" x2="800" y2="150" stroke={gen.c3} strokeWidth="4" opacity="0.8" />
            <line x1="0" y1="450" x2="800" y2="150" stroke="#FFF" strokeWidth="1" opacity="0.9" />
            <line x1="100" y1="0" x2="700" y2="600" stroke={gen.c4} strokeWidth="2" strokeDasharray="12 12" opacity="0.5" />
            
            <circle cx="500" cy="250" r="180" fill={gen.c1} opacity="0.25" filter={`url(#blurSoft-${gen.s})`} />
          </g>
        )}

        {style === 'watercolor_mist' && (
          <g>
            {gen.orbitals.map((orb, i) => (
              <circle
                key={`mist-${i}`}
                cx={orb.cx}
                cy={orb.cy}
                r={orb.r * 1.8}
                fill={orb.color}
                opacity={0.35}
                filter={`url(#blurMist-${gen.s})`}
              />
            ))}
          </g>
        )}

        {/* Global Luminous Center Focal Glow */}
        <circle cx="400" cy="300" r="120" fill="#FFFFFF" opacity="0.05" filter={`url(#blurSoft-${gen.s})`} />
      </svg>

      {/* Film Grain & Vignette Overlay */}
      {showOverlayGrain && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/80" 
        />
      )}
    </div>
  );
}
