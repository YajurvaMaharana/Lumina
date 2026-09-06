import React from 'react';

interface NeuralOrbitProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export default function NeuralOrbit({
  size = 38,
  className = '',
  glow = true
}: NeuralOrbitProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none group ${className}`}
      style={{ width: size, height: size }}
      title="Lumina Neural Orbit"
    >
      {/* Ambient background glow behind the logo */}
      {glow && (
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-600/30 via-indigo-500/20 to-cyan-400/20 blur-md group-hover:blur-lg group-hover:opacity-100 opacity-75 transition-all duration-700 pointer-events-none"
          style={{ transform: 'scale(1.15)' }}
        />
      )}

      <svg
        viewBox="0 0 52 52"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 overflow-visible transform transition-transform duration-500 group-hover:scale-105"
      >
        <defs>
          {/* Subtle Outer Bloom Filter */}
          <filter id="neural-orbit-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* High-intensity Node Glow Filter */}
          <filter id="node-intense-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Crescent Moon Gradient */}
          <linearGradient id="lunar-crescent-grad" x1="12" y1="8" x2="40" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c084fc" />     {/* Luminous violet */}
            <stop offset="50%" stopColor="#818cf8" />    {/* Indigo */}
            <stop offset="100%" stopColor="#38bdf8" />   {/* Celestial Cyan */}
          </linearGradient>

          {/* Crescent Inner Shadow / Rim Gradient */}
          <linearGradient id="lunar-rim-grad" x1="10" y1="12" x2="38" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#c084fc" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>

          {/* Orbital Synapse Wave Gradient */}
          <linearGradient id="orbit-wave-grad" x1="4" y1="26" x2="48" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
            <stop offset="35%" stopColor="#818cf8" stopOpacity="0.85" />
            <stop offset="65%" stopColor="#c084fc" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.2" />
          </linearGradient>

          {/* Secondary Counter Wave Gradient */}
          <linearGradient id="counter-wave-grad" x1="6" y1="30" x2="46" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
          </linearGradient>

          {/* Core Node Radial Glow */}
          <radialGradient id="node-core-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </radialGradient>

          {/* Cyan Node Radial Glow */}
          <radialGradient id="cyan-node-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </radialGradient>
        </defs>

        <style>{`
          @keyframes neural-spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes neural-spin-reverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          @keyframes wave-pulse {
            0%, 100% { stroke-dashoffset: 0; opacity: 0.75; }
            50% { stroke-dashoffset: 24; opacity: 1; }
          }
          @keyframes wave-pulse-alt {
            0%, 100% { stroke-dashoffset: 16; opacity: 0.5; }
            50% { stroke-dashoffset: 0; opacity: 0.85; }
          }
          @keyframes node-breathe {
            0%, 100% { transform: scale(1); opacity: 0.85; }
            50% { transform: scale(1.35); opacity: 1; }
          }
          @keyframes constellation-glow {
            0%, 100% { opacity: 0.35; stroke-width: 0.75; }
            50% { opacity: 0.8; stroke-width: 1.1; }
          }
          @keyframes moon-halo-shimmer {
            0%, 100% { opacity: 0.7; filter: drop-shadow(0 0 3px rgba(192, 132, 252, 0.4)); }
            50% { opacity: 0.95; filter: drop-shadow(0 0 7px rgba(56, 189, 248, 0.7)); }
          }

          .orbit-carrier-ring {
            transform-origin: 26px 26px;
            animation: neural-spin-slow 22s linear infinite;
          }
          .orbit-carrier-ring-fast {
            transform-origin: 26px 26px;
            animation: neural-spin-reverse 14s linear infinite;
          }
          .neural-wave-line {
            stroke-dasharray: 40 10;
            animation: wave-pulse 6s ease-in-out infinite;
          }
          .neural-wave-line-alt {
            stroke-dasharray: 30 15;
            animation: wave-pulse-alt 5s ease-in-out infinite;
          }
          .crescent-halo {
            animation: moon-halo-shimmer 4s ease-in-out infinite;
          }
          .synapse-line {
            animation: constellation-glow 3.5s ease-in-out infinite;
          }
          .node-pulse-1 {
            transform-origin: 26px 26px;
            animation: node-breathe 2.8s ease-in-out infinite;
          }
          .node-pulse-2 {
            transform-origin: 36px 17px;
            animation: node-breathe 3.4s ease-in-out infinite 0.7s;
          }
          .node-pulse-3 {
            transform-origin: 16px 35px;
            animation: node-breathe 3.1s ease-in-out infinite 1.4s;
          }
          .node-pulse-4 {
            transform-origin: 15px 17px;
            animation: node-breathe 2.5s ease-in-out infinite 0.3s;
          }
        `}</style>

        {/* 1. Deep Celestial Lunar Crescent Moon */}
        <g className="crescent-halo">
          {/* Outer glow pass of crescent */}
          <path
            d="M 26 8 
               C 36 8 44 16 44 26 
               C 44 36 36 44 26 44 
               C 21.5 44 17.5 42.4 14.3 39.8 
               C 21 39.5 28 34.5 28 26 
               C 28 17.5 21 12.5 14.3 12.2 
               C 17.5 9.6 21.5 8 26 8 Z"
            fill="url(#lunar-crescent-grad)"
            filter="url(#neural-orbit-glow)"
            opacity="0.9"
          />

          {/* Crisp inner rim specular highlight */}
          <path
            d="M 26 9.5
               C 35 9.5 42.5 17 42.5 26
               C 42.5 35 35 42.5 26 42.5
               C 22 42.5 18.5 41.2 15.6 39
               C 22.8 38.2 29.5 33 29.5 26
               C 29.5 19 22.8 13.8 15.6 13
               C 18.5 10.8 22 9.5 26 9.5 Z"
            fill="url(#lunar-rim-grad)"
            opacity="0.5"
          />
        </g>

        {/* 2. Synaptic Constellation Vector Lines (Neural Interconnects) */}
        <g className="synapse-line" stroke="#c084fc" strokeLinecap="round">
          <line x1="15" y1="17" x2="26" y2="26" strokeOpacity="0.4" />
          <line x1="26" y1="26" x2="36" y2="17" strokeOpacity="0.5" />
          <line x1="26" y1="26" x2="38" y2="34" strokeOpacity="0.45" />
          <line x1="16" y1="35" x2="26" y2="26" strokeOpacity="0.4" />
          <line x1="15" y1="17" x2="16" y2="35" strokeOpacity="0.25" strokeDasharray="2 2" />
        </g>

        {/* 3. Flowing Primary Cognitive Data Waves (Intersecting the Moon) */}
        <path
          d="M 5 31 C 13 36, 19 14, 26 26 C 33 38, 39 16, 47 21"
          stroke="url(#orbit-wave-grad)"
          strokeWidth="2"
          strokeLinecap="round"
          className="neural-wave-line"
        />

        {/* Secondary Harmonic Wave */}
        <path
          d="M 6 22 C 14 15, 20 37, 26 26 C 32 15, 38 34, 46 29"
          stroke="url(#counter-wave-grad)"
          strokeWidth="1.25"
          strokeLinecap="round"
          className="neural-wave-line-alt"
        />

        {/* 4. Elliptical Orbit Track 1 (Clockwise orbital nodes) */}
        <g className="orbit-carrier-ring">
          {/* Subtle orbital ellipse path */}
          <ellipse
            cx="26"
            cy="26"
            rx="21"
            ry="9.5"
            transform="rotate(-28 26 26)"
            stroke="url(#orbit-wave-grad)"
            strokeWidth="0.8"
            strokeDasharray="4 6"
            strokeOpacity="0.55"
          />

          {/* Orbiting Satellite Node Alpha (Cyan) */}
          <g transform="translate(44, 21.5)">
            <circle r="3" fill="#38bdf8" filter="url(#node-intense-glow)" opacity="0.6" />
            <circle r="1.75" fill="#ffffff" />
          </g>

          {/* Orbiting Satellite Node Beta (Lavender) */}
          <g transform="translate(8, 30.5)">
            <circle r="2.5" fill="#c084fc" filter="url(#node-intense-glow)" opacity="0.6" />
            <circle r="1.4" fill="#ffffff" />
          </g>
        </g>

        {/* 5. Elliptical Orbit Track 2 (Counter-rotation data stream) */}
        <g className="orbit-carrier-ring-fast">
          <ellipse
            cx="26"
            cy="26"
            rx="18"
            ry="7.5"
            transform="rotate(38 26 26)"
            stroke="#818cf8"
            strokeWidth="0.6"
            strokeDasharray="2 7"
            strokeOpacity="0.4"
          />

          {/* Orbiting Satellite Node Gamma (Teal/Emerald) */}
          <g transform="translate(39, 31)">
            <circle r="2" fill="#2dd4bf" filter="url(#neural-orbit-glow)" />
            <circle r="1.1" fill="#ffffff" />
          </g>
        </g>

        {/* 6. Stationary Constellation Nodes (Heart of Neural Nexus) */}
        {/* Central Cognitive Core Node */}
        <g className="node-pulse-1">
          <circle cx="26" cy="26" r="4.5" fill="url(#node-core-radial)" filter="url(#node-intense-glow)" />
          <circle cx="26" cy="26" r="2" fill="#ffffff" />
        </g>

        {/* Upper Right Constellation Node */}
        <g className="node-pulse-2">
          <circle cx="36" cy="17" r="3.2" fill="url(#cyan-node-radial)" filter="url(#neural-orbit-glow)" />
          <circle cx="36" cy="17" r="1.5" fill="#ffffff" />
        </g>

        {/* Lower Left Constellation Node */}
        <g className="node-pulse-3">
          <circle cx="16" cy="35" r="3" fill="#818cf8" filter="url(#neural-orbit-glow)" opacity="0.8" />
          <circle cx="16" cy="35" r="1.3" fill="#ffffff" />
        </g>

        {/* Upper Left Constellation Node */}
        <g className="node-pulse-4">
          <circle cx="15" cy="17" r="2.8" fill="#c084fc" filter="url(#neural-orbit-glow)" opacity="0.8" />
          <circle cx="15" cy="17" r="1.2" fill="#ffffff" />
        </g>

        {/* Lower Right Secondary Node */}
        <circle cx="38" cy="34" r="1.4" fill="#a78bfa" opacity="0.9" />
        <circle cx="38" cy="34" r="0.75" fill="#ffffff" />
      </svg>
    </div>
  );
}
