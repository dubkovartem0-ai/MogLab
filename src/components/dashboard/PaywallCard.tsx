import React from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Droplets,
  Flame,
  Lock,
  Scissors,
  Sparkles,
  Unlock
} from 'lucide-react';
import { BiometricReport } from '../../types/biometrics';
import { TelegramService } from '../../services/telegram';

interface PaywallCardProps {
  report: BiometricReport;
  onOpenUnlockModal: () => void;
}

export const PaywallCard: React.FC<PaywallCardProps> = ({
  report,
  onOpenUnlockModal
}) => {
  const isUnlocked = Boolean(report.proDetails);

  return (
    <div className="space-y-3">
      {/* Trigger Banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between text-amber-300 shadow-sm">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold">
            Найдено {report.failosCount} дебаффа, снижающих ваш Appeal на {report.totalDebuffPenalty.toFixed(1)} балла
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="relative rounded-2xl border border-surface-border bg-surface p-5 shadow-lg overflow-hidden">
        {/* If Locked: DOM-SAFE PAYWALL with static masked strings and backdrop blur */}
        {!isUnlocked ? (
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-bold">
                  Failos & Softmaxxing Plan
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PRO ONLY
              </span>
            </div>

            {/* DOM-SAFE DUMMY CONTENT: Real texts are NOT rendered here */}
            <div className="relative pt-4 space-y-4 filter blur-[6px] select-none pointer-events-none opacity-40">
              {/* Dummy Item 1 */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-white/5 space-y-1">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-zinc-400">████████ ███████████</span>
                  <span className="text-danger">-0.7 балла</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  ██████████████ ████████████ █████████ ██████████████████████ ███████
                </p>
              </div>

              {/* Dummy Item 2 */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-white/5 space-y-1">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-zinc-400">██████████ █████████</span>
                  <span className="text-danger">-0.6 балла</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  ████████████████ █████████████ ███████████████████████████████
                </p>
              </div>

              {/* Dummy Plan */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-white/5 space-y-2">
                <div className="text-xs font-mono text-primary">████████████████ PROTOCOL</div>
                <p className="text-[11px] text-zinc-600">
                  ████████████████████████████████████████████████████████████
                </p>
              </div>
            </div>

            {/* Paywall Overlay with CTA */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-black/60 backdrop-blur-[10px]">
              <div className="w-12 h-12 rounded-2xl bg-surface border border-primary/40 flex items-center justify-center text-primary mb-3 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <Lock className="w-6 h-6 stroke-[2.2]" />
              </div>

              <h4 className="text-sm font-bold text-zinc-100 mb-1">
                Разблокируйте детальные Failos и протокол
              </h4>
              <p className="text-xs text-zinc-400 max-w-xs mb-4">
                Точные штрафы к баллам, рекомендации по прическе, уходу и устранению отечности лица
              </p>

              <button
                onClick={() => {
                  TelegramService.hapticImpact('heavy');
                  onOpenUnlockModal();
                }}
                className="w-full max-w-xs py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-zinc-950 font-bold text-xs font-mono uppercase tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Unlock className="w-4 h-4 fill-zinc-950 text-zinc-950" />
                <span>Открыть за 2 друзей или 100 Stars</span>
              </button>
            </div>
          </div>
        ) : (
          /* UNLOCKED PRO VIEW: Render real failos and AI softmaxxing plan */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300 font-bold">
                  Детальные Failos & Softmaxxing Protocol
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                PRO UNLOCKED
              </span>
            </div>

            {/* 1. Failos with exact penalties */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-danger" />
                <span>Обнаруженные дебаффы (Failos)</span>
              </h4>

              <div className="space-y-2.5">
                {report.proDetails?.failos.map(failo => (
                  <div
                    key={failo.id}
                    className="p-3.5 rounded-xl bg-surface-light border border-white/5 space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-zinc-100">{failo.title}</span>
                      <span className="font-mono font-bold text-danger bg-danger/10 px-2 py-0.5 rounded border border-danger/20">
                        {failo.penalty.toFixed(1)} балла
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {failo.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Softmaxxing Plan */}
            <div className="space-y-4 pt-2 border-t border-surface-border">
              <h4 className="text-xs font-mono uppercase text-primary font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Персональный ИИ-протокол Softmaxxing</span>
              </h4>

              {/* Hairstyle */}
              <div className="rounded-xl border border-surface-border bg-surface-light p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                  <Scissors className="w-4 h-4 text-primary" />
                  <span>Прическа: {report.proDetails?.softmaxxingPlan.hairstyle.recommended_style}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {report.proDetails?.softmaxxingPlan.hairstyle.reasoning}
                </p>
                <div className="pt-1 flex flex-wrap gap-1.5">
                  {report.proDetails?.softmaxxingPlan.hairstyle.products.map((prod, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-white/5"
                    >
                      {prod}
                    </span>
                  ))}
                </div>
              </div>

              {/* Grooming & Contrast */}
              <div className="rounded-xl border border-surface-border bg-surface-light p-3.5 space-y-2">
                <div className="text-xs font-semibold text-zinc-200">
                  Груминг и усиление контрастности:
                </div>
                <ul className="space-y-1.5">
                  {report.proDetails?.softmaxxingPlan.grooming_and_contrast.actions.map((act, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Skin & Debloating */}
              <div className="rounded-xl border border-surface-border bg-surface-light p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  <span>Устранение задержки жидкости (Debloating) & Кожа:</span>
                </div>
                <ul className="space-y-1.5">
                  {report.proDetails?.softmaxxingPlan.skin_and_debloating.actions.map((act, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
