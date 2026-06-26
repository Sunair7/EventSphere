'use strict';

const nodemailer = require('nodemailer');

// ─── Create transporter ───────────────────────────────────────────────────────
const createTransporter = () => {
  // Check if we have SendGrid or other service configured
  if (process.env.EMAIL_HOST) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Fallback: Use Gmail (requires App Password for 2FA accounts)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  // Development fallback: Use Ethereal (fake SMTP for testing)
  // Ethereal captures emails without actually sending them
  console.warn('⚠️  No email transport configured. Using Ethereal for development.');
  console.warn('   Emails will be captured but NOT delivered to real inboxes.');
  console.warn('   View captured emails at https://ethereal.email');

  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: process.env.ETHEREAL_USER || 'ethereal-user@ethereal.email',
      pass: process.env.ETHEREAL_PASS || 'ethereal-password',
    },
  });
};

let transporter = null;

const getTransporter = async () => {
  if (!transporter) {
    transporter = createTransporter();
    
    // If using Ethereal, create a test account automatically
    if (!process.env.EMAIL_HOST && !process.env.GMAIL_USER) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log('📧 Ethereal test account created:', testAccount.user);
      } catch (err) {
        console.error('Failed to create Ethereal account:', err.message);
      }
    }
  }
  return transporter;
};

// ─── Send email ───────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transport = await getTransporter();
    
    const mailOptions = {
      from: `"EventSphere" <${process.env.EMAIL_FROM || 'noreply@eventsphere.io'}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for plain text fallback
    };

    const info = await transport.sendMail(mailOptions);
    
    console.log('✅ Email sent:', info.messageId);
    
    // If using Ethereal, show the preview URL
    if (info.messageId && !process.env.EMAIL_HOST && !process.env.GMAIL_USER) {
      console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    throw err;
  }
};

// ─── Email templates ──────────────────────────────────────────────────────────
const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};

const sendVerificationEmail = async ({ to, name, token }) => {
  const verificationUrl = `${getFrontendUrl()}/verify-email/${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #131b2e; padding: 24px; text-align: center;">
        <h1 style="color: #006a61; margin: 0;">EventSphere</h1>
      </div>
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0;">
        <h2 style="color: #131b2e; margin-top: 0;">Verify Your Email Address</h2>
        <p style="color: #45464d; line-height: 1.6;">
          Hi ${name || 'there'},<br><br>
          Thank you for registering with EventSphere! Please verify your email address by clicking the button below.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}" 
             style="background: #006a61; color: white; padding: 12px 32px; 
                    text-decoration: none; border-radius: 8px; font-weight: 600;
                    display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #45464d; line-height: 1.6;">
          Or copy and paste this link into your browser:<br>
          <span style="color: #3980f4; font-size: 13px;">${verificationUrl}</span>
        </p>
        <p style="color: #8b919a; font-size: 13px; line-height: 1.6;">
          This link will expire in 24 hours. If you didn't create an account with EventSphere, you can safely ignore this email.
        </p>
      </div>
      <div style="background: #f8fafc; padding: 16px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #8b919a; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} EventSphere Management. All rights reserved.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: 'Verify your email address — EventSphere',
    html,
  });
};

const sendPasswordResetEmail = async ({ to, name, token }) => {
  const resetUrl = `${getFrontendUrl()}/reset-password/${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #131b2e; padding: 24px; text-align: center;">
        <h1 style="color: #006a61; margin: 0;">EventSphere</h1>
      </div>
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0;">
        <h2 style="color: #131b2e; margin-top: 0;">Reset Your Password</h2>
        <p style="color: #45464d; line-height: 1.6;">
          Hi ${name || 'there'},<br><br>
          We received a request to reset your password. Click the button below to choose a new one.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" 
             style="background: #006a61; color: white; padding: 12px 32px; 
                    text-decoration: none; border-radius: 8px; font-weight: 600;
                    display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #45464d; line-height: 1.6;">
          Or copy and paste this link:<br>
          <span style="color: #3980f4; font-size: 13px;">${resetUrl}</span>
        </p>
        <p style="color: #8b919a; font-size: 13px; line-height: 1.6;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: 'Reset your password — EventSphere',
    html,
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};