import { Router, type Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatJSON, chatStream, MODELS } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageSchema, languageInstruction, type Language } from '../lib/lang.js';

const router = Router();

// ── Common input fragments ────────────────────────────────────────────────────

const subjectEnum = z.enum(['Biology', 'Chemistry', 'Physics', 'General']);

// ── Helpers ───────────────────────────────────────────────────────────────────

// LLMs sometimes wrap their JSON one level deeper, e.g. {"mindmap": {...}}.
// Try to unwrap to the first nested object when the expected top-level keys
// are missing, before handing off to Zod for strict validation.
function unwrapIfNested(val: unknown, topLevelKeys: string[]): unknown {
  if (!val || typeof val !== 'object') return val;
  const obj = val as Record<string, unknown>;
  const hasExpected = topLevelKeys.some((k) => k in obj);
  if (hasExpected) return val;
  const nested = Object.values(obj)[0];
  if (nested && typeof nested === 'object') return nested;
  return val;
}

// ── Output schemas (validated with chatJSON) ──────────────────────────────────

const mindMapChildSchema = z.object({
  id: z.string().optional().default(''),      // LLM may omit IDs; frontend uses index
  label: z.string(),
  description: z.string().optional().default(''),
});

const mindMapBranchSchema = z.object({
  id: z.string().optional().default(''),
  label: z.string(),
  description: z.string().optional().default(''),
  children: z.array(mindMapChildSchema).optional().default([]),
});

const mindMapSchemaInner = z.object({
  root: z.string(),
  branches: z.array(mindMapBranchSchema),
  neetQuestions: z.array(z.string()).optional().default([]),
});

const mindMapSchema = z.preprocess(
  (val) => unwrapIfNested(val, ['root', 'branches']),
  mindMapSchemaInner,
);

const mnemonicBreakdownItemSchema = z.object({
  letter: z.string(),
  word: z.string(),
  meaning: z.string(),
});

// LLMs sometimes return breakdown as an object {A: "Apple", ...} instead of an array.
// Preprocess to normalise either shape into the expected array.
const breakdownArraySchema = z.preprocess(
  (val) => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') {
      return Object.entries(val as Record<string, unknown>).map(([k, v]) => ({
        letter: k,
        word: typeof v === 'string' ? v : String(v),
        meaning: '',
      }));
    }
    return [];
  },
  z.array(mnemonicBreakdownItemSchema),
);

const mnemonicSchema = z.object({
  mnemonic: z.string(),
  explanation: z.string().optional().default(''),
  breakdown: breakdownArraySchema,
});

// Rows can come as objects {feature,a,b} OR as arrays [feature, aVal, bVal].
// Normalise to the object shape before validating.
const normalizeComparisonRow = (row: unknown): unknown => {
  if (Array.isArray(row) && row.length >= 2) {
    return { feature: String(row[0] ?? ''), a: String(row[1] ?? ''), b: String(row[2] ?? '') };
  }
  // If it has different key names (e.g. Mitosis/Meiosis as keys), coerce
  if (row && typeof row === 'object') {
    const obj = row as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length >= 2 && !('a' in obj) && !('feature' in obj)) {
      const vals = Object.values(obj).map(String);
      return { feature: vals[0] ?? '', a: vals[1] ?? '', b: vals[2] ?? '' };
    }
  }
  return row;
};

const comparisonRowSchema = z.object({
  feature: z.string(),
  a: z.string(),
  b: z.string(),
});

const comparisonSchema = z.preprocess(
  (val) => unwrapIfNested(val, ['headers', 'rows', 'title']),
  z.object({
    title: z.string().optional().default(''),
    headers: z.tuple([z.string(), z.string(), z.string()]).optional()
      .default(['Feature', 'A', 'B'] as [string, string, string]),
    rows: z.preprocess(
      (v) => {
        const arr = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
        return (arr as unknown[]).map(normalizeComparisonRow);
      },
      z.array(comparisonRowSchema),
    ),
    summary: z.string().optional().default(''),
  }),
);

const analogySchema = z.preprocess(
  (val) => unwrapIfNested(val, ['analogy', 'explanation']),
  z.object({
    analogy: z.string(),
    explanation: z.string().optional().default(''),
    realLifeContext: z.string().optional().default(''),
    neetTip: z.string().optional().default(''),
  }),
);

const whyWrongSchema = z.preprocess(
  (val) => unwrapIfNested(val, ['wrongOptionAnalysis', 'commonMistake', 'correctReasoning']),
  z.object({
    wrongOptionAnalysis: z.string(),
    commonMistake: z.string().optional().default(''),
    correctReasoning: z.string().optional().default(''),
    tip: z.string().optional().default(''),
  }),
);

