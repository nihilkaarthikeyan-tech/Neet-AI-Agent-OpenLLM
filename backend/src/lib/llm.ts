/**
 * Central LLM module — the ONE place that owns every provider quirk.
 *
 * Routes call the small helpers below (`chatJSON`, `chatJSONArray`, `chatText`,
 * `chatStream`) and never touch the SDK directly. Switching provider
 * (OpenRouter → self-hosted vLLM → any OpenAI-compatible endpoint) is a
 * `.env` change only — see LLM_BASE_URL / LLM_API_KEY.
 *
 * This module also centralises: JSON mode, markdown-fence stripping, zod
 * validation, a single automatic retry on bad JSON, and per-feature token
 * usage logging.
 */
// The 'openai' npm package is used purely as an OpenAI-compatible HTTP client.
// It is NOT calling OpenAI — it is calling OpenRouter (or any self-hosted vLLM).
// No Anthropic/Claude or OpenAI credentials are used anywhere in this app.
import OpenAI from 'openai';
import { z } from 'zod';
import { logger } from './logger.js';

// ── Provider client (OpenAI-compatible) ─────────────────────────────────
// OpenRouter for testing/production. One config swap via .env.
export const llm = new OpenAI({
  // Fall back to a placeholder so importing this module never crashes when the
  // key is unset (e.g. in tooling); real calls then fail with a clear auth error.
  apiKey: process.env.LLM_API_KEY ?? 'LLM_API_KEY_NOT_SET',
  baseURL: process.env.LLM_BASE_URL, // e.g. https://openrouter.ai/api/v1
});

// ── Per-task model routing ───────────────────────────────────────────────
// Each task type maps to the open model that's strongest at it. All are
// OpenAI-compatible on OpenRouter (or self-hosted vLLM) — pure .env swaps.
//   text      — general chat + structured JSON generation (DeepSeek-V3: best all-round)
//   reasoning — step-by-step solving (Tutor/PYQ/Strategy). Flip to DeepSeek-R1 in .env
//               for max numerical quality; <think> blocks are stripped automatically.
//   tamil     — reserved for Tamil-heavy routes (Qwen is strongest at Indian languages)
//   vision    — multimodal image solving (Photo Doubt)
export const MODELS = {
  text: process.env.LLM_MODEL_TEXT ?? 'deepseek-ai/DeepSeek-V3',
  reasoning: process.env.LLM_MODEL_REASONING ?? process.env.LLM_MODEL_TEXT ?? 'deepseek-ai/DeepSeek-V3',
  tamil: process.env.LLM_MODEL_TAMIL ?? process.env.LLM_MODEL_TEXT ?? 'deepseek-ai/DeepSeek-V3',
  vision: process.env.LLM_MODEL_VISION ?? 'Qwen/Qwen2.5-VL-72B-Instruct',
} as const;

// ── Shared message type ──────────────────────────────────────────────────
export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// ── Token usage logging (§8 — measure real cost, don't ship guesses) ──────
function logUsage(
  feature: string,
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null,
): void {
  if (!usage) return;
  logger.info(
    {
      llm_usage: true,
      feature,
      model,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    },
    'llm token usage',
  );
}

// ── Internal: build messages with optional system prompt ─────────────────
function buildMessages(system: string | undefined, rest: ChatMessage[]): ChatMessage[] {
  return system ? [{ role: 'system', content: system }, ...rest] : rest;
}

// ── Internal: strip markdown code fences (safety net even in JSON mode) ───
function stripFences(text: string): string {
  return text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
}

// ── Internal: strip reasoning <think>…</think> blocks ─────────────────────
// Reasoning models (e.g. DeepSeek-R1) emit their chain-of-thought wrapped in
// <think> tags. Students must never see this — only the final answer. For
// non-streaming calls we remove whole blocks (and any unclosed leading block).
function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '') // unclosed/opening block at the very start
    .trim();
}

/**
 * Stateful filter that drops <think>…</think> content from a token STREAM.
 * Tokens can split a tag across chunks, so we buffer until we can decide.
 * Returns the text that is safe to emit for the given incoming delta.
 */
