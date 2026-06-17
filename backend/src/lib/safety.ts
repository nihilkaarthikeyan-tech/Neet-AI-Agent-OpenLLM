/**
 * Safety guard — the single place that decides when a student message needs a
 * human, not a model.
 *
 * Two reasons this exists, both critical for a GOVERNMENT-branded product:
 *  1. Mental health. NEET stress is a politically sensitive, life-and-death
 *     issue in Tamil Nadu. If a student expresses self-harm or hopelessness,
 *     we must NEVER hand that to a free LLM and hope. We short-circuit to a
 *     calm, supportive message + official helplines.
 *  2. Reputation. A "Government of Tamil Nadu" AI that gets jailbroken into
 *     emitting harmful content is a headline. Detecting crisis intent and
 *     refusing to free-generate on it is the first layer of that defence.
 *
 * Detection is intentionally simple keyword matching (English + Tamil +
 * common transliteration). It is tuned to OVER-trigger: a false positive just
 * shows a caring message and a helpline, which is harmless. A false negative is
 * the outcome we refuse to risk.
 */

// Crisis / self-harm signals. Lowercased substring match.
const CRISIS_PATTERNS: string[] = [
  // English
  'suicide', 'suicidal', 'kill myself', 'killing myself', 'end my life',
  'end it all', 'want to die', 'wanna die', 'don\'t want to live',
  'do not want to live', 'no reason to live', 'better off dead', 'self harm',
  'self-harm', 'cut myself', 'hang myself', 'jump off', 'overdose',
  'worthless', 'hopeless', 'can\'t go on', 'cant go on', 'give up on life',
  // Common transliterated Tamil
  'saavu', 'saaganum', 'saaka', 'thatkolai', 'thற்கொலை',
  // Tamil script
  'தற்கொலை', 'சாக', 'சாகணும்', 'செத்து', 'இறந்து', 'உயிரை விட',
  'வாழ விரும்பல', 'வாழ்க்கையை முடி',
];

export interface CrisisResources {
  message: string;
  helplines: { name: string; number: string; note?: string }[];
}

/**
 * Official, India-based helplines. Government-appropriate and free.
 * Tele-MANAS is the Government of India's national mental-health line;
 * Sneha and the TN State helpline are Tamil-Nadu-specific.
 */
export const CRISIS_RESOURCES: CrisisResources = {
  message:
    'You matter, and you are not alone. Exam pressure is real, but your life is far more important than any exam. ' +
    'Please talk to someone right now — a trusted adult, a teacher, or one of the free, confidential helplines below. ' +
    'நீங்கள் தனியாக இல்லை. உங்கள் வாழ்க்கை எந்தத் தேர்வையும் விட மிக முக்கியமானது. தயவு செய்து கீழே உள்ள ' +
    'இலவச உதவி எண்ணில் இப்போதே பேசுங்கள்.',
  helplines: [
    { name: 'Tele-MANAS (Govt. of India, 24×7, Tamil available)', number: '14416 / 1-800-891-4416' },
    { name: 'Tamil Nadu Health Helpline', number: '104' },
    { name: 'Sneha Suicide Prevention (Chennai, 24×7)', number: '044-24640050' },
    { name: 'Emergency', number: '112', note: 'Immediate danger' },
  ],
};

/**
 * Returns true if the text shows signs of a mental-health crisis and should be
 * handled by the crisis path instead of the LLM.
 */
export function isCrisisMessage(text: string | undefined | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return CRISIS_PATTERNS.some((p) => t.includes(p));
}
