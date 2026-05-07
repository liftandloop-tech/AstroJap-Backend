const express = require('express');
const router  = express.Router();
const walletController = require('../controllers/wallet.controller');

router.post('/balance',      walletController.getBalance);
router.post('/transactions', walletController.getTransactions);
router.post('/debit',        walletController.debitWallet);
router.post('/manual-credit', walletController.manualCredit);

// Admin monitoring routes
router.get('/admin/balances',   walletController.getAdminWalletStatus);
router.get('/admin/recharges',  walletController.getAdminRecharges);

module.exports = router;
