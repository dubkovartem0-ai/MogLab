export type GenderMode = 'male' | 'female';

export interface EulerAngles {
  pitch: number; // up/down
  yaw: number;   // left/right
  roll: number;  // tilt sideways
}

export interface GatekeeperStatus {
  luminance: number; // 0..255 (ideal 65..220)
  bilateralDiff: number; // 0..1 (diff <= 18%)
  distanceRatio: number; // 0..1 (ideal 25%..52% of frame width)
  eulerAngles: EulerAngles;
  isLuminanceOk: boolean;
  isLightingOk: boolean;
  isDistanceOk: boolean;
  isPoseOk: boolean;
  canScan: boolean;
  errorMessage?: string;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface BiometricMetrics {
  // Common
  canthalTiltDegrees: number;
  centralSymmetryIndex: number; // 0..1 (1 is perfect symmetry)
  orbitalDepth: number; // 3D relative depth of pupils vs brow ridge (higher = deeper-set eyes)
  
  // Male (PSL Engine)
  fwhr: number; // Facial Width-to-Height Ratio (~1.8 - 2.0 ideal)
  bigonialRatio: number; // Jaw width to bizygomatic width (~0.85 - 0.95 ideal)
  jawFrontalAngle: number; // Degrees of jaw convergence (~85 - 95 ideal)
  midfaceRatio: number; // IPD / midface height (~0.95 - 1.05 ideal)
  esr: number; // Eye Separation Ratio (~0.45 - 0.50 ideal)
  
  // Female (Harmony Engine)
  facialThirdsBalance: {
    upper: number; // percentage
    middle: number;
    lower: number;
    balanceScore: number; // 0..1
  };
  ogeeCurveProminence: number; // 0..1
  lipRatio: number; // upper to lower lip height (ideal ~1:1.6 to 1:1.4)
  philtrumToChinRatio: number; // philtrum height to chin height (ideal ~1:2)
}

export interface PixelColorMetrics {
  whiteBalanceCorrection: { r: number; g: number; b: number };
  skinRednessIndex: number; // ratio of R to G+B
  skinLuminanceVariance: number; // std dev in cheek (lower is smoother)
  skinLuminanceAvg: number;
  eyebrowContrast: number; // Michelson contrast (0..1)
  lipContrast: number; // Michelson contrast (0..1)
  overallFacialContrast: number; // Average feature-to-skin contrast (0..1)
  underEyeDarknessRatio: number; // Tear trough / under-eye vs cheek luminance (1.0 = equal, <0.88 = dark circles)
  fitzpatrickEstimate: string; // 'Type I' .. 'Type VI'
}

export interface HaloItem {
  id: string;
  name: string;
  badge: string;
  percentile: number; // e.g. 96 (Top 4%)
  valueText: string;
  impact: string;
}

export interface FailoItem {
  id: string;
  title: string;
  penalty: number; // e.g. -0.7
  explanation: string;
}

export interface SoftmaxxingPlan {
  hairstyle: {
    recommended_style: string;
    reasoning: string;
    products: string[];
  };
  grooming_and_contrast: {
    actions: string[];
  };
  skin_and_debloating: {
    need_debloating: boolean;
    actions: string[];
  };
}

export interface RadarMetric {
  subject: string;
  value: number; // 0..100
  fullMark: 100;
}

export interface BiometricReport {
  id: string;
  timestamp: number;
  gender: GenderMode;
  verifiedCamera: boolean;
  
  // Scores
  currentTier: string; // Subhuman, LTN, MTN, HTN, Chadlite, Chad (or Female equiv)
  currentScore: number; // 1.0 .. 10.0
  potentialScore: number; // 1.0 .. 10.0
  boneBaseScore: number; // 1.0 .. 10.0
  appealScore: number; // 1.0 .. 10.0
  
  // Highlighting
  halos: HaloItem[];
  radarData: RadarMetric[];
  
  // Under paywall
  failosCount: number;
  totalDebuffPenalty: number;
  
  // Raw anonymous metrics sent to Gemini (NO photos)
  extractedProfile: {
    gender: GenderMode;
    biometrics: BiometricMetrics;
    colorimetry: PixelColorMetrics;
  };
  
  // Unlocked PRO payload (null if not unlocked yet)
  proDetails?: {
    failos: FailoItem[];
    softmaxxingPlan: SoftmaxxingPlan;
  };
}
