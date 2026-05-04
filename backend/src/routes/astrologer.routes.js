const express = require('express');
const router  = express.Router();
const c       = require('../controllers/astrologer.controller');

// ─── Public Routes ────────────────────────────────────────────────────────────
router.get('/',                           c.getAllAstrologers);        // List approved+available
router.post('/signup',                    c.signup);                   // Register new astrologer
router.post('/login',                     c.login);                    // Login (gated by status)
router.get('/profile/:id',               c.getProfile);               // Public profile
router.get('/:id/pricing',               c.getPricing);               // Live pricing for booking

// ─── Onboarding (semi-public — validated by astrologer ID) ───────────────────
router.put('/update-onboarding',          c.updateOnboarding);         // Save onboarding steps
router.get('/profile-status/:id',         c.profileStatus);            // Check approval & step

// ─── Authenticated Dashboard Routes ──────────────────────────────────────────
router.get('/dashboard-stats/:id',        c.getDashboardStats);        // Real earnings data
router.get('/upcoming-sessions/:id',      c.getUpcomingSessions);      // Upcoming booked slots
router.get('/session-history/:id',        c.getSessionHistory);        // Past sessions + earnings
router.patch('/update-pricing',           c.updatePricing);            // Set custom prices
router.patch('/toggle-availability',      c.toggleAvailability);       // ON/OFF booking switch

// ─── Admin Routes (Protected by Admin Credentials) ───────────────────────────
router.post('/admin/login',               c.adminLogin);               // Admin ID/Pass Login
router.get('/admin/pending',              c.getPendingAstrologers);    // List all pending
router.post('/admin/approve',             c.approveAstrologer);        // Approve application
router.post('/admin/reject',              c.rejectAstrologer);         // Reject application

module.exports = router;
