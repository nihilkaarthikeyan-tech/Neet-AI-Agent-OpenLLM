/**
 * Career Guidance — beyond MBBS.
 *
 * Reframes "I didn't get MBBS" from failure to a fork in a road.
 * Critical for TN's suicide-pressure narrative.
 *
 * GET /api/career/paths     — allied health + medical career paths
 * POST /api/career/guide    — personalised career guidance based on score + interests
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { chatText } from '../lib/llm.js';
import { NEET_IDENTITY } from '../lib/prompts.js';
import { languageSchema, languageInstruction } from '../lib/lang.js';

const router = Router();

const CAREER_PATHS = [
  {
    category: 'Medical',
    paths: [
      { name: 'MBBS', duration: '5.5 yrs', seats: 'Govt + Private', neetRequired: true, avgSalary: '₹8–30L/yr', description: 'Doctor — the primary NEET goal' },
      { name: 'BDS (Dentistry)', duration: '5 yrs', seats: 'Govt + Private', neetRequired: true, avgSalary: '₹4–15L/yr', description: 'Dental surgeon — lower cutoff than MBBS, good career' },
      { name: 'BAMS (Ayurveda)', duration: '5.5 yrs', seats: 'Govt + Private', neetRequired: true, avgSalary: '₹3–10L/yr', description: 'Ayurvedic doctor — much lower cutoff' },
      { name: 'BHMS (Homeopathy)', duration: '5.5 yrs', seats: 'Private', neetRequired: true, avgSalary: '₹2–8L/yr', description: 'Homeopathic doctor' },
      { name: 'BUMS (Unani)', duration: '5.5 yrs', seats: 'Govt + Private', neetRequired: true, avgSalary: '₹2–8L/yr', description: 'Unani medicine doctor' },
    ],
  },
  {
    category: 'Allied Health (No NEET cutoff pressure)',
    paths: [
      { name: 'B.Sc Nursing', duration: '4 yrs', seats: 'Govt + Private', neetRequired: false, avgSalary: '₹3–12L/yr', description: 'High demand globally. TN has strong nursing export to Gulf + Europe' },
      { name: 'B.Pharmacy', duration: '4 yrs', seats: 'Govt + Private', neetRequired: false, avgSalary: '₹3–10L/yr', description: 'Pharmaceutical industry — growing fast in India' },
      { name: 'Pharm.D', duration: '6 yrs', seats: 'Private', neetRequired: false, avgSalary: '₹4–12L/yr', description: 'Clinical pharmacist — hospital-based, high demand' },
      { name: 'B.Sc Medical Lab Technology', duration: '3 yrs', seats: 'Govt + Private', neetRequired: false, avgSalary: '₹2–8L/yr', description: 'Run diagnostic labs — growing with private healthcare' },
      { name: 'B.Sc Radiology & Imaging', duration: '3 yrs', seats: 'Govt + Private', neetRequired: false, avgSalary: '₹2–8L/yr', description: 'Operate MRI, CT, X-ray equipment' },
      { name: 'B.Sc Physiotherapy', duration: '4.5 yrs', seats: 'Govt + Private', neetRequired: false, avgSalary: '₹2–10L/yr', description: 'Rehabilitation specialist — huge demand post-COVID' },
      { name: 'B.Sc Optometry', duration: '4 yrs', seats: 'Private', neetRequired: false, avgSalary: '₹2–6L/yr', description: 'Eye care specialist — growing with screen use' },
      { name: 'B.Sc Nutrition & Dietetics', duration: '3 yrs', seats: 'Govt + Private', neetRequired: false, avgSalary: '₹2–7L/yr', description: 'Hospitals + sports + corporate wellness' },
    ],
  },
  {
    category: 'Paramedical',
    paths: [
      { name: 'Diploma in Medical Lab Tech', duration: '2 yrs', seats: 'Govt + Private', neetRequired: false, avgSalary: '₹1.5–5L/yr', description: 'Fastest path into hospitals' },
      { name: 'GNM Nursing', duration: '3 yrs', seats: 'Govt + Private', neetRequired: false, avgSalary: '₹2–8L/yr', description: 'General nursing — direct hospital employment' },
      { name: 'Diploma in Pharmacy (D.Pharm)', duration: '2 yrs', seats: 'Govt + Private', neetRequired: false, avgSalary: '₹1.5–4L/yr', description: 'Run a medical shop or work in a hospital pharmacy' },
    ],
  },
  {
    category: 'Research & Postgrad paths',
    paths: [
      { name: 'B.Sc Biotechnology → M.Sc → PhD', duration: '7+ yrs', seats: 'Govt + Private', neetRequired: false, avgSalary: '₹3–20L/yr', description: 'Research, biotech industry, abroad opportunities' },
      { name: 'B.Sc Biochemistry', duration: '3 yrs', seats: 'Govt', neetRequired: false, avgSalary: '₹2–8L/yr', description: 'Strong base for PGIMER, AIIMS research roles' },
    ],
  },
];

// ── GET /api/career/paths ────────────────────────────────
router.get('/paths', authenticate, (_req: AuthRequest, res: Response) => {
  res.json({ paths: CAREER_PATHS });
});

// ── POST /api/career/guide ───────────────────────────────
const guideSchema = z.object({
  score: z.number().int().min(0).max(720),
  interests: z.array(z.string()).max(5).optional(),
  language: languageSchema,
});

router.post('/guide', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = guideSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { score, interests, language } = parsed.data;

  const systemPrompt = `You are **NEET AI**, the Government of Tamil Nadu's compassionate, knowledgeable career counsellor for NEET students. Your job is to show every student — especially those who didn't score high enough for MBBS — that their Biology+Chemistry knowledge has immense value in many healthcare careers. You are warm, encouraging, and realistic. Never make the student feel like they "failed." Stay strictly on NEET / medical-career guidance — politely decline anything unrelated.

${NEET_IDENTITY}
${languageInstruction(language)}`;

  const userPrompt = `A Tamil Nadu student scored ${score}/720 in NEET.${interests?.length ? ` Their interests: ${interests.join(', ')}.` : ''}

Give them:
1. An honest, caring assessment of their MBBS/BDS chances (one paragraph)
2. The top 3 career paths that PERFECTLY match their score and interests, with why each is a great choice
3. A specific action plan for the next 6 months
4. An encouraging closing message — remind them that doctors are not the only healthcare heroes

Keep the response under 400 words. Be specific to Tamil Nadu — mention TN government colleges, TN schemes, and TN opportunities where relevant.`;

  try {
    const guide = await chatText({ user: userPrompt, system: systemPrompt, maxTokens: 600, temperature: 0.6, feature: 'career-guide' });
    res.json({ guide, paths: CAREER_PATHS });
  } catch {
    res.json({ guide: 'Unable to generate personalised guidance right now. Please see the career paths below.', paths: CAREER_PATHS });
  }
});

export default router;
