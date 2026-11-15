const env = require('../config/env');

// Plug your Indian OTP provider (MSG91, 2Factor, Twilio Verify, Firebase etc.) in here.
// In dev mode the code is only logged so you can demo without an SMS account.
async function sendOtpSms(mobileNumber, code) {
  if (env.otpMode === 'dev') {
    console.log(`[otp] +91 ${mobileNumber} -> ${code}`);
    return { delivered: false, dev: true };
  }

  // Example (MSG91 / 2Factor style) - fill in and remove the throw:
  // await fetch('https://your-sms-provider/send', { method: 'POST', body: JSON.stringify({ to: `91${mobileNumber}`, code }) });
  throw new Error('SMS provider not configured. Set OTP_MODE=dev or implement sendOtpSms in src/services/sms.js');
}

module.exports = { sendOtpSms };
