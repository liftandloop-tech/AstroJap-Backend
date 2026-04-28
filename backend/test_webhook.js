const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config({ path: '.env' });

const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
const url = 'https://astro-jap-backend.vercel.app/api/webhooks/shopify/order-created';

const payload = JSON.stringify({
  id: 9999999999,
  customer: { id: 8640652181604 }, // Your test account
  line_items: [
    {
      price: "150.00",
      quantity: 1,
      sku: "WALLET_RECHARGE",
      properties: [{ name: "_is_wallet_recharge", value: "true" }]
    }
  ]
});

const hmac = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64');

axios.post(url, payload, {
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Hmac-Sha256': hmac
  }
}).then(res => {
  console.log('Webhook test successful!', res.data);
}).catch(err => {
  console.error('Webhook test failed:', err.response ? err.response.data : err.message);
});
