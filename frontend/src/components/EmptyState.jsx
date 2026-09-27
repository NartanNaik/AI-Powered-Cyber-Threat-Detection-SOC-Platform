import React from 'react';
import { ShieldAlert } from 'lucide-react';

const EmptyState = ({ message = "No threat activities detected in the selected filter range." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center min-h-[250px] w-full glass-panel bg-slate-900/30">
      <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-300">Clean Logs</h3>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">{message}</p>
    </div>
  );
};

export default EmptyState;
