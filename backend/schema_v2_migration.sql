-- ============================================================
-- AstroJap v2 — Master Migration Script
-- Based on ACTUAL Supabase schema (audited 2026-04-26)
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ASTROLOGERS TABLE — Fix + Add Missing Columns
-- ─────────────────────────────────────────────────────────────

-- CRITICAL FIX: cometchat_uid is NOT NULL in production but we need to
-- allow NULL during signup (it gets set when admin approves the astrologer).
ALTER TABLE astrologers ALTER COLUMN cometchat_uid DROP NOT NULL;

-- Basic auth & contact (from schema_astrologer_enhanced.sql — may already exist)
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS email             TEXT UNIQUE;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS mobile            TEXT UNIQUE;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS password_hash     TEXT;  -- not used (Supabase Auth handles this)

-- Professional profile
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS experience_years  INTEGER DEFAULT 0;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS expertise         TEXT[];  -- ['Love', 'Career', 'Finance']
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS languages         TEXT[];  -- ['Hindi', 'English']
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS bio               TEXT;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS specialization    TEXT[];  -- ['Vedic', 'Tarot']

-- Document verification
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS govt_id_url       TEXT;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS selfie_url        TEXT;

-- Bank / payout details
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS bank_account_name   TEXT;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS ifsc_code           TEXT;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS upi_id              TEXT;

-- Admin governance
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS approval_status    TEXT DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS rejection_reason    TEXT;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS admin_notes         TEXT;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS shopify_customer_id TEXT UNIQUE;

-- Ratings & metrics
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS rating             NUMERIC DEFAULT 5.0;
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS total_sessions     INTEGER DEFAULT 0;

-- Availability control (Phase 2)
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS is_accepting_bookings BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 2. SESSIONS TABLE — New Columns for Scheduled Sessions
-- ─────────────────────────────────────────────────────────────

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS slot_id       UUID;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scheduled_at  TIMESTAMP WITH TIME ZONE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS type          TEXT DEFAULT 'instant'
  CHECK (type IN ('instant', 'scheduled'));

