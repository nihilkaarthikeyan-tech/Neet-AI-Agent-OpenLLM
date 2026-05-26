import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { queueOtpEmail } from '../lib/emailQueue.js';
import { logger } from '../lib/logger.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET is not set'); })();
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY ?? '';

async function verifyCaptcha(token: string | undefined): Promise<boolean> {
  if (!RECAPTCHA_SECRET || !token) return true; // skip if not configured
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token }),
  });
  const data = await res.json() as { success: boolean; score?: number };
  return data.success && (data.score ?? 1) >= 0.5;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ── Zod schemas ──────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email('Invalid email address.').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  name: z.string().min(1).max(100).trim().optional(),
  role: z.enum(['STUDENT', 'TEACHER']).default('STUDENT'),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

const otpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits.'),
});

const forgotSchema = z.object({
  email: z.string().email('Valid email required.').toLowerCase().trim(),
});

const resetSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  otp: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.').max(128),
});

// ── OTP helpers ──────────────────────────────────────────
function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

async function createOtp(userId: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'): Promise<string> {
  await prisma.otpCode.updateMany({ where: { userId, type, used: false }, data: { used: true } });
  const otp = generateOtp();
  const hash = await bcrypt.hash(otp, 10);
  await prisma.otpCode.create({
    data: { userId, code: hash, type, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  return otp;
}

async function verifyOtp(userId: string, otp: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET'): Promise<boolean> {
  const record = await prisma.otpCode.findFirst({
    where: { userId, type, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return false;
  const valid = await bcrypt.compare(otp, record.code);
  if (!valid) return false;
  await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });
  return true;
}

// ── Refresh token helpers ────────────────────────────────
async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  return raw;
}

function issueAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '15m' });
}

// ── POST /api/auth/register ──────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { email, password, name, role } = parsed.data;

  try {
    const captchaOk = await verifyCaptcha(req.body.captchaToken);
    if (!captchaOk) { res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' }); return; }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { res.status(409).json({ error: 'Email already in use.' }); return; }

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, password: hash, name, role, emailVerified: false } });

    const otp = await createOtp(user.id, 'EMAIL_VERIFY');
    await queueOtpEmail(email, otp, 'EMAIL_VERIFY');

    const accessToken = issueAccessToken(user.id, user.role);
    const refreshToken = await issueRefreshToken(user.id);

    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.status(201).json({
      token: accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: false },
      message: 'Account created. Check your email for the verification OTP.',
    });
  } catch (err) {
    logger.error({ err }, 'Register error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { email, password } = parsed.data;

  try {
    const captchaOk = await verifyCaptcha(req.body.captchaToken);
    if (!captchaOk) { res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' }); return; }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      await bcrypt.hash(password, 12); // constant-time
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    // Account lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const attempts = user.loginAttempts + 1;
      const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null;
      await prisma.user.update({ where: { id: user.id }, data: { loginAttempts: attempts, lockedUntil } });
      if (lockedUntil) {
        res.status(423).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
      } else {
        res.status(401).json({ error: `Invalid credentials. ${MAX_LOGIN_ATTEMPTS - attempts} attempt(s) remaining.` });
      }
      return;
    }

    // Reset attempts on successful login
    await prisma.user.update({ where: { id: user.id }, data: { loginAttempts: 0, lockedUntil: null } });

    if (!user.emailVerified) {
      const otp = await createOtp(user.id, 'EMAIL_VERIFY');
      await queueOtpEmail(email, otp, 'EMAIL_VERIFY');
      const accessToken = issueAccessToken(user.id, user.role);
      const refreshToken = await issueRefreshToken(user.id);
      res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000 });
      res.status(403).json({
        error: 'Email not verified. A new OTP has been sent.',
        requiresVerification: true,
        token: accessToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: false },
      });
      return;
    }

    const accessToken = issueAccessToken(user.id, user.role);
    const refreshToken = await issueRefreshToken(user.id);
    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ token: accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified } });
  } catch (err) {
    logger.error({ err }, 'Login error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/refresh ───────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const raw = req.cookies?.refresh_token as string | undefined;
  if (!raw) { res.status(401).json({ error: 'No refresh token.' }); return; }

  try {
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });

    if (!record || record.revoked || record.expiresAt < new Date()) {
      res.clearCookie('refresh_token');
      res.status(401).json({ error: 'Refresh token invalid or expired.' });
      return;
    }

    // Rotate refresh token
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
    const newRefresh = await issueRefreshToken(record.userId);
    const accessToken = issueAccessToken(record.userId, record.user.role);

    res.cookie('refresh_token', newRefresh, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ token: accessToken });
  } catch (err) {
    logger.error({ err }, 'Refresh error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/logout ────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  const raw = req.cookies?.refresh_token as string | undefined;
  if (raw) {
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    await prisma.refreshToken.updateMany({ where: { tokenHash: hash }, data: { revoked: true } }).catch(() => {});
  }
  res.clearCookie('refresh_token');
  res.json({ message: 'Logged out.' });
});

