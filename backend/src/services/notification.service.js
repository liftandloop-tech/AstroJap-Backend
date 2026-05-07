const nodemailer = require('nodemailer');

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
