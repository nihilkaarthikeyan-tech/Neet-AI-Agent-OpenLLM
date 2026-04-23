import { Router, type Response } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { anthropic, CLAUDE_MODEL } from '../lib/claude.js';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.mjs';

const router = Router();

// GET /api/tutor/history?subject=Physics
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject } = req.query as { subject?: string };
    const userId = req.userId!;

    const history = await prisma.doubtMessage.findMany({
      where: { userId, ...(subject ? { subject } : {}) },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });

    res.json({ history });
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

// POST /api/tutor/chat
// We expect a subject (Physics, Chemistry, Biology) and the user's message.
// This endpoint returns an SSE stream.
router.post('/chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, message } = req.body as { subject: string; message: string };

    if (!subject || !message) {
      res.status(400).json({ error: 'Subject and message are required.' });
      return;
    }

    const userId = req.userId!;

    // 1. Save user's question to DoubtHistory
    await prisma.doubtMessage.create({
      data: {
        userId,
        subject,
        role: 'user',
        content: message,
      },
    });

    // 2. Retrieve last 6 messages for context (most recent first, then reverse for Claude)
    const history = await prisma.doubtMessage.findMany({
      where: { userId, subject },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    history.reverse(); // oldest first so Claude sees the conversation in order

    // 3. Format history for Claude
    let messages: MessageParam[] = history.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Anthropic API constraints: Alternate roles, first message must be user.
    const mergedMessages: MessageParam[] = [];
    for (const msg of messages) {
      if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === msg.role) {
        mergedMessages[mergedMessages.length - 1].content += '\n\n' + msg.content;
      } else {
        mergedMessages.push(msg);
      }
    }
    if (mergedMessages.length > 0 && mergedMessages[0].role !== 'user') {
      mergedMessages.shift();
    }
    messages = mergedMessages;

    // 4. Setup server-sent events headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 5. System Prompt defining the AI's persona
    const systemPrompt = `You are an expert NEET exam coach specializing in ${subject} for Indian medical entrance aspirants.

CORE BEHAVIOR RULES:
- NEVER tell students to visit external websites or the NTA website. You ARE the resource.
- If a student asks for "previous year questions", "past papers", or "question papers": immediately provide 5–10 actual NEET-style MCQs on the topic or chapter they need, with 4 options (A/B/C/D). After giving questions, reveal answers with explanations only when asked.
- If no specific topic is mentioned for question papers, ask which chapter/topic they want questions from, then provide them.
- For concept doubts: use the Socratic method — guide, don't just answer.
- For numericals: show step-by-step working with formulas clearly stated.
- For MCQs the student shares: explain why the correct option is right AND why the wrong ones are wrong.
- Always be encouraging. NEET is hard — acknowledge that and keep morale high.
- Use Markdown formatting (bold, bullet points, numbered steps) for clarity.
- Keep responses focused and exam-relevant. Mention NEET weightage of topics when relevant.

NEVER say "I cannot provide question papers" — you CAN and you WILL generate high-quality NEET-standard MCQs on any ${subject} topic instantly.`;


    // 6. Stream from Anthropic
    const stream = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages,
      stream: true,
    });

    let fullAssistantResponse = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        fullAssistantResponse += text;
        // Write the chunk back to the client immediately
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    // 7. Stream finished, save assistant's response to DB
    await prisma.doubtMessage.create({
      data: {
        userId,
        subject,
        role: 'assistant',
        content: fullAssistantResponse,
      },
    });

    // End the SSE stream
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Tutor Chat Error:', err);
    // If headers are already sent, we can't send a 500 status easily, so we write an error event
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process chat message.' });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to complete AI generation' })}\n\n`);
      res.end();
    }
  }
});

// POST /api/tutor/voice-chat
// Non-streaming version for voice UI — returns full AI response as JSON.
router.post('/voice-chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, message } = req.body as { subject: string; message: string };

    if (!subject || !message) {
      res.status(400).json({ error: 'Subject and message are required.' });
      return;
    }

    const userId = req.userId!;

    // Save user message
    await prisma.doubtMessage.create({
      data: { userId, subject, role: 'user', content: message },
    });

    // Retrieve last 6 messages for context
    const history = await prisma.doubtMessage.findMany({
      where: { userId, subject },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    history.reverse();

    let messages: MessageParam[] = history.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Merge consecutive same-role messages
    const mergedMessages: MessageParam[] = [];
    for (const msg of messages) {
      if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === msg.role) {
        mergedMessages[mergedMessages.length - 1].content += '\n\n' + msg.content;
      } else {
        mergedMessages.push(msg);
      }
    }
    if (mergedMessages.length > 0 && mergedMessages[0].role !== 'user') {
      mergedMessages.shift();
    }
    messages = mergedMessages;

    const systemPrompt = `You are an expert NEET exam coach specializing in ${subject} for Indian medical entrance aspirants. The student is speaking to you via voice, so keep your response concise, clear, and conversational — 2-4 sentences maximum. No markdown, no bullet points. Speak naturally as you would in a phone call. Be encouraging and exam-focused. Always respond in English only, regardless of the language the student uses.`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      temperature: 0.7,
      system: systemPrompt,
      messages,
    });

    const aiText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Save assistant response
    await prisma.doubtMessage.create({
      data: { userId, subject, role: 'assistant', content: aiText },
    });

    res.json({ response: aiText });
  } catch (err) {
    console.error('Voice Chat Error:', err);
    res.status(500).json({ error: 'Failed to process voice message.' });
  }
});

export default router;