const connectorSchema = z.preprocess(
  (val) => unwrapIfNested(val, ['connection', 'similarities', 'bridge']),
  z.object({
    connection: z.string(),
    similarities: z.array(z.string()).optional().default([]),
    differences: z.array(z.string()).optional().default([]),
    bridge: z.string().optional().default(''),
    studyTip: z.string().optional().default(''),
  }),
);

// ── SSE helpers ───────────────────────────────────────────────────────────────

function startSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

async function streamToSSE(
  res: Response,
  opts: Parameters<typeof chatStream>[0],
): Promise<void> {
  try {
    for await (const chunk of chatStream(opts)) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Generation failed' })}\n\n`);
      res.end();
    }
  }
}

// ── 1. AI Mind Map ────────────────────────────────────────────────────────────

router.post('/mindmap', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      topic: z.string().min(2).max(120),
      subject: subjectEnum,
      language: languageSchema,
    }).parse(req.body);

    const langNote = languageInstruction(body.language as Language);

    const result = await chatJSON({
      user: `Create a detailed NEET mind map for "${body.topic}" (${body.subject}). Include 4-6 main branches, each with 2-3 sub-concepts. Also list 3 likely NEET exam questions on this topic.${langNote}`,
      schema: mindMapSchema,
      system: NEET_GEN_SYSTEM + '\n\nReturn ONLY this exact JSON structure — no wrappers, no extra keys: {"root":"Topic Name","branches":[{"id":"b1","label":"Branch Name","description":"short desc","children":[{"id":"b1-1","label":"Sub concept","description":"short desc"}]}],"neetQuestions":["Q1?","Q2?","Q3?"]}. Use 4-6 branches with 2-3 children each. Labels under 6 words. Descriptions under 15 words.',
      model: MODELS.text,
      maxTokens: 2500,
      feature: 'mindmap',
    });

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    console.error('mindmap error', err);
    res.status(500).json({ error: 'Failed to generate mind map.' });
  }
});

// ── 2. Mnemonic Generator ─────────────────────────────────────────────────────

router.post('/mnemonic', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      items: z.string().min(2).max(600),
      language: languageSchema,
    }).parse(req.body);

    const langNote = languageInstruction(body.language as Language);

    const result = await chatJSON({
      user: `Create a memorable mnemonic/acronym or memory trick for this list: ${body.items}. ${langNote}`,
      schema: mnemonicSchema,
      system: NEET_GEN_SYSTEM + '\n\nYou are a NEET memory expert specializing in Tamil Nadu students. Create clever, culturally relevant mnemonics they will never forget. Return ONLY this exact JSON structure: {"mnemonic":"ACRONYM","explanation":"why this sticks","breakdown":[{"letter":"O","word":"Olfactory","meaning":"smell nerve"},{"letter":"O","word":"Optic","meaning":"vision nerve"}]}. The breakdown MUST be a JSON array of objects, NOT an object/map. Every field is required.',
      model: MODELS.tamil,
      maxTokens: 1500,
      feature: 'mnemonic',
    });

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    console.error('mnemonic error', err);
    res.status(500).json({ error: 'Failed to generate mnemonic.' });
  }
});

// ── 3. Explain Like I'm a Child (ELI5) — streaming ───────────────────────────

router.post('/eli5', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      concept: z.string().min(2).max(200),
      subject: subjectEnum,
      language: languageSchema,
    }).parse(req.body);

    const langNote = languageInstruction(body.language as Language);

    startSSE(res);
    await streamToSSE(res, {
      messages: [{ role: 'user', content: `Explain "${body.concept}" (${body.subject}) to a curious 10-year-old Tamil Nadu child using one super-relatable real-life analogy. End with "The NEET Science:" and give one clear scientific sentence.` }],
      system: NEET_GEN_SYSTEM + `\n\nYou are a warm, patient teacher explaining NEET concepts to a child in Tamil Nadu. Use everyday Tamil Nadu things: cooking rice, coconut trees, temple bells, auto-rickshaws, rainwater, school lunch boxes, or village life. Keep it magical and simple — the child has never studied science. One analogy, one connection, one "wow" moment. ${langNote}`,
      model: MODELS.tamil,
      maxTokens: 600,
      temperature: 0.8,
      feature: 'eli5',
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    if (!res.writableEnded) res.status(500).json({ error: 'Failed to explain concept.' });
  }
});

// ── 4. AI Comparison Table ────────────────────────────────────────────────────

