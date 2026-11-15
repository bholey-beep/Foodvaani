// Turns a transcript into a structured draft listing.
// 1. If EXTRACTOR_API_URL is set (Gnani Evon or any OpenAI-compatible endpoint), ask the LLM.
// 2. Otherwise, or if the LLM call fails, use the rule-based extractor below.
// Either way we never guess: anything not clearly said is null and goes into missingFields.
const env = require('../config/env');

const FIELDS = ['foodName', 'quantity', 'unit', 'category', 'diet', 'preparedAt', 'pickupDeadline', 'storageCondition', 'allergens'];
const REQUIRED_FROM_SPEECH = ['foodName', 'quantity', 'unit', 'preparedAt', 'pickupDeadline', 'storageCondition'];

// ---------------------------------------------------------------- LLM path

const SYSTEM_PROMPT = `You extract surplus-food donation details from a restaurant owner's spoken announcement.
The text may be in English, Hindi, Hinglish or another Indian language. Reply with ONLY a JSON object, no prose.

Schema:
{
  "food_name": string|null,          // dish name in the language it was said, e.g. "Vegetable biryani"
  "quantity": number|null,
  "unit": string|null,               // plates, boxes, kg, litres, packets, portions, pieces, trays
  "category": "cooked_meal"|"bakery"|"snacks"|"raw_produce"|"packaged"|"beverages"|"other"|null,
  "diet": "veg"|"non_veg"|"egg"|null,
  "prepared_at": "HH:MM"|null,       // 24h time the food was cooked
  "pickup_deadline": "HH:MM"|null,   // 24h time by which it must be collected
  "storage_condition": string|null,  // e.g. "refrigerated", "kept hot", "room temperature"
  "allergens": string[]              // only allergens explicitly mentioned
}

Rules:
- Never guess. If something was not said, use null.
- Convert spoken times to 24h. "shaam 7 baje" = "19:00", "before 7 PM" = "19:00", "dopahar 1 baje" = "13:00".
- Do not judge whether the food is safe.`;

async function extractWithLLM(transcript) {
  const res = await fetch(env.extractor.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.extractor.key ? { Authorization: `Bearer ${env.extractor.key}` } : {}),
    },
    body: JSON.stringify({
      model: env.extractor.model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Extractor HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? data?.output ?? data?.text ?? '';
  const jsonText = String(content).match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error('Extractor did not return JSON');
  const j = JSON.parse(jsonText);

  const hhmm = (v) => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v.trim()) ? v.trim().padStart(5, '0') : null);
  return {
    foodName: j.food_name || null,
    quantity: Number(j.quantity) > 0 ? Number(j.quantity) : null,
    unit: j.unit || null,
    category: j.category || null,
    diet: j.diet || null,
    preparedAt: hhmm(j.prepared_at),
    pickupDeadline: hhmm(j.pickup_deadline),
    storageCondition: j.storage_condition || null,
    allergens: Array.isArray(j.allergens) ? j.allergens.filter(Boolean) : [],
  };
}

// ---------------------------------------------------------------- rule-based path

const DEVANAGARI_DIGITS = { '०': 0, '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9 };

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, 'twenty five': 25, thirty: 30, forty: 40, fifty: 50, hundred: 100,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  bees: 20, pachees: 25, tees: 30, chalis: 40, chaalis: 40, pachas: 50, pachaas: 50, sau: 100,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'बारह': 12, 'पंद्रह': 15, 'बीस': 20, 'पच्चीस': 25, 'तीस': 30, 'चालीस': 40, 'पचास': 50, 'सौ': 100,
};

// longest first so "meal boxes" wins over "boxes"
const UNIT_MAP = [
  ['meal boxes', 'meal boxes'], ['meal box', 'meal boxes'], ['food packets', 'packets'],
  ['plates', 'plates'], ['plate', 'plates'], ['boxes', 'boxes'], ['box', 'boxes'], ['dabbe', 'boxes'], ['dabba', 'boxes'],
  ['kilograms', 'kg'], ['kilos', 'kg'], ['kilo', 'kg'], ['kgs', 'kg'], ['kg', 'kg'],
  ['litres', 'litres'], ['liters', 'litres'], ['litre', 'litres'], ['liter', 'litres'], ['ltr', 'litres'],
  ['packets', 'packets'], ['packet', 'packets'], ['portions', 'portions'], ['portion', 'portions'],
  ['servings', 'servings'], ['people', 'servings'], ['persons', 'servings'], ['logon', 'servings'], ['log', 'servings'],
  ['pieces', 'pieces'], ['piece', 'pieces'], ['pcs', 'pieces'], ['trays', 'trays'], ['tray', 'trays'],
  ['containers', 'containers'], ['container', 'containers'], ['thalis', 'thali'], ['thali', 'thali'],
  ['प्लेट', 'plates'], ['डिब्बे', 'boxes'], ['डिब्बा', 'boxes'], ['किलो', 'kg'], ['लीटर', 'litres'],
  ['पैकेट', 'packets'], ['लोगों', 'servings'], ['थाली', 'thali'], ['पीस', 'pieces'],
];

