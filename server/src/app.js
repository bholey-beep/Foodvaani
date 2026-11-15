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
app.use(cors({ origin: env.clientOrigin.split(',').map((s) => s.trim()), credentials: true }));
app.use(express.json({ limit: '200kb' }));
app.use(morgan('dev'));

// Timbre audio files
app.use('/media/audio', express.static(path.join(__dirname, '..', 'uploads', 'audio'), { maxAge: '7d' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/donations', donationRoutes);

// Serve the built React app in production (npm run build in /client first)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|media).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Audio file is too large (max 10 MB).' : err.message });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 && !err.status ? 'Something went wrong on our side.' : err.message, ...(err.details || {}) });
});

module.exports = app;
