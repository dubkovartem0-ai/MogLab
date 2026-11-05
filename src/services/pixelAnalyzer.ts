import { LandmarkPoint, PixelColorMetrics } from '../types/biometrics';

export class PixelAnalyzerService {
  /**
   * Samples pixel RGB values within a polygon or bounding box of landmark indices
   */
  private static sampleRegion(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    points: LandmarkPoint[]
  ): { r: number; g: number; b: number; lum: number }[] {
    if (points.length === 0) return [];

    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const rx = Math.max(0, Math.floor(minX * width));
    const ry = Math.max(0, Math.floor(minY * height));
    const rw = Math.min(width - rx, Math.ceil((maxX - minX) * width));
    const rh = Math.min(height - ry, Math.ceil((maxY - minY) * height));

    if (rw <= 2 || rh <= 2) return [];

    const imgData = ctx.getImageData(rx, ry, rw, rh).data;
    const pixels: { r: number; g: number; b: number; lum: number }[] = [];

    // Sample every 2nd or 3rd pixel for speed and statistical accuracy
    for (let i = 0; i < imgData.length; i += 12) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      pixels.push({ r, g, b, lum });
    }

    return pixels;
  }

  /**
   * Step 1: Calibrate White Balance using Sclera (Eye White) as reference
   */
  public static calibrateSclera(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    landmarks: LandmarkPoint[]
  ): { r: number; g: number; b: number } {
    // Sclera landmarks (inner eye corners outside iris)
    // Left eye medial sclera: 133, 155, 154
    // Right eye medial sclera: 362, 382, 381
    const scleraIndices = [133, 154, 155, 362, 381, 382];
    const scleraPoints = scleraIndices.map(idx => landmarks[idx]).filter(Boolean);

    const samples = this.sampleRegion(ctx, width, height, scleraPoints);

    // Filter out specular highlights (pure 255) and dark eyelash shadows
    const filtered = samples.filter(p => p.lum > 70 && p.lum < 245);

    if (filtered.length === 0) {
      return { r: 1.0, g: 1.0, b: 1.0 }; // Neutral fallback
    }

    let sumR = 0, sumG = 0, sumB = 0;
    filtered.forEach(p => {
      sumR += p.r;
      sumG += p.g;
      sumB += p.b;
    });

    const avgR = sumR / filtered.length;
    const avgG = sumG / filtered.length;
    const avgB = sumB / filtered.length;

    // Neutral gray reference is the average channel intensity
    const avgGrey = (avgR + avgG + avgB) / 3;

    // Guard against divide by zero or extreme shifts
    const scaleR = avgR > 10 ? Math.max(0.6, Math.min(1.4, avgGrey / avgR)) : 1.0;
    const scaleG = avgG > 10 ? Math.max(0.6, Math.min(1.4, avgGrey / avgG)) : 1.0;
    const scaleB = avgB > 10 ? Math.max(0.6, Math.min(1.4, avgGrey / avgB)) : 1.0;

    return {
      r: Math.round(scaleR * 1000) / 1000,
      g: Math.round(scaleG * 1000) / 1000,
      b: Math.round(scaleB * 1000) / 1000
    };
  }

  /**
   * Step 2 & 3: Local Skin Analysis and Facial Michelson Contrast
   */
  public static analyzeCanvas(
    canvas: HTMLCanvasElement,
    landmarks: LandmarkPoint[]
  ): PixelColorMetrics {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;

    const defaultMetrics: PixelColorMetrics = {
      whiteBalanceCorrection: { r: 1, g: 1, b: 1 },
      skinRednessIndex: 1.15,
      skinLuminanceVariance: 14.5,
      skinLuminanceAvg: 140,
      eyebrowContrast: 0.28,
      lipContrast: 0.24,
      overallFacialContrast: 0.26
    };

    if (!ctx || width === 0 || height === 0 || landmarks.length < 468) {
      return defaultMetrics;
    }

    try {
      // 1. Sclera White Balance
      const wb = this.calibrateSclera(ctx, width, height, landmarks);

      // 2. Forehead & Cheeks Skin Sampling
      // Cheeks: [116, 123, 147, 213, 192, 345, 352, 376, 433, 416]
      // Forehead: [10, 67, 109, 108, 151, 337, 297]
      const skinIndices = [116, 123, 147, 213, 345, 352, 376, 433, 108, 109, 337];
      const skinPoints = skinIndices.map(idx => landmarks[idx]).filter(Boolean);
      const skinSamples = this.sampleRegion(ctx, width, height, skinPoints);

      let skinLumSum = 0;
      let rednessSum = 0;
      const correctedLums: number[] = [];

      skinSamples.forEach(p => {
        const corrR = Math.min(255, p.r * wb.r);
        const corrG = Math.min(255, p.g * wb.g);
        const corrB = Math.min(255, p.b * wb.b);
        const lum = 0.299 * corrR + 0.587 * corrG + 0.114 * corrB;
        correctedLums.push(lum);
        skinLumSum += lum;

        const greenBlue = (corrG + corrB) / 2 || 1;
        rednessSum += corrR / greenBlue;
      });

      const sampleCount = skinSamples.length || 1;
      const skinLuminanceAvg = skinLumSum / sampleCount;
      const skinRednessIndex = rednessSum / sampleCount;

      // Variance & Standard Deviation of skin luminance
      let varianceSum = 0;
      correctedLums.forEach(lum => {
        varianceSum += Math.pow(lum - skinLuminanceAvg, 2);
      });
      const skinLuminanceVariance = Math.sqrt(varianceSum / sampleCount);

      // 3. Eyebrows & Lips Contrast Analysis (Michelson Contrast)
      // Eyebrow landmarks: left [70, 63, 105, 66], right [336, 296, 334, 293]
      const browIndices = [70, 63, 105, 66, 336, 296, 334, 293];
      const browPoints = browIndices.map(idx => landmarks[idx]).filter(Boolean);
      const browSamples = this.sampleRegion(ctx, width, height, browPoints);

      let browLumSum = 0;
      browSamples.forEach(p => {
        browLumSum += (0.299 * p.r * wb.r + 0.587 * p.g * wb.g + 0.114 * p.b * wb.b);
      });
      const browLumAvg = browSamples.length > 0 ? browLumSum / browSamples.length : skinLuminanceAvg * 0.7;

      // Lips landmarks: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
      const lipIndices = [61, 37, 0, 267, 291, 17, 84, 314];
      const lipPoints = lipIndices.map(idx => landmarks[idx]).filter(Boolean);
      const lipSamples = this.sampleRegion(ctx, width, height, lipPoints);

      let lipLumSum = 0;
      lipSamples.forEach(p => {
        lipLumSum += (0.299 * p.r * wb.r + 0.587 * p.g * wb.g + 0.114 * p.b * wb.b);
      });
      const lipLumAvg = lipSamples.length > 0 ? lipLumSum / lipSamples.length : skinLuminanceAvg * 0.8;

      // Michelson Formula: |L_skin - L_feature| / (L_skin + L_feature)
      const michelson = (l1: number, l2: number) => {
        const sum = l1 + l2;
        return sum > 0 ? Math.abs(l1 - l2) / sum : 0;
      };

      const eyebrowContrast = michelson(skinLuminanceAvg, browLumAvg);
      const lipContrast = michelson(skinLuminanceAvg, lipLumAvg);
      const overallFacialContrast = (eyebrowContrast * 0.6 + lipContrast * 0.4);

      return {
        whiteBalanceCorrection: wb,
        skinRednessIndex: Math.round(skinRednessIndex * 100) / 100,
        skinLuminanceVariance: Math.round(skinLuminanceVariance * 10) / 10,
        skinLuminanceAvg: Math.round(skinLuminanceAvg),
        eyebrowContrast: Math.round(eyebrowContrast * 100) / 100,
        lipContrast: Math.round(lipContrast * 100) / 100,
        overallFacialContrast: Math.round(overallFacialContrast * 100) / 100
      };
    } catch {
      return defaultMetrics;
    }
  }
}
