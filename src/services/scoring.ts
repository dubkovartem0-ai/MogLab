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
 * Mean: 4.8 (typical faces score 4.5 - 5.5)
 * Standard Deviation: 1.35
 * Z =  0.0 -> 4.8 (Mid Tier Normie baseline)
 * Z = +1.6 -> 6.96 (Top 5% threshold)
 * Z = +2.2 -> 7.77 (Chad / Stacy elite tier)
 * Z = +2.8 -> 8.58 (Supermodel Top 0.5% tier)
 */
function zToScore(z: number, symmetry: number): number {
  const mean = 4.8;
  const std = 1.35;
  const raw = mean + z * std;

  // Soften the lower floor:
  // Faces without catastrophic deformity (symmetry >= 0.70) have a strict floor of 3.6 - 3.8.
  // Scores below 3.0 are reserved strictly for severe cranial asymmetry (< 0.65).
  const floor = symmetry >= 0.70 ? 3.7 : 1.8;
  return Math.max(floor, Math.min(9.8, Math.round(raw * 10) / 10));
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
    // 1. ASYMMETRIC DIMORPHIC Z-SCORES (Chad / High-Aesthetic Features Reward)
    // =========================================================================
    let zBone = 0;

    // Canthal Tilt: mean 4.0°, hunter tilt (> +5.5°) rewarded positively
    const zCanthal = biometrics.canthalTiltDegrees >= 4.0
      ? (biometrics.canthalTiltDegrees - 4.0) / 2.0
      : (biometrics.canthalTiltDegrees - 4.0) / 3.0;

    // Orbital Depth (Deep-set Hunter eyes vs prominent brow ridge)
    const zOrbital = (biometrics.orbitalDepth - 0.08) / 0.035;

    // Symmetry: mean 0.82, std dev 0.065
    const zSymmetry = (biometrics.centralSymmetryIndex - 0.82) / 0.065;

    // Midface Ratio (Asymmetric: hyper-compact midface >= 1.00 is a signature Chad/supermodel trait!)
    let zMidface: number;
    if (biometrics.midfaceRatio >= 1.00) {
      // Exponential reward for hyper-compact midface
      const excess = biometrics.midfaceRatio - 1.00;
      zMidface = 1.2 + Math.min(2.5, excess * 11);
    } else if (biometrics.midfaceRatio >= 0.90) {
      zMidface = ((biometrics.midfaceRatio - 0.90) / 0.10) * 1.2;
    } else {
      zMidface = -Math.min(2.5, (0.90 - biometrics.midfaceRatio) / 0.055);
    }

    // Jawline / Bigonial Ratio (Asymmetric: wide masculine ramus >= 0.88 rewarded exponentially)
    let zJaw: number;
    if (biometrics.bigonialRatio >= 0.88) {
      const excess = biometrics.bigonialRatio - 0.88;
      zJaw = 1.2 + Math.min(2.5, excess * 18);
    } else if (biometrics.bigonialRatio >= 0.82) {
      zJaw = ((biometrics.bigonialRatio - 0.82) / 0.06) * 1.2;
    } else {
      zJaw = -Math.min(2.5, (0.82 - biometrics.bigonialRatio) / 0.045);
    }

    // FWHR (Asymmetric: broad masculine frame >= 1.88 rewarded)
    let zFwhr: number;
    if (biometrics.fwhr >= 1.88) {
      const excess = biometrics.fwhr - 1.88;
      zFwhr = 1.0 + Math.min(2.5, excess * 12);
    } else if (biometrics.fwhr >= 1.80) {
      zFwhr = ((biometrics.fwhr - 1.80) / 0.08) * 1.0;
    } else {
      zFwhr = -Math.min(2.5, (1.80 - biometrics.fwhr) / 0.07);
    }

    if (gender === 'male') {
      const esrBonus = Math.abs(biometrics.esr - 0.46) <= 0.02 ? 0.25 : 0;
      zBone = zFwhr * 0.25 + zJaw * 0.25 + zMidface * 0.20 + zOrbital * 0.12 + zSymmetry * 0.10 + zCanthal * 0.08 + esrBonus;

      // Chad Synergy Bonus: multiple co-occurring hyper-masculine traits
      if (zFwhr >= 1.0 && zJaw >= 1.2 && zMidface >= 1.0) {
        zBone += 0.45;
      }
    } else {
      // Female Harmony Engine
      const zThirds = (biometrics.facialThirdsBalance.balanceScore - 0.74) / 0.09;
      const zOgee = (biometrics.ogeeCurveProminence - 0.65) / 0.09;
      const zPhiltrum = 1.8 - Math.abs(biometrics.philtrumToChinRatio - 0.50) / 0.06;
      const zLip = 1.5 - Math.abs(biometrics.lipRatio - 0.72) / 0.09;

      zBone = zThirds * 0.25 + zOgee * 0.23 + zPhiltrum * 0.18 + zLip * 0.14 + zSymmetry * 0.12 + zCanthal * 0.08;

      if (zThirds >= 1.0 && zOgee >= 1.2) {
        zBone += 0.40; // Stacy synergy
      }
    }

    const boneScore = zToScore(zBone, biometrics.centralSymmetryIndex);

    // =========================================================================
    // 2. APPEAL SCORE CALCULATION (High-Frequency Skin Texture & Contrast)
    // =========================================================================
    // skinLuminanceVariance is now high-frequency patch texture noise
    // (Anatomical cheekbone shadows do NOT contaminate this!)
    const variance = colorimetry.skinLuminanceVariance;

    // Sigmoid response for pure skin texture:
    // Glass skin (< 8.0): 7.8 .. 9.0
    // Good normal skin (9.0 .. 13.0): 5.8 .. 7.5
    // Rough pores / stubble / light wrinkles (14.0 .. 18.0): 4.0 .. 5.5
    // Deep wrinkles / severe acne (> 20.0): 2.5 .. 3.5
    const skinVarianceScore = 1.8 + 7.8 / (1.0 + Math.exp((variance - 13.0) / 3.4));

    // Contrast Score
    const contrast = colorimetry.overallFacialContrast;
    const contrastScore = Math.max(2.5, Math.min(9.5, 5.0 + ((contrast - 0.20) / 0.04) * 1.15));

    // Under-Eye (Tear Trough) Darkness Score:
    const underEyeRatio = colorimetry.underEyeDarknessRatio || 0.94;
    const underEyeScore = Math.max(2.5, Math.min(9.5, 5.0 + (underEyeRatio - 0.88) * 25));

    // Redness Score
    const redness = colorimetry.skinRednessIndex;
    const rednessScore = Math.max(2.5, Math.min(9.0, 5.8 - Math.max(0, redness - 1.12) * 20));

    let appealScore = skinVarianceScore * 0.45 + contrastScore * 0.22 + underEyeScore * 0.18 + rednessScore * 0.15;

    // Soften lower floor for Appeal (faces without severe skin pathology stay >= 3.2)
    appealScore = Math.max(3.0, Math.min(9.6, Math.round(appealScore * 10) / 10));

    // =========================================================================
    // 3. OVERALL CURRENT & POTENTIAL SCORES
    // =========================================================================
    let currentScore = Math.round((boneScore * 0.60 + appealScore * 0.40) * 10) / 10;

    // Absolute minimum for faces without severe asymmetry is 3.7
    if (biometrics.centralSymmetryIndex >= 0.70) {
      currentScore = Math.max(3.7, currentScore);
    }
    currentScore = Math.min(9.8, currentScore);

    // Potential Score (Skincare + debloating potential)
    const potentialAppeal = Math.min(9.5, Math.max(appealScore + 1.6, 8.4));
    let potentialScore = Math.round((boneScore * 0.60 + potentialAppeal * 0.40) * 10) / 10;
    potentialScore = Math.max(currentScore + 0.4, Math.min(9.9, potentialScore));

    // =========================================================================
    // 4. TIER CLASSIFICATION
    // =========================================================================
    let currentTier = 'MTN';
    if (gender === 'male') {
      if (currentScore < 3.6) currentTier = 'Subhuman';
      else if (currentScore < 4.5) currentTier = 'LTN (Low Tier Normie)';
      else if (currentScore < 5.6) currentTier = 'MTN (Mid Tier Normie)';
      else if (currentScore < 7.0) currentTier = 'HTN (High Tier Normie)';
      else if (currentScore < 8.2) currentTier = 'Chadlite';
      else currentTier = 'Chad';
    } else {
      if (currentScore < 3.6) currentTier = 'Sub-tier';
      else if (currentScore < 4.5) currentTier = 'LTN (Low Tier)';
      else if (currentScore < 5.6) currentTier = 'MTN (Mid Tier)';
      else if (currentScore < 7.0) currentTier = 'HTN (High Tier)';
      else if (currentScore < 8.2) currentTier = 'Stacylite';
      else currentTier = 'Stacy';
    }

    // =========================================================================
    // 5. BALANCED HALOS DISCOVERY (Ranked strictly by highest Z-Score)
    // =========================================================================
    const candidates: CandidateHalo[] = [];
    const calcPct = (z: number) => Math.min(99, Math.max(50, Math.round(phi(z) * 100)));

    // 1. Canthal Tilt: Eligible if tilt is hunter/positive (Z >= 0.6, tilt >= +5.2°)
    if (zCanthal >= 0.6) {
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

    // 3. Compact Midface
    if (zMidface >= 0.6) {
      candidates.push({
        id: 'midface',
        name: 'Компактный Midface',
        badge: 'Пропорции лица',
        zScore: zMidface,
        percentile: calcPct(zMidface),
        valueText: `${biometrics.midfaceRatio.toFixed(2)} Ratio`,
        impact: '+0.7 к неотении и гармонии средней трети'
      });
    }

    // 4. Central Symmetry Index
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

    // 5. Facial Contrast
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

    // 6. FWHR
    if (gender === 'male' && zFwhr >= 0.6) {
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

    // 7. Deep-Set Eyes (Orbital Depth / Supraorbital projection)
    if (zOrbital >= 0.7) {
      candidates.push({
        id: 'deep_set_eyes',
        name: 'Deep-Set Eyes (Глубокая посадка)',
        badge: 'Hunter Feature',
        zScore: zOrbital,
        percentile: calcPct(zOrbital),
        valueText: `+${(biometrics.orbitalDepth * 100).toFixed(1)}%`,
        impact: '+0.8 к хищному взгляду и выраженности надбровья'
      });
    }

    // 8. Under-Eye Freshness (Absence of dark circles / tear troughs)
    if (underEyeRatio >= 0.94) {
      const zUnderEye = (underEyeRatio - 0.88) / 0.045;
      candidates.push({
        id: 'rested_under_eye',
        name: 'Infraorbital Freshness',
        badge: 'Свежесть периорбиты',
        zScore: zUnderEye,
        percentile: calcPct(zUnderEye),
        valueText: `${Math.round(underEyeRatio * 100)}%`,
        impact: '+0.7 к отдохнувшему и свежему взгляду'
      });
    }

    // 9. Female Lips & Philtrum Proportion
    if (gender === 'female' && biometrics.philtrumToChinRatio >= 0.45 && biometrics.philtrumToChinRatio <= 0.55) {
      candidates.push({
        id: 'golden_philtrum',
        name: 'Golden Ratio Lips/Philtrum',
        badge: 'Неотеническая гармония',
        zScore: 1.4,
        percentile: 92,
        valueText: `1:2.0 (${biometrics.philtrumToChinRatio.toFixed(2)})`,
        impact: '+0.8 к привлекательности нижней трети'
      });
    }

    // 10. Glass Skin Texture (Low Texture Variance)
    const zSkin = (13.0 - variance) / 3.0;
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

    // Sort strictly descending by Z-score
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
    // 6. RADAR CHART (6 Macro-Axes Normalized 0 - 100%, Gender-Adaptive)
    // =========================================================================
    // 1. Eye Area: canthal tilt and orbital aesthetics
    const eyeAreaVal = Math.max(25, Math.min(99, Math.round(55 + zCanthal * 14 + zOrbital * 8)));

    // 2. Symmetry: cranial alignment
    const symmetryVal = Math.max(25, Math.min(99, Math.round(55 + zSymmetry * 18)));

    // 3. Skin Quality: derived from skinVarianceScore
    const skinQualityVal = Math.max(20, Math.min(99, Math.round(skinVarianceScore * 10.5)));

    // 4. Contrast: facial Michelson contrast
    const contrastVal = Math.max(25, Math.min(99, Math.round(contrastScore * 10.5)));

    let radarData: RadarMetric[];

    if (gender === 'male') {
      // 5. Midface: compact proportions (compact midface >= 1.00 yields 80 - 99%)
      const midfaceVal = biometrics.midfaceRatio >= 1.00
        ? Math.min(99, Math.round(82 + (biometrics.midfaceRatio - 1.00) * 120))
        : Math.max(25, Math.min(82, Math.round((biometrics.midfaceRatio / 1.00) * 82)));

      // 6. Jawline: bigonial width (wide jaw >= 0.88 yields 82 - 99%)
      const jawlineVal = biometrics.bigonialRatio >= 0.88
        ? Math.min(99, Math.round(82 + (biometrics.bigonialRatio - 0.88) * 160))
        : Math.max(25, Math.min(82, Math.round((biometrics.bigonialRatio / 0.88) * 82)));

      radarData = [
        { subject: 'Eye Area', value: eyeAreaVal, fullMark: 100 },
        { subject: 'Midface', value: midfaceVal, fullMark: 100 },
        { subject: 'Jawline', value: jawlineVal, fullMark: 100 },
        { subject: 'Symmetry', value: symmetryVal, fullMark: 100 },
        { subject: 'Skin Quality', value: skinQualityVal, fullMark: 100 },
        { subject: 'Contrast', value: contrastVal, fullMark: 100 }
      ];
    } else {
      // Female Harmony: Replace masculine Midface/Jawline with Thirds Balance & Lips/Philtrum
      const thirdsVal = Math.max(30, Math.min(99, Math.round(biometrics.facialThirdsBalance.balanceScore * 100)));
      const lipsVal = Math.max(30, Math.min(99, Math.round(88 - Math.abs(biometrics.philtrumToChinRatio - 0.50) * 130)));

      radarData = [
        { subject: 'Eye Area', value: eyeAreaVal, fullMark: 100 },
        { subject: 'Thirds Balance', value: thirdsVal, fullMark: 100 },
        { subject: 'Lips & Philtrum', value: lipsVal, fullMark: 100 },
        { subject: 'Symmetry', value: symmetryVal, fullMark: 100 },
        { subject: 'Skin Quality', value: skinQualityVal, fullMark: 100 },
        { subject: 'Contrast', value: contrastVal, fullMark: 100 }
      ];
    }

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
