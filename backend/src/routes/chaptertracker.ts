import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// ── Static chapter list — all 97 NCERT chapters for NEET ──────────────────────
export const CHAPTERS = [
  // Biology Class 11 (22 chapters)
  { id: 'bio11_01', subject: 'Biology', cls: 11, num: 1,  name: 'The Living World' },
  { id: 'bio11_02', subject: 'Biology', cls: 11, num: 2,  name: 'Biological Classification' },
  { id: 'bio11_03', subject: 'Biology', cls: 11, num: 3,  name: 'Plant Kingdom' },
  { id: 'bio11_04', subject: 'Biology', cls: 11, num: 4,  name: 'Animal Kingdom' },
  { id: 'bio11_05', subject: 'Biology', cls: 11, num: 5,  name: 'Morphology of Flowering Plants' },
  { id: 'bio11_06', subject: 'Biology', cls: 11, num: 6,  name: 'Anatomy of Flowering Plants' },
  { id: 'bio11_07', subject: 'Biology', cls: 11, num: 7,  name: 'Structural Organisation in Animals' },
  { id: 'bio11_08', subject: 'Biology', cls: 11, num: 8,  name: 'Cell: The Unit of Life' },
  { id: 'bio11_09', subject: 'Biology', cls: 11, num: 9,  name: 'Biomolecules' },
  { id: 'bio11_10', subject: 'Biology', cls: 11, num: 10, name: 'Cell Cycle and Cell Division' },
  { id: 'bio11_11', subject: 'Biology', cls: 11, num: 11, name: 'Transport in Plants' },
  { id: 'bio11_12', subject: 'Biology', cls: 11, num: 12, name: 'Mineral Nutrition' },
  { id: 'bio11_13', subject: 'Biology', cls: 11, num: 13, name: 'Photosynthesis in Higher Plants' },
  { id: 'bio11_14', subject: 'Biology', cls: 11, num: 14, name: 'Respiration in Plants' },
  { id: 'bio11_15', subject: 'Biology', cls: 11, num: 15, name: 'Plant Growth and Development' },
  { id: 'bio11_16', subject: 'Biology', cls: 11, num: 16, name: 'Digestion and Absorption' },
  { id: 'bio11_17', subject: 'Biology', cls: 11, num: 17, name: 'Breathing and Exchange of Gases' },
  { id: 'bio11_18', subject: 'Biology', cls: 11, num: 18, name: 'Body Fluids and Circulation' },
  { id: 'bio11_19', subject: 'Biology', cls: 11, num: 19, name: 'Excretory Products and their Elimination' },
  { id: 'bio11_20', subject: 'Biology', cls: 11, num: 20, name: 'Locomotion and Movement' },
  { id: 'bio11_21', subject: 'Biology', cls: 11, num: 21, name: 'Neural Control and Coordination' },
  { id: 'bio11_22', subject: 'Biology', cls: 11, num: 22, name: 'Chemical Coordination and Integration' },

  // Biology Class 12 (16 chapters)
  { id: 'bio12_01', subject: 'Biology', cls: 12, num: 1,  name: 'Reproduction in Organisms' },
  { id: 'bio12_02', subject: 'Biology', cls: 12, num: 2,  name: 'Sexual Reproduction in Flowering Plants' },
  { id: 'bio12_03', subject: 'Biology', cls: 12, num: 3,  name: 'Human Reproduction' },
  { id: 'bio12_04', subject: 'Biology', cls: 12, num: 4,  name: 'Reproductive Health' },
  { id: 'bio12_05', subject: 'Biology', cls: 12, num: 5,  name: 'Principles of Inheritance and Variation' },
  { id: 'bio12_06', subject: 'Biology', cls: 12, num: 6,  name: 'Molecular Basis of Inheritance' },
  { id: 'bio12_07', subject: 'Biology', cls: 12, num: 7,  name: 'Evolution' },
  { id: 'bio12_08', subject: 'Biology', cls: 12, num: 8,  name: 'Human Health and Disease' },
  { id: 'bio12_09', subject: 'Biology', cls: 12, num: 9,  name: 'Strategies for Enhancement in Food Production' },
  { id: 'bio12_10', subject: 'Biology', cls: 12, num: 10, name: 'Microbes in Human Welfare' },
  { id: 'bio12_11', subject: 'Biology', cls: 12, num: 11, name: 'Biotechnology: Principles and Processes' },
  { id: 'bio12_12', subject: 'Biology', cls: 12, num: 12, name: 'Biotechnology and its Applications' },
  { id: 'bio12_13', subject: 'Biology', cls: 12, num: 13, name: 'Organisms and Populations' },
  { id: 'bio12_14', subject: 'Biology', cls: 12, num: 14, name: 'Ecosystem' },
  { id: 'bio12_15', subject: 'Biology', cls: 12, num: 15, name: 'Biodiversity and Conservation' },
  { id: 'bio12_16', subject: 'Biology', cls: 12, num: 16, name: 'Environmental Issues' },

  // Physics Class 11 (15 chapters)
  { id: 'phy11_01', subject: 'Physics', cls: 11, num: 1,  name: 'Physical World' },
  { id: 'phy11_02', subject: 'Physics', cls: 11, num: 2,  name: 'Units and Measurements' },
  { id: 'phy11_03', subject: 'Physics', cls: 11, num: 3,  name: 'Motion in a Straight Line' },
  { id: 'phy11_04', subject: 'Physics', cls: 11, num: 4,  name: 'Motion in a Plane' },
  { id: 'phy11_05', subject: 'Physics', cls: 11, num: 5,  name: 'Laws of Motion' },
  { id: 'phy11_06', subject: 'Physics', cls: 11, num: 6,  name: 'Work, Energy and Power' },
  { id: 'phy11_07', subject: 'Physics', cls: 11, num: 7,  name: 'System of Particles and Rotational Motion' },
  { id: 'phy11_08', subject: 'Physics', cls: 11, num: 8,  name: 'Gravitation' },
  { id: 'phy11_09', subject: 'Physics', cls: 11, num: 9,  name: 'Mechanical Properties of Solids' },
  { id: 'phy11_10', subject: 'Physics', cls: 11, num: 10, name: 'Mechanical Properties of Fluids' },
  { id: 'phy11_11', subject: 'Physics', cls: 11, num: 11, name: 'Thermal Properties of Matter' },
  { id: 'phy11_12', subject: 'Physics', cls: 11, num: 12, name: 'Thermodynamics' },
  { id: 'phy11_13', subject: 'Physics', cls: 11, num: 13, name: 'Kinetic Theory' },
  { id: 'phy11_14', subject: 'Physics', cls: 11, num: 14, name: 'Oscillations' },
  { id: 'phy11_15', subject: 'Physics', cls: 11, num: 15, name: 'Waves' },

  // Physics Class 12 (14 chapters)
  { id: 'phy12_01', subject: 'Physics', cls: 12, num: 1,  name: 'Electric Charges and Fields' },
  { id: 'phy12_02', subject: 'Physics', cls: 12, num: 2,  name: 'Electrostatic Potential and Capacitance' },
  { id: 'phy12_03', subject: 'Physics', cls: 12, num: 3,  name: 'Current Electricity' },
  { id: 'phy12_04', subject: 'Physics', cls: 12, num: 4,  name: 'Moving Charges and Magnetism' },
  { id: 'phy12_05', subject: 'Physics', cls: 12, num: 5,  name: 'Magnetism and Matter' },
  { id: 'phy12_06', subject: 'Physics', cls: 12, num: 6,  name: 'Electromagnetic Induction' },
  { id: 'phy12_07', subject: 'Physics', cls: 12, num: 7,  name: 'Alternating Current' },
  { id: 'phy12_08', subject: 'Physics', cls: 12, num: 8,  name: 'Electromagnetic Waves' },
  { id: 'phy12_09', subject: 'Physics', cls: 12, num: 9,  name: 'Ray Optics and Optical Instruments' },
  { id: 'phy12_10', subject: 'Physics', cls: 12, num: 10, name: 'Wave Optics' },
  { id: 'phy12_11', subject: 'Physics', cls: 12, num: 11, name: 'Dual Nature of Radiation and Matter' },
  { id: 'phy12_12', subject: 'Physics', cls: 12, num: 12, name: 'Atoms' },
  { id: 'phy12_13', subject: 'Physics', cls: 12, num: 13, name: 'Nuclei' },
  { id: 'phy12_14', subject: 'Physics', cls: 12, num: 14, name: 'Semiconductor Electronics' },

  // Chemistry Class 11 (14 chapters)
  { id: 'chem11_01', subject: 'Chemistry', cls: 11, num: 1,  name: 'Some Basic Concepts of Chemistry' },
  { id: 'chem11_02', subject: 'Chemistry', cls: 11, num: 2,  name: 'Structure of Atom' },
  { id: 'chem11_03', subject: 'Chemistry', cls: 11, num: 3,  name: 'Classification of Elements and Periodicity' },
  { id: 'chem11_04', subject: 'Chemistry', cls: 11, num: 4,  name: 'Chemical Bonding and Molecular Structure' },
  { id: 'chem11_05', subject: 'Chemistry', cls: 11, num: 5,  name: 'States of Matter' },
  { id: 'chem11_06', subject: 'Chemistry', cls: 11, num: 6,  name: 'Thermodynamics' },
  { id: 'chem11_07', subject: 'Chemistry', cls: 11, num: 7,  name: 'Equilibrium' },
  { id: 'chem11_08', subject: 'Chemistry', cls: 11, num: 8,  name: 'Redox Reactions' },
  { id: 'chem11_09', subject: 'Chemistry', cls: 11, num: 9,  name: 'Hydrogen' },
  { id: 'chem11_10', subject: 'Chemistry', cls: 11, num: 10, name: 'The s-Block Elements' },
  { id: 'chem11_11', subject: 'Chemistry', cls: 11, num: 11, name: 'The p-Block Elements' },
  { id: 'chem11_12', subject: 'Chemistry', cls: 11, num: 12, name: 'Organic Chemistry: Basic Principles' },
  { id: 'chem11_13', subject: 'Chemistry', cls: 11, num: 13, name: 'Hydrocarbons' },
  { id: 'chem11_14', subject: 'Chemistry', cls: 11, num: 14, name: 'Environmental Chemistry' },

  // Chemistry Class 12 (16 chapters)
  { id: 'chem12_01', subject: 'Chemistry', cls: 12, num: 1,  name: 'Solutions' },
  { id: 'chem12_02', subject: 'Chemistry', cls: 12, num: 2,  name: 'Electrochemistry' },
  { id: 'chem12_03', subject: 'Chemistry', cls: 12, num: 3,  name: 'Chemical Kinetics' },
  { id: 'chem12_04', subject: 'Chemistry', cls: 12, num: 4,  name: 'Surface Chemistry' },
  { id: 'chem12_05', subject: 'Chemistry', cls: 12, num: 5,  name: 'General Principles of Isolation of Elements' },
  { id: 'chem12_06', subject: 'Chemistry', cls: 12, num: 6,  name: 'The p-Block Elements' },
  { id: 'chem12_07', subject: 'Chemistry', cls: 12, num: 7,  name: 'The d- and f-Block Elements' },
  { id: 'chem12_08', subject: 'Chemistry', cls: 12, num: 8,  name: 'Coordination Compounds' },
  { id: 'chem12_09', subject: 'Chemistry', cls: 12, num: 9,  name: 'Haloalkanes and Haloarenes' },
  { id: 'chem12_10', subject: 'Chemistry', cls: 12, num: 10, name: 'Alcohols, Phenols and Ethers' },
  { id: 'chem12_11', subject: 'Chemistry', cls: 12, num: 11, name: 'Aldehydes, Ketones and Carboxylic Acids' },
  { id: 'chem12_12', subject: 'Chemistry', cls: 12, num: 12, name: 'Amines' },
  { id: 'chem12_13', subject: 'Chemistry', cls: 12, num: 13, name: 'Biomolecules' },
  { id: 'chem12_14', subject: 'Chemistry', cls: 12, num: 14, name: 'Polymers' },
  { id: 'chem12_15', subject: 'Chemistry', cls: 12, num: 15, name: 'Chemistry in Everyday Life' },
  { id: 'chem12_16', subject: 'Chemistry', cls: 12, num: 16, name: 'Aldehydes and Ketones — Advanced' },
];

