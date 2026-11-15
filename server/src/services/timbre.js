// Gnani Timbre - text to speech
// Docs: https://docs.gnani.ai/api/TTS/tts-inference
// POST {base}/api/v1/tts/inference  JSON body, header X-API-Key-ID, returns raw audio bytes
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const AUDIO_DIR = path.join(__dirname, '..', '..', 'uploads', 'audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

async function synthesize({ text, language = 'hi-IN', fileId }) {
  if (!env.gnani.apiKey || env.gnani.apiKey === 'your-gnani-api-key') {
    throw new Error('Text-to-speech is not configured. Add GNANI_API_KEY to the server .env file.');
  }

  const voice = env.gnani.voices[language] || env.gnani.voices.default;
  const body = {
    text,
    voice,
    model: env.gnani.timbreModel,
    language,
    speed: 0.95, // a touch slower, it's an announcement people need to catch details from
    audio_config: {
      sample_rate: 24000,
      num_channels: 1,
      sample_width: 2,
      encoding: 'linear_pcm',
      container: 'mp3',
      bitrate: '64k',
    },
  };

  const res = await fetch(`${env.gnani.baseUrl}/api/v1/tts/inference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key-ID': env.gnani.apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const raw = await res.text();
    let msg = `Timbre returned HTTP ${res.status}`;
    try {
      const j = JSON.parse(raw);
      msg = j.message || j?.error?.message || msg;
    } catch {
      /* not json */
    }
    console.error('[timbre] error', res.status, raw.slice(0, 500));
    throw new Error(msg);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `${fileId}-${Date.now()}.mp3`;
  fs.writeFileSync(path.join(AUDIO_DIR, filename), buffer);
  return { url: `${env.publicUrl}/media/audio/${filename}`, voice, bytes: buffer.length };
}

module.exports = { synthesize, AUDIO_DIR };
