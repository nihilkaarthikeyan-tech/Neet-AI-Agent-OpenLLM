# NEET AI — Open-Source LLM Migration: Engineering Build Spec

**Prepared by:** Technical review of the actual codebase
**Date:** June 2, 2026
**Status:** Reviewed & approved for build (pending the open decisions in §11)
**Companion docs:** `MIGRATION_PLAN_FOR_MANAGER.md` (non-technical), `GOVERNMENT_VERSION_OPENSOURCE_LLM_PLAN.md` (hosting & cost). This document is the **how-we-actually-build-it** spec.

---

## 0. Verdict — Do I agree with the plan?

**Yes — I agree with the core thesis and recommendation.** I read the entire codebase end-to-end (every AI route, the streaming consumer, the DB schema, deployment configs) and the management plan's central claims are **accurate**, not optimistic hand-waving:

- All Claude calls really do flow through **one 8-line file** (`backend/src/lib/claude.ts`). Verified.
- The OpenAI SDK is **already installed** (`openai ^6.33.0`). Verified.
- **No database changes** are needed — the schema has zero provider-specific fields. Verified.
- **No frontend changes** are needed — *provided* we keep the streaming envelope identical (see §5). Verified against `TutorPage.tsx`.
- Photo Doubt is **already** in OpenAI/vision format. Verified.

So the migration is genuinely **low-risk and structural, not a rebuild.** The management documents can be trusted by leadership.

**But** — for an actual *government* deployment serving lakhs of free users, I recommend **six enhancements** the current plan does not cover. They make the result more maintainable, provably accurate, cheaper to reason about, and safe to hand to a government security review. These are in §3–§9. None of them increase risk; most of them *reduce* it. Where I'd do something differently from the plan, it's flagged **▶ CHANGE FROM PLAN**.

---

## 1. Verified facts (from code, not assumptions)

| Claim in management plan | Reality in code | Status |
|---|---|---|
| One central AI file | `lib/claude.ts`, exactly 8 lines, exports `anthropic` + `CLAUDE_MODEL` | ✅ Exact |
| ~10 route files use AI | **9 routes** import Anthropic; **10 call-sites** (tutor has 2) | ✅ (see note) |
| OpenAI SDK already present | `openai ^6.33.0` in `backend/package.json` | ✅ |
| No DB changes | `schema.prisma` has no AI-provider fields | ✅ |
| No frontend changes | Frontend only parses the SSE `{text}`/`[DONE]` envelope | ✅ *(conditional, see §5)* |
| Photo Doubt already OpenAI | `photoDoubt.ts` uses `openai.chat.completions` + `gpt-4o` | ✅ Exact |
| Three code patterns differ | system placement, response parse, streaming loop | ✅ Accurate |

**Note — the plan slightly understates two things:**
1. `tutor.ts` has **two** Claude call-sites — streaming `/chat` (line ~104) **and** non-streaming `/voice-chat` (line ~196). So it's 10 call-sites across 9 files.
2. The two streaming routes use **different** Anthropic methods: `tutor.ts` uses `messages.create({stream:true})`, `strategy.ts` uses `messages.stream()`. Both collapse to one OpenAI streaming pattern — the abstraction in §3 erases this difference.

---

## 2. AI feature inventory (verified call-by-call)

| Route | Endpoint | AI shape | Output | JSON failure today |
|---|---|---|---|---|
| `tutor.ts` | `/chat` | **streaming** | text (SSE) | n/a |
| `tutor.ts` | `/voice-chat` | single-shot | short text | n/a |
| `strategy.ts` | `/chat` | **streaming** | text (SSE) | n/a |
| `tests.ts` | `/generate` | single-shot | **JSON array** | ❌ hard 500 |
| `ncert.ts` | `/quiz` | single-shot | **JSON array** | ❌ hard 500 |
| `analytics.ts` | `/weak-areas` | single-shot | **JSON array** | ❌ hard 500 |
| `planner.ts` | `/generate` | single-shot | **JSON object** | ❌ hard 500 |
| `flashcards.ts` | `/generate` | single-shot | **JSON array** | ❌ hard 500 |
| `pyq.ts` | `/ask` | single-shot | JSON object | ✅ falls back to text |
| `motivation.ts` | `/daily` | single-shot | plain text | n/a |
| `photoDoubt.ts` | `/solve` | **vision** | JSON object | ✅ falls back to text |

**Insight:** 5 of the JSON routes (`tests`, `ncert`, `analytics`, `planner`, `flashcards`) **hard-fail with HTTP 500** if the model emits a stray word around the JSON. Claude rarely does this; open-source models do it more often. These 5 are exactly where migration pain will concentrate — and §4 fixes all of them in one place.

