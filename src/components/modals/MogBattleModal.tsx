import React, { useState } from 'react';
import { Copy, Share2, Swords, Trophy, X, Zap } from 'lucide-react';
import { TelegramService } from '../../services/telegram';
import { BiometricReport } from '../../types/biometrics';
import { DbUser } from '../../types/database';

interface MogBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: DbUser;
  report: BiometricReport | null;
}

export const MogBattleModal: React.FC<MogBattleModalProps> = ({
  isOpen,
  onClose,
  user,
  report
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentScore = report?.currentScore || 6.2;
  const battleId = report?.id || 'scan_' + user.tg_id;
  const battleUrl = `https://t.me/MogLabBot/app?startapp=battle_${battleId}`;

  const handleShare = () => {
    TelegramService.shareBattle('MogLabBot', battleId, currentScore);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(battleUrl);
    setCopied(true);
    TelegramService.hapticImpact('light');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
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

        {/* Modal Header */}
        <div className="text-center space-y-1 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-2 shadow-inner">
            <Swords className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">
            Mog Battle — Дуэль 1 на 1
          </h2>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Бросьте вызов другу. Сравнительная карточка по 6 параметрам покажет, кто кого замогал.
          </p>
        </div>

        {/* 1v1 Battle Card Preview */}
        <div className="rounded-2xl border border-surface-border bg-surface-light p-4 space-y-4">
          <div className="flex items-center justify-between">
            {/* Challenger (You) */}
            <div className="text-center flex-1">
              <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-sm mx-auto mb-1">
                {(user.first_name || 'Вы')[0].toUpperCase()}
              </div>
              <div className="text-xs font-semibold text-zinc-200 truncate">
                {user.first_name || 'Вы'}
              </div>
              <div className="text-base font-extrabold text-primary font-mono mt-0.5">
                {currentScore.toFixed(1)}
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Ваш Score</span>
            </div>

            {/* VS Badge */}
            <div className="px-3">
              <span className="text-xs font-mono font-black text-amber-400 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
                VS
              </span>
            </div>

            {/* Opponent */}
            <div className="text-center flex-1">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-dashed border-zinc-600 flex items-center justify-center text-zinc-500 font-bold text-sm mx-auto mb-1">
                ?
              </div>
              <div className="text-xs font-semibold text-zinc-400 truncate">
                Соперник
              </div>
              <div className="text-base font-extrabold text-zinc-500 font-mono mt-0.5">
                ?.?
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Ожидание скана</span>
            </div>
          </div>

          {/* 6 axes comparison tease */}
          <div className="space-y-1.5 pt-2 border-t border-white/5 text-[11px] font-mono text-zinc-400">
            <div className="flex justify-between">
              <span>Eye Area & Canthal Tilt</span>
              <span className="text-primary font-bold">Оценивается</span>
            </div>
            <div className="flex justify-between">
              <span>Jawline & FWHR</span>
              <span className="text-primary font-bold">Оценивается</span>
            </div>
            <div className="flex justify-between">
              <span>Facial Contrast</span>
              <span className="text-primary font-bold">Оценивается</span>
            </div>
          </div>
        </div>

        {/* Share buttons */}
        <div className="space-y-2.5">
          <button
            onClick={handleShare}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-bold text-sm tracking-wide shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Share2 className="w-4 h-4 fill-zinc-950 text-zinc-950" />
            <span>Отправить вызов другу в Telegram</span>
          </button>

          <button
            onClick={handleCopy}
            className="w-full py-2.5 px-4 rounded-xl border border-surface-border bg-surface hover:bg-zinc-800 text-zinc-300 font-medium text-xs font-mono transition-all flex items-center justify-center gap-2"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
            <span>{copied ? 'Ссылка скопирована!' : 'Скопировать ссылку на дуэль'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
