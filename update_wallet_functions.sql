-- Atomic increment function
CREATE OR REPLACE FUNCTION increment_wallet(
    p_customer_id TEXT,
    p_amount      NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    UPDATE wallets
    SET    balance    = balance + p_amount,
           updated_at = now()
    WHERE  shopify_customer_id = p_customer_id
    RETURNING balance INTO v_new_balance;

    RETURN v_new_balance;
END;
$$;
