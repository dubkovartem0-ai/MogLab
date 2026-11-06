import React, { useState } from 'react';
import { Check, Loader2, Sparkles, Star, Users, X, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { TelegramService } from '../../services/telegram';
import { ApiClient } from '../../services/apiClient';
import { BiometricReport } from '../../types/biometrics';
import { DbUser } from '../../types/database';

interface ProUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: DbUser;
  report: BiometricReport | null;
  onUnlocked: (updatedReport: BiometricReport, newCredits: number) => void;
}

export const ProUnlockModal: React.FC<ProUnlockModalProps> = ({
  isOpen,
  onClose,
  user,
  report,
  onUnlocked
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const qualifiedCount = user.qualified_referrals_count || 0;
  const progressToNext = qualifiedCount % 2; // 0 or 1 out of 2

  // Trigger Gemini Unlock Protocol
  const handleUnlockWithCredits = async () => {
    if (!report) return;
    setIsLoading(true);
    setErrorMsg(null);
    TelegramService.hapticImpact('heavy');

    try {
      const res = await ApiClient.unlockPro(report);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
      TelegramService.hapticNotification('success');

      const updatedReport: BiometricReport = {
        ...report,
        proDetails: {
          failos: res.failos_detailed,
          softmaxxingPlan: res.softmaxxing_plan
        }
      };

      onUnlocked(updatedReport, res.newCredits);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка разблокировки');
      TelegramService.hapticNotification('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Option 1: Viral Telegram Invite
  const handleShareInvite = () => {
    TelegramService.shareReferral(TelegramService.botUsername, user.tg_id);
  };

  // Option 2: 100 Telegram Stars Payment
  const handlePayStars = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { invoiceUrl } = await ApiClient.createInvoice();
      const status = await TelegramService.openInvoice(invoiceUrl);

      if (status === 'paid') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        TelegramService.hapticNotification('success');
        // Small delay to allow the Telegram Webhook to register the payment in Supabase
        await new Promise((resolve) => setTimeout(resolve, 1500));
        // If report is open, unlock it immediately
        if (report) {
          await handleUnlockWithCredits();
        } else {
          onClose();
        }
      } else if (status === 'failed') {
        setErrorMsg('Оплата не была завершена.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка создания счета');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-surface border border-surface-border rounded-t-3xl sm:rounded-2xl p-6 space-y-5 shadow-2xl relative">
        {/* Close Button */}
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
        <div className="text-center space-y-1.5 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-2 shadow-inner">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">
            Разблокировать MogLab PRO
          </h2>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Детальные Failos со штрафами к баллам и персональный ИИ-протокол Softmaxxing
          </p>
        </div>

        {/* Existing Credit Unlock Option (If user has >= 1 credit) */}
        {user.credits > 0 && (
          <div className="p-3.5 rounded-xl border border-primary/40 bg-primary/10 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-primary">Доступен 1 PRO-кредит</div>
              <div className="text-[11px] text-zinc-400">Нажмите, чтобы разблокировать скан</div>
            </div>
            <button
              onClick={handleUnlockWithCredits}
              disabled={isLoading}
              className="py-2 px-3.5 rounded-lg bg-primary hover:bg-primary-hover text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-zinc-950" />
                  <span>Открыть</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Two Unlock Methods */}
        <div className="space-y-3 pt-1">
          {/* Method 1: Viral Referral */}
          <div className="p-4 rounded-2xl border border-surface-border bg-surface-light space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-zinc-200">
                  Пригласить 2 друзей ({progressToNext}/2)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Бесплатно
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(progressToNext / 2) * 100}%` }}
              />
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Счетчик увеличивается, когда приглашенный друг завершает свой первый скан.
            </p>

            <button
              onClick={handleShareInvite}
              className="w-full py-2.5 rounded-xl border border-surface-border bg-surface hover:bg-zinc-800 text-zinc-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Users className="w-3.5 h-3.5 text-primary" />
              <span>Поделиться ссылкой в Telegram</span>
            </button>
          </div>

          {/* Method 2: 100 Telegram Stars */}
          <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-zinc-200">
                  Мгновенный доступ за 100 Stars
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                100 XTR
              </span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Оплата через нативный Telegram Stars без выхода из мессенджера.
            </p>

            <button
              onClick={handlePayStars}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-zinc-950 font-bold text-xs tracking-wide shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Star className="w-4 h-4 fill-zinc-950" />
                  <span>Купить за 100 Stars</span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs text-danger text-center font-mono">{errorMsg}</p>
        )}
      </div>
    </div>
  );
};
