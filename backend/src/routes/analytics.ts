import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatJSONArray } from '../lib/llm.js';
import { z } from 'zod';

const router = Router();

const WeakAreaSchema = z.object({
  topic: z.string(),
  subject: z.string(),
  reason: z.string(),
  accuracy: z.number(),
  recommendation: z.string(),
});

// GET /api/analytics — subject accuracy + score timeline from real test data
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const attempts = await prisma.testAttempt.findMany({
      where: { userId, submittedAt: { not: null } },
      orderBy: { submittedAt: 'asc' },
      include: {
        questions: {
          select: {
            subject: true,
            correctOption: true,
            userAnswer: true,
          },
        },
      },
    });

    // Score timeline: one point per submitted attempt
    const scoreTimeline = attempts.map((a) => ({
      date: a.submittedAt!.toISOString().split('T')[0],
      score: a.score ?? 0,
      totalQ: a.totalQ,
      subject: a.subject,
      percentage: a.totalQ > 0 ? Math.round(((a.score ?? 0) / (a.totalQ * 4)) * 100) : 0,
    }));

    // Subject accuracy: correct / attempted per subject
    const subjectMap: Record<string, { correct: number; attempted: number; total: number }> = {};
    for (const attempt of attempts) {
      for (const q of attempt.questions) {
        if (!subjectMap[q.subject]) {
          subjectMap[q.subject] = { correct: 0, attempted: 0, total: 0 };
        }
        subjectMap[q.subject].total++;
        if (q.userAnswer !== null) {
          subjectMap[q.subject].attempted++;
          if (q.userAnswer === q.correctOption) {
            subjectMap[q.subject].correct++;
          }
        }
      }
    }

    const subjectAccuracy = Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      accuracy: data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0,
      correct: data.correct,
      attempted: data.attempted,
      total: data.total,
    }));

    res.json({ scoreTimeline, subjectAccuracy, totalTests: attempts.length });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

// POST /api/analytics/weak-areas — AI analysis of top weak topics
router.post('/weak-areas', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Check for cached result (within 24 hours)
    const existing = await prisma.weakAreaCache.findUnique({ where: { userId } });
    if (existing) {
      const ageHours = (Date.now() - existing.generatedAt.getTime()) / 1000 / 3600;
      if (ageHours < 24) {
        res.json({ weakAreas: existing.topics, cached: true });
        return;
      }
    }

    // Gather all incorrect/skipped answers by subject
    const questions = await prisma.testQuestion.findMany({
      where: { attempt: { userId, submittedAt: { not: null } } },
      select: {
        subject: true,
        questionText: true,
        correctOption: true,
        userAnswer: true,
      },
    });

    if (questions.length === 0) {
      res.json({ weakAreas: [], cached: false });
      return;
    }

    // Build a compact performance summary for the AI prompt
    const subjectStats: Record<string, { correct: number; wrong: number; skipped: number }> = {};
    for (const q of questions) {
      if (!subjectStats[q.subject]) subjectStats[q.subject] = { correct: 0, wrong: 0, skipped: 0 };
      if (q.userAnswer === null) subjectStats[q.subject].skipped++;
      else if (q.userAnswer === q.correctOption) subjectStats[q.subject].correct++;
      else subjectStats[q.subject].wrong++;
    }

    const summaryText = Object.entries(subjectStats)
      .map(([s, d]) => `${s}: ${d.correct} correct, ${d.wrong} wrong, ${d.skipped} skipped`)
      .join('\n');

    const prompt = `You are an expert NEET coaching advisor. A student has the following test performance data:

${summaryText}

Based on this data, identify the top 3–5 weak areas that need improvement. For each weak area, provide:
1. The topic name (specific, e.g. "Human Digestive System" not just "Biology")
2. The subject it belongs to
3. A brief reason why it's weak
4. An accuracy estimate (0–100)
5. A specific recommendation to improve

Each weak-area object must use this exact structure:
  {
    "topic": "topic name",
    "subject": "Physics | Chemistry | Biology",
    "reason": "brief explanation of the weakness",
    "accuracy": 35,
    "recommendation": "Specific study tip"
  }`;

    let weakAreas: Array<z.infer<typeof WeakAreaSchema>>;
    try {
      weakAreas = await chatJSONArray({
        user: prompt,
        itemSchema: WeakAreaSchema,
        maxTokens: 1500,
        temperature: 0.3,
        feature: 'analytics-weak-areas',
      });
    } catch (e) {
      console.error('Weak-area analysis failed:', e);
      res.status(503).json({ error: 'Could not analyze weak areas right now. Please try again.' });
      return;
    }

    // Upsert cache
    await prisma.weakAreaCache.upsert({
      where: { userId },
      update: { topics: weakAreas as object[], generatedAt: new Date() },
      create: { userId, topics: weakAreas as object[] },
    });

    res.json({ weakAreas, cached: false });
  } catch (err) {
    console.error('Weak areas error:', err);
    res.status(500).json({ error: 'Failed to analyze weak areas.' });
  }
});

// GET /api/analytics/high-weightage — AI-curated high-weightage NEET topics
router.get('/high-weightage', authenticate, async (_req: AuthRequest, res: Response) => {
  // Static curated list based on NEET PYQ analysis — no AI call needed
  const topics = [
    { subject: 'Biology', topic: 'Human Reproductive System', weightage: 'High', avgQuestions: '3-4' },
    { subject: 'Biology', topic: 'Genetics & Molecular Biology', weightage: 'Very High', avgQuestions: '5-6' },
    { subject: 'Biology', topic: 'Ecology & Environment', weightage: 'High', avgQuestions: '4-5' },
    { subject: 'Biology', topic: 'Cell Biology & Cell Division', weightage: 'High', avgQuestions: '3-4' },
    { subject: 'Biology', topic: 'Human Physiology (Digestion & Respiration)', weightage: 'High', avgQuestions: '4-5' },
    { subject: 'Biology', topic: 'Plant Kingdom & Animal Kingdom', weightage: 'Medium', avgQuestions: '2-3' },
    { subject: 'Chemistry', topic: 'Organic Chemistry (GOC + Reactions)', weightage: 'Very High', avgQuestions: '5-7' },
    { subject: 'Chemistry', topic: 'Coordination Compounds', weightage: 'High', avgQuestions: '3-4' },
    { subject: 'Chemistry', topic: 'Chemical Bonding & Molecular Structure', weightage: 'High', avgQuestions: '3-4' },
    { subject: 'Chemistry', topic: 'Electrochemistry', weightage: 'Medium', avgQuestions: '2-3' },
    { subject: 'Chemistry', topic: 'p-Block Elements', weightage: 'High', avgQuestions: '3-4' },
    { subject: 'Physics', topic: 'Modern Physics (Atoms, Nuclei, Photoelectric)', weightage: 'Very High', avgQuestions: '4-5' },
    { subject: 'Physics', topic: 'Electrostatics & Capacitors', weightage: 'High', avgQuestions: '3-4' },
    { subject: 'Physics', topic: 'Optics (Ray & Wave)', weightage: 'High', avgQuestions: '3-4' },
    { subject: 'Physics', topic: 'Mechanics (Laws of Motion, Work-Energy)', weightage: 'High', avgQuestions: '4-5' },
    { subject: 'Physics', topic: 'Semiconductor Devices', weightage: 'Medium', avgQuestions: '2-3' },
  ];

  res.json({ topics });
});

export default router;
