import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { chatJSON, MODELS } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { z } from 'zod';

const router = Router();

const PyqSolutionSchema = z.object({
  answer: z.string(),
  steps: z.array(z.string()),
  concept: z.string().optional().default(''),
  memoryTip: z.string().optional().default(''),
  difficulty: z.string().optional().default('Medium'),
});

// POST /api/pyq/ask — AI step-by-step solution for a PYQ
// Body: { question: string, subject: string, year?: number }
router.post('/ask', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { question, subject, year } = req.body as {
      question: string;
      subject: string;
      year?: number;
    };

    if (!question?.trim() || !subject?.trim()) {
      res.status(400).json({ error: 'question and subject are required.' });
      return;
    }

    const yearContext = year ? ` (NEET ${year})` : ' (NEET PYQ)';

    const prompt = `You are an expert NEET coach solving a previous year question${yearContext} for the subject: ${subject}.

Question: ${question}

Provide a detailed step-by-step solution. Include:
1. The correct answer option (A, B, C, or D) if options are given, OR the final answer if it's a calculation
2. A clear step-by-step explanation of how to arrive at the answer
3. The key concept/formula/fact being tested
4. A memory tip or shortcut to remember this for the exam

Format your response in this exact JSON structure:
{
  "answer": "The correct option or final answer",
  "steps": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "concept": "The key concept being tested",
  "memoryTip": "A helpful tip or shortcut to remember this",
  "difficulty": "Easy | Medium | Hard"
}`;

    let solution: unknown;
    try {
      solution = await chatJSON({
        user: prompt,
        system: NEET_GEN_SYSTEM,
        schema: PyqSolutionSchema,
        model: MODELS.reasoning,
        maxTokens: 1500,
        temperature: 0.2,
        feature: 'pyq-ask',
      });
    } catch {
      // Graceful fallback — never throw a raw 500 at the student.
      solution = {
        answer: 'See explanation',
        steps: ['Could not generate a structured solution this time. Please try again.'],
        concept: '',
        memoryTip: '',
        difficulty: 'Medium',
      };
    }

    res.json({ solution });
  } catch (err) {
    console.error('PYQ ask error:', err);
    res.status(500).json({ error: 'Failed to solve question.' });
  }
});

// GET /api/pyq/topics — high-weightage NEET topics by subject for PYQ browsing
router.get('/topics', authenticate, (_req: AuthRequest, res: Response) => {
  const topics = {
    Physics: [
      'Modern Physics', 'Electrostatics', 'Optics', 'Laws of Motion',
      'Current Electricity', 'Magnetic Effects', 'Semiconductors',
      'Waves & Oscillations', 'Thermodynamics', 'Kinematics',
    ],
    Chemistry: [
      'Organic Reaction Mechanisms', 'Coordination Compounds', 'Chemical Bonding',
      'p-Block Elements', 'Electrochemistry', 'Chemical Kinetics',
      'Biomolecules', 'Polymers', 'Equilibrium', 'd & f Block Elements',
    ],
    Biology: [
      'Genetics & Evolution', 'Human Reproduction', 'Ecology',
      'Cell Biology', 'Plant Physiology', 'Human Physiology',
      'Biotechnology', 'Animal Kingdom', 'Plant Kingdom', 'Microbes in Human Welfare',
    ],
  };
  res.json({ topics });
});

export default router;
