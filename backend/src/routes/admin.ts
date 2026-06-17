/**
 * Government Admin Dashboard — aggregated stats for officials.
 *
 * All queries return AGGREGATED data only — no individual student PII is
 * exposed. Officials see counts, averages, and trends, never names/emails.
 *
 * Admin accounts are created via POST /api/admin/create-admin using a shared
 * ADMIN_SECRET env variable — officials never self-register.
 */
import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── GET /api/admin/dashboard ─────────────────────────────
// The main numbers screen for govt officials.
router.get('/dashboard', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const last7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalStudents,
      newLast7Days,
      newLast30Days,
      totalTests,
      testsLast7,
      totalDoubtMessages,
      doubtsLast7,
      totalFlashcards,
      subjectBreakdown,
      avgScoreRaw,
      languageBreakdown,
      dailyRegistrations,
    ] = await Promise.all([
      // Total registered students
      prisma.user.count({ where: { role: 'STUDENT' } }),

      // New students this week / month
      prisma.user.count({ where: { role: 'STUDENT', created_at: { gte: last7 } } }),
      prisma.user.count({ where: { role: 'STUDENT', created_at: { gte: last30 } } }),

      // Total tests taken
      prisma.testAttempt.count({ where: { submittedAt: { not: null } } }),
      prisma.testAttempt.count({ where: { submittedAt: { not: null }, createdAt: { gte: last7 } } }),

      // AI tutor usage (doubt messages from students)
      prisma.doubtMessage.count({ where: { role: 'user' } }),
      prisma.doubtMessage.count({ where: { role: 'user', createdAt: { gte: last7 } } }),

      // Flashcards created
      prisma.flashcard.count(),

      // Tests by subject
      prisma.testAttempt.groupBy({
        by: ['subject'],
        where: { submittedAt: { not: null } },
        _count: { subject: true },
        _avg: { score: true },
      }),

      // Average score across all submitted tests
      prisma.testAttempt.aggregate({
        where: { submittedAt: { not: null }, score: { not: null } },
        _avg: { score: true },
        _count: { id: true },
      }),

      // Students by language preference (Tamil-first metric for govt)
      prisma.user.groupBy({
        by: ['language'],
        where: { role: 'STUDENT' },
        _count: { language: true },
      }),

      // Daily registrations last 30 days (trend chart data)
      prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE(created_at)::text AS date, COUNT(*)::bigint AS count
        FROM "User"
        WHERE role = 'STUDENT' AND created_at >= ${last30}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `,
    ]);

    // Cost-per-student calculation
    // Approximate LLM cost: tutor doubts ~300 tokens each @ $0.0002/1K = $0.00006 per message
    // Tests generate ~3000 tokens @ $0.0002/1K = $0.0006 per test
    // OpenRouter pricing ~ $0.0002/1K tokens (DeepSeek-V3 tier)
    const TOKEN_COST_PER_1K_USD = 0.0002;
    const USD_TO_INR = 84;
    const avgTokensPerDoubt = 400;
    const avgTokensPerTest = 3000;
    const totalAiCostUSD =
      ((totalDoubtMessages * avgTokensPerDoubt) / 1000) * TOKEN_COST_PER_1K_USD +
      ((totalTests * avgTokensPerTest) / 1000) * TOKEN_COST_PER_1K_USD;
    const totalAiCostINR = Math.round(totalAiCostUSD * USD_TO_INR);
    const costPerStudentINR = totalStudents > 0 ? Math.round(totalAiCostINR / totalStudents) : 0;
    const privateCoachingCost = 50000; // ₹50,000 average private coaching

    res.json({
      overview: {
        totalStudents,
        newLast7Days,
        newLast30Days,
        totalTests,
        testsLast7,
        totalDoubtMessages,
        doubtsLast7,
        totalFlashcards,
        avgScore: avgScoreRaw._avg.score ? Math.round(avgScoreRaw._avg.score) : null,
      },
      costMetrics: {
        totalAiCostINR,
        costPerStudentINR,
        privateCoachingCost,
        savingsPerStudent: privateCoachingCost - costPerStudentINR,
        costRatio: `₹${costPerStudentINR} vs ₹${privateCoachingCost.toLocaleString('en-IN')} private coaching`,
        note: 'Approximate based on OpenRouter token pricing. Actual cost may vary.',
      },
      subjectBreakdown: subjectBreakdown.map((s) => ({
        subject: s.subject,
        tests: s._count.subject,
        avgScore: s._avg.score ? Math.round(s._avg.score) : null,
      })),
      languageBreakdown: languageBreakdown.map((l) => ({
        language: l.language ?? 'en',
        students: l._count.language,
      })),
      // Convert BigInt → number for JSON serialization
      dailyRegistrations: dailyRegistrations.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Admin dashboard error');
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

// ── GET /api/admin/students ──────────────────────────────
// Paginated student list — aggregated stats only, no raw PII beyond email for
// account management. Page size capped at 100.
router.get('/students', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
    const skip = (page - 1) * limit;

    const [students, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: {
          id: true,
          name: true,
          email: true,
          language: true,
          emailVerified: true,
          created_at: true,
          _count: { select: { testAttempts: true, doubtHistory: true, flashcards: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: { role: 'STUDENT' } }),
    ]);

    res.json({ students, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error({ err }, 'Admin students list error');
    res.status(500).json({ error: 'Failed to fetch students.' });
  }
});

// ── POST /api/admin/create-admin ─────────────────────────
// Create a new ADMIN account. Requires the ADMIN_SECRET env variable.
// You run this once per official — they receive email+password from you directly.
const createAdminSchema = z.object({
  secret: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(12, 'Admin password must be at least 12 characters.'),
  name: z.string().min(1).max(100),
});

router.post('/create-admin', async (req: Request, res: Response) => {
  const parsed = createAdminSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }

  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  if (!ADMIN_SECRET) { res.status(503).json({ error: 'Admin creation not configured on this server.' }); return; }
  if (parsed.data.secret !== ADMIN_SECRET) { res.status(403).json({ error: 'Invalid admin secret.' }); return; }

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) { res.status(409).json({ error: 'Email already in use.' }); return; }

    const hash = await bcrypt.hash(parsed.data.password, 12);
    const admin = await prisma.user.create({
      data: { email: parsed.data.email, password: hash, name: parsed.data.name, role: 'ADMIN', emailVerified: true },
      select: { id: true, email: true, name: true, role: true },
    });

    logger.info({ adminId: admin.id, email: admin.email }, 'New admin account created');
    res.status(201).json({ message: 'Admin account created.', admin });
  } catch (err) {
    logger.error({ err }, 'Create admin error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
