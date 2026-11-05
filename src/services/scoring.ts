import {
  BiometricMetrics,
  BiometricReport,
  GenderMode,
  HaloItem,
  PixelColorMetrics,
  RadarMetric
} from '../types/biometrics';

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
    // 1. Calculate Bone Base Score (1.0 to 10.0)
    let boneScore = 5.0;

    if (gender === 'male') {
      // Ideal FWHR: ~1.85 to 2.05
      const fwhrScore = 10 - Math.min(5, Math.abs(biometrics.fwhr - 1.95) * 12);
      // Ideal Bigonial Ratio: ~0.88 to 0.94
      const jawScore = 10 - Math.min(5, Math.abs(biometrics.bigonialRatio - 0.91) * 20);
      // Ideal Midface: ~0.98 to 1.05
      const midfaceScore = 10 - Math.min(5, Math.abs(biometrics.midfaceRatio - 1.0) * 15);
      // Ideal Canthal Tilt: +2.0° to +5.0°
      const tiltScore = biometrics.canthalTiltDegrees >= 2.0
        ? Math.min(10, 7.5 + biometrics.canthalTiltDegrees * 0.6)
        : Math.max(3, 7.0 + biometrics.canthalTiltDegrees * 0.8);
      // Symmetry
      const symScore = biometrics.centralSymmetryIndex * 10;

      boneScore = (fwhrScore * 0.25 + jawScore * 0.25 + midfaceScore * 0.2 + tiltScore * 0.15 + symScore * 0.15);
    } else {
      // Female Harmony Engine
      // Facial Thirds Balance
      const thirdsScore = biometrics.facialThirdsBalance.balanceScore * 10;
      // Ogee Curve
      const ogeeScore = biometrics.ogeeCurveProminence * 10;
      // Canthal Tilt (feline positive tilt favored)
      const tiltScore = biometrics.canthalTiltDegrees >= 3.0
        ? Math.min(10, 8.0 + biometrics.canthalTiltDegrees * 0.5)
        : Math.max(3, 7.0 + biometrics.canthalTiltDegrees * 0.7);
      // Philtrum to chin (ideal 1:2 or 0.5)
      const philtrumScore = 10 - Math.min(5, Math.abs(biometrics.philtrumToChinRatio - 0.5) * 12);
      // Symmetry
      const symScore = biometrics.centralSymmetryIndex * 10;

      boneScore = (thirdsScore * 0.25 + ogeeScore * 0.2 + tiltScore * 0.2 + philtrumScore * 0.15 + symScore * 0.2);
    }

    boneScore = Math.max(2.5, Math.min(9.8, boneScore));

    // 2. Calculate Appeal Score (1.0 to 10.0) from skin texture, erythema & facial contrast
    // Skin variance: ideal < 10 (glass skin), > 22 is textured/uneven
    const skinVarianceScore = Math.max(2, Math.min(10, 10 - (colorimetry.skinLuminanceVariance - 8) * 0.5));
    // Redness index: ideal ~1.05 to 1.15, > 1.3 is inflammation/redness
    const rednessScore = Math.max(2, Math.min(10, 10 - Math.max(0, colorimetry.skinRednessIndex - 1.15) * 18));
    // Facial contrast: ideal > 0.25 (high contrast), < 0.18 is washed out
    const contrastScore = Math.max(2, Math.min(10, colorimetry.overallFacialContrast * 32));

    const appealScore = Math.max(2.0, Math.min(9.5, (skinVarianceScore * 0.4 + rednessScore * 0.3 + contrastScore * 0.3)));

    // 3. Current Score (Combined 60% Bone Structure, 40% Appeal)
    let currentScore = Math.round((boneScore * 0.6 + appealScore * 0.4) * 10) / 10;
    currentScore = Math.max(1.0, Math.min(9.9, currentScore));

    // 4. Potential Score (Achieved when Appeal reaches max potential 8.8 - 9.5)
    const potentialAppeal = Math.max(8.5, appealScore + 2.0);
    let potentialScore = Math.round((boneScore * 0.6 + potentialAppeal * 0.4) * 10) / 10;
    potentialScore = Math.max(currentScore + 0.6, Math.min(9.9, potentialScore));

    // 5. Tier classification
    let currentTier = 'MTN';
    if (gender === 'male') {
      if (currentScore < 4.0) currentTier = 'Subhuman';
      else if (currentScore < 5.0) currentTier = 'LTN (Low Tier Normie)';
      else if (currentScore < 6.0) currentTier = 'MTN (Mid Tier Normie)';
      else if (currentScore < 7.0) currentTier = 'HTN (High Tier Normie)';
      else if (currentScore < 8.2) currentTier = 'Chadlite';
      else currentTier = 'Chad';
    } else {
      if (currentScore < 4.0) currentTier = 'Sub-tier';
      else if (currentScore < 5.0) currentTier = 'LTN (Low Tier)';
      else if (currentScore < 6.0) currentTier = 'MTN (Mid Tier)';
      else if (currentScore < 7.0) currentTier = 'HTN (High Tier)';
      else if (currentScore < 8.2) currentTier = 'Stacylite';
      else currentTier = 'Stacy';
    }

    // 6. Halos Discovery (Top 2 highest percentile features)
    const candidates: HaloItem[] = [];

    // Check Canthal Tilt
    if (biometrics.canthalTiltDegrees > 1.0) {
      const pct = Math.min(99, Math.round(75 + biometrics.canthalTiltDegrees * 4.5));
      candidates.push({
        id: 'canthal_tilt',
        name: 'Positive Canthal Tilt',
        badge: 'Hunter Eyes Area',
        percentile: pct,
        valueText: `+${biometrics.canthalTiltDegrees.toFixed(1)}°`,
        impact: '+0.6 к эстетике орбитальной зоны'
      });
    }

    // Check FWHR
    if (gender === 'male' && biometrics.fwhr >= 1.82 && biometrics.fwhr <= 2.10) {
      candidates.push({
        id: 'fwhr',
        name: 'Оптимальный FWHR',
        badge: 'Маскулинная база',
        percentile: 94,
        valueText: `${biometrics.fwhr.toFixed(2)}`,
        impact: '+0.8 к плотности лицевой геометрии'
      });
    }

    // Check Facial Contrast
    if (colorimetry.overallFacialContrast >= 0.23) {
      const pct = Math.min(98, Math.round(70 + colorimetry.overallFacialContrast * 90));
      candidates.push({
        id: 'contrast',
        name: 'High Facial Contrast',
        badge: 'Свет и пигментация',
        percentile: pct,
        valueText: `${Math.round(colorimetry.overallFacialContrast * 100)}%`,
        impact: '+0.7 к выразительности взгляда'
      });
    }

    // Check Symmetry
    if (biometrics.centralSymmetryIndex >= 0.88) {
      candidates.push({
        id: 'symmetry',
        name: 'Central Symmetry Index',
        badge: 'Краниальная гармония',
        percentile: Math.min(99, Math.round(biometrics.centralSymmetryIndex * 100)),
        valueText: `${Math.round(biometrics.centralSymmetryIndex * 100)}%`,
        impact: '+0.5 к пропорциональности'
      });
    }

    // Check Female Thirds or Midface
    if (gender === 'female' && biometrics.facialThirdsBalance.balanceScore >= 0.85) {
      candidates.push({
        id: 'thirds',
        name: 'Facial Thirds Balance',
        badge: 'Идеальные трети',
        percentile: 92,
        valueText: `${biometrics.facialThirdsBalance.upper}% / ${biometrics.facialThirdsBalance.middle}% / ${biometrics.facialThirdsBalance.lower}%`,
        impact: '+0.9 к неотении и гармонии'
      });
    }

    // Fallback candidates if fewer than 2
    if (candidates.length < 2) {
      candidates.push({
        id: 'jaw_base',
        name: 'Gonial Harmony',
        badge: 'Костная структура',
        percentile: 86,
        valueText: `${biometrics.bigonialRatio.toFixed(2)} Ratio`,
        impact: '+0.4 к четкости овала'
      });
    }
    if (candidates.length < 2) {
      candidates.push({
        id: 'skin_lum',
        name: 'Even Luminance Tone',
        badge: 'Уход за кожей',
        percentile: 84,
        valueText: `${colorimetry.skinLuminanceAvg} Lum`,
        impact: '+0.3 к свежести Appeal'
      });
    }

    // Sort descending by percentile and take top 2
    candidates.sort((a, b) => b.percentile - a.percentile);
    const halos = candidates.slice(0, 2);

    // 7. Radar Chart 6-axis Data (0 to 100)
    const eyeAreaVal = Math.min(100, Math.round((Math.max(0, biometrics.canthalTiltDegrees + 5) / 12) * 100));
    const midfaceVal = gender === 'male'
      ? Math.min(100, Math.round((1 - Math.min(0.3, Math.abs(biometrics.midfaceRatio - 1.0))) * 100))
      : Math.min(100, Math.round(biometrics.facialThirdsBalance.balanceScore * 100));
    const jawlineVal = Math.min(100, Math.round((biometrics.bigonialRatio / 1.0) * 95));
    const symmetryVal = Math.min(100, Math.round(biometrics.centralSymmetryIndex * 100));
    const skinQualityVal = Math.min(100, Math.round(Math.max(20, 100 - (colorimetry.skinLuminanceVariance - 5) * 4)));
    const contrastVal = Math.min(100, Math.round(Math.min(1, colorimetry.overallFacialContrast / 0.35) * 100));

    const radarData: RadarMetric[] = [
      { subject: 'Eye Area', value: eyeAreaVal, fullMark: 100 },
      { subject: 'Midface', value: midfaceVal, fullMark: 100 },
      { subject: 'Jawline', value: jawlineVal, fullMark: 100 },
      { subject: 'Symmetry', value: symmetryVal, fullMark: 100 },
      { subject: 'Skin Quality', value: skinQualityVal, fullMark: 100 },
      { subject: 'Contrast', value: contrastVal, fullMark: 100 }
    ];

    // 8. Failos & Debuff calculations for Paywall Hook
    const debuff = Math.round((potentialScore - currentScore) * 10) / 10;
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
