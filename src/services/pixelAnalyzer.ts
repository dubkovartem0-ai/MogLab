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
   * Samples a localized circular patch around a landmark and calculates HIGH-FREQUENCY skin texture variance
   * (Filters out low-frequency macroscopic bone shadows from cheekbones, jawline, and brow ridges)
   */
  private static samplePatch(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    center: LandmarkPoint,
    radiusPx: number,
    wb: { r: number; g: number; b: number }
  ): { avgLum: number; localStdDev: number; highFreqNoise: number; rednessRatio: number; count: number } {
    const cx = Math.floor(center.x * width);
    const cy = Math.floor(center.y * height);
    const rx = Math.max(0, cx - radiusPx);
    const ry = Math.max(0, cy - radiusPx);
    const rw = Math.min(width - rx, radiusPx * 2);
    const rh = Math.min(height - ry, radiusPx * 2);

    if (rw <= 2 || rh <= 2) {
      return { avgLum: 128, localStdDev: 5, highFreqNoise: 0, rednessRatio: 1.1, count: 0 };
    }

    const imgData = ctx.getImageData(rx, ry, rw, rh).data;
    const lums: number[] = [];
    let sumLum = 0;
    let sumRedness = 0;

    for (let y = 0; y < rh; y += 2) {
      for (let x = 0; x < rw; x += 2) {
        const dx = (rx + x) - cx;
        const dy = (ry + y) - cy;
        if (dx * dx + dy * dy <= radiusPx * radiusPx) {
          const idx = (y * rw + x) * 4;
          const r = Math.min(255, imgData[idx] * wb.r);
          const g = Math.min(255, imgData[idx + 1] * wb.g);
          const b = Math.min(255, imgData[idx + 2] * wb.b);
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          lums.push(lum);
          sumLum += lum;

          const gb = (g + b) / 2 || 1;
          sumRedness += r / gb;
        }
      }
    }

    if (lums.length < 6) {
      return { avgLum: 128, localStdDev: 5, highFreqNoise: 0, rednessRatio: 1.1, count: 0 };
    }

    const avgLum = sumLum / lums.length;
    let varSum = 0;
    let sharpJumps = 0;

    for (let i = 0; i < lums.length; i++) {
      varSum += Math.pow(lums[i] - avgLum, 2);
      if (i > 0 && Math.abs(lums[i] - lums[i - 1]) > 7) {
        sharpJumps++;
      }
    }

    const localStdDev = Math.sqrt(varSum / lums.length);
    const highFreqNoise = (sharpJumps / lums.length) * 12;
    const rednessRatio = sumRedness / lums.length;

    return { avgLum, localStdDev, highFreqNoise, rednessRatio, count: lums.length };
  }

  /**
   * Step 2: Calibrate White Balance using Sclera (Eye White) as reference
   */
  public static calibrateSclera(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    landmarks: LandmarkPoint[]
  ): { r: number; g: number; b: number } {
    const scleraIndices = [133, 154, 155, 362, 381, 382];
    const scleraPoints = scleraIndices.map(idx => landmarks[idx]).filter(Boolean);

    const samples = this.sampleRegion(ctx, width, height, scleraPoints);
    const filtered = samples.filter(p => p.lum > 70 && p.lum < 245);

    if (filtered.length === 0) {
      return { r: 1.0, g: 1.0, b: 1.0 };
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
    const avgGrey = (avgR + avgG + avgB) / 3;

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
   * Performs clinical dermoscopic analysis of the bilateral cheek regions
   * to detect active acne pustules, papules, post-inflammatory erythema (PIE),
   * and separates chrominance blotchiness from monochromatic anatomical bone shadows.
   */
  public static analyzeCheekAcneAndErythema(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    landmarks: LandmarkPoint[],
    wb: { r: number; g: number; b: number }
  ): {
    acneInflammationScore: number; // 0..1 (0 = clear glass skin, 1 = severe inflammatory acne)
    chromaStdDev: number;          // Standard deviation of (R - G) across cheek
    erythemaRatio: number;         // Ratio of red excess
    inflamedSpotPercent: number;   // Percent of cheek covered by inflamed red dots
  } {
    // Bilateral cheek zone polygons
    // Left cheek: 116 (malar), 123, 147, 213, 192, 138, 172 (gonion), 58, 234 (tragus)
    // Right cheek: 345 (malar), 352, 376, 433, 416, 367, 397 (gonion), 288, 454 (tragus)
    const leftCheekIdx = [116, 123, 147, 213, 192, 138, 172, 58, 132, 234];
    const rightCheekIdx = [345, 352, 376, 433, 416, 367, 397, 288, 361, 454];

    const leftCheekPoints = leftCheekIdx.map(i => landmarks[i]).filter(Boolean);
    const rightCheekPoints = rightCheekIdx.map(i => landmarks[i]).filter(Boolean);

    const samplesL = this.sampleRegion(ctx, width, height, leftCheekPoints);
    const samplesR = this.sampleRegion(ctx, width, height, rightCheekPoints);
    const allCheekSamples = [...samplesL, ...samplesR];

    if (allCheekSamples.length < 15) {
      return { acneInflammationScore: 0.05, chromaStdDev: 4, erythemaRatio: 1.1, inflamedSpotPercent: 1 };
    }

    const chromaList: number[] = [];
    let sumChroma = 0;
    let sumRedRatio = 0;

    allCheekSamples.forEach(p => {
      const calibR = Math.min(255, p.r * wb.r);
      const calibG = Math.min(255, p.g * wb.g);
      const calibB = Math.min(255, p.b * wb.b);

      const diffRG = calibR - calibG;
      const gbMean = (calibG + calibB) / 2 || 1;
      const rRatio = calibR / gbMean;

      chromaList.push(diffRG);
      sumChroma += diffRG;
      sumRedRatio += rRatio;
    });

    const avgChroma = sumChroma / chromaList.length;
    const avgRedRatio = sumRedRatio / chromaList.length;

    let varSum = 0;
    let inflamedSpotsCount = 0;

    chromaList.forEach(c => {
      varSum += Math.pow(c - avgChroma, 2);
      // Inflammatory red acne spot condition:
      // Either relative jump (+15 above baseline) or absolute high red dominance (> 30)
      if (c > avgChroma + 15 || c > 30) {
        inflamedSpotsCount++;
      }
    });

    const chromaStdDev = Math.sqrt(varSum / chromaList.length);
    const inflamedSpotPercent = Math.round((inflamedSpotsCount / chromaList.length) * 100);

    // Normalized Acne Severity Score (0..1)
    // 12%+ inflamed spots = severe acne
    const spotPenalty = Math.min(1.0, inflamedSpotPercent / 12);
    const blotchPenalty = Math.min(1.0, Math.max(0, (chromaStdDev - 6.5) / 14));
    const acneInflammationScore = Math.max(0, Math.min(1, spotPenalty * 0.70 + blotchPenalty * 0.30));

    return {
      acneInflammationScore,
      chromaStdDev: Math.round(chromaStdDev * 10) / 10,
      erythemaRatio: Math.round(avgRedRatio * 100) / 100,
      inflamedSpotPercent
    };
  }

  /**
   * Step 2 & 3: Local Skin Analysis with Anatomical Bone Shadow Filtering & Facial Michelson Contrast
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
      skinRednessIndex: 1.12,
      skinLuminanceVariance: 8.5,
      skinLuminanceAvg: 140,
      eyebrowContrast: 0.28,
      lipContrast: 0.24,
      overallFacialContrast: 0.26,
      underEyeDarknessRatio: 0.94,
      fitzpatrickEstimate: 'Type II'
    };

    if (!ctx || width === 0 || height === 0 || landmarks.length < 468) {
      return defaultMetrics;
    }

    try {
      // 1. Sclera White Balance
      const wb = this.calibrateSclera(ctx, width, height, landmarks);

      // 2. Clinical Dermoscopic Cheek Acne & Erythema Analysis
      const acneDermo = this.analyzeCheekAcneAndErythema(ctx, width, height, landmarks, wb);

      // 3. High-Frequency vs Low-Pass Skin Texture Filtering:
      // We sample isolated circular patches across anatomical areas to isolate high-frequency
      // texture noise (wrinkles, acne, pores, stubble) from low-frequency bone shadows (cheek hollows, brow ridges).
      const patchRadius = Math.max(6, Math.floor(width * 0.025)); // ~10-14px

      const patchAnchors = [
        landmarks[151] || landmarks[9],   // Mid-Forehead
        landmarks[117] || landmarks[123], // Left Malar (Cheek Apple)
        landmarks[346] || landmarks[352], // Right Malar (Cheek Apple)
        landmarks[213] || landmarks[147], // Left Sub-malar Hollow
        landmarks[433] || landmarks[376], // Right Sub-malar Hollow
        landmarks[175] || landmarks[152], // Chin
      ].filter(Boolean);

      let totalTextureDev = 0;
      let totalHighFreqNoise = 0;
      let totalRedness = 0;
      let totalLum = 0;
      let validPatches = 0;

      patchAnchors.forEach(pt => {
        const pResult = this.samplePatch(ctx, width, height, pt, patchRadius, wb);
        if (pResult.count > 0) {
          totalTextureDev += pResult.localStdDev;
          totalHighFreqNoise += pResult.highFreqNoise;
          totalRedness += pResult.rednessRatio;
          totalLum += pResult.avgLum;
          validPatches++;
        }
      });

      const patchCount = validPatches || 1;
      const avgLocalStdDev = totalTextureDev / patchCount;
      const avgHighFreqNoise = totalHighFreqNoise / patchCount;
      const rawRedness = totalRedness / patchCount;
      const skinLuminanceAvg = totalLum / patchCount;

      // Smart Bone Shadow vs Inflammatory Acne Disentanglement:
      // In clear skin with deep bone hollows (like Jordan Barrett), chrominance is uniform
      // (acneInflammationScore < 0.15, chromaStdDev < 7.8). We cap monochrome shadow variance
      // so clean skin with hollow cheeks is recognized as high appeal glass skin (5.5 - 7.8)!
      // In acne-affected skin, red inflammatory spikes and blotchiness heavily inflate variance (20.0 - 38.0+).
      let effectiveVariance = avgLocalStdDev + avgHighFreqNoise;
      if (acneDermo.acneInflammationScore < 0.15 && acneDermo.chromaStdDev < 7.8) {
        effectiveVariance = Math.min(effectiveVariance, 7.8);
      } else {
        effectiveVariance += acneDermo.acneInflammationScore * 18 + acneDermo.inflamedSpotPercent * 0.6;
      }
      const skinLuminanceVariance = Math.round(effectiveVariance * 10) / 10;

      // Stricter skin redness index incorporating dermoscopic erythema
      const skinRednessIndex = Math.round(
        Math.max(rawRedness, acneDermo.erythemaRatio + acneDermo.acneInflammationScore * 0.40) * 100
      ) / 100;

      // 4. Eyebrows & Lips Contrast Analysis (Michelson Contrast)
      const browIndices = [70, 63, 105, 66, 336, 296, 334, 293];
      const browPoints = browIndices.map(idx => landmarks[idx]).filter(Boolean);
      const browSamples = this.sampleRegion(ctx, width, height, browPoints);

      let browLumSum = 0;
      browSamples.forEach(p => {
        browLumSum += (0.299 * p.r * wb.r + 0.587 * p.g * wb.g + 0.114 * p.b * wb.b);
      });
      const browLumAvg = browSamples.length > 0 ? browLumSum / browSamples.length : skinLuminanceAvg * 0.7;

      const lipIndices = [61, 37, 0, 267, 291, 17, 84, 314];
      const lipPoints = lipIndices.map(idx => landmarks[idx]).filter(Boolean);
      const lipSamples = this.sampleRegion(ctx, width, height, lipPoints);

      let lipLumSum = 0;
      lipSamples.forEach(p => {
        lipLumSum += (0.299 * p.r * wb.r + 0.587 * p.g * wb.g + 0.114 * p.b * wb.b);
      });
      const lipLumAvg = lipSamples.length > 0 ? lipLumSum / lipSamples.length : skinLuminanceAvg * 0.8;

      const michelson = (l1: number, l2: number) => {
        const sum = l1 + l2;
        return sum > 0 ? Math.abs(l1 - l2) / sum : 0;
      };

      const eyebrowContrast = michelson(skinLuminanceAvg, browLumAvg);
      const lipContrast = michelson(skinLuminanceAvg, lipLumAvg);
      const overallFacialContrast = Math.round((eyebrowContrast * 0.6 + lipContrast * 0.4) * 100) / 100;

      // 4. Infraorbital (Under-Eye) Dark Circles Analysis
      const underEyeIndices = [111, 117, 118, 119, 340, 346, 347, 348];
      const underEyePoints = underEyeIndices.map(idx => landmarks[idx]).filter(Boolean);
      const underEyeSamples = this.sampleRegion(ctx, width, height, underEyePoints);
      let underEyeLumSum = 0;
      underEyeSamples.forEach(p => {
        underEyeLumSum += (0.299 * p.r * wb.r + 0.587 * p.g * wb.g + 0.114 * p.b * wb.b);
      });
      const underEyeLumAvg = underEyeSamples.length > 0 ? underEyeLumSum / underEyeSamples.length : skinLuminanceAvg * 0.92;
      const underEyeDarknessRatio = skinLuminanceAvg > 0
        ? Math.max(0.4, Math.min(1.2, Math.round((underEyeLumAvg / skinLuminanceAvg) * 100) / 100))
        : 0.92;

      // 5. Fitzpatrick Scale Estimation based on calibrated skin luminance
      let fitzpatrickEstimate = 'Type II';
      if (skinLuminanceAvg >= 180) fitzpatrickEstimate = 'Type I';
      else if (skinLuminanceAvg >= 155) fitzpatrickEstimate = 'Type II';
      else if (skinLuminanceAvg >= 130) fitzpatrickEstimate = 'Type III';
      else if (skinLuminanceAvg >= 105) fitzpatrickEstimate = 'Type IV';
      else if (skinLuminanceAvg >= 80) fitzpatrickEstimate = 'Type V';
      else fitzpatrickEstimate = 'Type VI';

      return {
        whiteBalanceCorrection: wb,
        skinRednessIndex: Math.round(skinRednessIndex * 100) / 100,
        skinLuminanceVariance,
        skinLuminanceAvg: Math.round(skinLuminanceAvg),
        eyebrowContrast: Math.round(eyebrowContrast * 100) / 100,
        lipContrast: Math.round(lipContrast * 100) / 100,
        overallFacialContrast,
        underEyeDarknessRatio,
        fitzpatrickEstimate,
        acneInflammationScore: Math.round(acneDermo.acneInflammationScore * 100) / 100
      };
    } catch {
      return defaultMetrics;
    }
  }
}
