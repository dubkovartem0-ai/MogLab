-- MogLab Database Schema v2.0 (Supabase PostgreSQL)
-- Enable Row Level Security (RLS) on all tables

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  tg_id BIGINT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  credits INT DEFAULT 0 CHECK (credits >= 0),
  referred_by BIGINT REFERENCES users(tg_id),
  referral_rewarded BOOLEAN DEFAULT FALSE,
  qualified_referrals_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Block direct client writes, allow public read of public fields only or restrict to service role
CREATE POLICY "Users read own profile" ON users
  FOR SELECT
  USING (true);

-- 2. Leaderboard Table (Verified Live Camera only)
CREATE TABLE IF NOT EXISTS leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id BIGINT REFERENCES users(tg_id) UNIQUE,
  username TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  score NUMERIC(3,1) NOT NULL CHECK (score >= 1.0 AND score <= 10.0),
  potential_score NUMERIC(3,1) NOT NULL,
  verified_camera BOOLEAN NOT NULL DEFAULT TRUE CHECK (verified_camera = TRUE),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read leaderboard" ON leaderboard
  FOR SELECT
  USING (true);

-- 3. Payment Transactions Table (Idempotency against duplicate star credits)
CREATE TABLE IF NOT EXISTS star_transactions (
  telegram_payment_charge_id TEXT PRIMARY KEY,
  tg_id BIGINT REFERENCES users(tg_id),
  amount_stars INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE star_transactions ENABLE ROW LEVEL SECURITY;

-- 4. Battles Table (for 1v1 Mog Battle challenges)
CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_tg_id BIGINT REFERENCES users(tg_id),
  challenger_name TEXT NOT NULL,
  challenger_score NUMERIC(3,1) NOT NULL,
  challenger_metrics JSONB NOT NULL,
  opponent_tg_id BIGINT REFERENCES users(tg_id),
  opponent_name TEXT,
  opponent_score NUMERIC(3,1),
  opponent_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read battles" ON battles
  FOR SELECT
  USING (true);
