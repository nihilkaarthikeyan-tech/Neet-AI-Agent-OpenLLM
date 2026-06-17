import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

const router = Router();

type Category = 'OC' | 'OBC' | 'SC' | 'ST';

// All-India rank bands based on 2020–2024 historical data (approximate)
const RANK_BANDS: Array<{ min: number; max: number; rankMin: number; rankMax: number }> = [
  { min: 700, max: 720, rankMin: 1,      rankMax: 100    },
  { min: 680, max: 699, rankMin: 100,    rankMax: 500    },
  { min: 660, max: 679, rankMin: 500,    rankMax: 1500   },
  { min: 640, max: 659, rankMin: 1500,   rankMax: 4000   },
  { min: 620, max: 639, rankMin: 4000,   rankMax: 8000   },
  { min: 600, max: 619, rankMin: 8000,   rankMax: 15000  },
  { min: 580, max: 599, rankMin: 15000,  rankMax: 25000  },
  { min: 560, max: 579, rankMin: 25000,  rankMax: 40000  },
  { min: 540, max: 559, rankMin: 40000,  rankMax: 60000  },
  { min: 520, max: 539, rankMin: 60000,  rankMax: 85000  },
  { min: 500, max: 519, rankMin: 85000,  rankMax: 120000 },
  { min: 480, max: 499, rankMin: 120000, rankMax: 165000 },
  { min: 460, max: 479, rankMin: 165000, rankMax: 215000 },
  { min: 440, max: 459, rankMin: 215000, rankMax: 275000 },
  { min: 420, max: 439, rankMin: 275000, rankMax: 345000 },
  { min: 400, max: 419, rankMin: 345000, rankMax: 430000 },
  { min: 360, max: 399, rankMin: 430000, rankMax: 580000 },
  { min: 0,   max: 359, rankMin: 580000, rankMax: 1050000 },
];

// Approximate fraction of NEET applicants per category
const CATEGORY_FRACTION: Record<Category, number> = {
  OC: 0.26, OBC: 0.44, SC: 0.18, ST: 0.07,
};

// TN state candidates ≈ 9% of All India total
const TN_FRACTION = 0.09;

// Minimum score to qualify for NEET counselling
const QUALIFY_CUTOFF: Record<Category, number> = {
  OC: 117, OBC: 93, SC: 93, ST: 93,
};

function computeRanks(score: number, category: Category) {
  const band = RANK_BANDS.find((b) => score >= b.min && score <= b.max) ?? RANK_BANDS[RANK_BANDS.length - 1];
  const f = CATEGORY_FRACTION[category];
  return {
    aiRank:       { min: band.rankMin, max: band.rankMax },
    categoryRank: { min: Math.max(1, Math.round(band.rankMin * f)), max: Math.round(band.rankMax * f) },
    tnRank:       { min: Math.max(1, Math.round(band.rankMin * TN_FRACTION)), max: Math.round(band.rankMax * TN_FRACTION) },
    qualifies:    score >= QUALIFY_CUTOFF[category],
    band:         `${band.min}–${band.max}`,
  };
}

// TN Government Medical Colleges with approximate 2023/2024 MBBS admission cutoff scores
const TN_COLLEGES = [
  { name: 'Madras Medical College, Chennai',            seats: 250, cutoffs: { OC: 640, OBC: 578, SC: 488, ST: 418 }, govtBonus: 18 },
  { name: 'Stanley Medical College, Chennai',            seats: 200, cutoffs: { OC: 604, OBC: 542, SC: 458, ST: 385 }, govtBonus: 20 },
  { name: 'Kilpauk Medical College, Chennai',            seats: 150, cutoffs: { OC: 592, OBC: 530, SC: 448, ST: 375 }, govtBonus: 20 },
  { name: 'Madurai Medical College',                     seats: 200, cutoffs: { OC: 572, OBC: 510, SC: 432, ST: 358 }, govtBonus: 22 },
  { name: 'Coimbatore Medical College',                  seats: 200, cutoffs: { OC: 562, OBC: 500, SC: 422, ST: 350 }, govtBonus: 22 },
  { name: 'Rajiv Gandhi Govt General Hospital, Vellore', seats: 150, cutoffs: { OC: 555, OBC: 493, SC: 415, ST: 342 }, govtBonus: 22 },
  { name: 'Thanjavur Medical College',                   seats: 150, cutoffs: { OC: 545, OBC: 483, SC: 407, ST: 333 }, govtBonus: 23 },
  { name: 'Tirunelveli Medical College',                 seats: 150, cutoffs: { OC: 538, OBC: 476, SC: 400, ST: 326 }, govtBonus: 23 },
  { name: 'Chengalpattu Medical College',                seats: 200, cutoffs: { OC: 530, OBC: 468, SC: 393, ST: 318 }, govtBonus: 24 },
  { name: 'Dharmapuri Medical College',                  seats: 100, cutoffs: { OC: 518, OBC: 456, SC: 382, ST: 308 }, govtBonus: 25 },
  { name: 'Salem Medical College',                       seats: 150, cutoffs: { OC: 515, OBC: 453, SC: 378, ST: 305 }, govtBonus: 25 },
  { name: 'Thoothukudi Government Medical College',      seats: 100, cutoffs: { OC: 508, OBC: 446, SC: 372, ST: 298 }, govtBonus: 25 },
  { name: 'Villupuram Medical College',                  seats: 150, cutoffs: { OC: 502, OBC: 440, SC: 366, ST: 292 }, govtBonus: 25 },
  { name: 'Tiruvannamalai Medical College',              seats: 100, cutoffs: { OC: 496, OBC: 434, SC: 360, ST: 286 }, govtBonus: 26 },
];

