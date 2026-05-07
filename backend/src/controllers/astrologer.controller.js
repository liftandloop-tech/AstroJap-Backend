const supabase = require('../config/supabase');
const axios    = require('axios');
const { sendStatusNotification, notifyAdminNewSignup } = require('../services/notification.service');

// ─── Helper ───────────────────────────────────────────────────────────────────

function missingField(res, field) {
  return res.status(400).json({ error: `${field} is required` });
}

exports.signup = async (req, res) => {
  const { email, password, name, mobile } = req.body;
  if (!email)    return missingField(res, 'email');
  if (!password) return missingField(res, 'password');
  if (!name)     return missingField(res, 'name');
  if (!mobile)   return missingField(res, 'mobile');

  try {
    // 1. Check if astrologer already exists in our table
    const { data: existingAstro } = await supabase
      .from('astrologers')
      .select('id, approval_status, onboarding_step')
      .eq('email', email)
      .maybeSingle();

    if (existingAstro && existingAstro.approval_status === 'approved') {
      return res.status(400).json({ error: 'An approved astrologer account already exists with this email. Please login.' });
    }

    let userId;

    // 2. Create or Sign In to Supabase Auth
    const { data: signUpData, error: authError } = await supabase.auth.signUp({ email, password });
    
    if (authError) {
      // If user already exists in Auth, try logging them in to get the ID
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error('Auth error: ' + authError.message);
      userId = signInData.user.id;
    } else {
      userId = signUpData.user.id;
    }

    // 3. Upsert into astrologers table
    const { data, error: insertError } = await supabase
      .from('astrologers')
      .upsert([{
        id:              userId,
        email,
        name,
        mobile,
        approval_status: existingAstro?.approval_status || 'pending',
        onboarding_step: existingAstro?.onboarding_step || 1
      }], { onConflict: 'email' })
      .select()
      .single();

    if (insertError) throw insertError;

    // 4. Send "Received" Email
    sendStatusNotification(email, name, 'pending');

    // 5. Shopify sync (non-fatal)
    await createShopifyCustomer({ id: data.id, name, email, mobile });

    res.status(201).json({
      message: 'Signup successful. Please complete your profile.',
      user: { id: data.id, name, email, approval_status: data.approval_status, onboarding_step: data.onboarding_step }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
};

// ─── POST /api/astrologers/login ──────────────────────────────────────────────

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email)    return missingField(res, 'email');
  if (!password) return missingField(res, 'password');

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;

    const { data: profile, error: profileError } = await supabase
      .from('astrologers')
      .select('id, name, approval_status, onboarding_step, rejection_reason, is_accepting_bookings, price_20_min, price_60_min')
      .eq('id', authData.user.id)
      .single();

    if (profileError) throw profileError;

    // Gate by approval status — only 'approved' can access the dashboard
    if (profile.approval_status !== 'approved') {
      return res.status(403).json({
        error:            'Your account is not yet approved.',
        status:           profile.approval_status,
        onboarding_step:  profile.onboarding_step || 1,
        rejection_reason: profile.rejection_reason || null,
        userId:           authData.user.id
      });
    }

    res.status(200).json({
      message: 'Login successful',
      token:   authData.session.access_token,
      user:    profile
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

// ─── PUT /api/astrologers/update-onboarding ───────────────────────────────────

exports.updateOnboarding = async (req, res) => {
  const { id, ...details } = req.body;
  if (!id) return missingField(res, 'id');

  // Prevent overwriting protected fields via this endpoint
  delete details.shopify_customer_id;

  // If completing the final step, set status to pending for review
  if (details.onboarding_step === 5) {
    details.approval_status = 'pending';
  } else {
    delete details.approval_status;
  }

  try {
    const { data, error } = await supabase
      .from('astrologers')
      .update(details)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Astrologer record not found. Please try signing up again.' });

    // If they just finished onboarding and are now pending review, notify Admin
    if (details.onboarding_step === 5) {
      notifyAdminNewSignup(data.name, data.email);
    }

    res.status(200).json({ message: 'Onboarding step saved', data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── GET /api/astrologers ─────────────────────────────────────────────────────
// Returns approved astrologers who are currently accepting bookings.

exports.getAllAstrologers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('astrologers')
      .select('id, name, profile_image, bio, expertise, specialization, languages, experience_years, price_20_min, price_60_min, rating, total_sessions, is_accepting_bookings, cometchat_uid')
      .eq('approval_status', 'approved');

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /api/astrologers/profile/:id ────────────────────────────────────────

exports.getProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('astrologers')
      .select('id, name, profile_image, bio, expertise, specialization, languages, experience_years, price_20_min, price_60_min, rating, total_sessions, is_accepting_bookings, cometchat_uid')
      .eq('id', id)
      .eq('approval_status', 'approved')
      .single();

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(404).json({ error: 'Astrologer not found' });
  }
};

exports.profileStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('astrologers')
      .select('approval_status, onboarding_step')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(404).json({ error: 'Not found' });
  }
};

// ─── GET /api/astrologers/:id/pricing ────────────────────────────────────────
// Public: Fetches live pricing for a specific astrologer (used by booking picker).

exports.getPricing = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('astrologers')
      .select('price_20_min, price_60_min, is_accepting_bookings, name')
      .eq('id', id)
      .eq('approval_status', 'approved')
      .single();

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(404).json({ error: 'Astrologer not found' });
  }
};

// ─── PATCH /api/astrologers/update-pricing ────────────────────────────────────
// Authenticated: Astrologer sets their own session prices.

exports.updatePricing = async (req, res) => {
  const { astrologer_id, price_20_min, price_60_min } = req.body;
  if (!astrologer_id) return missingField(res, 'astrologer_id');
  if (price_20_min === undefined) return missingField(res, 'price_20_min');
  if (price_60_min === undefined) return missingField(res, 'price_60_min');

  // Basic validation
  if (price_20_min < 0 || price_60_min < 0) {
    return res.status(400).json({ error: 'Minimum price is ₹0 (Free Session)' });
  }

  try {
    const { data, error } = await supabase
      .from('astrologers')
      .update({ price_20_min, price_60_min })
      .eq('id', astrologer_id)
      .select('price_20_min, price_60_min')
      .single();

    if (error) throw error;
    res.status(200).json({ message: 'Pricing updated', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── PATCH /api/astrologers/toggle-availability ───────────────────────────────
// Authenticated: Astrologer toggles whether they accept new bookings.

exports.toggleAvailability = async (req, res) => {
  const { astrologer_id } = req.body;
  if (!astrologer_id) return missingField(res, 'astrologer_id');

  try {
    // Fetch current state first
    const { data: current, error: fetchError } = await supabase
      .from('astrologers')
      .select('is_accepting_bookings')
      .eq('id', astrologer_id)
      .single();

    if (fetchError) throw fetchError;

    const newState = !current.is_accepting_bookings;

    const { data, error } = await supabase
      .from('astrologers')
      .update({ is_accepting_bookings: newState })
      .eq('id', astrologer_id)
      .select('is_accepting_bookings')
      .single();

    if (error) throw error;

    res.status(200).json({
      message: `Availability set to ${newState ? 'ON' : 'OFF'}`,
      is_accepting_bookings: data.is_accepting_bookings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /api/astrologers/dashboard-stats ─────────────────────────────────────
// Authenticated: Real earnings and session stats for the dashboard.

exports.getDashboardStats = async (req, res) => {
  const { id } = req.params;
  if (!id) return missingField(res, 'id');

  try {
    // 1. Wallet balance + total_earned (from astrologer_wallets — these columns exist in production)
    const { data: wallet } = await supabase
      .from('astrologer_wallets')
      .select('balance, total_earned')
      .eq('astrologer_id', id)
      .maybeSingle();

    // 2. Total completed sessions
    const { count: totalSessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('astrologer_id', id)
      .eq('status', 'completed');

    // 3. Upcoming scheduled sessions — must match the same filter as getUpcomingSessions
    const now = new Date();
    const bufferTime = new Date(now.getTime() - 15 * 60000).toISOString();
    const { count: upcomingCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('astrologer_id', id)
      .in('status', ['active', 'scheduled'])
      .gte('scheduled_at', bufferTime);


    // 4. Today's earnings — from astrologer_transactions.
    //    IMPORTANT: this table has NO 'type' column — all rows are credit entries.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayTx } = await supabase
      .from('astrologer_transactions')
      .select('amount')
      .eq('astrologer_id', id)
      .gte('created_at', todayStart.toISOString());

    const todayEarnings = (todayTx || []).reduce((sum, t) => sum + Number(t.amount), 0);

    // 5. This week's earnings
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week
    weekStart.setHours(0, 0, 0, 0);

    const { data: weekTx } = await supabase
      .from('astrologer_transactions')
      .select('amount')
      .eq('astrologer_id', id)
      .gte('created_at', weekStart.toISOString());

    const weekEarnings = (weekTx || []).reduce((sum, t) => sum + Number(t.amount), 0);

    // 6. Profile data
    const { data: profile } = await supabase
      .from('astrologers')
      .select('rating, name, is_accepting_bookings, price_20_min, price_60_min')
      .eq('id', id)
      .single();

    res.status(200).json({
      wallet_balance:        wallet?.balance ?? 0,
      total_earned:          wallet?.total_earned ?? 0,  // lifetime earnings
      today_earnings:        todayEarnings,
      week_earnings:         weekEarnings,
      total_sessions:        totalSessions ?? 0,
      upcoming_sessions:     upcomingCount ?? 0,
      rating:                profile?.rating ?? 5.0,
      name:                  profile?.name,
      is_accepting_bookings: profile?.is_accepting_bookings,
      price_20_min:          profile?.price_20_min,
      price_60_min:          profile?.price_60_min
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /api/astrologers/upcoming-sessions/:id ───────────────────────────────

exports.getUpcomingSessions = async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch all future sessions for this astrologer regardless of type.
    // Fetch sessions that are either 'active' (immediate chat waiting to start)
    // or 'scheduled' for the future.
    const now = new Date();
    // 15 mins buffer in the past to ensure they don't disappear right at the start time
    const bufferTime = new Date(now.getTime() - 15 * 60000).toISOString();
    
    const { data, error } = await supabase
      .from('sessions')
      .select('id, scheduled_at, duration_minutes, status, user_id, type')
      .eq('astrologer_id', id)
      .in('status', ['active', 'scheduled'])
      .gte('scheduled_at', bufferTime)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    res.status(200).json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /api/astrologers/session-history/:id ─────────────────────────────────

exports.getSessionHistory = async (req, res) => {
  const { id } = req.params;
  const page   = parseInt(req.query.page || '1', 10);
  const limit  = parseInt(req.query.limit || '20', 10);
  const offset = (page - 1) * limit;

  try {
    const { data, error, count } = await supabase
      .from('sessions')
      .select('id, scheduled_at, start_time, end_time, duration_minutes, status, user_id', { count: 'exact' })
      .eq('astrologer_id', id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.status(200).json({ sessions: data || [], total: count, page, limit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Private: Create Shopify Customer for Admin Visibility ────────────────────

async function createShopifyCustomer({ id, name, email, mobile }) {
  const shopName = process.env.SHOPIFY_STORE_DOMAIN;  // e.g. 'your-store.myshopify.com'
  const adminKey = process.env.SHOPIFY_ADMIN_API_KEY;

  if (!shopName || !adminKey) {
    console.warn('[Shopify] SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_KEY not set — skipping customer creation.');
    return;
  }

  try {
    // ── Sanitize Phone for Shopify (E.164 format required) ──
    let cleanPhone = mobile.replace(/\s+/g, ''); // remove spaces
    if (!cleanPhone.startsWith('+')) {
      // Assuming India +91 if no prefix. Adjust if needed.
      if (cleanPhone.length === 10) cleanPhone = '+91' + cleanPhone;
      else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) cleanPhone = '+' + cleanPhone;
    }

    const res = await axios.post(
      `https://${shopName}/admin/api/2024-04/customers.json`,
      {
        customer: {
          first_name: name.split(' ')[0],
          last_name:  name.split(' ').slice(1).join(' ') || '',
          email,
          phone:      cleanPhone,
          tags:       'astrologer_pending',
          note:       `Astrologer application. Supabase ID: ${id}. Review profile at: https://astrojap-backend.vercel.app`,
          verified_email: false
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': adminKey,
          'Content-Type':           'application/json'
        }
      }
    );

    const shopifyCustomerId = res.data?.customer?.id?.toString();

    if (shopifyCustomerId) {
      // Save the Shopify Customer ID back to Supabase for webhook matching
      await supabase
        .from('astrologers')
        .update({ shopify_customer_id: shopifyCustomerId })
        .eq('id', id);

    }
  } catch (err) {
    // Non-fatal — log but don't block signup
    console.error('Shopify customer creation failed:', err.response?.data || err.message);
  }
}

// ─── ADMIN FUNCTIONS ─────────────────────────────────────────────────────────

exports.adminLogin = async (req, res) => {
  const { id, password } = req.body;
  const ADMIN_ID = 'admin';
  const ADMIN_PASS = 'astrojap2026';

  if (id && id.toLowerCase() === ADMIN_ID.toLowerCase() && password === ADMIN_PASS) {
    // Return a simple token (in production use JWT)
    res.status(200).json({ success: true, token: 'admin_secret_session_token_2026' });
  } else {
    res.status(401).json({ error: 'Invalid admin credentials' });
  }
};

exports.getPendingAstrologers = async (req, res) => {
  const token = req.headers['authorization'];
  if (token !== 'admin_secret_session_token_2026') return res.status(403).json({ error: 'Unauthorized' });

  try {
    const { data, error } = await supabase
      .from('astrologers')
      .select('*')
      .in('approval_status', ['pending', 'processing'])
      .order('created_at', { ascending: false });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllAstrologersAdmin = async (req, res) => {
  const token = req.headers['authorization'];
  if (token !== 'admin_secret_session_token_2026') return res.status(403).json({ error: 'Unauthorized' });

  try {
    const { data, error } = await supabase
      .from('astrologers')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.approveAstrologer = async (req, res) => {
  const token = req.headers['authorization'];
  if (token !== 'admin_secret_session_token_2026') return res.status(403).json({ error: 'Unauthorized' });

  const { id } = req.body;
  if (!id) return missingField(res, 'id');

  try {
    const { data, error } = await supabase
      .from('astrologers')
      .update({ approval_status: 'approved', onboarding_step: 5 })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Send Approval Email
    sendStatusNotification(data.email, data.name, 'approved');

    // Update Shopify Customer Tag if exists
    if (data.shopify_customer_id) {
       updateShopifyCustomerStatus(data.shopify_customer_id, 'astrologer_approved');
    }

    res.status(200).json({ message: 'Astrologer approved successfully', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.rejectAstrologer = async (req, res) => {
  const token = req.headers['authorization'];
  if (token !== 'admin_secret_session_token_2026') return res.status(403).json({ error: 'Unauthorized' });

  const { id, reason } = req.body;
  if (!id) return missingField(res, 'id');

  try {
    const { data, error } = await supabase
      .from('astrologers')
      .update({ approval_status: 'rejected', rejection_reason: reason || 'Application does not meet our requirements.' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Send Rejection Email
    sendStatusNotification(data.email, data.name, 'rejected', reason);

    // Update Shopify Customer Tag if exists
    if (data.shopify_customer_id) {
       updateShopifyCustomerStatus(data.shopify_customer_id, 'astrologer_rejected');
    }

    res.status(200).json({ message: 'Astrologer rejected', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

async function updateShopifyCustomerStatus(shopifyId, newTag) {
  const shopName = process.env.SHOPIFY_STORE_DOMAIN;
  const adminKey = process.env.SHOPIFY_ADMIN_API_KEY;
  if (!shopName || !adminKey) return;

  try {
    await axios.put(
      `https://${shopName}/admin/api/2024-04/customers/${shopifyId}.json`,
      { customer: { id: shopifyId, tags: newTag } },
      { headers: { 'X-Shopify-Access-Token': adminKey } }
    );
  } catch (err) {
    console.error('Shopify tag update failed:', err.message);
  }
}

exports.uploadProfileImage = async (req, res) => {
  const { id } = req.body;
  const file = req.file;
  if (!id) return missingField(res, 'id');
  if (!file) return missingField(res, 'image');

  try {
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${id}-${Date.now()}.${fileExt}`;
    const filePath = `profiles/${fileName}`;

    // 1. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('astrologers') // Changed bucket name to 'astrologers' to match table
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 2. Get Public URL
    const { data: urlData } = supabase.storage
      .from('astrologers')
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // 3. Update Astrologer Record
    const { error: updateError } = await supabase
      .from('astrologers')
      .update({ profile_image: imageUrl })
      .eq('id', id);

    if (updateError) throw updateError;

    res.status(200).json({ message: 'Image uploaded successfully', imageUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updatePricesAdmin = async (req, res) => {
  const token = req.headers['authorization'];
  if (token !== 'admin_secret_session_token_2026') return res.status(403).json({ error: 'Unauthorized' });

  const { id, price_20_min, price_60_min } = req.body;
  if (!id) return missingField(res, 'id');

  try {
    const { data, error } = await supabase
      .from('astrologers')
      .update({ 
        price_20_min: parseFloat(price_20_min), 
        price_60_min: parseFloat(price_60_min) 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ message: 'Prices updated successfully', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
