import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatText } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';

const router = Router();

function todayString(): string {
  return new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
}

// GET /api/motivation/daily — return today's motivation message (generate if not cached)
router.get('/daily', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const today = todayString();

    // Return cached message for today if it exists
    const existing = await prisma.motivationMessage.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (existing) {
      res.json({ message: existing.message, date: today, fresh: false });
      return;
    }

    // Gather stats to personalise the message
    const [testCount, recentAttempt] = await Promise.all([
      prisma.testAttempt.count({ where: { userId, submittedAt: { not: null } } }),
      prisma.testAttempt.findFirst({
        where: { userId, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
        select: { score: true, totalQ: true, subject: true },
      }),
    ]);

    const recentContext =
      recentAttempt
        ? `Their most recent test was ${recentAttempt.subject} with a score of ${recentAttempt.score ?? 0}/${recentAttempt.totalQ * 4}.`
        : 'They have not taken any tests yet.';

    const prompt = `You are an energetic, empathetic NEET coaching mentor. Write a personalized motivational message for a student preparing for the NEET medical entrance exam.

Student context:
- Total tests taken so far: ${testCount}
- ${recentContext}
- Today's date: ${today}

Write ONE powerful, concise motivational message (3–5 sentences). Be specific, encouraging, and practical. Reference their progress if relevant. End with a concrete action they can take today. Make it feel personal, not generic.

Return ONLY the message text. No JSON. No title.`;

    const message = await chatText({
      user: prompt,
      system: NEET_GEN_SYSTEM,
      maxTokens: 400,
      temperature: 0.8,
      feature: 'motivation-daily',
    });

    if (!message) {
      res.status(503).json({ error: 'Failed to generate message. Please try again.' });
      return;
    }

    // Cache in DB
    await prisma.motivationMessage.create({
      data: { userId, date: today, message },
    });

    res.json({ message, date: today, fresh: true });
  } catch (err) {
    console.error('Motivation error:', err);
    res.status(500).json({ error: 'Failed to fetch motivation.' });
  }
});

// GET /api/motivation/streak — count consecutive active days (test taken or message viewed)
router.get('/streak', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get all dates the student submitted a test
    const attempts = await prisma.testAttempt.findMany({
      where: { userId, submittedAt: { not: null } },
      select: { submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    });

    const activeDates = new Set(
      attempts.map((a) => a.submittedAt!.toISOString().split('T')[0])
    );

    // Count consecutive days ending today (or yesterday)
    let streak = 0;
    const today = new Date();
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (activeDates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break; // chain broken
      }
    }

    // Weekly summary: tests taken in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyTests = await prisma.testAttempt.count({
      where: { userId, submittedAt: { gte: sevenDaysAgo, not: null } },
    });

    res.json({ streak, weeklyTests, totalTests: attempts.length });
  } catch (err) {
    console.error('Streak error:', err);
    res.status(500).json({ error: 'Failed to fetch streak.' });
  }
});

export default router;
