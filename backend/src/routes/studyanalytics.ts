import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatJSONArray } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { z } from 'zod';

const router = Router();

// GET /api/study-analytics/speed — avg seconds per question per subject
router.get('/speed', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const attempts = await prisma.testAttempt.findMany({
      where: { userId, submittedAt: { not: null } },
      include: {
        questions: {
          select: { subject: true, timeSpent: true, userAnswer: true, correctOption: true },
        },
      },
    });

    const subjectMap: Record<string, { totalTime: number; count: number; correct: number }> = {};

    for (const attempt of attempts) {
      for (const q of attempt.questions) {
        if (q.timeSpent === null) continue;
        if (!subjectMap[q.subject]) subjectMap[q.subject] = { totalTime: 0, count: 0, correct: 0 };
        subjectMap[q.subject].totalTime += q.timeSpent;
        subjectMap[q.subject].count++;
        if (q.userAnswer === q.correctOption) subjectMap[q.subject].correct++;
      }
    }

    const bySubject = Object.entries(subjectMap).map(([subject, d]) => ({
      subject,
      avgSeconds: d.count > 0 ? Math.round(d.totalTime / d.count) : 0,
      questionCount: d.count,
      accuracy: d.count > 0 ? Math.round((d.correct / d.count) * 100) : 0,
    }));

    const sorted = [...bySubject].sort((a, b) => a.avgSeconds - b.avgSeconds);
    res.json({
      bySubject,
      fastest: sorted[0] ?? null,
      slowest: sorted[sorted.length - 1] ?? null,
      hasData: bySubject.length > 0,
    });
  } catch (err) {
    console.error('Speed analytics error:', err);
    res.status(500).json({ error: 'Failed to compute speed data.' });
  }
});

// GET /api/study-analytics/mistakes — wrong answers grouped by topic (last 30 days by default)
router.get('/mistakes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { subject, days } = req.query as { subject?: string; days?: string };
    const sinceDate = new Date(Date.now() - (Number(days ?? 30)) * 24 * 60 * 60 * 1000);

    const answered = await prisma.testQuestion.findMany({
      where: {
        attempt: {
          userId,
          submittedAt: { gte: sinceDate, not: null },
          ...(subject ? { subject } : {}),
        },
        userAnswer: { not: null },
      },
      select: {
        id: true,
        topic: true,
        subject: true,
        questionText: true,
        userAnswer: true,
        correctOption: true,
        errorType: true,
        attempt: { select: { submittedAt: true } },
      },
      orderBy: { attempt: { submittedAt: 'desc' } },
    });

    const wrong = answered.filter((q) => q.userAnswer !== q.correctOption);

    // Group by topic
    const topicMap: Record<string, {
      topic: string; subject: string; count: number;
      errorTypes: Record<string, number>;
      questions: typeof wrong;
    }> = {};

    for (const q of wrong) {
      const key = `${q.subject}::${q.topic || 'Uncategorized'}`;
      if (!topicMap[key]) {
        topicMap[key] = { topic: q.topic || 'Uncategorized', subject: q.subject, count: 0, errorTypes: {}, questions: [] };
      }
      topicMap[key].count++;
      if (q.errorType) {
        topicMap[key].errorTypes[q.errorType] = (topicMap[key].errorTypes[q.errorType] ?? 0) + 1;
      }
      if (topicMap[key].questions.length < 5) topicMap[key].questions.push(q);
    }

    const topics = Object.values(topicMap).sort((a, b) => b.count - a.count);
    res.json({ topics, totalWrong: wrong.length, since: sinceDate.toISOString() });
  } catch (err) {
    console.error('Mistakes error:', err);
    res.status(500).json({ error: 'Failed to fetch mistakes.' });
  }
});

// POST /api/study-analytics/classify-ai — AI classifies error type for wrong answers
const ClassifyResultSchema = z.object({
  id: z.string(),
  errorType: z.enum(['concept_gap', 'calculation', 'careless', 'trap']),
  reason: z.string().optional().default(''),
});

