# FoodVaani

Voice-first surplus food redistribution. A restaurant says what food it has left over, in Hindi, English or 8 other Indian languages. FoodVaani turns that into a pickup listing that people and NGOs nearby can read, listen to, and call about.

Stack: React + Vite (client), Node + Express + MongoDB/Mongoose (server).
Voice: **Gnani Prisma** (speech to text) and **Gnani Timbre** (text to speech). **Gnani Evon** (or any OpenAI-compatible LLM) is optional for extraction, with a built-in rule-based extractor as fallback.

## Run it locally

You need Node 18.17+ and MongoDB (local `mongod` or a free MongoDB Atlas cluster).

```bash
# 1. backend
cd server
cp .env.example .env        # then put your GNANI_API_KEY and MONGO_URI in .env
npm install
npm run seed                # optional: 3 demo restaurants + 5 live listings in Hamirpur
npm run dev                 # http://localhost:5000

# 2. frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Or from the root: `npm run setup`, then `npm run dev:server` and `npm run dev:client`.

Sign in with any 10-digit mobile number. With `OTP_MODE=dev` the code is shown on screen and in the server console, so you can demo without an SMS provider. The seeded restaurant account is `9000000001`.

Microphone recording needs `localhost` or HTTPS. Browsers block it on plain-HTTP LAN addresses.

## The pipeline (matches the workflow doc)

| Step | Where |
| --- | --- |
| Mobile OTP sign-in, role, role-specific profile | `server/src/routes/auth.js`, `profile.js`, `client/src/pages/Login.jsx`, `Setup.jsx` |
| Record announcement (max 28 s, converted to 16 kHz WAV in the browser because Prisma doesn't take webm) | `client/src/components/Recorder.jsx`, `client/src/lib/wav.js` |
| **Prisma** STT: `POST https://api.vachana.ai/stt/v3`, `prisma-v3.0`, `indic-auto`, `format=transcribe` so numbers come back as digits | `server/src/services/prisma.js` |
| Extraction to JSON, never guessing, missing fields flagged | `server/src/services/extractor.js` |
| Business validation (times, quantity, duplicates, deadline already passed, food cooked yesterday) | `server/src/services/validator.js` |
| Owner reviews and edits the preview, ticks the food safety declaration, publishes | `client/src/pages/NewListing.jsx` |
| **Timbre** TTS: `POST https://api.vachana.ai/api/v1/tts/inference`, `timbre-v2.5`, Hindi or English script with numbers and times written as words | `server/src/services/announcement.js`, `timbre.js` |
| Feed with filters, listen button, tap to call | `client/src/pages/Feed.jsx` |
| Status lifecycle: available, reserved, partly collected, collected, expired. History in `status_history`. Auto-expiry every minute | `server/src/routes/donations.js`, `server/src/jobs/expiry.js` |

When an owner marks a listing partly collected, the audio is regenerated so it reads out the new remaining quantity.

## Environment variables (`server/.env`)

| Variable | What it does |
| --- | --- |
| `GNANI_API_KEY` | Your key from app.gnani.ai. Sent as `X-API-Key-ID`. Server only, never shipped to the browser |
| `PRISMA_MODEL` | `prisma-v3.0` (default, supports `indic-auto`) or `prisma-v2.5` |
| `TIMBRE_MODEL`, `TIMBRE_VOICE_HI`, `TIMBRE_VOICE_EN` | Model and voice per language. Check Gnani's voice catalog for names |
| `EXTRACTOR_API_URL`, `EXTRACTOR_API_KEY`, `EXTRACTOR_MODEL` | Optional. An OpenAI-compatible `/chat/completions` endpoint (Gnani Evon if you have access). Leave empty to use the rule-based extractor |
| `OTP_MODE` | `dev` shows the code on screen. For production, implement `server/src/services/sms.js` (MSG91, 2Factor, Twilio, Firebase) and set `off` |
| `PUBLIC_URL` | Base URL used in audio links. Set it to your deployed API URL |

## Deploying

Single server: run `npm run build` in `client`, then start the server. Express serves `client/dist` automatically, so one URL hosts everything.

Separate hosting (for example Vercel for the client and Render for the server): set `VITE_API_URL` in the client to your API URL, and `CLIENT_ORIGIN` and `PUBLIC_URL` in the server.

Generated audio is stored in `server/uploads/audio`. On hosts with ephemeral disks, move it to S3 or Cloudinary for production.

## API

```
POST  /api/auth/request-otp      { mobileNumber }
POST  /api/auth/verify-otp       { mobileNumber, code } -> { token, user, profile }
GET   /api/auth/me
PUT   /api/profile               { role, ...role fields }
POST  /api/voice/transcribe      multipart: audio, language        (restaurant)
POST  /api/voice/extract         { transcript }                    (restaurant)
POST  /api/donations/validate    { draft }                         (restaurant)
POST  /api/donations             { draft, ownerDeclaration, ... }  (restaurant)
GET   /api/donations             ?area&category&diet&minQty&within&q
GET   /api/donations/mine                                          (restaurant)
PATCH /api/donations/:id/status  { status, remainingQuantity? }    (restaurant)
POST  /api/donations/:id/audio   { language? }  regenerate Timbre audio
GET   /api/donations/:id/history
GET   /api/donations/stats
```

## Scope

FoodVaani handles discovery and direct contact. It does not arrange delivery, and it does not certify food safety. The owner declares that the food is fit to give away, and recipients confirm details by phone.
