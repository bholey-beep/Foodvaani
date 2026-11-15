// Demo data: a few Hamirpur restaurants with live listings.
// Run with: npm run seed   (safe to re-run, it only touches the demo numbers below)
const env = require('./config/env');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const User = require('./models/User');
const { Restaurant } = require('./models/Profiles');
const Donation = require('./models/Donation');
const StatusHistory = require('./models/StatusHistory');

const hoursFromNow = (h) => new Date(Date.now() + h * 3600000);

const RESTAURANTS = [
  { mobile: '9000000001', hotelName: 'Sharma Bhojnalaya', ownerName: 'Rahul Sharma', area: 'NIT Hamirpur', address: 'Shop 4, near NIT Hamirpur main gate, Anu' },
  { mobile: '9000000002', hotelName: 'Hotel Hill Top', ownerName: 'Kavita Thakur', area: 'Bus Stand', address: 'Opposite New Bus Stand, Hamirpur' },
  { mobile: '9000000003', hotelName: 'Gupta Sweets & Bakery', ownerName: 'Amit Gupta', area: 'Gandhi Chowk', address: 'Main Bazaar, Gandhi Chowk, Hamirpur' },
];

const LISTINGS = [
  { r: 0, foodName: 'Vegetable biryani', quantity: 30, unit: 'plates', category: 'cooked_meal', diet: 'veg', prepared: -3, deadline: 2.5, storageCondition: 'kept hot', allergens: [], source: 'voice', language: 'hi-IN', transcription: 'Hamare paas 30 plate vegetable biryani hai, dopahar 1 baje banaya tha, shaam 6 baje tak le jaa sakte hain, garam rakha hai.' },
  { r: 1, foodName: 'Dal, rice and roti', quantity: 18, unit: 'meal boxes', category: 'cooked_meal', diet: 'veg', prepared: -2, deadline: 4, storageCondition: 'covered', allergens: ['gluten'], source: 'manual', language: 'en-IN', status: 'reserved' },
  { r: 2, foodName: 'Bread loaves and buns', quantity: 40, unit: 'pieces', category: 'bakery', diet: 'veg', prepared: -6, deadline: 7, storageCondition: 'room temperature', allergens: ['gluten', 'dairy'], source: 'voice', language: 'hi-IN', transcription: 'Chaalis piece bread aur bun bache hain, subah banaye the, raat 9 baje tak le jaiye.' },
  { r: 1, foodName: 'Chicken curry', quantity: 6, unit: 'kg', category: 'cooked_meal', diet: 'non_veg', prepared: -1.5, deadline: 1.5, storageCondition: 'refrigerated', allergens: ['dairy'], source: 'manual', language: 'en-IN' },
  { r: 0, foodName: 'Samosa', quantity: 45, unit: 'pieces', category: 'snacks', diet: 'veg', prepared: -1, deadline: 3, storageCondition: 'room temperature', allergens: ['gluten'], source: 'voice', language: 'hi-IN', status: 'partially_collected', remaining: 20, transcription: '45 samose bache hain, ek ghante pehle banaye, 3 ghante mein le jaao.' },
];

(async () => {
  await connectDB(env.mongoUri);
  const restaurants = [];
  for (const r of RESTAURANTS) {
    const user = await User.findOneAndUpdate(
      { mobileNumber: r.mobile },
      { $set: { role: 'restaurant', profileComplete: true } },
      { upsert: true, new: true }
    );
    const rest = await Restaurant.findOneAndUpdate(
      { user: user._id },
      { $set: { hotelName: r.hotelName, ownerName: r.ownerName, area: r.area, address: r.address, verifiedPhone: r.mobile, preferredLanguage: 'hi-IN' } },
      { upsert: true, new: true }
    );
    restaurants.push(rest);
  }

  const ids = restaurants.map((r) => r._id);
  const old = await Donation.find({ restaurant: { $in: ids } }).select('_id');
  await StatusHistory.deleteMany({ donation: { $in: old.map((d) => d._id) } });
  await Donation.deleteMany({ restaurant: { $in: ids } });

  for (const l of LISTINGS) {
    const r = restaurants[l.r];
    const d = await Donation.create({
      restaurant: r._id,
      foodName: l.foodName, quantity: l.quantity, remainingQuantity: l.remaining ?? l.quantity, unit: l.unit,
      category: l.category, diet: l.diet,
      restaurantName: r.hotelName, contactPerson: r.ownerName, contactNumber: r.verifiedPhone,
      location: r.address, area: r.area,
      preparedAt: hoursFromNow(l.prepared), pickupDeadline: hoursFromNow(l.deadline),
      storageCondition: l.storageCondition, allergens: l.allergens,
      source: l.source, language: l.language, transcription: l.transcription,
      ownerDeclaration: true, confirmedAt: new Date(), status: l.status || 'available', audioLanguage: l.language,
    });
    await StatusHistory.create({ donation: d._id, newStatus: 'available', note: 'Seeded' });
  }

  console.log(`[seed] ${RESTAURANTS.length} restaurants, ${LISTINGS.length} listings. Demo restaurant login: 9000000001`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
