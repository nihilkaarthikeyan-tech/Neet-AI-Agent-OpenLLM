/**
 * Snap-a-textbook-page — photograph a Samacheer Kalvi page → instant NEET explanation.
 *
 * Repurposes the existing Qwen Vision model (already integrated in Photo Doubt).
 * No new external API needed. This is THE rural-access killer feature:
 * a student photographs their state-board textbook → gets the NEET bridge instantly.
 */
import { Router, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { chatVisionJSON } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageInstruction, languageSchema } from '../lib/lang.js';

const router = Router();

const SnapResultSchema = z.object({
  extractedText: z.string(),
  subject: z.string(),
  topic: z.string(),
  samacheerContent: z.string(),
  neetRelevance: z.string(),
  extraNcertConcepts: z.array(z.string()),
  neetQuestions: z.array(z.object({ q: z.string(), a: z.string() })),
  memoryTips: z.array(z.string()),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only JPEG, PNG, WebP allowed.'));
  },
});

// POST /api/snap/analyse
router.post('/analyse', authenticate, upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No image uploaded.' }); return; }

    const language = languageSchema.parse((req.body as { language?: string }).language ?? 'en');

    const prompt = `You are an expert in both Tamil Nadu State Board (Samacheer Kalvi) and NCERT curriculum.

A student has photographed a page from their Samacheer Kalvi textbook. Your job:
1. Extract and read the text/diagrams on this page
2. Identify the subject and topic
3. Summarise what Samacheer teaches here
4. Explain what NEET/NCERT tests from this exact topic
5. List extra NCERT concepts not in this Samacheer page that NEET loves to ask
6. Generate 3 NEET-style questions with answers from this content
7. Give 2 memory tips for exam day

Return a single JSON object:
{
  "extractedText": "The text you read from the image",
  "subject": "Biology/Chemistry/Physics",
  "topic": "Topic name",
  "samacheerContent": "What this Samacheer page teaches (2-3 sentences)",
  "neetRelevance": "What NEET tests from this topic and how it's framed in NCERT",
  "extraNcertConcepts": ["Concept 1 NEET tests but Samacheer doesn't cover", "Concept 2"],
  "neetQuestions": [{"q": "Question?", "a": "Answer with explanation"}],
  "memoryTips": ["Tip 1", "Tip 2"]
}

If the image is not a textbook page, set extractedText to "Not a textbook page" and explain.${languageInstruction(language)}`;

    let result: z.infer<typeof SnapResultSchema>;
    try {
      const mediaType = req.file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp';
      const base64 = req.file.buffer.toString('base64');
      result = await chatVisionJSON({
        imageDataUrl: `data:${mediaType};base64,${base64}`,
        prompt,
        system: NEET_GEN_SYSTEM,
        schema: SnapResultSchema,
        maxTokens: 2000,
        feature: 'snap-ocr',
      });
    } catch {
      result = {
        extractedText: 'Could not read the image clearly',
        subject: 'Unknown',
        topic: 'Unknown',
        samacheerContent: 'Try a clearer, well-lit photo of the textbook page.',
        neetRelevance: '',
        extraNcertConcepts: [],
        neetQuestions: [],
        memoryTips: [],
      };
    }

    res.json({ result });
  } catch (err) {
    if (err instanceof multer.MulterError) { res.status(400).json({ error: err.message }); return; }
    res.status(500).json({ error: 'Failed to process image.' });
  }
});

export default router;
