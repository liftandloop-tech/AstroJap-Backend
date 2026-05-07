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

// ─── POST /api/wallet/debit ──────────────────────────────────────────────────
// Deducts money from customer wallet using the RPC function.

exports.debitWallet = async (req, res) => {
  const { customer_id, amount, description, reference_id } = req.body;
  if (!customer_id) return missingField(res, 'customer_id');
  if (!amount) return missingField(res, 'amount');

  try {
    const { data, error } = await supabase
      .rpc('debit_wallet', {
        p_customer_id:  customer_id.toString(),
        p_amount:       parseFloat(amount),
        p_description:  description || 'Session charge',
        p_reference_id: reference_id || 'manual'
      });

    if (error) {
      if (error.message.includes('INSUFFICIENT_BALANCE')) {
        return res.status(400).json({ error: 'INSUFFICIENT_BALANCE', message: 'Not enough balance in wallet' });
      }
      throw error;
    }

    res.status(200).json({ success: true, new_balance: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// Internal helper for webhooks
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
