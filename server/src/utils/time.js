// FoodVaani is used in India. Spoken times like "7 baje" mean 7 in IST,
// regardless of what timezone the server happens to run in.
const IST_OFFSET_MIN = 330;

function nowIstParts(base = new Date()) {
  const ist = new Date(base.getTime() + IST_OFFSET_MIN * 60000);
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth(), d: ist.getUTCDate() };
}

// "18:30" -> Date for today 18:30 IST
function istTimeToDate(hhmm, base = new Date()) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (h > 23 || min > 59) return null;
  const { y, m, d } = nowIstParts(base);
  return new Date(Date.UTC(y, m, d, h, min) - IST_OFFSET_MIN * 60000);
}

// Date -> "18:30" in IST
function dateToIstTime(date) {
  if (!date) return null;
  const ist = new Date(new Date(date).getTime() + IST_OFFSET_MIN * 60000);
  const h = String(ist.getUTCHours()).padStart(2, '0');
  const min = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

module.exports = { istTimeToDate, dateToIstTime, IST_OFFSET_MIN };
