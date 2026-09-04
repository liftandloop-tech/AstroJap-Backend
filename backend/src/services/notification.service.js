const nodemailer = require('nodemailer');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendStatusNotification = async (email, name, status, reason = '') => {
  if (!process.env.SMTP_USER) {
    console.warn('[Notification] SMTP_USER not set. Skipping email.');
    return;
  }

  let subject = '';
  let text = '';

  if (status === 'approved') {
    subject = 'Congratulations! Your AstroJap Profile is Approved';
    text = `Namaste ${name},\n\nWe are excited to inform you that your profile has been approved! You can now log in to your dashboard and start accepting consultations.\n\nWelcome to the AstroJap family!`;
  } else if (status === 'rejected') {
    subject = 'Update on your AstroJap Application';
    text = `Namaste ${name},\n\nThank you for your interest in AstroJap. After reviewing your profile, we are unable to approve your application at this time.\n\nReason: ${reason}\n\nPlease feel free to update your profile and try again later.`;
  } else if (status === 'pending') {
    subject = 'Application Received - AstroJap';
    text = `Namaste ${name},\n\nYour application has been received and is currently under review. We will notify you once our team has verified your documents.`;
  }

  try {
    await transporter.sendMail({
      from: '"AstroJap Admin" <noreply@astrojap.com>',
      to: email,
      subject: subject,
      text: text,
    });
    console.log(`[Notification] Status email sent to ${email}`);
  } catch (error) {
    console.error('[Notification] Failed to send email:', error);
  }
};

exports.notifyAdminNewSignup = async (astroName, astroEmail) => {
  if (!process.env.ADMIN_EMAIL) return;

  try {
    await transporter.sendMail({
      from: '"System" <noreply@astrojap.com>',
      to: process.env.ADMIN_EMAIL,
      subject: 'New Astrologer Signup - Action Required',
      text: `A new astrologer has signed up and completed onboarding:\n\nName: ${astroName}\nEmail: ${astroEmail}\n\nPlease review their documents in the Admin Console: https://astrojap.com/pages/astrologer-admin`,
    });
  } catch (error) {
    console.error('[Notification] Admin notify failed:', error);
  }
};

exports.notifyAstrologerNewBooking = async (astroEmail, astroName, customerName, duration, scheduledAt) => {
  if (!process.env.SMTP_USER || !astroEmail) return;

  const dateStr = new Date(scheduledAt).toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  try {
    await transporter.sendMail({
      from: '"AstroJap Bookings" <noreply@astrojap.com>',
      to: astroEmail,
      subject: 'New Booking Confirmed - AstroJap',
      text: `Namaste ${astroName},\n\nA new session has been booked with you!\n\nCustomer: ${customerName}\nDuration: ${duration} minutes\nScheduled For: ${dateStr}\n\nPlease be online 5 minutes before the session starts.\n\nView your bookings: https://astrojap.com/pages/astrologer-portal`,
    });
    console.log(`[Notification] Booking email sent to ${astroEmail}`);
  } catch (error) {
    console.error('[Notification] Booking email failed:', error);
  }
};

exports.notifyAstrologerChatRequest = async (astroEmail, astroName, customerName, duration) => {
  if (!process.env.SMTP_USER || !astroEmail) return;

  try {
    await transporter.sendMail({
      from: '"AstroJap Chat" <noreply@astrojap.com>',
      to: astroEmail,
      subject: 'URGENT: New Chat Request - AstroJap',
      text: `Namaste ${astroName},\n\nYou have an immediate chat request!\n\nCustomer: ${customerName}\nDuration: ${duration} minutes\n\nPlease join the chat immediately from your dashboard: https://astrojap.com/pages/astrologer-portal`,
    });
    console.log(`[Notification] Chat request email sent to ${astroEmail}`);
  } catch (error) {
    console.error('[Notification] Chat request email failed:', error);
  }
};

// ─── AUTOMATED SMS NOTIFICATIONS (DLT COMPLIANT) ─────────────────────────────

