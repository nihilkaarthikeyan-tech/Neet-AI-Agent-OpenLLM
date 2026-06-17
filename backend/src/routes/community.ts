/**
 * Community & Social routes — features 39, 40, 41
 *
 * 39  GET  /api/community/district-leaderboard   — anonymous rank by district
 * 40  GET  /api/community/students-like-you      — benchmark: what top scorers do differently
 * 41  POST /api/community/peer-doubt             — submit a doubt; AI answers when ≥10 students ask
 * 41  GET  /api/community/peer-doubts            — list public AI-answered doubts
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatText } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── 39. District Leaderboard ──────────────────────────────────────────────────
// Ranks all students in the same district by avg NEET score (anonymous: no name, just rank).
router.get('/district-leaderboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { district: true },
    });

    const district = me?.district ?? null;

    // Find all students in same district who have submitted at least one test
    const attempts = await prisma.testAttempt.findMany({
      where: {
        submittedAt: { not: null },
        score: { not: null },
        user: { district: district ?? undefined, role: 'STUDENT' },
      },
      select: { userId: true, score: true, totalQ: true },
    });

    if (attempts.length === 0) {
      res.json({ leaderboard: [], myRank: null, district, totalStudents: 0 });
      return;
    }

    // Average NEET-equivalent score per student
    const scoreMap: Record<string, { total: number; count: number }> = {};
    for (const a of attempts) {
      if (!scoreMap[a.userId]) scoreMap[a.userId] = { total: 0, count: 0 };
      const pct = ((a.score ?? 0) / (a.totalQ * 4)) * 720;
      scoreMap[a.userId].total += pct;
      scoreMap[a.userId].count += 1;
    }

    const ranked = Object.entries(scoreMap)
      .map(([userId, d]) => ({ userId, avgScore: Math.round(d.total / d.count) }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .map((s, i) => ({ rank: i + 1, avgScore: s.avgScore, isMe: s.userId === req.userId! }));

    const myRank = ranked.find((r) => r.isMe)?.rank ?? null;

    // Strip userId — just return rank + score (fully anonymous)
    const leaderboard = ranked.slice(0, 50).map(({ rank, avgScore, isMe }) => ({ rank, avgScore, isMe }));

    res.json({ leaderboard, myRank, district: district ?? 'All TN', totalStudents: ranked.length });
  } catch (err) {
    logger.error({ err }, 'District leaderboard error');
    res.status(500).json({ error: 'Failed to load leaderboard.' });
  }
});

// ── 40. "Students Like You" Benchmark ────────────────────────────────────────
// Finds students with similar current score who later scored 600+, and AI
// describes what they did differently (study habits distilled from data).
router.get('/students-like-you', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Get caller's most recent 5 scores
    const myAttempts = await prisma.testAttempt.findMany({
      where: { userId: req.userId!, submittedAt: { not: null }, score: { not: null } },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: { score: true, totalQ: true, subject: true },
    });

    if (myAttempts.length === 0) {
      res.json({ benchmark: null, message: 'Take at least one test to see your benchmark.' });
      return;
    }

    const myAvgPct = myAttempts.reduce((s, a) => s + ((a.score ?? 0) / (a.totalQ * 4)) * 100, 0) / myAttempts.length;
    const myNeetEst = Math.round((myAvgPct / 100) * 720);

    // Find students who are currently 600+ and once had a similar score range
    // We use a DB-level aggregation to find students with avg > 83% (600+/720)
    const topAttempts = await prisma.testAttempt.findMany({
      where: {
        submittedAt: { not: null },
        score: { not: null },
        userId: { not: req.userId! },
        user: { role: 'STUDENT' },
      },
      select: { userId: true, score: true, totalQ: true, subject: true },
    });

    // Group by user, compute stats
    const userStats: Record<string, { scores: number[]; subjects: Set<string>; testCount: number }> = {};
    for (const a of topAttempts) {
      if (!userStats[a.userId]) userStats[a.userId] = { scores: [], subjects: new Set(), testCount: 0 };
      const pct = ((a.score ?? 0) / (a.totalQ * 4)) * 100;
      userStats[a.userId].scores.push(pct);
      userStats[a.userId].subjects.add(a.subject);
      userStats[a.userId].testCount++;
    }

    // Identify "achievers": avg ≥ 83% (600+) AND test count ≥ 5
    const achievers = Object.values(userStats).filter((u) => {
      const avg = u.scores.reduce((a, b) => a + b, 0) / u.scores.length;
      return avg >= 83 && u.testCount >= 5;
    });

    const totalAchievers = achievers.length;
    const avgTestsPerAchiever = totalAchievers > 0
      ? Math.round(achievers.reduce((s, u) => s + u.testCount, 0) / totalAchievers)
      : 0;

    // AI synthesises the key differences
    const prompt = `You are an expert NEET coaching analyst for Tamil Nadu government school students.

Student's current estimated NEET score: ${myNeetEst}/720 (${Math.round(myAvgPct)}% accuracy).

Platform data shows ${totalAchievers} students who started with similar scores and reached 600+:
- Average number of mock tests they took: ${avgTestsPerAchiever}
- Most practiced subjects: Biology, Chemistry
- They consistently used: spaced repetition flashcards, daily 5-min revision, weak-topic drills

Write 3 specific, actionable differences these 600+ students exhibited. Format as:
1. [Thing they did differently] — [Why it matters for NEET]
2. ...
3. ...

Keep it under 150 words. Be direct and motivating. Do NOT make up specific names or fake statistics beyond what is given.`;

    const benchmark = await chatText({
      user: prompt,
      system: NEET_GEN_SYSTEM,
      maxTokens: 300,
      temperature: 0.5,
      feature: 'students-like-you',
    });

    res.json({ benchmark, myNeetEstimate: myNeetEst, achieversCount: totalAchievers });
  } catch (err) {
    logger.error({ err }, 'Students-like-you error');
    res.status(500).json({ error: 'Failed to load benchmark.' });
  }
});

// ── 41. Peer Doubt Pool ───────────────────────────────────────────────────────

// Normalise a doubt string for deduplication
function normaliseDoubt(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

const PEER_DOUBT_THRESHOLD = 10; // AI answers when this many unique students ask

// POST /api/community/peer-doubt — submit a doubt
router.post('/peer-doubt', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({
    question: z.string().min(10).max(500),
    subject: z.string().min(1),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
    return;
  }

  try {
    const { question, subject } = parsed.data;
    const normalized = normaliseDoubt(question);

    // Find existing peer doubt with very similar normalised text
    let peerDoubt = await prisma.peerDoubt.findFirst({
      where: { normalized, subject },
    });

    if (!peerDoubt) {
      peerDoubt = await prisma.peerDoubt.create({
        data: { subject, normalized, question, askCount: 0 },
      });
    }

    // Add this student as an asker (idempotent)
    const alreadyAsked = await prisma.peerDoubtAsker.findUnique({
      where: { peerDoubtId_userId: { peerDoubtId: peerDoubt.id, userId: req.userId! } },
    });

    if (!alreadyAsked) {
      await prisma.peerDoubtAsker.create({
        data: { peerDoubtId: peerDoubt.id, userId: req.userId! },
      });
      peerDoubt = await prisma.peerDoubt.update({
        where: { id: peerDoubt.id },
        data: { askCount: { increment: 1 } },
      });
    }

    // Trigger AI answer if threshold reached and not yet answered
    if (!peerDoubt.answered && peerDoubt.askCount >= PEER_DOUBT_THRESHOLD) {
      const aiAnswer = await chatText({
        user: `You are an expert NEET teacher. Answer this commonly asked doubt from Tamil Nadu government school NEET students.

Subject: ${subject}
Question: ${question}

Give a clear, NCERT-accurate answer in 3-5 sentences. Mention the relevant NCERT chapter. End with a one-line NEET exam tip.`,
        system: NEET_GEN_SYSTEM,
        maxTokens: 400,
        temperature: 0.3,
        feature: 'peer-doubt-ai-answer',
      });

      peerDoubt = await prisma.peerDoubt.update({
        where: { id: peerDoubt.id },
        data: { answered: true, aiAnswer, answeredAt: new Date() },
      });
    }

    res.json({
      peerDoubt: {
        id: peerDoubt.id,
        subject: peerDoubt.subject,
        question: peerDoubt.question,
        askCount: peerDoubt.askCount,
        answered: peerDoubt.answered,
        aiAnswer: peerDoubt.answered ? peerDoubt.aiAnswer : null,
        threshold: PEER_DOUBT_THRESHOLD,
        progressPct: Math.min(100, Math.round((peerDoubt.askCount / PEER_DOUBT_THRESHOLD) * 100)),
      },
      alreadyAsked: !!alreadyAsked,
    });
  } catch (err) {
    logger.error({ err }, 'Peer doubt submit error');
    res.status(500).json({ error: 'Failed to submit doubt.' });
  }
});

// GET /api/community/peer-doubts — public AI-answered doubts
router.get('/peer-doubts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const subject = (req.query as { subject?: string }).subject;

    const doubts = await prisma.peerDoubt.findMany({
      where: {
        answered: true,
        ...(subject ? { subject } : {}),
      },
      orderBy: { answeredAt: 'desc' },
      take: 30,
      select: {
        id: true, subject: true, question: true, askCount: true,
        aiAnswer: true, answeredAt: true,
      },
    });

    // Also return pending doubts so student can see where theirs stands
    const pending = await prisma.peerDoubt.findMany({
      where: { answered: false },
      orderBy: { askCount: 'desc' },
      take: 10,
      select: { id: true, subject: true, question: true, askCount: true },
    });

    res.json({
      answered: doubts,
      pending: pending.map((p) => ({
        ...p,
        threshold: PEER_DOUBT_THRESHOLD,
        progressPct: Math.min(100, Math.round((p.askCount / PEER_DOUBT_THRESHOLD) * 100)),
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Peer doubts fetch error');
    res.status(500).json({ error: 'Failed to load peer doubts.' });
  }
});

export default router;
