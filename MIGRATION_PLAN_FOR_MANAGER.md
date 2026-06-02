# NEET AI — Migration Plan: Current Setup → Open-Source LLM
**A Simple, Non-Technical Overview for Management**
**Date: May 30, 2026** *(updated June 2, 2026 with final decisions)*

---

> ## 📌 FINAL DECISIONS (updated after full technical review — supersedes any older model/hosting details below)
>
> **AI models (2 free open-source):** **DeepSeek** for all text (tutor, tests, quizzes, planner, flashcards, strategy, PYQ, motivation) + **Qwen Vision** for images (photo doubt). They replace paid Claude + GPT-4o. *(Both are Chinese-made open models, but we self-host them on our own servers — no data goes to China; data stays in India.)*
>
> **Testing:** on **Together AI** (cloud) — it has the **exact** models. **Prepaid; a ~₹2,000–2,500 recharge** covers the whole testing phase. *(Groq was considered but only has similar/smaller models.)*
>
> **Production:** run the **same models** on **our own physical GPU servers** in a government / India data center → **data stays in India, no per-question bill.** Together AI can bridge an early launch, but at 1 lakh students that's ~₹10–25 lakh/month and data leaves India — so physical servers win for sustained scale.
>
> **Physical server (India):** start with **one L40S-based server ≈ ₹60–80 lakh** (cheapest viable, runs both models). Cheapest GPU = **L40S 48GB (~₹12–15 lakh)**; costliest = **H100 80GB (~₹28–40 lakh)**. **10 lakh students ≈ ₹5–9 crore** (cost-effective) up to **₹18–28 crore** (top plan). Indian vendors (e.g. E2E Networks) keep data in India + DPDP-compliant.
>
> **Tamil Nadu extras:** Tamil language, Samacheer Kalvi→NEET bridge, rural/offline access, mental-health support, government dashboard.
>
> *Full technical detail: `OPENSOURCE_LLM_BUILD_SPEC.md`. Step-by-step who-does-what: `PROJECT_ACTION_PLAN.md`.*

---

## 1. The Good News First

After reviewing the entire codebase, here is the most important finding:

**The app is built cleanly. Switching from Claude to an open-source LLM is a controlled change — NOT a rebuild.**

The "AI connection" is wired through **one single central point** in the code. Because of this, we change the connection in one place and adjust how each feature talks to it — we do not touch the app's core, the database, the design, or the student experience.

Think of it like changing the engine of a car while keeping the entire body, seats, and dashboard exactly the same.

---

## 2. What Stays EXACTLY The Same (No Change)

These are completely untouched by the migration:

- ✅ The entire student experience — every screen, button, and page looks and works the same
- ✅ Login, registration, Google sign-in, email system
- ✅ The database and all stored data (students, tests, history, progress)
- ✅ All features remain: Tutor, Study Planner, Mock Tests, Flashcards, NCERT, Strategy, Motivation, Analytics, Photo Doubt
- ✅ The hosting structure (Docker setup)
- ✅ The frontend (React app)

**Students will not notice any difference in how the app works — only the "brain" behind it changes.**

---

## 3. What Actually Changes

Only the **backend "AI brain" connection** changes. In simple terms:

| Today | After Migration |
|-------|-----------------|
| App talks to Claude (Anthropic) | App talks to open-source LLM (Llama 3.3 70B) |
| App talks to GPT-4o for photos | Keeps GPT-4o for now (or switches later) |
| We pay per question to foreign companies | We use a free/low-cost open-source model |

---

## 4. The Features That Use AI (What We'll Adjust)

There are **10 features** powered by AI today. Here is each one and how hard it is to switch:

| Feature | What It Does | Switch Difficulty |
|---------|--------------|-------------------|
| AI Tutor (chat) | Live doubt-solving chat | Easy |
| Voice Tutor | Voice-based answers | Easy |
| Study Planner | Builds study schedules | Easy |
| Mock Test Generator | Creates practice tests | Medium (needs accuracy) |
| Flashcard Generator | Makes revision cards | Easy |
| NCERT Quiz | NCERT-based questions | Medium (needs accuracy) |
| Strategy Coach | Exam strategy advice | Easy |
| Daily Motivation | Motivational messages | Easy |
| Weak-Area Analytics | Finds weak topics | Easy |
| PYQ Solver | Solves past questions | Easy |
| Photo Doubt Solver | Reads question photos | Special — keep GPT-4o for now |

**8 of these are easy switches. 2 need extra care for accuracy. 1 (photos) we keep as-is for now.**

---

## 5. How The Work Will Be Done (3 Simple Phases)

### Phase 1 — Build & Connect (about 1 week)
- Create the new government repo (copy of current app, original untouched)
- Connect it to the open-source LLM (free Groq account for testing)
- Switch all 10 AI features to the new brain

### Phase 2 — Tune & Test Quality (about 1–2 weeks)
- Adjust the AI instructions so the open-source model answers as well as Claude did
- Test with real NEET questions across Physics, Chemistry, Biology
- Make sure tests, quizzes, and answers come out correct and clean

### Phase 3 — Quality Sign-Off (about 1 week)
- Run a final quality check on 200+ NEET questions
- Confirm everything works before showing the government
- Ready for pilot launch

**Total: roughly 3–4 weeks of work to a tested, ready version.**

---

## 6. What We Need To Provide

| Item | Purpose | Cost |
|------|---------|------|
| Open-source LLM access (Groq) | The new AI brain | Free to start |
| Keep GPT-4o for photos only | Photo doubt feature | Small, same as now |
| Developer time | Doing the switch + testing | Internal team |

**During build and testing, the additional cost is effectively ₹0** (we use the free tier).

---

## 7. Honest Points To Keep In Mind

1. **Quality tuning is the real work.** The switch itself is quick; making the open-source model answer as well as Claude takes testing and adjustment. This is normal and expected.

2. **Two features need accuracy care** — Mock Tests and NCERT Quizzes — because wrong answers in exam prep hurt trust. We test these the most.

3. **The Photo Doubt feature** has no strong free replacement yet, so we keep GPT-4o for it initially (its cost is small).

4. **For lakhs of students later**, the open-source model will need to run on a powerful GPU server — ideally the government's own infrastructure, which keeps our cost near zero. (Covered in the separate hosting/cost document.)

---

## 8. Bottom Line For Management

- The app is well-built; switching to open-source is a **clean, low-risk change**, not a rebuild.
- **Students see no difference** — same app, same features, same screens.
- **Build + test = about 3–4 weeks**, at near-zero extra cost during development.
- The big cost saving (removing Claude/OpenAI bills) is **real and achievable**, especially at government scale.
- The original platform stays **completely safe and untouched** — this is a separate copy.

**Recommendation: Proceed with building the open-source version for the government. The codebase is ready for it, the risk is low, and the cost savings at scale are significant.**

---

*Companion documents: GOVERNMENT_VERSION_OPENSOURCE_LLM_PLAN.md (hosting & cost details).*
