import React from 'react';

const Loader = ({ message = "Analyzing traffic flows..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 min-h-[250px] w-full">
      <div className="relative w-12 h-12">
        <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin"></div>
        <div className="absolute top-1 left-1 w-10 h-10 rounded-full border border-slate-900 bg-slate-950 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-400 font-medium tracking-wide animate-pulse">{message}</p>
    </div>
  );
};

export default Loader;
