const { Schema, model } = require('mongoose');

const statusHistorySchema = new Schema({
  donation: { type: Schema.Types.ObjectId, ref: 'Donation', required: true, index: true },
  oldStatus: String,
  newStatus: { type: String, required: true },
  remainingQuantity: Number,
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // null when done by the system (auto-expiry)
  note: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = model('StatusHistory', statusHistorySchema, 'status_history');
