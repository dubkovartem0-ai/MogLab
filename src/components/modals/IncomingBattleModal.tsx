import React from 'react';
import { Swords, Trophy, Zap, X } from 'lucide-react';
import { TelegramService } from '../../services/telegram';

interface IncomingBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  challengerName: string;
  challengerScore: number;
  onAcceptBattle: () => void;
}

export const IncomingBattleModal: React.FC<IncomingBattleModalProps> = ({
  isOpen,
  onClose,
  challengerName,
  challengerScore,
  onAcceptBattle
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-surface border border-surface-border rounded-t-3xl sm:rounded-2xl p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={() => {
            TelegramService.hapticImpact('light');
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-surface-light border border-white/5 text-zinc-400 hover:text-zinc-100"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="text-center space-y-1 pt-1">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-2 shadow-lg shadow-amber-500/10 animate-bounce">
            <Swords className="w-7 h-7" />
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Входящий вызов
          </span>
          <h2 className="text-xl font-bold text-zinc-100">
            Mog Battle — Дуэль 1 на 1
          </h2>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            <span className="text-zinc-200 font-bold">{challengerName}</span> бросил вам вызов. Сравните биометрию лица и узнайте, кто кого замогал!
          </p>
        </div>

        {/* Challenger Card */}
        <div className="rounded-2xl border border-surface-border bg-surface-light p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-zinc-950 font-extrabold text-base flex items-center justify-center shadow-md">
              {challengerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-mono">Соперник:</div>
              <div className="text-sm font-bold text-zinc-100">{challengerName}</div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-zinc-500 font-mono uppercase">Показатель</div>
            <div className="text-2xl font-black font-mono text-amber-400">
              {challengerScore.toFixed(1)}
              <span className="text-xs text-zinc-500 font-normal"> / 10</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="space-y-2.5">
          <button
            onClick={() => {
              TelegramService.hapticImpact('heavy');
              onAcceptBattle();
            }}
            className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Zap className="w-4 h-4 fill-zinc-950" />
            <span>Принять дуэль и запустить скан</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs text-zinc-500 hover:text-zinc-300 font-mono text-center transition-colors"
          >
            Сначала перейти в главное меню
          </button>
        </div>
      </div>
    </div>
  );
};
