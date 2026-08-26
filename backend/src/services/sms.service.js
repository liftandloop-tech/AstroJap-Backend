const axios = require('axios');
const crypto = require('crypto');

exports.sendOTP = async (mobile, otp) => {
  const apiKey = process.env.NEXG_API_KEY;
  const baseUrl = process.env.NEXG_API_BASE_URL || 'https://automate.nexgplatforms.com';
  
  // DLT template parameters
  const header = process.env.NEXG_HEADER || 'ASTOJP';
  const templateId = process.env.NEXG_TEMPLATE_ID || '1277178695958111044';
  const entityId = process.env.NEXG_ENTITY_ID || '1201178653359151677';

  // Sanitize phone number to keep only digits
  let cleanMobile = mobile.replace(/\D/g, '');
  if (cleanMobile.length === 10) {
    cleanMobile = '91' + cleanMobile; // prefix India country code
  }

  // Construct message matching DLT template
  const message = `Your OTP for registration on ASTROJP is ${otp} This OTP is valid for 10 minutes. Please do not share this OTP with anyone. - ASTROJP`;
  const messageId = crypto.randomUUID();

  console.log(`[SMS Service] Sending OTP ${otp} to ${mobile} (Cleaned: ${cleanMobile})...`);

  if (!apiKey || apiKey === 'your_nexg_api_key') {
    console.warn(`[SMS Service] NEXG_API_KEY not configured. FALLBACK: OTP logged to console: ${otp}`);
    return { success: true, mode: 'console', otp };
  }

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

    console.log('[SMS Service] NexG Platforms API Response:', response.data);
    return { success: true, mode: 'api', data: response.data };
  } catch (error) {
    console.error('[SMS Service] NexG Platforms API Error:', error.response?.data || error.message);
    console.warn(`[SMS Service] FALLBACK: OTP logged to console: ${otp}`);
    return { success: true, mode: 'fallback_console', otp };
  }
};
