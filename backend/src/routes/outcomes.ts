/**
 * Outcome tracking framework — start collecting cohort data from day one.
 * Proof of impact = re-funding. Officials need cohort score lift, not daily MAU.
 */
import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';

const router = Router();

// GET /api/outcomes/cohort — admin: score progression across all students over time
router.get('/cohort', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    // Weekly average score across all students
    const weekly = await prisma.$queryRaw<{ week: string; avgScore: number; students: bigint }[]>`
      SELECT
        DATE_TRUNC('week', ta."submittedAt")::text AS week,
        ROUND(AVG(ta.score::numeric / (ta."totalQ" * 4) * 720), 1) AS "avgScore",
        COUNT(DISTINCT ta."userId")::bigint AS students
      FROM "TestAttempt" ta
      WHERE ta."submittedAt" IS NOT NULL AND ta.score IS NOT NULL AND ta."totalQ" > 0
      GROUP BY DATE_TRUNC('week', ta."submittedAt")
      ORDER BY week
    `;

    // Students who improved >20 points (score lift)
    const improvedStudents = await prisma.$queryRaw<{ userId: string; firstScore: number; latestScore: number; lift: number }[]>`
      WITH first_last AS (
        SELECT
          "userId",
          FIRST_VALUE(score::numeric / ("totalQ" * 4) * 720) OVER (PARTITION BY "userId" ORDER BY "submittedAt" ASC) AS first_score,
          FIRST_VALUE(score::numeric / ("totalQ" * 4) * 720) OVER (PARTITION BY "userId" ORDER BY "submittedAt" DESC) AS latest_score
        FROM "TestAttempt"
        WHERE "submittedAt" IS NOT NULL AND score IS NOT NULL AND "totalQ" > 0
      )
      SELECT DISTINCT "userId",
        ROUND(first_score) AS "firstScore",
        ROUND(latest_score) AS "latestScore",
        ROUND(latest_score - first_score) AS lift
      FROM first_last
      WHERE (latest_score - first_score) > 20
      ORDER BY lift DESC
      LIMIT 50
    `;

    // Students tracking toward a govt MBBS seat (7.5% quota cutoff ~566)
    const trackingGovtSeat = await prisma.testAttempt.groupBy({
      by: ['userId'],
      where: { submittedAt: { not: null }, score: { not: null } },
      _avg: { score: true },
      _count: { id: true },
    });

    const nearCutoff = trackingGovtSeat.filter((s) => {
      const est = s._avg.score !== null ? Math.round((s._avg.score / (1 * 4)) * 720) : 0;
      return est >= 500 && s._count.id >= 3;
    });

    res.json({
      weeklyProgress: weekly.map((w) => ({ ...w, students: Number(w.students) })),
      improvedStudents: improvedStudents.length,
      studentsNearCutoff: nearCutoff.length,
      totalTracked: trackingGovtSeat.length,
    });
  } catch (err) {
    logger.error({ err }, 'Outcomes cohort error');
    res.status(500).json({ error: 'Failed to load cohort data.' });
  }
});

// GET /api/outcomes/my — student's own milestone timeline
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const attempts = await prisma.testAttempt.findMany({
      where: { userId, submittedAt: { not: null }, score: { not: null } },
      orderBy: { submittedAt: 'asc' },
      select: { score: true, totalQ: true, submittedAt: true, subject: true },
    });

    if (attempts.length === 0) { res.json({ milestones: [], message: 'Take some tests to see your journey.' }); return; }

    const milestones: { date: string; score: number; type: string; message: string }[] = [];
    let best = 0;

    for (const a of attempts) {
      const est = a.totalQ > 0 ? Math.round(((a.score ?? 0) / (a.totalQ * 4)) * 720) : 0;
      const date = a.submittedAt!.toISOString().split('T')[0];

      if (est > best) {
        if (best === 0) milestones.push({ date, score: est, type: 'first', message: `First test: ${est}/720` });
        else milestones.push({ date, score: est, type: 'personal_best', message: `New personal best: ${est}/720 🎉` });
        best = est;
      }

      if (est >= 566 && milestones.every((m) => m.type !== 'cutoff_566'))
        milestones.push({ date, score: est, type: 'cutoff_566', message: `Crossed 7.5% quota cutoff (~566)! Govt MBBS seat possible 🏛️` });
      if (est >= 600 && milestones.every((m) => m.type !== 'cutoff_600'))
        milestones.push({ date, score: est, type: 'cutoff_600', message: `Crossed 600! General Govt MBBS competitive 💪` });
    }

    res.json({ milestones, currentBest: best, totalTests: attempts.length });
  } catch (err) {
    logger.error({ err }, 'Outcomes my error');
    res.status(500).json({ error: 'Failed to load milestones.' });
  }
});

export default router;
