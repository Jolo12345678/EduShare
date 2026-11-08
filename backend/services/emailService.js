/**
 * EduShare Real Gmail Email Delivery Service
 * 
 * ============================================================================
 * OFFICIAL EDUSHARE CONFIGURATION (Phase 2):
 * ============================================================================
 * Official Gmail Address: edushare12@gmail.com
 * SMTP Host: smtp.gmail.com
 * SMTP Port: 465 (SSL/TLS)
 * Sender: EduShare <edushare12@gmail.com>
 * 
 * IMPORTANT:
 * - edushare12@gmail.com is strictly the SENDER.
 * - Recipient is the registered user's email (student or teacher).
 * - App Password must be configured in .env (never hardcoded, never logged).
 * ============================================================================
 */

const nodemailer = require('nodemailer');
const config = require('../config/env');

let transporterInstance = null;

/**
 * Returns a configured Nodemailer transporter using Gmail SSL SMTP.
 */
function getTransporter() {
  if (transporterInstance) {
    return transporterInstance;
  }

  transporterInstance = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure, // true for port 465 (SSL)
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    },
    tls: {
      rejectUnauthorized: true
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  return transporterInstance;
}

/**
 * Dispatches an email using the primary Gmail SMTP transport (Port 465 SSL/TLS).
 * Supports optional HTTPS relay fallback if configured (SMTP_WEBHOOK_URL) or if
 * outbound SMTP ports are firewalled by cloud hosting providers.
 */
async function dispatchEmail(mailOptions) {
  // If SMTP_WEBHOOK_URL is configured
  if (config.smtp.webhookUrl) {
    try {
      const webhookRes = await fetch(config.smtp.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text,
          html: mailOptions.html,
          from: mailOptions.from
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (webhookRes.ok) {
        return { messageId: `relay-${Date.now()}`, recipient: mailOptions.to };
      }
    } catch (err) {
      console.warn(`[EduShare EmailService] Webhook dispatch warning: ${err.message}`);
    }
  }

  // Primary: Native Gmail SMTP SSL port 465
  const transporter = getTransporter();
  try {
    const info = await transporter.sendMail(mailOptions);
    return { messageId: info.messageId, recipient: mailOptions.to };
  } catch (smtpErr) {
    if (config.smtp.webhookUrl) {
      try {
        const webhookRes = await fetch(config.smtp.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: mailOptions.to,
            subject: mailOptions.subject,
            text: mailOptions.text,
            html: mailOptions.html,
            from: mailOptions.from
          }),
          signal: AbortSignal.timeout(10000)
        });
        if (webhookRes.ok) {
          return { messageId: `fallback-relay-${Date.now()}`, recipient: mailOptions.to };
        }
      } catch (webhookErr) {
        console.warn(`[EduShare EmailService] Webhook fallback failed: ${webhookErr.message}`);
      }
    }
    throw smtpErr;
  }
}

/**
 * Validates the SMTP connection with Gmail.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function verifySmtpConnection() {
  if (!config.smtp.pass && !config.smtp.webhookUrl) {
    return {
      ok: false,
      message: 'SMTP_PASS is not configured. A Gmail App Password or SMTP_WEBHOOK_URL is required.'
    };
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { ok: true, message: 'Gmail SMTP connection verified successfully.' };
  } catch (err) {
    if (config.smtp.webhookUrl) {
      return { ok: true, message: `Gmail SMTP port 465 unavailable (${err.message}); HTTPS email relay is active.` };
    }
    return {
      ok: false,
      message: `Gmail SMTP authentication failed: ${err.message}`
    };
  }
}

/**
 * Sends a branded verification email to a newly registered student or teacher.
 * 
 * @param {string} toEmail User's registered email
 * @param {string} rawToken Unhashed 32-byte hexadecimal verification token
 * @param {string} [recipientName] User's full name
 * @returns {Promise<{ messageId: string, recipient: string }>}
 */
