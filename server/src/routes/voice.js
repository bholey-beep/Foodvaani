const router = require('express').Router();
const multer = require('multer');
const { requireAuth, requireRole } = require('../middleware/auth');
const { Restaurant } = require('../models/Profiles');
const prisma = require('../services/prisma');
const { extract } = require('../services/extractor');
const { validateDraft } = require('../services/validator');
const { ah, HttpError } = require('../utils/http');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^audio\/(wav|x-wav|wave|mpeg|mp3|ogg|flac|aac|mp4|m4a|x-m4a)$/.test(file.mimetype);
    cb(ok ? null : new HttpError(400, 'Upload a WAV, MP3, OGG, FLAC, AAC or M4A file.'), ok);
  },
});

const restaurantOnly = [requireAuth, requireRole('restaurant')];

// Step 3: Prisma speech to text
router.post('/transcribe', restaurantOnly, upload.single('audio'), ah(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No audio received. Please record again.');
  const result = await prisma.transcribe({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    filename: req.file.originalname,
    language: req.body.language,
  });
  if (!result.transcript) throw new HttpError(422, 'We could not hear any speech. Try recording again a little closer to the mic.');
  res.json(result);
}));

// Step 4 + 5: extraction, then merge with saved profile and validate
router.post('/extract', restaurantOnly, ah(async (req, res) => {
  const transcript = String(req.body.transcript || '').trim();
  if (!transcript) throw new HttpError(400, 'Transcript is empty.');
  if (transcript.length > 3000) throw new HttpError(400, 'Transcript is too long.');

  const restaurant = await Restaurant.findOne({ user: req.user._id });
  const { fields, missingFields, engine } = await extract(transcript);

  const draft = { ...fields, location: restaurant.address, allergens: fields.allergens || [] };
  const validation = await validateDraft(draft, restaurant);

  res.json({ draft, missingFields, engine, validation: { errors: validation.errors, warnings: validation.warnings, valid: validation.valid } });
}));

module.exports = router;
