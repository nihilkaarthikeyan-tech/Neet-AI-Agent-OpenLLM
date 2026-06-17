import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatJSONArray } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { z } from 'zod';

const router = Router();

const TestQuestionSchema = z.object({
  question: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  correct: z.string(),
  explanation: z.string(),
  ncertSource: z.string().optional(), // "NCERT Bio Class 11, Ch.8 — Cell Cycle"
  wrongAnalysis: z.string().optional(), // why each wrong option is wrong
  subject: z.string().optional(),
  topic: z.string().optional(),
});

const NEET_SUBJECTS = ['Biology', 'Physics', 'Chemistry'] as const;

const generateSchema = z.object({
  subject: z.enum(NEET_SUBJECTS),
  count: z.number().int().min(5).max(45),
  adaptive: z.boolean().optional(),
  topic: z.string().max(100).trim().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'auto']).optional(),
});

// POST /api/tests/generate
// Body: { subject: string, count: number, adaptive?: boolean, topic?: string, difficulty?: 'easy'|'medium'|'hard'|'auto' }
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
    return;
  }
  try {
    const userId = req.userId!;
    const { subject, count, adaptive, topic, difficulty } = parsed.data;

    // Topic mini-test: exactly 5 questions on one topic
    const isMiniTest = !!topic;
    const effectiveCount = isMiniTest ? 5 : count;

    // Resolve difficulty: 'auto' → check last 5 attempts for this subject
    let resolvedDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
    if (difficulty === 'auto' || difficulty === undefined) {
      const recent = await prisma.testAttempt.findMany({
        where: { userId, subject, submittedAt: { not: null }, score: { not: null } },
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: { score: true, totalQ: true },
      });
      if (recent.length >= 2) {
        const avgPct = recent.reduce((sum, a) => sum + ((a.score ?? 0) / (a.totalQ * 4)) * 100, 0) / recent.length;
        if (avgPct >= 70) resolvedDifficulty = 'hard';
        else if (avgPct <= 40) resolvedDifficulty = 'easy';
        else resolvedDifficulty = 'medium';
      }
    } else {
      resolvedDifficulty = difficulty;
    }

    const difficultyInstruction = resolvedDifficulty === 'hard'
      ? 'Generate HARD questions — multi-concept integration, assertion-reason, tricky traps. Avoid straightforward recall.'
      : resolvedDifficulty === 'easy'
      ? 'Generate EASY questions — direct NCERT recall, single concept, clear options.'
      : 'Generate MEDIUM difficulty questions — standard NEET level, mix of recall and application.';

    // Fetch weak areas for adaptive mode (only when no specific topic)
    let weakTopicsHint = '';
    if (adaptive && !isMiniTest) {
      const cache = await prisma.weakAreaCache.findUnique({ where: { userId } });
      if (cache && Array.isArray(cache.topics) && cache.topics.length > 0) {
        const topics = (cache.topics as string[]).slice(0, 5).join(', ');
        weakTopicsHint = `\nPRIORITY: Focus 60–70% of questions on these identified weak topics: ${topics}. Remaining questions may cover other areas of ${subject}.`;
      }
    }

    const topicInstruction = isMiniTest
      ? `\nIMPORTANT: ALL ${effectiveCount} questions MUST be strictly about: "${topic}" — no other topics.`
      : '';

    const prompt = `You are an expert NEET question setter. All questions must be NCERT-grounded.
Generate exactly ${effectiveCount} NEET-standard MCQs for: ${subject}.${weakTopicsHint}${topicInstruction}
${difficultyInstruction}
Each question MUST be traceable to a specific NCERT chapter.

Each question object MUST use this exact structure:
  {
    "question": "The question text?",
    "optionA": "First option",
    "optionB": "Second option",
    "optionC": "Third option",
    "optionD": "Fourth option",
    "correct": "A",
    "explanation": "Why A is correct — reference the specific concept.",
    "ncertSource": "NCERT ${subject} Class 11/12, Chapter X — ChapterName (e.g. 'NCERT Biology Class 11, Ch.8 — Cell Cycle')",
    "wrongAnalysis": "Why B is wrong: [reason]. Why C is wrong: [reason]. Why D is wrong: [reason].",
    "subject": "${subject}",
    "topic": "${isMiniTest ? topic : 'Specific topic (e.g. Mitosis, Electrostatics)'}"
  }
IMPORTANT: ncertSource must name the actual NCERT book, class, and chapter. wrongAnalysis must explain each incorrect option.`;

    let questions: Array<z.infer<typeof TestQuestionSchema>>;
    try {
      questions = await chatJSONArray({
        user: prompt,
        system: NEET_GEN_SYSTEM,
        itemSchema: TestQuestionSchema,
        maxTokens: 8000,
        temperature: 0.4,
        feature: 'tests-generate',
      });
    } catch (e) {
      console.error('Test generation failed:', e);
      res.status(503).json({ error: 'Could not generate questions right now. Please try again.' });
      return;
    }

    if (questions.length === 0) {
      res.status(503).json({ error: 'AI returned no questions. Please try again.' });
      return;
    }

    // Create TestAttempt with nested questions
    const attempt = await prisma.testAttempt.create({
      data: {
        userId,
        subject,
        totalQ: questions.length,
        questions: {
          create: questions.map((q, idx) => ({
            orderIndex: idx,
            questionText: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correct,
            explanation: q.explanation,
            ncertSource: q.ncertSource ?? null,
            wrongAnalysis: q.wrongAnalysis ?? null,
            subject: q.subject ?? subject,
            topic: q.topic ?? '',
          })),
        },
      },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    // Strip correct answers + explanations before sending to client
    const safeAttempt = {
      ...attempt,
      questions: attempt.questions.map((q) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { correctOption: _c, explanation: _e, ...safe } = q;
        return safe;
      }),
    };

    res.json({ attempt: safeAttempt, difficulty: resolvedDifficulty, isMiniTest, topic: topic ?? null });
  } catch (err) {
    console.error('Test generate error:', err);
    res.status(500).json({ error: 'Failed to generate test.' });
  }
});

