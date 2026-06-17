import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatText } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';

const router = Router();

// ── Constants ────────────────────────────────────────────────────────────────

export const LEVELS = [
  { level: 1, name: 'Beginner',    minXP: 0,    icon: '🌱' },
  { level: 2, name: 'Improving',   minXP: 500,  icon: '📚' },
  { level: 3, name: 'Competitive', minXP: 1500, icon: '⚔️' },
  { level: 4, name: 'NEET Ready',  minXP: 3500, icon: '🎯' },
  { level: 5, name: 'Champion',    minXP: 7000, icon: '🏆' },
];

export const XP_REWARDS = {
  test_submit:    50,  // base for completing a test
  test_correct:   10,  // per correct answer
  test_wrong:     2,   // per attempted wrong answer (effort counts)
  doubt_asked:    10,
  flashcard_reviewed: 3,
  challenge_correct:  100,
  challenge_attempt:  20,
  streak_bonus:   10,  // per day of streak continuation
} as const;

export const BADGE_DEFS = [
  { id: 'first_question',   name: 'First Step',          desc: 'Answered your first question',              icon: '🎯', color: '#6366f1' },
  { id: 'questions_100',    name: 'Century Club',         desc: 'Answered 100 questions',                    icon: '💯', color: '#f59e0b' },
  { id: 'questions_500',    name: 'Question Master',      desc: 'Answered 500 questions',                    icon: '🏅', color: '#22c55e' },
  { id: 'first_test',       name: 'Test Taker',          desc: 'Completed your first mock test',            icon: '📝', color: '#6366f1' },
  { id: 'perfect_score',    name: 'Perfect!',             desc: 'Scored 100% on a test',                     icon: '⭐', color: '#fbbf24' },
  { id: 'streak_3',         name: 'On a Roll',            desc: '3-day study streak',                        icon: '🔥', color: '#ef4444' },
  { id: 'streak_7',         name: '7-Day Warrior',        desc: '7 consecutive days of study',               icon: '⚔️', color: '#ef4444' },
  { id: 'streak_14',        name: 'Fortnight Fighter',    desc: '14-day study streak',                       icon: '🗡️', color: '#dc2626' },
  { id: 'streak_30',        name: 'NEET Monk',            desc: '30-day study streak',                       icon: '🧘', color: '#7c3aed' },
  { id: 'biology_master',   name: 'Biology Master',       desc: '70%+ accuracy in Biology (50+ Qs)',         icon: '🧬', color: '#22c55e' },
  { id: 'chemistry_master', name: 'Chemistry Ace',        desc: '70%+ accuracy in Chemistry (50+ Qs)',       icon: '⚗️', color: '#f59e0b' },
  { id: 'physics_master',   name: 'Physics Whiz',         desc: '70%+ accuracy in Physics (50+ Qs)',         icon: '⚡', color: '#6366f1' },
  { id: 'daily_champion',   name: 'Daily Champion',       desc: 'Got the daily challenge correct',           icon: '🏆', color: '#fbbf24' },
  { id: 'tamil_warrior',    name: 'Tamil Medium Warrior', desc: 'Completed study activities in Tamil',       icon: '🦁', color: '#06b6d4' },
  { id: 'comeback_kid',     name: 'Comeback Kid',         desc: 'Returned to study after 5+ day break',     icon: '💪', color: '#8b5cf6' },
  { id: 'xp_500',           name: 'Rising Star',          desc: 'Earned 500 XP',                             icon: '🌟', color: '#f59e0b' },
  { id: 'xp_1500',          name: 'Dedicated Student',    desc: 'Earned 1500 XP',                            icon: '💫', color: '#22c55e' },
  { id: 'xp_3500',          name: 'NEET Warrior',         desc: 'Earned 3500 XP',                            icon: '🔥', color: '#7c3aed' },
];

