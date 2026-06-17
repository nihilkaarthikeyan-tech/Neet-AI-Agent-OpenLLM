/**
 * Wellbeing — mental-health & anti-pressure support.
 *
 * NEET-related student stress is a deeply sensitive, politically prominent issue
 * in Tamil Nadu. This route lets a student do a quick stress check-in and get a
 * calm, supportive reply — and it ALWAYS routes any crisis signal to the safety
 * guard (helplines), never to a free-generating model. The message to the
 * government: we care about the child, not just the score.
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { chatText } from '../lib/llm.js';
import { languageInstruction, languageSchema } from '../lib/lang.js';
import { isCrisisMessage, CRISIS_RESOURCES } from '../lib/safety.js';

const router = Router();

const checkinSchema = z.object({
  mood: z.enum(['great', 'okay', 'stressed', 'overwhelmed', 'anxious']),
  note: z.string().max(2000).optional(),
  language: languageSchema,
});

// GET /api/wellbeing/helplines — always-available official helplines.
router.get('/helplines', authenticate, (_req: AuthRequest, res: Response) => {
  res.json({ helplines: CRISIS_RESOURCES.helplines });
});

// POST /api/wellbeing/checkin
router.post('/checkin', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = checkinSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { mood, note, language } = parsed.data;

  // Crisis short-circuit: any self-harm signal in the note → care + helplines,
  // and we flag it so the UI can surface the helpline prominently.
  if (isCrisisMessage(note)) {
    res.json({
      crisis: true,
      message: CRISIS_RESOURCES.message,
      helplines: CRISIS_RESOURCES.helplines,
    });
    return;
  }

  const systemPrompt = `You are a warm, calm wellbeing companion for a NEET aspirant in Tamil Nadu. You are NOT a therapist and you do not diagnose. Your job: acknowledge the student's feelings, normalise exam stress, and offer 2-3 small, practical, kind suggestions (a short break, breathing, talking to someone, a tiny next step). Keep it under 120 words. Never be preachy. Never push them harder to study. Remind them gently that their worth is not their NEET score. If asked what AI or model you are, reply only that you are NEET AI, the Tamil Nadu Government's official study assistant — never name any model, company, or vendor.${languageInstruction(language)}`;

  const userPrompt = `The student reported their mood as "${mood}".${note ? ` They wrote: "${note}"` : ''} Respond supportively.`;

  try {
    const message = await chatText({
      user: userPrompt,
      system: systemPrompt,
      maxTokens: 300,
      temperature: 0.7,
      feature: 'wellbeing-checkin',
    });
    res.json({ crisis: false, message, helplines: CRISIS_RESOURCES.helplines });
  } catch (e) {
    console.error('Wellbeing check-in failed:', e);
    // Even on failure, never leave a stressed student with nothing.
    res.json({
      crisis: false,
      message: 'Take a slow breath. You are doing your best, and that is enough today. Step away for five minutes, drink some water, and be kind to yourself. 🌱',
      helplines: CRISIS_RESOURCES.helplines,
    });
  }
});

export default router;
