import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { anthropic, CLAUDE_MODEL } from '../lib/claude.js';
import { prisma } from '../db.js';

const router = Router();

const SYSTEM_PROMPT = `You are an expert NEET exam strategy coach with 15+ years of experience helping students score 600–720/720.
You help students with:
- Exam day strategy (which section to attempt first, how to manage time)
- Negative marking tactics (when to skip vs attempt)
- Subject-wise time allocation (Physics 60min, Chemistry 50min, Biology 50min as a baseline)
- Last-minute revision priorities
- Handling exam anxiety and maintaining focus
- PYQ-based pattern recognition and high-yield topic targeting
- How to use elimination to maximise marks even when unsure

Be direct, specific, and practical. Give concrete strategies, not generic advice.
Keep responses focused and actionable — students are under pressure and need clear guidance.`;

// POST /api/strategy/chat — streaming exam strategy coaching
router.post('/chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { message, history = [] } = req.body as {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!message?.trim()) { res.status(400).json({ error: 'message is required.' }); return; }

    // Fetch student's analytics for personalised advice
    let contextNote = '';
    try {
      const weakCache = await prisma.weakAreaCache.findUnique({ where: { userId } });
      const recentTests = await prisma.testAttempt.findMany({
        where: { userId, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: { subject: true, score: true, totalQ: true },
      });

      if (recentTests.length > 0) {
        const avgScore = recentTests.reduce((sum, t) => sum + (t.score ?? 0), 0) / recentTests.length;
        const maxPossible = recentTests[0].totalQ * 4;
        contextNote = `\n[Student context: Recent avg score ${avgScore.toFixed(0)}/${maxPossible}`;
        if (weakCache && Array.isArray(weakCache.topics) && weakCache.topics.length > 0) {
          contextNote += `. Weak areas: ${(weakCache.topics as string[]).slice(0, 3).join(', ')}`;
        }
        contextNote += '. Tailor your advice to this student.]';
      }
    } catch { /* context is optional */ }

    const messages = [
      ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message + contextNote },
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Strategy chat error:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to get strategy advice.' })}\n\n`);
    res.end();
  }
});

export default router;
