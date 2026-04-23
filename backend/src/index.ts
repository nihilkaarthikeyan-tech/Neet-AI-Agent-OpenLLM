import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import plannerRoutes from './routes/planner.js';
import tutorRoutes from './routes/tutor.js';
import testsRoutes from './routes/tests.js';
import flashcardsRoutes from './routes/flashcards.js';
import statsRoutes from './routes/stats.js';
import analyticsRoutes from './routes/analytics.js';
import pyqRoutes from './routes/pyq.js';
import motivationRoutes from './routes/motivation.js';
import photoDoubtRoutes from './routes/photoDoubt.js';

// Initialize Sentry before anything else (only when DSN is configured)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.2,
  });
}

const app = express();
const PORT = process.env.PORT ?? 5000;

// CORS — restrict to known frontend origin in production
app.use(cors({ origin: true, credentials: true }));

app.use(express.json({ limit: '10mb' }));

// Global rate limiter: 500 requests per 15 minutes per IP
// In production, users behind the same school/coaching WiFi share one IP
// so we keep this generous and rely on per-feature limits instead
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  // Use Authorization token as key if present, fallback to IP
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7, 30); // use first 23 chars of token as key
    return ipKeyGenerator(req.ip ?? 'unknown');
  },
  message: { error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// Strict limiter for auth endpoints: 20 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/flashcards', flashcardsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/pyq', pyqRoutes);
app.use('/api/motivation', motivationRoutes);
app.use('/api/photo-doubt', photoDoubtRoutes);

// Health check endpoint
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'NEET AI Platform API is running!' });
});

// Global error handler — reports to Sentry if configured
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
