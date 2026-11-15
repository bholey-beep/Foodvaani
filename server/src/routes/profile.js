const router = require('express').Router();
const { Restaurant, Recipient, Ngo } = require('../models/Profiles');
const { requireAuth } = require('../middleware/auth');
const { ah, HttpError } = require('../utils/http');
const { loadProfile, publicUser } = require('./auth');

const ROLE_FIELDS = {
  restaurant: { Model: Restaurant, required: ['hotelName', 'ownerName', 'address', 'area'], optional: ['fssaiNumber', 'preferredLanguage'] },
  recipient: { Model: Recipient, required: ['name', 'area'], optional: [] },
  ngo: { Model: Ngo, required: ['orgName', 'contactPerson', 'area'], optional: ['address', 'registrationNumber'] },
};

const LABELS = {
  hotelName: 'Restaurant or hotel name', ownerName: 'Owner or contact name', address: 'Full address', area: 'Area',
  name: 'Your name', orgName: 'Organisation name', contactPerson: 'Contact person',
};

// Create or update the role-specific profile. Role can only be picked once.
router.put('/', requireAuth, ah(async (req, res) => {
  const user = req.user;
  const role = user.role || req.body.role;
  if (!ROLE_FIELDS[role]) throw new HttpError(400, 'Choose whether you are a restaurant, an individual or an NGO.');
  if (user.role && req.body.role && req.body.role !== user.role) {
    throw new HttpError(400, 'Account type cannot be changed after setup.');
  }

  const { Model, required, optional } = ROLE_FIELDS[role];
  const data = { verifiedPhone: user.mobileNumber };
  const errors = {};
  for (const f of required) {
    const v = typeof req.body[f] === 'string' ? req.body[f].trim() : '';
    if (!v) errors[f] = `${LABELS[f] || f} is required.`;
    else data[f] = v.slice(0, 200);
  }
  for (const f of optional) {
    if (typeof req.body[f] === 'string') data[f] = req.body[f].trim().slice(0, 200);
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fill in the highlighted fields.', { errors });

  await Model.findOneAndUpdate({ user: user._id }, { $set: data, $setOnInsert: { user: user._id } }, { upsert: true, runValidators: true });
  user.role = role;
  user.profileComplete = true;
  await user.save();

  res.json({ user: publicUser(user), profile: await loadProfile(user) });
}));

module.exports = router;
