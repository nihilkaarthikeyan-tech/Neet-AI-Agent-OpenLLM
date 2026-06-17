/**
 * 5-minute daily micro-lessons.
 * One focused lesson per day, per student — fits a phone-first, farm/chores life.
 * Builds streaks without guilt.
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatText } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageInstruction, languageSchema } from '../lib/lang.js';
import { logger } from '../lib/logger.js';

const router = Router();

const SUBJECTS = ['Biology', 'Chemistry', 'Physics'] as const;
const HIGH_YIELD = {
  Biology:   ['Cell Division', 'Human Digestion', 'Photosynthesis', 'Genetics', 'Evolution', 'Ecology', 'Human Reproduction', 'Molecular Biology', 'Plant Physiology', 'Biotechnology'],
  Chemistry: ['Organic Reactions', 'Chemical Bonding', 'Equilibrium', 'Coordination Compounds', 'Electrochemistry', 'p-Block Elements', 'Thermodynamics', 'Biomolecules'],
  Physics:   ['Laws of Motion', 'Electrostatics', 'Modern Physics', 'Optics', 'Thermodynamics', 'Semiconductor Devices', 'Electromagnetic Induction', 'Wave Motion'],
};

// Pick today's subject by cycling through the three (ensures coverage)
function todaySubject(): typeof SUBJECTS[number] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return SUBJECTS[dayOfYear % 3];
}

function todayTopic(subject: typeof SUBJECTS[number]): string {
  const topics = HIGH_YIELD[subject];
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  return topics[week % topics.length];
}

// GET /api/microlesson/today
router.get('/today', authenticate, async (req: AuthRequest, res: Response) => {
  const language = languageSchema.parse((req.query as { language?: string }).language ?? 'en');
  const userId = req.userId!;
  const today = new Date().toISOString().split('T')[0];
  const subject = todaySubject();
  const topic = todayTopic(subject);

  // Return cached lesson if exists
  const existing = await prisma.microLesson.findUnique({ where: { userId_date: { userId, date: today } } });
  if (existing) {
    res.json({ lesson: existing, cached: true });
    return;
  }

  // Generate a fresh 5-minute lesson
  const prompt = `You are a NEET tutor. Write a 5-minute micro-lesson for a NEET aspirant.

Subject: ${subject}
Topic: ${topic}
Format: A focused, energetic lesson a student can read in exactly 5 minutes.

Structure:
🎯 One Key Concept (2 sentences — the single most important thing to know)
📖 NCERT Connection (quote the relevant NCERT line or principle)
🔑 Memory Trick (one memorable technique — acronym, story, visual)
⚡ NEET Trap (the most common mistake or tricky question pattern on this topic)
✅ Quick Check (one MCQ with answer — test if they got it)

Keep it punchy, exam-focused. No padding. Students have only 5 minutes.${languageInstruction(language)}`;

  try {
    const content = await chatText({ user: prompt, system: NEET_GEN_SYSTEM, maxTokens: 600, temperature: 0.5, feature: 'microlesson' });
    const lesson = await prisma.microLesson.create({
      data: { userId, subject, topic, content, date: today },
    });
    res.json({ lesson, cached: false });
  } catch (err) {
    logger.error({ err }, 'Microlesson generate error');
    res.status(503).json({ error: 'Could not generate today\'s lesson. Try again shortly.' });
  }
});

// POST /api/microlesson/complete
router.post('/complete', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const today = new Date().toISOString().split('T')[0];
  try {
    await prisma.microLesson.updateMany({ where: { userId, date: today }, data: { completed: true } });
    res.json({ message: 'Lesson marked complete!' });
  } catch (err) {
    logger.error({ err }, 'Microlesson complete error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/microlesson/streak
router.get('/streak', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const lessons = await prisma.microLesson.findMany({
      where: { userId, completed: true },
      orderBy: { date: 'desc' },
      take: 60,
      select: { date: true },
    });

    // Count consecutive days ending today
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const dates = new Set(lessons.map((l) => l.date));
    let d = new Date();
    while (dates.has(d.toISOString().split('T')[0]) || d.toISOString().split('T')[0] === today) {
      if (dates.has(d.toISOString().split('T')[0])) streak++;
      d = new Date(d.getTime() - 86400000);
      if (streak > 60) break;
    }

    res.json({ streak, totalCompleted: lessons.length });
  } catch (err) {
    logger.error({ err }, 'Microlesson streak error');
    res.status(500).json({ error: 'Failed to load streak.' });
  }
});

export default router;
