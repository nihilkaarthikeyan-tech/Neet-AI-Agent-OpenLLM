import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import rateLimit, { type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
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
import samacheerRoutes from './routes/samacheer.js';
import wellbeingRoutes from './routes/wellbeing.js';
import adminRoutes from './routes/admin.js';
import progressRoutes from './routes/progress.js';
import counsellingRoutes from './routes/counselling.js';
import careerRoutes from './routes/career.js';
import teacherRoutes from './routes/teacher.js';
import diagnosticRoutes from './routes/diagnostic.js';
import microlessonRoutes from './routes/microlesson.js';
import ntaRoutes from './routes/ntasimulator.js';
import snapOcrRoutes from './routes/snapocr.js';
import vocabularyRoutes from './routes/vocabulary.js';
import ncertExceptionsRoutes from './routes/ncertexceptions.js';
import outcomesRoutes from './routes/outcomes.js';
import learningToolsRoutes from './routes/learningtools.js';
import rankPredictorRoutes from './routes/rankpredictor.js';
import studyAnalyticsRoutes from './routes/studyanalytics.js';
import gamificationRoutes from './routes/gamification.js';
import dailyChallengeRoutes from './routes/dailychallenge.js';
import weeklyReportRoutes from './routes/weeklyreport.js';
import chapterTrackerRoutes from './routes/chaptertracker.js';
import notesRoutes from './routes/notes.js';
import quickReviseRoutes from './routes/quickrevise.js';
import heatmapRoutes from './routes/heatmap.js';
import communityRoutes from './routes/community.js';
import podsRoutes from './routes/pods.js';
import parentRoutes from './routes/parent.js';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET environment variable is not set.'); })();

/**
 * Rate-limit key: prefer the *verified* userId so each account gets its own
 * bucket. We must verify (not just slice) the JWT — the token header is
 * identical for every HS256 user, so slicing it would lump everyone into one
 * shared bucket and let a single abuser throttle the whole platform.
 * Falls back to client IP for anonymous requests.
 */
function rateLimitKey(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId?: string };
      if (payload.userId) return `u:${payload.userId}`;
    } catch { /* invalid/expired token → fall through to IP */ }
  }
  return `ip:${req.ip ?? 'unknown'}`;
}

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

// Behind nginx/Railway: trust the first proxy so req.ip is the REAL client IP,
// not the proxy's. Without this, IP-based rate limits bucket every user together.
app.set('trust proxy', 1);

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
// 256kb is plenty for chat/JSON payloads. Photo uploads use multipart (multer),
// not this parser, so the small limit doesn't affect them. A large JSON limit
// is a memory-pressure DoS vector.
app.use(express.json({ limit: '256kb' }));
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

// ── Rate limiting ────────────────────────────────────────
// Use a shared Redis store in production so counters are consistent across
// multiple backend instances. In dev (or if Redis is unset) fall back to the
// in-memory store. In prod, docker-compose only starts the backend once Redis
// is healthy, so the store is guaranteed to be reachable.
const useRedisStore = process.env.NODE_ENV === 'production';

function makeRedisStore(prefix: string): Store {
  return new RedisStore({
    prefix,
    // ioredis: forward the raw command so the limiter scripts run on Redis.
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<never>,
  });
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  validate: false,
  message: { error: 'Too many requests. Please try again later.' },
  ...(useRedisStore && { store: makeRedisStore('rl:global:') }),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
  ...(useRedisStore && { store: makeRedisStore('rl:auth:') }),
});

// Per-user cap on the expensive AI endpoints (each LLM call costs GPU/compute —
// on a government project that's taxpayer money). 60 AI calls/hour/user is
// generous for genuine study while stopping scripted abuse and bill-drain.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  validate: false,
  message: { error: 'AI usage limit reached for this hour. Please try again later.' },
  ...(useRedisStore && { store: makeRedisStore('rl:ai:') }),
});

if (useRedisStore) logger.info('Rate limiting using shared Redis store');

app.use(globalLimiter);

// ── Routes ───────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/tutor', aiLimiter, tutorRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/flashcards', flashcardsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/pyq', pyqRoutes);
app.use('/api/motivation', motivationRoutes);
app.use('/api/photo-doubt', aiLimiter, photoDoubtRoutes);
app.use('/api/ncert', ncertRoutes);
app.use('/api/strategy', strategyRoutes);
app.use('/api/samacheer', aiLimiter, samacheerRoutes);
app.use('/api/wellbeing', aiLimiter, wellbeingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/counselling', counsellingRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/diagnostic', aiLimiter, diagnosticRoutes);
app.use('/api/microlesson', aiLimiter, microlessonRoutes);
app.use('/api/nta', aiLimiter, ntaRoutes);
app.use('/api/snap', aiLimiter, snapOcrRoutes);
app.use('/api/vocabulary', aiLimiter, vocabularyRoutes);
app.use('/api/ncertexceptions', aiLimiter, ncertExceptionsRoutes);
app.use('/api/outcomes', outcomesRoutes);
app.use('/api/learning-tools', aiLimiter, learningToolsRoutes);
app.use('/api/rank-predictor', rankPredictorRoutes);
app.use('/api/study-analytics', studyAnalyticsRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/daily-challenge', aiLimiter, dailyChallengeRoutes);
app.use('/api/weekly-report', aiLimiter, weeklyReportRoutes);
app.use('/api/chapter-tracker', chapterTrackerRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/quick-revise', aiLimiter, quickReviseRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/pods', podsRoutes);
app.use('/api/parent', parentRoutes);

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