const FOODS = [
  // [match, display, category, diet]
  ['veg biryani', 'Veg biryani', 'cooked_meal', 'veg'], ['vegetable biryani', 'Vegetable biryani', 'cooked_meal', 'veg'],
  ['chicken biryani', 'Chicken biryani', 'cooked_meal', 'non_veg'], ['biryani', 'Biryani', 'cooked_meal', null],
  ['pulao', 'Pulao', 'cooked_meal', 'veg'], ['fried rice', 'Fried rice', 'cooked_meal', null], ['rice', 'Rice', 'cooked_meal', 'veg'],
  ['dal makhani', 'Dal makhani', 'cooked_meal', 'veg'], ['dal', 'Dal', 'cooked_meal', 'veg'], ['rajma chawal', 'Rajma chawal', 'cooked_meal', 'veg'],
  ['rajma', 'Rajma', 'cooked_meal', 'veg'], ['chole bhature', 'Chole bhature', 'cooked_meal', 'veg'], ['chole', 'Chole', 'cooked_meal', 'veg'],
  ['kadhi chawal', 'Kadhi chawal', 'cooked_meal', 'veg'], ['khichdi', 'Khichdi', 'cooked_meal', 'veg'],
  ['paneer', 'Paneer curry', 'cooked_meal', 'veg'], ['sabzi', 'Sabzi', 'cooked_meal', 'veg'], ['sabji', 'Sabzi', 'cooked_meal', 'veg'],
  ['roti', 'Roti', 'cooked_meal', 'veg'], ['chapati', 'Chapati', 'cooked_meal', 'veg'], ['naan', 'Naan', 'cooked_meal', 'veg'],
  ['paratha', 'Paratha', 'cooked_meal', 'veg'], ['thali', 'Thali', 'cooked_meal', null], ['meal', 'Meals', 'cooked_meal', null],
  ['idli', 'Idli', 'cooked_meal', 'veg'], ['dosa', 'Dosa', 'cooked_meal', 'veg'], ['sambar', 'Sambar', 'cooked_meal', 'veg'],
  ['poha', 'Poha', 'cooked_meal', 'veg'], ['upma', 'Upma', 'cooked_meal', 'veg'], ['noodles', 'Noodles', 'cooked_meal', null],
  ['chicken curry', 'Chicken curry', 'cooked_meal', 'non_veg'], ['chicken', 'Chicken', 'cooked_meal', 'non_veg'],
  ['mutton', 'Mutton curry', 'cooked_meal', 'non_veg'], ['fish', 'Fish curry', 'cooked_meal', 'non_veg'], ['egg curry', 'Egg curry', 'cooked_meal', 'egg'],
  ['samosa', 'Samosa', 'snacks', 'veg'], ['pakora', 'Pakora', 'snacks', 'veg'], ['sandwich', 'Sandwiches', 'snacks', null],
  ['bread', 'Bread', 'bakery', 'veg'], ['cake', 'Cake', 'bakery', null], ['pastry', 'Pastries', 'bakery', null], ['pastries', 'Pastries', 'bakery', null],
  ['bun', 'Buns', 'bakery', 'veg'], ['cookies', 'Cookies', 'bakery', null], ['fruits', 'Fruits', 'raw_produce', 'veg'],
  ['vegetables', 'Vegetables', 'raw_produce', 'veg'], ['milk', 'Milk', 'beverages', 'veg'], ['chai', 'Tea', 'beverages', 'veg'],
  ['juice', 'Juice', 'beverages', 'veg'], ['lassi', 'Lassi', 'beverages', 'veg'], ['buttermilk', 'Buttermilk', 'beverages', 'veg'],
  ['बिरयानी', 'बिरयानी', 'cooked_meal', null], ['पुलाव', 'पुलाव', 'cooked_meal', 'veg'], ['चावल', 'चावल', 'cooked_meal', 'veg'],
  ['दाल', 'दाल', 'cooked_meal', 'veg'], ['राजमा', 'राजमा', 'cooked_meal', 'veg'], ['छोले', 'छोले', 'cooked_meal', 'veg'],
  ['खिचड़ी', 'खिचड़ी', 'cooked_meal', 'veg'], ['पनीर', 'पनीर', 'cooked_meal', 'veg'], ['सब्जी', 'सब्जी', 'cooked_meal', 'veg'],
  ['रोटी', 'रोटी', 'cooked_meal', 'veg'], ['पूरी', 'पूरी', 'cooked_meal', 'veg'], ['थाली', 'थाली', 'cooked_meal', null],
  ['समोसा', 'समोसा', 'snacks', 'veg'], ['समोसे', 'समोसे', 'snacks', 'veg'],
];

