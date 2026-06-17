import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { chatJSONArray } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { z } from 'zod';

const router = Router();

const NcertQuestionSchema = z.object({
  question: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  correct: z.string(),
  explanation: z.string(),
  ncertLine: z.string().optional(),
});

const CHAPTERS: Record<string, Record<string, string[]>> = {
  Physics: {
    'Class 11': ['Physical World & Units', 'Motion in a Straight Line', 'Motion in a Plane', 'Laws of Motion', 'Work, Energy & Power', 'System of Particles & Rotational Motion', 'Gravitation', 'Mechanical Properties of Solids', 'Mechanical Properties of Fluids', 'Thermal Properties of Matter', 'Thermodynamics', 'Kinetic Theory', 'Oscillations', 'Waves'],
    'Class 12': ['Electric Charges & Fields', 'Electrostatic Potential & Capacitance', 'Current Electricity', 'Moving Charges & Magnetism', 'Magnetism & Matter', 'Electromagnetic Induction', 'Alternating Current', 'Electromagnetic Waves', 'Ray Optics & Optical Instruments', 'Wave Optics', 'Dual Nature of Radiation & Matter', 'Atoms', 'Nuclei', 'Semiconductor Electronics'],
  },
  Chemistry: {
    'Class 11': ['Some Basic Concepts', 'Structure of Atom', 'Classification of Elements', 'Chemical Bonding & Molecular Structure', 'States of Matter', 'Thermodynamics', 'Equilibrium', 'Redox Reactions', 'Hydrogen', 's-Block Elements', 'p-Block Elements (11)', 'Organic Chemistry Basics', 'Hydrocarbons', 'Environmental Chemistry'],
    'Class 12': ['Solutions', 'Electrochemistry', 'Chemical Kinetics', 'Surface Chemistry', 'd & f Block Elements', 'Coordination Compounds', 'Haloalkanes & Haloarenes', 'Alcohols, Phenols & Ethers', 'Aldehydes, Ketones & Carboxylic Acids', 'Amines', 'Biomolecules', 'Polymers', 'Chemistry in Everyday Life'],
  },
  Biology: {
    'Class 11': ['The Living World', 'Biological Classification', 'Plant Kingdom', 'Animal Kingdom', 'Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Structural Organisation in Animals', 'Cell: Unit of Life', 'Biomolecules', 'Cell Cycle & Cell Division', 'Transport in Plants', 'Mineral Nutrition', 'Photosynthesis in Higher Plants', 'Respiration in Plants', 'Plant Growth & Development', 'Digestion & Absorption', 'Breathing & Exchange of Gases', 'Body Fluids & Circulation', 'Excretory Products & Elimination', 'Locomotion & Movement', 'Neural Control & Coordination', 'Chemical Coordination & Integration'],
    'Class 12': ['Reproduction in Organisms', 'Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Reproductive Health', 'Principles of Inheritance & Variation', 'Molecular Basis of Inheritance', 'Evolution', 'Human Health & Disease', 'Strategies for Enhancement in Food Production', 'Microbes in Human Welfare', 'Biotechnology: Principles & Processes', 'Biotechnology & Its Applications', 'Organisms & Populations', 'Ecosystem', 'Biodiversity & Conservation', 'Environmental Issues'],
  },
};

// GET /api/ncert/chapters — return chapter list
router.get('/chapters', authenticate, (_req: AuthRequest, res: Response) => {
  res.json({ chapters: CHAPTERS });
});

// POST /api/ncert/quiz — generate NCERT chapter quiz
// Body: { subject, classLevel, chapter, count }
router.post('/quiz', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, chapter, count = 10 } = req.body as {
      subject: string; chapter: string; count?: number;
    };

    if (!subject || !chapter) {
      res.status(400).json({ error: 'subject and chapter are required.' });
      return;
    }
    if (count < 5 || count > 30) {
      res.status(400).json({ error: 'count must be 5–30.' });
      return;
    }

    const prompt = `You are an expert NEET tutor creating a chapter-coverage quiz.
Generate exactly ${count} MCQs strictly from NCERT ${subject} chapter: "${chapter}".
Questions must test line-by-line NCERT content — definitions, diagrams, examples, and facts exactly as stated in the NCERT textbook.
Every question must have 4 options (A/B/C/D) with exactly one correct answer.

Each question object must use this exact structure:
  {
    "question": "Question text?",
    "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...",
    "correct": "A",
    "explanation": "Detailed explanation referencing the NCERT concept.",
    "ncertLine": "The exact or paraphrased NCERT line this tests."
  }`;

    let questions: Array<z.infer<typeof NcertQuestionSchema>>;
    try {
      questions = await chatJSONArray({
        user: prompt,
        system: NEET_GEN_SYSTEM,
        itemSchema: NcertQuestionSchema,
        maxTokens: 8000,
        temperature: 0.3,
        feature: 'ncert-quiz',
      });
    } catch (e) {
      console.error('NCERT quiz generation failed:', e);
      res.status(503).json({ error: 'Could not generate the quiz right now. Please try again.' });
      return;
    }

    res.json({ questions, subject, chapter });
  } catch (err) {
    console.error('NCERT quiz error:', err);
    res.status(500).json({ error: 'Failed to generate NCERT quiz.' });
  }
});

export default router;
