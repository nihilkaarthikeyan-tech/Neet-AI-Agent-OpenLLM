import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// GET /api/heatmap — returns study activity count per day for the last 365 days
// Activity = test submissions + doubt messages + micro-lesson completions + flashcard reviews
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);

    const [testAttempts, doubts, microLessons, flashcards] = await Promise.all([
      prisma.testAttempt.findMany({
        where: { userId, submittedAt: { gte: since, not: null } },
        select: { submittedAt: true, totalQ: true },
      }),
      prisma.doubtMessage.findMany({
        where: { userId, role: 'user', createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.microLesson.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { date: true },
      }),
      prisma.flashcard.findMany({
        where: { userId, reviewCount: { gt: 0 }, createdAt: { gte: since } },
        select: { createdAt: true, reviewCount: true },
      }),
    ]);

    const dayMap: Record<string, number> = {};

    function addDay(date: Date, weight = 1) {
      const key = date.toISOString().split('T')[0];
      dayMap[key] = (dayMap[key] ?? 0) + weight;
    }

    for (const t of testAttempts) if (t.submittedAt) addDay(t.submittedAt, 3);
    for (const d of doubts) addDay(d.createdAt, 1);
    for (const l of microLessons) {
      addDay(new Date(l.date), 2);
    }
    // Flashcard: weight by review activity (rough estimate — createdAt of card)
    for (const f of flashcards) addDay(f.createdAt, 1);

    // Build last 365 days as array with counts
    const days: Array<{ date: string; count: number }> = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push({ date: key, count: dayMap[key] ?? 0 });
    }

    // Stats
    const activeDays = days.filter((d) => d.count > 0).length;
    const totalActivity = days.reduce((s, d) => s + d.count, 0);
    const maxCount = Math.max(...days.map((d) => d.count), 1);

    res.json({ days, activeDays, totalActivity, maxCount });
  } catch (err) {
    console.error('Heatmap error:', err);
    res.status(500).json({ error: 'Failed to compute heatmap.' });
  }
});

export default router;
