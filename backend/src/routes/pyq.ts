import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { anthropic, CLAUDE_MODEL } from '../lib/claude.js';

const router = Router();

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
}

Return ONLY the JSON. No markdown fences.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiContent = response.content[0];
    if (!aiContent || aiContent.type !== 'text') {
      res.status(500).json({ error: 'Unexpected AI response.' });
      return;
    }

    let solution: unknown;
    try {
      const raw = aiContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      solution = JSON.parse(raw);
    } catch {
      // If not valid JSON, return as plain text solution
      solution = { answer: 'See explanation', steps: [aiContent.text], concept: '', memoryTip: '', difficulty: 'Medium' };
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
