const express = require('express');
const router  = express.Router();
const review  = require('../controllers/review.controller');

router.post('/submit',              review.submitReview);      // Submit a star rating
router.get('/session/:session_id',  review.getSessionReview);  // Check if already reviewed

module.exports = router;
