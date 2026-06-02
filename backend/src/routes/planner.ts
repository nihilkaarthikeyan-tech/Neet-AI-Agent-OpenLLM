import { Router, type Request, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatJSON } from '../lib/llm.js';
import { z } from 'zod';

const router = Router();

const StudyPlanSchema = z.object({
  plan: z.array(
    z.object({
      day: z.string(),
      focus: z.string(),
      tasks: z.array(z.string()),
    }),
  ),
});

// GET /api/planner — fetch the user's most recent study plan
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const plan = await prisma.studyPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ studyPlan: plan ?? null });
  } catch (err) {
    console.error('Planner fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch study plan.' });
  }
});

// POST /api/planner/generate
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { examDate, weakSubjects } = req.body as {
      examDate: string;
      weakSubjects: string[];
    };

    if (!examDate || !weakSubjects || !Array.isArray(weakSubjects)) {
      res.status(400).json({ error: 'Missing examDate or weakSubjects array.' });
      return;
    }

    const userId = req.userId!;

    // 1. Send prompt to the LLM to get a JSON study plan
    const prompt = `You are an expert NEET (National Eligibility cum Entrance Test in India) coach and study planner.
A student needs a day-by-day study plan. 
Exam Date: ${examDate}
Their weakest subjects right now: ${weakSubjects.join(', ')}

Create a concise, structured 7-day study plan focusing heavily on their weakest subjects but maintaining a balance with other NEET subjects (Physics, Chemistry, Biology). 

The JSON object must cover 7 days using exactly this structure:
{
  "plan": [
    {
      "day": "Day 1",
      "focus": "Brief theme of the day",
      "tasks": ["Task 1", "Task 2 - Revise organic chem", "Task 3 - Mock test section"]
    }
  ]
}`;

    let parsedPlan;
    try {
      parsedPlan = await chatJSON({
        user: prompt,
        schema: StudyPlanSchema,
        maxTokens: 1500,
        temperature: 0.2, // Low temperature for deterministic JSON structure
        feature: 'planner-generate',
      });
    } catch (e) {
      console.error('Study plan generation failed:', e);
      res.status(503).json({ error: 'Could not generate a study plan right now. Please try again.' });
      return;
    }

    // 2. Save the generated plan to the database
    const studyPlan = await prisma.studyPlan.create({
      data: {
        userId,
        examDate: new Date(examDate),
        weakSubjects,
        planJson: parsedPlan,
      },
    });

    res.json({ studyPlan });
  } catch (err) {
    console.error('Planner Error:', err);
    res.status(500).json({ error: 'Failed to generate study plan.' });
  }
});

export default router;
