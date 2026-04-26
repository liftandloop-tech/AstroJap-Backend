-- ─── Atomic Session Payment Processor (The Marketplace Engine) ───────────────
-- This function handles the complex "Debit User / Credit Astrologer" logic
-- in a single database transaction to ensure no money is ever lost.

CREATE OR REPLACE FUNCTION process_session_payment(
    p_user_id         TEXT,
    p_astro_id        UUID,
    p_session_id      UUID,
    p_total_price     NUMERIC,
    p_commission      NUMERIC,
    p_commission_rate NUMERIC,
    p_description     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_user_balance NUMERIC;
    v_new_astro_balance NUMERIC;
BEGIN
    -- 1. Deduct from User Wallet
    UPDATE wallets
    SET    balance    = balance - p_total_price,
           updated_at = now()
    WHERE  shopify_customer_id = p_user_id
      AND  balance >= p_total_price
    RETURNING balance INTO v_new_user_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_USER_BALANCE';
    END IF;

    -- 2. Credit to Astrologer Wallet
    UPDATE astrologer_wallets
    SET    balance      = balance + p_commission,
           total_earned = total_earned + p_commission,
           updated_at   = now()
    WHERE  astrologer_id = p_astro_id
    RETURNING balance INTO v_new_astro_balance;

    -- 3. Log User Transaction
    INSERT INTO wallet_transactions
        (shopify_customer_id, amount, type, description, reference_id, balance_after)
    VALUES
        (p_user_id, -p_total_price, 'debit', p_description, p_session_id::TEXT, v_new_user_balance);

    -- 4. Log Astrologer Earning
    INSERT INTO astrologer_transactions
        (astrologer_id, session_id, amount, original_price, commission_rate, description, balance_after)
    VALUES
        (p_astro_id, p_session_id, p_commission, p_total_price, p_commission_rate, p_description, v_new_astro_balance);

    -- 5. Return success data
    RETURN jsonb_build_object(
        'user_balance', v_new_user_balance,
        'astro_balance', v_new_astro_balance
    );
END;
$$;