async function getShopifyCustomerPhone(customerId) {
  const shopName = process.env.SHOPIFY_STORE_DOMAIN;
  const adminKey = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!shopName || !adminKey || !customerId) return null;

  try {
    const res = await axios.get(
      `https://${shopName}/admin/api/2024-04/customers/${customerId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': adminKey,
          'Accept': 'application/json'
        }
      }
    );
    return res.data?.customer?.phone || null;
  } catch (err) {
    console.error(`[Shopify] Failed to fetch customer phone for ID ${customerId}:`, err.message);
    return null;
  }
}

async function sendSMSViaNexG({ mobile, message, templateId }) {
  const apiKey = process.env.NEXG_API_KEY;
  const baseUrl = process.env.NEXG_API_BASE_URL || 'https://automate.nexgplatforms.com';
  const header = process.env.NEXG_HEADER || 'ASTOJP';
  const entityId = process.env.NEXG_ENTITY_ID || '1201178653359151677';

  if (!apiKey) {
    console.warn(`[SMS Service] NEXG_API_KEY not configured. Message to ${mobile}: "${message}"`);
    return;
  }

  let cleanMobile = mobile.replace(/\D/g, '');
  if (cleanMobile.length === 10) {
    cleanMobile = '91' + cleanMobile;
  }

  const messageId = require('crypto').randomUUID();

  try {
    const response = await axios.get(`${baseUrl}/api/v1/sms`, {
      params: {
        contactnumber: cleanMobile,
        header: header,
        message: message,
        messageType: 'normal',
        messageid: messageId,
        serviceType: 'transactional',
        templateid: templateId,
        entityid: entityId
      },
      headers: {
        'Authorization': apiKey,
        'Accept': 'application/json'
      }
    });
    console.log(`[SMS Service] NexG Response:`, response.data);
  } catch (err) {
    console.error(`[SMS Service] NexG request failed for ${mobile}:`, err.message);
  }
}

exports.sendBookingSMS = async ({ customerId, customerName, astrologerName, astrologerMobile, scheduledAt, price }) => {
  const customerMobile = await getShopifyCustomerPhone(customerId);

  const dateStr = new Date(scheduledAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const templateId = process.env.NEXG_BOOKING_TEMPLATE_ID || '1277178720219094004';

  if (customerMobile) {
    const customerMsg = `Dear ${customerName}, Thank you for shopping with AstroJap. Your order with Astrologer ${astrologerName} on ${dateStr} has been confirmed. Order Amount: Rs. ${price} Team AstroJap`;
    await sendSMSViaNexG({
      mobile: customerMobile,
      message: customerMsg,
      templateId
    });
  }

  if (astrologerMobile) {
    const astrologerMsg = `Dear ${astrologerName}, Thank you for shopping with AstroJap. Your order booked by ${customerName} on ${dateStr} has been confirmed. Order Amount: Rs. ${price} Team AstroJap`;
    await sendSMSViaNexG({
      mobile: astrologerMobile,
      message: astrologerMsg,
      templateId
    });
  }
};

exports.sendChatStartedSMS = async ({ session }) => {
  const { user_id: customerId, astrologer_id: astrologerId, duration_minutes: duration } = session;

  const customerMobile = await getShopifyCustomerPhone(customerId);

  const { data: userData } = await supabaseClient
    .from('users')
    .select('name')
    .eq('shopify_customer_id', customerId.toString())
    .maybeSingle();
  const customerName = userData?.name || 'Customer';

  const { data: astrologer } = await supabaseClient
    .from('astrologers')
    .select('name, mobile')
    .eq('id', astrologerId)
    .single();

  const templateId = process.env.NEXG_CHAT_TEMPLATE_ID || '1277178720219094004';

  if (customerMobile && astrologer) {
    const customerMsg = `Dear ${customerName}, Thank you for shopping with AstroJap. Your order chat with Astrologer ${astrologer.name} is now active. Join: astrojap.com/pages/astrologer-portal has been confirmed. Order Amount: Rs. ${duration} Team AstroJap`;
    await sendSMSViaNexG({
      mobile: customerMobile,
      message: customerMsg,
      templateId
    });
  }

  if (astrologer && astrologer.mobile) {
    const astrologerMsg = `Dear ${astrologer.name}, Thank you for shopping with AstroJap. Your order chat with customer ${customerName} is active. Join: astrojap.com/pages/astrologer-portal has been confirmed. Order Amount: Rs. ${duration} Team AstroJap`;
    await sendSMSViaNexG({
      mobile: astrologer.mobile,
      message: astrologerMsg,
      templateId
    });
  }
};

exports.sendAstrologerStatusSMS = async ({ mobile, name, status, reason }) => {
  if (!mobile) return;

  const templateId = process.env.NEXG_STATUS_TEMPLATE_ID || '1277178720219094004';

  if (status === 'approved') {
    const message = `Dear ${name}, Thank you for shopping with AstroJap. Your order application is approved. You are live on AstroJap. has been confirmed. Order Amount: Rs. 1 Team AstroJap`;
    await sendSMSViaNexG({ mobile, message, templateId });
  } else if (status === 'rejected') {
    const message = `Dear ${name}, Thank you for shopping with AstroJap. Your order application is rejected. Reason: ${reason || 'requirements not met'} has been confirmed. Order Amount: Rs. 0 Team AstroJap`;
    await sendSMSViaNexG({ mobile, message, templateId });
  }
};
