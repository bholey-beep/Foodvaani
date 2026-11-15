const router = require('express').Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { Restaurant, Recipient, Ngo } = require('../models/Profiles');
const { requireAuth } = require('../middleware/auth');
const { sendOtpSms } = require('../services/sms');
const { ah, HttpError, normalizeMobile } = require('../utils/http');

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hash = (mobile, code) => crypto.createHmac('sha256', env.jwtSecret).update(`${mobile}:${code}`).digest('hex');

const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please wait a few minutes.' } });

async function loadProfile(user) {
  if (!user.role) return null;
  const Model = { restaurant: Restaurant, recipient: Recipient, ngo: Ngo }[user.role];
  return Model.findOne({ user: user._id }).lean();
}

function publicUser(user) {
  return { id: user._id, mobileNumber: user.mobileNumber, role: user.role, profileComplete: user.profileComplete };
}

router.post('/request-otp', otpLimiter, ah(async (req, res) => {
  const mobile = normalizeMobile(req.body.mobileNumber);
  if (!mobile) throw new HttpError(400, 'Enter a valid 10 digit Indian mobile number.');

  const recent = await Otp.findOne({ mobileNumber: mobile }).sort({ createdAt: -1 });
  if (recent && Date.now() - recent.createdAt.getTime() < 30000) {
    throw new HttpError(429, 'Please wait 30 seconds before requesting another code.');
  }

  const code = String(crypto.randomInt(100000, 1000000));
  await Otp.deleteMany({ mobileNumber: mobile });
  await Otp.create({ mobileNumber: mobile, codeHash: hash(mobile, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  await sendOtpSms(mobile, code);

  res.json({ sent: true, expiresInSeconds: OTP_TTL_MS / 1000, ...(env.otpMode === 'dev' ? { devCode: code } : {}) });
}));

router.post('/verify-otp', ah(async (req, res) => {
  const mobile = normalizeMobile(req.body.mobileNumber);
  const code = String(req.body.code || '').trim();
  if (!mobile || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6 digit code.');

  const otp = await Otp.findOne({ mobileNumber: mobile }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt < new Date()) throw new HttpError(400, 'This code has expired. Request a new one.');
  if (otp.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong attempts. Request a new code.');

  if (!crypto.timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hash(mobile, code)))) {
    otp.attempts += 1;
    await otp.save();
    throw new HttpError(400, `Incorrect code. ${MAX_ATTEMPTS - otp.attempts} attempts left.`);
  }

  await Otp.deleteMany({ mobileNumber: mobile });
  const user = await User.findOneAndUpdate(
    { mobileNumber: mobile },
    { $setOnInsert: { mobileNumber: mobile }, $set: { lastLoginAt: new Date() } },
    { upsert: true, new: true }
  );

  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user), profile: await loadProfile(user) });
}));

router.get('/me', requireAuth, ah(async (req, res) => {
  res.json({ user: publicUser(req.user), profile: await loadProfile(req.user) });
}));

module.exports = { router, loadProfile, publicUser };
