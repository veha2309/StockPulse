import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = Number(process.env.SMTP_PORT) || 465;
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const from = process.env.SMTP_FROM || `"StockPulse" <${user}>`;

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: {
    user,
    pass,
  },
});

export async function sendOtpEmail(email: string, otp: string) {
  if (!user || !pass) {
    console.error('Nodemailer configuration error: SMTP credentials are not set.');
    throw new Error('Email provider configuration missing.');
  }

  const mailOptions = {
    from,
    to: email,
    subject: 'Your StockPulse Verification Code',
    text: `Your 6-digit verification code is: ${otp}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #3b82f6; text-align: center;">StockPulse Verification</h2>
        <p>Hello,</p>
        <p>Thank you for registering with StockPulse. To verify your email address, please use the 6-digit verification code below:</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937; border-radius: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code is valid for 10 minutes. If you did not request this code, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="text-align: center; color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} StockPulse. All rights reserved.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
