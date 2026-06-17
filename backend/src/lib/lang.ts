/**
 * Language layer — Tamil-first, because that is Tamil Nadu's #1 NEET grievance.
 *
 * NEET is offered in Tamil, so Tamil-medium students need to practise and get
 * doubts answered in Tamil. We support three modes and inject the matching
 * instruction into every AI system prompt. This is a prompt-level
 * implementation that works with any capable open model; swapping in an
 * India-built Tamil model (e.g. Sarvam) later is just an LLM_BASE_URL change.
 */
import { z } from 'zod';

export const LANGUAGES = ['en', 'ta', 'tanglish'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Zod enum for validating a `language` field in request bodies. */
export const languageSchema = z.enum(LANGUAGES).default('en');

/**
 * The instruction appended to a system prompt so the model answers in the
 * student's chosen language. Technical NEET terms (e.g. "mitochondria") are
 * kept in English even in Tamil mode, because the exam uses them — this avoids
 * confusing students at the moment they sit the real paper.
 */
export function languageInstruction(lang: Language): string {
  switch (lang) {
    case 'ta':
      return (
        '\n\nLANGUAGE — PURE TAMIL (mandatory):' +
        '\n- Respond ENTIRELY in Tamil (தமிழ்). This student is Tamil-medium — Tamil is their first language.' +
        '\n- Do NOT write English sentences or English explanations. Tamil only.' +
        '\n- ONLY keep NEET exam technical terms in English because they appear on the exam paper exactly as English words (e.g., mitochondria, ATP, Newton, photosynthesis, meiosis). Everything else must be Tamil.' +
        '\n- Use simple, clear spoken Tamil that a rural Class 11 student from Tamil Nadu understands — not heavy literary Tamil.' +
        '\n- Example: "ஒளிச்சேர்க்கை என்பது தாவரங்கள் சூரிய ஒளியை பயன்படுத்தி glucose தயாரிக்கும் செயல்முறை. இது chloroplast-ல் நடைபெறும்."' +
        '\n- NEVER switch to English mid-response. If you need to use an English term, use it as a noun inside a Tamil sentence.'
      );
    case 'tanglish':
      return (
        '\n\nLANGUAGE — TANGLISH (mandatory, no exceptions):' +
        '\n- Respond ONLY in Tanglish: Tamil words written in English script, mixed naturally with English.' +
        '\n- Sound exactly like a warm, friendly Chennai tutor talking to a student — like a knowledgeable elder brother or sister helping out.' +
        '\n- Example style: "Mitochondria-la ATP synthesis nadakkuthu da. Ithule proton gradient key role play pannuthu — ithuku oxidative phosphorylation nu peru. Simple-a sollunga: namma food eat pannuvom, atha energy-a convert panrom — exactly athu inge nadakkuthu. Puriyuthu-a?"' +
        '\n- Use natural expressions like: "da/di", "sollunga", "puriyuthu-a?", "simple-a", "paaru", "inga paaru", "athu enna na", "actually", "basically", "got it?", "correct-a?".' +
        '\n- Keep NEET technical terms in English (mitochondria, ATP, Newton, photosynthesis, etc.) — students need to recognise them on the exam paper.' +
        '\n- Be warm and conversational throughout — no stiff textbook language.' +
        '\n- NEVER write Tamil script (தமிழ்). English letters only for Tanglish.' +
        '\n- NEVER switch to full English paragraphs. Every sentence must feel like a Tamil-speaking person talking.'
      );
    case 'en':
    default:
      return '\n\nLANGUAGE: Reply in clear, simple English only.';
  }
}
