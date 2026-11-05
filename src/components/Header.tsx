import React from 'react';
import { Activity, Award, Sparkles, Swords } from 'lucide-react';
import { GenderMode } from '../types/biometrics';
import { TelegramService } from '../services/telegram';

interface HeaderProps {
  gender: GenderMode;
  onGenderChange: (g: GenderMode) => void;
  credits: number;
  onOpenProModal: () => void;
  onOpenLeaderboard: () => void;
  onOpenBattle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  gender,
  onGenderChange,
  credits,
  onOpenProModal,
  onOpenLeaderboard,
  onOpenBattle
}) => {
  const handleGenderToggle = (newGender: GenderMode) => {
    TelegramService.hapticSelection();
    onGenderChange(newGender);
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-background/80 backdrop-blur-md border-b border-surface-border px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-surface border border-surface-border flex items-center justify-center shadow-inner">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-zinc-100 font-sans">
                MOG<span className="text-primary font-mono">LAB</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                v2.0
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">Clinical Appeal Engine</p>
          </div>
        </div>

        {/* Right Actions: Gender & Credits & Quick links */}
        <div className="flex items-center gap-2">
          {/* Engine Selector */}
          <div className="bg-surface border border-surface-border p-0.5 rounded-lg flex items-center text-xs font-medium">
            <button
              onClick={() => handleGenderToggle('male')}
              className={`px-2 py-1 rounded-md transition-all ${
                gender === 'male'
                  ? 'bg-zinc-800 text-primary font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              PSL ♂
            </button>
            <button
              onClick={() => handleGenderToggle('female')}
              className={`px-2 py-1 rounded-md transition-all ${
                gender === 'female'
                  ? 'bg-zinc-800 text-rose-400 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Harmony ♀
            </button>
          </div>

          {/* Credits / PRO Badge */}
          <button
            onClick={() => {
              TelegramService.hapticImpact('light');
              onOpenProModal();
            }}
            className="flex items-center gap-1 bg-surface border border-amber-500/30 hover:border-amber-500/60 px-2 py-1 rounded-lg text-xs font-mono text-amber-400 shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
            <span>{credits} PRO</span>
          </button>

          {/* Quick icon buttons */}
          <button
            onClick={() => {
              TelegramService.hapticImpact('light');
              onOpenLeaderboard();
            }}
            className="p-1.5 rounded-lg bg-surface border border-surface-border text-zinc-400 hover:text-primary transition-colors"
            title="Leaderboard"
          >
            <Award className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              TelegramService.hapticImpact('light');
              onOpenBattle();
            }}
            className="p-1.5 rounded-lg bg-surface border border-surface-border text-zinc-400 hover:text-amber-400 transition-colors"
            title="Mog Battle"
          >
            <Swords className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