export function computeLevel(xp: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXP) current = l;
  }
  const next = LEVELS.find((l) => l.minXP > xp);
  return {
    ...current,
    nextLevel: next ?? null,
    xpToNext: next ? next.minXP - xp : 0,
    progressPct: next ? Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100) : 100,
  };
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// Check and award new badges for a user — returns newly earned badge IDs
async function checkAndAwardBadges(userId: string, existingBadgeIds: Set<string>): Promise<string[]> {
  const newBadges: string[] = [];

  // Fetch data needed for badge checks
  const [user, testStats, challengeWins] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true, streak: true, language: true } }),
    prisma.testQuestion.aggregate({
      where: { attempt: { userId, submittedAt: { not: null } }, userAnswer: { not: null } },
      _count: { id: true },
    }),
    prisma.dailyChallengeAttempt.count({ where: { userId, isCorrect: true } }),
  ]);

  if (!user) return [];

  const totalAnswered = testStats._count.id;

  // Subject accuracy (need per-subject)
  const subjectStats = await prisma.testQuestion.findMany({
    where: { attempt: { userId, submittedAt: { not: null } }, userAnswer: { not: null } },
    select: { subject: true, userAnswer: true, correctOption: true },
  });
  const subjectMap: Record<string, { correct: number; total: number }> = {};
  for (const q of subjectStats) {
    if (!subjectMap[q.subject]) subjectMap[q.subject] = { correct: 0, total: 0 };
    subjectMap[q.subject].total++;
    if (q.userAnswer === q.correctOption) subjectMap[q.subject].correct++;
  }

  // Test count
  const testCount = await prisma.testAttempt.count({ where: { userId, submittedAt: { not: null } } });

  // Perfect score check
  const perfectTests = await prisma.testAttempt.findMany({
    where: { userId, submittedAt: { not: null } },
    select: { score: true, totalQ: true },
  });
  const hasPerfect = perfectTests.some((t) => t.score !== null && t.totalQ > 0 && t.score === t.totalQ * 4);

  const checks: Array<{ id: string; condition: boolean }> = [
    { id: 'first_question',   condition: totalAnswered >= 1 },
    { id: 'questions_100',    condition: totalAnswered >= 100 },
    { id: 'questions_500',    condition: totalAnswered >= 500 },
    { id: 'first_test',       condition: testCount >= 1 },
    { id: 'perfect_score',    condition: hasPerfect },
    { id: 'streak_3',         condition: user.streak >= 3 },
    { id: 'streak_7',         condition: user.streak >= 7 },
    { id: 'streak_14',        condition: user.streak >= 14 },
    { id: 'streak_30',        condition: user.streak >= 30 },
    { id: 'biology_master',   condition: (subjectMap['Biology']?.total ?? 0) >= 50 && (subjectMap['Biology']?.correct ?? 0) / (subjectMap['Biology']?.total ?? 1) >= 0.7 },
    { id: 'chemistry_master', condition: (subjectMap['Chemistry']?.total ?? 0) >= 50 && (subjectMap['Chemistry']?.correct ?? 0) / (subjectMap['Chemistry']?.total ?? 1) >= 0.7 },
    { id: 'physics_master',   condition: (subjectMap['Physics']?.total ?? 0) >= 50 && (subjectMap['Physics']?.correct ?? 0) / (subjectMap['Physics']?.total ?? 1) >= 0.7 },
    { id: 'daily_champion',   condition: challengeWins >= 1 },
    { id: 'tamil_warrior',    condition: user.language === 'ta' && totalAnswered >= 10 },
    { id: 'xp_500',           condition: user.xp >= 500 },
    { id: 'xp_1500',          condition: user.xp >= 1500 },
    { id: 'xp_3500',          condition: user.xp >= 3500 },
  ];

  for (const { id, condition } of checks) {
    if (condition && !existingBadgeIds.has(id)) {
      try {
        await prisma.badge.create({ data: { userId, badgeId: id } });
        newBadges.push(id);
        existingBadgeIds.add(id);
      } catch { /* unique constraint = already earned */ }
    }
  }

  return newBadges;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

// GET /api/gamification/profile — full gamification profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const [user, badges] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { xp: true, level: true, streak: true, longestStreak: true, lastStudyDate: true, name: true },
      }),
      prisma.badge.findMany({ where: { userId }, select: { badgeId: true, earnedAt: true }, orderBy: { earnedAt: 'desc' } }),
    ]);

    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

    const levelInfo = computeLevel(user.xp);
    const today = todayISO();
    const lastDate = user.lastStudyDate;
    const gapDays = lastDate ? Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)) : 999;

    res.json({
      xp: user.xp,
      levelInfo,
      streak: user.streak,
      longestStreak: user.longestStreak,
      lastStudyDate: user.lastStudyDate,
      gapDays,
      badges: badges.map((b) => ({
        ...b,
        def: BADGE_DEFS.find((d) => d.id === b.badgeId),
      })),
      allBadgeDefs: BADGE_DEFS,
    });
  } catch (err) {
    console.error('Gamification profile error:', err);
    res.status(500).json({ error: 'Failed to fetch gamification profile.' });
  }
});

