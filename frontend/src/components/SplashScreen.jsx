import React from 'react';

// How long the splash stays on screen (App.jsx uses this for its timer).
// Keep in sync with `.animate-fade-out-late` in index.css (3.6s) — that's two full eat/spit loops (1.8s each).
export const SPLASH_DURATION_MS = 3600;

// Highly unique, abstract cyber-security tesseract logo
export const CyberCubeLogo = ({ className }) => (
  <svg viewBox="0 0 100 100" fill="none" className={className}>
    <path 
      d="M50 5 L90 27 L90 72 L50 95 L10 72 L10 27 Z" 
      stroke="currentColor" 
      strokeWidth="6" 
      strokeLinejoin="round" 
    />
    <path 
      d="M50 5 L50 50 L90 72 M50 50 L10 72 M10 27 L50 50 L90 27" 
      stroke="currentColor" 
      strokeWidth="4" 
      strokeLinejoin="round" 
      strokeDasharray="150"
      className="animate-draw-lines"
    />
    <circle cx="50" cy="50" r="8" fill="currentColor" className="animate-pulse" />
  </svg>
);

// ---- Eating animation layout (all values are SVG user units) ---------------
const WORD = 'cybercube.'.split('');
const LETTER_START_X = 185;   // centre of the first letter
const LETTER_STEP = 29;       // spacing between letter centres
const LETTER_BASELINE = 94;
const CUBE_CENTER_X = 90;     // where the cube sits; letters are pulled toward this point
const MONO_STACK = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/**
 * The cube opens a wedge-shaped mouth, chomps the letters of "cybercube." one by one
 * (nearest letter first), gulps, then opens again and throws them back out in an arc.
 * Every piece shares one 1.8s cycle, so the loop is seamless. Keyframes live in index.css.
 */
const EatingLogo = () => (
  <svg
    viewBox="0 0 500 160"
    className="w-full max-w-xl px-4 cc-glow"
    role="img"
    aria-label="The CyberCube logo eating and spitting out the word cybercube"
  >
    {/* Letters are drawn first so the cube sits on top and appears to swallow them */}
    <g>
      {WORD.map((ch, i) => {
        const x = LETTER_START_X + i * LETTER_STEP;
        return (
          <text
            key={`${ch}-${i}`}
            className="cc-letter"
            x={x}
            y={LETTER_BASELINE}
            textAnchor="middle"
            fontSize="44"
            fontWeight="700"
            fill={ch === '.' ? '#10b981' : '#ffffff'}
            style={{ '--dx': `${CUBE_CENTER_X - x}px`, '--i': i, fontFamily: MONO_STACK }}
          >
            {ch}
          </text>
        );
      })}
    </g>

    {/* The cube (same geometry as CyberCubeLogo) */}
    <svg
      x="40"
      y="30"
      width="100"
      height="100"
      viewBox="0 0 100 100"
      overflow="visible"
      fill="none"
      className="text-emerald-500"
    >
      <g className="cc-cube-body">
        <path
          d="M50 5 L90 27 L90 72 L50 95 L10 72 L10 27 Z"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="M50 5 L50 50 L90 72 M50 50 L10 72 M10 27 L50 50 L90 27"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Mouth: a slate-950 wedge that opens and closes toward the text */}
        <polygon className="cc-mouth" points="50,50 106,16 106,84" fill="#020617" />
        <circle className="cc-core" cx="50" cy="50" r="8" fill="currentColor" />
      </g>
    </svg>
  </svg>
);

const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 animate-fade-out-late">
      <div className="flex w-full items-center justify-center animate-fade-in-up">
        <EatingLogo />
      </div>
      
      {/* Subtle loading progress bar at the bottom */}
      <div className="absolute bottom-16 w-48 h-1 bg-slate-900 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 animate-loading-bar rounded-full"></div>
      </div>
    </div>
  );
};

export default SplashScreen;