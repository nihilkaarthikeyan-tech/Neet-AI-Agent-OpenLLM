# NEET AI — Government Version: Open-Source LLM Migration Plan
**Complete Technical & Cost Document**
**Date: May 30, 2026** *(updated June 2, 2026 with final decisions)*

---

> ## 📌 FINAL DECISIONS (updated after full technical review — supersedes any older model/hosting details below)
>
> **AI models (2 free open-source):** **DeepSeek** for all text + **Qwen Vision** for images. Replaces paid Claude + GPT-4o. *(Chinese-made open models, but self-hosted on our own servers — no data leaves to China; data stays in India.)*
>
> **Testing:** **Together AI** (cloud) — has the **exact** models. **Prepaid, ~₹2,000–2,500** for the whole testing phase. *(Groq dropped — only similar/smaller models.)*
>
> **Production:** same models on **our own physical GPU servers** in a government / India data center → **data in India, no per-question bill.** Together AI could bridge early launch (~₹10–25 lakh/month at 1 lakh students, data leaves India), but physical servers win for sustained scale.
>
> **Physical server (India):** start with **one L40S-based server ≈ ₹60–80 lakh**. Cheapest GPU = **L40S 48GB (~₹12–15 lakh)**; costliest = **H100 80GB (~₹28–40 lakh)**. **10 lakh students ≈ ₹5–9 cr** (cost-effective) to **₹18–28 cr** (top). Indian vendors (E2E Networks etc.) = India-hosted + DPDP-compliant.
>
> **Tamil Nadu extras:** Tamil language, Samacheer Kalvi→NEET bridge, rural/offline access, mental-health support, government dashboard.
>
> *Full technical detail: `OPENSOURCE_LLM_BUILD_SPEC.md`. Who-does-what: `PROJECT_ACTION_PLAN.md`.*

---

## PART 1 — What We Have RIGHT NOW (Verified From Code)

Current production runs on **one Hostinger VPS** using Docker. Everything lives on that single server:

| Component | What It Is | Where It Runs |
|-----------|-----------|---------------|
| Backend | Node.js + Express (port 5005) | Hostinger VPS (Docker) |
| Frontend | React + Nginx (port 8080) | Hostinger VPS (Docker) |
| Database | PostgreSQL 15 | Hostinger VPS (Docker) |
| Cache | Redis 7 | Hostinger VPS (Docker) |
| SSL | Let's Encrypt (Certbot) | Hostinger VPS |
| AI Brain (text) | Claude (Anthropic API) | Anthropic's servers — we pay them |
| AI Brain (images) | GPT-4o (OpenAI API) | OpenAI's servers — we pay them |

**Key point:** The VPS is a normal computer. The "intelligence" (Claude/OpenAI) is NOT on our VPS — it lives on Anthropic's and OpenAI's servers, and we pay them every time a student asks a question.

---

## PART 2 — The Core Decision

When we remove Claude/OpenAI and use an open-source LLM, the brain has to run SOMEWHERE. That "somewhere" is the entire question. Three choices:

| | Where the LLM runs | Need a GPU? | Who manages it |
|--|--------------------|-------------|----------------|
| Choice 1 | A cloud LLM company (Groq/Together) | No | Them |
| Choice 2 | Our own rented GPU server | Yes | Us |
| Choice 3 | Government's GPU data center (NIC/CDAC) | Yes | Government |

**Critical fact:** The current Hostinger VPS CANNOT run an open-source LLM. A 70B model needs a powerful GPU (costing lakhs). Normal VPS = no GPU = cannot run the model. So Choices 2 and 3 require a SEPARATE GPU machine in addition to the app server.

---

## PART 3 — What Changes In The Setup (Current vs Open-Source)

| Thing | Current Setup | Open-Source Setup |
|-------|--------------|-------------------|
| App server (backend/frontend/DB) | Hostinger VPS | Same — no change |
| Text AI | Claude API (pay Anthropic) | Open-source LLM (Llama 3.3 70B) |
| Image AI | GPT-4o API (pay OpenAI) | Keep GPT-4o, OR Qwen2.5-VL |
| Where the AI runs | Anthropic/OpenAI servers | Groq / rented GPU / govt GPU |
| Code change needed | — | Swap Anthropic SDK to Groq/OpenAI-style SDK in ~10 route files |
| Monthly AI bill | Pay per student question | Free (Groq) OR fixed GPU rent |

