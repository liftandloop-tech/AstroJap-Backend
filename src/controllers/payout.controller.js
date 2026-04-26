const supabase = require('../config/supabase');

// ─── Helper ───────────────────────────────────────────────────────────────────

function missingField(res, field) {
  return res.status(400).json({ error: `${field} is required` });
}

const MIN_PAYOUT_AMOUNT = 500; // ₹500 minimum withdrawal

// ─── POST /api/payouts/request ────────────────────────────────────────────────
// Astrologer requests a payout. Pre-fills bank/UPI from their profile.

exports.requestPayout = async (req, res) => {
  const { astrologer_id, amount } = req.body;
  if (!astrologer_id) return missingField(res, 'astrologer_id');
  if (!amount)        return missingField(res, 'amount');

  const requestedAmount = parseFloat(amount);

  if (requestedAmount < MIN_PAYOUT_AMOUNT) {
    return res.status(400).json({
      error: `Minimum payout amount is ₹${MIN_PAYOUT_AMOUNT}`
    });
  }

  try {
    // 1. Check astrologer wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from('astrologer_wallets')
      .select('balance')
      .eq('astrologer_id', astrologer_id)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (Number(wallet.balance) < requestedAmount) {
      return res.status(402).json({
        error:     'INSUFFICIENT_BALANCE',
        balance:   wallet.balance,
        requested: requestedAmount
      });
    }

    // 2. Check for existing pending payout (one at a time)
    const { data: existingPayout } = await supabase
      .from('payouts')
      .select('id')
      .eq('astrologer_id', astrologer_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPayout) {
      return res.status(409).json({
        error: 'You already have a pending payout request. Please wait for it to be processed.'
      });
    }

    // 3. Fetch bank details from astrologer profile for the record
    const { data: profile } = await supabase
      .from('astrologers')
      .select('bank_account_number, upi_id, name')
      .eq('id', astrologer_id)
      .single();

    // 4. Create payout record
    const { data: payout, error: payoutError } = await supabase
      .from('payouts')
      .insert({
        astrologer_id,
        amount:       requestedAmount,
        status:       'pending',
        upi_id:       profile?.upi_id || null,
        bank_account: profile?.bank_account_number || null
      })
      .select()
      .single();

    if (payoutError) throw payoutError;

    res.status(201).json({
      message: `Payout request for ₹${requestedAmount} submitted successfully. Processing within 2-3 business days.`,
      payout
    });
  } catch (error) {
    console.error('requestPayout error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /api/payouts/history/:astrologer_id ──────────────────────────────────
// Returns all payout requests for an astrologer, newest first.

exports.getPayoutHistory = async (req, res) => {
  const { astrologer_id } = req.params;
  if (!astrologer_id) return missingField(res, 'astrologer_id');

  try {
    const { data, error } = await supabase
      .from('payouts')
      .select('id, amount, status, requested_at, processed_at, upi_id, bank_account, admin_notes')
      .eq('astrologer_id', astrologer_id)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