const STORAGE = [
  [/refrigerat|fridge|chilled|फ्रिज/, 'refrigerated'],
  [/kept hot|still hot|hot case|garam|गरम|गर्म/, 'kept hot'],
  [/room temperature|normal temperature|bahar rakha/, 'room temperature'],
  [/covered|packed|sealed|dhak|ढक/, 'covered'],
];

const ALLERGENS = [
  [/peanut|moongphali|मूंगफली/, 'peanuts'], [/cashew|kaju|almond|badam|nuts|dry fruit/, 'tree nuts'],
  [/\bmilk\b|dairy|paneer|cream|ghee|butter|दूध|पनीर/, 'dairy'], [/gluten|wheat|maida|atta/, 'gluten'],
  [/\begg\b|anda|अंडा/, 'egg'], [/\bsoy|soya/, 'soy'], [/\bfish\b|prawn|shrimp|मछली/, 'fish/shellfish'],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// \b does not work for Devanagari, so use a lookaround on letters/marks
const word = (s) => new RegExp(`(?<![\\p{L}\\p{M}])${escapeRe(s)}(?![\\p{L}\\p{M}])`, 'iu');

function normalise(text) {
  let t = ` ${text.toLowerCase()} `;
  t = t.replace(/[०-९]/g, (c) => DEVANAGARI_DIGITS[c]);
  t = t.replace(/(\d),(\d{3})/g, '$1$2');
  t = t.replace(/\bp\.\s?m\.?/g, 'pm').replace(/\ba\.\s?m\.?/g, 'am');
  const keys = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    // only convert number words that sit right before a unit, so "do" (Hindi "two") in "please do call" survives
    const unitAlt = UNIT_MAP.map(([u]) => escapeRe(u)).join('|');
    const re = new RegExp(`(?<![\\p{L}\\p{M}])${escapeRe(k)}\\s+(?=(?:[\\p{L}\\p{M}]+\\s+){0,2}(?:${unitAlt})(?![\\p{L}\\p{M}]))`, 'giu');
    t = t.replace(re, `${NUMBER_WORDS[k]} `);
  }
  return t;
}

