// Marks listings as expired once their pickup deadline passes. Runs every minute.
const Donation = require('../models/Donation');
const StatusHistory = require('../models/StatusHistory');

async function expireOverdue() {
  const overdue = await Donation.find({
    status: { $in: Donation.ACTIVE_STATUSES },
    pickupDeadline: { $lte: new Date() },
  }).select('_id status remainingQuantity');
  if (!overdue.length) return 0;

  await Donation.updateMany({ _id: { $in: overdue.map((d) => d._id) } }, { $set: { status: 'expired' } });
  await StatusHistory.insertMany(overdue.map((d) => ({
    donation: d._id, oldStatus: d.status, newStatus: 'expired', remainingQuantity: d.remainingQuantity, note: 'Pickup deadline passed',
  })));
  console.log(`[expiry] expired ${overdue.length} listing(s)`);
  return overdue.length;
}

function startExpiryJob() {
  const run = () => expireOverdue().catch((e) => console.error('[expiry]', e.message));
  run();
  return setInterval(run, 60 * 1000);
}

module.exports = { startExpiryJob, expireOverdue };
