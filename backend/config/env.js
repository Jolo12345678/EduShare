/**
 * EduShare Environment Configuration & Validation
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const port = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Production deployed URL
const defaultProductionUrl = 'https://edushare-suul.onrender.com';
const resolvedBaseUrl = (
  process.env.RENDER_EXTERNAL_URL ||
  process.env.FRONTEND_URL ||
  (isProduction ? defaultProductionUrl : `http://localhost:${port}`)
).replace(/\/+$/, '');

// Persistent storage support: if Render persistent disk is mounted at /var/data, use it
let defaultDbPath = path.resolve(__dirname, '../../edushare.db');
if (fs.existsSync('/var/data')) {
  defaultDbPath = '/var/data/edushare.db';
}

const config = {
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  
  frontendUrl: resolvedBaseUrl,
  backendUrl: (process.env.BACKEND_URL || resolvedBaseUrl).replace(/\/+$/, ''),
  
  // Gmail SMTP Configuration
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_PORT || '465') === '465', // Port 465 uses SSL/TLS
    user: process.env.SMTP_USER || 'edushare12@gmail.com',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'EduShare <edushare12@gmail.com>',
    webhookUrl: process.env.SMTP_WEBHOOK_URL || ''
  },
  
  // Database Configuration
  databaseUrl: process.env.DATABASE_URL || defaultDbPath,
  
  // Security Keys
  sessionSecret: process.env.SESSION_SECRET || 'edushare-default-session-secret-change-in-prod-32bytes',
  aesEncryptionKey: process.env.AES_ENCRYPTION_KEY || '8918b6a453bc7c2df02b94bfebcd8353e3b0dc5484fccc30b7360a66d42215ca'
};

// Validate AES key format (32 bytes = 64 hex characters)
if (config.aesEncryptionKey.length !== 64) {
  console.warn('[EduShare Config Warning] AES_ENCRYPTION_KEY should be a 64-character hex string (32 bytes).');
}

// Check SMTP configuration status
if (!config.smtp.pass) {
  console.warn(
    '[EduShare Config Warning] SMTP_PASS is empty!\n' +
    '  -> Gmail verification and password reset emails will NOT be delivered until you configure your 16-character Gmail App Password.'
  );
}

module.exports = config;