// GET /api/tests — list user's attempts (no questions, just metadata)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const attempts = await prisma.testAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subject: true,
        totalQ: true,
        score: true,
        timeTaken: true,
        submittedAt: true,
        createdAt: true,
      },
    });
    res.json({ attempts });
  } catch (err) {
    console.error('Test list error:', err);
    res.status(500).json({ error: 'Failed to fetch tests.' });
  }
});

// GET /api/tests/:id — get attempt with questions (answers hidden until submitted)
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params['id'] as string;

    const attempt = await prisma.testAttempt.findFirst({
      where: { id, userId },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!attempt) {
      res.status(404).json({ error: 'Test not found.' });
      return;
    }

    // Hide correctOption and explanation if not yet submitted
    const safeQuestions = attempt.submittedAt
      ? attempt.questions
      : attempt.questions.map((q) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { correctOption: _c, explanation: _e, ...safe } = q;
          return safe;
        });

    res.json({ attempt: { ...attempt, questions: safeQuestions } });
  } catch (err) {
    console.error('Test fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch test.' });
  }
});

// PATCH /api/tests/:id/answer — save user's answer for one question
// Body: { questionId: string, answer: string, timeSpent?: number }
router.patch('/:id/answer', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params['id'] as string;
    const { questionId, answer, timeSpent } = req.body as { questionId: string; answer: string; timeSpent?: number };

    if (!questionId || !answer || !['A', 'B', 'C', 'D'].includes(answer)) {
      res.status(400).json({ error: 'questionId and answer (A/B/C/D) are required.' });
      return;
    }

    // Verify attempt belongs to user and is not yet submitted
    const attempt = await prisma.testAttempt.findFirst({
      where: { id, userId, submittedAt: null },
    });

    if (!attempt) {
      res.status(404).json({ error: 'Active test not found.' });
      return;
    }

    const updated = await prisma.testQuestion.updateMany({
      where: { id: questionId as string, attemptId: id },
      data: {
        userAnswer: answer,
        ...(typeof timeSpent === 'number' && timeSpent >= 0 ? { timeSpent } : {}),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Answer save error:', err);
    res.status(500).json({ error: 'Failed to save answer.' });
  }
});

// POST /api/tests/:id/submit — finalize test, calculate score
// Body: { timeTaken: number }
router.post('/:id/submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params['id'] as string;
    const { timeTaken } = req.body as { timeTaken?: number };

    const attempt = await prisma.testAttempt.findFirst({
      where: { id, userId, submittedAt: null },
      include: { questions: true },
    });

    if (!attempt) {
      res.status(404).json({ error: 'Active test not found.' });
      return;
    }

    // Calculate NEET-style score: +4 correct, -1 wrong, 0 unattempted
    let score = 0;
    for (const q of attempt.questions) {
      if (q.userAnswer === null) continue;
      if (q.userAnswer === q.correctOption) score += 4;
      else score -= 1;
    }

    const updated = await prisma.testAttempt.update({
      where: { id },
      data: {
        score,
        timeTaken: timeTaken ?? null,
        submittedAt: new Date(),
      },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
      },
    });

    res.json({ attempt: updated });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Failed to submit test.' });
  }
});

