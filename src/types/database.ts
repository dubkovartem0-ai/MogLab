import { RadarMetric } from './biometrics';

export interface DbUser {
  tg_id: number;
  username: string | null;
  first_name: string | null;
  credits: number;
  referred_by: number | null;
  referral_rewarded: boolean;
  qualified_referrals_count: number;
  created_at?: string;
}

export interface DbLeaderboardEntry {
  id: string;
  tg_id: number;
  username: string;
  gender: 'male' | 'female';
  score: number;
  potential_score: number;
  verified_camera: boolean;
  updated_at?: string;
}

export interface DbStarTransaction {
  telegram_payment_charge_id: string;
  tg_id: number;
  amount_stars: number;
  created_at?: string;
}

export interface DbBattle {
  id: string;
  challenger_tg_id: number;
  challenger_name: string;
  challenger_score: number;
  challenger_metrics: {
    radar: RadarMetric[];
    boneBase: number;
    appeal: number;
  };
  opponent_tg_id?: number | null;
  opponent_name?: string | null;
  opponent_score?: number | null;
  opponent_metrics?: {
    radar: RadarMetric[];
    boneBase: number;
    appeal: number;
  } | null;
  created_at?: string;
}
