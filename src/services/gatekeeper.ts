import { EulerAngles, GatekeeperStatus, LandmarkPoint } from '../types/biometrics';

export class GatekeeperService {
  /**
   * Decompose Euler angles (Pitch, Yaw, Roll in degrees) from 4x4 transformation matrix or landmarks
   */
  public static extractEulerAngles(
    landmarks: LandmarkPoint[],
    matrix?: Float32Array | number[]
  ): EulerAngles {
    if (matrix && matrix.length === 16) {
      // 4x4 column-major matrix from MediaPipe facialTransformationMatrixes
      // R00=0, R10=1, R20=2, R01=4, R11=5, R21=6, R02=8, R12=9, R22=10
      const r00 = matrix[0];
      const r10 = matrix[1];
      const r20 = matrix[2];
      const r01 = matrix[4];
      const r11 = matrix[5];
      const r21 = matrix[6];
      const r02 = matrix[8];
      const r12 = matrix[9];
      const r22 = matrix[10];

      // Standard XYZ / YXZ decomposition
      const pitch = Math.asin(Math.max(-1, Math.min(1, -r12))) * (180 / Math.PI);
      const yaw = Math.atan2(r02, r22) * (180 / Math.PI);
      const roll = Math.atan2(r10, r11) * (180 / Math.PI);

      return {
        pitch: Math.round(pitch * 10) / 10,
        yaw: Math.round(yaw * 10) / 10,
        roll: Math.round(roll * 10) / 10
      };
    }

    // High-precision landmark-based fallback estimation:
    // Outer eye canthi: 33 (left outer), 263 (right outer)
    const p33 = landmarks[33] || { x: 0.3, y: 0.4, z: 0 };
    const p263 = landmarks[263] || { x: 0.7, y: 0.4, z: 0 };
    const rollRad = Math.atan2(p263.y - p33.y, p263.x - p33.x);
    const roll = rollRad * (180 / Math.PI);

    // Yaw: Nose tip (1) relative to mid-eye (168) and zygomatic width
    const pZygL = landmarks[234] || { x: 0.2, y: 0.5, z: 0 };
    const pZygR = landmarks[454] || { x: 0.8, y: 0.5, z: 0 };
    const pNose = landmarks[1] || landmarks[4] || { x: 0.5, y: 0.5, z: 0 };
    const midX = (pZygL.x + pZygR.x) / 2;
    const faceW = Math.abs(pZygR.x - pZygL.x) || 0.5;
    const yaw = ((pNose.x - midX) / (faceW / 2)) * 45; // ~normalized to degrees

    // Pitch: Forehead (10) vs Nose (1) vs Chin (152)
    const p10 = landmarks[10] || { x: 0.5, y: 0.2, z: 0 };
    const p152 = landmarks[152] || { x: 0.5, y: 0.8, z: 0 };
    const midFaceY = (p10.y + p152.y) / 2;
    const faceH = Math.abs(p152.y - p10.y) || 0.6;
    const pitch = ((pNose.y - midFaceY) / (faceH / 2)) * 35;

    return {
      pitch: Math.round(pitch * 10) / 10,
      yaw: Math.round(yaw * 10) / 10,
      roll: Math.round(roll * 10) / 10
    };
  }

