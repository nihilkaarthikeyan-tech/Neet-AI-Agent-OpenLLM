/**
 * NEET accuracy eval harness (Phase 4 of OPENSOURCE_LLM_BUILD_SPEC.md).
 *
 * Scores the configured open-source model against a fixed set of NEET MCQs with
 * a known answer key, so model quality is PROVABLE with a number ("the open
 * model scores X% on N graded NEET questions") rather than a vibe.
 *
 * Usage:
 *   npm run eval                         # uses eval/questions.sample.json
 *   npm run eval -- eval/my-200-qs.json  # your own question bank
 *
 * Requires the same env as the app: LLM_API_KEY, LLM_BASE_URL, LLM_MODEL_TEXT.
 *
 * Question file format — a JSON array of:
 *   {
 *     "id": "phy-001",
 *     "subject": "Physics",
 *     "topic": "Laws of Motion",        // optional
 *     "question": "....?",
 *     "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
 *     "correct": "B"
 *   }
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { chatJSON, MODELS } from '../src/lib/llm.js';

const QuestionSchema = z.object({
  id: z.string(),
  subject: z.string(),
  topic: z.string().optional(),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  correct: z.enum(['A', 'B', 'C', 'D']),
});
type Question = z.infer<typeof QuestionSchema>;

const AnswerSchema = z.object({
  answer: z.enum(['A', 'B', 'C', 'D']),
});

function buildPrompt(q: Question): string {
  return `You are taking the NEET (India) medical entrance exam. Answer this ${q.subject} multiple-choice question.

Question: ${q.question}

A) ${q.options.A}
B) ${q.options.B}
C) ${q.options.C}
D) ${q.options.D}

Think briefly, then respond with a JSON object of the form { "answer": "A" } where the value is the single correct option letter (A, B, C, or D).`;
}

async function gradeOne(q: Question): Promise<{ id: string; subject: string; correct: boolean; chosen: string; expected: string }> {
  try {
    const { answer } = await chatJSON({
      user: buildPrompt(q),
      schema: AnswerSchema,
      maxTokens: 512,
      temperature: 0,
      feature: 'eval',
    });
    return { id: q.id, subject: q.subject, correct: answer === q.correct, chosen: answer, expected: q.correct };
  } catch (err) {
    console.error(`  ! ${q.id}: model error — ${String(err)}`);
    return { id: q.id, subject: q.subject, correct: false, chosen: 'ERROR', expected: q.correct };
  }
}

async function main(): Promise<void> {
  const file = process.argv[2] ?? 'eval/questions.sample.json';
  console.log(`\nNEET eval harness`);
  console.log(`  Model:     ${MODELS.text}`);
  console.log(`  Endpoint:  ${process.env.LLM_BASE_URL ?? '(default OpenAI)'}`);
  console.log(`  Questions: ${file}\n`);

  if (!process.env.LLM_API_KEY) {
    console.error('LLM_API_KEY is not set. Add it to backend/.env first.');
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  const questions = z.array(QuestionSchema).parse(raw);
  console.log(`Grading ${questions.length} questions (sequential to respect rate limits)...\n`);

  const results: Awaited<ReturnType<typeof gradeOne>>[] = [];
  for (let i = 0; i < questions.length; i++) {
    const r = await gradeOne(questions[i]);
    results.push(r);
    process.stdout.write(r.correct ? '.' : 'x');
    if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}\n`);
  }
  console.log('\n');

  // Overall
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const pct = total > 0 ? ((correct / total) * 100).toFixed(1) : '0.0';

  // Per subject
  const bySubject: Record<string, { correct: number; total: number }> = {};
  for (const r of results) {
    bySubject[r.subject] ??= { correct: 0, total: 0 };
    bySubject[r.subject].total++;
    if (r.correct) bySubject[r.subject].correct++;
  }

  console.log('──────────────────────────────────────────');
  console.log(`  OVERALL: ${correct}/${total}  =  ${pct}%`);
  console.log('──────────────────────────────────────────');
  for (const [subject, d] of Object.entries(bySubject).sort()) {
    const sp = ((d.correct / d.total) * 100).toFixed(1);
    console.log(`  ${subject.padEnd(12)} ${d.correct}/${d.total}  (${sp}%)`);
  }

  const wrong = results.filter((r) => !r.correct);
  if (wrong.length > 0) {
    console.log('\n  Missed:');
    for (const r of wrong) {
      console.log(`    ${r.id} [${r.subject}] chose ${r.chosen}, expected ${r.expected}`);
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error('Eval failed:', err);
  process.exit(1);
});
