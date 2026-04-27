/**
 * AstroJap — slot-picker.js
 * Customer-facing slot booking calendar.
 *
 * Usage in Liquid:
 *   <div id="astro-slot-picker"
 *        data-astro-id="{{ product.metafields.astro.astrologer_id }}"
 *        data-customer-id="{{ customer.id }}"
 *        data-customer-name="{{ customer.first_name }} {{ customer.last_name }}">
 *   </div>
 *   {{ 'slot-picker.js' | asset_url | script_tag }}
 */

(function () {
  'use strict';

  const API = window.AstroAPIBase || 'https://astro-jap-backend.vercel.app/api';

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function fmt(date) {
    return new Date(date).toLocaleString('en-IN', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  function fmtTime(date) {
    return new Date(date).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function fmtDate(date) {
    return new Date(date).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function fmtPrice(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  /** Returns an array of the next `count` days starting from tomorrow */
  function getNextDays(count = 7) {
    const days = [];
    for (let i = 1; i <= count; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }

  function toDateStr(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // ─── Main Widget Class ─────────────────────────────────────────────────────────

  class SlotPicker {
    constructor(container) {
      this.container    = container;
      this.astroId      = container.dataset.astroId;
      this.customerId   = container.dataset.customerId;
      this.customerName = container.dataset.customerName || '';
      this.astrologer   = null;
      this.allSlots     = [];
      this.selectedDay  = null;
      this.selectedSlot = null;

      if (!this.astroId) return;
      this.render();
      this.load();
    }

    // ── Initial render skeleton ──────────────────────────────────────────────────

    render() {
      this.container.innerHTML = `
        <div class="sp-wrap">
          <div class="sp-header">
            <h3 class="sp-title">📅 Book a Session</h3>
            <p class="sp-subtitle">Select a date and available time slot</p>
          </div>

          <div id="sp-loading" class="sp-loading">
            <div class="sp-spinner"></div>
            <span>Checking availability…</span>
          </div>

          <div id="sp-unavailable" class="sp-unavailable" style="display:none;">
            <span>🌙 This astrologer is currently not accepting bookings.</span>
          </div>

          <div id="sp-body" style="display:none;">
            <!-- Pricing bar -->
            <div class="sp-pricing-bar" id="sp-pricing-bar">
              <div class="sp-price-item">
                <span class="sp-price-dur">20 min</span>
                <span class="sp-price-val" id="sp-price-20">—</span>
              </div>
              <div class="sp-divider"></div>
              <div class="sp-price-item">
                <span class="sp-price-dur">60 min</span>
                <span class="sp-price-val" id="sp-price-60">—</span>
              </div>
            </div>

            <!-- Day strip -->
            <div class="sp-day-strip" id="sp-day-strip"></div>

            <!-- Slots grid -->
            <div class="sp-slots-wrap" id="sp-slots-wrap">
              <p class="sp-hint">← Select a date to see slots</p>
            </div>
          </div>

          <!-- Booking confirmation modal -->
          <div id="sp-modal" class="sp-modal" style="display:none;">
            <div class="sp-modal-box">
              <div class="sp-modal-icon">🔮</div>
              <h4 id="sp-modal-title">Confirm Booking</h4>
              <div class="sp-modal-details" id="sp-modal-details"></div>
              <div class="sp-modal-wallet" id="sp-modal-wallet"></div>
              <div class="sp-modal-actions">
                <button id="sp-confirm-btn" class="sp-btn-primary">Confirm & Pay from Wallet</button>
                <button id="sp-cancel-btn"  class="sp-btn-ghost">Cancel</button>
              </div>
              <div id="sp-modal-msg" class="sp-modal-msg"></div>
            </div>
          </div>
        </div>
      `;

      this.injectStyles();

      // Modal events
      this.container.querySelector('#sp-cancel-btn').addEventListener('click', () => this.closeModal());
      this.container.querySelector('#sp-confirm-btn').addEventListener('click', () => this.confirmBooking());
    }

    // ── Load data from backend ───────────────────────────────────────────────────

    async load() {
      try {
        const res  = await fetch(`${API}/slots/${this.astroId}`);
        const data = await res.json();

        document.getElementById('sp-loading').style.display = 'none';

        if (!data.available) {
          document.getElementById('sp-unavailable').style.display = 'flex';
          return;
        }

        this.astrologer = data.astrologer;
        this.allSlots   = data.slots || [];

        // Show pricing
        document.getElementById('sp-price-20').textContent = fmtPrice(data.astrologer.price_20_min);
        document.getElementById('sp-price-60').textContent = fmtPrice(data.astrologer.price_60_min);

        document.getElementById('sp-body').style.display = 'block';
        this.renderDayStrip();

      } catch (e) {
        document.getElementById('sp-loading').innerHTML = '<span style="color:#e74c3c">Failed to load availability. Please refresh.</span>';
        console.error('[SlotPicker]', e);
      }
    }

    // ── Day Strip ────────────────────────────────────────────────────────────────

    renderDayStrip() {
      const strip = document.getElementById('sp-day-strip');
      const days  = getNextDays(7);

      strip.innerHTML = days.map(day => {
        const dateStr   = toDateStr(day);
        const hasSlots  = this.allSlots.some(s => toDateStr(new Date(s.start_time)) === dateStr);
        const dayLabel  = day.toLocaleDateString('en-IN', { weekday: 'short' });
        const dateLabel = day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

        return `
          <button class="sp-day-btn ${hasSlots ? '' : 'sp-day-empty'}"
                  data-date="${dateStr}"
                  onclick="window._spInstance_${this.uid()}.selectDay('${dateStr}')">
            <span class="sp-day-name">${dayLabel}</span>
            <span class="sp-day-date">${dateLabel}</span>
            ${hasSlots ? '<span class="sp-day-dot"></span>' : '<span class="sp-day-na">Full</span>'}
          </button>
        `;
      }).join('');
    }

    uid() {
      if (!this._uid) this._uid = Math.random().toString(36).slice(2, 7);
      // Register instance globally so inline handlers can reach it
      window[`_spInstance_${this._uid}`] = this;
      return this._uid;
    }

    // ── Select a day ─────────────────────────────────────────────────────────────

    selectDay(dateStr) {
      this.selectedDay  = dateStr;
      this.selectedSlot = null;

      // Highlight active day
      this.container.querySelectorAll('.sp-day-btn').forEach(btn => {
        btn.classList.toggle('sp-day-active', btn.dataset.date === dateStr);
      });

      // Filter slots for this day
      const daySlots = this.allSlots.filter(s => toDateStr(new Date(s.start_time)) === dateStr);
      this.renderSlots(daySlots, dateStr);
    }

    // ── Slots grid ───────────────────────────────────────────────────────────────

    renderSlots(slots, dateStr) {
      const wrap = document.getElementById('sp-slots-wrap');

      if (slots.length === 0) {
        wrap.innerHTML = `<p class="sp-hint">No available slots for ${fmtDate(dateStr + 'T00:00:00')}.</p>`;
        return;
      }

      // Group by duration
      const s20 = slots.filter(s => s.duration_min === 20);
      const s60 = slots.filter(s => s.duration_min === 60);

      wrap.innerHTML = `
        ${s20.length ? `<div class="sp-dur-label">⚡ 20-min slots — ${fmtPrice(this.astrologer.price_20_min)}</div>
          <div class="sp-slots-grid">${s20.map(s => this.slotBtn(s)).join('')}</div>` : ''}
        ${s60.length ? `<div class="sp-dur-label">🌟 60-min slots — ${fmtPrice(this.astrologer.price_60_min)}</div>
          <div class="sp-slots-grid">${s60.map(s => this.slotBtn(s)).join('')}</div>` : ''}
      `;
    }

    slotBtn(slot) {
      return `
        <button class="sp-slot-btn"
                data-slot-id="${slot.id}"
                data-duration="${slot.duration_min}"
                data-start="${slot.start_time}"
                onclick="window._spInstance_${this.uid()}.selectSlot(this, '${slot.id}', ${slot.duration_min}, '${slot.start_time}')">
          ${fmtTime(slot.start_time)}
        </button>
      `;
    }

    // ── Select a slot ────────────────────────────────────────────────────────────

    selectSlot(btn, slotId, duration, startTime) {
      this.selectedSlot = { id: slotId, duration_min: duration, start_time: startTime };

      // Highlight
      this.container.querySelectorAll('.sp-slot-btn').forEach(b => b.classList.remove('sp-slot-active'));
      btn.classList.add('sp-slot-active');

      const price = duration === 60 ? this.astrologer.price_60_min : this.astrologer.price_20_min;
      this.openModal(slotId, duration, startTime, price);
    }

    // ── Booking modal ────────────────────────────────────────────────────────────

    openModal(slotId, duration, startTime, price) {
      const modal   = document.getElementById('sp-modal');
      const details = document.getElementById('sp-modal-details');
      const walletEl= document.getElementById('sp-modal-wallet');
      const msgEl   = document.getElementById('sp-modal-msg');

      details.innerHTML = `
        <div class="sp-modal-row"><span>📅 Date & Time</span><strong>${fmt(startTime)}</strong></div>
        <div class="sp-modal-row"><span>⏱ Duration</span><strong>${duration} minutes</strong></div>
        <div class="sp-modal-row"><span>💰 Amount</span><strong>${fmtPrice(price)}</strong></div>
      `;

      msgEl.textContent   = '';
      walletEl.textContent = 'Checking wallet…';

      // Fetch wallet balance to show the user
      if (this.customerId) {
        fetch(`${API}/wallet/balance`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ customer_id: this.customerId })
        })
        .then(r => r.json())
        .then(data => {
          const bal = Number(data.balance || 0);
          const sufficient = bal >= Number(price);
          walletEl.innerHTML = `
            <div class="sp-wallet-row ${sufficient ? '' : 'sp-wallet-low'}">
              <span>👛 Wallet Balance</span>
              <strong>${fmtPrice(bal)}</strong>
            </div>
            ${!sufficient ? `<p class="sp-wallet-warn">⚠️ Insufficient balance. <a href="/pages/wallet">Recharge Wallet</a></p>` : ''}
          `;
          document.getElementById('sp-confirm-btn').disabled = !sufficient;
        })
        .catch(() => { walletEl.textContent = ''; });
      } else {
        walletEl.innerHTML = '<p class="sp-wallet-warn">⚠️ Please <a href="/account/login">log in</a> to book a session.</p>';
        document.getElementById('sp-confirm-btn').disabled = true;
      }

      modal.style.display = 'flex';
    }

    closeModal() {
      document.getElementById('sp-modal').style.display = 'none';
    }

    // ── Confirm and book ─────────────────────────────────────────────────────────

    async confirmBooking() {
      if (!this.selectedSlot || !this.customerId) return;

      const btn   = document.getElementById('sp-confirm-btn');
      const msgEl = document.getElementById('sp-modal-msg');

      btn.disabled   = true;
      btn.textContent = 'Processing…';
      msgEl.textContent = '';

      try {
        const res = await fetch(`${API}/slots/book`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot_id:       this.selectedSlot.id,
            customer_id:   this.customerId,
            customer_name: this.customerName,
            astrologer_id: this.astroId,
            duration_min:  this.selectedSlot.duration_min
          })
        });

        const data = await res.json();

        if (!res.ok) {
          const userMsg = {
            'INSUFFICIENT_BALANCE': `Not enough balance. Required: ${fmtPrice(data.required)}, Available: ${fmtPrice(data.balance)}. <a href="/pages/wallet">Recharge →</a>`,
            'Slot was just booked by someone else': 'This slot was just taken. Please choose another.',
            'Only next-day bookings allowed': 'You can only book slots for tomorrow or later.'
          }[data.error] || data.error;

          msgEl.innerHTML = `<span class="sp-error">${userMsg}</span>`;
          btn.disabled    = false;
          btn.textContent = 'Confirm & Pay from Wallet';
          return;
        }

        // Success! Remove the booked slot from local state and refresh UI
        this.allSlots = this.allSlots.filter(s => s.id !== this.selectedSlot.id);

        document.getElementById('sp-modal').innerHTML = `
          <div class="sp-modal-box sp-success">
            <div class="sp-modal-icon">✅</div>
            <h4>Booking Confirmed!</h4>
            <p>${data.message}</p>
            <div class="sp-modal-row" style="margin-top:16px;">
              <span>Wallet Balance After</span>
              <strong>${fmtPrice(data.user_balance)}</strong>
            </div>
            <a href="/pages/booking-confirmed?session_id=${data.session_id}" class="sp-btn-primary" style="margin-top:20px; display:block; text-align:center;">
              View Booking Details →
            </a>
            <button class="sp-btn-ghost" style="margin-top:10px; width:100%;" onclick="document.getElementById('sp-modal').style.display='none'">
              Close
            </button>
          </div>
        `;

        // Refresh day view to remove the booked slot
        if (this.selectedDay) this.selectDay(this.selectedDay);

      } catch (e) {
        msgEl.innerHTML = '<span class="sp-error">Network error. Please try again.</span>';
        btn.disabled    = false;
        btn.textContent = 'Confirm & Pay from Wallet';
      }
    }

    // ── Styles ───────────────────────────────────────────────────────────────────

    injectStyles() {
      if (document.getElementById('sp-styles')) return;
      const style = document.createElement('style');
      style.id = 'sp-styles';
      style.textContent = `
        .sp-wrap { font-family: 'Outfit', sans-serif; position: relative; }
        .sp-header { margin-bottom: 20px; }
        .sp-title  { font-size: 1.25rem; font-weight: 800; margin: 0 0 4px; color: #1a1a1a; }
        .sp-subtitle { font-size: 0.85rem; color: #888; margin: 0; }

        /* Loading */
        .sp-loading { display: flex; align-items: center; gap: 12px; padding: 24px; color: #888; }
        .sp-spinner { width: 24px; height: 24px; border: 3px solid #eee; border-top-color: #f97316; border-radius: 50%; animation: sp-spin 0.8s linear infinite; flex-shrink: 0; }
        @keyframes sp-spin { to { transform: rotate(360deg); } }

        /* Unavailable */
        .sp-unavailable { padding: 24px; background: #fff3e0; border-radius: 12px; color: #e65100; font-weight: 600; }

        /* Pricing bar */
        .sp-pricing-bar { display: flex; align-items: center; gap: 0; background: #1a1a1a; border-radius: 12px; padding: 14px 24px; margin-bottom: 20px; }
        .sp-price-item  { display: flex; flex-direction: column; align-items: center; flex: 1; }
        .sp-price-dur   { font-size: 0.75rem; color: #aaa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .sp-price-val   { font-size: 1.2rem; font-weight: 800; color: #f97316; }
        .sp-divider     { width: 1px; height: 36px; background: #333; margin: 0 20px; }

        /* Day strip */
        .sp-day-strip   { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 20px; scrollbar-width: none; }
        .sp-day-strip::-webkit-scrollbar { display: none; }
        .sp-day-btn     { flex-shrink: 0; width: 68px; padding: 10px 8px; border: 1.5px solid #e0e0e0; border-radius: 12px; background: #fff; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; transition: all 0.2s; }
        .sp-day-btn:hover { border-color: #f97316; }
        .sp-day-active  { border-color: #f97316 !important; background: #fff7ed; }
        .sp-day-empty   { opacity: 0.55; }
        .sp-day-name    { font-size: 0.7rem; font-weight: 700; color: #888; text-transform: uppercase; }
        .sp-day-date    { font-size: 0.8rem; font-weight: 800; color: #1a1a1a; }
        .sp-day-dot     { width: 6px; height: 6px; border-radius: 50%; background: #f97316; margin-top: 2px; }
        .sp-day-na      { font-size: 0.65rem; color: #bbb; margin-top: 2px; }

        /* Slot grid */
        .sp-dur-label   { font-size: 0.8rem; font-weight: 700; color: #555; margin: 12px 0 8px; }
        .sp-slots-grid  { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .sp-slot-btn    { padding: 9px 16px; border: 1.5px solid #e0e0e0; border-radius: 10px; background: #fff; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s; color: #333; }
        .sp-slot-btn:hover  { border-color: #f97316; color: #f97316; }
        .sp-slot-active { border-color: #f97316 !important; background: #f97316 !important; color: #fff !important; }
        .sp-hint        { color: #aaa; font-size: 0.9rem; text-align: center; padding: 24px 0; }

        /* Modal */
        .sp-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; align-items: center; justify-content: center; padding: 20px; }
        .sp-modal-box { background: #fff; border-radius: 20px; padding: 32px; max-width: 420px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .sp-modal-icon { font-size: 2.5rem; text-align: center; margin-bottom: 12px; }
        .sp-modal-box h4 { font-size: 1.2rem; font-weight: 800; margin: 0 0 20px; text-align: center; }
        .sp-modal-details { background: #f8f9fa; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        .sp-modal-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; padding: 6px 0; }
        .sp-modal-row:not(:last-child) { border-bottom: 1px solid #eee; }
        .sp-modal-wallet { margin-bottom: 20px; }
        .sp-wallet-row { display: flex; justify-content: space-between; font-size: 0.9rem; padding: 10px 14px; border-radius: 10px; background: #f0fdf4; color: #166534; }
        .sp-wallet-low  { background: #fef2f2; color: #991b1b; }
        .sp-wallet-warn { font-size: 0.82rem; color: #e65100; margin: 8px 0 0; }
        .sp-wallet-warn a { color: #f97316; font-weight: 700; }
        .sp-modal-actions { display: flex; flex-direction: column; gap: 10px; }
        .sp-btn-primary { background: #f97316; color: #fff; border: none; padding: 14px; border-radius: 12px; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: background 0.2s; text-decoration: none; }
        .sp-btn-primary:hover:not(:disabled) { background: #ea580c; }
        .sp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .sp-btn-ghost  { background: transparent; border: 1.5px solid #e0e0e0; color: #666; padding: 12px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
        .sp-modal-msg  { margin-top: 12px; font-size: 0.85rem; }
        .sp-error      { color: #e74c3c; }
        .sp-success    { text-align: center; }
        .sp-success h4 { color: #166534; }
        .sp-success p  { color: #555; font-size: 0.9rem; }
      `;
      document.head.appendChild(style);
    }
  }

  // ─── Auto-init all picker containers on page load ─────────────────────────────

  function initAll() {
    document.querySelectorAll('[id="astro-slot-picker"], .astro-slot-picker').forEach(el => {
      new SlotPicker(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  window.SlotPicker = SlotPicker;

})();
