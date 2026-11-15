require('dotenv').config();

const env = {
  port: Number(process.env.PORT || 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/foodvaani',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, ''),
  otpMode: process.env.OTP_MODE || 'dev',

  gnani: {
    apiKey: process.env.GNANI_API_KEY || '',
    baseUrl: (process.env.GNANI_BASE_URL || 'https://api.vachana.ai').replace(/\/$/, ''),
    prismaModel: process.env.PRISMA_MODEL || 'prisma-v3.0',
    prismaDefaultLanguage: process.env.PRISMA_DEFAULT_LANGUAGE || 'indic-auto',
    timbreModel: process.env.TIMBRE_MODEL || 'timbre-v2.5',
    voices: {
      'hi-IN': process.env.TIMBRE_VOICE_HI || 'Nalini',
      'en-IN': process.env.TIMBRE_VOICE_EN || 'Kaveri',
      default: process.env.TIMBRE_VOICE_DEFAULT || 'Nalini',
    },
  },

  extractor: {
    url: process.env.EXTRACTOR_API_URL || '',
    key: process.env.EXTRACTOR_API_KEY || '',
    model: process.env.EXTRACTOR_MODEL || 'evon',
  },
};

if (!process.env.GNANI_API_KEY || process.env.GNANI_API_KEY === 'your-gnani-api-key') {
  console.warn('[env] GNANI_API_KEY is not set. Voice transcription and audio generation will fail until you add it.');
}

module.exports = env;
