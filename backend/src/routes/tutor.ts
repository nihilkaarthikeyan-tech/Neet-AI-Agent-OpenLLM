import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { chatStream, chatText, MODELS, type ChatMessage } from '../lib/llm.js';
import { languageSchema } from '../lib/lang.js';
import { buildTutorSystemPrompt, buildVoiceSystemPrompt } from '../lib/prompts.js';
import { isCrisisMessage, CRISIS_RESOURCES } from '../lib/safety.js';

const router = Router();

// Subject is interpolated into the system prompt, so it must be a fixed set —
// never free-form user text (prompt-injection surface).
const chatSchema = z.object({
  subject: z.enum(['Physics', 'Chemistry', 'Biology']),
  message: z.string().min(1).max(4000),
  language: languageSchema,
});

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
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { subject, message, language } = parsed.data;

    const userId = req.userId!;

    // 0. Safety guard — if the student expresses crisis/self-harm, NEVER hand it
    //    to the LLM. Respond with care + official helplines instead.
    if (isCrisisMessage(message)) {
      await prisma.doubtMessage.create({ data: { userId, subject, role: 'user', content: message } });
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      const helplineText = CRISIS_RESOURCES.helplines.map((h) => `• ${h.name}: ${h.number}`).join('\n');
      const careMsg = `${CRISIS_RESOURCES.message}\n\n${helplineText}`;
      res.write(`data: ${JSON.stringify({ text: careMsg })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      await prisma.doubtMessage.create({ data: { userId, subject, role: 'assistant', content: careMsg } });
      return;
    }

    // 1. Save user's question to DoubtHistory
    await prisma.doubtMessage.create({
      data: {
        userId,
        subject,
        role: 'user',
        content: message,
      },
    });

    // 2. Retrieve last 6 messages for context (most recent first, then reverse)
    const history = await prisma.doubtMessage.findMany({
      where: { userId, subject },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    history.reverse(); // oldest first so the model sees the conversation in order

    // 3. Format history for the model
    let messages: ChatMessage[] = history.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Keep a clean conversation: merge consecutive same-role turns, start with user.
    const mergedMessages: ChatMessage[] = [];
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

    // 5. System Prompt defining the AI's persona (centralised in lib/prompts).
    const systemPrompt = buildTutorSystemPrompt(subject, language);


    // 6. Stream from the open-source LLM. The helper yields plain text deltas;
    //    we re-wrap them in the exact same SSE envelope the frontend expects.
    let fullAssistantResponse = '';

    for await (const text of chatStream({
      messages,
      system: systemPrompt,
      model: MODELS.reasoning,
      maxTokens: 4096,
      temperature: 0.4,
      feature: 'tutor-chat',
    })) {
      fullAssistantResponse += text;
      // Write the chunk back to the client immediately
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
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
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
    const { subject, message, language } = parsed.data;

    const userId = req.userId!;

    // Safety guard — crisis messages get care + helplines, never the LLM.
    if (isCrisisMessage(message)) {
      const helplineText = CRISIS_RESOURCES.helplines.map((h) => `${h.name}: ${h.number}`).join('. ');
      const careMsg = `${CRISIS_RESOURCES.message} ${helplineText}`;
      await prisma.doubtMessage.createMany({ data: [
        { userId, subject, role: 'user', content: message },
        { userId, subject, role: 'assistant', content: careMsg },
      ] });
      res.json({ response: careMsg });
      return;
    }

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

    let messages: ChatMessage[] = history.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Merge consecutive same-role messages
    const mergedMessages: ChatMessage[] = [];
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

    const systemPrompt = buildVoiceSystemPrompt(subject, language);

    const aiText = await chatText({
      messages,
      system: systemPrompt,
      model: MODELS.reasoning,
      maxTokens: 400,
      temperature: 0.5,
      feature: 'tutor-voice',
    });

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
