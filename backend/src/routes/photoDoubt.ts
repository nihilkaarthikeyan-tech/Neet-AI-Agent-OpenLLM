import { Router, type Response } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

      const subject = (req.body as { subject?: string }).subject ?? 'General';

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

If the image is unclear or not a question, set questionText to "Image unclear" and explain in the steps array.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${base64Image}`,
                  detail: 'high',
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      });

      const aiText = response.choices[0]?.message?.content ?? '';

      let solution: unknown;
      try {
        const raw = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        solution = JSON.parse(raw);
      } catch {
        solution = {
          questionText: 'Could not parse image',
          answer: 'See explanation',
          steps: [aiText],
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
