import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { anthropic, CLAUDE_MODEL } from '../lib/claude.js';

const router = Router();

// POST /api/tests/generate
// Body: { subject: string, count: number }
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { subject, count } = req.body as { subject: string; count: number };

    if (!subject || !count || count < 5 || count > 45) {
      res.status(400).json({ error: 'subject is required and count must be 5–45.' });
      return;
    }

    const prompt = `You are an expert NEET (National Eligibility cum Entrance Test, India) question setter.
Generate exactly ${count} high-quality multiple-choice questions for the subject: ${subject}.
Each question must be NEET-level difficulty and have exactly 4 options (A, B, C, D) with one correct answer.

Return ONLY a valid JSON array. Do not include markdown or any text before or after. Use this exact structure:
[
  {
    "question": "The question text here?",
    "optionA": "First option",
    "optionB": "Second option",
    "optionC": "Third option",
    "optionD": "Fourth option",
    "correct": "A",
    "explanation": "A detailed explanation of why the correct answer is right and why the others are wrong.",
    "subject": "${subject}"
  }
]`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiContent = response.content[0];
    if (!aiContent || aiContent.type !== 'text') {
      res.status(500).json({ error: 'Unexpected response from AI.' });
      return;
    }

    let questions: Array<{
      question: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correct: string;
      explanation: string;
      subject: string;
    }>;

    try {
      // Strip markdown code fences if present
      const rawText = aiContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(rawText);
    } catch (e) {
      console.error('Failed to parse Claude JSON for test questions:', aiContent.text);
      res.status(500).json({ error: 'Failed to parse AI-generated questions.' });
      return;
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(500).json({ error: 'AI returned no questions.' });
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
            subject: q.subject ?? subject,
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

    res.json({ attempt: safeAttempt });
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
// Body: { questionId: string, answer: string }
router.patch('/:id/answer', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params['id'] as string;
    const { questionId, answer } = req.body as { questionId: string; answer: string };

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
      data: { userAnswer: answer },
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

export default router;