async function sendVerificationEmail(toEmail, rawToken, recipientName = '') {
  if (!config.smtp.pass) {
    const errorMsg = 'Cannot send verification email: SMTP_PASS is missing in .env. Please configure your 16-character Gmail App Password.';
    console.error(`[EduShare EmailService] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const verificationUrl = `${config.frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const displayName = recipientName ? ` ${recipientName}` : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your EduShare Account</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f7fc;
      font-family: Arial, Helvetica, sans-serif;
      color: #142b54;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f7fc;
      padding: 40px 15px;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(6, 38, 95, 0.08);
      border: 1px solid #d5deed;
    }
    .header {
      background: linear-gradient(135deg, #031c49 0%, #06265f 100%);
      padding: 30px 40px;
      text-align: center;
      color: #ffffff;
    }
    .brand-mark {
      display: inline-block;
      width: 44px;
      height: 44px;
      line-height: 44px;
      background: #ffc400;
      color: #06265f;
      font-weight: 800;
      font-size: 20px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .brand-sub {
      font-size: 11px;
      color: #ffc400;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .content {
      padding: 36px 40px;
      color: #142b54;
    }
    .greeting {
      font-size: 20px;
      font-weight: 700;
      color: #06265f;
      margin-bottom: 16px;
    }
    .text {
      font-size: 15px;
      color: #334e68;
      margin-bottom: 20px;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .verify-btn {
      display: inline-block;
      background: #087ed0;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 16px;
      font-weight: 700;
      padding: 14px 34px;
      border-radius: 8px;
      letter-spacing: 0.5px;
    }
    .verify-btn:hover {
      background: #06265f;
    }
    .expiration-note {
      font-size: 13px;
      color: #627d98;
      background: #f0f4f8;
      border-left: 4px solid #ffc400;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .backup-box {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #627d98;
      word-break: break-all;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 40px;
      text-align: center;
      font-size: 12px;
      color: #829ab1;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand-mark">UA</div>
        <div class="brand-title">EduShare</div>
        <div class="brand-sub">University of the Assumption</div>
      </div>
      <div class="content">
        <div class="greeting">Hello${displayName}!</div>
        <p class="text">Welcome to EduShare!</p>
        <p class="text">Thank you for creating your account.</p>
        <p class="text">To activate your account and start using EduShare, please verify your email address by clicking the button below.</p>
        
        <div class="btn-container">
          <a href="${verificationUrl}" class="verify-btn" target="_blank" rel="noopener">VERIFY MY ACCOUNT</a>
        </div>
        
        <div class="expiration-note">
          Your verification link expires after <strong>24 hours</strong>.
        </div>
        
        <p class="text" style="font-size: 13px; color: #627d98;">
          If you did not create this account, you can safely ignore this email.
        </p>
        
        <div class="backup-box">
          <strong>Button not working?</strong> Copy and paste this URL into your browser:<br>
          <a href="${verificationUrl}" style="color: #087ed0;">${verificationUrl}</a>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 4px 0;">Thank you,</p>
        <p style="margin: 0; font-weight: 700; color: #06265f;">EduShare Team</p>
        <p style="margin: 12px 0 0 0; font-size: 11px;">University of the Assumption · EduShare Educational Platform</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Hello${displayName}!

Welcome to EduShare!

Thank you for creating your account.

To activate your account and start using EduShare, please verify your email address by clicking the link below:

${verificationUrl}

Your verification link expires after 24 hours.

If you did not create this account, you can safely ignore this email.

Thank you,
EduShare Team
  `.trim();

  const mailOptions = {
    from: config.smtp.from,
    to: toEmail,
    subject: 'Verify Your EduShare Account',
    text,
    html
  };

  return await dispatchEmail(mailOptions);
}

/**
 * Sends a password recovery email to a user requesting a reset.
 * 
 * @param {string} toEmail User's registered email
 * @param {string} rawToken Unhashed 32-byte hexadecimal reset token
 * @param {string} [recipientName] User's full name
 * @returns {Promise<{ messageId: string, recipient: string }>}
 */
async function sendPasswordResetEmail(toEmail, rawToken, recipientName = '') {
  if (!config.smtp.pass) {
    const errorMsg = 'Cannot send password reset email: SMTP_PASS is missing in .env. Please configure your 16-character Gmail App Password.';
    console.error(`[EduShare EmailService] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const resetUrl = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const displayName = recipientName ? ` ${recipientName}` : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your EduShare Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f7fc;
      font-family: Arial, Helvetica, sans-serif;
      color: #142b54;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f7fc;
      padding: 40px 15px;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(6, 38, 95, 0.08);
      border: 1px solid #d5deed;
    }
    .header {
      background: linear-gradient(135deg, #031c49 0%, #06265f 100%);
      padding: 30px 40px;
      text-align: center;
      color: #ffffff;
    }
    .brand-mark {
      display: inline-block;
      width: 44px;
      height: 44px;
      line-height: 44px;
      background: #ffc400;
      color: #06265f;
      font-weight: 800;
      font-size: 20px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .brand-sub {
      font-size: 11px;
      color: #ffc400;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .content {
      padding: 36px 40px;
      color: #142b54;
    }
    .greeting {
      font-size: 20px;
      font-weight: 700;
      color: #06265f;
      margin-bottom: 16px;
    }
    .text {
      font-size: 15px;
      color: #334e68;
      margin-bottom: 20px;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .reset-btn {
      display: inline-block;
      background: #087ed0;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 16px;
      font-weight: 700;
      padding: 14px 34px;
      border-radius: 8px;
      letter-spacing: 0.5px;
    }
    .reset-btn:hover {
      background: #06265f;
    }
    .expiration-note {
      font-size: 13px;
      color: #627d98;
      background: #fff8e6;
      border-left: 4px solid #ffc400;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .backup-box {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #627d98;
      word-break: break-all;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 40px;
      text-align: center;
      font-size: 12px;
      color: #829ab1;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand-mark">UA</div>
        <div class="brand-title">EduShare</div>
        <div class="brand-sub">University of the Assumption</div>
      </div>
      <div class="content">
        <div class="greeting">Hello${displayName},</div>
        <p class="text">We received a request to reset your EduShare account password.</p>
        <p class="text">Click the button below to choose a new, secure password for your account.</p>
        
        <div class="btn-container">
          <a href="${resetUrl}" class="reset-btn" target="_blank" rel="noopener">RESET MY PASSWORD</a>
        </div>
        
        <div class="expiration-note">
          This password reset link expires after <strong>30 minutes</strong>.
        </div>
        
        <p class="text" style="font-size: 13px; color: #627d98;">
          If you did not request a password reset, you can safely ignore this email. Your account remains secure.
        </p>
        
        <div class="backup-box">
          <strong>Button not working?</strong> Copy and paste this URL into your browser:<br>
          <a href="${resetUrl}" style="color: #087ed0;">${resetUrl}</a>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 4px 0;">Thank you,</p>
        <p style="margin: 0; font-weight: 700; color: #06265f;">EduShare Team</p>
        <p style="margin: 12px 0 0 0; font-size: 11px;">University of the Assumption · EduShare Educational Platform</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Hello${displayName},

We received a request to reset your EduShare account password.

To reset your password, please open the following link in your browser:

${resetUrl}

This password reset link expires after 30 minutes.

If you did not request a password reset, you can safely ignore this email.

Thank you,
EduShare Team
  `.trim();

  const mailOptions = {
    from: config.smtp.from,
    to: toEmail,
    subject: 'EduShare – Password Reset Request',
    text,
    html
  };

  return await dispatchEmail(mailOptions);
}

/**
 * Sends a confirmation email when an account is successfully verified.
 * Highlights AES-256-GCM and Argon2id security architecture.
 * 
 * @param {string} toEmail User's registered email
 * @param {string} [recipientName] User's full name
 * @param {string} [role] User role (student or teacher)
 * @returns {Promise<{ messageId: string, recipient: string }>}
 */
async function sendAccountVerifiedEmail(toEmail, recipientName = '', role = 'student') {
  if (!config.smtp.pass && !process.env.SMTP_WEBHOOK_URL) {
    console.warn(`[EduShare EmailService] SMTP_PASS not set. Skipping verification confirmation email to ${toEmail}.`);
    return { skipped: true };
  }

  const loginUrl = `${config.frontendUrl}/`;
  const displayName = recipientName ? ` ${recipientName}` : '';
  const roleDisplay = role === 'teacher' ? 'Teacher' : 'Student';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EduShare Account Activated</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f7fc; font-family: Arial, Helvetica, sans-serif; color: #142b54; line-height: 1.6; }
    .wrapper { width: 100%; background-color: #f4f7fc; padding: 40px 15px; }
    .card { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(6,38,95,0.08); border: 1px solid #d5deed; }
    .header { background: linear-gradient(135deg, #031c49 0%, #06265f 100%); padding: 30px 40px; text-align: center; color: #ffffff; }
    .brand-mark { display: inline-block; width: 44px; height: 44px; line-height: 44px; background: #ffc400; color: #06265f; font-weight: 800; font-size: 20px; border-radius: 8px; margin-bottom: 12px; }
    .brand-title { font-size: 24px; font-weight: 700; margin: 0; }
    .brand-sub { font-size: 12px; color: #9fb3c8; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
    .content { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 700; color: #06265f; margin-bottom: 16px; }
    .text { font-size: 15px; color: #334e68; margin-bottom: 16px; }
    .security-badge { background: #eef3fb; border: 1.5px solid #d5deed; border-radius: 10px; padding: 18px 20px; margin: 24px 0; }
    .security-badge h4 { margin: 0 0 8px 0; color: #06265f; font-size: 15px; display: flex; align-items: center; gap: 8px; }
    .security-badge p { margin: 0; font-size: 13px; color: #486581; line-height: 1.5; }
    .btn-container { text-align: center; margin: 32px 0 24px 0; }
    .action-btn { display: inline-block; background: #087ed0; color: #ffffff !important; text-decoration: none; font-size: 16px; font-weight: 700; padding: 14px 34px; border-radius: 8px; }
    .footer { background-color: #f8fafc; padding: 20px 40px; text-align: center; font-size: 12px; color: #829ab1; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand-mark">UA</div>
        <div class="brand-title">EduShare</div>
        <div class="brand-sub">University of the Assumption</div>
      </div>
      <div class="content">
        <div class="greeting">Congratulations${displayName}!</div>
        <p class="text">Your EduShare account has been successfully verified and activated with the <strong>${roleDisplay}</strong> role.</p>
        <p class="text">You can now access the Smart Quiz Generator, lesson analysis, and anti-cheat exam assessments.</p>
        
        <div class="security-badge">
          <h4>🛡️ AES-256-GCM & Argon2id Security Protection</h4>
          <p>Your password is protected using memory-hard Argon2id cryptographic hashing. Your profile and sensitive activity are secured with authenticated AES-256-GCM encryption with tamper detection.</p>
        </div>

        <div class="btn-container">
          <a href="${loginUrl}" class="action-btn" target="_blank" rel="noopener">LOG IN TO EDUSHARE</a>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 4px 0;">University of the Assumption · EduShare Platform</p>
        <p style="margin: 0; font-size: 11px;">Official sender: edushare12@gmail.com</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Congratulations${displayName}!

Your EduShare account has been successfully verified and activated as a ${roleDisplay}.

Security Protection:
- Argon2id Password Hashing
- Authenticated AES-256-GCM Data Encryption

Log in to EduShare:
${loginUrl}

EduShare Team · University of the Assumption
  `.trim();

  return await dispatchEmail({
    from: config.smtp.from,
    to: toEmail,
    subject: 'EduShare - Account Successfully Activated',
    text,
    html
  });
}

/**
 * Sends a security alert email when a password has been updated.
 * 
 * @param {string} toEmail User's registered email
 * @param {string} [recipientName] User's full name
 * @returns {Promise<{ messageId: string, recipient: string }>}
 */
async function sendPasswordChangedEmail(toEmail, recipientName = '') {
  if (!config.smtp.pass && !process.env.SMTP_WEBHOOK_URL) {
    console.warn(`[EduShare EmailService] SMTP_PASS not set. Skipping password alert email to ${toEmail}.`);
    return { skipped: true };
  }

  const loginUrl = `${config.frontendUrl}/`;
  const displayName = recipientName ? ` ${recipientName}` : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EduShare Security Alert - Password Changed</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f7fc; font-family: Arial, Helvetica, sans-serif; color: #142b54; line-height: 1.6; }
    .wrapper { width: 100%; background-color: #f4f7fc; padding: 40px 15px; }
    .card { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(6,38,95,0.08); border: 1px solid #d5deed; }
    .header { background: linear-gradient(135deg, #031c49 0%, #06265f 100%); padding: 30px 40px; text-align: center; color: #ffffff; }
    .brand-mark { display: inline-block; width: 44px; height: 44px; line-height: 44px; background: #ffc400; color: #06265f; font-weight: 800; font-size: 20px; border-radius: 8px; margin-bottom: 12px; }
    .brand-title { font-size: 24px; font-weight: 700; margin: 0; }
    .brand-sub { font-size: 12px; color: #9fb3c8; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
    .content { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 700; color: #06265f; margin-bottom: 16px; }
    .text { font-size: 15px; color: #334e68; margin-bottom: 16px; }
    .alert-box { background: #fef3f2; border-left: 4px solid #d92d20; padding: 16px; border-radius: 4px; margin: 20px 0; font-size: 14px; color: #b42318; }
    .btn-container { text-align: center; margin: 32px 0 24px 0; }
    .action-btn { display: inline-block; background: #087ed0; color: #ffffff !important; text-decoration: none; font-size: 16px; font-weight: 700; padding: 14px 34px; border-radius: 8px; }
    .footer { background-color: #f8fafc; padding: 20px 40px; text-align: center; font-size: 12px; color: #829ab1; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand-mark">UA</div>
        <div class="brand-title">EduShare</div>
        <div class="brand-sub">University of the Assumption</div>
      </div>
      <div class="content">
        <div class="greeting">Security Alert${displayName}</div>
        <p class="text">The password for your EduShare account was recently changed.</p>
        
        <div class="alert-box">
          <strong>Security Action Taken:</strong> All previous active sessions across all devices have been revoked and terminated to secure your account.
        </div>

        <p class="text">If you made this change, you can safely ignore this notification and log in with your new password.</p>
        <p class="text" style="color:#b42318;">If you did NOT change your password, please contact EduShare support immediately or reset your password immediately.</p>

        <div class="btn-container">
          <a href="${loginUrl}" class="action-btn" target="_blank" rel="noopener">LOG IN TO EDUSHARE</a>
        </div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 4px 0;">University of the Assumption · EduShare Platform</p>
        <p style="margin: 0; font-size: 11px;">Official sender: edushare12@gmail.com</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Security Alert${displayName}:

Your EduShare account password has been changed.
All previous active sessions have been invalidated for security.

If you made this change, you can log in here:
${loginUrl}

If you did not make this change, please reset your password immediately.

EduShare Team · University of the Assumption
  `.trim();

  return await dispatchEmail({
    from: config.smtp.from,
    to: toEmail,
    subject: 'EduShare Security Alert - Password Changed',
    text,
    html
  });
}

module.exports = {
  verifySmtpConnection,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAccountVerifiedEmail,
  sendPasswordChangedEmail
};
