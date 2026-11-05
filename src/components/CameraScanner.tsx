import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, RefreshCw, Scan, Zap } from 'lucide-react';
import { BiometricsService } from '../services/biometrics';
import { GatekeeperService } from '../services/gatekeeper';
import { PixelAnalyzerService } from '../services/pixelAnalyzer';
import { ScoringService } from '../services/scoring';
import { TelegramService } from '../services/telegram';
import { BiometricReport, GatekeeperStatus, GenderMode, LandmarkPoint } from '../types/biometrics';

interface CameraScannerProps {
  gender: GenderMode;
  onScanComplete: (report: BiometricReport) => void;
  onBack: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  gender,
  onScanComplete,
  onBack
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('');
  const [livenessMovementDetected, setLivenessMovementDetected] = useState(false);

  // Real-time Gatekeeper HUD status
  const [gatekeeper, setGatekeeper] = useState<GatekeeperStatus>({
    luminance: 120,
    bilateralDiff: 0.1,
    distanceRatio: 0.38,
    eulerAngles: { pitch: 0, yaw: 0, roll: 0 },
    isLuminanceOk: true,
    isLightingOk: true,
    isDistanceOk: true,
    isPoseOk: true,
    canScan: false
  });

  const lastLandmarksRef = useRef<LandmarkPoint[] | null>(null);
  const previousPoseRef = useRef<LandmarkPoint[] | null>(null);

