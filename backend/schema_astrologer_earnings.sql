-- ─── Astrologer Earning System ──────────────────────────────────────────────

-- Add commission percentage to astrologers
ALTER TABLE astrologers ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC DEFAULT 70;

-- Astrologer Wallet: tracks their total earnings available for withdrawal
CREATE TABLE IF NOT EXISTS astrologer_wallets (
    astrologer_id      UUID PRIMARY KEY REFERENCES astrologers(id),
    balance            NUMERIC DEFAULT 0 CHECK (balance >= 0),
    total_earned       NUMERIC DEFAULT 0,
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Astrologer Earnings Log: record of every commission earned
CREATE TABLE IF NOT EXISTS astrologer_transactions (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    astrologer_id      UUID NOT NULL REFERENCES astrologers(id),
    session_id         UUID REFERENCES sessions(id),
    amount             NUMERIC NOT NULL,     -- The commission amount
    original_price     NUMERIC NOT NULL,     -- The total price user paid
    commission_rate    NUMERIC NOT NULL,     -- The % at the time of transaction
    description        TEXT,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Initialize wallets for existing astrologers
INSERT INTO astrologer_wallets (astrologer_id)
SELECT id FROM astrologers
ON CONFLICT (astrologer_id) DO NOTHING;

-- Enable RLS
ALTER TABLE astrologer_wallets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE astrologer_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on astro wallets"
    ON astrologer_wallets FOR ALL USING (true);

CREATE POLICY "Service role full access on astro transactions"
    ON astrologer_transactions FOR ALL USING (true);
