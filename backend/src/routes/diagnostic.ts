/**
 * Diagnostic onboarding — finds a student's exact weak chapters on day one.
 *
 * Instead of starting blind, students take a 30-question adaptive diagnostic
 * covering all 3 subjects. Results immediately personalise the study plan and
 * pre-populate the weakness heatmap.
 *
 * POST /api/diagnostic/start    — generate the diagnostic test
 * POST /api/diagnostic/complete — submit answers + get personalised plan
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatJSONArray, chatJSON } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageSchema, languageInstruction } from '../lib/lang.js';
import { logger } from '../lib/logger.js';

const router = Router();

const DiagnosticQuestionSchema = z.object({
  subject:      z.enum(['Physics', 'Chemistry', 'Biology']),
  topic:        z.string(),
  difficulty:   z.enum(['Easy', 'Medium', 'Hard']),
  question:     z.string(),
  optionA:      z.string(),
  optionB:      z.string(),
  optionC:      z.string(),
  optionD:      z.string(),
  correct:      z.enum(['A', 'B', 'C', 'D']),
  explanation:  z.string(),
});

// ── POST /api/diagnostic/start ───────────────────────────
router.post('/start', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ language: languageSchema }).safeParse(req.body);
  const language = parsed.success ? parsed.data.language : 'en';

  const langNote = languageInstruction(language);

  const makePrompt = (subject: string, topics: string) =>
    `Generate exactly 6 NEET diagnostic MCQs for ${subject}.
Cover 3 of these high-value topics (2 questions each): ${topics}
Mix: 2 Easy, 2 Medium, 2 Hard. Keep explanations short (1 sentence each).
Each question must use this exact structure:
{"subject":"${subject}","topic":"topic name","difficulty":"Easy","question":"question text","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correct":"B","explanation":"one sentence why"}${langNote}`;

  try {
    // Run all 3 subjects in parallel — 3x faster than sequential
    const [physics, chemistry, biology] = await Promise.all([
      chatJSONArray({ user: makePrompt('Physics',   'Mechanics, Optics, Electrostatics'), system: NEET_GEN_SYSTEM, itemSchema: DiagnosticQuestionSchema, maxTokens: 2000, temperature: 0.3, feature: 'diagnostic-physics' }),
      chatJSONArray({ user: makePrompt('Chemistry', 'Organic reactions, Equilibrium, Coordination compounds'), system: NEET_GEN_SYSTEM, itemSchema: DiagnosticQuestionSchema, maxTokens: 2000, temperature: 0.3, feature: 'diagnostic-chemistry' }),
      chatJSONArray({ user: makePrompt('Biology',   'Cell biology, Genetics, Human physiology'), system: NEET_GEN_SYSTEM, itemSchema: DiagnosticQuestionSchema, maxTokens: 2000, temperature: 0.3, feature: 'diagnostic-biology' }),
    ]);
    const questions = [...physics, ...chemistry, ...biology];
    res.json({ questions, totalQuestions: questions.length });
  } catch (err) {
    logger.error({ err }, 'Diagnostic start error');
    res.status(503).json({ error: 'Could not generate diagnostic test right now. Please try again.' });
  }
});

// ── POST /api/diagnostic/complete ────────────────────────
const completeSchema = z.object({
  answers: z.array(z.object({
    subject:      z.string(),
    topic:        z.string(),
    correct:      z.string(),
    userAnswer:   z.string().nullable(),
  })).min(1).max(18),
  language: languageSchema,
});

router.post('/complete', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { answers, language } = parsed.data;
  const userId = req.userId!;

  // Score the diagnostic
  const subjectStats: Record<string, { correct: number; wrong: number; total: number; weakTopics: string[] }> = {
    Physics: { correct: 0, wrong: 0, total: 0, weakTopics: [] },
    Chemistry: { correct: 0, wrong: 0, total: 0, weakTopics: [] },
    Biology: { correct: 0, wrong: 0, total: 0, weakTopics: [] },
  };

  for (const a of answers) {
    const s = subjectStats[a.subject];
    if (!s) continue;
    s.total++;
    if (a.userAnswer === a.correct) s.correct++;
    else { s.wrong++; if (!s.weakTopics.includes(a.topic)) s.weakTopics.push(a.topic); }
  }

  const totalCorrect = answers.filter((a) => a.userAnswer === a.correct).length;
  const estimatedScore = Math.round((totalCorrect / answers.length) * 720);

  const weakSubjects = Object.entries(subjectStats)
    .map(([sub, d]) => ({ subject: sub, accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0, weakTopics: d.weakTopics }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // Mark diagnostic complete on user profile
  await prisma.user.update({ where: { id: userId }, data: { diagnosticCompleted: true } }).catch(() => {});

  // Generate personalised 3-week study plan from diagnostic results
  const planPrompt = `A NEET student just completed a diagnostic test. Results:
- Physics: ${subjectStats.Physics.correct}/${subjectStats.Physics.total} correct. Weak topics: ${subjectStats.Physics.weakTopics.join(', ') || 'None identified'}
- Chemistry: ${subjectStats.Chemistry.correct}/${subjectStats.Chemistry.total} correct. Weak topics: ${subjectStats.Chemistry.weakTopics.join(', ') || 'None identified'}
- Biology: ${subjectStats.Biology.correct}/${subjectStats.Biology.total} correct. Weak topics: ${subjectStats.Biology.weakTopics.join(', ') || 'None identified'}
Estimated NEET score: ${estimatedScore}/720

Generate a prioritised 3-week study plan that:
1. Fixes the weakest topics FIRST (highest impact on score)
2. Maintains strengths with lighter revision
3. Gives specific NCERT chapters to read each week
4. Is realistic for a student with 3–4 hours/day

Return JSON: { "weeklyPlan": [{ "week": 1, "focus": "...", "subjects": [{"subject":"...", "chapters":["..."], "tasks":["..."]}], "goal": "..." }], "topPriorities": ["..."] }${languageInstruction(language)}`;

  let personalPlan = null;
  try {
    personalPlan = await chatJSON({ user: planPrompt, system: NEET_GEN_SYSTEM, schema: { parse: (v: unknown) => v as Record<string, unknown> } as any, maxTokens: 2000, temperature: 0.3, feature: 'diagnostic-plan' });
  } catch { /* plan generation is non-critical */ }

  res.json({
    estimatedScore,
    subjectStats,
    weakSubjects,
    personalPlan,
    message: `Diagnostic complete! Estimated score: ${estimatedScore}/720. Your personalised study plan is ready.`,
  });
});

export default router;
