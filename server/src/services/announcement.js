// Builds the script that Timbre reads out for recipients.
// Gnani recommends writing numbers and times as words, so we spell them out here.
const { dateToIstTime } = require('../utils/time');

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function enWords(n) {
  n = Math.floor(n);
  if (n < 20) return EN_ONES[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? ` ${EN_ONES[n % 10]}` : '');
  if (n < 1000) {
    const rest = n % 100;
    return `${EN_ONES[Math.floor(n / 100)]} hundred${rest ? ` ${enWords(rest)}` : ''}`;
  }
  if (n < 100000) {
    const rest = n % 1000;
    return `${enWords(Math.floor(n / 1000))} thousand${rest ? ` ${enWords(rest)}` : ''}`;
  }
  return String(n);
}

// Hindi numbers 0-100 are irregular, so a lookup table is the honest way to do it.
const HI = ('शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस ' +
  'इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस ' +
  'इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ ' +
  'इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी ' +
  'इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे सौ').split(' ');

function hiWords(n) {
  n = Math.floor(n);
  if (n <= 100) return HI[n];
  if (n < 1000) {
    const rest = n % 100;
    return `${HI[Math.floor(n / 100)]} सौ${rest ? ` ${HI[rest]}` : ''}`;
  }
  if (n < 100000) {
    const rest = n % 1000;
    return `${hiWords(Math.floor(n / 1000))} हज़ार${rest ? ` ${hiWords(rest)}` : ''}`;
  }
  return String(n);
}

function qtyWords(q, lang) {
  if (!Number.isInteger(q)) {
    // 2.5 kg -> "two point five" / "ढाई" is overkill; keep digits readable
    const [a, b] = String(q).split('.');
    return lang === 'hi-IN' ? `${hiWords(Number(a))} दशमलव ${b.split('').map((x) => HI[Number(x)]).join(' ')}`
      : `${enWords(Number(a))} point ${b.split('').map((x) => EN_ONES[Number(x)]).join(' ')}`;
  }
  return lang === 'hi-IN' ? hiWords(q) : enWords(q);
}

function timeWords(date, lang) {
  const hhmm = dateToIstTime(date);
  if (!hhmm) return null;
  let [h, m] = hhmm.split(':').map(Number);

  if (lang === 'hi-IN') {
    let part = 'रात';
    if (h >= 4 && h < 12) part = 'सुबह';
    else if (h >= 12 && h < 16) part = 'दोपहर';
    else if (h >= 16 && h < 19) part = 'शाम';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    if (m === 0) return `${part} ${hiWords(h12)} बजे`;
    if (m === 30) return `${part} साढ़े ${hiWords(h12)} बजे`;
    return `${part} ${hiWords(h12)} बजकर ${hiWords(m)} मिनट`;
  }

  const suffix = h >= 12 ? 'P M' : 'A M';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${enWords(h12)} ${suffix}`;
  return `${enWords(h12)} ${m < 10 ? `oh ${enWords(m)}` : enWords(m)} ${suffix}`;
}

const HI_UNITS = {
  plate: 'प्लेट', plates: 'प्लेट', box: 'डिब्बा', boxes: 'डिब्बे', 'meal boxes': 'मील बॉक्स', kg: 'किलो',
  kilo: 'किलो', litre: 'लीटर', litres: 'लीटर', liters: 'लीटर', packet: 'पैकेट', packets: 'पैकेट',
  portions: 'हिस्से', servings: 'लोगों के लिए', pieces: 'पीस', trays: 'ट्रे', containers: 'डिब्बे', thali: 'थाली',
};

const HI_STORAGE = {
  refrigerated: 'फ्रिज में रखा गया है', 'kept hot': 'गरम रखा गया है', hot: 'गरम रखा गया है',
  'room temperature': 'कमरे के तापमान पर रखा गया है', covered: 'ढककर रखा गया है',
};

function buildAnnouncement(d, lang = 'hi-IN') {
  const qty = d.remainingQuantity ?? d.quantity;
  const deadline = timeWords(d.pickupDeadline, lang);
  const prepared = d.preparedAt ? timeWords(d.preparedAt, lang) : null;

  if (lang === 'hi-IN') {
    const unit = HI_UNITS[(d.unit || '').toLowerCase()] || d.unit;
    const parts = [
      `${d.restaurantName} पर ${qtyWords(qty, 'hi-IN')} ${unit} ${d.foodName} उपलब्ध है।`,
      prepared ? `खाना ${prepared} बनाया गया था।` : null,
      d.storageCondition ? `यह ${HI_STORAGE[d.storageCondition.toLowerCase()] || d.storageCondition}।` : null,
      `कृपया ${deadline} से पहले ${d.location} से ले जाएँ।`,
      'जाने से पहले रेस्टोरेंट को कॉल करके पुष्टि कर लें।',
    ];
    return parts.filter(Boolean).join(' ');
  }

  const parts = [
    `${d.restaurantName} has ${qtyWords(qty, 'en-IN')} ${d.unit} of ${d.foodName} available.`,
    prepared ? `It was prepared at ${prepared}.` : null,
    d.storageCondition ? `Storage: ${d.storageCondition}.` : null,
    `Please collect it from ${d.location} before ${deadline}.`,
    'Call the restaurant to confirm before you go.',
  ];
  return parts.filter(Boolean).join(' ');
}

// We have hand-written scripts for Hindi and English. Listings spoken in other
// languages are read out in Hindi by default; the owner can switch to English.
function pickAudioLanguage(requested, spokenLanguage) {
  if (requested === 'hi-IN' || requested === 'en-IN') return requested;
  if (spokenLanguage === 'en-IN') return 'en-IN';
  return 'hi-IN';
}

module.exports = { buildAnnouncement, pickAudioLanguage, enWords, hiWords };
