/**
 * Progress Intelligence — the "actually makes scores go up" layer.
 *
 * Endpoints:
 *  GET  /api/progress/summary      — improvement graph + current score estimate
 *  GET  /api/progress/heatmap      — weakness heatmap (chapter × accuracy)
 *  GET  /api/progress/predictor    — score predictor + TN seat probability
 *  GET  /api/progress/gap-closer   — "720 gap: here are the 14 chapters blocking you"
 *  POST /api/progress/profile      — save district, school, targetScore
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';

const router = Router();

// TN MBBS cutoffs 2024 (approximate, for predictor context)
const TN_CUTOFFS = {
  general:     { govt: 617, selfFinance: 530 },
  tnReservation7_5: { govt: 566, selfFinance: 480 }, // 7.5% govt-school quota
  obc:         { govt: 595, selfFinance: 510 },
  sc:          { govt: 480, selfFinance: 400 },
  st:          { govt: 420, selfFinance: 350 },
};

// ── GET /api/progress/summary ────────────────────────────
// Improvement graph: score per test over time + rolling average
router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const attempts = await prisma.testAttempt.findMany({
      where: { userId, submittedAt: { not: null }, score: { not: null } },
      orderBy: { submittedAt: 'asc' },
      select: { id: true, subject: true, score: true, totalQ: true, submittedAt: true },
    });

    const points = attempts.map((a, idx) => {
      const pct = a.totalQ > 0 ? Math.round(((a.score ?? 0) / (a.totalQ * 4)) * 100) : 0;
      return {
        index: idx + 1,
        date: a.submittedAt!.toISOString().split('T')[0],
        subject: a.subject,
        score: a.score ?? 0,
        totalQ: a.totalQ,
        percentage: pct,
        scaledTo720: Math.round((pct / 100) * 720),
      };
    });

    // 3-point rolling average for trend
    const trend = points.map((p, i) => {
      const window = points.slice(Math.max(0, i - 2), i + 1);
      const avg = Math.round(window.reduce((s, x) => s + x.scaledTo720, 0) / window.length);
      return { ...p, trendScore: avg };
    });

    const latest = trend[trend.length - 1];
    const first   = trend[0];
    const improvement = latest && first ? latest.scaledTo720 - first.scaledTo720 : null;

    res.json({ points: trend, improvement, latestEstimate: latest?.scaledTo720 ?? null, totalTests: attempts.length });
  } catch (err) {
    logger.error({ err }, 'Progress summary error');
    res.status(500).json({ error: 'Failed to load progress.' });
  }
});

// ── GET /api/progress/heatmap ────────────────────────────
// Chapter-level accuracy heatmap from real test question data
router.get('/heatmap', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const questions = await prisma.testQuestion.findMany({
      where: { attempt: { userId, submittedAt: { not: null } } },
      select: { subject: true, topic: true, correctOption: true, userAnswer: true, errorType: true },
    });

    // Group by subject → topic
    const map: Record<string, Record<string, { correct: number; total: number; errors: Record<string, number> }>> = {};
    for (const q of questions) {
      if (!map[q.subject]) map[q.subject] = {};
      const topic = q.topic || 'General';
      if (!map[q.subject][topic]) map[q.subject][topic] = { correct: 0, total: 0, errors: {} };
      map[q.subject][topic].total++;
      if (q.userAnswer === q.correctOption) {
        map[q.subject][topic].correct++;
      } else if (q.errorType) {
        map[q.subject][topic].errors[q.errorType] = (map[q.subject][topic].errors[q.errorType] ?? 0) + 1;
      }
    }

    const heatmap = Object.entries(map).map(([subject, topics]) => ({
      subject,
      topics: Object.entries(topics)
        .map(([topic, data]) => ({
          topic,
          accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
          attempted: data.total,
          correct: data.correct,
          dominantError: Object.entries(data.errors).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
        }))
        .sort((a, b) => a.accuracy - b.accuracy), // worst first
    }));

    res.json({ heatmap, totalQuestions: questions.length });
  } catch (err) {
    logger.error({ err }, 'Heatmap error');
    res.status(500).json({ error: 'Failed to load heatmap.' });
  }
});

// ── GET /api/progress/predictor ──────────────────────────
// Score predictor + TN 7.5% seat probability
router.get('/predictor', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const [user, attempts] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { targetScore: true } }),
      prisma.testAttempt.findMany({
        where: { userId, submittedAt: { not: null }, score: { not: null } },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: { score: true, totalQ: true, submittedAt: true },
      }),
    ]);

    if (attempts.length === 0) {
      res.json({ message: 'Take at least one test to see your score prediction.', predicted: null });
      return;
    }

    // Weighted average: recent tests count more
    const weights = attempts.map((_, i) => Math.pow(0.85, i));
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const weightedPct = attempts.reduce((s, a, i) => {
      const pct = a.totalQ > 0 ? ((a.score ?? 0) / (a.totalQ * 4)) : 0;
      return s + pct * weights[i];
    }, 0) / totalWeight;

    const predicted = Math.round(weightedPct * 720);

    // Trajectory (simple linear regression over last 10)
    const reversed = [...attempts].reverse();
    const n = reversed.length;
    const scores = reversed.map((a) => Math.round(((a.score ?? 0) / (a.totalQ * 4)) * 720));
    const xMean = (n - 1) / 2;
    const yMean = scores.reduce((s, v) => s + v, 0) / n;
    const slope = scores.reduce((s, y, i) => s + (i - xMean) * (y - yMean), 0) /
                  (scores.reduce((s, _, i) => s + (i - xMean) ** 2, 0) || 1);

    // Project 30 days (assume ~2 tests/week)
    const projected30d = Math.min(720, Math.round(predicted + slope * 8));

    // TN seat probability assessment
    const c = TN_CUTOFFS;
    const seatAssessment = {
      tnGovtQuota75:    { cutoff: c.tnReservation7_5.govt,    likely: predicted >= c.tnReservation7_5.govt,    close: Math.abs(predicted - c.tnReservation7_5.govt) <= 30 },
      generalGovt:      { cutoff: c.general.govt,              likely: predicted >= c.general.govt,              close: Math.abs(predicted - c.general.govt) <= 30 },
      selfFinance:      { cutoff: c.general.selfFinance,       likely: predicted >= c.general.selfFinance,       close: Math.abs(predicted - c.general.selfFinance) <= 30 },
      obcGovt:          { cutoff: c.obc.govt,                  likely: predicted >= c.obc.govt,                  close: Math.abs(predicted - c.obc.govt) <= 30 },
    };

    const targetScore = user?.targetScore ?? 600;
    const gap = targetScore - predicted;

    res.json({
      predicted,
      projected30d,
      trend: slope > 1 ? 'improving' : slope < -1 ? 'declining' : 'stable',
      slopePerTest: Math.round(slope),
      targetScore,
      gap: Math.max(0, gap),
      gapMessage: gap <= 0
        ? `You've hit your target of ${targetScore}! Aim higher.`
        : `${gap} more marks to reach your target of ${targetScore}.`,
      seatAssessment,
      cutoffs: TN_CUTOFFS,
    });
  } catch (err) {
    logger.error({ err }, 'Predictor error');
    res.status(500).json({ error: 'Failed to load predictor.' });
  }
});

// ── GET /api/progress/gap-closer ────────────────────────
// "720 gap: here are the chapters standing between you and your target"
router.get('/gap-closer', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const questions = await prisma.testQuestion.findMany({
      where: { attempt: { userId, submittedAt: { not: null } } },
      select: { subject: true, topic: true, correctOption: true, userAnswer: true, errorType: true },
    });

    if (questions.length === 0) {
      res.json({ gaps: [], message: 'Take some tests first to see your gap analysis.' });
      return;
    }

    // NEET marks per question = 4 (correct) or -1 (wrong) or 0 (skipped)
    const topicMap: Record<string, { subject: string; correct: number; wrong: number; skipped: number }> = {};
    for (const q of questions) {
      const key = `${q.subject}:${q.topic || 'General'}`;
      if (!topicMap[key]) topicMap[key] = { subject: q.subject, correct: 0, wrong: 0, skipped: 0 };
      if (!q.userAnswer) topicMap[key].skipped++;
      else if (q.userAnswer === q.correctOption) topicMap[key].correct++;
      else topicMap[key].wrong++;
    }

    // Estimate marks lost per topic
    const gaps = Object.entries(topicMap)
      .map(([key, d]) => {
        const topic = key.split(':')[1];
        const marksLost = d.wrong * 5 + d.skipped * 4; // cost: wrong costs 4+1 penalty, skip costs 4
        const accuracy = (d.correct + d.wrong) > 0
          ? Math.round((d.correct / (d.correct + d.wrong)) * 100) : 0;
        return { subject: d.subject, topic, accuracy, marksLost, wrong: d.wrong, skipped: d.skipped, correct: d.correct };
      })
      .filter((g) => g.marksLost > 0)
      .sort((a, b) => b.marksLost - a.marksLost)
      .slice(0, 15);

    const totalMarksAvailable = gaps.reduce((s, g) => s + g.marksLost, 0);

    res.json({ gaps, totalMarksAvailable });
  } catch (err) {
    logger.error({ err }, 'Gap-closer error');
    res.status(500).json({ error: 'Failed to load gap analysis.' });
  }
});

// ── POST /api/progress/profile ───────────────────────────
// Save student profile (district, school, target score)
const profileSchema = z.object({
  district:    z.string().max(100).optional(),
  school:      z.string().max(200).optional(),
  targetScore: z.number().int().min(100).max(720).optional(),
});

router.post('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: parsed.data,
      select: { id: true, district: true, school: true, targetScore: true },
    });
    res.json({ user });
  } catch (err) {
    logger.error({ err }, 'Profile update error');
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ── GET /api/progress/district-rank ─────────────────────
// "You're in the top X% of [District] government-school aspirants"
// Only works when user has a district set.
router.get('/district-rank', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { district: true, targetScore: true },
    });

    if (!user?.district) {
      res.json({ available: false, message: 'Set your district in settings to see your local ranking.' });
      return;
    }

    // Get this student's latest estimated score
    const myAttempts = await prisma.testAttempt.findMany({
      where: { userId, submittedAt: { not: null }, score: { not: null } },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: { score: true, totalQ: true },
    });

    if (myAttempts.length === 0) {
      res.json({ available: false, message: 'Take at least one test to see your district rank.' });
      return;
    }

    const myAvgPct = myAttempts.reduce((s, a) => s + (a.totalQ > 0 ? (a.score ?? 0) / (a.totalQ * 4) : 0), 0) / myAttempts.length;
    const myScore = Math.round(myAvgPct * 720);

    // Count students in same district + how many score below this student
    const districtStudents = await prisma.user.findMany({
      where: { district: user.district, role: 'STUDENT' },
      select: { id: true },
    });

    const districtIds = districtStudents.map((s) => s.id);
    const totalInDistrict = districtIds.length;

    if (totalInDistrict < 3) {
      res.json({ available: false, message: 'Not enough students from your district yet to rank.' });
      return;
    }

    // For each district student, compute their estimated score
    const districtAttempts = await prisma.testAttempt.groupBy({
      by: ['userId'],
      where: { userId: { in: districtIds }, submittedAt: { not: null }, score: { not: null } },
      _avg: { score: true },
      _avg_totalQ: true,
    } as any);

    // Simple approach: count students whose latest avg score is below mine
    const rawAttempts = await prisma.testAttempt.findMany({
      where: { userId: { in: districtIds }, submittedAt: { not: null }, score: { not: null } },
      select: { userId: true, score: true, totalQ: true },
    });

    const studentScores: Record<string, number[]> = {};
    for (const a of rawAttempts) {
      if (!studentScores[a.userId]) studentScores[a.userId] = [];
      studentScores[a.userId].push(a.totalQ > 0 ? Math.round(((a.score ?? 0) / (a.totalQ * 4)) * 720) : 0);
    }

    let below = 0;
    for (const [sid, scores] of Object.entries(studentScores)) {
      if (sid === userId) continue;
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      if (avg < myScore) below++;
    }

    const studentsWithData = Object.keys(studentScores).length;
    const percentile = studentsWithData > 1 ? Math.round((below / (studentsWithData - 1)) * 100) : 100;

    res.json({
      available: true,
      district: user.district,
      myScore,
      percentile,
      totalInDistrict,
      studentsWithData,
      message: percentile >= 90
        ? `Top ${100 - percentile}% in ${user.district}! Outstanding.`
        : percentile >= 70
        ? `Top ${100 - percentile}% among ${user.district} aspirants. Keep going!`
        : `You're ahead of ${percentile}% of ${user.district} students. Push harder!`,
    });
  } catch (err) {
    logger.error({ err }, 'District rank error');
    res.status(500).json({ error: 'Failed to load district rank.' });
  }
});

export default router;
