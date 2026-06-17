/**
 * Samacheer Kalvi → NCERT / NEET bridge.
 *
 * This is THE feature that answers Tamil Nadu's core NEET grievance: TN students
 * learn the State Board (Samacheer Kalvi) syllabus, but NEET is NCERT-based.
 * Given a Samacheer topic, we show the student the NCERT/NEET version of it —
 * what extra NCERT adds, what NEET specifically tests, and likely questions.
 * No competitor does this.
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { chatJSON } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageInstruction, languageSchema } from '../lib/lang.js';

const router = Router();

const bridgeRequestSchema = z.object({
  topic: z.string().min(2).max(200),
  subject: z.enum(['Physics', 'Chemistry', 'Biology']),
  classLevel: z.enum(['Class 11', 'Class 12']).optional(),
  language: languageSchema,
});

const BridgeSchema = z.object({
  topic: z.string(),
  samacheerSummary: z.string(),       // how the TN State Board teaches it
  ncertVersion: z.string(),           // how NCERT presents it
  keyDifferences: z.array(z.string()),// the gap that disadvantages TN students
  neetFocusPoints: z.array(z.string()),// what NEET actually tests here
  extraNcertConcepts: z.array(z.string()), // concepts in NCERT but thin/absent in Samacheer
  expectedQuestions: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
});

// POST /api/samacheer/bridge
router.post('/bridge', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = bridgeRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { topic, subject, classLevel, language } = parsed.data;

  const prompt = `You are an expert who knows BOTH the Tamil Nadu State Board (Samacheer Kalvi) ${subject} syllabus AND the NCERT ${subject} syllabus that NEET is based on.

A Tamil Nadu State Board student studied this topic in Samacheer Kalvi${classLevel ? ` (${classLevel})` : ''}:
"${topic}"

Bridge the gap so this student can score on NEET. Be accurate and specific — do not invent content. Provide:
- samacheerSummary: how the Samacheer Kalvi book typically presents this topic.
- ncertVersion: how NCERT presents the same topic (depth, terminology, framing).
- keyDifferences: the concrete differences in emphasis/depth that disadvantage a State Board student on NEET.
- neetFocusPoints: exactly what NEET tends to test on this topic.
- extraNcertConcepts: sub-topics/facts present in NCERT but thin or missing in Samacheer that the student MUST add.
- expectedQuestions: 3-5 realistic NEET-style questions on this topic, each with a concise answer.

Return a single JSON object with keys: topic, samacheerSummary, ncertVersion, keyDifferences (array), neetFocusPoints (array), extraNcertConcepts (array), expectedQuestions (array of {question, answer}).${languageInstruction(language)}`;

  try {
    const bridge = await chatJSON({
      user: prompt,
      system: NEET_GEN_SYSTEM,
      schema: BridgeSchema,
      maxTokens: 3000,
      temperature: 0.3,
      feature: 'samacheer-bridge',
    });
    res.json({ bridge });
  } catch (e) {
    console.error('Samacheer bridge failed:', e);
    res.status(503).json({ error: 'Could not generate the bridge right now. Please try again.' });
  }
});

export default router;