---

## 3. ▶ CHANGE FROM PLAN — Build a thin provider abstraction, don't scatter edits

The plan says: rename `claude.ts → llm.ts`, then edit each of the 10 call-sites individually (fix system placement, fix parse, fix streaming). That works, but it **spreads the same logic across 10 files** and leaves the JSON-cleanup code duplicated 7 times (it already is today — copy-pasted `.replace(/```json/...)` in every JSON route).

**Better: one central module that owns all provider quirks.** Routes call small helpers and never touch SDK details.

```ts
// backend/src/lib/llm.ts  (replaces claude.ts)
import OpenAI from 'openai';

// Provider is a one-line config swap: Groq | Together | self-hosted vLLM
export const llm = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL, // e.g. https://api.groq.com/openai/v1
});

// Per-task model routing (the plan wants different models per job — §6)
export const MODELS = {
  chat:       process.env.LLM_MODEL_CHAT   ?? 'llama-3.3-70b-versatile',
  stem:       process.env.LLM_MODEL_STEM   ?? 'deepseek-v3',
  small:      process.env.LLM_MODEL_SMALL  ?? 'llama-3.1-8b-instant',
} as const;

// 1) JSON helper — owns: system placement, JSON mode, fence-strip, zod-validate, ONE retry
export async function chatJSON<T>(opts: {
  model: string; system?: string; user: string; schema: ZodSchema<T>; maxTokens?: number;
}): Promise<T> { /* ...see §4... */ }

// 2) Plain-text helper (motivation, voice)
export async function chatText(opts: {...}): Promise<string> { ... }