The app itself barely changes. Only the "AI brain" connection changes. Docker setup, database, frontend — all stay the same.

---

## PART 4 — The 3 Hosting Options, With Real Costs

### OPTION 1 — Groq / Together AI (Cloud LLM, No GPU To Buy)
Call them like we call Claude now. They run the model.
- We buy/rent: nothing extra. Same Hostinger VPS.
- Groq Free tier: good for testing only (~1,500 students max). NOT for lakhs.
- Groq/Together Paid: pay per usage, scales automatically to lakhs.
- Approx cost at lakhs of students: ₹10–16 lakh/month (grows with usage).
- Best for: launching fast, no GPU headache.
- Weak for: a "free forever" product (bill keeps growing); data leaves India.

### OPTION 2 — Our Own Rented GPU Server
Rent a GPU machine (separate from Hostinger VPS), run Llama with free software (vLLM/Ollama).
- We rent: 1 or more GPU servers.
- 1x A100 80GB GPU server: ~₹70,000–₹1,10,000/month (RunPod/Lambda/etc.).
- One A100 handles only ~20–40 students at the same moment. For lakhs at peak, need a cluster of several GPUs -> ₹3–8 lakh/month range.
- Cost is FIXED — doesn't grow per question, only when adding GPUs for more load.
- Best for: predictable cost, control, data stays where we choose.
- Weak for: we must manage servers, scaling, uptime ourselves.

### OPTION 3 — Government GPU Infrastructure (NIC / CDAC / MeghRaj) — RECOMMENDED FOR LAKHS
Deploy the open-source LLM on the government's national GPU data centers.
- We buy/rent: nothing. Government provides the GPU compute.
- Cost to our company: ₹0 cash (government bears this production cost).
- Scales to lakhs because it's national infrastructure.
- Data stays 100% inside India (government will likely require this anyway).
- Best for: free national product at lakhs scale — same model CoWIN, DIKSHA use.
- Needs: government to approve and allocate the GPU resource.

---

## PART 5 — Cost Comparison Summary

| | Current Setup | Option 1: Groq/Together | Option 2: Own GPU | Option 3: Govt GPU |
|--|--------------|------------------------|-------------------|---------------------|
| App server (VPS) | Hostinger (~₹2,000/mo) | Same | Same | Same / govt |
| Text AI cost | Claude — grows with use | ₹10–16 lakh/mo at scale | ₹3–8 lakh/mo (fixed) | ₹0 to us |
| Image AI cost | GPT-4o — grows with use | Keep GPT-4o (small) | Keep GPT-4o (small) | Qwen2.5-VL (₹0) |
| Scales to lakhs? | Yes (but very costly) | Yes | Yes (add GPUs) | Yes |
| Data stays in India? | No | No | Yes | Yes |
| Who pays at scale | Us | Us | Us | Government |

---

## PART 6 — Recommended Scalable Path

Because this is free, government, and lakhs of students, do it in 3 stages:

- **Stage 1 — Build & Test (Now):** Build the government repo. Connect to Groq Free tier. Prove every feature works. Cost: ₹0.
- **Stage 2 — Pilot Launch (a few thousand students):** Move to Groq/Together Paid. Cost: a few lakh/month, from project budget.
- **Stage 3 — National Rollout (lakhs of students):** Deploy the open-source LLM on government GPU infrastructure (NIC/CDAC). Cost to our company: ₹0 — government bears the production compute cost.

---

## PART 7 — One Honest Warning

Open-source LLM is free to license, but NOT free to run at lakhs scale. Someone must pay for the GPU power — either we do (rented GPUs) or the government does (their GPU centers).

**The one question to settle with the government:** Will they provide the GPU infrastructure, or expect us to host it? That single answer decides whether production cost is ₹0 (their infra) or ₹3–8 lakh/month (our rented GPUs).

---

## Models We Would Use

| Use | Model | Why |
|-----|-------|-----|
| AI Tutor, Planner, Flashcards, NCERT, Strategy, Motivation | Llama 3.3 70B | Best general open-source, close to Claude |
| Mock Tests, Physics/Chemistry numericals | DeepSeek-V3 / DeepSeek-R1 | Strong STEM reasoning |
| Photo Doubt Solver (images) | Keep GPT-4o, OR Qwen2.5-VL | No strong free vision replacement yet |
