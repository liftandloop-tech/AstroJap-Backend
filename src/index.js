const express = require('express');
const cors = require('cors');
require('dotenv').config();

const astrologerRoutes = require('./routes/astrologer.routes');
const webhookRoutes    = require('./routes/webhook.routes');
const sessionRoutes    = require('./routes/session.routes');
const walletRoutes     = require('./routes/wallet.routes');
const slotRoutes       = require('./routes/slot.routes');
const payoutRoutes     = require('./routes/payout.routes');
const reviewRoutes     = require('./routes/review.routes');

const http = require('http');
const { initSocket } = require('./services/socket.service');

const app  = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.io
initSocket(server);

// ─── CORS ────────────────────────────────────────────────────────────────────

// ─── CORS ────────────────────────────────────────────────────────────────────
// ─── Ultimate CORS fix (Wildcard) ──────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url} from ${req.headers.origin || 'No Origin'}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// ─── Raw body for Shopify webhook HMAC verification ──────────────────────────
// Must be registered BEFORE express.json() so the raw buffer is preserved.
// Both Shopify webhook routes require raw body access for HMAC checking.
app.use(
  '/api/webhooks/shopify/order-created',
  express.raw({ type: 'application/json' })
);
app.use(
  '/api/webhooks/shopify/customer-updated',
  express.raw({ type: 'application/json' })
);

// ─── JSON body parser for all other routes ───────────────────────────────────
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/astrologers', astrologerRoutes);
app.use('/api/webhooks',    webhookRoutes);
app.use('/api/sessions',    sessionRoutes);
app.use('/api/wallet',      walletRoutes);
app.use('/api/slots',       slotRoutes);
app.use('/api/payouts',     payoutRoutes);
app.use('/api/reviews',     reviewRoutes);


app.get('/', (req, res) => {
  res.send('AstroJap Backend API is running');
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
