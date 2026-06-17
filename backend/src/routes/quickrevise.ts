import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatText } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';

const router = Router();

// GET /api/quick-revise — AI summary of what student studied in last 3 days
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const [user, testAttempts, doubts, microLessons] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, language: true } }),
      prisma.testAttempt.findMany({
        where: { userId, submittedAt: { gte: since, not: null } },
        include: { questions: { select: { subject: true, topic: true, userAnswer: true, correctOption: true } } },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.doubtMessage.findMany({
        where: { userId, role: 'user', createdAt: { gte: since } },
        select: { subject: true, content: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.microLesson.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { subject: true, topic: true, date: true },
        orderBy: { date: 'desc' },
      }),
    ]);

    // Build study summary for AI
    const testSummary = testAttempts.map((a) => {
      const correct = a.questions.filter((q) => q.userAnswer === q.correctOption).length;
      const total = a.questions.filter((q) => q.userAnswer !== null).length;
      const topicsCovered = [...new Set(a.questions.map((q) => q.topic).filter(Boolean))].slice(0, 5).join(', ');
      return `${a.subject} test: ${correct}/${total} correct. Topics: ${topicsCovered || 'various'}`;
    });

    const doubtSummary = doubts
      .slice(0, 8)
      .map((d) => `${d.subject}: "${d.content.slice(0, 80)}${d.content.length > 80 ? '...' : ''}"`)
      .join('\n');

    const lessonSummary = microLessons
      .map((l) => `${l.subject} — ${l.topic} (${l.date})`)
      .join(', ');

    const hasActivity = testAttempts.length > 0 || doubts.length > 0 || microLessons.length > 0;

    if (!hasActivity) {
      res.json({
        summary: "You haven't studied anything in the last 3 days. That's okay — let's start fresh today! Pick any subject and do 5 quick flashcards or solve a mini-test to get back on track.",
        testCount: 0,
        doubtCount: 0,
        lessonCount: 0,
        subjects: [],
      });
      return;
    }

    const langNote = user?.language === 'ta' ? 'Write your response in Tamil.' : 'Write in English.';

    const prompt = `You are a NEET tutor giving a student a quick revision summary of what they studied in the last 3 days.

Student name: ${user?.name ?? 'Student'}
Tests completed (${testAttempts.length}): ${testSummary.join('; ') || 'none'}
Doubts asked (${doubts.length}): ${doubtSummary || 'none'}
Micro-lessons completed: ${lessonSummary || 'none'}

Write a concise "Last 3 Days Revision" summary in this format:
1. **What You Covered** — list the subjects and key topics touched (2-3 sentences)
2. **Strong Points** — what you did well (1-2 specific things based on test scores/topics)
3. **Quick Recap** — 3-5 bullet points of the most important concepts from what was studied, as memory joggers
4. **Before Your Next Test** — one specific thing to review right now (1 sentence)

Keep it concise, warm, and revision-focused. No fluff. ${langNote}`;

    const summary = await chatText({
      user: prompt,
      system: NEET_GEN_SYSTEM,
      maxTokens: 600,
      temperature: 0.5,
      feature: 'quick-revise',
    });

    // Unique subjects covered
    const subjects = [...new Set([
      ...testAttempts.map((a) => a.subject),
      ...doubts.map((d) => d.subject),
      ...microLessons.map((l) => l.subject),
    ])];

    res.json({ summary, testCount: testAttempts.length, doubtCount: doubts.length, lessonCount: microLessons.length, subjects });
  } catch (err) {
    console.error('Quick revise error:', err);
    res.status(500).json({ error: 'Failed to generate revision summary.' });
  }
});

export default router;
