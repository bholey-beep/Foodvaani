const { Schema, model } = require('mongoose');

const STATUSES = ['available', 'reserved', 'partially_collected', 'collected', 'expired'];
const ACTIVE_STATUSES = ['available', 'reserved', 'partially_collected'];

const donationSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },

    foodName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    remainingQuantity: { type: Number, min: 0 },
    unit: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['cooked_meal', 'bakery', 'snacks', 'raw_produce', 'packaged', 'beverages', 'other'],
      default: 'cooked_meal',
    },
    diet: { type: String, enum: ['veg', 'non_veg', 'egg', 'unknown'], default: 'unknown' },

    // Snapshot of where/who at time of listing, so edits to the profile don't rewrite history
    restaurantName: String,
    contactPerson: String,
    contactNumber: String,
    location: { type: String, required: true },
    area: { type: String, index: true },

    preparedAt: Date,
    pickupDeadline: { type: Date, required: true, index: true },
    storageCondition: String,
    allergens: [String],
    notes: String,

    // Voice pipeline
    source: { type: String, enum: ['voice', 'manual'], default: 'manual' },
    transcription: String,
    language: { type: String, default: 'en-IN' },
    extractionEngine: String,

    // Owner declaration (food safety)
    ownerDeclaration: { type: Boolean, required: true },
    confirmedAt: Date,

    status: { type: String, enum: STATUSES, default: 'available', index: true },

    // Timbre
    audioUrl: String,
    audioText: String,
    audioLanguage: String,
    audioError: String,
  },
  { timestamps: true }
);

donationSchema.pre('save', function setRemaining(next) {
  if (this.isNew && (this.remainingQuantity === undefined || this.remainingQuantity === null)) {
    this.remainingQuantity = this.quantity;
  }
  next();
});

const Donation = model('Donation', donationSchema);
Donation.STATUSES = STATUSES;
Donation.ACTIVE_STATUSES = ACTIVE_STATUSES;

module.exports = Donation;
