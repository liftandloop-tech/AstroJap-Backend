const supabase = require('../config/supabase');

// ─── Helper ───────────────────────────────────────────────────────────────────
function missingField(res, field) {
  return res.status(400).json({ error: `${field} is required` });
}

// ─── GET /api/wallet/balance ──────────────────────────────────────────────────
// Returns the customer's current wallet balance.

exports.getBalance = async (req, res) => {
  const { customer_id } = req.body;
  if (!customer_id) return missingField(res, 'customer_id');

  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('balance, currency, updated_at')
      .eq('shopify_customer_id', customer_id.toString())
      .maybeSingle();

    if (error) throw error;

    // Return 0 balance if wallet doesn't exist yet
    res.status(200).json({
      balance:  data?.balance ?? 0,
      currency: data?.currency ?? 'INR'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/wallet/transactions ───────────────────────────────────────────
// Returns the full transaction history for a customer.

exports.getTransactions = async (req, res) => {
  const { customer_id } = req.body;
  if (!customer_id) return missingField(res, 'customer_id');

  try {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('shopify_customer_id', customer_id.toString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.status(200).json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Internal: Credit wallet ──────────────────────────────────────────────────
// Called by the webhook when a wallet top-up order is received.
// Not exposed as a public endpoint — only called internally.

exports.creditWallet = async (customerId, amount, orderId) => {
  // Upsert the wallet row
  const { data: wallet, error: upsertError } = await supabase
    .from('wallets')
    .upsert(
      { shopify_customer_id: customerId, balance: 0, updated_at: new Date().toISOString() },
      { onConflict: 'shopify_customer_id', ignoreDuplicates: true }
    );

  // Add the amount to the balance
  const { data: updated, error: updateError } = await supabase
    .from('wallets')
    .update({
      balance:    supabase.raw(`balance + ${parseFloat(amount)}`),
      updated_at: new Date().toISOString()
    })
    .eq('shopify_customer_id', customerId)
    .select('balance')
    .single();

  if (updateError) throw updateError;

  // Record the credit transaction
  await supabase
    .from('wallet_transactions')
    .insert({
      shopify_customer_id: customerId,
      amount:              parseFloat(amount),
      type:                'credit',
      description:         `Wallet recharge via Shopify order`,
      reference_id:        orderId,
      balance_after:       updated.balance
    });

  return updated.balance;
};
