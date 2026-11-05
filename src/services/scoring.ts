import {
  BiometricMetrics,
  BiometricReport,
  GenderMode,
  HaloItem,
  PixelColorMetrics,
  RadarMetric
} from '../types/biometrics';

/**
 * Standard Normal Cumulative Distribution Function Phi(z)
 */
function phi(z: number): number {
  return 0.5 * (1 + Math.sign(z) * Math.sqrt(1 - Math.exp((-2 * z * z) / Math.PI)));
}

/**
 * Converts a Gaussian Z-score into a 1.0 - 10.0 clinical PSL/Harmony rating scale:
 * Population Mean: 4.6 (typical faces score 4.0 - 5.0)
 * Standard Deviation: 1.35
 * Z =  0.0 -> 4.6 (Mid Tier Normie baseline)
 * Z = +1.8 -> 7.03 (Top 3.5% threshold)
 * Z = +2.2 -> 7.57 (Chad / Stacy elite tier)
 * Z = -1.5 -> 2.58 (Sub-tier / Low tier)
 */
function zToScore(z: number): number {
  const mean = 4.6;
  const std = 1.35;
  const val = mean + z * std;
  return Math.max(1.2, Math.min(9.8, Math.round(val * 10) / 10));
}

interface CandidateHalo {
  id: string;
  name: string;
  badge: string;
  zScore: number;
  percentile: number;
  valueText: string;
  impact: string;
}