function makeThinkStreamFilter() {
  let inThink = false;
  let pending = ''; // holds a possible partial tag at a chunk boundary
  return (delta: string): string => {
    let out = '';
    let buf = pending + delta;
    pending = '';
    while (buf.length > 0) {
      if (!inThink) {
        const open = buf.indexOf('<think>');
        if (open === -1) {
          // Keep back a tail that could be the start of "<think>" split across chunks
          const keep = Math.max(0, buf.length - 7);
          out += buf.slice(0, keep);
          pending = buf.slice(keep);
          // Only hold the tail if it actually is a prefix of the tag
          if (pending && !'<think>'.startsWith(pending)) { out += pending; pending = ''; }
          break;
        }
        out += buf.slice(0, open);
        buf = buf.slice(open + 7);
        inThink = true;
      } else {
        const close = buf.indexOf('</think>');
        if (close === -1) {
          const keep = Math.max(0, buf.length - 8);
          pending = buf.slice(keep); // hold possible partial "</think>"
          if (pending && !'</think>'.startsWith(pending)) pending = '';
          break;
        }
        buf = buf.slice(close + 8);
        inThink = false;
      }
    }
    return out;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 1) chatText — plain-text completion (motivation, voice chat)
// ─────────────────────────────────────────────────────────────────────────
export async function chatText(opts: {
  user?: string;
  messages?: ChatMessage[];
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  feature?: string;
}): Promise<string> {
  const model = opts.model ?? MODELS.text;
  const base = opts.messages ?? (opts.user ? [{ role: 'user' as const, content: opts.user }] : []);
  const messages = buildMessages(opts.system, base);

  const res = await llm.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    messages,
  });

  logUsage(opts.feature ?? 'text', model, res.usage);
  return stripThink(res.choices[0]?.message?.content?.trim() ?? '');
}

// ─────────────────────────────────────────────────────────────────────────
// 2) chatStream — streaming text deltas. Routes re-wrap these in the
//    existing SSE envelope (§5), so the frontend needs zero changes.
// ─────────────────────────────────────────────────────────────────────────
export async function* chatStream(opts: {
  messages: ChatMessage[];
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  feature?: string;
}): AsyncGenerator<string> {
  const model = opts.model ?? MODELS.text;
  const messages = buildMessages(opts.system, opts.messages);

  const stream = await llm.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.7,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  });

  // Drop any reasoning <think>…</think> content so students only see the answer.
  const filterThink = makeThinkStreamFilter();
  for await (const chunk of stream) {
    // The final usage chunk carries no choices.
    if (chunk.usage) logUsage(opts.feature ?? 'stream', model, chunk.usage);
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      const safe = filterThink(delta);
      if (safe) yield safe;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 3) JSON helpers — own JSON mode, fence-strip, zod validation, ONE retry.
//    (§4 — make JSON output bulletproof for the 5 fragile routes.)
// ─────────────────────────────────────────────────────────────────────────

// Internal: one raw JSON call returning parsed (but unvalidated) data.
async function rawJSONCall(opts: {
  system?: string;
  user: string;
  model: string;
  maxTokens: number;
  temperature: number;
  feature: string;
}): Promise<unknown> {
  // Groq/Together JSON mode requires the literal word "json" in the prompt.
  const messages = buildMessages(opts.system, [{ role: 'user', content: opts.user }]);

  const res = await llm.chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    messages,
    response_format: { type: 'json_object' },
  });

  logUsage(opts.feature, opts.model, res.usage);
  const text = res.choices[0]?.message?.content ?? '';
  return JSON.parse(stripFences(text));
}

/**
 * chatJSON — returns a single JSON OBJECT validated against `schema`.
 * Use for routes whose output is an object (planner, pyq, photoDoubt).
 * Retries once on parse/validation failure before giving up.
 */
