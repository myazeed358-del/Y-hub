import React from 'react';

/**
 * Y-Sheets mark inspired by the approved Y-Hub orbit/Y reference.
 * Vector artwork stays crisp at toolbar and tile sizes.
 */
export function YSheetsBrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 128 128" role="img" aria-label="Y-Sheets by Y-Hub">
      <defs>
        <linearGradient id="ys-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="45%" stopColor="#123AAA" />
          <stop offset="100%" stopColor="#130A47" />
        </linearGradient>
        <linearGradient id="ys-mark-y" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D990FF" />
          <stop offset="47%" stopColor="#22D3EE" />
          <stop offset="72%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#AE50F5" />
        </linearGradient>
        <linearGradient id="ys-mark-ring" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#BA5CF6" />
          <stop offset="56%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
        <radialGradient id="ys-mark-orb" cx=".3" cy=".2" r=".9">
          <stop offset="0%" stopColor="#BBF7FF"/>
          <stop offset="65%" stopColor="#22D3EE"/>
          <stop offset="100%" stopColor="#2563EB"/>
        </radialGradient>
      </defs>
      <rect x="5" y="5" width="118" height="118" rx="29" fill="url(#ys-mark-bg)" stroke="#5934CC" strokeWidth="2"/>
      <circle cx="64" cy="64" r="40" fill="none" stroke="url(#ys-mark-ring)" strokeWidth="3" strokeLinecap="round" strokeDasharray="42 14 46 16 42 91" opacity=".93"/>
      <circle cx="64" cy="24" r="6.5" fill="url(#ys-mark-orb)"/>
      <circle cx="28" cy="80" r="6" fill="#AB5CF6"/>
      <circle cx="100" cy="80" r="6" fill="#E879B4"/>
      <path d="M25 40 H40 Q45 40 49 45 L64 62 L79 45 Q84 40 90 40 H103 Q107 40 105 44 L76 77 Q72 82 72 89 V104 Q72 108 68 108 H60 Q56 108 56 104 V89 Q56 82 52 77 L23 44 Q21 40 25 40 Z" fill="url(#ys-mark-y)" stroke="#A5F3FC" strokeOpacity=".38" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M27 43 H40 Q45 43 48 47 L64 65" fill="none" stroke="#E9B9FF" strokeWidth="3" strokeLinecap="round" opacity=".7"/>
      <path d="M64 67 L81 47 Q84 43 100 43" fill="none" stroke="#A5F3FC" strokeWidth="2.5" strokeLinecap="round" opacity=".64"/>
    </svg>
  );
}