-- ─────────────────────────────────────────────────────────────
-- 3. SLOTS TABLE — Next-Day Booking Availability
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS slots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  astrologer_id UUID REFERENCES astrologers(id) ON DELETE CASCADE,
  start_time    TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time      TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_min  INTEGER NOT NULL CHECK (duration_min IN (20, 60)),
  status        TEXT DEFAULT 'available'
    CHECK (status IN ('available', 'booked', 'blocked')),
  session_id    UUID REFERENCES sessions(id),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slots_astro_time
  ON slots(astrologer_id, start_time);

ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'slots' AND policyname = 'Service role full access on slots'
  ) THEN
    CREATE POLICY "Service role full access on slots"
      ON slots FOR ALL USING (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. PAYOUTS TABLE — Astrologer Withdrawal Requests
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payouts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  astrologer_id  UUID REFERENCES astrologers(id) ON DELETE CASCADE,
  amount         NUMERIC NOT NULL,
  status         TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  requested_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at   TIMESTAMP WITH TIME ZONE,
  admin_notes    TEXT,
  upi_id         TEXT,
  bank_account   TEXT
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payouts' AND policyname = 'Service role full access on payouts'
  ) THEN
    CREATE POLICY "Service role full access on payouts"
      ON payouts FOR ALL USING (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 5. REVIEWS TABLE — Post-Session Star Ratings
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID REFERENCES sessions(id) UNIQUE,
  astrologer_id UUID REFERENCES astrologers(id) ON DELETE CASCADE,
  customer_id   TEXT NOT NULL,
  rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Service role full access on reviews'
  ) THEN
    CREATE POLICY "Service role full access on reviews"
      ON reviews FOR ALL USING (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 6. ATOMIC SLOT BOOKING FUNCTION
-- Prevents double-booking race conditions using FOR UPDATE lock.
-- NOTE: astrologer_wallets and wallets already exist in production.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION book_slot_atomic(
  p_slot_id     UUID,
  p_session_id  UUID,
  p_user_id     TEXT,
  p_astro_id    UUID,
  p_price       NUMERIC,
  p_description TEXT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_slot          slots%ROWTYPE;
  v_user_balance  NUMERIC;
BEGIN
  -- Lock the slot row to prevent concurrent bookings
  SELECT * INTO v_slot FROM slots WHERE id = p_slot_id FOR UPDATE;

  IF v_slot IS NULL THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;

  -- Guard: slot must still be available
  IF v_slot.status != 'available' THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE: This slot has already been booked.';
  END IF;

  -- Guard: start_time must be tomorrow or later (T+1 rule enforced at DB level)
  IF v_slot.start_time < (CURRENT_DATE + INTERVAL '1 day') THEN
    RAISE EXCEPTION 'SLOT_TOO_SOON: Only next-day or future bookings are allowed.';
  END IF;

  -- Debit user wallet atomically (wallets table already exists in production)
  UPDATE wallets
    SET balance    = balance - p_price,
        updated_at = now()
    WHERE shopify_customer_id = p_user_id
      AND balance >= p_price
    RETURNING balance INTO v_user_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  -- Log user wallet transaction (wallet_transactions table already exists)
  INSERT INTO wallet_transactions
    (shopify_customer_id, amount, type, description, reference_id, balance_after)
  VALUES
    (p_user_id, -p_price, 'debit', p_description, p_session_id::TEXT, v_user_balance);

  -- Credit astrologer wallet
  -- astrologer_wallets and astrologer_transactions already exist in production
  UPDATE astrologer_wallets
    SET balance     = balance + p_price,
        total_earned = total_earned + p_price,
        updated_at   = now()
    WHERE astrologer_id = p_astro_id;

  INSERT INTO astrologer_transactions
    (astrologer_id, session_id, amount, original_price, commission_rate, description, balance_after)
  SELECT
    p_astro_id,
    p_session_id,
    p_price,
    p_price,
    COALESCE((SELECT commission_percentage FROM astrologers WHERE id = p_astro_id), 70),
    p_description,
    balance
  FROM astrologer_wallets WHERE astrologer_id = p_astro_id;

  -- Mark slot as booked
  UPDATE slots
    SET status     = 'booked',
        session_id = p_session_id
    WHERE id = p_slot_id;

  RETURN json_build_object(
    'success',      true,
    'user_balance', v_user_balance,
    'slot_id',      p_slot_id,
    'session_id',   p_session_id
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. ASTROLOGER EARNINGS VIEW
-- Uses ACTUAL column names from production astrologer_transactions table.
-- NOTE: astrologer_transactions has no 'type' column — all rows are credits.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW astrologer_earnings_summary AS
SELECT
  a.id                                                        AS astrologer_id,
  a.name,
  COALESCE(w.balance, 0)                                      AS wallet_balance,
  COALESCE(w.total_earned, 0)                                 AS total_earned,  -- use pre-computed column
  COUNT(s.id) FILTER (WHERE s.status = 'completed')           AS total_sessions,
  COALESCE(
    SUM(t.amount) FILTER (WHERE t.created_at >= CURRENT_DATE),
    0
  )                                                           AS today_earnings,
  COALESCE(
    SUM(t.amount) FILTER (WHERE t.created_at >= date_trunc('week', CURRENT_TIMESTAMP)),
    0
  )                                                           AS week_earnings
FROM astrologers a
LEFT JOIN astrologer_wallets     w  ON w.astrologer_id = a.id
LEFT JOIN sessions               s  ON s.astrologer_id = a.id
LEFT JOIN astrologer_transactions t ON t.astrologer_id = a.id
GROUP BY a.id, a.name, w.balance, w.total_earned;

-- ─────────────────────────────────────────────────────────────
-- Migration complete ✅
-- ─────────────────────────────────────────────────────────────
