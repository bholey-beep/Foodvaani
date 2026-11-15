const TZ = 'Asia/Kolkata';

export function clock(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ }).replace(' ', ' ');
}

// Date -> "18:30" (IST) for <input type="time">
export function toHHMM(date) {
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).formatToParts(new Date(date));
  return `${parts.find((p) => p.type === 'hour').value}:${parts.find((p) => p.type === 'minute').value}`;
}

export function timeLeft(deadline, now = Date.now()) {
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return 'Pickup time over';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min left`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min left` : `${h} hr left`;
}

export function ago(date) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: TZ });
}

export const STATUS_LABEL = {
  available: 'Available',
  reserved: 'Reserved',
  partially_collected: 'Partly collected',
  collected: 'Collected',
  expired: 'Expired',
};

export const CATEGORY_LABEL = {
  cooked_meal: 'Cooked meals',
  bakery: 'Bakery',
  snacks: 'Snacks',
  raw_produce: 'Fruit and veg',
  packaged: 'Packaged',
  beverages: 'Drinks',
  other: 'Other',
};

export const DIET_LABEL = { veg: 'Veg', non_veg: 'Non-veg', egg: 'Contains egg', unknown: 'Diet not stated' };

export const LANGUAGES = [
  { code: 'indic-auto', label: 'Detect automatically' },
  { code: 'hi-IN', label: 'हिन्दी Hindi' },
  { code: 'en-IN', label: 'English' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ Punjabi' },
  { code: 'mr-IN', label: 'मराठी Marathi' },
  { code: 'gu-IN', label: 'ગુજરાતી Gujarati' },
  { code: 'bn-IN', label: 'বাংলা Bengali' },
  { code: 'ta-IN', label: 'தமிழ் Tamil' },
  { code: 'te-IN', label: 'తెలుగు Telugu' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ Kannada' },
  { code: 'ml-IN', label: 'മലയാളം Malayalam' },
];

export const languageName = (code) => LANGUAGES.find((l) => l.code === code)?.label.split(' ').pop() || code;

export function telLink(num) {
  return `tel:+91${String(num).replace(/\D/g, '').slice(-10)}`;
}

export function prettyPhone(num) {
  const d = String(num || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : num;
}
