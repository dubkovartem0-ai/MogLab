import React, { useEffect, useState } from 'react';
import { Award, Camera, Check, RefreshCw, Trophy, X } from 'lucide-react';
import { ApiClient } from '../../services/apiClient';
import { TelegramService } from '../../services/telegram';
import { DbLeaderboardEntry, DbUser } from '../../types/database';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: DbUser;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  const [entries, setEntries] = useState<DbLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
    }
  }, [isOpen]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const data = await ApiClient.getLeaderboard();
      setEntries(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md max-h-[85vh] bg-surface border border-surface-border rounded-t-3xl sm:rounded-2xl p-6 flex flex-col shadow-2xl relative">
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
        <div className="text-center space-y-1 pb-4 border-b border-surface-border">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mx-auto mb-2 shadow-inner">
            <Trophy className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">
            Глобальный Leaderboard
          </h2>
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <Camera className="w-3.5 h-3.5 text-primary" />
            <span>Только верифицированные Live Camera сканы</span>
          </div>
        </div>

        {/* List of Rankings */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 my-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2 text-zinc-500 font-mono text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span>Загрузка топа...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 font-mono text-xs">
              Список лидеров пуст
            </div>
          ) : (
            entries.map((entry, idx) => {
              const isTop1 = idx === 0;
              const isTop2 = idx === 1;
              const isTop3 = idx === 2;
              const isSelf = entry.tg_id === user.tg_id;

              return (
                <div
                  key={entry.id || idx}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    isSelf
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-surface-light border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Badge */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                        isTop1
                          ? 'bg-amber-400 text-zinc-950 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                          : isTop2
                          ? 'bg-zinc-300 text-zinc-950'
                          : isTop3
                          ? 'bg-amber-700 text-amber-100'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {/* Name & Gender */}
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                        <span className="truncate max-w-[130px]">@{entry.username}</span>
                        {isSelf && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-primary/20 text-primary">
                            Вы
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        {entry.gender === 'male' ? 'PSL ♂' : 'Harmony ♀'} · Pot: {entry.potential_score.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className="text-sm font-extrabold font-mono text-primary">
                      {entry.score.toFixed(1)}
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500">/ 10.0</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="pt-2 border-t border-surface-border text-center">
          <p className="text-[10px] text-zinc-500 font-mono">
            Защита от фрода: Загрузка фото моделей из галереи не допускается в рейтинг.
          </p>
        </div>
      </div>
    </div>
  );
};