function findQuantity(t) {
  const unitAlt = UNIT_MAP.map(([u]) => escapeRe(u)).join('|');
  // "20 meal boxes", "30 veg plates", "5 kg"
  const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:[\\p{L}\\p{M}]+\\s+){0,2}?(${unitAlt})(?![\\p{L}\\p{M}])`, 'iu');
  const m = t.match(re);
  if (!m) {
    // "khana 40 logon ke liye" handled above; try "for 40 people"
    const p = t.match(/for\s+(\d+)\s+(?:people|persons)/);
    if (p) return { quantity: Number(p[1]), unit: 'servings', index: p.index };
    return { quantity: null, unit: null, index: -1 };
  }
  const unit = UNIT_MAP.find(([u]) => u === m[2].toLowerCase())?.[1] || m[2];
  return { quantity: Number(m[1]), unit, index: m.index, end: m.index + m[0].length };
}

function findFood(t, qtyMatch) {
  // "20 boxes of veg pulao" -> take words after "of"
  if (qtyMatch.end) {
    const after = t.slice(qtyMatch.end).match(/^\s*(?:of\s+)?([a-z][a-z\s]{2,40}?)(?=\s+(?:available|ready|left|which|that|for|before|by|till|until|and|hai|hain|pada|bacha|,|\.)|[,.]|$)/);
    if (after) {
      const phrase = after[1].trim();
      const known = FOODS.find(([k]) => word(k).test(phrase));
      if (known && phrase.split(/\s+/).length <= 4) {
        return { name: phrase.charAt(0).toUpperCase() + phrase.slice(1), category: known[2], diet: known[3] };
      }
    }
  }
  const hits = FOODS.filter(([k]) => word(k).test(t));
  if (!hits.length) return { name: null, category: null, diet: null };
  // drop generic hits that are part of a more specific one ("biryani" inside "veg biryani")
  const specific = hits
    .filter(([k]) => !hits.some(([o]) => o !== k && o.includes(k)))
    .sort((a, b) => t.search(word(a[0])) - t.search(word(b[0])));
  const names = [...new Set(specific.map(([, d]) => d))].slice(0, 3);
  return { name: names.join(', '), category: specific[0][2], diet: specific.find((h) => h[3])?.[3] || null };
}

function to24(h, min, marker, context) {
  h = Number(h);
  min = Number(min || 0);
  if (h > 23 || min > 59) return null;
  const ctx = context || '';
  if (marker === 'pm' && h < 12) h += 12;
  else if (marker === 'am' && h === 12) h = 0;
  else if (!marker || marker === 'baje' || marker === 'बजे') {
    if (/(shaam|sham|evening|raat|night|dopahar|afternoon|शाम|रात|दोपहर)/.test(ctx) && h < 12) h += 12;
    else if (/(subah|morning|सुबह)/.test(ctx)) { /* keep am */ }
    else if (h >= 1 && h <= 7) h += 12; // "7 baje tak" for a food pickup almost always means evening
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function findTimes(t) {
  const re = /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|baje|बजे|o'?clock)?/g;
  const found = [];
  let m;
  while ((m = re.exec(t))) {
    const hasMarker = Boolean(m[3]);
    const before = t.slice(Math.max(0, m.index - 30), m.index);
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 25);
    const hasTimeWord = /(before|by|till|until|upto|up to|after|at|around|since|tak|se pehle|से पहले|तक|shaam|sham|subah|raat|dopahar|शाम|सुबह|रात|दोपहर)\s*$/.test(before)
      || /^\s*(tak|तक|se pehle|से पहले|baje|बजे)/.test(after);
    if (!hasMarker && !hasTimeWord && !m[2]) continue; // a bare number, probably a quantity
    const marker = m[3] ? m[3].replace(/o'?clock/, '') : null;
    const value = to24(m[1], m[2], marker, `${before} ${after}`);
    if (!value) continue;

    const near = before.slice(-22);
    let kind = null;
    if (/(before|by|till|until|upto|up to)\s*(shaam|sham|evening|raat|night)?\s*$/.test(near) || /^\s*(tak|तक|se pehle|से पहले)/.test(after)) {
      kind = 'deadline';
    } else if (/(prepared|made|cooked|banaya|bana|bani|pakaya|बनाया|बना|बनी)/.test(near) || /^\s*(ko\s+)?(banaya|bana|bani|बनाया|बना|बनी)/.test(after)) {
      kind = 'prepared';
    } else if (/(pick ?up|collect|le jaa|ले जा)/.test(`${near} ${after}`)) {
      kind = 'deadline';
    }
    found.push({ value, kind, index: m.index });
  }
  return found;
}

function extractWithRules(transcript) {
  const t = normalise(transcript);
  const qty = findQuantity(t);
  const food = findFood(t, qty);

  const times = findTimes(t).filter((x) => x.index !== qty.index);
  let preparedAt = times.find((x) => x.kind === 'prepared')?.value || null;
  let pickupDeadline = times.find((x) => x.kind === 'deadline')?.value || null;
  const untagged = times.filter((x) => !x.kind);
  if (!pickupDeadline && untagged.length) pickupDeadline = untagged[untagged.length - 1].value;
  if (!preparedAt && untagged.length > 1) preparedAt = untagged[0].value;
  if (preparedAt && pickupDeadline && preparedAt === pickupDeadline) preparedAt = null;

  let diet = food.diet;
  if (/(non[\s-]?veg|chicken|mutton|fish|मांसाहारी)/.test(t)) diet = 'non_veg';
  else if (/(pure veg|vegetarian|shakahari|शाकाहारी|\bveg\b)/.test(t)) diet = diet || 'veg';

  return {
    foodName: food.name,
    quantity: qty.quantity,
    unit: qty.unit,
    category: food.category,
    diet,
    preparedAt,
    pickupDeadline,
    storageCondition: STORAGE.find(([re]) => re.test(t))?.[1] || null,
    allergens: [...new Set(ALLERGENS.filter(([re]) => re.test(t)).map(([, a]) => a))],
  };
}

// ---------------------------------------------------------------- public

async function extract(transcript) {
  let fields;
  let engine = 'rules';

  if (env.extractor.url) {
    try {
      fields = await extractWithLLM(transcript);
      engine = env.extractor.model || 'llm';
    } catch (err) {
      console.warn('[extractor] LLM failed, using rule-based fallback:', err.message);
    }
  }
  if (!fields) fields = extractWithRules(transcript);

  const missingFields = REQUIRED_FROM_SPEECH.filter((f) => fields[f] === null || fields[f] === undefined || fields[f] === '');
  return { fields, missingFields, engine };
}

module.exports = { extract, extractWithRules, FIELDS };
