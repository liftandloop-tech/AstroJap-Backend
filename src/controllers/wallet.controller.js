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

    if (!wallet) {
      // Create wallet if it doesn't exist
      await supabase.from('wallets').insert({
        shopify_customer_id: customer_id.toString(),
        balance:             0
      });
    }

    const { data: updated, error: updateError } = await supabase.rpc('increment_wallet', {
      p_customer_id: customer_id.toString(),
      p_amount:      parseFloat(amount)
    });

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
  // Logic here...
};
