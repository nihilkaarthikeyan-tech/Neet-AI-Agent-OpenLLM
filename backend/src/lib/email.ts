import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, otp: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
  const isReset = type === 'PASSWORD_RESET';
  const subject = isReset ? 'Reset your NEET AI password' : 'Verify your NEET AI email';
  const heading = isReset ? 'Password Reset OTP' : 'Email Verification OTP';
  const body = isReset
    ? 'You requested a password reset. Use the OTP below to set a new password.'
    : 'Welcome to NEET AI! Use the OTP below to verify your email address.';

  await transporter.sendMail({
    from: `"NEET AI" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
        <h2 style="color:#4f46e5;margin-bottom:8px">${heading}</h2>
        <p style="color:#475569;margin-bottom:24px">${body}</p>
        <div style="background:#fff;border:2px solid #e2e8f0;border-radius:8px;padding:24px;text-align:center">
          <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#1e293b">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:8px">If you did not request this, ignore this email.</p>
      </div>
    `,
  });
}
