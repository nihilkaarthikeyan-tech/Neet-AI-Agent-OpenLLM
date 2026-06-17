/**
 * Parent Dashboard — feature 42
 *
 * Students generate a short access code. Parents visit /parent/:code to see
 * a read-only summary: days active, tests taken, weak areas.
 *
 * POST /api/parent/setup              — student creates / refreshes their parent link
 * GET  /api/parent/my-link            — student fetches their existing code
 * GET  /api/parent/view/:code         — public (no auth): parent reads dashboard by code
 * PUT  /api/parent/phone              — student adds/updates parent's phone number
 */
import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';

const router = Router();

function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[crypto.randomInt(chars.length)];
  return code;
}

// POST /api/parent/setup — create or return existing link
router.post('/setup', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.parentLink.findUnique({ where: { studentId: req.userId! } });
    if (existing) {
      res.json({ code: existing.code });
      return;
    }

    let code = makeCode();
    while (await prisma.parentLink.findUnique({ where: { code } })) {
      code = makeCode();
    }

    const link = await prisma.parentLink.create({
      data: { studentId: req.userId!, code },
    });

    res.status(201).json({ code: link.code });
  } catch (err) {
    logger.error({ err }, 'Parent setup error');
    res.status(500).json({ error: 'Failed to create parent link.' });
  }
});

// GET /api/parent/my-link
router.get('/my-link', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const link = await prisma.parentLink.findUnique({ where: { studentId: req.userId! } });
    if (!link) { res.json({ code: null }); return; }
    res.json({ code: link.code, parentPhone: link.parentPhone });
  } catch (err) {
    logger.error({ err }, 'Parent link fetch error');
    res.status(500).json({ error: 'Failed to fetch link.' });
  }
});

// PUT /api/parent/phone — student saves parent's phone
router.put('/phone', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ phone: z.string().min(10).max(15) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Valid phone number required.' }); return; }

  try {
    const link = await prisma.parentLink.findUnique({ where: { studentId: req.userId! } });
    if (!link) { res.status(404).json({ error: 'Set up parent link first.' }); return; }

    await prisma.parentLink.update({
      where: { studentId: req.userId! },
      data: { parentPhone: parsed.data.phone },
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Parent phone update error');
    res.status(500).json({ error: 'Failed to update phone.' });
  }
});

// GET /api/parent/view/:code — public endpoint (no auth needed)
router.get('/view/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params['code'] as string;

    const link = await prisma.parentLink.findUnique({ where: { code } });
    if (!link) { res.status(404).json({ error: 'Invalid parent access code.' }); return; }

    const student = await prisma.user.findUnique({
      where: { id: link.studentId },
      select: { name: true, district: true, school: true, xp: true, streak: true, longestStreak: true, level: true, created_at: true },
    });

    if (!student) { res.status(404).json({ error: 'Student not found.' }); return; }

    // Tests taken + avg score
    const attempts = await prisma.testAttempt.findMany({
      where: { userId: link.studentId, submittedAt: { not: null }, score: { not: null } },
      orderBy: { submittedAt: 'desc' },
      select: { score: true, totalQ: true, subject: true, submittedAt: true },
    });

    const totalTests = attempts.length;
    const avgScorePct = totalTests > 0
      ? Math.round(attempts.reduce((s, a) => s + ((a.score ?? 0) / (a.totalQ * 4)) * 100, 0) / totalTests)
      : null;
    const estNeet = avgScorePct !== null ? Math.round((avgScorePct / 100) * 720) : null;

    // Active days (unique calendar days with any test)
    const activeDays = new Set(
      attempts
        .filter((a) => a.submittedAt)
        .map((a) => (a.submittedAt as Date).toISOString().slice(0, 10))
    ).size;

    // Weak subjects (lowest avg score per subject)
    const subjectMap: Record<string, { total: number; count: number }> = {};
    for (const a of attempts) {
      if (!subjectMap[a.subject]) subjectMap[a.subject] = { total: 0, count: 0 };
      subjectMap[a.subject].total += ((a.score ?? 0) / (a.totalQ * 4)) * 100;
      subjectMap[a.subject].count++;
    }

    const subjectSummary = Object.entries(subjectMap)
      .map(([subject, d]) => ({ subject, avgPct: Math.round(d.total / d.count), testCount: d.count }))
      .sort((a, b) => a.avgPct - b.avgPct);

    const weakAreas = subjectSummary.slice(0, 2).map((s) => s.subject);

    // Chapter completion counts
    const chapters = await prisma.chapterProgress.groupBy({
      by: ['status'],
      where: { userId: link.studentId },
      _count: { status: true },
    });
    const chapterStats = Object.fromEntries(chapters.map((c) => [c.status, c._count.status]));

    // Doubts asked this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const doubtsThisWeek = await prisma.doubtMessage.count({
      where: { userId: link.studentId, role: 'user', createdAt: { gte: weekAgo } },
    });

    res.json({
      student: {
        name: student.name ?? 'Student',
        district: student.district,
        school: student.school,
        xp: student.xp,
        streak: student.streak,
        longestStreak: student.longestStreak,
        level: student.level,
        memberSince: student.created_at,
      },
      stats: {
        totalTests,
        avgScorePct,
        estNeet,
        activeDays,
        doubtsThisWeek,
        weakAreas,
      },
      subjects: subjectSummary,
      chapters: {
        done: chapterStats['done'] ?? 0,
        revised: chapterStats['revised'] ?? 0,
        reading: chapterStats['reading'] ?? 0,
        notStarted: chapterStats['not_started'] ?? 0,
      },
      recentTests: attempts.slice(0, 5).map((a) => ({
        subject: a.subject,
        scorePct: Math.round(((a.score ?? 0) / (a.totalQ * 4)) * 100),
        date: a.submittedAt,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Parent view error');
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

export default router;
