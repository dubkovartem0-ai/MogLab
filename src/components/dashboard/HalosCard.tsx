import React from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import { HaloItem } from '../../types/biometrics';

interface HalosCardProps {
  halos: HaloItem[];
}

export const HalosCard: React.FC<HalosCardProps> = ({ halos }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-bold">
            Сильные зоны (Halos)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">Top Percentiles</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {halos.map(halo => (
          <div
            key={halo.id}
            className="rounded-2xl border border-primary/20 bg-surface/90 p-4 space-y-2 relative overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25 font-semibold">
                {halo.badge}
              </span>
              <span className="text-xs font-mono font-bold text-primary">
                Top {100 - halo.percentile}%
              </span>
            </div>

            <div>
              <div className="text-sm font-bold text-zinc-100">{halo.name}</div>
              <div className="text-base font-extrabold text-primary font-mono mt-0.5">
                {halo.valueText}
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-snug pt-1 border-t border-white/5">
              {halo.impact}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
