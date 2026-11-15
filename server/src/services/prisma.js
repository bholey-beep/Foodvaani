// Gnani Prisma - speech to text
// Docs: https://docs.gnani.ai/api/STT/speech-to-text
// POST {base}/stt/v3  multipart/form-data, header X-API-Key-ID
// Clips must be <= 30 seconds. Accepts WAV, MP3, OGG, FLAC, AAC, M4A.
const env = require('../config/env');
const { HttpError } = require('../utils/http');

const SUPPORTED_LANGS = ['bn-IN', 'en-IN', 'gu-IN', 'hi-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'ta-IN', 'te-IN'];

async function transcribe({ buffer, mimeType, filename, language }) {
  if (!env.gnani.apiKey || env.gnani.apiKey === 'your-gnani-api-key') {
    throw new HttpError(503, 'Speech-to-text is not configured. Add GNANI_API_KEY to the server .env file.');
  }

  const model = env.gnani.prismaModel;
  let languageCode = language || env.gnani.prismaDefaultLanguage;
  if (languageCode === 'indic-auto' && model !== 'prisma-v3.0') languageCode = 'hi-IN';
  if (languageCode !== 'indic-auto' && !SUPPORTED_LANGS.includes(languageCode)) {
    throw new HttpError(400, `Language ${languageCode} is not supported by Prisma.`);
  }

  const form = new FormData();
  form.append('audio_file', new Blob([buffer], { type: mimeType || 'audio/wav' }), filename || 'announcement.wav');
  form.append('language_code', languageCode);
  form.append('model', model);
  // "transcribe" applies inverse text normalisation, so "bees plate" comes back as "20 plate".
  // That makes quantity / time extraction far more reliable.
  form.append('format', 'transcribe');
  form.append('topic', 'restaurant surplus food donation announcement');
  form.append('keyterms', 'plates,boxes,kg,packets,biryani,dal,roti,paneer,pickup,baje,tak');

  let res;
  try {
    res = await fetch(`${env.gnani.baseUrl}/stt/v3`, {
      method: 'POST',
      headers: { 'X-API-Key-ID': env.gnani.apiKey },
      body: form,
      signal: AbortSignal.timeout(45000),
    });
  } catch (err) {
    throw new HttpError(502, 'Could not reach Gnani Prisma. Check your internet connection and try again.');
  }

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!res.ok || data.success === false) {
    const msg = data?.error?.message || data?.message || data?.detail || `Prisma returned HTTP ${res.status}`;
    console.error('[prisma] error', res.status, raw.slice(0, 500));
    throw new HttpError(502, `Transcription failed: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }

  const transcript = typeof data.transcript === 'string' ? data.transcript : data.text || '';
  return {
    transcript: transcript.trim(),
    language: data.detected_language_code || (languageCode === 'indic-auto' ? null : languageCode),
    model: data.model || model,
    truncated: Boolean(data.truncated),
    latency: data.end_to_end_latency,
  };
}

module.exports = { transcribe, SUPPORTED_LANGS };
