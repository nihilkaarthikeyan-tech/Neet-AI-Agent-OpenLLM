import { Router, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatVisionJSON } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageInstruction, languageSchema } from '../lib/lang.js';

const router = Router();

// subject is interpolated into the prompt → constrain it to a fixed set.
const subjectSchema = z.enum(['Physics', 'Chemistry', 'Biology', 'General']).default('General');

const PhotoSolutionSchema = z.object({
  questionText: z.string(),
  answer: z.string(),
  steps: z.array(z.string()),
  concept: z.string().optional().default(''),
  memoryTip: z.string().optional().default(''),
  subject: z.string().optional(),
});

// In-memory storage — we convert to base64 and send to OpenAI, no disk needed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

const DAILY_LIMIT = 10;

// POST /api/photo-doubt/solve
// Multipart: image file + optional subject field
router.post(
  '/solve',
  authenticate,
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      if (!req.file) {
        res.status(400).json({ error: 'No image uploaded.' });
        return;
      }

      const subjectParsed = subjectSchema.safeParse((req.body as { subject?: string }).subject);
      const subject = subjectParsed.success ? subjectParsed.data : 'General';
      const language = languageSchema.parse((req.body as { language?: string }).language);

      // Rate limit: count doubt messages from today for this user
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayCount = await prisma.doubtMessage.count({
        where: {
          userId,
          role: 'user',
          subject: 'photo',
          createdAt: { gte: todayStart },
        },
      });

      if (todayCount >= DAILY_LIMIT) {
        res.status(429).json({
          error: `Daily photo limit reached (${DAILY_LIMIT}/day). Try again tomorrow.`,
        });
        return;
      }

      // Convert image to base64
      const base64Image = req.file.buffer.toString('base64');
      const mediaType = req.file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp';

      const prompt = `You are an expert NEET (National Eligibility cum Entrance Test, India) tutor.
A student has uploaded a photo of a question from subject: ${subject}.

Analyze the image carefully and provide:
1. The question text as you read it from the image
2. The correct answer
3. A clear step-by-step explanation
4. The key concept being tested
5. A memory tip for exam day

Return ONLY valid JSON. No markdown. Use this structure:
{
  "questionText": "The question as read from the image",
  "answer": "The correct answer",
  "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "concept": "Key concept being tested",
  "memoryTip": "Helpful tip for the exam",
  "subject": "${subject}"
}

If the image is unclear or not a question, set questionText to "Image unclear" and explain in the steps array.
If the image is NOT a NEET Physics, Chemistry, or Biology question (e.g. a photo of a person, place, event, non-NEET subject like History/Geography/Civics, or any unrelated document), set questionText to "Not a NEET question" and steps to ["Please upload a photo of a NEET Physics, Chemistry, or Biology question only."] — do not attempt to answer it.${languageInstruction(language)}`;

      let solution: unknown;
      try {
        solution = await chatVisionJSON({
          imageDataUrl: `data:${mediaType};base64,${base64Image}`,
          prompt,
          system: NEET_GEN_SYSTEM,
          schema: PhotoSolutionSchema,
          maxTokens: 1500,
          feature: 'photo-doubt',
        });
      } catch {
        // Graceful fallback — never throw a raw 500 at the student.
        solution = {
          questionText: 'Could not read the image clearly',
          answer: 'See explanation',
          steps: ['Could not process this image. Try a clearer, well-lit photo and retake it.'],
          concept: '',
          memoryTip: '',
          subject,
        };
      }

      // Log interaction in doubt_history (subject="photo" to track separately)
      await prisma.doubtMessage.createMany({
        data: [
          { userId, subject: 'photo', role: 'user', content: `[Photo upload — ${subject}]` },
          { userId, subject: 'photo', role: 'assistant', content: JSON.stringify(solution) },
        ],
      });

      const remainingToday = DAILY_LIMIT - todayCount - 1;
      res.json({ solution, remainingToday });
    } catch (err: unknown) {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (err instanceof Error && err.message.includes('Only JPEG')) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error('Photo doubt error:', err);
      res.status(500).json({ error: 'Failed to process image.' });
    }
  }
);

// GET /api/photo-doubt/usage — how many solves used today
router.get('/usage', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const usedToday = await prisma.doubtMessage.count({
      where: { userId, role: 'user', subject: 'photo', createdAt: { gte: todayStart } },
    });

    res.json({ usedToday, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - usedToday) });
  } catch (err) {
    console.error('Usage error:', err);
    res.status(500).json({ error: 'Failed to fetch usage.' });
  }
});

export default router;
