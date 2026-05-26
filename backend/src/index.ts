import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { prisma, pool } from './db.js';
import { startEmailWorker } from './lib/emailQueue.js';
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
import ncertRoutes from './routes/ncert.js';
import strategyRoutes from './routes/strategy.js';

// ── Sentry ───────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.2,
  });
}

const app = express();
const PORT = Number(process.env.PORT ?? 5005);
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// ── Security headers ─────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", FRONTEND_URL],
    },
  },
}));

// ── CORS ─────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// ── Body parsing ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ── HTTP request logging ─────────────────────────────────
// HTTP request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({ method: req.method, url: req.url, status: res.statusCode, ms });
  });
  next();
});

// ── Rate limiting (in-memory, swap to Redis store for multi-instance) ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7, 30);
    return req.ip ?? 'unknown';
  },
  validate: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

app.use(globalLimiter);

// ── Routes ───────────────────────────────────────────────
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
app.use('/api/ncert', ncertRoutes);
app.use('/api/strategy', strategyRoutes);

// ── Health check ─────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisPing = await redis.ping().catch(() => 'unavailable');
    res.json({ status: 'ok', db: 'connected', redis: redisPing === 'PONG' ? 'connected' : 'unavailable' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

// ── Global error handler ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────
async function start() {
  await redis.connect().catch(() => logger.warn('Redis unavailable — starting without cache'));
  startEmailWorker();

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, 'NEET AI server started');
  });

  // ── Graceful shutdown ──────────────────────────────────
  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
      await prisma.$disconnect();
      await pool.end();
      await redis.quit();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    });
    setTimeout(() => { logger.error('Forced shutdown after timeout'); process.exit(1); }, 10_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => { logger.error({ err }, 'Failed to start server'); process.exit(1); });