export class ScoringService {
  /**
   * Evaluates biometrics and colorimetry into standard clinical PSL/Harmony tiers
   */
  public static generateReport(
    gender: GenderMode,
    biometrics: BiometricMetrics,
    colorimetry: PixelColorMetrics,
    verifiedCamera: boolean
  ): BiometricReport {
    // =========================================================================
    // 1. BONE BASE CALCULATION (Genetic cranial baseline using Gaussian Z-Scores)
    // =========================================================================
    let boneScore = 4.6;
    let zBone = 0;

    // Canthal Tilt Z-score: Population mean shifted to +4.0° (std dev 2.5°)
    // Slight positive tilt (+3°..+4.5°) is completely average, NOT a Halo or extreme boost!
    const zCanthal = (biometrics.canthalTiltDegrees - 4.0) / 2.5;

    // Symmetry Z-score: mean 0.82, std dev 0.065
    const zSymmetry = (biometrics.centralSymmetryIndex - 0.82) / 0.065;

    if (gender === 'male') {
      // 1. FWHR (Facial Width-to-Height Ratio): Mean 1.84, ideal masculine ~1.95 - 2.05
      const zFwhr = 2.0 - Math.abs(biometrics.fwhr - 1.98) / 0.08;

      // 2. Bigonial Ratio (Jaw width to bizygomatic width): Mean 0.85, ideal ~0.91 - 0.94
      const zJaw = (biometrics.bigonialRatio - 0.85) / 0.045;

      // 3. Midface Ratio (Compact midface): Mean 0.91, ideal ~1.00
      const zMidface = 1.8 - Math.abs(biometrics.midfaceRatio - 1.00) / 0.055;

      // Lowered Canthal Tilt weight to 0.10, prioritized Jawline & FWHR
      zBone = zFwhr * 0.28 + zJaw * 0.28 + zMidface * 0.20 + zSymmetry * 0.14 + zCanthal * 0.10;
    } else {
      // Female Harmony Engine
      // 1. Facial Thirds Balance: Mean 0.74, std 0.09
      const zThirds = (biometrics.facialThirdsBalance.balanceScore - 0.74) / 0.09;

      // 2. Ogee Curve (Cheekbone projection): Mean 0.65, std 0.09
      const zOgee = (biometrics.ogeeCurveProminence - 0.65) / 0.09;

      // 3. Philtrum to Chin: Mean 0.42, ideal ~0.50
      const zPhiltrum = 1.8 - Math.abs(biometrics.philtrumToChinRatio - 0.50) / 0.06;

      zBone = zThirds * 0.28 + zOgee * 0.26 + zSymmetry * 0.18 + zPhiltrum * 0.18 + zCanthal * 0.10;
    }

    boneScore = zToScore(zBone);

    // =========================================================================
    // 2. APPEAL SCORE CALCULATION (Skin Variance, Contrast, Redness)
    // =========================================================================
    // Skin Variance Sigmoid Response:
    // Glass skin (< 9.0): S_var >= 7.6
    // Average texture (13.0 - 16.0): S_var ~ 4.5 - 5.5
    // Wrinkles, deep shadow folds, coarse stubble (> 22.0): S_var drops to 1.8 - 2.8!
    const variance = colorimetry.skinLuminanceVariance;
    const skinVarianceScore = 1.5 + 8.2 / (1.0 + Math.exp((variance - 14.0) / 3.8));

    // Facial Contrast (Michelson contrast of eyebrows, lash line, lips):
    // Average ~0.20 -> 4.8. High contrast (> 0.28) -> 7.0 - 8.5. Washed out (< 0.14) -> 2.5 - 3.2
    const contrast = colorimetry.overallFacialContrast;
    const contrastScore = Math.max(1.5, Math.min(9.5, 4.8 + ((contrast - 0.20) / 0.04) * 1.15));

    // Skin Redness Index (Erythema / Inflammation / Acne):
    // Normal ~1.08 - 1.14 -> 5.5. Elevated > 1.25 -> drops to 2.0 - 3.0
    const redness = colorimetry.skinRednessIndex;
    const rednessScore = Math.max(1.5, Math.min(9.0, 5.5 - Math.max(0, redness - 1.12) * 22));

    // Skin Variance is the primary driver of Appeal (55% weight):
    // Deep wrinkles or severe stubble drop total Appeal to 2.0 - 3.2!
    const appealScore = Math.max(
      1.5,
      Math.min(9.5, skinVarianceScore * 0.55 + contrastScore * 0.25 + rednessScore * 0.20)
    );

    // =========================================================================
    // 3. OVERALL CURRENT & POTENTIAL SCORES (Wide Gaussian distribution)
    // =========================================================================
    // 60% Bone structure + 40% Appeal
    let currentScore = Math.round((boneScore * 0.60 + appealScore * 0.40) * 10) / 10;
    currentScore = Math.max(1.5, Math.min(9.8, currentScore));

    // Potential Score (Appeal maximized through debloating and optimal skincare)
    const potentialAppeal = Math.min(9.2, Math.max(appealScore + 1.8, 8.2));
    let potentialScore = Math.round((boneScore * 0.60 + potentialAppeal * 0.40) * 10) / 10;
    potentialScore = Math.max(currentScore + 0.5, Math.min(9.8, potentialScore));

    // =========================================================================
    // 4. TIER CLASSIFICATION
    // =========================================================================
    let currentTier = 'MTN';
    if (gender === 'male') {
      if (currentScore < 3.5) currentTier = 'Subhuman';
      else if (currentScore < 4.4) currentTier = 'LTN (Low Tier Normie)';
      else if (currentScore < 5.4) currentTier = 'MTN (Mid Tier Normie)';
      else if (currentScore < 6.8) currentTier = 'HTN (High Tier Normie)';
      else if (currentScore < 8.0) currentTier = 'Chadlite';
      else currentTier = 'Chad';
    } else {
      if (currentScore < 3.5) currentTier = 'Sub-tier';
      else if (currentScore < 4.4) currentTier = 'LTN (Low Tier)';
      else if (currentScore < 5.4) currentTier = 'MTN (Mid Tier)';
      else if (currentScore < 6.8) currentTier = 'HTN (High Tier)';
      else if (currentScore < 8.0) currentTier = 'Stacylite';
      else currentTier = 'Stacy';
    }

    // =========================================================================
    // 5. BALANCED HALOS DISCOVERY (Ranked strictly by highest Z-Score)
    // =========================================================================
    const candidates: CandidateHalo[] = [];

    // Helper to calculate percentile from Z-Score
    const calcPct = (z: number) => Math.min(99, Math.max(50, Math.round(phi(z) * 100)));

    // 1. Canthal Tilt: ONLY eligible if tilt is significantly positive (Z >= 0.8, tilt >= +6.0°)
    if (zCanthal >= 0.8) {
      candidates.push({
        id: 'canthal_tilt',
        name: 'Positive Canthal Tilt',
        badge: 'Hunter Eyes Area',
        zScore: zCanthal,
        percentile: calcPct(zCanthal),
        valueText: `+${biometrics.canthalTiltDegrees.toFixed(1)}°`,
        impact: '+0.7 к хищному вектору орбитальной зоны'
      });
    }

    // 2. Jawline / Bigonial Ratio (Gonial Width)
    const zJaw = (biometrics.bigonialRatio - 0.85) / 0.045;
    if (zJaw >= 0.6) {
      candidates.push({
        id: 'jaw_base',
        name: 'Широкая челюсть (Gonial Width)',
        badge: 'Костная структура',
        zScore: zJaw,
        percentile: calcPct(zJaw),
        valueText: `${biometrics.bigonialRatio.toFixed(2)} Ratio`,
        impact: '+0.8 к четкости и маскулинности овала'
      });
    }

    // 3. Central Symmetry Index
    if (zSymmetry >= 0.6) {
      candidates.push({
        id: 'symmetry',
        name: 'Central Symmetry Index',
        badge: 'Краниальная гармония',
        zScore: zSymmetry,
        percentile: calcPct(zSymmetry),
        valueText: `${Math.round(biometrics.centralSymmetryIndex * 100)}%`,
        impact: '+0.6 к симметрии половин лица'
      });
    }

    // 4. Facial Contrast
    const zContrast = (colorimetry.overallFacialContrast - 0.20) / 0.045;
    if (zContrast >= 0.6) {
      candidates.push({
        id: 'contrast',
        name: 'High Facial Contrast',
        badge: 'Свет и пигментация',
        zScore: zContrast,
        percentile: calcPct(zContrast),
        valueText: `${Math.round(colorimetry.overallFacialContrast * 100)}%`,
        impact: '+0.7 к выразительности взгляда'
      });
    }

    // 5. Male FWHR
    if (gender === 'male') {
      const zFwhr = 2.0 - Math.abs(biometrics.fwhr - 1.98) / 0.08;
      if (zFwhr >= 0.6) {
        candidates.push({
          id: 'fwhr',
          name: 'Оптимальный FWHR',
          badge: 'Маскулинная база',
          zScore: zFwhr,
          percentile: calcPct(zFwhr),
          valueText: `${biometrics.fwhr.toFixed(2)}`,
          impact: '+0.8 к плотности лицевой геометрии'
        });
      }

      // Compact Midface
      const zMidface = 1.8 - Math.abs(biometrics.midfaceRatio - 1.00) / 0.055;
      if (zMidface >= 0.6) {
        candidates.push({
          id: 'midface',
          name: 'Компактный Midface',
          badge: 'Пропорции лица',
          zScore: zMidface,
          percentile: calcPct(zMidface),
          valueText: `${biometrics.midfaceRatio.toFixed(2)} Ratio`,
          impact: '+0.5 к неотении средней трети'
        });
      }
    } else {
      // Female Thirds Balance
      const zThirds = (biometrics.facialThirdsBalance.balanceScore - 0.74) / 0.09;
      if (zThirds >= 0.6) {
        candidates.push({
          id: 'thirds',
          name: 'Facial Thirds Balance',
          badge: 'Идеальные трети',
          zScore: zThirds,
          percentile: calcPct(zThirds),
          valueText: `${biometrics.facialThirdsBalance.upper}% / ${biometrics.facialThirdsBalance.middle}% / ${biometrics.facialThirdsBalance.lower}%`,
          impact: '+0.8 к гармонии пропорций'
        });
      }

      // Female Ogee Curve Prominence
      const zOgee = (biometrics.ogeeCurveProminence - 0.65) / 0.09;
      if (zOgee >= 0.6) {
        candidates.push({
          id: 'ogee',
          name: 'Ogee Curve Prominence',
          badge: 'Скуловая дуга',
          zScore: zOgee,
          percentile: calcPct(zOgee),
          valueText: `${biometrics.ogeeCurveProminence.toFixed(2)}`,
          impact: '+0.7 к плавности скулового перехода'
        });
      }
    }

    // 6. Glass Skin Texture (Low Luminance Variance)
    const zSkin = (14.0 - variance) / 3.5;
    if (zSkin >= 0.6) {
      candidates.push({
        id: 'glass_skin',
        name: 'Glass Skin Texture',
        badge: 'Уход и микрорельеф',
        zScore: zSkin,
        percentile: calcPct(zSkin),
        valueText: `${variance.toFixed(1)} Var`,
        impact: '+0.8 к свежести и ровности тона'
      });
    }

    // Fallbacks if fewer than 2 candidates qualified
    if (candidates.length < 2) {
      candidates.push({
        id: 'symmetry_fallback',
        name: 'Facial Symmetry',
        badge: 'Симметрия лица',
        zScore: zSymmetry,
        percentile: calcPct(zSymmetry),
        valueText: `${Math.round(biometrics.centralSymmetryIndex * 100)}%`,
        impact: '+0.4 к балансу черт'
      });
    }
    if (candidates.length < 2) {
      candidates.push({
        id: 'contrast_fallback',
        name: 'Periorbital Contrast',
        badge: 'Контрастность',
        zScore: zContrast,
        percentile: calcPct(zContrast),
        valueText: `${Math.round(colorimetry.overallFacialContrast * 100)}%`,
        impact: '+0.4 к глубине взгляда'
      });
    }

    // Sort strictly descending by Z-score (greatest positive deviation from norm)
    candidates.sort((a, b) => b.zScore - a.zScore);
    const halos: HaloItem[] = candidates.slice(0, 2).map(c => ({
      id: c.id,
      name: c.name,
      badge: c.badge,
      percentile: c.percentile,
      valueText: c.valueText,
      impact: c.impact
    }));

    // =========================================================================
    // 6. RADAR CHART (6 Macro-Axes Normalized 0 - 100%)
    // =========================================================================
    // 1. Eye Area: canthal tilt, ESR and eye symmetry
    const eyeAreaVal = Math.max(15, Math.min(100, Math.round(50 + zCanthal * 22)));

    // 2. Midface: compact proportions
    const zMidfaceNorm = gender === 'male'
      ? (1.8 - Math.abs(biometrics.midfaceRatio - 1.00) / 0.055)
      : ((biometrics.facialThirdsBalance.balanceScore - 0.74) / 0.09);
    const midfaceVal = Math.max(15, Math.min(100, Math.round(50 + zMidfaceNorm * 22)));

    // 3. Jawline: bigonial width & angle
    const zJawNorm = (biometrics.bigonialRatio - 0.85) / 0.045;
    const jawlineVal = Math.max(15, Math.min(100, Math.round(50 + zJawNorm * 22)));

    // 4. Symmetry: cranial alignment
    const symmetryVal = Math.max(15, Math.min(100, Math.round(50 + zSymmetry * 22)));

    // 5. Skin Quality: directly derived from skinVarianceScore
    const skinQualityVal = Math.max(10, Math.min(100, Math.round(skinVarianceScore * 10.5)));

    // 6. Contrast: facial Michelson contrast
    const contrastVal = Math.max(15, Math.min(100, Math.round(contrastScore * 10.5)));

    const radarData: RadarMetric[] = [
      { subject: 'Eye Area', value: eyeAreaVal, fullMark: 100 },
      { subject: 'Midface', value: midfaceVal, fullMark: 100 },
      { subject: 'Jawline', value: jawlineVal, fullMark: 100 },
      { subject: 'Symmetry', value: symmetryVal, fullMark: 100 },
      { subject: 'Skin Quality', value: skinQualityVal, fullMark: 100 },
      { subject: 'Contrast', value: contrastVal, fullMark: 100 }
    ];

    // =========================================================================
    // 7. PAYWALL DEBUFF HOOK
    // =========================================================================
    const debuff = Math.max(0.6, Math.round((potentialScore - currentScore) * 10) / 10);
    const failosCount = 3;

    return {
      id: 'scan_' + Math.random().toString(36).substring(2, 10),
      timestamp: Date.now(),
      gender,
      verifiedCamera,
      currentTier,
      currentScore,
      potentialScore,
      boneBaseScore: Math.round(boneScore * 10) / 10,
      appealScore: Math.round(appealScore * 10) / 10,
      halos,
      radarData,
      failosCount,
      totalDebuffPenalty: debuff,
      extractedProfile: {
        gender,
        biometrics,
        colorimetry
      }
    };
  }
}