  // 1. Initialize Camera & MediaPipe
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    async function initStream() {
      setIsLoadingModel(true);
      setModelError(null);

      // Step 1: Request camera permission and stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 720 },
            height: { ideal: 960 }
          },
          audio: false
        });
      } catch (camErr: any) {
        console.error('Camera access error:', camErr);
        setIsLoadingModel(false);
        setModelError('Нет доступа к камере. Разрешите доступ в настройках Telegram/браузера');
        return;
      }

      if (isCancelled) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Step 2: Attach stream to video element with mobile attributes
      if (videoRef.current) {
        const video = videoRef.current;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('x5-playsinline', 'true');
        video.muted = true;
        video.defaultMuted = true;
        video.autoplay = true;
        video.srcObject = stream;

        try {
          await video.play();
        } catch (playErr) {
          console.warn('Video play interrupted or delayed:', playErr);
        }

        // Step 3: Wait until video is ready (readyState >= 2)
        if (video.readyState < 2) {
          await new Promise<void>((resolve) => {
            const onReady = () => {
              if (video.readyState >= 2 && video.videoWidth > 0) {
                video.removeEventListener('loadeddata', onReady);
                video.removeEventListener('canplay', onReady);
                resolve();
              }
            };
            video.addEventListener('loadeddata', onReady);
            video.addEventListener('canplay', onReady);
            setTimeout(resolve, 2000);
          });
        }
      }

      if (isCancelled) {
        stream?.getTracks().forEach(t => t.stop());
        return;
      }

      // Step 4: Load & pre-warm FaceLandmarker in dedicated try/catch
      try {
        await BiometricsService.getLandmarker('VIDEO');
      } catch (wasmErr: any) {
        console.error('FaceLandmarker WASM loading error:', wasmErr);
        setIsLoadingModel(false);
        setModelError('Не удалось загрузить модуль биометрии. Проверьте соединение с интернетом.');
        return;
      }

      if (isCancelled) return;

      // Step 5: Both camera and model are ready — start analysis loop
      setIsLoadingModel(false);
      startFrameLoop();
    }

    initStream();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // 2. Real-time Analysis Loop (60 FPS Gatekeeper & Landmark Overlay)
  const startFrameLoop = () => {
    const loop = async () => {
      if (!videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Strict check: video must be ready (readyState >= 2) and have valid frame dimensions
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // Sync canvas dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const landmarker = await BiometricsService.getLandmarker('VIDEO');
        const results = landmarker.detectForVideo(video, performance.now());

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0] as LandmarkPoint[];
          lastLandmarksRef.current = landmarks;

          // Check micro-movements for liveness
          if (previousPoseRef.current) {
            const noseCurr = landmarks[1];
            const nosePrev = previousPoseRef.current[1];
            if (noseCurr && nosePrev) {
              const delta = Math.hypot(noseCurr.x - nosePrev.x, noseCurr.y - nosePrev.y);
              if (delta > 0.001) setLivenessMovementDetected(true);
            }
          }
          previousPoseRef.current = landmarks;

          const matrix = results.facialTransformationMatrixes?.[0]?.data;

          // Validate against 4 Gatekeeper criteria
          const gkStatus = GatekeeperService.validateFrame(canvas, landmarks, matrix);
          setGatekeeper(gkStatus);

          // Draw neon mint geodesic mesh (#10B981)
          drawGeodesicMesh(ctx, landmarks, gkStatus.canScan);
        } else {
          setGatekeeper(prev => ({
            ...prev,
            canScan: false,
            errorMessage: 'Поместите лицо в центр овала'
          }));
        }
      } catch (e) {
        // detection cycle skipped
      }

      if (!isScanning) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  // 3. Draw Neon Mint Geodesic Mesh on 478 Points
  const drawGeodesicMesh = (
    ctx: CanvasRenderingContext2D,
    landmarks: LandmarkPoint[],
    isValid: boolean
  ) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    const strokeColor = isValid ? '#10B981' : 'rgba(239, 68, 68, 0.7)';
    const pointColor = isValid ? '#34D399' : 'rgba(239, 68, 68, 0.8)';

    ctx.save();

    // 1. Face contour & jawline lines
    const jawIndices = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454];
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < jawIndices.length; i++) {
      const p = landmarks[jawIndices[i]];
      if (p) {
        if (i === 0) ctx.moveTo(p.x * width, p.y * height);
        else ctx.lineTo(p.x * width, p.y * height);
      }
    }
    ctx.stroke();

    // 2. Eyes & Orbital triangulation
    const leftEye = [33, 160, 158, 133, 153, 144, 33];
    const rightEye = [263, 387, 385, 362, 380, 373, 263];
    [leftEye, rightEye].forEach(eye => {
      ctx.beginPath();
      eye.forEach((idx, i) => {
        const p = landmarks[idx];
        if (p) {
          if (i === 0) ctx.moveTo(p.x * width, p.y * height);
          else ctx.lineTo(p.x * width, p.y * height);
        }
      });
      ctx.stroke();
    });

    // 3. Nose bridge & Lips contour
    const nose = [168, 6, 197, 195, 5, 4, 1, 2];
    ctx.beginPath();
    nose.forEach((idx, i) => {
      const p = landmarks[idx];
      if (p) {
        if (i === 0) ctx.moveTo(p.x * width, p.y * height);
        else ctx.lineTo(p.x * width, p.y * height);
      }
    });
    ctx.stroke();

    // 4. Sample key points with neon glow dots
    const samplePoints = [33, 133, 263, 362, 1, 2, 10, 152, 234, 454, 172, 397, 61, 291];
    ctx.fillStyle = pointColor;
    samplePoints.forEach(idx => {
      const p = landmarks[idx];
      if (p) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  };

  // 4. Trigger 3-Second Scanning Sequence (Wow-Effect)
  const handleStartScan = async () => {
    if (!gatekeeper.canScan || !lastLandmarksRef.current || !canvasRef.current) return;

    TelegramService.hapticImpact('heavy');
    setIsScanning(true);

    const landmarks = lastLandmarksRef.current;
    const canvas = canvasRef.current;

    // Step 1: 0.0s – 1.0s
    setScanStep(1);
    setScanStatusText('Calibrating focal distance & 3D rotation matrix...');
    TelegramService.hapticImpact('medium');

    await new Promise(r => setTimeout(r, 1000));

    // Step 2: 1.0s – 2.0s
    setScanStep(2);
    setScanStatusText('Measuring Canthal Tilt, FWHR & Gonial angles...');
    TelegramService.hapticImpact('medium');

    await new Promise(r => setTimeout(r, 1000));

    // Step 3: 2.0s – 3.0s
    setScanStep(3);
    setScanStatusText('Analyzing skin luminance variance & facial contrast...');
    TelegramService.hapticImpact('heavy');

    await new Promise(r => setTimeout(r, 1000));

    // Execute Client-Side Mathematical Biometrics & Pixel Analyzer
    const biometrics = BiometricsService.calculateMetrics(landmarks, gender);
    const colorimetry = PixelAnalyzerService.analyzeCanvas(canvas, landmarks);
    const report = ScoringService.generateReport(gender, biometrics, colorimetry, true);

    TelegramService.hapticNotification('success');
    onScanComplete(report);
  };

  return (
    <div className="relative w-full h-[calc(100vh-65px)] bg-black overflow-hidden flex flex-col justify-between">
      {/* Live camera video stream for mobile browsers (iOS WebKit & Android) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        // @ts-ignore
        webkit-playsinline="true"
        x5-playsinline="true"
        className="absolute inset-0 w-full h-full object-cover -scale-x-100"
      />

      {/* Main Canvas rendering video frame + neon mesh overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none"
      />

      {/* Dark vignette overlay with face targeting oval */}
      <div className="absolute inset-0 pointer-events-none border-[12px] border-black/40 flex items-center justify-center">
        <div
          className={`w-[70vw] max-w-[280px] h-[52vh] max-h-[380px] rounded-[100px] border-2 transition-all duration-300 ${
            gatekeeper.canScan
              ? 'border-primary shadow-[0_0_25px_rgba(16,185,129,0.35)]'
              : 'border-white/20'
          }`}
        />
      </div>

      {/* Top Bar: Back button & Gatekeeper Status Error Banner */}
      <div className="relative z-10 w-full p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              TelegramService.hapticImpact('light');
              onBack();
            }}
            className="flex items-center gap-1 text-xs font-mono text-zinc-300 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>

          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span className="text-zinc-200">
              {gender === 'male' ? 'PSL 478 Engine' : 'Harmony 478 Engine'}
            </span>
          </div>
        </div>

        {/* Instructive Error / Guidance Banner */}
        {gatekeeper.errorMessage && !isScanning && (
          <div className="mx-auto w-full max-w-sm rounded-xl bg-black/85 backdrop-blur-md border border-amber-500/30 p-2.5 text-center text-xs text-amber-300 shadow-xl flex items-center justify-center gap-2 animate-pulse">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{gatekeeper.errorMessage}</span>
          </div>
        )}

        {gatekeeper.canScan && !isScanning && (
          <div className="mx-auto w-full max-w-sm rounded-xl bg-black/85 backdrop-blur-md border border-primary/40 p-2 text-center text-xs text-primary shadow-xl flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>Калибровка пройдена. Нажмите «НАЧАТЬ СКАН»</span>
          </div>
        )}
      </div>

      {/* Middle: 3-Second Scanning Animation & Telemetry Overlay */}
      {isScanning && (
        <div className="relative z-20 inset-0 flex-1 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm px-6">
          <div className="w-20 h-20 rounded-full border-2 border-primary/30 border-t-primary animate-spin flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)]">
            <Scan className="w-8 h-8 text-primary animate-pulse" />
          </div>

          <div className="mt-6 text-center space-y-2">
            <div className="text-xs font-mono text-primary font-bold uppercase tracking-wider">
              Биометрическое сканирование ({scanStep}/3)
            </div>
            <div className="text-sm font-mono text-zinc-100 max-w-xs transition-all h-10 flex items-center justify-center">
              {scanStatusText}
            </div>

            {/* Micro-telemetry values */}
            <div className="pt-2 flex items-center justify-center gap-4 text-[10px] font-mono text-zinc-400">
              <span>ROLL: {gatekeeper.eulerAngles.roll}°</span>
              <span>YAW: {gatekeeper.eulerAngles.yaw}°</span>
              <span>LUM: {gatekeeper.luminance}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom HUD: Gatekeeper Indicators & Scan CTA */}
      <div className="relative z-10 w-full max-w-md mx-auto p-4 space-y-3">
        {/* Real-time 4-Gatekeeper telemetry grid */}
        {!isScanning && (
          <div className="grid grid-cols-4 gap-2 bg-black/70 backdrop-blur-md p-2.5 rounded-xl border border-white/10 font-mono text-[10px]">
            {/* 1. Luminance */}
            <div className="flex flex-col items-center text-center">
              <span className="text-zinc-500">ЯРКОСТЬ</span>
              <span
                className={`font-semibold mt-0.5 ${
                  gatekeeper.isLuminanceOk ? 'text-primary' : 'text-danger'
                }`}
              >
                {gatekeeper.luminance}
              </span>
            </div>

            {/* 2. Bilateral Lighting */}
            <div className="flex flex-col items-center text-center">
              <span className="text-zinc-500">СВЕТ БОК</span>
              <span
                className={`font-semibold mt-0.5 ${
                  gatekeeper.isLightingOk ? 'text-primary' : 'text-danger'
                }`}
              >
                {Math.round(gatekeeper.bilateralDiff * 100)}%
              </span>
            </div>

            {/* 3. Distance */}
            <div className="flex flex-col items-center text-center">
              <span className="text-zinc-500">ДИСТАНЦИЯ</span>
              <span
                className={`font-semibold mt-0.5 ${
                  gatekeeper.isDistanceOk ? 'text-primary' : 'text-danger'
                }`}
              >
                {Math.round(gatekeeper.distanceRatio * 100)}%
              </span>
            </div>

            {/* 4. 3D Pose */}
            <div className="flex flex-col items-center text-center">
              <span className="text-zinc-500">3D НАКЛОН</span>
              <span
                className={`font-semibold mt-0.5 ${
                  gatekeeper.isPoseOk ? 'text-primary' : 'text-danger'
                }`}
              >
                {Math.max(
                  Math.abs(gatekeeper.eulerAngles.pitch),
                  Math.abs(gatekeeper.eulerAngles.yaw),
                  Math.abs(gatekeeper.eulerAngles.roll)
                ).toFixed(1)}°
              </span>
            </div>
          </div>
        )}

        {/* Scan Button */}
        {!isScanning && (
          <button
            onClick={handleStartScan}
            disabled={!gatekeeper.canScan}
            className={`w-full py-4 rounded-xl font-mono text-sm uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
              gatekeeper.canScan
                ? 'bg-primary hover:bg-primary-hover text-zinc-950 shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-[0.98]'
                : 'bg-zinc-800/80 text-zinc-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            <Zap className={`w-4 h-4 ${gatekeeper.canScan ? 'fill-zinc-950 text-zinc-950' : 'text-zinc-600'}`} />
            <span>Начать биометрический скан</span>
          </button>
        )}

        {/* Model Loading State */}
        {isLoadingModel && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center space-y-3 z-30">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs font-mono text-zinc-300">
              Загрузка WebAssembly FaceLandmarker...
            </p>
          </div>
        )}

        {/* Model Error Modal */}
        {modelError && (
          <div className="absolute inset-0 bg-black/95 p-6 flex flex-col items-center justify-center text-center z-30 space-y-4">
            <AlertCircle className="w-10 h-10 text-danger" />
            <p className="text-sm text-zinc-300 max-w-xs">{modelError}</p>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-surface border border-surface-border rounded-xl text-xs font-mono text-zinc-200"
            >
              Вернуться назад
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
