import React from 'react';

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

const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 animate-fade-out-late">
      <div className="flex items-center gap-4 animate-fade-in-up">
        {/* Animated Custom Logo */}
        <CyberCubeLogo className="w-12 h-12 text-emerald-500" />
        
        {/* Text matches the aesthetic of your reference image */}
        <div className="flex items-baseline font-bold tracking-tight text-white text-4xl font-sans">
          cybercube<span className="text-emerald-500 ml-1">.</span>
        </div>
      </div>
      
      {/* Subtle loading progress bar at the bottom */}
      <div className="absolute bottom-16 w-48 h-1 bg-slate-900 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 animate-loading-bar rounded-full"></div>
      </div>
    </div>
  );
};

export default SplashScreen;