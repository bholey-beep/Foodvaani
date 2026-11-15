const { Schema, model } = require('mongoose');

// One collection per role, as in the FoodVaani workflow doc.

const restaurantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    hotelName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    verifiedPhone: { type: String, required: true },
    fssaiNumber: { type: String, trim: true },
    preferredLanguage: { type: String, default: 'hi-IN' },
  },
  { timestamps: true }
);

const recipientSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    verifiedPhone: { type: String, required: true },
  },
  { timestamps: true }
);

const ngoSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    orgName: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    registrationNumber: { type: String, trim: true },
    verifiedPhone: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = {
  Restaurant: model('Restaurant', restaurantSchema),
  Recipient: model('Recipient', recipientSchema),
  Ngo: model('Ngo', ngoSchema),
};
