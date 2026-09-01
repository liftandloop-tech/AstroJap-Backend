const axios = require('axios');
const supabase = require('../config/supabase');

function getShopifyConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_DOMAIN || '0umnii-xp.myshopify.com';
  const clientId = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY || '';
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || '';
  const adminToken = process.env.SHOPIFY_ADMIN_API_KEY || process.env.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN || '';

  return { domain, clientId, clientSecret, adminToken };
}

let cachedAccessToken = '';

/**
 * Handle Shopify OAuth Installation & Callback
 */
exports.handleOAuthCallback = async (req, res) => {
  const { code, shop } = req.query;
  const config = getShopifyConfig();
  const targetShop = shop || config.domain;

  // 1. If no code, start Shopify OAuth flow by redirecting to Shopify authorize screen
  if (!code) {
    if (shop && config.clientId) {
      const redirectUri = `https://${req.headers.host || 'astro-jap-backend.vercel.app'}`;
      const authUrl = `https://${targetShop}/admin/oauth/authorize?client_id=${config.clientId}&scope=read_discounts,read_price_rules,read_products&redirect_uri=${encodeURIComponent(redirectUri)}`;
      console.log(`[Shopify OAuth] Redirecting to authorize URL: ${authUrl}`);
      return res.redirect(authUrl);
    }

    const envKeys = Object.keys(process.env).filter(k => k.startsWith('NEXG') || k.startsWith('SUPABASE') || k.startsWith('SHOPIFY'));
    return res.json({
      status: 'running',
      keys: envKeys,
      shopify: {
        configured: !!(cachedAccessToken || config.adminToken),
        shop: targetShop
      }
    });
  }

  // 2. Exchange code for permanent access token
  try {
    const clientId = config.clientId;
    const clientSecret = config.clientSecret;

    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET are required' });
    }

    console.log(`[Shopify OAuth] Exchanging code for access token for ${targetShop}...`);
    const tokenRes = await axios.post(`https://${targetShop}/admin/oauth/access_token`, {
      client_id: clientId,
      client_secret: clientSecret,
      code: code
    });

    if (tokenRes.data && tokenRes.data.access_token) {
      cachedAccessToken = tokenRes.data.access_token;
      console.log(`[Shopify OAuth] Successfully obtained access token!`);

      try {
        await supabase.from('app_settings').upsert({
          key: 'shopify_admin_token',
          value: cachedAccessToken,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (dbErr) {
        console.warn('Could not persist token to DB:', dbErr.message);
      }

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>AstroJap Discounts Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #fff; text-align: center; }
            .card { background: #1e293b; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 450px; }
            h1 { color: #10b981; font-size: 24px; margin-bottom: 12px; }
            p { color: #94a3b8; font-size: 15px; line-height: 1.5; }
            .badge { background: #334155; color: #38bdf8; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600; display: inline-block; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✓ AstroJap Discounts Connected!</h1>
            <p>Your Shopify Admin discounts are now active and will automatically sync with the storefront cart in real time.</p>
            <div class="badge">Status: Live & Connected</div>
          </div>
        </body>
        </html>
      `);
    }

    return res.status(400).json({ error: 'Failed to obtain access token from Shopify' });
  } catch (err) {
    console.error('[Shopify OAuth Error]', err.response?.data || err.message);
    return res.status(500).json({ error: 'OAuth exchange failed', details: err.response?.data || err.message });
  }
};

/**
 * Fetch all active discounts from Shopify Admin
 */
exports.getCoupons = async (req, res) => {
  try {
    const config = getShopifyConfig();
    let token = cachedAccessToken || config.adminToken;

    if (!token) {
      try {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'shopify_admin_token').single();
        if (data && data.value) {
          token = data.value;
          cachedAccessToken = token;
        }
      } catch (e) {}
    }

    const defaultCoupons = [
      {
        code: 'ASTRO100',
        title: '₹100 OFF on Special Rakhi',
        description: 'Get ₹100.00 off on Special Rakhi products',
        discount_type: 'fixed',
        discount_value: 100,
        min_order: 0,
        collections: ['Special Rakhi', 'Rakhi'],
        badge: 'SPECIAL RAKHI'
      },
      {
        code: 'ASTRO50',
        title: 'Flat ₹50 OFF',
        description: 'Get flat ₹50 discount on orders above ₹499',
        discount_type: 'fixed',
        discount_value: 50,
        min_order: 499,
        badge: 'POPULAR'
      },
      {
        code: 'WELCOME10',
        title: '10% Instant OFF',
        description: 'Special 10% discount for all customers',
        discount_type: 'percentage',
        discount_value: 10,
        min_order: 299,
        max_discount: 150,
        badge: 'NEW USER'
      }
    ];

    if (!token) {
      return res.json(defaultCoupons);
    }

    const query = `
      query GetDiscounts {
        codeDiscountNodes(first: 50) {
          nodes {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                summary
                status
                codes(first: 5) {
                  nodes {
                    code
                  }
                }
                customerGets {
                  value {
                    ... on DiscountAmount {
                      amount {
                        amount
                      }
                    }
                    ... on DiscountPercentage {
                      percentage
                    }
                  }
                  items {
                    ... on AllDiscountItems {
                      allItems
                    }
                    ... on DiscountCollections {
                      collections(first: 20) {
                        nodes {
                          id
                          title
                          handle
                        }
                      }
                    }
                    ... on DiscountProducts {
                      products(first: 20) {
                        nodes {
                          id
                          title
                          handle
                        }
                      }
                    }
                  }
                }
                minimumRequirement {
                  ... on DiscountMinimumSubtotal {
                    greaterThanOrEqualToSubtotal {
                      amount
                    }
                  }
                }
              }
              ... on DiscountCodeBxgy {
                title
                summary
                status
                codes(first: 5) {
                  nodes {
                    code
                  }
                }
              }
              ... on DiscountCodeFreeShipping {
                title
                summary
                status
                codes(first: 5) {
                  nodes {
                    code
                  }
                }
              }
            }
          }
        }
      }
    `;

    const shopifyRes = await axios.post(
      `https://${config.domain}/admin/api/2024-01/graphql.json`,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token
        }
      }
    );

    const nodes = shopifyRes.data?.data?.codeDiscountNodes?.nodes || [];
    const coupons = [];

    nodes.forEach(node => {
      const discount = node.codeDiscount;
      if (!discount) return;
      if (discount.status && discount.status !== 'ACTIVE') return;

      const codeNodes = discount.codes?.nodes || [];
      const isPercentage = !!discount.customerGets?.value?.percentage;
      const discountValue = isPercentage
        ? Math.round(discount.customerGets?.value?.percentage * 100)
        : parseFloat(discount.customerGets?.value?.amount?.amount || 0);

      const minOrder = parseFloat(discount.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount || 0);

      const collections = discount.customerGets?.items?.collections?.nodes?.map(c => c.title) || [];
      const collectionHandles = discount.customerGets?.items?.collections?.nodes?.map(c => c.handle) || [];
      const products = discount.customerGets?.items?.products?.nodes?.map(p => p.title) || [];
      const productHandles = discount.customerGets?.items?.products?.nodes?.map(p => p.handle) || [];

      let categoryInfo = '';
      if (collections.length > 0) {
        categoryInfo = `Valid on ${collections.join(', ')}`;
      } else if (products.length > 0) {
        categoryInfo = `Valid on selected products`;
      }

      codeNodes.forEach(cNode => {
        if (!cNode.code) return;
        coupons.push({
          code: cNode.code.toUpperCase(),
          title: discountValue > 0 ? (isPercentage ? `${discountValue}% OFF` : `Flat ₹${discountValue} OFF`) : discount.title,
          description: categoryInfo || discount.summary || discount.title || 'Store Discount',
          discount_type: isPercentage ? 'percentage' : 'fixed',
          discount_value: discountValue,
          min_order: minOrder,
          collections: collections,
          collection_handles: collectionHandles,
          products: products,
          product_handles: productHandles,
          badge: collections[0] ? collections[0].toUpperCase() : (discountValue > 0 ? (isPercentage ? 'PERCENTAGE OFF' : 'FLAT OFF') : 'SPECIAL OFFER')
        });
      });
    });

    if (coupons.length === 0) {
      return res.json(defaultCoupons);
    }

    res.json(coupons);
  } catch (error) {
    console.error('[Coupons Controller Error]', error.response?.data || error.message);
    res.json([
      {
        code: 'ASTRO100',
        title: '₹100 OFF on Special Rakhi',
        description: 'Get ₹100.00 off on Special Rakhi products',
        discount_type: 'fixed',
        discount_value: 100,
        min_order: 0,
        collections: ['Special Rakhi', 'Rakhi'],
        badge: 'SPECIAL RAKHI'
      },
      {
        code: 'ASTRO50',
        title: 'Flat ₹50 OFF',
        description: 'Get flat ₹50 discount on orders above ₹499',
        discount_type: 'fixed',
        discount_value: 50,
        min_order: 499,
        badge: 'POPULAR'
      },
      {
        code: 'WELCOME10',
        title: '10% Instant OFF',
        description: 'Special 10% discount for all customers',
        discount_type: 'percentage',
        discount_value: 10,
        min_order: 299,
        max_discount: 150,
        badge: 'NEW USER'
      }
    ]);
  }
};