router.post('/compare', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      topicA: z.string().min(1).max(100),
      topicB: z.string().min(1).max(100),
      subject: subjectEnum,
      language: languageSchema,
    }).parse(req.body);

    const langNote = languageInstruction(body.language as Language);

    const result = await chatJSON({
      user: `Create a comprehensive NEET comparison table for "${body.topicA}" vs "${body.topicB}" in ${body.subject}. Include 8-12 key comparison points that NEET frequently tests. ${langNote}`,
      schema: comparisonSchema,
      system: NEET_GEN_SYSTEM + `\n\nReturn ONLY this exact JSON structure with 8-12 rows: {"title":"${body.topicA} vs ${body.topicB}","headers":["Feature","${body.topicA}","${body.topicB}"],"rows":[{"feature":"Number of divisions","a":"1","b":"2"},{"feature":"Cell type","a":"somatic cells","b":"germ cells"}],"summary":"Key distinction in 2 sentences"}. Each row MUST be an object with exactly keys feature, a, b. No arrays for rows. No wrappers.`,
      model: MODELS.text,
      maxTokens: 3000,
      feature: 'compare',
    });

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    console.error('compare error', err);
    res.status(500).json({ error: 'Failed to generate comparison table.' });
  }
});

// ── 5. AI Story Mode — streaming ──────────────────────────────────────────────

router.post('/story', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      concept: z.string().min(2).max(200),
      subject: subjectEnum,
      language: languageSchema,
    }).parse(req.body);

    const langNote = languageInstruction(body.language as Language);

    startSSE(res);
    await streamToSSE(res, {
      messages: [{ role: 'user', content: `Write a short story (300-350 words) that teaches "${body.concept}" in ${body.subject}. Set it in Tamil Nadu. End with a "📌 NEET Connection:" paragraph that maps each story element to the actual science.` }],
      system: NEET_GEN_SYSTEM + `\n\nYou are a creative NEET educator from Tamil Nadu. Convert complex science into short, vivid stories set in Tamil Nadu — villages, temples, paddy fields, markets, auto-rickshaw rides, school mornings. Give all characters Tamil names. The story must naturally embed the scientific concept so it sticks in memory. Never make the science feel like a lesson — it should emerge from the story naturally. ${langNote}`,
      model: MODELS.tamil,
      maxTokens: 700,
      temperature: 0.85,
      feature: 'story',
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    if (!res.writableEnded) res.status(500).json({ error: 'Failed to generate story.' });
  }
});

// ── 6. Quick Revise Mode — streaming ─────────────────────────────────────────

router.post('/quick-revise', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      topic: z.string().min(2).max(200),
      subject: subjectEnum,
      language: languageSchema,
    }).parse(req.body);

    const langNote = languageInstruction(body.language as Language);

    startSSE(res);
    await streamToSSE(res, {
      messages: [{ role: 'user', content: `Give me the 5-minute NEET quick revision of "${body.topic}" in ${body.subject}.` }],
      system: NEET_GEN_SYSTEM + `\n\nBe ruthlessly concise. Format your response exactly like this:

🎯 ONE LINE: (definition in under 12 words)

⚡ MUST-KNOW POINTS:
• (max 8 bullet points, each under 12 words)

🔢 KEY NUMBERS: (only if there are important values/dates — skip if none)

❌ COMMON MISTAKE: (the one thing students always get wrong)

❓ PREDICT: (one likely NEET MCQ question — just the question stem, no options)

Every word must earn its place. ${langNote}`,
      model: MODELS.text,
      maxTokens: 600,
      temperature: 0.3,
      feature: 'quick-revise',
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    if (!res.writableEnded) res.status(500).json({ error: 'Failed to generate revision.' });
  }
});

// ── 7. AI Analogy Engine ──────────────────────────────────────────────────────

router.post('/analogy', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      concept: z.string().min(2).max(200),
      subject: subjectEnum,
      language: languageSchema,
    }).parse(req.body);

    const langNote = languageInstruction(body.language as Language);

    const result = await chatJSON({
      user: `Explain "${body.concept}" in ${body.subject} using a relatable Tamil Nadu daily-life analogy. ${langNote}`,
      schema: analogySchema,
      system: NEET_GEN_SYSTEM + '\n\nCreate analogies from Tamil Nadu daily life. Return ONLY this exact JSON: {"analogy":"vivid 1-2 sentence comparison","explanation":"how it maps to science (2-3 sentences)","realLifeContext":"where a TN student sees this","neetTip":"how NEET tests this"}. No wrappers, no extra keys.',
      model: MODELS.tamil,
      maxTokens: 1200,
      feature: 'analogy',
    });

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    console.error('analogy error', err);
    res.status(500).json({ error: 'Failed to generate analogy.' });
  }
});

