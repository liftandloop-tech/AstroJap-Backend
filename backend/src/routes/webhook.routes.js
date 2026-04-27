const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

router.post('/shopify/order-created',    webhookController.handleOrderCreated);
router.post('/shopify/customer-updated', webhookController.handleCustomerUpdated);


module.exports = router;
