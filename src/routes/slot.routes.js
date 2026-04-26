const express = require('express');
const router  = express.Router();
const slot    = require('../controllers/slot.controller');

// Customer bookings — MUST be before /:astro_id to avoid Express shadowing
router.get('/booked/:customer_id',     slot.getCustomerBookings);  // Customer's booked sessions

// Public — customer-facing (wildcard — must be last GET with one param)
router.get('/:astro_id',               slot.getAvailableSlots);    // Browse availability (T+1)

// Booking (customer-facing)
router.post('/book',                   slot.bookSlot);             // Atomic booking

// Astrologer-facing (manage own schedule)
router.post('/generate',               slot.generateSlots);        // Create availability slots
router.patch('/:slot_id/block',        slot.blockSlot);            // Remove an available slot

module.exports = router;
