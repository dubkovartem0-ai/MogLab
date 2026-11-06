import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { BiometricMetrics, GenderMode, LandmarkPoint } from '../types/biometrics';

export class BiometricsService {
  private static videoLandmarker: FaceLandmarker | null = null;
  private static imageLandmarker: FaceLandmarker | null = null;
  private static isInitializingVideo = false;
  private static isInitializingImage = false;
  private static visionResolverPromise: Promise<any> | null = null;

  private static getVisionResolver() {
    if (!this.visionResolverPromise) {
      this.visionResolverPromise = FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
    }
    return this.visionResolverPromise;
  }

  /**
   * Retrieves or initializes FaceLandmarker with guaranteed runningMode ('VIDEO' or 'IMAGE')
   */
  public static async getLandmarker(runningMode: 'VIDEO' | 'IMAGE' = 'VIDEO'): Promise<FaceLandmarker> {
    if (runningMode === 'IMAGE') {
      return this.getImageLandmarker();
    }
    return this.getVideoLandmarker();
  }

  public static async getImageLandmarker(): Promise<FaceLandmarker> {
    if (this.imageLandmarker) {
      return this.imageLandmarker;
    }

    if (this.isInitializingImage) {
      while (this.isInitializingImage) {
        await new Promise(r => setTimeout(r, 50));
      }
      if (this.imageLandmarker) return this.imageLandmarker;
    }

    this.isInitializingImage = true;
    try {
      const vision = await this.getVisionResolver();
      const modelAssetPath =
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

      try {
        this.imageLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'GPU'
          },
          runningMode: 'IMAGE',
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false
        });
      } catch (err) {
        console.warn('GPU delegate failed for IMAGE FaceLandmarker, falling back to CPU:', err);
        this.imageLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'CPU'
          },
          runningMode: 'IMAGE',
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false
        });
      }

      return this.imageLandmarker;
    } finally {
      this.isInitializingImage = false;
    }
  }

  public static async getVideoLandmarker(): Promise<FaceLandmarker> {
    if (this.videoLandmarker) {
      return this.videoLandmarker;
    }

    if (this.isInitializingVideo) {
      while (this.isInitializingVideo) {
        await new Promise(r => setTimeout(r, 50));
      }
      if (this.videoLandmarker) return this.videoLandmarker;
    }

    this.isInitializingVideo = true;
    try {
      const vision = await this.getVisionResolver();
      const modelAssetPath =
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

      try {
        this.videoLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false
        });
      } catch (err) {
        console.warn('GPU delegate failed for VIDEO FaceLandmarker, falling back to CPU:', err);
        this.videoLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false
        });
      }

      return this.videoLandmarker;
    } finally {
      this.isInitializingVideo = false;
    }
  }

  /**
   * Euclidean distance between two 3D or 2D landmark points
   */
  public static distance(p1: LandmarkPoint, p2: LandmarkPoint, useZ = false): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    if (useZ) {
      const dz = (p1.z || 0) - (p2.z || 0);
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculates comprehensive male and female biometrics from 478 landmarks
   */
  public static calculateMetrics(
    landmarks: LandmarkPoint[],
    gender: GenderMode
  ): BiometricMetrics {
    // Key landmark indices:
    // Left eye: medial 133, lateral 33, pupil 468
    // Right eye: medial 362, lateral 263, pupil 473
    // Zygomas (cheekbones): left 234, right 454
    // Gonions (jaw angles): left 172, right 397 (or 58/288)
    // Forehead/Trichion: 10
    // Glabella/Brow: 9 or 168
    // Subnasale: 2
    // Stomion/Upper lip: 0, 13
    // Lower lip: 14, 17
    // Menton/Chin tip: 152

    const p133 = landmarks[133];
    const p33 = landmarks[33];
    const p362 = landmarks[362];
    const p263 = landmarks[263];
    const p468 = landmarks[468] || { x: (p133.x + p33.x) / 2, y: (p133.y + p33.y) / 2, z: 0 };
    const p473 = landmarks[473] || { x: (p362.x + p263.x) / 2, y: (p362.y + p263.y) / 2, z: 0 };

    const pZygL = landmarks[234];
    const pZygR = landmarks[454];
    const pGonL = landmarks[172] || landmarks[58];
    const pGonR = landmarks[397] || landmarks[288];

    const p10 = landmarks[10];
    const pGlabella = landmarks[9] || landmarks[168];
    const pSubnasale = landmarks[2];
    const pUpperLip = landmarks[0] || landmarks[13];
    const pLowerLip = landmarks[17] || landmarks[14];
    const pChin = landmarks[152];

    // 1. Canthal Tilt
    // Lateral canthus relative to medial canthus
    // In canvas coords, Y goes down, so negative deltaY means lateral is higher (positive tilt)
    const leftTiltRad = Math.atan2(p133.y - p33.y, p133.x - p33.x); // left eye
    const rightTiltRad = Math.atan2(p362.y - p263.y, p263.x - p362.x); // right eye
    const leftTiltDeg = (leftTiltRad * 180) / Math.PI;
    const rightTiltDeg = (rightTiltRad * 180) / Math.PI;
    const canthalTiltDegrees = Math.round(((leftTiltDeg + rightTiltDeg) / 2) * 10) / 10;

    // 2. Central Symmetry Index (Perpendicular distance to Glabella-Menton midline)
    // Invariant to head tilt / roll angles
    const lineDx = pChin.x - pGlabella.x;
    const lineDy = pChin.y - pGlabella.y;
    const lineLen = Math.hypot(lineDx, lineDy) || 1;

    const bilateralPairs = [
      [33, 263], [133, 362], [234, 454], [172, 397],
      [70, 300], [105, 334], [61, 291], [116, 345]
    ];
    let sumSymmetryDev = 0;
    bilateralPairs.forEach(([idxL, idxR]) => {
      const ptL = landmarks[idxL];
      const ptR = landmarks[idxR];

      // Perpendicular signed distance to midline line
      const distL = Math.abs(lineDx * (pGlabella.y - ptL.y) - (pGlabella.x - ptL.x) * lineDy) / lineLen;
      const distR = Math.abs(lineDx * (pGlabella.y - ptR.y) - (pGlabella.x - ptR.x) * lineDy) / lineLen;

      const diff = Math.abs(distL - distR) / Math.max(distL, distR, 0.01);
      sumSymmetryDev += diff;
    });
    const avgDev = sumSymmetryDev / bilateralPairs.length;
    // High-precision symmetry index (0.75 - 0.95 for normal faces)
    const centralSymmetryIndex = Math.max(0.35, Math.min(0.98, Math.round((1 - avgDev * 1.25) * 100) / 100));

    // 3. Bizygomatic Width
    const bizygomaticWidth = this.distance(pZygL, pZygR);

    // 4. Male metrics (PSL Engine)
    // FWHR: Bizygomatic Width / (Brow to Upper Lip in 3D to resist pitch tilt)
    const browToUpperLip3D = Math.sqrt(
      Math.pow(pUpperLip.x - pGlabella.x, 2) +
      Math.pow(pUpperLip.y - pGlabella.y, 2) +
      Math.pow((pUpperLip.z || 0) - (pGlabella.z || 0), 2)
    );
    const rawFwhr = browToUpperLip3D > 0 ? bizygomaticWidth / browToUpperLip3D : 1.85;
    const fwhr = Math.round(Math.min(2.15, Math.max(1.55, rawFwhr)) * 100) / 100;

    // Bigonial Ratio: Bigonial Width / Bizygomatic Width
    const bigonialWidth = this.distance(pGonL, pGonR);
    const bigonialRatio = bizygomaticWidth > 0
      ? Math.round((bigonialWidth / bizygomaticWidth) * 100) / 100
      : 0.88;

    // Jaw Frontal Angle (angle of jaw slant towards chin)
    const jawAngleLeft = Math.atan2(Math.abs(pChin.y - pGonL.y), Math.abs(pChin.x - pGonL.x)) * (180 / Math.PI);
    const jawAngleRight = Math.atan2(Math.abs(pChin.y - pGonR.y), Math.abs(pChin.x - pGonR.x)) * (180 / Math.PI);
    const jawFrontalAngle = Math.round((jawAngleLeft + jawAngleRight) / 2);

    // Interpupillary Distance (IPD)
    const ipd = this.distance(p468, p473);

    // Orbital Depth (Deep-set eyes vs Brow Ridge projection in 3D)
    // Positive values indicate eyes are set deeper than the supraorbital ridge (Hunter trait)
    const browL = landmarks[105] || landmarks[70];
    const browR = landmarks[334] || landmarks[300];
    const depthL = (p468.z || 0) - (browL.z || 0);
    const depthR = (p473.z || 0) - (browR.z || 0);
    const rawOrbitalDepth = (depthL + depthR) / 2;
    const orbitalDepth = ipd > 0
      ? Math.round((rawOrbitalDepth / ipd) * 1000) / 1000
      : 0.08;

    // Midface Ratio: IPD / Midface Height (pupils to subnasale in 3D)
    // Clamped strictly to realistic human anthropometric limits (0.80 - 1.18)
    const midPupilX = (p468.x + p473.x) / 2;
    const midPupilY = (p468.y + p473.y) / 2;
    const midPupilZ = ((p468.z || 0) + (p473.z || 0)) / 2;
    const midfaceHeight3D = Math.sqrt(
      Math.pow(pSubnasale.x - midPupilX, 2) +
      Math.pow(pSubnasale.y - midPupilY, 2) +
      Math.pow((pSubnasale.z || 0) - midPupilZ, 2)
    );
    const rawMidfaceRatio = midfaceHeight3D > 0 ? ipd / midfaceHeight3D : 1.0;
    const midfaceRatio = Math.round(Math.min(1.18, Math.max(0.80, rawMidfaceRatio)) * 100) / 100;

    // ESR (Eye Separation Ratio): IPD / Bizygomatic width
    const esr = bizygomaticWidth > 0
      ? Math.round((ipd / bizygomaticWidth) * 100) / 100
      : 0.46;

    // 5. Female metrics (Harmony Engine)
    // Facial Thirds Balance (Forehead -> Brow -> Subnasale -> Chin)
    const upperThird = Math.abs(pGlabella.y - p10.y);
    const middleThird = Math.abs(pSubnasale.y - pGlabella.y);
    const lowerThird = Math.abs(pChin.y - pSubnasale.y);
    const totalThirds = upperThird + middleThird + lowerThird || 1;

    const uPct = Math.round((upperThird / totalThirds) * 100);
    const mPct = Math.round((middleThird / totalThirds) * 100);
    const lPct = 100 - uPct - mPct;

    // Harmony balance score (deviation from ideal 33.3%)
    const thirdsVariance =
      Math.abs(uPct - 33.3) + Math.abs(mPct - 33.3) + Math.abs(lPct - 33.3);
    const thirdsBalanceScore = Math.max(0, Math.min(1, Math.round((1 - thirdsVariance / 40) * 100) / 100));

    // Ogee Curve Prominence (Zygoma curvature vs cheekbone depth)
    const pMalarL = landmarks[116] || pZygL;
    const ogeeCurveProminence = Math.round(Math.min(1, Math.max(0.5, (bizygomaticWidth / (bigonialWidth || 1)) * 0.8)) * 100) / 100;

    // Lip Ratio: Upper lip to Lower lip height
    const upperLipH = Math.abs(landmarks[13]?.y - landmarks[0]?.y) || 0.02;
    const lowerLipH = Math.abs(landmarks[17]?.y - landmarks[14]?.y) || 0.03;
    const lipRatio = Math.round((upperLipH / lowerLipH) * 100) / 100;

    // Philtrum to Chin: (Subnasale to Upper Lip) / (Lower Lip to Chin)
    const philtrumH = Math.abs(pUpperLip.y - pSubnasale.y) || 0.03;
    const chinH = Math.abs(pChin.y - pLowerLip.y) || 0.06;
    const philtrumToChinRatio = Math.round((philtrumH / chinH) * 100) / 100;

    return {
      canthalTiltDegrees,
      centralSymmetryIndex,
      orbitalDepth,
      fwhr,
      bigonialRatio,
      jawFrontalAngle,
      midfaceRatio,
      esr,
      facialThirdsBalance: {
        upper: uPct,
        middle: mPct,
        lower: lPct,
        balanceScore: thirdsBalanceScore
      },
      ogeeCurveProminence,
      lipRatio,
      philtrumToChinRatio
    };
  }
}