// 3) Streaming helper — yields plain text deltas; routes re-wrap in the existing SSE envelope
export async function* chatStream(opts: {...}): AsyncGenerator<string> { ... }
```

**Why this is better (and actually *less* work):**
- The 5 fragile JSON routes shrink to ~3 lines each: `const cards = await chatJSON({ model: MODELS.chat, user: prompt, schema: FlashcardSchema })`.
- System-prompt placement, response parsing, fence-stripping, JSON mode, validation, and retry are written **once**, not 10 times.
- Switching Groq → Together → self-hosted vLLM is a **`.env` change**, no code edits — critical for the Stage-1→Stage-3 hosting path.
- The two different streaming methods collapse into one `chatStream`.
- A future fallback provider (or keeping Claude as an emergency backstop during pilot) becomes a 5-line change inside the helper, invisible to routes.

This is the single most important engineering decision in the migration.

---

## 4. ▶ ADD — Make JSON output bulletproof (zod + retry), not just "JSON mode"

The plan says "enable JSON mode + keep fence stripping." Correct, but insufficient for the 5 hard-failing routes. Full strategy, all inside `chatJSON`:

1. **JSON mode** — pass `response_format: { type: 'json_object' }` (Groq & Together support it).
   - ⚠️ Constraint: Groq requires the word **"json"** in the prompt for JSON mode, and **does not support JSON mode + streaming together** (irrelevant — our JSON routes don't stream).
   - ⚠️ JSON mode forces a top-level **object**. Routes that expect a top-level **array** (`tests`, `ncert`, `analytics`, `flashcards`) must ask for `{ "items": [...] }` and unwrap — a tiny prompt + parse tweak, centralized in the helper.
2. **Fence-strip** — keep the existing `.replace()` cleanup as a safety net.
3. **Validate with zod** — `zod ^4.4.3` is **already a dependency**. Parse into a schema; reject malformed shapes.
4. **One automatic retry** — on parse/validate failure, retry once with an appended "Return ONLY valid JSON matching the schema." This alone removes the large majority of open-source JSON failures.
5. **Graceful degradation** — give `tests`/`ncert`/`analytics`/`planner`/`flashcards` the same soft-fallback that `pyq`/`photoDoubt` already have, so a single bad generation never throws a raw 500 at a student.

Net effect: the open-source JSON reliability risk (the plan's "Medium" risk) drops to low, in one central place.

---

## 5. Streaming — keep the SSE envelope byte-for-byte identical

`TutorPage.tsx` (and the strategy page) consume the stream by reading lines and matching exactly:
- `data: {"text":"..."}` → append
- `data: [DONE]` → end
- `event: error` → show error

**Rule:** the migrated `tutor.ts` / `strategy.ts` must keep emitting *that exact envelope*. Internally we read OpenAI deltas (`chunk.choices[0].delta.content`) instead of Anthropic deltas, but we re-wrap them as `data: ${JSON.stringify({ text })}\n\n`. **Do this and the frontend needs zero changes** — which is what makes "no frontend changes" true. The `chatStream` helper yields plain text; the route does the SSE wrapping.

---

## 6. Which models we use (final decision) — for management

### 6.1 Simple summary
We use **two free open models**:

| What it does | Model | Free? | Self-hostable on govt GPU? |
|---|---|---|---|
| **All text features** (tutor, mock tests, quizzes, planner, flashcards, strategy, PYQ, motivation) | **DeepSeek-V4-Flash** — `deepseek-ai/DeepSeek-V4-Flash` (MIT) | ✅ Yes | ✅ Yes |
| **Photo Doubt** (reading question images) | **Qwen3-VL-32B-Instruct** — `Qwen/Qwen3-VL-32B-Instruct` (Apache-2.0) | ✅ Yes | ✅ Yes |

> **Exact models pinned (verified June 2026):** **Text = `deepseek-ai/DeepSeek-V4-Flash`** (MIT licence, 284B/13B-active, best open STEM model that's realistically self-hostable; upgrade path = `DeepSeek-V4-Pro` for a full cluster). **Vision = `Qwen/Qwen3-VL-32B-Instruct`** (Apache-2.0, strong OCR incl. Tamil, fits ~1× H100 80GB; lighter option = `Qwen/Qwen3-VL-8B-Instruct`).

One model for text, one for images. That's the whole AI stack.

> **Version note:** model makers update often (DeepSeek V3.1→V3.2→V4; Qwen2.5-VL→Qwen3-VL). We confirm the exact current version the day we wire it up — the central module (§3) makes swapping a one-line change, so we're never locked to an old version. **For testing the exact models we use Together AI** (it carries them); **Groq is dropped** because it only has *similar/smaller* models, not the exact ones.

### 6.2 Previous models vs now — and why we changed

| | Original plan (written May 2026) | Now (June 2026, after fresh research) | Why changed |
|---|---|---|---|
| **Text — main** | Llama 3.3 70B | **DeepSeek V3.1** | DeepSeek is stronger at **science/maths reasoning** — exactly what NEET needs. Accuracy on Physics/Chemistry/Biology matters most. |
| **Text — STEM** | DeepSeek-V3 | merged into DeepSeek V3.1 | DeepSeek V3.1 is the newer, better version. No need for a separate model. |
| **Text — small tasks** | Llama 3.1 8B | dropped | Since the government hosts one big GPU, running **one strong model for everything** is simpler than juggling three. |
| **Images** | Keep paid GPT-4o | **Qwen Vision (free)** | Qwen Vision is now good enough to read exam images → lets us **drop the paid GPT-4o** and be 100% free. |

**Plain reason for the change:** the AI world moved fast in the last month. The models in the old plan are no longer the best free option. DeepSeek V3.1 + Qwen Vision are newer, stronger, still free, and better suited to a science exam product. Switching is a one-line config change in our code (that's the point of the central module in §3).

### 6.3 How we test (now)
- **Where the model runs:** NOT on our Hostinger VPS (it has no GPU). Instead, our app **calls Together AI** (cloud), which runs the **exact** models for us.
- **Cost:** prepaid **~₹2,000–2,500** for the whole testing phase. **New hardware:** none. Our existing VPS works as-is.
- **Goal:** prove every feature works on the open model — chat, tests, quizzes, photo doubt — before involving the government.

### 6.4 How we run in production (national launch)
- **Where the model runs:** on the **government's GPU infrastructure** (NIC / CDAC), which downloads and runs DeepSeek + Qwen Vision directly.
- **Cost to us:** ₹0 (government provides the GPU compute). If the government does NOT provide a GPU, we rent one — a fixed monthly cost, not per-student.
- **Data:** stays 100% inside India (a government requirement).

### 6.5 One India option to mention to the manager
**Sarvam** is an Indian-made free open model already on the government's own AI platform (AIKosh). It's weaker than DeepSeek at science, so it's **not** our main engine today — but "built on India's own model" is a strong selling point for a government project, and it's ideal if we later add Hindi/regional-language support. Worth raising; not required now.

### 6.6 Hosting & hardware — final decision

**Testing / pilot → Together AI (cloud).** The app calls the **exact** models (DeepSeek + Qwen Vision) on **Together AI** over the internet. No GPU on our side; **prepaid — a ~₹2,000–2,500 recharge covers the whole testing phase** ($5 free credit may cover most of it). *(Groq was considered but only carries similar/smaller models, not the exact ones, so it was dropped.)*

**Production / national launch (10 lakh students) → physical GPU servers**, owned and placed in a **government / India data center** — because at large scale owning is cheaper than paying cloud rent forever, data stays 100% in India, and control is retained.

**Sizing for 10 lakh students** (what matters is peak *concurrent* users ≈ 1–2% ≈ 10k–20k requests at once, **not** the 10 lakh total):

| Plan | Text model | Servers | Total GPUs | One-time cost |
|---|---|---|---|---|
| **A — Top quality** | DeepSeek 671B | 6–8 nodes (8 GPU each) | ~50–64 | **₹18–28 cr** |
| **B — Recommended** | 70B model (~90% as good) | 6–10 nodes (4 GPU each) | ~24–40 | **₹4–8 cr** |
| **Vision (Qwen)** — both plans | photo doubt only (low volume) | +1–2 nodes | +2–6 | +₹0.6–1.5 cr |

**Per-server spec:** 8× NVIDIA H100/H200 80GB (or 2–4× for a 70B model); 2× server CPU (64+ cores); 512 GB–1 TB RAM; 4–8 TB NVMe SSD (model files: DeepSeek ~1 TB, Qwen ~150 GB); 100 GbE / InfiniBand networking; data-center power/cooling. *(+18–28% India GST/customs; used hardware ~40% cheaper.)*

**India GPU prices (buy, per GPU):** cheapest = **L40S 48GB ~₹12–15 lakh**; mid = A100 80GB ~₹8–15 lakh; costliest = **H100 80GB ~₹28–40 lakh**. **Recommended starting server: ~4× L40S ≈ ₹60–80 lakh** (runs both models for the pilot/early launch). Indian vendors (E2E Networks, Cyfuture, AceCloud) are India-hosted + DPDP-compliant — good for a government project.

**Cloud-for-production option:** Together AI *can* also run production (no servers to buy), but at 1 lakh students it's a recurring **₹10–25 lakh/month** and **data leaves India** — fine as an early-launch bridge, but physical servers are cheaper long-term and keep data in India.

**Buying approach:** buy **ONE server for the pilot**, measure real load, then buy the rest of the cluster based on real numbers — never buy the full cluster on guesses.

---

## 7. ▶ ADD — Accuracy strategy for a government exam product

The plan flags NCERT/test hallucination as "Medium-High" and parks RAG as "later." For a **free national NEET product, a wrong answer key is the #1 trust-killer.** Three concrete, low-cost moves:

1. **Pre-generate & cache question banks instead of always generating live.** Today `tests`/`ncert` generate fresh on every request — expensive *and* unverifiable. Generating banks ahead of time lets us (a) run a verification pass, (b) serve many students from one generation (big cost cut), (c) keep a curated, growing question pool. Strong recommendation for scale.
2. **Self-verification pass** for answer-critical routes during pilot — a cheap second call (or self-consistency) that double-checks the marked correct option before it reaches a student.
3. **Bring RAG forward for `ncert.ts` specifically** — ground NCERT quizzes in actual NCERT text rather than model memory. This is the one feature where "from the textbook" is a literal requirement.

---

## 8. ▶ ADD — Measure cost with real data; don't ship guesses

The plan's "₹10–16 lakh/month at 1 lakh students" is a planning estimate with no usage model behind it. Cheap fix that massively strengthens the management/government case:

- Log **prompt + completion tokens per request** inside the abstraction layer (the OpenAI response returns `usage`).
- Optional tiny `UsageLog` table (or just structured logs → the existing pino logger → Sentry/aggregator).
- After a 2-week pilot you can state real **tokens-per-student-per-day**, turning Stage-2/3 budgets from guesses into evidence. For a government budget conversation, this is gold.

---

## 9. ▶ ADD — Security & repo hygiene (must-fix before a government hand-off)

Found in the code, **not** mentioned anywhere in the plan:

1. **Hardcoded DB password committed to git** — `docker-compose.prod.yml` contains `POSTGRES_PASSWORD: NeetAI@Secure2026` in plaintext. Move to env/secrets and rotate it. A government security review will flag this immediately.
2. **Unrelated product in the compose file** — `docker-compose.prod.yml` also builds `rademics_frontend` from `/opt/rademics-ai`. The government edition must **not** ship a second commercial product. Remove that service from this repo's compose.
3. **Multi-instance rate limiting** — `index.ts` uses in-memory rate limiting (with a code comment admitting it needs a Redis store for multi-instance). At lakhs-scale behind multiple backend instances, in-memory counters are per-instance and leak. Redis is already running — switch the limiter to a Redis store before national scale.
4. `.env` is correctly gitignored ✅ — good. Keep all new keys (`LLM_API_KEY`, `LLM_BASE_URL`) there.

---

## 9.5 Tamil Nadu Government Edition — value-add features

**Positioning (most important):** Don't pitch this as "NEET coaching." Pitch it as *"levelling the playing field — so a rural, Tamil-medium, government-school student gets the same quality help a rich city student pays lakhs for."* Tamil Nadu's entire concern with NEET is **fairness**, so every feature below supports that story.

**Top features that win Tamil Nadu (priority order):**
1. **Tamil language** — Tamil UI + Tamil-medium explanations + Tamil voice tutor. Directly answers TN's #1 NEET complaint. (Indian models like Sarvam help here.)
2. **Samacheer Kalvi → NEET bridge** — map TN State Board topics to their NCERT/NEET version. Solves TN's actual grievance; nothing else does this.
3. **Equity / rural access** — a lightweight "data-saver" version for cheap phones + slow internet, and **offline download** of lessons/question banks for poor-network villages.
4. **Mental-health & anti-pressure support** — calm check-ins, encouragement, link to a government student helpline. NEET stress is a sensitive, high-profile issue in TN.
5. **Government dashboard** — district/school-wise usage + progress, so officials can show impact.

**Design & trust:** official government look (not a flashy startup), 100% India-hosted / no foreign AI, accessibility + GIGW compliance, Tamil-first design.

**Nice extras (Phase 2):** teacher/mentor portal, TN counselling + 7.5% government-school reservation info, tie-in with TN's free NEET coaching scheme, SMS/IVR for students with no smartphone (future).

**Top 3 to prioritise:** Tamil language · Samacheer→NEET bridge · Equity access + government dashboard. Mental-health support is the emotional clincher on top.

---

## 10. Phased build plan (realistic effort)

| Phase | Work | Effort |
|---|---|---|
| **0. Hygiene** | Remove `rademics_frontend` from compose; move/rotate DB secret; add `LLM_*` env vars | ~0.5 day |
| **1. Abstraction** | Build `lib/llm.ts` (`chatJSON`/`chatText`/`chatStream` + model routing + zod + retry) | ~1–2 days |
| **2. Route swap** | Point all 10 call-sites at the helpers; keep SSE envelope; per-route zod schemas | ~1–2 days |
| **3. Quality tuning** | Prompt adjustments, JSON-mode wording, per-task model tuning | ~1–2 weeks |
| **4. Eval & QA** | **Build a small automated eval harness** (100–200 graded NEET MCQs scored vs an answer key) so quality is *provable*, not vibes; verify streaming + photo | ~1 week |
| **5. Pilot** | Deploy on Groq paid (or 1 rented GPU), turn on token logging, monitor | ~1 week |

**Honest framing:** the *code* swap is the small part (~3–4 days with the abstraction). The *evaluation* is the real work — which is exactly what the management plan says. The eval harness in Phase 4 is my key addition: it lets you tell the government "the open-source model scores X% on a fixed NEET benchmark vs Claude's Y%" with a number, not an opinion.

---

## 11. Decisions — settled vs still open

**✅ Settled:**
- **Models:** DeepSeek (all text features) + Qwen Vision (images). Two free open models. (§6)
- **Hosting:** Cloud / free API for testing & pilot → **physical GPU servers** for the national launch, in a government / India data center. (§6.6)

**❓ Still need your answer (see the separate action plan: `PROJECT_ACTION_PLAN.md`):**
1. **Git history** — start the new repo with a clean first commit, or keep the existing 2 commits? *(Recommend: clean start.)*
2. **Photo Doubt** — switch to free **Qwen Vision** now, or keep paid **GPT-4o** for launch?
3. **Question banks** — you'll upload them; confirm the format with me.
4. **Who funds production hardware** — government provides/buys the servers, or we do? *(Determines budget.)*
5. **Tamil Nadu features** — confirm which of §9.5 (Tamil, Samacheer bridge, dashboard, etc.) are in scope.

---

## 12. Bottom line

The plan is **sound and honest, and I endorse proceeding.** The migration is low-risk and the codebase is genuinely well-structured for it. My six additions — (1) a provider abstraction instead of scattered edits, (2) zod+retry JSON hardening, (3) real token-cost instrumentation, (4) pre-generated/verified question banks + earlier NCERT RAG, (5) secret/rademics/rate-limit hygiene, (6) an automated quality eval harness — turn a "works on a demo" migration into something you can defend in a government technical + security review. None of them block starting; most are done *inside* the abstraction layer we're building anyway.
