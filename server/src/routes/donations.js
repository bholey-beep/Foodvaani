const router = require('express').Router();
const Donation = require('../models/Donation');
const StatusHistory = require('../models/StatusHistory');
const { Restaurant } = require('../models/Profiles');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateDraft } = require('../services/validator');
const { buildAnnouncement, pickAudioLanguage } = require('../services/announcement');
const timbre = require('../services/timbre');
const { ah, HttpError } = require('../utils/http');

const restaurantOnly = [requireAuth, requireRole('restaurant')];

const TRANSITIONS = {
  available: ['reserved', 'partially_collected', 'collected', 'expired'],
  reserved: ['available', 'partially_collected', 'collected', 'expired'],
  partially_collected: ['reserved', 'partially_collected', 'collected', 'expired'],
  collected: [],
  expired: [],
};

async function generateAudio(donation) {
  const lang = donation.audioLanguage || 'hi-IN';
  const text = buildAnnouncement(donation, lang);
  try {
    const { url } = await timbre.synthesize({ text, language: lang, fileId: donation._id.toString() });
    donation.audioUrl = url;
    donation.audioError = undefined;
  } catch (err) {
    console.error('[timbre]', err.message);
    donation.audioError = err.message;
  }
  donation.audioText = text;
  await donation.save();
  return donation;
}

async function ownDonation(req) {
  const restaurant = await Restaurant.findOne({ user: req.user._id });
  const donation = await Donation.findById(req.params.id).catch(() => null);
  if (!donation || !donation.restaurant.equals(restaurant._id)) throw new HttpError(404, 'Listing not found.');
  return { donation, restaurant };
}

// Public numbers for the landing page
router.get('/stats', ah(async (req, res) => {
  const [active, restaurants, collected] = await Promise.all([
    Donation.countDocuments({ status: { $in: Donation.ACTIVE_STATUSES }, pickupDeadline: { $gt: new Date() } }),
    Restaurant.countDocuments(),
    Donation.find({ status: 'collected' }).select('quantity').lean(),
  ]);
  let collectedQuantity = 0;
  for (const d of collected) collectedQuantity += d.quantity;
  res.json({ active, restaurants, collectedListings: collected.length, collectedQuantity });
}));

// Dry-run validation for the review screen
router.post('/validate', restaurantOnly, ah(async (req, res) => {
  const restaurant = await Restaurant.findOne({ user: req.user._id });
  const { valid, errors, warnings, missingFields } = await validateDraft(req.body.draft || {}, restaurant);
  res.json({ valid, errors, warnings, missingFields });
}));

// Publish (step 6) + Timbre audio (step 7)
router.post('/', restaurantOnly, ah(async (req, res) => {
  const { draft = {}, ownerDeclaration, transcription, language, source, audioLanguage, extractionEngine } = req.body;
  if (ownerDeclaration !== true) {
    throw new HttpError(400, 'Please confirm the food safety declaration before publishing.');
  }
  const restaurant = await Restaurant.findOne({ user: req.user._id });
  const { valid, errors, listing } = await validateDraft(draft, restaurant);
  if (!valid) throw new HttpError(400, 'Some details need fixing before this can be published.', { errors });

  const donation = await Donation.create({
    ...listing,
    restaurant: restaurant._id,
    source: source === 'voice' ? 'voice' : 'manual',
    transcription: source === 'voice' ? String(transcription || '').slice(0, 3000) : undefined,
    language: language || restaurant.preferredLanguage,
    extractionEngine: source === 'voice' ? extractionEngine : undefined,
    ownerDeclaration: true,
    confirmedAt: new Date(),
    status: 'available',
    audioLanguage: pickAudioLanguage(audioLanguage, language),
  });
  await StatusHistory.create({ donation: donation._id, oldStatus: null, newStatus: 'available', updatedBy: req.user._id, remainingQuantity: donation.quantity, note: 'Published' });

  await generateAudio(donation);
  res.status(201).json({ donation });
}));

