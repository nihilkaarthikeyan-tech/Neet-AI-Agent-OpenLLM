import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatText } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';

const router = Router();

function getWeekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getWeekEnd(weekStart: string): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d;
}

async function buildWeekStats(userId: string, weekStart: string) {
  const weekEnd = getWeekEnd(weekStart);

  const [testAttempts, doubtMessages, user] = await Promise.all([
    prisma.testAttempt.findMany({
      where: { userId, submittedAt: { gte: new Date(weekStart), lt: weekEnd, not: null } },
      include: { questions: { select: { subject: true, userAnswer: true, correctOption: true } } },
      orderBy: { submittedAt: 'asc' },
    }),
    prisma.doubtMessage.count({
      where: { userId, role: 'user', createdAt: { gte: new Date(weekStart), lt: weekEnd } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, xp: true, streak: true, longestStreak: true, language: true },
    }),
  ]);

  // Subject breakdown this week
  const subjectStats: Record<string, { tests: number; correct: number; total: number; totalScore: number; maxScore: number }> = {};
  for (const attempt of testAttempts) {
    const subj = attempt.subject;
    if (!subjectStats[subj]) subjectStats[subj] = { tests: 0, correct: 0, total: 0, totalScore: 0, maxScore: 0 };
    subjectStats[subj].tests++;
    subjectStats[subj].totalScore += attempt.score ?? 0;
    subjectStats[subj].maxScore += attempt.totalQ * 4;
    for (const q of attempt.questions) {
      if (q.userAnswer !== null) {
        subjectStats[subj].total++;
        if (q.userAnswer === q.correctOption) subjectStats[subj].correct++;
      }
    }
  }

  const subjects = Object.entries(subjectStats).map(([subject, d]) => ({
    subject,
    tests: d.tests,
    accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
    avgScore: d.tests > 0 ? Math.round(d.totalScore / d.tests) : 0,
    maxScore: d.tests > 0 ? Math.round(d.maxScore / d.tests) : 0,
  }));

  const totalQuestionsAttempted = testAttempts.reduce((s, a) => s + a.questions.filter(q => q.userAnswer !== null).length, 0);
  const totalCorrect = testAttempts.reduce((s, a) => s + a.questions.filter(q => q.userAnswer === q.correctOption).length, 0);
  const overallAccuracy = totalQuestionsAttempted > 0 ? Math.round((totalCorrect / totalQuestionsAttempted) * 100) : 0;

  return {
    weekStart,
    user: user ?? { name: 'Student', xp: 0, streak: 0, longestStreak: 0, language: 'en' },
    totalTests: testAttempts.length,
    totalQuestionsAttempted,
    totalCorrect,
    overallAccuracy,
    doubtQuestions: doubtMessages,
    subjects,
    streak: user?.streak ?? 0,
  };
}

// GET /api/weekly-report — this week's report card
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const weekStart = getWeekStart();

    // Check cache (regenerate if older than 6 hours or Sunday)
    const cached = await prisma.weeklyReport.findUnique({ where: { userId_weekStart: { userId, weekStart } } });
    if (cached) {
      const ageHrs = (Date.now() - cached.createdAt.getTime()) / 3600000;
      if (ageHrs < 6) {
        res.json({ report: cached.reportJson, cached: true, weekStart });
        return;
      }
    }

    const stats = await buildWeekStats(userId, weekStart);

    // AI generates a friendly report card narrative
    const langNote = stats.user.language === 'ta' ? 'Write in Tamil.' : 'Write in English.';
    const subjectSummary = stats.subjects.map((s) => `${s.subject}: ${s.tests} tests, ${s.accuracy}% accuracy`).join('; ') || 'No tests taken yet';

    const prompt = `You are a warm, encouraging NEET coach writing a weekly report card for a student.

Student: ${stats.user.name ?? 'Student'}
Week of: ${weekStart}
Tests completed: ${stats.totalTests}
Questions attempted: ${stats.totalQuestionsAttempted}
Correct answers: ${stats.totalCorrect} (${stats.overallAccuracy}% accuracy)
Doubts asked: ${stats.doubtQuestions}
Current streak: ${stats.streak} days
Subject breakdown: ${subjectSummary}

Write a weekly report card in this format:
1. **This Week** — 2 sentences summarizing what they did
2. **What improved** — 1-2 specific things that went well
3. **What needs work** — 1-2 specific areas to focus on next week
4. **Next Week's Goal** — one clear, achievable goal

Keep it warm, specific, and like a school report card — not generic. If no tests were taken, encourage them gently. ${langNote}`;

    let narrative = 'No report available yet.';
    try {
      narrative = await chatText({
        user: prompt,
        system: NEET_GEN_SYSTEM,
        maxTokens: 400,
        temperature: 0.7,
        feature: 'weekly-report',
      });
    } catch { /* use default */ }

    const reportJson = { ...stats, narrative };

    await prisma.weeklyReport.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: { userId, weekStart, reportJson },
      update: { reportJson },
    });

    res.json({ report: reportJson, cached: false, weekStart });
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ error: 'Failed to generate weekly report.' });
  }
});

export default router;