// POST /api/tests/practice-paper — generate full 180-question NEET practice paper
// Biology 90 (45+45), Physics 45, Chemistry 45 in parallel
router.post('/practice-paper', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const makeBatch = async (subject: string, count: number, classHint?: string) => {
      const hint = classHint ? ` Focus on Class ${classHint} chapters.` : '';
      const prompt = `Generate exactly ${count} NEET-standard MCQs for ${subject}.${hint}
Mix of easy (30%), medium (50%), and hard (20%) questions. Cover diverse topics across the syllabus.
Each question must be NCERT-grounded.

Each question object MUST use this exact structure:
  {
    "question": "question text?",
    "optionA": "option A",
    "optionB": "option B",
    "optionC": "option C",
    "optionD": "option D",
    "correct": "A",
    "explanation": "why correct",
    "ncertSource": "NCERT ${subject} Class 11/12, Ch.X — ChapterName",
    "wrongAnalysis": "Why B wrong. Why C wrong. Why D wrong.",
    "subject": "${subject}",
    "topic": "specific topic"
  }`;
      return chatJSONArray({
        user: prompt,
        system: NEET_GEN_SYSTEM,
        itemSchema: TestQuestionSchema,
        maxTokens: 8000,
        temperature: 0.5,
        feature: 'practice-paper',
      });
    };

    // 4 parallel calls: Bio11 (45) + Bio12 (45) + Physics (45) + Chemistry (45)
    const [bio11, bio12, physics, chemistry] = await Promise.all([
      makeBatch('Biology', 45, '11'),
      makeBatch('Biology', 45, '12'),
      makeBatch('Physics', 45),
      makeBatch('Chemistry', 45),
    ]);

    const allQuestions = [...bio11, ...bio12, ...physics, ...chemistry];
    if (allQuestions.length < 100) {
      res.status(503).json({ error: 'Practice paper generation failed. Please try again.' });
      return;
    }

    const attempt = await prisma.testAttempt.create({
      data: {
        userId,
        subject: 'Mixed',
        totalQ: allQuestions.length,
        questions: {
          create: allQuestions.map((q, idx) => ({
            orderIndex: idx,
            questionText: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correct,
            explanation: q.explanation,
            ncertSource: q.ncertSource ?? null,
            wrongAnalysis: q.wrongAnalysis ?? null,
            subject: q.subject ?? 'Mixed',
            topic: q.topic ?? '',
          })),
        },
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });

    const safeAttempt = {
      ...attempt,
      questions: attempt.questions.map((q) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { correctOption: _c, explanation: _e, ...safe } = q;
        return safe;
      }),
    };

    res.json({ attempt: safeAttempt, totalQ: allQuestions.length, isPracticePaper: true });
  } catch (err) {
    console.error('Practice paper error:', err);
    res.status(500).json({ error: 'Failed to generate practice paper.' });
  }
});

