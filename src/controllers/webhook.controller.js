const crypto  = require('crypto');
const axios   = require('axios');
const supabase = require('../config/supabase');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function verifyShopifyHmac(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('SHOPIFY_WEBHOOK_SECRET is not set in .env');
    return false;
  }
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handleOrderCreated = async (req, res) => {
  // ── Step 1.4: HMAC verification ───────────────────────────────────────────
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  if (!hmacHeader || !verifyShopifyHmac(req.body, hmacHeader)) {
    console.warn('Webhook rejected: invalid HMAC signature');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // req.body is a Buffer from express.raw() — parse it now
  let order;
  try {
    order = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  try {
    const customerId = order.customer ? order.customer.id.toString() : null;
    const orderId    = order.id.toString();

    if (!customerId) {
      return res.status(400).json({ error: 'No customer associated with order' });
    }

    for (const item of order.line_items) {
      // ─── Wallet Recharge ───────────────────────────────────────────────────
      // Identified by SKU or hidden property
      const walletProp = item.properties?.find(p => p.name === '_is_wallet_recharge' || p.name === 'is_wallet_recharge');
      const isRecharge = item.sku === 'WALLET_RECHARGE' || walletProp?.value === 'true';

      if (isRecharge) {
        const walletController = require('./wallet.controller');
        try {
          // Multiply price by quantity for custom amount support (e.g. 11 qty of a ₹1 product)
          const totalAmount = parseFloat(item.price) * parseInt(item.quantity, 10);
          const newBalance = await walletController.creditWallet(customerId, totalAmount, orderId);
          console.log(`Webhook: Credited ₹${totalAmount} to customer ${customerId}. New balance: ${newBalance}`);
        } catch (err) {
          console.error(`Webhook: Wallet credit failed for order ${orderId}`, err);
        }
      }
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ─── POST /api/webhooks/shopify/customer-updated ──────────────────────────────
// Triggered when Shopify Admin changes a customer's tags.
// Admin workflow: Add tag 'astrologer_approved' or 'astrologer_rejected'
// to approve or reject an astrologer application.

exports.handleCustomerUpdated = async (req, res) => {
  // Step 1: HMAC verification — same secret as order-created
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  if (!hmacHeader || !verifyShopifyHmac(req.body, hmacHeader)) {
    console.warn('Customer webhook rejected: invalid HMAC');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let customer;
  try {
    customer = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  // Step 2: Extract tags (Shopify sends them as a comma-separated string)
  const tags = (customer.tags || '').split(',').map(t => t.trim().toLowerCase());
  const shopifyCustomerId = customer.id?.toString();

  if (!shopifyCustomerId) {
    return res.status(400).json({ error: 'No customer ID in payload' });
  }

  // Step 3: Check which action to take
  const isApproved = tags.includes('astrologer_approved');
  const isRejected = tags.includes('astrologer_rejected');

  if (!isApproved && !isRejected) {
    // Not an astrologer-related tag change — ignore silently
    return res.status(200).send('No action needed');
  }

  try {
    // Step 4: Find the astrologer by their Shopify customer ID
    const { data: astrologer, error: findError } = await supabase
      .from('astrologers')
      .select('id, name, email, approval_status')
      .eq('shopify_customer_id', shopifyCustomerId)
      .maybeSingle();

    if (findError) throw findError;
    if (!astrologer) {
      console.log(`Customer ${shopifyCustomerId} is not an astrologer — skipping.`);
      return res.status(200).send('Not an astrologer account');
    }

    // Step 5: Guard against processing the same status twice
    const newStatus = isApproved ? 'approved' : 'rejected';
    if (astrologer.approval_status === newStatus) {
      return res.status(200).send('Status already up to date');
    }

    // Step 6: Update Supabase
    const { error: updateError } = await supabase
      .from('astrologers')
      .update({ approval_status: newStatus })
      .eq('id', astrologer.id);

    if (updateError) throw updateError;

    console.log(`Astrologer ${astrologer.name} (${astrologer.id}) status updated to: ${newStatus}`);

    // Step 7: If approved, provision their CometChat user
    if (isApproved) {
      await provisionCometChatUser(astrologer);
    }

    // Step 8: Send notification email via Shopify (optional — uses admin API email)
    // We log for now; email integration goes in Phase 6
    console.log(`[EMAIL TODO] Send '${newStatus}' email to ${astrologer.email}`);

    return res.status(200).json({ success: true, status: newStatus, astrologer_id: astrologer.id });

  } catch (error) {
    console.error('Customer update webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// ─── Helper: Provision CometChat user for newly approved astrologer ──────────

async function provisionCometChatUser(astrologer) {
  const appId   = process.env.COMETCHAT_APP_ID;
  const region  = process.env.COMETCHAT_REGION;
  const authKey = process.env.COMETCHAT_AUTH_KEY;
  const uid     = `astro_${astrologer.id}`;
  const baseUrl = `https://${appId}.api-${region}.cometchat.io/v3`;

  try {
    await axios.post(
      `${baseUrl}/users`,
      { uid, name: astrologer.name, withAuthToken: false },
      {
        headers: {
          appid:  appId,
          apikey: authKey,
          'Content-Type': 'application/json'
        }
      }
    ).catch(err => {
      if (err.response?.status !== 409) throw err; // 409 = already exists, that's fine
    });

    // Save the CometChat UID back to Supabase
    await supabase
      .from('astrologers')
      .update({ cometchat_uid: uid })
      .eq('id', astrologer.id);

    console.log(`CometChat user provisioned: ${uid}`);
  } catch (err) {
    // Non-fatal — log and continue
    console.error('CometChat provisioning failed:', err.response?.data || err.message);
  }
}
