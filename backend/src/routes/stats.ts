import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// GET /api/stats — dashboard summary for the logged-in student
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const [attempts, flashcardCount] = await Promise.all([
      prisma.testAttempt.findMany({
        where: { userId, submittedAt: { not: null } },
        select: { score: true, totalQ: true },
      }),
      prisma.flashcard.count({ where: { userId } }),
    ]);

    const testsTaken = attempts.length;
    const avgScore =
      testsTaken === 0
        ? null
        : Math.round(
            attempts.reduce((sum, a) => {
              const maxScore = a.totalQ * 4;
              return sum + ((a.score ?? 0) / maxScore) * 100;
            }, 0) / testsTaken
          );

    res.json({ testsTaken, avgScore, flashcardCount });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

export default router;
