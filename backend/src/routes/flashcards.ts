import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { anthropic, CLAUDE_MODEL } from '../lib/claude.js';

const router = Router();

// POST /api/flashcards/generate
// Body: { subject: string, topic: string, count: number }
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { subject, topic, count } = req.body as {
      subject: string;
      topic: string;
      count: number;
    };

    if (!subject || !topic || !count || count < 5 || count > 30) {
      res.status(400).json({ error: 'subject, topic are required and count must be 5–30.' });
      return;
    }

    const prompt = `You are an expert NEET (National Eligibility cum Entrance Test, India) tutor creating flashcards for a student.
Generate exactly ${count} high-quality flashcards for NEET ${subject}, specifically on the topic: "${topic}".

Each flashcard should:
- Have a concise concept, term, or question on the FRONT
- Have a clear, detailed explanation or answer on the BACK
- Cover important facts, formulas, diagrams descriptions, or conceptual questions

Return ONLY a valid JSON array. Do not include markdown or any text before or after. Use this exact structure:
[
  {
    "front": "What is the powerhouse of the cell?",
    "back": "Mitochondria — It produces ATP via cellular respiration (oxidative phosphorylation). Has its own DNA and double membrane (inner membrane folded into cristae).",
    "topic": "${topic}"
  }
]`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 6000,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiContent = response.content[0];
    if (!aiContent || aiContent.type !== 'text') {
      res.status(500).json({ error: 'Unexpected response from AI.' });
      return;
    }

    let cards: Array<{ front: string; back: string; topic: string }>;
    try {
      const rawText = aiContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      cards = JSON.parse(rawText);
    } catch (e) {
      console.error('Failed to parse Claude JSON for flashcards:', aiContent.text);
      res.status(500).json({ error: 'Failed to parse AI-generated flashcards.' });
      return;
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      res.status(500).json({ error: 'AI returned no flashcards.' });
      return;
    }

    // Save all cards to DB
    await prisma.flashcard.createMany({
      data: cards.map((c) => ({
        userId,
        subject,
        topic: c.topic ?? topic,
        front: c.front,
        back: c.back,
      })),
    });

    // Return newly created cards
    const created = await prisma.flashcard.findMany({
      where: { userId, subject, topic },
      orderBy: { createdAt: 'desc' },
      take: cards.length,
    });

    res.json({ flashcards: created.reverse() });
  } catch (err) {
    console.error('Flashcard generate error:', err);
    res.status(500).json({ error: 'Failed to generate flashcards.' });
  }
});

// GET /api/flashcards — list user's flashcards
// Query: ?subject=Physics&due=true
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { subject, due } = req.query;

    const subjectFilter = subject as string | undefined;
    const dueFilter = due as string | undefined;
    const where: { userId: string; subject?: string; nextReview?: { lte: Date } } = { userId };
    if (subjectFilter) where.subject = subjectFilter;
    if (dueFilter === 'true') where.nextReview = { lte: new Date() };

    const flashcards = await prisma.flashcard.findMany({
      where,
      orderBy: { nextReview: 'asc' },
    });

    res.json({ flashcards });
  } catch (err) {
    console.error('Flashcard list error:', err);
    res.status(500).json({ error: 'Failed to fetch flashcards.' });
  }
});

// SM-2 spaced repetition algorithm
function sm2(repetitions: number, easeFactor: number, interval: number, quality: number) {
  // quality: 1=hard, 3=medium, 5=easy
  let newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEF = Math.max(1.3, newEF);
  let newInterval: number;
  let newReps: number;
  if (quality < 3) {
    newReps = 0;
    newInterval = 1;
  } else {
    newReps = repetitions + 1;
    if (repetitions === 0) newInterval = 1;
    else if (repetitions === 1) newInterval = 6;
    else newInterval = Math.round(interval * easeFactor);
  }
  return { repetitions: newReps, easeFactor: newEF, interval: newInterval };
}

// PATCH /api/flashcards/:id/rate — rate a card and update spaced-repetition schedule
// Body: { rating: "easy" | "medium" | "hard" }
router.patch('/:id/rate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params['id'] as string;
    const { rating } = req.body as { rating: string };

    if (!rating || !['easy', 'medium', 'hard'].includes(rating)) {
      res.status(400).json({ error: 'rating must be easy, medium, or hard.' });
      return;
    }

    const card = await prisma.flashcard.findFirst({ where: { id, userId } });
    if (!card) { res.status(404).json({ error: 'Flashcard not found.' }); return; }

    const qualityMap: Record<string, number> = { hard: 1, medium: 3, easy: 5 };
    const { repetitions, easeFactor, interval } = sm2(
      card.repetitions, card.easeFactor, card.interval, qualityMap[rating]
    );

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    const updated = await prisma.flashcard.update({
      where: { id },
      data: { lastRating: rating, nextReview, reviewCount: { increment: 1 }, repetitions, easeFactor, interval },
    });

    res.json({ flashcard: updated });
  } catch (err) {
    console.error('Flashcard rate error:', err);
    res.status(500).json({ error: 'Failed to rate flashcard.' });
  }
});

// DELETE /api/flashcards/:id — delete a card
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params['id'] as string;

    const deleted = await prisma.flashcard.deleteMany({ where: { id: id as string, userId } });
    if (deleted.count === 0) {
      res.status(404).json({ error: 'Flashcard not found.' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Flashcard delete error:', err);
    res.status(500).json({ error: 'Failed to delete flashcard.' });
  }
});

export default router;