// Recipient / NGO feed
router.get('/', requireAuth, ah(async (req, res) => {
  const { area, category, diet, minQty, within, q } = req.query;
  const now = new Date();
  const filter = { status: { $in: Donation.ACTIVE_STATUSES }, pickupDeadline: { $gt: now } };

  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 60);
  if (area) filter.$or = [{ area: new RegExp(esc(area), 'i') }, { location: new RegExp(esc(area), 'i') }];
  if (category && category !== 'all') filter.category = category;
  if (diet && diet !== 'all') filter.diet = diet;
  if (Number(minQty) > 0) filter.remainingQuantity = { $gte: Number(minQty) };
  if (Number(within) > 0) filter.pickupDeadline.$lte = new Date(now.getTime() + Number(within) * 3600000);
  if (q) {
    const rx = new RegExp(esc(q), 'i');
    filter.$and = [{ $or: [{ foodName: rx }, { restaurantName: rx }] }];
  }

  const donations = await Donation.find(filter)
    .select('-transcription -extractionEngine -audioText -audioError')
    .sort({ pickupDeadline: 1 })
    .limit(100)
    .lean();
  // Soonest deadline first, but anything already reserved drops below what's freely available
  donations.sort((a, b) => (a.status === 'reserved') - (b.status === 'reserved'));
  const areas = await Donation.distinct('area', { status: { $in: Donation.ACTIVE_STATUSES }, pickupDeadline: { $gt: now } });
  res.json({ donations, areas: areas.filter(Boolean).sort() });
}));

// Restaurant's own listings, active first, with history
router.get('/mine', restaurantOnly, ah(async (req, res) => {
  const restaurant = await Restaurant.findOne({ user: req.user._id });
  const donations = await Donation.find({ restaurant: restaurant._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ donations });
}));

router.get('/:id', requireAuth, ah(async (req, res) => {
  const donation = await Donation.findById(req.params.id).select('-extractionEngine').lean().catch(() => null);
  if (!donation) throw new HttpError(404, 'Listing not found.');
  res.json({ donation });
}));

router.get('/:id/history', restaurantOnly, ah(async (req, res) => {
  const { donation } = await ownDonation(req);
  const history = await StatusHistory.find({ donation: donation._id }).sort({ timestamp: 1 }).lean();
  res.json({ history });
}));

// Step 9: lifecycle updates
router.patch('/:id/status', restaurantOnly, ah(async (req, res) => {
  const { donation } = await ownDonation(req);
  const { status } = req.body;
  if (!Donation.STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.');
  if (!TRANSITIONS[donation.status].includes(status)) {
    throw new HttpError(400, `A listing that is ${donation.status.replace('_', ' ')} cannot be changed to ${status.replace('_', ' ')}.`);
  }

  const oldStatus = donation.status;
  const oldRemaining = donation.remainingQuantity;

  if (status === 'partially_collected') {
    const remaining = Number(req.body.remainingQuantity);
    if (!Number.isFinite(remaining) || remaining <= 0) throw new HttpError(400, 'Enter how much is still left.');
    if (remaining >= donation.remainingQuantity) throw new HttpError(400, `Remaining must be less than ${donation.remainingQuantity}.`);
    donation.remainingQuantity = remaining;
  }
  if (status === 'collected') donation.remainingQuantity = 0;

  donation.status = status;
  await donation.save();
  await StatusHistory.create({ donation: donation._id, oldStatus, newStatus: status, updatedBy: req.user._id, remainingQuantity: donation.remainingQuantity });

  // Keep the audio honest about what's left. Runs in the background.
  if (status === 'partially_collected' && oldRemaining !== donation.remainingQuantity) {
    generateAudio(donation).catch(() => {});
  }
  res.json({ donation });
}));

// Retry / switch language for the Timbre audio
router.post('/:id/audio', restaurantOnly, ah(async (req, res) => {
  const { donation } = await ownDonation(req);
  if (req.body.language === 'hi-IN' || req.body.language === 'en-IN') donation.audioLanguage = req.body.language;
  await generateAudio(donation);
  if (donation.audioError) throw new HttpError(502, `Audio could not be generated: ${donation.audioError}`);
  res.json({ donation });
}));

module.exports = router;
