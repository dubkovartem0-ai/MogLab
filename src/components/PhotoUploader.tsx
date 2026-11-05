import React, { useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, Image as ImageIcon, RefreshCw, Upload, ShieldAlert } from 'lucide-react';
import { BiometricsService } from '../services/biometrics';
import { GatekeeperService } from '../services/gatekeeper';
import { PixelAnalyzerService } from '../services/pixelAnalyzer';
import { ScoringService } from '../services/scoring';
import { TelegramService } from '../services/telegram';
import { BiometricReport, GenderMode, LandmarkPoint } from '../types/biometrics';

interface PhotoUploaderProps {
  gender: GenderMode;
  onScanComplete: (report: BiometricReport) => void;
  onBack: () => void;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  gender,
  onScanComplete,
  onBack
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    TelegramService.hapticImpact('medium');
    setErrorMsg(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setSelectedImage(dataUrl);
      await processImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (dataUrl: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;

    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Could not get canvas 2d context');

        ctx.drawImage(img, 0, 0);

        const landmarker = await BiometricsService.getLandmarker();
        const results = landmarker.detect(canvas);

        if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
          setErrorMsg('Лицо не найдено на фотографии. Загрузите четкое фронтальное селфи.');
          setIsProcessing(false);
          return;
        }

        const landmarks = results.faceLandmarks[0] as LandmarkPoint[];
        const matrix = results.facialTransformationMatrixes?.[0]?.data;

        // Gatekeeper check
        const gk = GatekeeperService.validateFrame(canvas, landmarks, matrix);
        if (!gk.isPoseOk) {
          setErrorMsg(`Отклонение позы: ${gk.errorMessage || 'Держите голову ровно'}`);
        }

        // Calculate Biometrics & Colorimetry
        const biometrics = BiometricsService.calculateMetrics(landmarks, gender);
        const colorimetry = PixelAnalyzerService.analyzeCanvas(canvas, landmarks);

        // verifiedCamera is FALSE for gallery uploads
        const report = ScoringService.generateReport(gender, biometrics, colorimetry, false);

        TelegramService.hapticNotification('success');
        setIsProcessing(false);
        onScanComplete(report);
      } catch (err: any) {
        console.error('Photo analysis failed:', err);
        setErrorMsg('Ошибка биометрического анализа. Попробуйте другое фото.');
        setIsProcessing(false);
      }
    };
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-65px)] max-w-md mx-auto px-5 py-6">
      {/* Header */}
      <div className="w-full">
        <button
          onClick={() => {
            TelegramService.hapticImpact('light');
            onBack();
          }}
          className="flex items-center gap-1 text-xs font-mono text-zinc-300 bg-surface px-3 py-1.5 rounded-full border border-surface-border mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Назад</span>
        </button>

        <h1 className="text-xl font-bold tracking-tight text-zinc-100 mb-1">
          Загрузка фото из галереи
        </h1>
        <p className="text-xs text-zinc-400">
          Локальный анализ изображения без отправки на сервер
        </p>

        {/* Gallery limitation notice from TZ */}
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2.5 text-xs text-amber-300">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Фото из галереи помечаются статусом <span className="font-semibold text-amber-200">«Gallery Photo»</span>. Публикация в глобальный Leaderboard отключена для защиты рейтинга.
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="w-full my-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-64 rounded-2xl border-2 border-dashed border-surface-border hover:border-primary/50 bg-surface/40 hover:bg-surface/80 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all active:scale-[0.99] relative overflow-hidden"
        >
          {selectedImage ? (
            <img
              src={selectedImage}
              alt="Selected selfie"
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-surface border border-surface-border flex items-center justify-center mb-4 text-primary shadow-inner">
              <Upload className="w-6 h-6 stroke-[2]" />
            </div>
          )}

          <div className="relative z-10 space-y-1">
            <p className="text-sm font-semibold text-zinc-100">
              {isProcessing ? 'Анализ биометрии...' : 'Нажмите для выбора фото'}
            </p>
            <p className="text-xs text-zinc-400">
              Четкое фронтальное фото лица при хорошем освещении
            </p>
          </div>

          {isProcessing && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center space-y-2 z-20">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs font-mono text-zinc-300">
                MediaPipe WebAssembly & Pixel Analyzer...
              </p>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-xl bg-danger/10 border border-danger/30 p-3 text-xs text-danger flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Button */}
      <div className="w-full">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-zinc-950 font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <ImageIcon className="w-4 h-4 text-zinc-950" />
          <span>Выбрать фото</span>
        </button>
      </div>
    </div>
  );
};