// ── 8. Formula Derivation Explainer — streaming ───────────────────────────────

router.post('/formula', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      formula: z.string().min(1).max(200),
      subject: subjectEnum,
      language: languageSchema,
    }).parse(req.body);

    const langNote = languageInstruction(body.language as Language);

    startSSE(res);
    await streamToSSE(res, {
      messages: [{ role: 'user', content: `Derive and explain: ${body.formula} (${body.subject})` }],
      system: NEET_GEN_SYSTEM + `\n\nExplain formulas from first principles. Format:

📌 WHAT IT MEANS: (plain English, 1 sentence)

🔬 STARTING FROM: (the fundamental law or observation it comes from)

📐 DERIVATION (step by step):
Step 1: ...
Step 2: ...
(continue as needed — be thorough)

💡 WHY NEET ASKS THIS: (how they test it, what traps they set)

🧠 REMEMBER IT AS: (a memorable phrase or trick)

Show every step. Never skip algebra. ${langNote}`,
      model: MODELS.reasoning,
      maxTokens: 1200,
      temperature: 0.3,
      feature: 'formula',
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    if (!res.writableEnded) res.status(500).json({ error: 'Failed to explain formula.' });
  }
});

// ── 9. "Why Is This Wrong?" Explainer ────────────────────────────────────────

router.post('/why-wrong', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      question: z.string().min(5).max(600),
      wrongOption: z.string().min(1).max(300),
      correctOption: z.string().min(1).max(300),
      subject: subjectEnum,
      language: languageSchema,
    }).parse(req.body);

    const langNote = languageInstruction(body.language as Language);

    const result = await chatJSON({
      user: `NEET question: "${body.question}"\nStudent picked: "${body.wrongOption}"\nCorrect answer: "${body.correctOption}"\nExplain exactly why "${body.wrongOption}" is WRONG. ${langNote}`,
      schema: whyWrongSchema,
      system: NEET_GEN_SYSTEM + '\n\nReturn ONLY this exact JSON: {"wrongOptionAnalysis":"precise scientific error in the wrong option","commonMistake":"misconception that drives students to pick it","correctReasoning":"why correct answer is right (1-2 sentences)","tip":"one rule to never make this mistake again"}. No wrappers, no extra keys.',
      model: MODELS.reasoning,
      maxTokens: 1200,
      feature: 'why-wrong',
    });

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    console.error('why-wrong error', err);
    res.status(500).json({ error: 'Failed to analyze wrong option.' });
  }
});

// ── 10. Concept Connector ─────────────────────────────────────────────────────

router.post('/connector', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      topicA: z.string().min(1).max(100),
      topicB: z.string().min(1).max(100),
      language: languageSchema,
    }).parse(req.body);

    const langNote = languageInstruction(body.language as Language);

    const result = await chatJSON({
      user: `Show the deep connection between "${body.topicA}" and "${body.topicB}" across NEET subjects. ${langNote}`,
      schema: connectorSchema,
      system: NEET_GEN_SYSTEM + '\n\nReturn ONLY this exact JSON: {"connection":"core insight linking the two (1-2 sentences)","similarities":["shared principle 1","shared principle 2","shared principle 3"],"differences":["key difference 1","key difference 2"],"bridge":"single most important connecting idea","studyTip":"how to use this on exam day"}. No wrappers, no extra keys.',
      model: MODELS.reasoning,
      maxTokens: 1500,
      feature: 'connector',
    });

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    console.error('connector error', err);
    res.status(500).json({ error: 'Failed to connect concepts.' });
  }
});

// ── Save / load (mind maps & mnemonics) ──────────────────────────────────────

router.post('/save', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      toolType: z.enum(['mindmap', 'mnemonic']),
      title: z.string().min(1).max(200),
      content: z.record(z.string(), z.unknown()),
    }).parse(req.body);
    const userId = req.userId!;

    const saved = await prisma.learningToolSave.create({
      data: { userId, toolType: body.toolType, title: body.title, content: body.content as Prisma.InputJsonObject },
    });
    res.json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    res.status(500).json({ error: 'Failed to save.' });
  }
});

router.get('/saved', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const type = req.query.type as string | undefined;

    const items = await prisma.learningToolSave.findMany({
      where: { userId, ...(type ? { toolType: type } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json({ items });
  } catch {
    res.status(500).json({ error: 'Failed to load saved items.' });
  }
});

router.delete('/saved/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await prisma.learningToolSave.deleteMany({ where: { id: String(req.params.id), userId } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete.' });
  }
});

export default router;
