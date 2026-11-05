import React from 'react';
import { Camera, Image as ImageIcon, Sparkles, TrendingUp } from 'lucide-react';
import { BiometricReport } from '../../types/biometrics';

interface ScoreHeaderProps {
  report: BiometricReport;
}

export const ScoreHeader: React.FC<ScoreHeaderProps> = ({ report }) => {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-xl relative overflow-hidden space-y-5">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Verified Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
          <span>TIER:</span>
          <span className="font-bold text-zinc-200">{report.currentTier}</span>
        </div>

        {report.verifiedCamera ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-mono">
            <Camera className="w-3.5 h-3.5" />
            <span>Verified Camera</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-mono">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Gallery Photo</span>
          </div>
        )}
      </div>

      {/* Primary Score Numbers */}
      <div className="flex items-baseline justify-between pt-1">
        <div>
          <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
            Текущий показатель
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-4xl font-extrabold tracking-tight text-zinc-100 font-mono">
              {report.currentScore.toFixed(1)}
            </span>
            <span className="text-lg text-zinc-500 font-mono">/ 10</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-mono text-primary flex items-center justify-end gap-1 uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Потенциал</span>
          </div>
          <div className="flex items-baseline justify-end gap-1 mt-0.5">
            <span className="text-3xl font-extrabold tracking-tight text-primary font-mono">
              {report.potentialScore.toFixed(1)}
            </span>
            <span className="text-base text-zinc-500 font-mono">/ 10</span>
          </div>
        </div>
      </div>

      {/* Dual Progress Bars: Bone Base vs Appeal */}
      <div className="space-y-3 pt-2 border-t border-surface-border/50">
        {/* Bone Base Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <span>Bone Base</span>
              <span className="text-[10px] text-zinc-500">(Генетическая база)</span>
            </span>
            <span className="text-zinc-200 font-bold">{report.boneBaseScore.toFixed(1)} / 10</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-900 border border-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-zinc-300 transition-all duration-1000 ease-out"
              style={{ width: `${(report.boneBaseScore / 10) * 100}%` }}
            />
          </div>
        </div>

        {/* Appeal Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <span className="text-primary font-medium">Appeal</span>
              <span className="text-[10px] text-zinc-500">(Кожа, контраст, уход)</span>
            </span>
            <span className="text-primary font-bold">{report.appealScore.toFixed(1)} / 10</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-900 border border-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out"
              style={{ width: `${(report.appealScore / 10) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
