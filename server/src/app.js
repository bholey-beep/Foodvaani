
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');

const { router: authRoutes } = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const voiceRoutes = require('./routes/voice');
const donationRoutes = require('./routes/donations');

const app = express();

app.set('trust proxy', 1);

// --------------------------------------------------
// CORS CONFIGURATION
// --------------------------------------------------

const allowedOrigins = (env.clientOrigin || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, '');

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.error('[CORS] Blocked origin:', origin);

    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(express.json({ limit: '200kb' }));
app.use(morgan('dev'));

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    message: 'FoodVaani API is running',
    time: new Date().toISOString(),
  });
});

// --------------------------------------------------
// AUDIO FILES
// --------------------------------------------------

const audioDirectory = path.join(
  __dirname,
  '..',
  'uploads',
  'audio'
);

app.use(
  '/media/audio',
  express.static(audioDirectory, {
    maxAge: '7d',
  })
);

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/donations', donationRoutes);

// --------------------------------------------------
// SERVE FRONTEND IF BUILT (OPTIONAL)
// --------------------------------------------------

const clientDist = path.join(
  __dirname,
  '..',
  '..',
  'client',
  'dist'
);

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));

  app.get(/^\/(?!api(?:\/|$)|media(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// --------------------------------------------------
// API 404 HANDLER
// --------------------------------------------------

app.use('/api', (req, res) => {
  res.status(404).json({
    message: 'Incorrect API route or missing endpoint.',
  });
});

// --------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    return res.status(400).json({
      message:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Audio file is too large (max 10 MB).'
          : err.message,
    });
  }

  const status = err.status || 500;

  console.error('[API ERROR]', {
    method: req.method,
    url: req.originalUrl,
    message: err.message,
  });

  // Save server errors for debugging
  if (status >= 500) {
    try {
      const line =
        `[${new Date().toISOString()}] ` +
        `${req.method} ${req.originalUrl}\n` +
        `${err.stack || err}\n\n`;

      fs.appendFileSync(
        path.join(__dirname, '..', 'error.log'),
        line
      );
    } catch (loggingError) {
      console.error('[ERROR LOGGING FAILED]', loggingError.message);
    }
  }

  res.status(status).json({
    message:
      status >= 500 && !err.status
        ? 'Something went wrong on our side.'
        : err.message,
    ...(err.details || {}),
  });
});

module.exports = app;
