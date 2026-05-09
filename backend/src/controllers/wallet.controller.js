const supabase = require('../config/supabase');

// ─── Helper ───────────────────────────────────────────────────────────────────
function missingField(res, field) {
  return res.status(400).json({ error: `${field} is required` });
}

// ─── GET /api/wallet/balance ──────────────────────────────────────────────────
// Returns the customer's current wallet balance (main + cashback).

exports.getBalance = async (req, res) => {
  const { customer_id } = req.body;
  if (!customer_id) return missingField(res, 'customer_id');

  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('balance, cashback_balance, currency, updated_at')
      .eq('shopify_customer_id', customer_id.toString())
      .maybeSingle();

    if (error) throw error;

    // Return 0 balance if wallet doesn't exist yet
    res.status(200).json({
      balance:          data?.balance ?? 0,
      cashback_balance: data?.cashback_balance ?? 0,
      currency:         data?.currency ?? 'INR'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/wallet/calculate-usage ───────────────────────────────────────
// Calculates how much cashback can be used for a given cart amount.
// Rule: Max 50% of cart value using cashback.

exports.calculateCashbackUsage = async (req, res) => {
  const { customer_id, cart_total } = req.body;
  if (!customer_id) return missingField(res, 'customer_id');
  if (cart_total === undefined) return missingField(res, 'cart_total');

  try {
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('cashback_balance')
      .eq('shopify_customer_id', customer_id.toString())
      .maybeSingle();

    if (error) throw error;

    const cashbackBalance = wallet?.cashback_balance ?? 0;
    const maxUsageByRule  = parseFloat(cart_total) * 0.5; // 50% of order value
    const allowedUsage    = Math.min(cashbackBalance, maxUsageByRule);

    res.status(200).json({
      cashback_balance: cashbackBalance,
      max_allowed_usage: allowedUsage
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

// ─── POST /api/wallet/debit ──────────────────────────────────────────────────
// Deducts money from customer wallet using the RPC function.

exports.debitWallet = async (req, res) => {
  const { customer_id, amount, cashback_usage, description, reference_id } = req.body;
  if (!customer_id) return missingField(res, 'customer_id');
  if (!amount) return missingField(res, 'amount');

  try {
    // If cashback_usage is provided, we deduct from cashback_balance first
    // Note: p_cashback_amount needs to be handled in the Supabase RPC 'debit_wallet_v2'
    // For now, we manually handle it or use a separate logic if the RPC doesn't support it.
    
    // Manual Implementation if RPC is not updated yet:
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance, cashback_balance')
      .eq('shopify_customer_id', customer_id.toString())
      .maybeSingle();

    if (!wallet) throw new Error('WALLET_NOT_FOUND');

    let mainAmountToDeduct     = parseFloat(amount);
    let cashbackAmountToDeduct = parseFloat(cashback_usage || 0);

    if (wallet.balance < mainAmountToDeduct || wallet.cashback_balance < cashbackAmountToDeduct) {
      return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
    }

    const newBalance         = wallet.balance - mainAmountToDeduct;
    const newCashbackBalance = wallet.cashback_balance - cashbackAmountToDeduct;

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ 
        balance:          newBalance, 
        cashback_balance: newCashbackBalance,
        updated_at:       new Date().toISOString() 
      })
      .eq('shopify_customer_id', customer_id.toString());

    if (updateError) throw updateError;

    // Record usage
    await supabase.from('wallet_transactions').insert({
      shopify_customer_id: customer_id.toString(),
      amount:              -(mainAmountToDeduct + cashbackAmountToDeduct),
      type:                'usage',
      description:         description || 'Consultation purchase',
      reference_id:        reference_id || 'manual',
      balance_after:       newBalance
    });

    res.status(200).json({ success: true, new_balance: newBalance, new_cashback_balance: newCashbackBalance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Internal Helper: creditCashback ──────────────────────────────────────────
// Credited when an order is fulfilled (50% of order value).

exports.creditCashback = async (customerId, amount, orderId) => {
  // Check if wallet exists
  const { data: wallet } = await supabase
    .from('wallets')
    .select('cashback_balance')
    .eq('shopify_customer_id', customerId.toString())
    .maybeSingle();

  let currentCashback = 0;
  if (!wallet) {
    await supabase.from('wallets').insert({
      shopify_customer_id: customerId.toString(),
      balance:          0,
      cashback_balance: 0
    });
  } else {
    currentCashback = parseFloat(wallet.cashback_balance) || 0;
  }

  const updated = currentCashback + parseFloat(amount);
  const { error: updateError } = await supabase
    .from('wallets')
    .update({ cashback_balance: updated, updated_at: new Date().toISOString() })
    .eq('shopify_customer_id', customerId.toString());

  if (updateError) throw updateError;

  // Record the cashback transaction
  await supabase.from('wallet_transactions').insert({
    shopify_customer_id: customerId.toString(),
    amount:              parseFloat(amount),
    type:                'credit',
    description:         '50% Cashback earned from order',
    reference_id:        orderId,
    balance_after:       updated // This should ideally be total_balance, but we follow existing pattern
  });

  return updated;
};

// ─── POST /api/wallet/manual-credit ───────────────────────────────────────────
// FOR TESTING ONLY: Manually add money to a wallet.

exports.manualCredit = async (req, res) => {
  const { customer_id, amount } = req.body;
  if (!customer_id) return missingField(res, 'customer_id');
  if (!amount) return missingField(res, 'amount');

  try {
    // Check if wallet exists
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('shopify_customer_id', customer_id.toString())
      .maybeSingle();

    let currentBalance = 0;
    if (!wallet) {
      await supabase.from('wallets').insert({
        shopify_customer_id: customer_id.toString(),
        balance: 0
      });
    } else {
      currentBalance = parseFloat(wallet.balance) || 0;
    }

    const updated = currentBalance + parseFloat(amount);
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance: updated, updated_at: new Date().toISOString() })
      .eq('shopify_customer_id', customer_id.toString());

    // Record the manual credit transaction
    await supabase.from('wallet_transactions').insert({
      shopify_customer_id: customer_id.toString(),
      amount:              parseFloat(amount),
      type:                'credit',
      description:         'Manual credit from admin',
      balance_after:       updated
    });

    res.status(200).json({ success: true, new_balance: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Internal helper for webhooks (Recharge)
exports.creditWallet = async (customerId, amount, orderId) => {
  // Check if wallet exists
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('shopify_customer_id', customerId.toString())
    .maybeSingle();

  let currentBalance = 0;
  if (!wallet) {
    await supabase.from('wallets').insert({
      shopify_customer_id: customerId.toString(),
      balance: 0
    });
  } else {
    currentBalance = parseFloat(wallet.balance) || 0;
  }

  const updated = currentBalance + parseFloat(amount);
  const { error: updateError } = await supabase
    .from('wallets')
    .update({ balance: updated, updated_at: new Date().toISOString() })
    .eq('shopify_customer_id', customerId.toString());

  if (updateError) throw updateError;

  // Record the credit transaction
  await supabase.from('wallet_transactions').insert({
    shopify_customer_id: customerId.toString(),
    amount:              parseFloat(amount),
    type:                'credit',
    description:         'Wallet recharge via Shopify Order',
    reference_id:        orderId,
    balance_after:       updated
  });

  return updated;
};
// ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────

// GET /api/wallet/admin/balances
// Returns all user wallets with names
exports.getAdminWalletStatus = async (req, res) => {
  const token = req.headers['authorization'];
  if (token !== 'admin_secret_session_token_2026') return res.status(403).json({ error: 'Unauthorized' });

  try {
    const { data, error } = await supabase
      .from('wallets')
      .select(`
        *,
        users:shopify_customer_id (name)
      `)
      .order('balance', { ascending: false });

    if (error) throw error;
    
    // Flatten result to be more friendly for frontend
    const results = (data || []).map(w => ({
      shopify_customer_id: w.shopify_customer_id,
      balance:             w.balance,
      cashback_balance:    w.cashback_balance || 0,
      currency:            w.currency,
      updated_at:          w.updated_at,
      user_name:           w.users?.name || 'Unknown User'
    }));

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// GET /api/wallet/admin/recharges
// Returns all credit transactions (Add Money history)
exports.getAdminRecharges = async (req, res) => {
  const token = req.headers['authorization'];
  if (token !== 'admin_secret_session_token_2026') return res.status(403).json({ error: 'Unauthorized' });

  try {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select(`
        *,
        users:shopify_customer_id (name)
      `)
      .eq('type', 'credit')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const results = (data || []).map(t => ({
      ...t,
      user_name: t.users?.name || 'Unknown User'
    }));

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
