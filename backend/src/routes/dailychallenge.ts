import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatJSON } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { z } from 'zod';

const router = Router();

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

const QuestionSchema = z.object({
  question: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  correct: z.string(),
  explanation: z.string(),
  subject: z.string().optional().default('Biology'),
  topic: z.string().optional().default('General'),
});

// Generate or fetch today's challenge question
async function getOrCreateChallenge(date: string) {
  const existing = await prisma.dailyChallenge.findUnique({ where: { date } });
  if (existing) return existing;

  // Pick a subject rotating by day of week
  const subjects = ['Biology', 'Chemistry', 'Physics', 'Biology', 'Chemistry', 'Physics', 'Biology'];
  const dayOfWeek = new Date(date).getDay();
  const subject = subjects[dayOfWeek];

  const prompt = `Generate ONE hard NEET-level MCQ for ${subject}. It must be genuinely challenging — suitable as a "question of the day" that tests deep understanding.

Return exactly this JSON:
{
  "question": "Full question text?",
  "optionA": "Option A text",
  "optionB": "Option B text",
  "optionC": "Option C text",
  "optionD": "Option D text",
  "correct": "A",
  "explanation": "Detailed explanation of why A is correct and why others are wrong.",
  "subject": "${subject}",
  "topic": "Specific topic name"
}`;

  const q = await chatJSON({
    user: prompt,
    system: NEET_GEN_SYSTEM,
    schema: QuestionSchema,
    maxTokens: 800,
    temperature: 0.5,
    feature: 'daily-challenge-gen',
  });

  return prisma.dailyChallenge.create({
    data: {
      date,
      questionText: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correct,
      explanation: q.explanation,
      subject: q.subject,
      topic: q.topic,
    },
  });
}

// GET /api/daily-challenge/today
router.get('/today', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const today = todayISO();

    const challenge = await getOrCreateChallenge(today);

    // Has user already attempted today?
    const attempt = await prisma.dailyChallengeAttempt.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    // Count total participants and correct count for today
    const [totalAttempts, correctCount] = await Promise.all([
      prisma.dailyChallengeAttempt.count({ where: { date: today } }),
      prisma.dailyChallengeAttempt.count({ where: { date: today, isCorrect: true } }),
    ]);

    const alreadyAttempted = !!attempt;

    // Hide correct answer until attempted
    const safeChallenge = alreadyAttempted
      ? challenge
      : { ...challenge, correctOption: undefined, explanation: undefined };

    res.json({
      challenge: safeChallenge,
      alreadyAttempted,
      userAnswer: attempt?.answer ?? null,
      userCorrect: attempt?.isCorrect ?? null,
      stats: { totalAttempts, correctCount, correctPct: totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0 },
    });
  } catch (err) {
    console.error('Daily challenge fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch daily challenge.' });
  }
});

// POST /api/daily-challenge/submit — { answer: 'A'|'B'|'C'|'D', timeTaken: number }
router.post('/submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const today = todayISO();
    const { answer, timeTaken } = req.body as { answer: string; timeTaken?: number };

    if (!['A', 'B', 'C', 'D'].includes(answer)) {
      res.status(400).json({ error: 'answer must be A, B, C, or D.' });
      return;
    }

    // Check already attempted
    const existing = await prisma.dailyChallengeAttempt.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    if (existing) {
      res.status(409).json({ error: 'Already submitted today\'s challenge.' });
      return;
    }

    const challenge = await prisma.dailyChallenge.findUnique({ where: { date: today } });
    if (!challenge) {
      res.status(404).json({ error: 'No challenge found for today.' });
      return;
    }

    const isCorrect = answer === challenge.correctOption;

    await prisma.dailyChallengeAttempt.create({
      data: { userId, date: today, answer, isCorrect, timeTaken: timeTaken ?? null },
    });

    // XP is awarded via the /gamification/activity endpoint called from frontend
    // Count updated stats
    const [totalAttempts, correctCount] = await Promise.all([
      prisma.dailyChallengeAttempt.count({ where: { date: today } }),
      prisma.dailyChallengeAttempt.count({ where: { date: today, isCorrect: true } }),
    ]);

    res.json({
      isCorrect,
      correctOption: challenge.correctOption,
      explanation: challenge.explanation,
      stats: { totalAttempts, correctCount, correctPct: Math.round((correctCount / totalAttempts) * 100) },
    });
  } catch (err) {
    console.error('Daily challenge submit error:', err);
    res.status(500).json({ error: 'Failed to submit challenge.' });
  }
});

// GET /api/daily-challenge/leaderboard — fastest correct submissions today
router.get('/leaderboard', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const today = todayISO();

    const top = await prisma.dailyChallengeAttempt.findMany({
      where: { date: today, isCorrect: true, timeTaken: { not: null } },
      orderBy: { timeTaken: 'asc' },
      take: 10,
      include: { user: { select: { name: true } } },
    });

    const leaderboard = top.map((a, i) => ({
      rank: i + 1,
      // Show only first name + last initial for privacy
      displayName: a.user.name
        ? a.user.name.split(' ').map((n, idx) => idx === 0 ? n : `${n[0]}.`).join(' ')
        : 'Anonymous',
      timeTaken: a.timeTaken,
    }));

    const totalAttempts = await prisma.dailyChallengeAttempt.count({ where: { date: today } });
    const correctCount = await prisma.dailyChallengeAttempt.count({ where: { date: today, isCorrect: true } });

    res.json({ leaderboard, totalAttempts, correctCount });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

export default router;
