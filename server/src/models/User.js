const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    mobileNumber: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ['restaurant', 'recipient', 'ngo', null], default: null },
    profileComplete: { type: Boolean, default: false },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);
