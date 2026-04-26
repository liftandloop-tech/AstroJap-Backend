const supabase = require('../config/supabase');

function missingField(res, field) {
  return res.status(400).json({ error: `${field} is required` });
}

// ─── POST /api/reviews/submit ─────────────────────────────────────────────────
// Customer submits a star rating + comment after a completed session.

exports.submitReview = async (req, res) => {
  const { session_id, customer_id, rating, comment } = req.body;
  if (!session_id)  return missingField(res, 'session_id');
  if (!customer_id) return missingField(res, 'customer_id');
  if (!rating)      return missingField(res, 'rating');

  const ratingNum = parseInt(rating, 10);
  if (ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    // 1. Verify the session exists, is completed, and belongs to this customer
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, astrologer_id, user_id, status')
      .eq('id', session_id)
      .eq('user_id', customer_id.toString())
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found or does not belong to this customer' });
    }
    if (session.status !== 'completed') {
      return res.status(400).json({ error: 'Reviews can only be submitted for completed sessions' });
    }

    // 2. Check if a review already exists (UNIQUE constraint on session_id)
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('session_id', session_id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'You have already reviewed this session' });
    }

    // 3. Insert the review
    const { data: review, error: insertError } = await supabase
      .from('reviews')
      .insert({
        session_id,
        astrologer_id: session.astrologer_id,
        customer_id:   customer_id.toString(),
        rating:        ratingNum,
        comment:       comment?.trim() || null
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 4. Recalculate astrologer's rolling average rating
    const { data: avgData } = await supabase
      .from('reviews')
      .select('rating')
      .eq('astrologer_id', session.astrologer_id);

    if (avgData && avgData.length > 0) {
      const avg = avgData.reduce((sum, r) => sum + r.rating, 0) / avgData.length;
      await supabase
        .from('astrologers')
        .update({ rating: Math.round(avg * 10) / 10 }) // round to 1 decimal
        .eq('id', session.astrologer_id);
    }

    res.status(201).json({
      message: 'Thank you for your review!',
      review
    });
  } catch (error) {
    console.error('submitReview error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /api/reviews/session/:session_id ─────────────────────────────────────
// Check if a review already exists for a session (used by UI to hide/show form).

exports.getSessionReview = async (req, res) => {
  const { session_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at')
      .eq('session_id', session_id)
      .maybeSingle();

    if (error) throw error;
    res.status(200).json({ review: data || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
