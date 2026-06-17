/**
 * NCERT Exception & Bracket Hunter.
 *
 * NEET's favorite trap: questions from NCERT exceptions, bracketed examples,
 * table footnotes, and figure captions. No competitor drills these specifically.
 * This mode generates MCQs ONLY from these high-yield hidden lines.
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { chatJSONArray } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageInstruction, languageSchema } from '../lib/lang.js';

const router = Router();

const ExceptionQuestionSchema = z.object({
  question: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  correct: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string(),
  exceptionType: z.enum(['exception', 'bracket_example', 'table_footnote', 'figure_caption', 'special_case']),
  ncertSource: z.string(),
  whyItTricks: z.string(),
});

const generateSchema = z.object({
  subject: z.enum(['Biology', 'Chemistry', 'Physics']),
  chapter: z.string().optional(),
  count: z.number().int().min(5).max(20).default(10),
  language: languageSchema,
});

// POST /api/ncertexceptions/generate
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { subject, chapter, count, language } = parsed.data;

  const chapterHint = chapter ? ` Focus on chapter: "${chapter}".` : '';

  const prompt = `You are an expert NEET question setter specialising in TRAP questions — the ones that catch students who only skimmed NCERT.

Generate exactly ${count} NEET-style MCQs for ${subject}${chapterHint} that test ONLY:
1. EXCEPTIONS (e.g. "All X do Y, EXCEPT...", "Which is NOT a feature of...")
2. BRACKETED EXAMPLES in NCERT text (content inside parentheses)
3. TABLE FOOTNOTES (small notes below tables in NCERT)
4. FIGURE CAPTIONS (labels and descriptions of NCERT diagrams)
5. SPECIAL CASES mentioned as asides in NCERT text

These are NEET's favourite sources for hard questions. Students who only read the main text get these wrong.

For each question REQUIRE:
- A clear NCERT source (chapter, type of content)
- "whyItTricks": why students who don't read carefully will get it wrong
- "exceptionType": which of the 5 types above this is

JSON structure per question:
{
  "question": "Which of the following is an EXCEPTION to...?",
  "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...",
  "correct": "B",
  "explanation": "In NCERT ${subject}, [specific line] states that all X except Y...",
  "exceptionType": "exception",
  "ncertSource": "NCERT ${subject} Class 11/12, Ch.X — exact source",
  "whyItTricks": "Students memorise the rule but miss the exception on line 3 of that paragraph"
}${languageInstruction(language)}`;

  try {
    const questions = await chatJSONArray({
      user: prompt,
      system: NEET_GEN_SYSTEM,
      itemSchema: ExceptionQuestionSchema,
      maxTokens: 8000,
      temperature: 0.3,
      feature: 'ncert-exceptions',
    });
    res.json({ questions, subject, chapter, count: questions.length });
  } catch {
    res.status(503).json({ error: 'Could not generate exception quiz. Try again.' });
  }
});

export default router;
