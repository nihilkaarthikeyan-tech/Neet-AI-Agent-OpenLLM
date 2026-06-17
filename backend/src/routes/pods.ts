/**
 * Study Group Pods — feature 44
 *
 * POST /api/pods/create          — create a pod (owner), returns join code
 * POST /api/pods/join            — join by code (max 5 members)
 * GET  /api/pods/mine            — list pods the student belongs to
 * GET  /api/pods/:podId          — pod detail: members + leaderboard + flashcards
 * POST /api/pods/:podId/flashcard — add a shared flashcard to the pod
 * DELETE /api/pods/:podId/leave  — leave a pod
 */
import { Router, type Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';

const router = Router();
const MAX_POD_SIZE = 5;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable chars
  let code = 'POD-';
  for (let i = 0; i < 4; i++) code += chars[crypto.randomInt(chars.length)];
  return code;
}

// POST /api/pods/create
router.post('/create', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ name: z.string().min(3).max(40) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid name.' }); return; }

  try {
    let code = generateCode();
    // Regenerate if collision (very rare)
    while (await prisma.studyPod.findUnique({ where: { code } })) {
      code = generateCode();
    }

    const pod = await prisma.studyPod.create({
      data: {
        name: parsed.data.name,
        code,
        ownerId: req.userId!,
        members: { create: { userId: req.userId! } },
      },
      include: { members: true },
    });

    res.status(201).json({ pod: { id: pod.id, name: pod.name, code: pod.code, memberCount: pod.members.length } });
  } catch (err) {
    logger.error({ err }, 'Pod create error');
    res.status(500).json({ error: 'Failed to create pod.' });
  }
});

// POST /api/pods/join
router.post('/join', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ code: z.string().min(4).max(10).toUpperCase() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Valid join code required.' }); return; }

  try {
    const pod = await prisma.studyPod.findUnique({
      where: { code: parsed.data.code },
      include: { members: true },
    });

    if (!pod) { res.status(404).json({ error: 'Pod not found. Check the code.' }); return; }

    const alreadyMember = pod.members.some((m) => m.userId === req.userId!);
    if (alreadyMember) { res.status(409).json({ error: 'You are already in this pod.' }); return; }

    if (pod.members.length >= MAX_POD_SIZE) {
      res.status(409).json({ error: `This pod is full (${MAX_POD_SIZE} members max).` });
      return;
    }

    await prisma.studyPodMember.create({ data: { podId: pod.id, userId: req.userId! } });

    res.json({ pod: { id: pod.id, name: pod.name, code: pod.code, memberCount: pod.members.length + 1 } });
  } catch (err) {
    logger.error({ err }, 'Pod join error');
    res.status(500).json({ error: 'Failed to join pod.' });
  }
});

// GET /api/pods/mine
router.get('/mine', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await prisma.studyPodMember.findMany({
      where: { userId: req.userId! },
      include: {
        pod: {
          include: {
            members: { select: { userId: true } },
            _count: { select: { flashcards: true } },
          },
        },
      },
    });

    const pods = memberships.map((m) => ({
      id: m.pod.id,
      name: m.pod.name,
      code: m.pod.code,
      isOwner: m.pod.ownerId === req.userId!,
      memberCount: m.pod.members.length,
      flashcardCount: m.pod._count.flashcards,
      joinedAt: m.joinedAt,
    }));

    res.json({ pods });
  } catch (err) {
    logger.error({ err }, 'Pods list error');
    res.status(500).json({ error: 'Failed to load pods.' });
  }
});

// GET /api/pods/:podId — detail: members + leaderboard (by XP) + flashcards
router.get('/:podId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const podId = req.params['podId'] as string;

    const pod = await prisma.studyPod.findUnique({
      where: { id: podId },
      include: {
        members: { select: { userId: true, joinedAt: true } },
        flashcards: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!pod) { res.status(404).json({ error: 'Pod not found.' }); return; }

    const isMember = pod.members.some((m) => m.userId === req.userId!);
    if (!isMember) { res.status(403).json({ error: 'You are not in this pod.' }); return; }

    const memberIds = pod.members.map((m) => m.userId);

    // Leaderboard: rank members by total XP
    const memberUsers = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, xp: true, level: true, streak: true },
    });

    const leaderboard = memberUsers
      .sort((a, b) => b.xp - a.xp)
      .map((u, i) => ({
        rank: i + 1,
        name: u.name ?? 'Student',
        xp: u.xp,
        level: u.level,
        streak: u.streak,
        isMe: u.id === req.userId!,
      }));

    res.json({
      pod: {
        id: pod.id,
        name: pod.name,
        code: pod.code,
        isOwner: pod.ownerId === req.userId!,
      },
      leaderboard,
      flashcards: pod.flashcards,
    });
  } catch (err) {
    logger.error({ err }, 'Pod detail error');
    res.status(500).json({ error: 'Failed to load pod.' });
  }
});

// POST /api/pods/:podId/flashcard — add shared flashcard
router.post('/:podId/flashcard', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({
    front: z.string().min(1).max(1000),
    back: z.string().min(1).max(1000),
    subject: z.string().min(1),
    topic: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }); return; }

  try {
    const podId = req.params['podId'] as string;

    const isMember = await prisma.studyPodMember.findUnique({
      where: { podId_userId: { podId, userId: req.userId! } },
    });
    if (!isMember) { res.status(403).json({ error: 'You are not in this pod.' }); return; }

    const card = await prisma.podFlashcard.create({
      data: {
        podId,
        createdById: req.userId!,
        front: parsed.data.front,
        back: parsed.data.back,
        subject: parsed.data.subject,
        topic: parsed.data.topic ?? '',
      },
    });

    res.status(201).json({ card });
  } catch (err) {
    logger.error({ err }, 'Pod flashcard add error');
    res.status(500).json({ error: 'Failed to add flashcard.' });
  }
});

// DELETE /api/pods/:podId/leave
router.delete('/:podId/leave', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const podId = req.params['podId'] as string;

    const pod = await prisma.studyPod.findUnique({ where: { id: podId } });
    if (!pod) { res.status(404).json({ error: 'Pod not found.' }); return; }

    if (pod.ownerId === req.userId!) {
      res.status(400).json({ error: 'Pod owner cannot leave. Delete the pod or transfer ownership first.' });
      return;
    }

    await prisma.studyPodMember.deleteMany({ where: { podId, userId: req.userId! } });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Pod leave error');
    res.status(500).json({ error: 'Failed to leave pod.' });
  }
});

export default router;