  /**
   * Evaluates the 4 Gatekeeper criteria:
   * 1. Overall luminance (65..220)
   * 2. Bilateral lighting difference (<= 18%)
   * 3. Lens distortion / Distance (Bizygomatic width 25%..52% of frame)
   * 4. 3D Pose angles (Pitch, Yaw, Roll <= 7 deg)
   */
  public static validateFrame(
    canvas: HTMLCanvasElement,
    landmarks: LandmarkPoint[],
    matrix?: Float32Array | number[]
  ): GatekeeperStatus {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;

    if (!ctx || width === 0 || height === 0 || landmarks.length < 468) {
      return {
        luminance: 0,
        bilateralDiff: 0,
        distanceRatio: 0,
        eulerAngles: { pitch: 0, yaw: 0, roll: 0 },
        isLuminanceOk: false,
        isLightingOk: false,
        isDistanceOk: false,
        isPoseOk: false,
        canScan: false,
        errorMessage: 'Лицо не обнаружено в кадре'
      };
    }

    // 1. Calculate Bizygomatic width to frame width ratio (234 to 454)
    const pZygL = landmarks[234];
    const pZygR = landmarks[454];
    const bizygomaticWidthPx = Math.hypot((pZygR.x - pZygL.x) * width, (pZygR.y - pZygL.y) * height);
    const distanceRatio = bizygomaticWidthPx / width;

    // 2. 3D Pose Euler angles
    const eulerAngles = this.extractEulerAngles(landmarks, matrix);
    const isPoseOk =
      Math.abs(eulerAngles.pitch) <= 7 &&
      Math.abs(eulerAngles.yaw) <= 7 &&
      Math.abs(eulerAngles.roll) <= 7;

    // 3. Pixel luminance & Bilateral lighting
    // Calculate bounding box of face
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (let i = 0; i < landmarks.length; i++) {
      const p = landmarks[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const faceBox = {
      x: Math.max(0, Math.floor(minX * width)),
      y: Math.max(0, Math.floor(minY * height)),
      w: Math.min(width, Math.ceil((maxX - minX) * width)),
      h: Math.min(height, Math.ceil((maxY - minY) * height))
    };

    let overallLuminance = 128;
    let bilateralDiff = 0;

    try {
      // Sample face box pixels with stride to preserve 60fps performance
      if (faceBox.w > 20 && faceBox.h > 20) {
        const imgData = ctx.getImageData(faceBox.x, faceBox.y, faceBox.w, faceBox.h);
        const data = imgData.data;
        let sumLuminance = 0;
        let sampleCount = 0;
        const step = 4 * 4; // every 4th pixel

        for (let i = 0; i < data.length; i += step) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Standard ITU-R BT.601 formula: 0.299R + 0.587G + 0.114B
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          sumLuminance += lum;
          sampleCount++;
        }
        overallLuminance = sampleCount > 0 ? sumLuminance / sampleCount : 128;
      }

      // Bilateral cheek sampling
      // Left cheek anchor: landmark 116 / 123 / 50
      // Right cheek anchor: landmark 345 / 352 / 280
      const leftCheekPt = landmarks[123] || landmarks[116];
      const rightCheekPt = landmarks[352] || landmarks[345];
      const sampleRadius = Math.max(8, Math.floor(faceBox.w * 0.06));

      const getPolygonLuminance = (centerNorm: LandmarkPoint): number => {
        const cx = Math.floor(centerNorm.x * width);
        const cy = Math.floor(centerNorm.y * height);
        const rx = Math.max(0, cx - sampleRadius);
        const ry = Math.max(0, cy - sampleRadius);
        const rw = Math.min(width - rx, sampleRadius * 2);
        const rh = Math.min(height - ry, sampleRadius * 2);
        if (rw <= 0 || rh <= 0) return overallLuminance;

        const cheekData = ctx.getImageData(rx, ry, rw, rh).data;
        let lumSum = 0;
        let cnt = 0;
        for (let i = 0; i < cheekData.length; i += 16) {
          lumSum += 0.299 * cheekData[i] + 0.587 * cheekData[i + 1] + 0.114 * cheekData[i + 2];
          cnt++;
        }
        return cnt > 0 ? lumSum / cnt : overallLuminance;
      };

      const lumLeft = getPolygonLuminance(leftCheekPt);
      const lumRight = getPolygonLuminance(rightCheekPt);

      const maxCheek = Math.max(lumLeft, lumRight, 1);
      bilateralDiff = Math.abs(lumLeft - lumRight) / maxCheek;
    } catch {
      // fallback in case of canvas read restriction
    }

    // Gatekeeper thresholds from specs:
    // 1. Luminance: 65 to 220
    const isLuminanceOk = overallLuminance >= 65 && overallLuminance <= 220;
    // 2. Bilateral lighting: difference <= 18% (0.18)
    const isLightingOk = bilateralDiff <= 0.18;
    // 3. Lens distortion / Bizygomatic width: 25% to 52% (0.25 to 0.52)
    const isDistanceOk = distanceRatio >= 0.25 && distanceRatio <= 0.52;

    let errorMessage: string | undefined;

    if (!isLuminanceOk) {
      errorMessage = 'Слишком темно или засвечено. Встаньте лицом к мягкому источнику света';
    } else if (!isLightingOk) {
      errorMessage = 'Свет падает сбоку и искажает рельеф. Повернитесь прямо к источнику света';
    } else if (!isDistanceOk) {
      if (distanceRatio > 0.52) {
        errorMessage = 'Слишком близко. Отодвиньте телефон на 40–50 см, чтобы линза не искажала пропорции челюсти';
      } else {
        errorMessage = 'Слишком далеко. Приблизьте телефон на расстояние 40–50 см';
      }
    } else if (!isPoseOk) {
      errorMessage = 'Держите голову ровно и смотрите прямо в объектив камеры';
    }

    const canScan = isLuminanceOk && isLightingOk && isDistanceOk && isPoseOk;

    return {
      luminance: Math.round(overallLuminance),
      bilateralDiff: Math.round(bilateralDiff * 100) / 100,
      distanceRatio: Math.round(distanceRatio * 100) / 100,
      eulerAngles,
      isLuminanceOk,
      isLightingOk,
      isDistanceOk,
      isPoseOk,
      canScan,
      errorMessage
    };
  }
}
