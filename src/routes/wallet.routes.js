const express = require('express');
const router  = express.Router();
const walletController = require('../controllers/wallet.controller');

router.post('/balance',      walletController.getBalance);
router.post('/transactions', walletController.getTransactions);

module.exports = router;
