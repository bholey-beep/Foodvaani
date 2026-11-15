// Business validation. Runs on every draft before the owner can publish,
// and again on the final publish request (never trust the client copy).
const Donation = require('../models/Donation');
const { istTimeToDate } = require('../utils/time');

const CATEGORIES = ['cooked_meal', 'bakery', 'snacks', 'raw_produce', 'packaged', 'beverages', 'other'];
const DIETS = ['veg', 'non_veg', 'egg', 'unknown'];

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

async function validateDraft(draft, restaurant, { excludeId } = {}) {
  const errors = {};
  const warnings = [];
  const now = new Date();

  const foodName = clean(draft.foodName);
  if (!foodName) errors.foodName = 'Tell us what food is available.';
  else if (foodName.length > 80) errors.foodName = 'Keep the food name under 80 characters.';

  const quantity = Number(draft.quantity);
  if (draft.quantity === null || draft.quantity === undefined || draft.quantity === '') errors.quantity = 'Quantity is required.';
  else if (!Number.isFinite(quantity) || quantity <= 0) errors.quantity = 'Quantity must be a positive number.';
  else if (quantity > 5000) errors.quantity = 'That looks too large. Please check the quantity.';

  const unit = clean(draft.unit);
  if (!unit) errors.unit = 'Add a unit, for example plates, boxes or kg.';

  const location = clean(draft.location) || restaurant.address;
  if (!location) errors.location = 'Pickup location is required.';

  const contactNumber = restaurant.verifiedPhone; // always the verified number, never typed in
  if (!/^[6-9]\d{9}$/.test(contactNumber || '')) errors.contactNumber = 'Your verified phone number is missing. Update your profile.';

  const DAY = 24 * 3600000;
  let preparedAt = istTimeToDate(draft.preparedAt);
  // A cooking time later than now means it was cooked yesterday (e.g. 22:00, now 02:00)
  if (preparedAt && preparedAt > now) preparedAt = new Date(preparedAt.getTime() - DAY);
  if (!draft.preparedAt) errors.preparedAt = 'When was this food prepared?';
  else if (!preparedAt) errors.preparedAt = 'Use a time like 13:30.';
  else if (preparedAt > now) errors.preparedAt = 'Preparation time cannot be in the future.';

  let pickupDeadline = istTimeToDate(draft.pickupDeadline);
  // "by 1 am" said at 11 pm means tonight after midnight, not 22 hours ago
  if (pickupDeadline && pickupDeadline <= now && pickupDeadline.getTime() + DAY - now < 8 * 3600000) {
    pickupDeadline = new Date(pickupDeadline.getTime() + DAY);
  }
  if (!draft.pickupDeadline) errors.pickupDeadline = 'By what time should it be collected?';
  else if (!pickupDeadline) errors.pickupDeadline = 'Use a time like 19:00.';
  else if (pickupDeadline <= now) errors.pickupDeadline = 'This time has already passed today.';
  else if (pickupDeadline - now < 20 * 60000) warnings.push('Pickup window is under 20 minutes. Recipients may not reach in time.');

  if (preparedAt && pickupDeadline && pickupDeadline <= preparedAt) {
    errors.pickupDeadline = 'Pickup deadline must be after the preparation time.';
  }
  if (preparedAt && pickupDeadline && pickupDeadline - preparedAt > 12 * 3600000) {
    warnings.push('More than 12 hours between cooking and pickup. Please make sure the food will still be fit to eat.');
  }

  const storageCondition = clean(draft.storageCondition) || null;
  if (!storageCondition) warnings.push('Storage condition is not mentioned. Recipients find this useful.');

  const category = CATEGORIES.includes(draft.category) ? draft.category : 'cooked_meal';
  const diet = DIETS.includes(draft.diet) ? draft.diet : 'unknown';
  const allergens = Array.isArray(draft.allergens)
    ? draft.allergens.map((a) => String(a).trim()).filter(Boolean).slice(0, 10)
    : String(draft.allergens || '').split(',').map((a) => a.trim()).filter(Boolean).slice(0, 10);

  // Duplicate check: same dish still active from this restaurant
  if (foodName && restaurant._id) {
    const dup = await Donation.findOne({
      restaurant: restaurant._id,
      status: { $in: Donation.ACTIVE_STATUSES },
      foodName: new RegExp(`^${foodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).lean();
    if (dup) warnings.push(`You already have an active listing for "${dup.foodName}". Publishing again will create a second listing.`);
  }

  const listing = {
    foodName,
    quantity: Number.isFinite(quantity) ? quantity : null,
    unit,
    category,
    diet,
    location,
    area: restaurant.area,
    restaurantName: restaurant.hotelName,
    contactPerson: restaurant.ownerName,
    contactNumber,
    preparedAt,
    pickupDeadline,
    storageCondition,
    allergens,
    notes: clean(draft.notes) || undefined,
  };

  const missingFields = ['foodName', 'quantity', 'unit', 'preparedAt', 'pickupDeadline', 'storageCondition']
    .filter((f) => draft[f] === null || draft[f] === undefined || draft[f] === '');

  return { valid: Object.keys(errors).length === 0, errors, warnings, missingFields, listing };
}

module.exports = { validateDraft, CATEGORIES, DIETS };
