const API_BASE_URL = 'https://astro-jap-backend.vercel.app/api';

// Expose for chat.js login flow
window.AstroAPIBase = API_BASE_URL;

const AstroAPI = {
  async getAstrologers() {
    const response = await fetch(`${API_BASE_URL}/astrologers`);
    if (!response.ok) throw new Error('Failed to fetch astrologers');
    return response.json();
  },

  async getActiveSession(customerId) {
    const response = await fetch(`${API_BASE_URL}/sessions/get-session`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ customer_id: customerId })
    });
    if (!response.ok) throw new Error('Failed to fetch active session');
    return response.json();
  },

  async getSessionById(sessionId) {
    const response = await fetch(`${API_BASE_URL}/sessions/get-session-by-id`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: sessionId })
    });
    if (!response.ok) throw new Error('Failed to fetch session details');
    return response.json();
  },

  async getCustomerSessions(customerId) {
    const response = await fetch(`${API_BASE_URL}/sessions/get-customer-sessions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ customer_id: customerId })
    });
    if (!response.ok) throw new Error('Failed to fetch session history');
    return response.json();
  },

  async startSession(sessionId) {
    const response = await fetch(`${API_BASE_URL}/sessions/start-session`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: sessionId })
    });
    if (!response.ok) throw new Error('Failed to start session');
    return response.json();
  },

  async validateSession(sessionId) {
    const response = await fetch(`${API_BASE_URL}/sessions/validate-session`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: sessionId })
    });
    if (!response.ok) throw new Error('Failed to validate session');
    return response.json();
  },

  async getWalletBalance(customerId) {
    const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ customer_id: customerId })
    });
    if (!response.ok) throw new Error('Failed to fetch wallet balance');
    return response.json();
  },

  async debitWallet(customerId, amount, description, referenceId) {
    const response = await fetch(`${API_BASE_URL}/wallet/debit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        customer_id:  customerId,
        amount:       amount,
        description:  description,
        reference_id: referenceId
      })
    });
    return response.json();
  },

  async manualRecharge(customerId, amount) {
    const response = await fetch(`${API_BASE_URL}/wallet/manual-credit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ customer_id: customerId, amount: amount })
    });
    return response.json();
  },

  async createManualSession(customerId, customerName, astrologerId, duration) {
    const response = await fetch(`${API_BASE_URL}/sessions/create-manual`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        customer_id:   customerId,
        customer_name: customerName,
        astrologer_id: astrologerId,
        duration:      duration
      })
    });
    // We don't throw error here to handle 402 Insufficient Balance specially in UI
    return response;
  },

  // ─── Slots ──────────────────────────────────────────────────────────────────

  async getAvailableSlots(astroId, date, duration) {
    let url = `${API_BASE_URL}/slots/${astroId}`;
    const params = new URLSearchParams();
    if (date)     params.set('date', date);
    if (duration) params.set('duration', duration);
    if (params.toString()) url += '?' + params.toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch slots');
    return response.json();
  },

  async bookSlot(slotId, customerId, customerName, astrologerId, durationMin) {
    return fetch(`${API_BASE_URL}/slots/book`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        slot_id:       slotId,
        customer_id:   customerId,
        customer_name: customerName,
        astrologer_id: astrologerId,
        duration_min:  durationMin
      })
    });
  },

  async getCustomerBookings(customerId) {
    const response = await fetch(`${API_BASE_URL}/slots/booked/${customerId}`);
    if (!response.ok) throw new Error('Failed to fetch bookings');
    return response.json();
  },

  async generateSlots(astrologerId, slots) {
    const response = await fetch(`${API_BASE_URL}/slots/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ astrologer_id: astrologerId, slots })
    });
    return response;
  },

  // ─── Astrologer Dashboard ────────────────────────────────────────────────────

  async getDashboardStats(astrologerId) {
    const response = await fetch(`${API_BASE_URL}/astrologers/dashboard-stats/${astrologerId}`);
    if (!response.ok) throw new Error('Failed to fetch dashboard stats');
    return response.json();
  },

  async getUpcomingSessions(astrologerId) {
    const response = await fetch(`${API_BASE_URL}/astrologers/upcoming-sessions/${astrologerId}`);
    if (!response.ok) throw new Error('Failed to fetch upcoming sessions');
    return response.json();
  },

  async getSessionHistory(astrologerId, page = 1) {
    const response = await fetch(`${API_BASE_URL}/astrologers/session-history/${astrologerId}?page=${page}`);
    if (!response.ok) throw new Error('Failed to fetch session history');
    return response.json();
  },

  async updatePricing(astrologerId, price20, price60) {
    return fetch(`${API_BASE_URL}/astrologers/update-pricing`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ astrologer_id: astrologerId, price_20_min: price20, price_60_min: price60 })
    });
  },

  async toggleAvailability(astrologerId) {
    return fetch(`${API_BASE_URL}/astrologers/toggle-availability`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ astrologer_id: astrologerId })
    });
  },

  async getAstrologerPricing(astrologerId) {
    const response = await fetch(`${API_BASE_URL}/astrologers/${astrologerId}/pricing`);
    if (!response.ok) throw new Error('Failed to fetch pricing');
    return response.json();
  },

  // ─── Payouts ─────────────────────────────────────────────────────────────────

  async requestPayout(astrologerId, amount) {
    return fetch(`${API_BASE_URL}/payouts/request`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ astrologer_id: astrologerId, amount })
    });
  },

  async getPayoutHistory(astrologerId) {
    const response = await fetch(`${API_BASE_URL}/payouts/history/${astrologerId}`);
    if (!response.ok) throw new Error('Failed to fetch payout history');
    return response.json();
  },

  // ─── Reviews ─────────────────────────────────────────────────────────────────

  async submitReview(sessionId, customerId, rating, comment) {
    return fetch(`${API_BASE_URL}/reviews/submit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: sessionId, customer_id: customerId, rating, comment })
    });
  },

  async getSessionReview(sessionId) {
    const response = await fetch(`${API_BASE_URL}/reviews/session/${sessionId}`);
    if (!response.ok) throw new Error('Failed to fetch review');
    return response.json();
  }
};

window.AstroAPI = AstroAPI;