router.post('/classify-ai', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { questionIds } = req.body as { questionIds: string[] };

    if (!Array.isArray(questionIds) || questionIds.length === 0 || questionIds.length > 15) {
      res.status(400).json({ error: 'questionIds must be an array of 1–15 IDs.' });
      return;
    }

    // Fetch and verify questions belong to this user
    const questions = await prisma.testQuestion.findMany({
      where: {
        id: { in: questionIds },
        attempt: { userId, submittedAt: { not: null } },
        userAnswer: { not: null },
      },
      select: { id: true, questionText: true, userAnswer: true, correctOption: true, topic: true, subject: true },
    });

    const wrong = questions.filter((q) => q.userAnswer !== q.correctOption);
    if (wrong.length === 0) {
      res.json({ classified: [] });
      return;
    }

    const prompt = `You are an expert NEET coach. Classify each wrong answer into exactly one error type.

Error types:
- concept_gap: Student doesn't understand the underlying concept/theory
- calculation: Correct concept but arithmetic or formula application error
- careless: Student likely knew the answer but made a silly/reading mistake
- trap: The question was designed to mislead with a plausible wrong option

Questions to classify:
${wrong.map((q, i) => `${i + 1}. [id: ${q.id}] Subject: ${q.subject}, Topic: ${q.topic}
   Question: ${q.questionText.slice(0, 200)}
   Student answered: ${q.userAnswer}, Correct: ${q.correctOption}`).join('\n\n')}

Return a JSON array where each element is:
{ "id": "<question id>", "errorType": "<concept_gap|calculation|careless|trap>", "reason": "<one sentence why>" }`;

    let results: Array<z.infer<typeof ClassifyResultSchema>>;
    try {
      results = await chatJSONArray({
        user: prompt,
        system: NEET_GEN_SYSTEM,
        itemSchema: ClassifyResultSchema,
        maxTokens: 1500,
        temperature: 0.2,
        feature: 'study-analytics-classify',
      });
    } catch {
      res.status(503).json({ error: 'AI classification unavailable. Please try again.' });
      return;
    }

    // Save errorType back to DB
    await Promise.all(
      results.map((r) =>
        prisma.testQuestion.updateMany({
          where: { id: r.id, attempt: { userId } },
          data: { errorType: r.errorType },
        }),
      ),
    );

    res.json({ classified: results });
  } catch (err) {
    console.error('Classify-ai error:', err);
    res.status(500).json({ error: 'Failed to classify errors.' });
  }
});

// GET /api/study-analytics/best — personal best score per subject
router.get('/best', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const attempts = await prisma.testAttempt.findMany({
      where: { userId, submittedAt: { not: null }, score: { not: null } },
      select: { id: true, subject: true, score: true, totalQ: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    });

    const bestMap: Record<string, {
      subject: string; bestScore: number; maxPossible: number;
      bestPct: number; date: string; attemptId: string; totalAttempts: number;
    }> = {};
    const countMap: Record<string, number> = {};

    for (const a of attempts) {
      countMap[a.subject] = (countMap[a.subject] ?? 0) + 1;
      const pct = a.totalQ > 0 ? Math.round(((a.score ?? 0) / (a.totalQ * 4)) * 100) : 0;
      if (!bestMap[a.subject] || pct > bestMap[a.subject].bestPct) {
        bestMap[a.subject] = {
          subject: a.subject,
          bestScore: a.score ?? 0,
          maxPossible: a.totalQ * 4,
          bestPct: pct,
          date: a.submittedAt!.toISOString().split('T')[0],
          attemptId: a.id,
          totalAttempts: 0,
        };
      }
    }

    const bests = Object.values(bestMap).map((b) => ({
      ...b,
      totalAttempts: countMap[b.subject] ?? 0,
    }));

    res.json({ bests });
  } catch (err) {
    console.error('Best score error:', err);
    res.status(500).json({ error: 'Failed to fetch personal bests.' });
  }
});

// GET /api/study-analytics/accuracy-speed — scatter data for accuracy vs speed chart
router.get('/accuracy-speed', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const attempts = await prisma.testAttempt.findMany({
      where: { userId, submittedAt: { not: null }, timeTaken: { not: null }, score: { not: null } },
      select: { id: true, subject: true, score: true, totalQ: true, timeTaken: true, submittedAt: true },
      orderBy: { submittedAt: 'asc' },
    });

    const points = attempts.map((a) => ({
      attemptId: a.id,
      date: a.submittedAt!.toISOString().split('T')[0],
      subject: a.subject,
      accuracy: a.totalQ > 0 ? Math.round(((a.score ?? 0) / (a.totalQ * 4)) * 100) : 0,
      avgSecPerQ: a.totalQ > 0 ? Math.round((a.timeTaken ?? 0) / a.totalQ) : 0,
      totalQ: a.totalQ,
    }));

    res.json({ points });
  } catch (err) {
    console.error('Accuracy-speed error:', err);
    res.status(500).json({ error: 'Failed to fetch accuracy vs speed data.' });
  }
});

export default router;
