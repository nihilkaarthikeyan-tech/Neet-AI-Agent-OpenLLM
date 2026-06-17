import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

const noteSchema = z.object({
  title: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1, 'content is required.').max(50_000),
  subject: z.string().trim().max(100).optional(),
  pinned: z.boolean().optional(),
});

// ── Personal Notes ────────────────────────────────────────────────────────────

// GET /api/notes
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notes = await prisma.personalNote.findMany({
      where: { userId: req.userId! },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    });
    res.json({ notes });
  } catch (err) {
    console.error('Notes list error:', err);
    res.status(500).json({ error: 'Failed to fetch notes.' });
  }
});

// POST /api/notes — create note
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }); return; }
  try {
    const { title, content, subject } = parsed.data;

    const note = await prisma.personalNote.create({
      data: { userId: req.userId!, title: title?.trim() || 'Untitled', content: content.trim(), subject: subject ?? '' },
    });
    res.status(201).json({ note });
  } catch (err) {
    console.error('Note create error:', err);
    res.status(500).json({ error: 'Failed to create note.' });
  }
});

const noteUpdateSchema = z.object({
  title: z.string().max(200).trim().optional(),
  content: z.string().min(1).max(50_000).trim().optional(),
  subject: z.string().max(100).trim().optional(),
  pinned: z.boolean().optional(),
});

// PUT /api/notes/:id — update note
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = noteUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }); return; }
  try {
    const existing = await prisma.personalNote.findFirst({ where: { id: req.params['id'] as string, userId: req.userId! } });
    if (!existing) { res.status(404).json({ error: 'Note not found.' }); return; }

    const { title, content, subject, pinned } = parsed.data;
    const note = await prisma.personalNote.update({
      where: { id: req.params['id'] as string },
      data: {
        ...(title !== undefined && { title: title.trim() || 'Untitled' }),
        ...(content !== undefined && { content: content.trim() }),
        ...(subject !== undefined && { subject }),
        ...(pinned !== undefined && { pinned }),
      },
    });
    res.json({ note });
  } catch (err) {
    console.error('Note update error:', err);
    res.status(500).json({ error: 'Failed to update note.' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await prisma.personalNote.deleteMany({ where: { id: req.params['id'] as string, userId: req.userId! } });
    if (deleted.count === 0) { res.status(404).json({ error: 'Note not found.' }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error('Note delete error:', err);
    res.status(500).json({ error: 'Failed to delete note.' });
  }
});

// ── Highlights ────────────────────────────────────────────────────────────────

// GET /api/notes/highlights
router.get('/highlights', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const highlights = await prisma.savedHighlight.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ highlights });
  } catch (err) {
    console.error('Highlights list error:', err);
    res.status(500).json({ error: 'Failed to fetch highlights.' });
  }
});

// POST /api/notes/highlights — save highlight
router.post('/highlights', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { content, sourceContext, subject } = req.body as { content: string; sourceContext?: string; subject?: string };
    if (!content?.trim()) { res.status(400).json({ error: 'content is required.' }); return; }

    const highlight = await prisma.savedHighlight.create({
      data: { userId: req.userId!, content: content.trim(), sourceContext: sourceContext ?? '', subject: subject ?? '' },
    });
    res.status(201).json({ highlight });
  } catch (err) {
    console.error('Highlight save error:', err);
    res.status(500).json({ error: 'Failed to save highlight.' });
  }
});

// DELETE /api/notes/highlights/:id
router.delete('/highlights/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await prisma.savedHighlight.deleteMany({ where: { id: req.params['id'] as string, userId: req.userId! } });
    if (deleted.count === 0) { res.status(404).json({ error: 'Highlight not found.' }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error('Highlight delete error:', err);
    res.status(500).json({ error: 'Failed to delete highlight.' });
  }
});

// ── Formula Bookmarks ─────────────────────────────────────────────────────────

// GET /api/notes/formulas
router.get('/formulas', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const formulas = await prisma.formulaBookmark.findMany({
      where: { userId: req.userId! },
      orderBy: [{ subject: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ formulas });
  } catch (err) {
    console.error('Formula list error:', err);
    res.status(500).json({ error: 'Failed to fetch formulas.' });
  }
});

// POST /api/notes/formulas — bookmark formula
router.post('/formulas', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { formula, subject, topic } = req.body as { formula: string; subject: string; topic?: string };
    if (!formula?.trim() || !subject?.trim()) { res.status(400).json({ error: 'formula and subject are required.' }); return; }

    const bookmark = await prisma.formulaBookmark.create({
      data: { userId: req.userId!, formula: formula.trim(), subject: subject.trim(), topic: topic ?? '' },
    });
    res.status(201).json({ bookmark });
  } catch (err) {
    console.error('Formula bookmark error:', err);
    res.status(500).json({ error: 'Failed to bookmark formula.' });
  }
});

// DELETE /api/notes/formulas/:id
router.delete('/formulas/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await prisma.formulaBookmark.deleteMany({ where: { id: req.params['id'] as string, userId: req.userId! } });
    if (deleted.count === 0) { res.status(404).json({ error: 'Formula not found.' }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error('Formula delete error:', err);
    res.status(500).json({ error: 'Failed to delete formula.' });
  }
});

export default router;
