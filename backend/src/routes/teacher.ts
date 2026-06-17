/**
 * Teacher Portal — government-school teachers track their own students.
 *
 * Teachers get the AI-generated "which 5 chapters is my class weakest in" report,
 * plus per-student progress. Requires role: TEACHER.
 *
 * POST /api/teacher/add-student      — link a student to this teacher
 * GET  /api/teacher/students         — list of teacher's students + progress
 * GET  /api/teacher/class-report     — AI-generated class weakness report
 * POST /api/teacher/verify-answer    — teacher can mark an AI answer as verified
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatText, chatJSONArray } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageInstruction, languageSchema } from '../lib/lang.js';
import { logger } from '../lib/logger.js';

const router = Router();

function requireTeacher(req: AuthRequest, res: Response, next: () => void) {
  if (req.userRole !== 'TEACHER' && req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Teacher access required.' });
    return;
  }
  next();
}

// ── POST /api/teacher/add-student ────────────────────────
router.post('/add-student', authenticate, requireTeacher, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ studentEmail: z.string().email() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }

  try {
    const student = await prisma.user.findUnique({ where: { email: parsed.data.studentEmail }, select: { id: true, name: true, email: true, role: true } });
    if (!student) { res.status(404).json({ error: 'Student not found.' }); return; }
    if (student.role !== 'STUDENT') { res.status(400).json({ error: 'That account is not a student.' }); return; }

    await prisma.teacherStudent.upsert({
      where: { teacherId_studentId: { teacherId: req.userId!, studentId: student.id } },
      update: {},
      create: { teacherId: req.userId!, studentId: student.id },
    });
    res.json({ message: `${student.name ?? student.email} added to your class.`, student });
  } catch (err) {
    logger.error({ err }, 'Add student error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/teacher/students ────────────────────────────
router.get('/students', authenticate, requireTeacher, async (req: AuthRequest, res: Response) => {
  try {
    const links = await prisma.teacherStudent.findMany({ where: { teacherId: req.userId! } });
    const studentIds = links.map((l: { studentId: string }) => l.studentId);
    if (studentIds.length === 0) { res.json({ students: [] }); return; }

    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true, name: true, email: true, district: true, school: true,
        diagnosticCompleted: true, language: true, created_at: true,
        _count: { select: { testAttempts: true, doubtHistory: true } },
        testAttempts: {
          where: { submittedAt: { not: null }, score: { not: null } },
          orderBy: { submittedAt: 'desc' },
          take: 5,
          select: { score: true, totalQ: true, subject: true, submittedAt: true },
        },
      },
    });

    const result = students.map((s) => {
      const latestScore = s.testAttempts[0]
        ? Math.round(((s.testAttempts[0].score ?? 0) / (s.testAttempts[0].totalQ * 4)) * 720)
        : null;
      return { ...s, latestScoreEstimate: latestScore };
    });

    res.json({ students: result });
  } catch (err) {
    logger.error({ err }, 'Teacher students error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/teacher/class-report ───────────────────────
// AI-generated "which 5 chapters is my class weakest in"
router.get('/class-report', authenticate, requireTeacher, async (req: AuthRequest, res: Response) => {
  const language = languageSchema.parse((req.query as { language?: string }).language ?? 'en');

  try {
    const links = await prisma.teacherStudent.findMany({ where: { teacherId: req.userId! } });
    const studentIds = links.map((l: { studentId: string }) => l.studentId);
    if (studentIds.length === 0) { res.json({ report: null, message: 'Add students to your class first.' }); return; }

    const questions = await prisma.testQuestion.findMany({
      where: { attempt: { userId: { in: studentIds }, submittedAt: { not: null } } },
      select: { subject: true, topic: true, correctOption: true, userAnswer: true },
    });

    if (questions.length < 10) {
      res.json({ report: null, message: 'Not enough test data yet. Students need to take more tests.' });
      return;
    }

    // Build class-level topic stats
    const topicStats: Record<string, { correct: number; total: number }> = {};
    for (const q of questions) {
      const key = `${q.subject}: ${q.topic || 'General'}`;
      if (!topicStats[key]) topicStats[key] = { correct: 0, total: 0 };
      topicStats[key].total++;
      if (q.userAnswer === q.correctOption) topicStats[key].correct++;
    }

    const weakTopics = Object.entries(topicStats)
      .map(([topic, d]) => ({ topic, accuracy: Math.round((d.correct / d.total) * 100), total: d.total }))
      .filter((t) => t.total >= 3)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8);

    const prompt = `You are an expert NEET coaching coordinator. Here is the class performance data for a Tamil Nadu government-school teacher's NEET students:

Weakest topics (sorted worst first):
${weakTopics.map((t) => `- ${t.topic}: ${t.accuracy}% accuracy (${t.total} questions)`).join('\n')}

Write a concise teacher report (under 300 words) that:
1. Names the top 5 most urgent chapters to address in class
2. For each chapter, gives ONE specific teaching tip
3. Ends with a class-level action plan for the next 2 weeks
Keep it practical and teacher-friendly.${languageInstruction(language)}`;

    const report = await chatText({ user: prompt, system: NEET_GEN_SYSTEM, maxTokens: 500, temperature: 0.4, feature: 'teacher-class-report' });
    res.json({ report, weakTopics, studentsAnalysed: studentIds.length, questionsAnalysed: questions.length });
  } catch (err) {
    logger.error({ err }, 'Class report error');
    res.status(500).json({ error: 'Failed to generate class report.' });
  }
});

// ── POST /api/teacher/verify-answer ──────────────────────
// Teacher marks an AI answer as verified (accurate, safe, NCERT-correct)
router.post('/verify-answer', authenticate, requireTeacher, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ messageId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Valid messageId required.' }); return; }

  try {
    const msg = await prisma.doubtMessage.findUnique({ where: { id: parsed.data.messageId } });
    if (!msg) { res.status(404).json({ error: 'Message not found.' }); return; }
    if (msg.role !== 'assistant') { res.status(400).json({ error: 'Only AI answers can be verified.' }); return; }

    const updated = await prisma.doubtMessage.update({
      where: { id: parsed.data.messageId },
      data: { verified: true, verifiedBy: req.userId },
    });
    res.json({ message: 'Answer marked as verified.', id: updated.id, verified: true });
  } catch (err) {
    logger.error({ err }, 'Verify answer error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/teacher/recent-answers ──────────────────────
// Get recent AI answers from teacher's students for verification
router.get('/recent-answers', authenticate, requireTeacher, async (req: AuthRequest, res: Response) => {
  try {
    const links = await prisma.teacherStudent.findMany({ where: { teacherId: req.userId! } });
    const studentIds = links.map((l: { studentId: string }) => l.studentId);
    if (studentIds.length === 0) { res.json({ answers: [] }); return; }

    const answers = await prisma.doubtMessage.findMany({
      where: { userId: { in: studentIds }, role: 'assistant' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { user: { select: { name: true, email: true } } },
    });

    res.json({ answers });
  } catch (err) {
    logger.error({ err }, 'Recent answers error');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Feature 43: Teacher Bulk Test ─────────────────────────────────────────────
// Teacher generates one test; system assigns it to all linked students.
// Each student gets their own TestAttempt (reuses the same questions).

const BulkTestQSchema = z.object({
  question: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  correct: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string(),
  subject: z.string(),
  topic: z.string().optional(),
  ncertSource: z.string().optional(),
});

// POST /api/teacher/bulk-test — generate + assign test to whole class
router.post('/bulk-test', authenticate, requireTeacher, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({
    title: z.string().min(3).max(80),
    subject: z.string().min(1),
    count: z.number().int().min(5).max(45).default(10),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }); return; }

  try {
    const { title, subject, count } = parsed.data;

    // Get teacher's students
    const links = await prisma.teacherStudent.findMany({ where: { teacherId: req.userId! } });
    const studentIds = links.map((l: { studentId: string }) => l.studentId);
    if (studentIds.length === 0) {
      res.status(400).json({ error: 'Add students to your class before assigning a test.' });
      return;
    }

    // Generate questions once via AI
    const prompt = `You are an expert NEET question setter. Generate exactly ${count} NEET-standard MCQs for: ${subject}.
Difficulty: MEDIUM. Each question must be NCERT-grounded.
Each question object: { "question", "optionA", "optionB", "optionC", "optionD", "correct"(A/B/C/D), "explanation", "subject":"${subject}", "topic", "ncertSource" }`;

    const questions = await chatJSONArray({
      user: prompt,
      system: NEET_GEN_SYSTEM,
      itemSchema: BulkTestQSchema,
      maxTokens: 8000,
      temperature: 0.4,
      feature: 'teacher-bulk-test',
    });

    if (questions.length === 0) {
      res.status(503).json({ error: 'AI returned no questions. Please try again.' });
      return;
    }

    // Create ClassTest record
    const classTest = await prisma.classTest.create({
      data: { teacherId: req.userId!, title, subject, totalQ: questions.length },
    });

    // For each student: create a TestAttempt with the same question set
    const assignments = await Promise.all(
      studentIds.map(async (studentId: string) => {
        const attempt = await prisma.testAttempt.create({
          data: {
            userId: studentId,
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
                topic: q.topic ?? '',
                ncertSource: q.ncertSource ?? null,
              })),
            },
          },
        });

        await prisma.classTestAssignment.create({
          data: { classTestId: classTest.id, studentId, attemptId: attempt.id },
        });

        return { studentId, attemptId: attempt.id };
      })
    );

    res.status(201).json({
      classTest: { id: classTest.id, title, subject, totalQ: questions.length },
      assignedTo: assignments.length,
    });
  } catch (err) {
    logger.error({ err }, 'Bulk test create error');
    res.status(500).json({ error: 'Failed to create bulk test.' });
  }
});

// GET /api/teacher/bulk-tests — list of class tests with per-student results
router.get('/bulk-tests', authenticate, requireTeacher, async (req: AuthRequest, res: Response) => {
  try {
    const classTests = await prisma.classTest.findMany({
      where: { teacherId: req.userId! },
      orderBy: { createdAt: 'desc' },
      include: {
        assignments: {
          include: {
            classTest: false,
          },
        },
      },
    });

    // For each test, pull the student attempt scores
    const result = await Promise.all(
      classTests.map(async (ct) => {
        const attemptIds = ct.assignments.map((a) => a.attemptId);
        const attempts = await prisma.testAttempt.findMany({
          where: { id: { in: attemptIds } },
          select: { id: true, userId: true, score: true, totalQ: true, submittedAt: true },
        });

        const studentIds = ct.assignments.map((a) => a.studentId);
        const students = await prisma.user.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, name: true, email: true },
        });
        const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));
        const attemptMap = Object.fromEntries(attempts.map((a) => [a.userId, a]));

        const rows = ct.assignments.map((asgn) => {
          const student = studentMap[asgn.studentId];
          const attempt = attemptMap[asgn.studentId];
          const scorePct = attempt?.score !== null && attempt?.score !== undefined
            ? Math.round(((attempt.score) / (attempt.totalQ * 4)) * 100)
            : null;
          return {
            studentName: student?.name ?? student?.email ?? 'Unknown',
            studentEmail: student?.email ?? '',
            scorePct,
            submitted: !!attempt?.submittedAt,
            submittedAt: attempt?.submittedAt ?? null,
          };
        });

        return {
          id: ct.id,
          title: ct.title,
          subject: ct.subject,
          totalQ: ct.totalQ,
          createdAt: ct.createdAt,
          studentCount: rows.length,
          submittedCount: rows.filter((r) => r.submitted).length,
          avgScore: rows.filter((r) => r.scorePct !== null).length > 0
            ? Math.round(rows.filter((r) => r.scorePct !== null).reduce((s, r) => s + (r.scorePct ?? 0), 0) / rows.filter((r) => r.scorePct !== null).length)
            : null,
          rows,
        };
      })
    );

    res.json({ classTests: result });
  } catch (err) {
    logger.error({ err }, 'Bulk tests list error');
    res.status(500).json({ error: 'Failed to load class tests.' });
  }
});

export default router;
