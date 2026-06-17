/**
 * TN Counselling Intelligence — uniquely valuable for govt-school students.
 *
 * GET  /api/counselling/simulate  — input score + category → realistic TN colleges
 * GET  /api/counselling/schemes   — TN free coaching + financial aid schemes
 * GET  /api/counselling/info      — 7.5% reservation, all-India quota, counselling dates
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { chatJSON } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageSchema, languageInstruction } from '../lib/lang.js';

const router = Router();

// TN 2024 approximate cutoffs for reference
const CUTOFFS_2024 = {
  'MBBS - Government College': {
    General: 617, OBC: 595, BC_Muslim: 580, SC: 480, ST: 420,
    GovtSchool_7_5: 566,
  },
  'MBBS - Self-Finance': {
    General: 530, OBC: 510, BC_Muslim: 500, SC: 400, ST: 350,
    GovtSchool_7_5: 480,
  },
  'BDS - Government': {
    General: 510, OBC: 490, SC: 380, ST: 320, GovtSchool_7_5: 460,
  },
};

const TN_SCHEMES = [
  {
    name: 'Free NEET Coaching — Government Schools (CM Special Scheme)',
    eligibility: 'Government school students, Class 12 or recently passed',
    benefit: 'Free residential coaching at designated centres across TN districts',
    contact: 'School Education Dept, Tamil Nadu',
  },
  {
    name: 'Naan Mudhalvan Scheme',
    eligibility: 'Class 9–12 government school students',
    benefit: 'Free skill courses, UPSC coaching (₹7,500/month stipend), NEET guidance',
    contact: 'naanmudhalvan.tn.gov.in',
  },
  {
    name: 'Dr. Ambedkar Government Arts College Coaching',
    eligibility: 'SC/ST students',
    benefit: 'Free residential NEET coaching',
    contact: 'Adi Dravidar Welfare Dept, TN',
  },
  {
    name: 'BC/MBC NEET Coaching',
    eligibility: 'BC/MBC community students from government schools',
    benefit: 'Free coaching at government-run centres',
    contact: 'BC/MBC Welfare Dept, TN',
  },
  {
    name: '7.5% Horizontal Reservation',
    eligibility: 'Students who studied in TN government schools for Classes 6–12',
    benefit: '7.5% of MBBS/BDS seats in government colleges reserved — can secure a seat 50+ marks below general cutoff',
    contact: 'Tamil Nadu Dr. MGR Medical University',
  },
];

const simSchema = z.object({
  score: z.number().int().min(0).max(720),
  category: z.enum(['General', 'OBC', 'BC_Muslim', 'SC', 'ST']),
  isGovtSchool: z.boolean().default(false),
  language: languageSchema,
});

// ── GET /api/counselling/schemes ─────────────────────────
router.get('/schemes', authenticate, (_req: AuthRequest, res: Response) => {
  res.json({ schemes: TN_SCHEMES });
});

// ── GET /api/counselling/info ────────────────────────────
router.get('/info', authenticate, (_req: AuthRequest, res: Response) => {
  res.json({
    reservation75: {
      title: '7.5% Government School Horizontal Reservation',
      description: 'Tamil Nadu exclusively reserves 7.5% of MBBS and BDS seats in government colleges for students who completed Classes 6–12 in government schools. This is separate from caste reservation and applies on top of it.',
      keyFacts: [
        'Applies to ALL government school students regardless of caste',
        'You can get a government MBBS seat ~50 marks below the general cutoff',
        'Must have studied in a TN government school from Class 6 to 12',
        'Implemented from 2020–21 academic year',
        'About 385 MBBS seats per year under this quota',
      ],
      cutoffs2024: CUTOFFS_2024,
    },
    allIndiaQuota: {
      description: '15% of government college MBBS seats go to All India Quota (MCC counselling). TN students compete nationally for these.',
      tip: 'Score above 600 to be competitive for AIQ government seats.',
    },
    counsellingProcess: [
      'NEET result announced (usually June)',
      'TN Selection Committee announces rank list',
      'Online registration on tnmedicalselection.net',
      'Certificate verification at nodal centres',
      'Option entry (college + course preferences)',
      'Allotment results — accept online',
      'Report to allotted college with original documents',
    ],
  });
});

// ── POST /api/counselling/simulate ───────────────────────
router.post('/simulate', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = simSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { score, category, isGovtSchool, language } = parsed.data;

  // Quick local assessment from known cutoffs
  const catKey = category as keyof typeof CUTOFFS_2024['MBBS - Government College'];
  const govtCutoff = CUTOFFS_2024['MBBS - Government College'][catKey] ?? CUTOFFS_2024['MBBS - Government College'].General;
  const sfCutoff   = CUTOFFS_2024['MBBS - Self-Finance'][catKey] ?? CUTOFFS_2024['MBBS - Self-Finance'].General;
  const govtCutoff75 = isGovtSchool ? CUTOFFS_2024['MBBS - Government College'].GovtSchool_7_5 : null;

  const prompt = `You are a TN NEET counselling expert. A student scored ${score}/720 in NEET UG 2024.
Category: ${category}. Government school student: ${isGovtSchool ? 'YES (eligible for 7.5% quota)' : 'NO'}.

Based on Tamil Nadu 2024 NEET counselling data:
- MBBS Govt College cutoff (${category}): ~${govtCutoff}
- MBBS Self-Finance cutoff (${category}): ~${sfCutoff}
${isGovtSchool ? `- MBBS Govt College 7.5% quota cutoff: ~${govtCutoff75} (STUDENT IS ELIGIBLE)` : ''}

Provide a realistic counselling assessment with:
1. likelihood of getting MBBS in government college (High/Medium/Low/Unlikely) with reason
2. likelihood of getting MBBS in self-finance college
3. likelihood of getting BDS in government college
4. top 5 realistic college options with approximate cutoffs
5. 3 specific action points for this student based on their score
6. If score is below all cutoffs — realistic allied health paths (BDS, BAMS, nursing, pharmacy, BSc) they qualify for

Return a JSON object:
{
  "govtMBBS": {"likelihood": "Medium", "reason": "..."},
  "sfMBBS": {"likelihood": "High", "reason": "..."},
  "govtBDS": {"likelihood": "High", "reason": "..."},
  "quota75": {"eligible": true/false, "likelihood": "...", "reason": "..."},
  "collegeOptions": [{"name": "...", "course": "...", "type": "Govt/SF", "approxCutoff": 560}],
  "actionPoints": ["...", "...", "..."],
  "alliedPaths": ["..."]
}${languageInstruction(language)}`;

  try {
    const SimSchema = {
      parse: (v: unknown) => v,
    };
    const result = await chatJSON({
      user: prompt,
      system: NEET_GEN_SYSTEM,
      schema: { parse: (v: unknown) => v as Record<string, unknown> } as any,
      maxTokens: 1500,
      temperature: 0.3,
      feature: 'counselling-sim',
    });
    res.json({ simulation: result, score, category, isGovtSchool });
  } catch {
    // Fallback: return local assessment only
    res.json({
      simulation: {
        govtMBBS: { likelihood: score >= govtCutoff ? 'High' : score >= govtCutoff - 30 ? 'Medium' : 'Low', reason: `Cutoff ~${govtCutoff}` },
        sfMBBS:   { likelihood: score >= sfCutoff   ? 'High' : score >= sfCutoff   - 30 ? 'Medium' : 'Low', reason: `Cutoff ~${sfCutoff}` },
        quota75:  { eligible: isGovtSchool, likelihood: isGovtSchool && score >= (govtCutoff75 ?? 999) ? 'High' : 'Low', reason: isGovtSchool ? `7.5% cutoff ~${govtCutoff75}` : 'Not eligible' },
        actionPoints: ['Take more mock tests', 'Focus on weak chapters', 'Review TN counselling schedule'],
        alliedPaths: ['BDS', 'BAMS', 'B.Sc Nursing', 'B.Pharmacy'],
      },
      score, category, isGovtSchool,
    });
  }
});

export default router;