// GET /api/chapter-tracker — fetch all 97 chapters with user's current statuses
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const saved = await prisma.chapterProgress.findMany({ where: { userId } });
    const statusMap: Record<string, string> = {};
    for (const s of saved) statusMap[s.chapterId] = s.status;

    const chapters = CHAPTERS.map((c) => ({
      ...c,
      status: statusMap[c.id] ?? 'not_started',
    }));

    res.json({ chapters });
  } catch (err) {
    console.error('Chapter tracker fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch chapter progress.' });
  }
});

// PUT /api/chapter-tracker/:chapterId — update chapter status
router.put('/:chapterId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const chapterId = req.params['chapterId'] as string;
    const { status } = req.body as { status: string };

    const valid = ['not_started', 'reading', 'revised', 'done'];
    if (!valid.includes(status)) {
      res.status(400).json({ error: 'status must be not_started|reading|revised|done.' });
      return;
    }

    if (!CHAPTERS.find((c) => c.id === chapterId)) {
      res.status(404).json({ error: 'Chapter not found.' });
      return;
    }

    const updated = await prisma.chapterProgress.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      create: { userId, chapterId, status },
      update: { status },
    });

    res.json({ chapterProgress: updated });
  } catch (err) {
    console.error('Chapter tracker update error:', err);
    res.status(500).json({ error: 'Failed to update chapter status.' });
  }
});

export default router;