// POST /api/tests/weak-drill — 10 questions each on the 3 weakest topics
router.post('/weak-drill', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Find weakest topics from test history
    const answered = await prisma.testQuestion.findMany({
      where: { attempt: { userId, submittedAt: { not: null } }, userAnswer: { not: null } },
      select: { subject: true, topic: true, userAnswer: true, correctOption: true },
    });

    if (answered.length < 10) {
      res.status(400).json({ error: 'Not enough test history. Complete a few tests first to enable Weak Topic Drill.' });
      return;
    }

    const topicMap: Record<string, { subject: string; correct: number; total: number }> = {};
    for (const q of answered) {
      if (!q.topic) continue;
      const k = `${q.subject}::${q.topic}`;
      if (!topicMap[k]) topicMap[k] = { subject: q.subject, correct: 0, total: 0 };
      topicMap[k].total++;
      if (q.userAnswer === q.correctOption) topicMap[k].correct++;
    }

    const weakTopics = Object.entries(topicMap)
      .filter(([, d]) => d.total >= 3)
      .map(([key, d]) => ({
        key, subject: d.subject,
        topic: key.split('::')[1],
        mastery: Math.round((d.correct / d.total) * 100),
        total: d.total,
      }))
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3);

    if (weakTopics.length < 1) {
      res.status(400).json({ error: 'Not enough topic data yet. Answer more questions across different topics.' });
      return;
    }

    // Generate 10 questions per weak topic in parallel
    const batches = await Promise.all(
      weakTopics.map(({ subject, topic }) =>
        chatJSONArray({
          user: `Generate exactly 10 NEET questions on "${topic}" (${subject}). Mix easy, medium and hard. Focus on concepts the student commonly gets wrong.

Return JSON array, each item:
  {
    "question": "question?",
    "optionA": "A", "optionB": "B", "optionC": "C", "optionD": "D",
    "correct": "A",
    "explanation": "detailed explanation",
    "ncertSource": "NCERT ${subject} — ${topic}",
    "wrongAnalysis": "Why B wrong. Why C wrong. Why D wrong.",
    "subject": "${subject}",
    "topic": "${topic}"
  }`,
          system: NEET_GEN_SYSTEM,
          itemSchema: TestQuestionSchema,
          maxTokens: 4000,
          temperature: 0.4,
          feature: 'weak-drill',
        })
      )
    );

    const allQuestions = batches.flat();
    if (allQuestions.length === 0) {
      res.status(503).json({ error: 'Could not generate drill questions. Please try again.' });
      return;
    }

    const drillSubject = weakTopics.length === 1 ? weakTopics[0].subject : 'Mixed';

    const attempt = await prisma.testAttempt.create({
      data: {
        userId,
        subject: drillSubject,
        totalQ: allQuestions.length,
        questions: {
          create: allQuestions.map((q, idx) => ({
            orderIndex: idx,
            questionText: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correct,
            explanation: q.explanation,
            ncertSource: q.ncertSource ?? null,
            wrongAnalysis: q.wrongAnalysis ?? null,
            subject: q.subject ?? drillSubject,
            topic: q.topic ?? '',
          })),
        },
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });

    const safeAttempt = {
      ...attempt,
      questions: attempt.questions.map((q) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { correctOption: _c, explanation: _e, ...safe } = q;
        return safe;
      }),
    };

    res.json({
      attempt: safeAttempt,
      weakTopics: weakTopics.map((t) => ({ topic: t.topic, subject: t.subject, mastery: t.mastery })),
      isWeakDrill: true,
    });
  } catch (err) {
    console.error('Weak drill error:', err);
    res.status(500).json({ error: 'Failed to generate weak topic drill.' });
  }
});

// PATCH /api/tests/:id/classify — classify error type for a question after submission
// Body: { questionId: string, errorType: string }
router.patch('/:id/classify', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params['id'] as string;
    const { questionId, errorType } = req.body as { questionId: string; errorType: string };

    const validTypes = ['conceptual', 'silly', 'misread', 'time_pressure'];
    if (!questionId || !validTypes.includes(errorType)) {
      res.status(400).json({ error: 'questionId and errorType (conceptual/silly/misread/time_pressure) required.' });
      return;
    }

    const attempt = await prisma.testAttempt.findFirst({ where: { id, userId, submittedAt: { not: null } } });
    if (!attempt) { res.status(404).json({ error: 'Submitted test not found.' }); return; }

    await prisma.testQuestion.updateMany({ where: { id: questionId, attemptId: id }, data: { errorType } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Classify error:', err);
    res.status(500).json({ error: 'Failed to classify error.' });
  }
});

export default router;
