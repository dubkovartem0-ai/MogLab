import React from 'react';
import { Award, RotateCcw, Share2, Swords } from 'lucide-react';
import { BiometricReport } from '../types/biometrics';
import { TelegramService } from '../services/telegram';
import { Disclaimer } from './Disclaimer';
import { HalosCard } from './dashboard/HalosCard';
import { PaywallCard } from './dashboard/PaywallCard';
import { RadarChart } from './dashboard/RadarChart';
import { ScoreHeader } from './dashboard/ScoreHeader';

interface ResultsDashboardProps {
  report: BiometricReport;
  onOpenUnlockModal: () => void;
  onOpenBattleModal: () => void;
  onOpenLeaderboardModal: () => void;
  onRetakeScan: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  report,
  onOpenUnlockModal,
  onOpenBattleModal,
  onOpenLeaderboardModal,
  onRetakeScan
}) => {
  return (
    <div className="max-w-md mx-auto px-4 py-5 space-y-5 pb-12">
      {/* 1. Score Header: MTN 5.4 / 10 -> HTN 7.1 / 10, Bone & Appeal bars */}
      <ScoreHeader report={report} />

      {/* 2. Top Halos: Positive Canthal Tilt, High Facial Contrast, etc. */}
      <HalosCard halos={report.halos} />

      {/* 3. 6-Axis Hexagon Biometric Radar Chart */}
      <RadarChart data={report.radarData} />

      {/* 4. DOM-Safe Paywall: Masked Failos & Softmaxxing Protocol */}
      <PaywallCard report={report} onOpenUnlockModal={onOpenUnlockModal} />

      {/* 5. Viral Action Buttons */}
      <div className="space-y-2.5 pt-2">
        {/* Mog Battle Challenge Button */}
        <button
          onClick={() => {
            TelegramService.hapticImpact('heavy');
            onOpenBattleModal();
          }}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Swords className="w-4 h-4 fill-zinc-950 text-zinc-950" />
          <span>Вызвать на Mog Battle (1 на 1)</span>
        </button>

        {/* Leaderboard Button (Only active if verified_camera === true) */}
        <button
          onClick={() => {
            TelegramService.hapticImpact('medium');
            onOpenLeaderboardModal();
          }}
          disabled={!report.verifiedCamera}
          className={`w-full py-3 px-4 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            report.verifiedCamera
              ? 'border-primary/40 bg-surface hover:bg-surface-hover text-primary shadow-sm active:scale-[0.98]'
              : 'border-zinc-800 bg-surface/40 text-zinc-600 cursor-not-allowed'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>
            {report.verifiedCamera
              ? 'Войти в глобальный Leaderboard'
              : 'Leaderboard доступен только для Live Camera'}
          </span>
        </button>

        {/* Retake Scan Button */}
        <button
          onClick={() => {
            TelegramService.hapticImpact('light');
            onRetakeScan();
          }}
          className="w-full py-3 px-4 rounded-xl border border-surface-border bg-surface hover:bg-surface-hover text-zinc-400 hover:text-zinc-200 text-xs font-mono transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Повторить биометрический скан</span>
        </button>
      </div>

      {/* Compliance Disclaimer */}
      <Disclaimer className="mt-4" />
    </div>
  );
};
