const axios    = require('axios');
const supabase = require('../config/supabase');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function missingField(res, field) {
  return res.status(400).json({ error: `${field} is required` });
}

// ─── GET /api/astrologers ─────────────────────────────────────────────────────

exports.getAllAstrologers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('astrologers')
      .select('*');

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/sessions/get-session ──────────────────────────────────────────

exports.getActiveSession = async (req, res) => {
  const { customer_id } = req.body;
  if (!customer_id) return missingField(res, 'customer_id');

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, astrologers(cometchat_uid, name, profile_image)')
      .eq('user_id', customer_id.toString())
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/sessions/get-customer-sessions ────────────────────────────────
// Step 2.1: Returns ALL session history for a customer (not just active).

exports.getCustomerSessions = async (req, res) => {
  const { customer_id } = req.body;
  if (!customer_id) return missingField(res, 'customer_id');

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, astrologers(cometchat_uid, name, profile_image)')
      .eq('user_id', customer_id.toString())
      .order('created_at', { ascending: false }); // ← no status filter — returns full history

    if (error) throw error;
    res.status(200).json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/sessions/start-session ────────────────────────────────────────

exports.startSession = async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return missingField(res, 'session_id');

  try {
    const { data: session, error: getError } = await supabase
      .from('sessions')
      .select('duration_minutes, start_time')
      .eq('id', session_id)
      .single();

    if (getError) throw getError;

    // Already started — return existing data so frontend can compute the timer
    if (session.start_time) {
      const { data: existing } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', session_id)
        .single();
      return res.status(200).json({ status: 'already_started', ...existing });
    }

    const startTime = new Date();
    const endTime   = new Date(startTime.getTime() + session.duration_minutes * 60000);

    const { data, error: updateError } = await supabase
      .from('sessions')
      .update({
        start_time: startTime.toISOString(),
        end_time:   endTime.toISOString()
      })
      .eq('id', session_id)
      .select()
      .single();

    if (updateError) throw updateError;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/sessions/validate-session ─────────────────────────────────────

exports.validateSession = async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return missingField(res, 'session_id');

  try {
    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (error || !session) return res.status(200).json({ valid: false });

    const now     = new Date();
    const endTime = session.end_time ? new Date(session.end_time) : null;
    const isStarted = !!session.start_time;

    if (session.status !== 'active' || (endTime && now > endTime)) {
      if (session.status === 'active' && endTime && now > endTime) {
        await supabase
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', session_id);
      }
      return res.status(200).json({ valid: false });
    }

    const remaining_seconds = endTime
      ? Math.max(0, Math.floor((endTime - now) / 1000))
      : null;

    res.status(200).json({ valid: true, remaining_seconds, is_started: isStarted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/sessions/get-chat-token ───────────────────────────────────────
// Step 1.3: Generates a short-lived CometChat auth token server-side.
// The AUTH_KEY never leaves the backend.

exports.getChatToken = async (req, res) => {
  const { customer_id, customer_name, uid: rawUid } = req.body;
  if (!customer_id && !rawUid) return missingField(res, 'customer_id or uid');

  const appId   = process.env.COMETCHAT_APP_ID;
  const region  = process.env.COMETCHAT_REGION;
  const authKey = process.env.COMETCHAT_AUTH_KEY;

  // If a raw uid is provided (e.g. from astrologer portal: 'astro_UUID'),
  // use it directly. Otherwise construct shopify_<customer_id>.
  const uid     = rawUid || `shopify_${customer_id}`;
  const baseUrl = `https://${appId}.api-${region}.cometchat.io/v3`;

  try {
    // 1. Upsert the user in CometChat (creates if not exists, updates if exists)
    await axios.post(
      `${baseUrl}/users`,
      { uid, name: customer_name || `Customer ${customer_id}`, withAuthToken: true },
      {
        headers: {
          appid:  appId,
          apikey: authKey,
          'Content-Type': 'application/json'
        }
      }
    ).catch(err => {
      // 409 Conflict = user already exists — that's fine
      if (err.response?.status !== 409) throw err;
    });

    // 2. Generate an auth token for this user
    const tokenRes = await axios.post(
      `${baseUrl}/auth_tokens`,
      { uid },
      {
        headers: {
          appid:  appId,
          apikey: authKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const authToken = tokenRes.data?.data?.authToken;
    if (!authToken) throw new Error('CometChat did not return an auth token');

    res.status(200).json({ authToken, uid });
  } catch (error) {
    console.error('getChatToken error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
};

// ─── POST /api/sessions/expire-old ───────────────────────────────────────────
// Step 3.4: Called by Vercel Cron every 5 minutes to clean up timed-out sessions.
// Protected by CRON_SECRET header so only the scheduler can trigger it.

exports.expireOldSessions = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data, error } = await supabase
      .from('sessions')
      .update({ status: 'completed' })
      .eq('status', 'active')
      .lt('end_time', new Date().toISOString())
      .select('id');

    if (error) throw error;

    const count = data?.length ?? 0;
    console.log(`Cron: expired ${count} session(s)`);
    res.status(200).json({ expired: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/sessions/get-session-by-id ───────────────────────────────────

exports.getSessionById = async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return missingField(res, 'session_id');

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, astrologers(cometchat_uid, name, profile_image)')
      .eq('id', session_id)
      .single();

    if (error) throw error;
    // booking-confirmed.liquid reads: const { session } = await res.json()
    res.status(200).json({ session: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/sessions/create-manual ────────────────────────────────────────
// Wallet flow: deducts from wallet and creates session — no Shopify order needed.

exports.createManualSession = async (req, res) => {
  const { customer_id, customer_name, astrologer_id, duration } = req.body;
  if (!customer_id)   return missingField(res, 'customer_id');
  if (!astrologer_id) return missingField(res, 'astrologer_id');
  const durationInt = parseInt(duration, 10);
  if (![20, 60].includes(durationInt)) {
    return res.status(400).json({ error: 'duration must be 20 or 60' });
  }

  try {
    // 1. Validate astrologer + get pricing
    const { data: astrologer, error: astroError } = await supabase
      .from('astrologers')
      .select('id, name, price_20_min, price_60_min')
      .eq('id', astrologer_id)
      .single();

    if (astroError || !astrologer) {
      return res.status(404).json({ error: 'Astrologer not found' });
    }

    const price = durationInt === 60 ? astrologer.price_60_min : astrologer.price_20_min;
    const commissionRate = astrologer.commission_percentage || 70;
    const commissionAmount = (price * (commissionRate / 100)).toFixed(2);

    // 2. Ensure both wallets exist
    await Promise.all([
      supabase.from('wallets').upsert({ shopify_customer_id: customer_id.toString() }, { onConflict: 'shopify_customer_id', ignoreDuplicates: true }),
      supabase.from('astrologer_wallets').upsert({ astrologer_id: astrologer_id }, { onConflict: 'astrologer_id', ignoreDuplicates: true })
    ]);

    // 3. Pre-check user balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets').select('balance').eq('shopify_customer_id', customer_id.toString()).single();

    if (walletError) throw walletError;
    if (!wallet || wallet.balance < price) {
      return res.status(402).json({ error: 'INSUFFICIENT_BALANCE', balance: wallet?.balance ?? 0, required: price });
    }

    // 4. Create the session record (status: pending until payment processed)
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({ 
        user_id: customer_id.toString(), 
        astrologer_id: astrologer_id, 
        duration_minutes: durationInt, 
        status: 'active',
        scheduled_at: new Date().toISOString()
      })
      .select().single();

    if (sessionError) throw sessionError;

    // 5. ATOMIC PAYMENT: Debit User + Credit Astrologer in one transaction
    const { data: paymentResult, error: paymentError } = await supabase
      .rpc('process_session_payment', {
        p_user_id:        customer_id.toString(),
        p_astro_id:       astrologer_id,
        p_session_id:     session.id,
        p_total_price:    price,
        p_commission:     parseFloat(commissionAmount),
        p_commission_rate: commissionRate,
        p_description:    `${durationInt}-min session with ${astrologer.name}`
      });

    if (paymentError) {
      // Rollback: expire the session
      await supabase.from('sessions').update({ status: 'expired' }).eq('id', session.id);
      console.error('Payment RPC failed:', paymentError);
      return res.status(500).json({ error: 'Payment processing failed' });
    }

    // 6. Sync user profile
    await supabase.from('users').upsert(
      { shopify_customer_id: customer_id.toString(), name: customer_name || null },
      { onConflict: 'shopify_customer_id' }
    );

    res.status(200).json({
      session_id:      session.id,
      user_balance:    paymentResult.user_balance,
      astro_earned:    commissionAmount,
      astrologer_name: astrologer.name
    });

  } catch (error) {
    console.error('createManualSession error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/sessions/messages ─────────────────────────────────────────────
// Get all messages for a session

exports.getChatMessages = async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return missingField(res, 'session_id');

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (error) {
      // If table doesn't exist yet, gracefully return empty array to prevent UI crashing
      if (error.code === '42P01') return res.status(200).json([]);
      throw error;
    }
    
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/sessions/send-message ─────────────────────────────────────────
// Send a message in a session

exports.sendChatMessage = async (req, res) => {
  const { session_id, sender_id, sender_type, text, is_system } = req.body;
  if (!session_id) return missingField(res, 'session_id');
  if (!sender_id) return missingField(res, 'sender_id');
  if (!text) return missingField(res, 'text');

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        session_id,
        sender_id,
        sender_type: sender_type || 'system',
        text,
        is_system: is_system || false
      })
      .select()
      .single();

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /api/sessions/admin/all ─────────────────────────────────────────────
// Admin only: Get ALL sessions with participant details for monitoring
exports.getAdminSessions = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        astrologers (name, profile_image),
        users (name, shopify_customer_id)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /api/sessions/admin/messages/:sessionId ──────────────────────────────
// Admin only: Get all messages for a specific session by ID
exports.getAdminChatMessages = async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return missingField(res, 'sessionId');

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
