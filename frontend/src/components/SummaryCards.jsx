import React from 'react';
import { ShieldX, AlertOctagon, AlertTriangle, Info, ShieldCheck, ShieldBan } from 'lucide-react';

const SummaryCards = ({ summary }) => {
  const cards = [
    {
      title: 'Total Analyzed',
      value: (summary.total || 0).toLocaleString(),
      icon: ShieldCheck,
      color: 'text-sky-400 border-sky-500/20 bg-sky-950/10 hover:border-sky-500/40',
      glow: 'shadow-sky-500/5',
    },
    {
      title: 'Critical Threats',
      value: (summary.critical || 0).toLocaleString(),
      icon: ShieldX,
      color: 'text-cyber-red border-rose-500/20 bg-rose-950/10 hover:border-rose-500/40 hover:shadow-glow-red',
      glow: 'shadow-rose-500/5',
    },
    {
      title: 'High Threats',
      value: (summary.high || 0).toLocaleString(),
      icon: AlertOctagon,
      color: 'text-cyber-orange border-orange-500/20 bg-orange-950/10 hover:border-orange-500/40 hover:shadow-glow-orange',
      glow: 'shadow-orange-500/5',
    },
    {
      title: 'Medium Threats',
      value: (summary.medium || 0).toLocaleString(),
      icon: AlertTriangle,
      color: 'text-cyber-yellow border-amber-500/20 bg-amber-950/10 hover:border-amber-500/40 hover:shadow-glow-yellow',
      glow: 'shadow-amber-500/5',
    },
    {
      title: 'Low / Benign',
      value: (summary.low || 0).toLocaleString(),
      icon: Info,
      color: 'text-slate-400 border-slate-700/30 bg-slate-900/10 hover:border-slate-700/60',
      glow: 'shadow-slate-500/5',
    },
    {
      title: 'Threats Blocked',
      value: (summary.blocked || 0).toLocaleString(),
      icon: ShieldBan,
      color: 'text-emerald-400 border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/40',
      glow: 'shadow-emerald-500/5',
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className={`glass-panel p-4 transition-all duration-300 shadow ${card.color} ${card.glow}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{card.title}</span>
              <Icon className="w-4 h-4 opacity-80" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-xl font-bold tracking-tight text-slate-100">{card.value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SummaryCards;
