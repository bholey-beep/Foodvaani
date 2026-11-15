const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { startExpiryJob } = require('./jobs/expiry');

(async () => {
  try {
    await connectDB(env.mongoUri);
  } catch (err) {
    console.error(`[db] could not connect to ${env.mongoUri}\n      ${err.message}`);
    process.exit(1);
  }
  startExpiryJob();
  app.listen(env.port, () => {
    console.log(`[api] FoodVaani API on http://localhost:${env.port}  (OTP mode: ${env.otpMode})`);
  });
})();
