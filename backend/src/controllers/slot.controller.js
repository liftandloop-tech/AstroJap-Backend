const supabase = require('../config/supabase');
const { notifyAstrologer } = require('../services/socket.service');

// ─── Helper ───────────────────────────────────────────────────────────────────

function missingField(res, field) {
  return res.status(400).json({ error: `${field} is required` });
}

/**
 * Validates that a given date string is at least tomorrow (T+1 rule).
 * This is enforced both here AND in the DB function book_slot_atomic().
 */
function isAtLeastTomorrow(dateStr) {
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return d >= tomorrow;
}

// ─── GET /api/slots/:astro_id ─────────────────────────────────────────────────
// Returns available slots for an astrologer.
// Query param ?date=YYYY-MM-DD is optional — if omitted, returns all future slots.
// Server enforces T+1: slots for today or earlier are NEVER returned.

exports.getAvailableSlots = async (req, res) => {
  const { astro_id } = req.params;
  const { date, duration } = req.query; // duration: 20 or 60 (optional filter)

  if (!astro_id) return missingField(res, 'astro_id');

  try {
    // Verify astrologer is approved and accepting bookings
    const { data: astrologer, error: astroError } = await supabase
      .from('astrologers')
      .select('id, name, is_accepting_bookings, approval_status, price_20_min, price_60_min')
      .eq('id', astro_id)
      .eq('approval_status', 'approved')
      .single();

    if (astroError || !astrologer) {
      return res.status(404).json({ error: 'Astrologer not found or not approved' });
    }

    if (!astrologer.is_accepting_bookings) {
      return res.status(200).json({
        available:    false,
        message:      'This astrologer is currently not accepting bookings.',
        astrologer:   { name: astrologer.name },
        slots:        []
      });
    }

    // Build the query — T+1 is the hard floor enforced by the server
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    let query = supabase
      .from('slots')
      .select('id, start_time, end_time, duration_min, status')
      .eq('astrologer_id', astro_id)
      .eq('status', 'available')
      .gte('start_time', tomorrow.toISOString())  // T+1 enforced
      .order('start_time', { ascending: true });

    // If a specific date is requested, filter to that day only
    if (date) {
      if (!isAtLeastTomorrow(date)) {
        return res.status(400).json({ error: 'Only bookings from tomorrow onwards are allowed.' });
      }
      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);
      query = query.gte('start_time', dayStart.toISOString()).lte('start_time', dayEnd.toISOString());
    }

    // Optional duration filter
    if (duration && [20, 60].includes(parseInt(duration, 10))) {
      query = query.eq('duration_min', parseInt(duration, 10));
    }

    const { data: slots, error } = await query;
    if (error) throw error;

    res.status(200).json({
      available: true,
      astrologer: {
        name:          astrologer.name,
        price_20_min:  astrologer.price_20_min,
        price_60_min:  astrologer.price_60_min
      },
      slots: slots || []
    });
  } catch (error) {
    console.error('getAvailableSlots error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/slots/generate ─────────────────────────────────────────────────
// Astrologer creates their available time blocks.
// Accepts an array of slot objects and bulk-inserts them.
// T+1 rule enforced: slots for today are rejected.

exports.generateSlots = async (req, res) => {
  const { astrologer_id, slots } = req.body;
  if (!astrologer_id) return missingField(res, 'astrologer_id');
  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: 'slots must be a non-empty array' });
  }

  // Validate each slot
  const records = [];
  for (const slot of slots) {
    if (!slot.start_time || !slot.duration_min) {
      return res.status(400).json({ error: 'Each slot requires start_time and duration_min' });
    }
    if (![20, 60].includes(parseInt(slot.duration_min, 10))) {
      return res.status(400).json({ error: 'duration_min must be 20 or 60' });
    }

    // Enforce T+1 at server level
    if (!isAtLeastTomorrow(slot.start_time)) {
      return res.status(400).json({
        error: `Slot ${slot.start_time} is too soon. Only tomorrow or later is allowed.`
      });
    }

    const start = new Date(slot.start_time);
    const end   = new Date(start.getTime() + parseInt(slot.duration_min, 10) * 60 * 1000);

    records.push({
      astrologer_id,
      start_time:   start.toISOString(),
      end_time:     end.toISOString(),
      duration_min: parseInt(slot.duration_min, 10),
      status:       'available'
    });
  }

  try {
    const { data, error } = await supabase
      .from('slots')
      .insert(records)
      .select();

    if (error) throw error;

    res.status(201).json({
      message:      `${data.length} slot(s) created successfully`,
      slots:        data
    });
  } catch (error) {
    console.error('generateSlots error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── DELETE /api/slots/:slot_id ───────────────────────────────────────────────
// Astrologer can block/remove an available slot before it gets booked.

exports.blockSlot = async (req, res) => {
  const { slot_id }      = req.params;
  const { astrologer_id } = req.body;
  if (!astrologer_id) return missingField(res, 'astrologer_id');

  try {
    const { data, error } = await supabase
      .from('slots')
      .update({ status: 'blocked' })
      .eq('id', slot_id)
      .eq('astrologer_id', astrologer_id)   // security: only own slots
      .eq('status', 'available')            // can't block an already-booked slot
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Slot not found, already booked, or unauthorized' });
    }

    res.status(200).json({ message: 'Slot blocked successfully', slot: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/slots/book ─────────────────────────────────────────────────────
// Atomic booking: deducts wallet, creates session, locks slot.
// Uses the book_slot_atomic() Postgres function to prevent double-booking.

exports.bookSlot = async (req, res) => {
  const { slot_id, customer_id, customer_name, astrologer_id, duration_min } = req.body;
  if (!slot_id)       return missingField(res, 'slot_id');
  if (!customer_id)   return missingField(res, 'customer_id');
  if (!astrologer_id) return missingField(res, 'astrologer_id');

  try {
    // Step 1: Get slot details (for validation before atomic call)
    const { data: slot, error: slotError } = await supabase
      .from('slots')
      .select('id, start_time, end_time, duration_min, status, astrologer_id')
      .eq('id', slot_id)
      .single();

    if (slotError || !slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    if (slot.status !== 'available') {
      return res.status(409).json({ error: 'This slot is no longer available' });
    }
    if (!isAtLeastTomorrow(slot.start_time)) {
      return res.status(400).json({ error: 'Only next-day or future bookings are allowed' });
    }
    if (slot.astrologer_id !== astrologer_id) {
      return res.status(400).json({ error: 'Slot does not belong to this astrologer' });
    }

    // Step 2: Get astrologer pricing
    const { data: astrologer, error: astroError } = await supabase
      .from('astrologers')
      .select('name, price_20_min, price_60_min, is_accepting_bookings, approval_status')
      .eq('id', astrologer_id)
      .single();

    if (astroError || !astrologer) {
      return res.status(404).json({ error: 'Astrologer not found' });
    }
    if (astrologer.approval_status !== 'approved') {
      return res.status(403).json({ error: 'Astrologer is not available' });
    }
    if (!astrologer.is_accepting_bookings) {
      return res.status(409).json({ error: 'This astrologer is not accepting bookings' });
    }

    // Step 3: Determine price based on slot duration
    const dur   = slot.duration_min;
    const price = dur === 60 ? astrologer.price_60_min : astrologer.price_20_min;

    // Step 4: Check user wallet balance (pre-flight — the atomic fn will re-check)
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('shopify_customer_id', customer_id.toString())
      .maybeSingle();

    if (!wallet || Number(wallet.balance) < Number(price)) {
      return res.status(402).json({
        error:    'INSUFFICIENT_BALANCE',
        balance:  wallet?.balance ?? 0,
        required: price
      });
    }

    // Step 5: Create the session record first (needed for slot FK)
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id:          customer_id.toString(),
        astrologer_id:    astrologer_id,
        duration_minutes: dur,
        status:           'active',
        type:             'scheduled',
        scheduled_at:     slot.start_time
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Step 6: Call the atomic Postgres function (locks slot, debits wallet)
    const { data: result, error: rpcError } = await supabase.rpc('book_slot_atomic', {
      p_slot_id:     slot_id,
      p_session_id:  session.id,
      p_user_id:     customer_id.toString(),
      p_astro_id:    astrologer_id,
      p_price:       price,
      p_description: `${dur}-min scheduled session with ${astrologer.name} on ${new Date(slot.start_time).toLocaleString('en-IN')}`
    });

    if (rpcError) {
      // Rollback: expire the orphaned session
      await supabase.from('sessions').update({ status: 'expired' }).eq('id', session.id);

      const msg = rpcError.message || '';
      if (msg.includes('SLOT_UNAVAILABLE'))    return res.status(409).json({ error: 'Slot was just booked by someone else' });
      if (msg.includes('SLOT_TOO_SOON'))       return res.status(400).json({ error: 'Only next-day bookings allowed' });
      if (msg.includes('INSUFFICIENT_BALANCE')) return res.status(402).json({ error: 'Insufficient wallet balance' });
      throw rpcError;
    }

    // Step 7: Sync customer name in users table
    await supabase
      .from('users')
      .upsert(
        { shopify_customer_id: customer_id.toString(), name: customer_name || null },
        { onConflict: 'shopify_customer_id' }
      );

    // Step 8: Notify astrologer via Socket.io
    notifyAstrologer(astrologer_id, 'new-booking-alert', {
      session_id:    session.id,
      customer_name: customer_name || `Customer ${customer_id}`,
      duration:      dur,
      scheduled_at:  slot.start_time,
      price
    });

    res.status(200).json({
      success:       true,
      session_id:    session.id,
      scheduled_at:  slot.start_time,
      duration_min:  dur,
      price,
      user_balance:  result.user_balance,
      astrologer:    { name: astrologer.name },
      message:       `Booking confirmed! Your session with ${astrologer.name} is scheduled for ${new Date(slot.start_time).toLocaleString('en-IN')}`
    });

  } catch (error) {
    console.error('bookSlot error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /api/slots/booked/:customer_id ───────────────────────────────────────
// Returns all upcoming booked sessions for a customer.

exports.getCustomerBookings = async (req, res) => {
  const { customer_id } = req.params;
  if (!customer_id) return missingField(res, 'customer_id');

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, scheduled_at, duration_minutes, status, type, astrologers(name, profile_image, cometchat_uid)')
      .eq('user_id', customer_id.toString())
      .eq('type', 'scheduled')
      .in('status', ['active'])
      .gt('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    res.status(200).json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