// ── POST /api/auth/verify-email ──────────────────────────
router.post('/verify-email', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = otpSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }

  try {
    const valid = await verifyOtp(req.userId!, parsed.data.otp, 'EMAIL_VERIFY');
    if (!valid) { res.status(400).json({ error: 'OTP is invalid or has expired.' }); return; }
    await prisma.user.update({ where: { id: req.userId }, data: { emailVerified: true } });
    res.json({ message: 'Email verified successfully.' });
  } catch (err) {
    logger.error({ err }, 'Verify email error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/resend-otp ────────────────────────────
router.post('/resend-otp', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
    if (user.emailVerified) { res.status(400).json({ error: 'Email already verified.' }); return; }
    const otp = await createOtp(user.id, 'EMAIL_VERIFY');
    await queueOtpEmail(user.email, otp, 'EMAIL_VERIFY');
    res.json({ message: 'OTP resent. Check your email.' });
  } catch (err) {
    logger.error({ err }, 'Resend OTP error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────
router.post('/forgot-password', async (req: Request, res: Response) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }

  try {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user) {
      const otp = await createOtp(user.id, 'PASSWORD_RESET');
      await queueOtpEmail(user.email, otp, 'PASSWORD_RESET');
    }
    // Always same response — prevents email enumeration
    res.json({ message: 'If that email exists, an OTP has been sent.' });
  } catch (err) {
    logger.error({ err }, 'Forgot password error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/reset-password ───────────────────────
router.post('/reset-password', async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { email, otp, newPassword } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(400).json({ error: 'OTP is invalid or expired.' }); return; }
    const valid = await verifyOtp(user.id, otp, 'PASSWORD_RESET');
    if (!valid) { res.status(400).json({ error: 'OTP is invalid or expired.' }); return; }
    const hash = await bcrypt.hash(newPassword, 12);
    // Revoke all refresh tokens on password reset for security
    await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } });
    await prisma.user.update({ where: { id: user.id }, data: { password: hash, loginAttempts: 0, lockedUntil: null } });
    res.clearCookie('refresh_token');
    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    logger.error({ err }, 'Reset password error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/auth/google ─────────────────────────────────
router.get('/google', (req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.BACKEND_URL ?? 'http://localhost:5005'}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// ── GET /api/auth/google/callback ────────────────────────
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) { res.redirect(`${FRONTEND_URL}/login?error=google_failed`); return; }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.BACKEND_URL ?? 'http://localhost:5005'}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json() as { id_token?: string };
    if (!tokenData.id_token) { res.redirect(`${FRONTEND_URL}/login?error=google_failed`); return; }

    // Decode the ID token (JWT) to get user info — verify signature via Google's JWKS in production
    const payload = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64url').toString()) as {
      sub: string; email: string; name?: string; email_verified?: boolean;
    };

    let user = await prisma.user.findFirst({ where: { OR: [{ googleId: payload.sub }, { email: payload.email }] } });

    if (user) {
      // Link Google ID if they registered with email before
      if (!user.googleId) await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub, emailVerified: true } });
    } else {
      user = await prisma.user.create({
        data: { email: payload.email, googleId: payload.sub, name: payload.name ?? null, emailVerified: true, role: 'STUDENT' },
      });
    }

    const accessToken = issueAccessToken(user.id, user.role);
    const refreshToken = await issueRefreshToken(user.id);

    res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000 });
    // Pass access token to frontend via URL param (frontend reads and stores it)
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${accessToken}`);
  } catch (err) {
    logger.error({ err }, 'Google OAuth error');
    res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }
});

// ── GET /api/auth/me ─────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, role: true, emailVerified: true, created_at: true },
    });
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
    res.json({ user });
  } catch (err) {
    logger.error({ err }, 'Me error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
