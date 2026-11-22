import React, { useState } from 'react';
import type { HandSvgKey } from '../utils/vslChoreographer';

export function SignLensBrandLogo({ className = 'w-10 h-10' }: { className?: string }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-sm shrink-0`}
        aria-hidden="true"
      >
        SL
      </span>
    );
  }

  return (
    <span
      className={`${className} relative inline-flex items-center justify-center rounded-xl overflow-hidden border border-slate-200 dark:border-sky-400/35 bg-white shadow-md shadow-sky-500/10 shrink-0`}
    >
      <img
        src="/assets/aistudio/40e0c5be9d7d013486ad7c01ecc971c0_9ca8c533.jpg"
        alt="Logo SignLens"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover scale-[1.72]"
      />
    </span>
  );
}

/* Hand Diagram SVG for VSL Alphabet, Numbers & Phrases */
export function HandLessonSvg({
  type,
  className = 'w-full h-full max-h-40',
}: {
  type: HandSvgKey;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 200 175" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="vslPalmGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {type === 'A' && (
        <>
          <rect x="65" y="75" width="70" height="75" rx="22" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <rect x="70" y="62" width="14" height="32" rx="7" fill="#1e293b" stroke="#64748b" strokeWidth="2.5" />
          <rect x="86" y="60" width="14" height="34" rx="7" fill="#1e293b" stroke="#64748b" strokeWidth="2.5" />
          <rect x="102" y="62" width="14" height="32" rx="7" fill="#1e293b" stroke="#64748b" strokeWidth="2.5" />
          <rect x="118" y="66" width="13" height="28" rx="6" fill="#1e293b" stroke="#64748b" strokeWidth="2.5" />
          <rect x="48" y="55" width="15" height="55" rx="7.5" fill="#10b981" fillOpacity="0.35" stroke="#10b981" strokeWidth="3" />
        </>
      )}

      {type === 'B' && (
        <>
          <rect x="68" y="88" width="64" height="65" rx="20" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <rect x="70" y="25" width="13" height="68" rx="6.5" fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="2.5" />
          <rect x="85" y="18" width="13" height="75" rx="6.5" fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="2.5" />
          <rect x="100" y="22" width="13" height="71" rx="6.5" fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="2.5" />
          <rect x="115" y="32" width="13" height="61" rx="6.5" fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="2.5" />
          <rect x="65" y="102" width="46" height="14" rx="7" fill="#10b981" fillOpacity="0.4" stroke="#10b981" strokeWidth="2.5" />
        </>
      )}

      {type === 'C' && (
        <>
          <path d="M125 38 C75 30, 58 65, 62 100 C66 135, 92 152, 130 140" fill="none" stroke="#38bdf8" strokeWidth="14" strokeLinecap="round" />
          <path d="M122 105 C105 105, 96 114, 104 126" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" />
        </>
      )}

      {type === 'D' && (
        <>
          <rect x="68" y="88" width="64" height="65" rx="20" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <rect x="72" y="20" width="14" height="72" rx="7" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="3" />
          <circle cx="105" cy="105" r="18" fill="none" stroke="#10b981" strokeWidth="4" />
        </>
      )}

      {type === 'DD' && (
        <>
          <rect x="68" y="88" width="64" height="65" rx="20" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <rect x="72" y="20" width="14" height="72" rx="7" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="3" />
          <path d="M55 48 L105 48" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
          <path d="M98 41 L108 48 L98 55" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}

      {type === 'E' && (
        <>
          <rect x="65" y="75" width="70" height="75" rx="22" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <path d="M70 65 Q100 50 130 65" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" />
          <path d="M62 102 Q100 116 126 102" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" />
        </>
      )}

      {type === 'I' && (
        <>
          <rect x="68" y="88" width="64" height="65" rx="20" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <rect x="116" y="26" width="13" height="66" rx="6.5" fill="#10b981" fillOpacity="0.35" stroke="#10b981" strokeWidth="3" />
        </>
      )}

      {type === 'L' && (
        <>
          <rect x="68" y="88" width="64" height="65" rx="20" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <rect x="72" y="20" width="14" height="72" rx="7" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="3" />
          <rect x="26" y="102" width="48" height="14" rx="7" fill="#10b981" fillOpacity="0.35" stroke="#10b981" strokeWidth="3" />
        </>
      )}

      {type === 'O' && (
        <circle cx="100" cy="88" r="36" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="11" />
      )}

      {type === 'U' && (
        <>
          <rect x="68" y="88" width="64" height="65" rx="20" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <rect x="72" y="20" width="13" height="72" rx="6.5" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="3" />
          <rect x="88" y="20" width="13" height="72" rx="6.5" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="3" />
        </>
      )}

      {type === 'V' && (
        <>
          <rect x="68" y="88" width="64" height="65" rx="20" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <rect x="66" y="22" width="13" height="70" rx="6.5" transform="rotate(-10 72 88)" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="3" />
          <rect x="92" y="22" width="13" height="70" rx="6.5" transform="rotate(10 98 88)" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="3" />
        </>
      )}

      {type === 'ILY' && (
        <>
          <rect x="68" y="88" width="64" height="65" rx="20" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <rect x="72" y="22" width="13" height="70" rx="6.5" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="3" />
          <rect x="116" y="28" width="13" height="64" rx="6.5" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="3" />
          <rect x="26" y="102" width="48" height="14" rx="7" fill="#10b981" fillOpacity="0.35" stroke="#10b981" strokeWidth="3" />
          <text x="100" y="128" textAnchor="middle" fill="#f59e0b" fontSize="13" fontWeight="bold">
            ILY
          </text>
        </>
      )}

      {type === 'HELLO' && (
        <>
          <rect x="68" y="85" width="64" height="62" rx="20" fill="url(#vslPalmGrad)" stroke="#38bdf8" strokeWidth="3" />
          <rect x="68" y="24" width="12" height="64" rx="6" fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="2.5" />
          <rect x="84" y="18" width="12" height="70" rx="6" fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="2.5" />
          <rect x="100" y="22" width="12" height="66" rx="6" fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="2.5" />
          <rect x="116" y="30" width="12" height="58" rx="6" fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="2.5" />
          <path d="M45 25 Q100 5 155 25" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray="6 4" />
        </>
      )}

      {type === 'THANKS' && (
        <>
          <rect x="68" y="75" width="64" height="65" rx="20" fill="url(#vslPalmGrad)" stroke="#10b981" strokeWidth="3" />
          <path d="M100 22 L100 62" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
          <path d="M90 50 L100 64 L110 50" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}

      {type === 'HELP' && (
        <>
          <rect x="62" y="108" width="76" height="18" rx="9" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="3" />
          <rect x="74" y="64" width="52" height="42" rx="16" fill="#10b981" fillOpacity="0.3" stroke="#10b981" strokeWidth="3" />
          <path d="M100 54 L100 24" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
          <path d="M90 34 L100 22 L110 34" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/* Feather-style SVG icons preserved from original SignLens UI */
export function MicOnSvg({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export function MicOffSvg({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export function CamOnSvg({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

export function CamOffSvg({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function EndCallSvg({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 17.25 7.76 15.59 6.32 13.72A19.73 19.73 0 0 1 3.25 5.1 2 2 0 0 1 5.23 3H8a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9 10.9" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

export function SpeakerSvg({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export function SendSvg({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function SignBotSvg({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
    </svg>
  );
}