// POST /api/gamification/activity — award XP, update streak, check badges
// Body: { type: 'test_submit'|'doubt_asked'|'flashcard_reviewed'|'challenge_attempt'|'challenge_correct', metadata?: { correct?: number, wrong?: number } }
router.post('/activity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { type, metadata = {} } = req.body as {
      type: keyof typeof XP_REWARDS | 'test_submit';
      metadata?: { correct?: number; wrong?: number };
    };

    // Compute XP to award
    let xpGained = 0;
    if (type === 'test_submit') {
      xpGained += XP_REWARDS.test_submit;
      xpGained += (metadata.correct ?? 0) * XP_REWARDS.test_correct;
      xpGained += (metadata.wrong ?? 0) * XP_REWARDS.test_wrong;
    } else if (type in XP_REWARDS) {
      xpGained += XP_REWARDS[type as keyof typeof XP_REWARDS];
    }

    // Update streak + XP atomically
    const today = todayISO();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, streak: true, longestStreak: true, lastStudyDate: true },
    });
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

    let newStreak = user.streak;
    let streakChanged = false;

    if (user.lastStudyDate !== today) {
      if (user.lastStudyDate === yesterday) {
        // Continuing streak
        newStreak = user.streak + 1;
        xpGained += XP_REWARDS.streak_bonus * newStreak; // bonus scales with streak
      } else {
        // Streak broken or new
        newStreak = 1;
      }
      streakChanged = true;
    }

    const newXP = user.xp + xpGained;
    const newLongest = Math.max(user.longestStreak, newStreak);
    const newLevelNum = computeLevel(newXP).level;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXP,
        level: newLevelNum,
        streak: newStreak,
        longestStreak: newLongest,
        ...(streakChanged ? { lastStudyDate: today } : {}),
      },
      select: { xp: true, level: true, streak: true, longestStreak: true },
    });

    // Check badges
    const existing = await prisma.badge.findMany({ where: { userId }, select: { badgeId: true } });
    const existingSet = new Set(existing.map((b) => b.badgeId));
    const newBadges = await checkAndAwardBadges(userId, existingSet);

    const levelInfo = computeLevel(updatedUser.xp);

    res.json({
      xpGained,
      xp: updatedUser.xp,
      levelInfo,
      streak: updatedUser.streak,
      streakChanged,
      newBadges: newBadges.map((id) => BADGE_DEFS.find((d) => d.id === id)).filter(Boolean),
    });
  } catch (err) {
    console.error('Activity error:', err);
    res.status(500).json({ error: 'Failed to record activity.' });
  }
});

// GET /api/gamification/mastery — subject mastery % from test history
router.get('/mastery', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const questions = await prisma.testQuestion.findMany({
      where: { attempt: { userId, submittedAt: { not: null } }, userAnswer: { not: null } },
      select: { subject: true, topic: true, userAnswer: true, correctOption: true },
    });

    const subjectMap: Record<string, { correct: number; total: number }> = {};
    const topicMap: Record<string, { subject: string; correct: number; total: number }> = {};

    for (const q of questions) {
      if (!subjectMap[q.subject]) subjectMap[q.subject] = { correct: 0, total: 0 };
      subjectMap[q.subject].total++;
      if (q.userAnswer === q.correctOption) subjectMap[q.subject].correct++;

      if (q.topic) {
        const tKey = `${q.subject}::${q.topic}`;
        if (!topicMap[tKey]) topicMap[tKey] = { subject: q.subject, correct: 0, total: 0 };
        topicMap[tKey].total++;
        if (q.userAnswer === q.correctOption) topicMap[tKey].correct++;
      }
    }

    const subjects = Object.entries(subjectMap).map(([subject, d]) => ({
      subject,
      mastery: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
      correct: d.correct,
      total: d.total,
    })).sort((a, b) => b.mastery - a.mastery);

    // Top weak topics per subject
    const weakTopics = Object.entries(topicMap)
      .filter(([, d]) => d.total >= 3)
      .map(([key, d]) => ({
        key,
        subject: d.subject,
        topic: key.split('::')[1],
        mastery: Math.round((d.correct / d.total) * 100),
        total: d.total,
      }))
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 8);

    res.json({ subjects, weakTopics, totalQuestions: questions.length });
  } catch (err) {
    console.error('Mastery error:', err);
    res.status(500).json({ error: 'Failed to compute mastery.' });
  }
});

// GET /api/gamification/comeback — AI comeback message if gap > 5 days
router.get('/comeback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, lastStudyDate: true, streak: true, xp: true, language: true },
    });
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

    const today = todayISO();
    const lastDate = user.lastStudyDate;
    const gapDays = lastDate
      ? Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (gapDays < 5) {
      res.json({ needsComeback: false, gapDays });
      return;
    }

    const langNote = user.language === 'ta' ? 'Respond in Tamil (Tamil script).' : 'Respond in English.';
    const prompt = `A NEET student named "${user.name ?? 'Student'}" is returning after ${gapDays} days away from studying. They had a streak of ${user.streak} days before and have earned ${user.xp} XP total.

Write a warm, encouraging 3-4 sentence welcome-back message. Be like a supportive coach — not judgemental. Briefly acknowledge the break, welcome them warmly, and give one specific action they can take RIGHT NOW to get back on track (like "solve 5 questions on ${['Biology', 'Chemistry', 'Physics'][Math.floor(Math.random()*3)]}"). End with energy and belief in them. ${langNote}

Do not mention guilt or failure. Focus on the comeback, not the absence.`;

    const message = await chatText({
      user: prompt,
      system: NEET_GEN_SYSTEM,
      maxTokens: 250,
      temperature: 0.8,
      feature: 'comeback-message',
    });

    // Award comeback badge
    try {
      await prisma.badge.upsert({
        where: { userId_badgeId: { userId, badgeId: 'comeback_kid' } },
        create: { userId, badgeId: 'comeback_kid' },
        update: {},
      });
    } catch { /* ignore */ }

    res.json({ needsComeback: true, gapDays, message });
  } catch (err) {
    console.error('Comeback error:', err);
    res.status(500).json({ error: 'Failed to generate comeback message.' });
  }
});

export default router;
