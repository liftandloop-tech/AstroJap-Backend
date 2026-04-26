const express = require('express');
const router  = express.Router();
const payout  = require('../controllers/payout.controller');

router.post('/request',              payout.requestPayout);       // Submit withdrawal request
router.get('/history/:astrologer_id', payout.getPayoutHistory);   // Payout history

module.exports = router;
