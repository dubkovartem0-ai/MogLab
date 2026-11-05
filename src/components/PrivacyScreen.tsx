import React from 'react';
import { Camera, Image as ImageIcon, Lock, ShieldCheck, Cpu } from 'lucide-react';
import { TelegramService } from '../services/telegram';
import { Disclaimer } from './Disclaimer';

interface PrivacyScreenProps {
  onStartLiveCamera: () => void;
  onSelectGallery: () => void;
}

export const PrivacyScreen: React.FC<PrivacyScreenProps> = ({
  onStartLiveCamera,
  onSelectGallery
}) => {
  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-65px)] max-w-md mx-auto px-5 py-6">
      {/* Top Banner & Title */}
      <div className="w-full text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>Privacy-First Architecture</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Клинический биометрический скан лица
        </h1>

        <p className="text-sm text-zinc-400 leading-relaxed">
          Разделение оценки на генетическую костную базу (<span className="text-primary font-medium">PSL / Harmony</span>) и эстетику ухода (<span className="text-amber-400 font-medium">Appeal</span>).
        </p>

        {/* Local Biometrics Explanation Card */}
        <div className="rounded-2xl border border-surface-border bg-surface p-5 text-left space-y-3 shadow-lg relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center gap-2.5 text-primary font-semibold text-sm">
            <Cpu className="w-4 h-4" />
            <span>100% Локальная обработка (WASM)</span>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            Геометрический анализ 478 точек лица, калибровка баланса белого по склере и колориметрия кожи выполняются исключительно на процессоре вашего устройства через WebAssembly.
          </p>

          <div className="flex items-center gap-2 text-[11px] text-zinc-400 pt-1">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Ваши фотографии никогда не отправляются на сервер и не сохраняются.</span>
          </div>
        </div>

        {/* Feature bullets */}
        <div className="grid grid-cols-2 gap-3 pt-1 text-left">
          <div className="rounded-xl border border-white/5 bg-surface/50 p-3 space-y-1">
            <div className="text-[11px] font-mono text-primary font-semibold">478 LANDMARKS</div>
            <p className="text-[11px] text-zinc-400">Canthal Tilt, FWHR, углы челюсти и симметрия</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-surface/50 p-3 space-y-1">
            <div className="text-[11px] font-mono text-amber-400 font-semibold">PIXEL COLOR</div>
            <p className="text-[11px] text-zinc-400">Текстура кожи, Redness Index и контраст Микельсона</p>
          </div>
        </div>
      </div>

      {/* Action Buttons & Compliance Disclaimer */}
      <div className="w-full space-y-3 pt-6">
        {/* Live Camera Option */}
        <button
          onClick={() => {
            TelegramService.hapticImpact('heavy');
            onStartLiveCamera();
          }}
          className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-zinc-950 font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
        >
          <Camera className="w-4 h-4 text-zinc-950 stroke-[2.5]" />
          <span>Live Camera Capture</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-950/20 text-zinc-950">
            Leaderboard
          </span>
        </button>

        {/* Gallery Upload Option */}
        <button
          onClick={() => {
            TelegramService.hapticImpact('light');
            onSelectGallery();
          }}
          className="w-full py-3 px-4 rounded-xl border border-surface-border bg-surface hover:bg-surface-hover text-zinc-300 font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <ImageIcon className="w-4 h-4 text-zinc-400" />
          <span>Загрузить фото из галереи</span>
        </button>

        {/* Legal disclaimer */}
        <Disclaimer className="mt-2" />
      </div>
    </div>
  );
};