export async function chatJSON<T>(opts: {
  user: string;
  schema: z.ZodType<T>;
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  feature?: string;
}): Promise<T> {
  const model = opts.model ?? MODELS.text;
  const maxTokens = opts.maxTokens ?? 2000;
  const temperature = opts.temperature ?? 0.3;
  const feature = opts.feature ?? 'json';

  const instruction =
    '\n\nReturn ONLY a single valid JSON object. Do not wrap it in markdown fences or add any text before or after.';

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const userPrompt =
        attempt === 0
          ? opts.user + instruction
          : opts.user + instruction + '\n\nYour previous reply was not valid JSON matching the required schema. Return ONLY the corrected JSON object now.';
      const parsed = await rawJSONCall({ system: opts.system, user: userPrompt, model, maxTokens, temperature, feature });
      return opts.schema.parse(parsed);
    } catch (err) {
      lastErr = err;
      logger.warn({ feature, attempt, err: String(err) }, 'chatJSON parse/validation failed');
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('chatJSON failed');
}

/**
 * chatJSONArray — returns a JSON ARRAY of items each validated against
 * `itemSchema`. JSON mode forces a top-level object, so we ask the model for
 * `{ "items": [...] }` and unwrap centrally (§4). Use for tests, ncert,
 * analytics, flashcards. Retries once on failure.
 */
export async function chatJSONArray<T>(opts: {
  user: string;
  itemSchema: z.ZodType<T>;
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  feature?: string;
}): Promise<T[]> {
  const model = opts.model ?? MODELS.text;
  const maxTokens = opts.maxTokens ?? 8000;
  const temperature = opts.temperature ?? 0.4;
  const feature = opts.feature ?? 'json-array';

  // Wrap the array in an object because JSON mode requires a top-level object.
  const wrapped = z.object({ items: z.array(opts.itemSchema) });
  const instruction =
    '\n\nReturn ONLY valid JSON as an object of the form { "items": [ ... ] } where each element matches the structure described above. No markdown fences, no text before or after.';

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const userPrompt =
        attempt === 0
          ? opts.user + instruction
          : opts.user + instruction + '\n\nYour previous reply was not valid JSON. Return ONLY the corrected { "items": [...] } object now.';
      const parsed = await rawJSONCall({ system: opts.system, user: userPrompt, model, maxTokens, temperature, feature });

      // Accept either { items: [...] } or a bare array, for resilience.
      const candidate = Array.isArray(parsed) ? { items: parsed } : parsed;
      return wrapped.parse(candidate).items;
    } catch (err) {
      lastErr = err;
      logger.warn({ feature, attempt, err: String(err) }, 'chatJSONArray parse/validation failed');
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('chatJSONArray failed');
}

// ─────────────────────────────────────────────────────────────────────────
// 4) chatVisionJSON — multimodal (image + prompt) → validated JSON object.
//    Used by Photo Doubt. Defaults to MODELS.vision (Qwen Vision via the same
//    OpenAI-compatible provider); switching to GPT-4o is a model/env swap.
// ─────────────────────────────────────────────────────────────────────────
export async function chatVisionJSON<T>(opts: {
  imageDataUrl: string;
  prompt: string;
  schema: z.ZodType<T>;
  system?: string;
  model?: string;
  maxTokens?: number;
  feature?: string;
}): Promise<T> {
  const model = opts.model ?? MODELS.vision;
  const maxTokens = opts.maxTokens ?? 1500;
  const feature = opts.feature ?? 'vision';
  const instruction =
    '\n\nReturn ONLY a single valid JSON object. No markdown fences, no text before or after.';

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const promptText =
        attempt === 0
          ? opts.prompt + instruction
          : opts.prompt + instruction + '\n\nYour previous reply was not valid JSON. Return ONLY the corrected JSON object now.';

      const res = await llm.chat.completions.create({
        model,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: opts.imageDataUrl, detail: 'high' } },
              { type: 'text', text: promptText },
            ],
          },
        ],
      });

      logUsage(feature, model, res.usage);
      const text = res.choices[0]?.message?.content ?? '';
      return opts.schema.parse(JSON.parse(stripFences(text)));
    } catch (err) {
      lastErr = err;
      logger.warn({ feature, attempt, err: String(err) }, 'chatVisionJSON parse/validation failed');
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('chatVisionJSON failed');
}
