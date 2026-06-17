/**
 * NTA Exam Simulator — full exam-day experience.
 *
 * Generates a proper NEET-pattern exam:
 *  - Physics:  Section A (35 MCQ) + Section B (15 MCQ, attempt any 10)
 *  - Chemistry: Section A (35 MCQ) + Section B (15 MCQ, attempt any 10)
 *  - Biology:  Section A (70 MCQ) + Section B (30 MCQ, attempt any 20)
 *  Total: 180 Qs, 200 min (for full mock)
 *  Mini mock: 45 Qs, 50 min
 *
 * Marking: +4 correct, -1 wrong, 0 skipped
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatJSONArray } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageInstruction, languageSchema } from '../lib/lang.js';
import { logger } from '../lib/logger.js';

const router = Router();

const NTAQuestionSchema = z.object({
  subject: z.enum(['Physics', 'Chemistry', 'Biology']),
  section: z.enum(['A', 'B']),
  topic: z.string(),
  question: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  correct: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string(),
});

const generateSchema = z.object({
  mode: z.enum(['mini', 'full']).default('mini'),
  language: languageSchema,
});

// POST /api/nta/generate
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { mode, language } = parsed.data;

  // Mini: 15 Physics + 15 Chemistry + 15 Biology = 45 questions, 50 min
  // Full: 50 Physics + 50 Chemistry + 100 Biology = 200 questions — too expensive; use 90
  const counts = mode === 'mini'
    ? { Physics: 15, Chemistry: 15, Biology: 15, durationMin: 50 }
    : { Physics: 30, Chemistry: 30, Biology: 30, durationMin: 100 };

  const prompt = `You are an expert NTA NEET question setter. Generate exactly ${counts.Physics + counts.Chemistry + counts.Biology} high-quality NEET-standard MCQs.

Distribution:
- ${counts.Physics} Physics questions (Section A: ${Math.round(counts.Physics * 0.7)} questions, Section B: ${Math.round(counts.Physics * 0.3)} questions)
- ${counts.Chemistry} Chemistry questions (Section A: ${Math.round(counts.Chemistry * 0.7)}, Section B: ${Math.round(counts.Chemistry * 0.3)})
- ${counts.Biology} Biology questions (Section A: ${Math.round(counts.Biology * 0.7)}, Section B: ${Math.round(counts.Biology * 0.3)})

Each question: 4 options (A/B/C/D), exactly one correct. Section A = must-attempt. Section B = optional.
Cover diverse NEET topics. Include easy (30%), medium (50%), hard (20%) distribution.

JSON structure per question:
{
  "subject": "Biology",
  "section": "A",
  "topic": "Cell Division",
  "question": "Which enzyme catalyzes the replication of DNA?",
  "optionA": "DNA Polymerase",
  "optionB": "RNA Polymerase",
  "optionC": "Helicase",
  "optionD": "Ligase",
  "correct": "A",
  "explanation": "DNA Polymerase III catalyzes the addition of nucleotides during DNA replication..."
}${languageInstruction(language)}`;

  try {
    const questions = await chatJSONArray({
      user: prompt,
      system: NEET_GEN_SYSTEM,
      itemSchema: NTAQuestionSchema,
      maxTokens: 20000,
      temperature: 0.3,
      feature: 'nta-generate',
    });

    res.json({
      questions,
      mode,
      durationMinutes: counts.durationMin,
      totalQuestions: questions.length,
      marking: { correct: 4, wrong: -1, skipped: 0 },
      maxScore: questions.length * 4,
    });
  } catch (err) {
    logger.error({ err }, 'NTA generate error');
    res.status(503).json({ error: 'Could not generate exam. Please try again.' });
  }
});

// POST /api/nta/submit
const submitSchema = z.object({
  examData: z.object({
    mode: z.enum(['mini', 'full']),
    questions: z.array(z.object({
      subject: z.string(),
      section: z.string(),
      topic: z.string(),
      question: z.string(),
      optionA: z.string(), optionB: z.string(), optionC: z.string(), optionD: z.string(),
      correct: z.string(),
      explanation: z.string(),
    })),
    durationMinutes: z.number(),
  }),
  answers: z.record(z.string(), z.string()),
  timeTakenSeconds: z.number(),
  language: languageSchema,
});

router.post('/submit', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { examData, answers, timeTakenSeconds } = parsed.data;
  const userId = req.userId!;

  const { questions } = examData;
  let totalScore = 0;
  let correct = 0; let wrong = 0; let skipped = 0;

  const subjectStats: Record<string, { correct: number; wrong: number; skipped: number; score: number }> = {};

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ans = answers[String(i)] ?? null;
    if (!subjectStats[q.subject]) subjectStats[q.subject] = { correct: 0, wrong: 0, skipped: 0, score: 0 };

    if (!ans) {
      skipped++;
      subjectStats[q.subject].skipped++;
    } else if (ans === q.correct) {
      correct++;
      totalScore += 4;
      subjectStats[q.subject].correct++;
      subjectStats[q.subject].score += 4;
    } else {
      wrong++;
      totalScore -= 1;
      subjectStats[q.subject].wrong++;
      subjectStats[q.subject].score -= 1;
    }
  }

  // Save as a TestAttempt so it shows up in analytics
  try {
    const attempt = await prisma.testAttempt.create({
      data: {
        userId,
        subject: 'Full NTA Mock',
        totalQ: questions.length,
        score: totalScore,
        timeTaken: timeTakenSeconds,
        submittedAt: new Date(),
        questions: {
          create: questions.map((q, i) => ({
            orderIndex: i,
            questionText: q.question,
            optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
            correctOption: q.correct,
            explanation: q.explanation,
            subject: q.subject,
            topic: q.topic,
            userAnswer: (answers[String(i)] as string | undefined) ?? null,
          })),
        },
      },
    });

    res.json({
      attemptId: attempt.id,
      totalScore,
      maxScore: questions.length * 4,
      percentage: Math.round((totalScore / (questions.length * 4)) * 100),
      scaledTo720: Math.round((Math.max(0, totalScore) / (questions.length * 4)) * 720),
      correct, wrong, skipped,
      subjectStats,
      timeTakenMinutes: Math.round(timeTakenSeconds / 60),
    });
  } catch (err) {
    logger.error({ err }, 'NTA submit error');
    res.status(500).json({ error: 'Failed to save results.' });
  }
});

export default router;
