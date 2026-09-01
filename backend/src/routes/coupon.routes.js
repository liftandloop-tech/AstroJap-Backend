const express = require('express');
const router  = express.Router();
const couponController = require('../controllers/coupon.controller');

router.get('/', couponController.getCoupons);

module.exports = router;