// NEET qualifying cutoffs + TN state MBBS admission cutoffs (approx) 2018–2024
const CUTOFF_HISTORY = [
  { year: 2024, qualifyOC: 164, qualifyOBC: 129, qualifySC: 129, qualifyST: 129, tnOC: 612, tnOBC: 548, tnSC: 452, tnST: 378 },
  { year: 2023, qualifyOC: 137, qualifyOBC: 107, qualifySC: 107, qualifyST: 107, tnOC: 597, tnOBC: 533, tnSC: 438, tnST: 362 },
  { year: 2022, qualifyOC: 117, qualifyOBC: 93,  qualifySC: 93,  qualifyST: 93,  tnOC: 582, tnOBC: 518, tnSC: 424, tnST: 346 },
  { year: 2021, qualifyOC: 138, qualifyOBC: 108, qualifySC: 108, qualifyST: 108, tnOC: 571, tnOBC: 507, tnSC: 413, tnST: 336 },
  { year: 2020, qualifyOC: 147, qualifyOBC: 113, qualifySC: 113, qualifyST: 113, tnOC: 562, tnOBC: 497, tnSC: 406, tnST: 328 },
  { year: 2019, qualifyOC: 134, qualifyOBC: 107, qualifySC: 107, qualifyST: 107, tnOC: 555, tnOBC: 491, tnSC: 400, tnST: 322 },
  { year: 2018, qualifyOC: 119, qualifyOBC: 96,  qualifySC: 96,  qualifyST: 96,  tnOC: 546, tnOBC: 481, tnSC: 393, tnST: 316 },
];

// POST /api/rank-predictor/predict — score + category → rank estimates
router.post('/predict', authenticate, (req: AuthRequest, res: Response) => {
  const { score, category, isGovtSchool } = req.body as { score: number; category: string; isGovtSchool?: boolean };
  if (typeof score !== 'number' || score < 0 || score > 720) {
    res.status(400).json({ error: 'score must be a number between 0 and 720.' });
    return;
  }
  if (!['OC', 'OBC', 'SC', 'ST'].includes(category)) {
    res.status(400).json({ error: 'category must be OC, OBC, SC, or ST.' });
    return;
  }
  const ranks = computeRanks(score, category as Category);
  res.json({ ...ranks, score, category, isGovtSchool: !!isGovtSchool });
});

// POST /api/rank-predictor/colleges — rank/score + category → TN college buckets
router.post('/colleges', authenticate, (req: AuthRequest, res: Response) => {
  const { score, category, isGovtSchool } = req.body as { score: number; category: string; isGovtSchool?: boolean };
  if (typeof score !== 'number' || score < 0 || score > 720) {
    res.status(400).json({ error: 'score must be between 0 and 720.' });
    return;
  }
  if (!['OC', 'OBC', 'SC', 'ST'].includes(category)) {
    res.status(400).json({ error: 'category must be OC, OBC, SC, or ST.' });
    return;
  }
  const cat = category as Category;
  const likely: typeof TN_COLLEGES = [];
  const possible: typeof TN_COLLEGES = [];
  const reach: typeof TN_COLLEGES = [];

  for (const col of TN_COLLEGES) {
    const effectiveCutoff = col.cutoffs[cat] - (isGovtSchool ? col.govtBonus : 0);
    const diff = score - effectiveCutoff;
    if (diff >= 20)       likely.push(col);
    else if (diff >= 0)   possible.push(col);
    else if (diff >= -30) reach.push(col);
  }
  res.json({ likely, possible, reach, isGovtSchool: !!isGovtSchool });
});

// GET /api/rank-predictor/cutoffs — historical cutoff table
router.get('/cutoffs', authenticate, (_req: AuthRequest, res: Response) => {
  res.json({ cutoffs: CUTOFF_HISTORY });
});

export default router;
