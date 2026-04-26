-- ─── Wallet System Schema ────────────────────────────────────────────────────
-- Add these tables to your existing Supabase schema

-- Wallet: one row per customer, holds their current balance
CREATE TABLE IF NOT EXISTS wallets (
    shopify_customer_id TEXT PRIMARY KEY,
    balance             NUMERIC DEFAULT 0 CHECK (balance >= 0),
    currency            TEXT DEFAULT 'INR',
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Wallet Transactions: full audit log of every credit and debit
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shopify_customer_id TEXT NOT NULL,
    amount              NUMERIC NOT NULL,                  -- positive = credit, negative = debit
    type                TEXT CHECK (type IN ('credit', 'debit')),
    description         TEXT,
    reference_id        TEXT,                             -- session_id or shopify_order_id
    balance_after       NUMERIC,                          -- snapshot of balance after this transaction
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE wallets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions  ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (your backend uses service role key)
CREATE POLICY "Service role full access on wallets"
    ON wallets FOR ALL USING (true);

CREATE POLICY "Service role full access on wallet_transactions"
    ON wallet_transactions FOR ALL USING (true);

-- ─── Atomic Wallet Debit Function ────────────────────────────────────────────
-- Called by the backend to debit wallet without race conditions.
-- Returns the new balance on success, raises an exception if insufficient.

CREATE OR REPLACE FUNCTION debit_wallet(
    p_customer_id  TEXT,
    p_amount       NUMERIC,
    p_description  TEXT,
    p_reference_id TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    -- Lock the wallet row and deduct atomically
    UPDATE wallets
    SET    balance    = balance - p_amount,
           updated_at = now()
    WHERE  shopify_customer_id = p_customer_id
      AND  balance >= p_amount
    RETURNING balance INTO v_new_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    -- Record the transaction
    INSERT INTO wallet_transactions
        (shopify_customer_id, amount, type, description, reference_id, balance_after)
    VALUES
        (p_customer_id, -p_amount, 'debit', p_description, p_reference_id, v_new_balance);

    RETURN v_new_balance;
END;
$$;
