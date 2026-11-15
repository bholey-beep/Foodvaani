const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { HttpError } = require('../utils/http');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Please sign in to continue.');

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new HttpError(401, 'Your session has expired. Please sign in again.');
    }

    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, 'Account not found.');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, 'This action is not available for your account type.'));
  }
  if (!req.user.profileComplete) {
    return next(new HttpError(403, 'Please complete your profile first.'));
  }
  next();
};

module.exports = { requireAuth, requireRole };
