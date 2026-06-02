# NEET AI — Open-Source Migration: Action Plan (Who Does What)

**Purpose:** Before we start the big work, this is the simple plan — exactly **what you do** and **what I (the developer) do**, step by step. Technical details are in `OPENSOURCE_LLM_BUILD_SPEC.md`.

**The decision already made:** Replace paid Claude + GPT-4o with **two free open models** — **DeepSeek** (text) + **Qwen Vision** (images). Test on **Together AI** (exact models, ~₹2,000–2,500 prepaid) → launch on our own **physical servers** (govt/India data center).

---

## ✅ YOUR WORK (only you can do these)

### Step 0 — Quick decisions (answer me, 5 minutes)
- [ ] **Git history:** start fresh (clean first commit) or keep the old 2 commits? *(I recommend fresh.)*
- [ ] **Photo Doubt:** switch to free Qwen Vision now, or keep paid GPT-4o for the launch?
- [ ] **Confirm models:** DeepSeek (text) + Qwen Vision (images) — agreed? ✅

### Step 1 — Set up the testing platform (~30 minutes)
- [ ] Create a **Together AI account** → generate an **API key**.
- [ ] **Recharge ~₹2,000–2,500** (prepaid — covers the whole testing phase; the $5 free signup credit may cover most of it).
- [ ] Send me the key (or paste it into `backend/.env`) so the app can use the **exact models** (DeepSeek + Qwen Vision) for testing.
- [ ] Keep the existing OpenAI key **only if** you choose to keep GPT-4o for photos.

### Step 2 — Content (you said you'll handle this)
- [ ] Prepare the **question banks** you'll upload (I'll tell you the exact format).
- [ ] *(Optional, later)* NCERT / Samacheer text, if we add fact-grounding for accuracy.
- [ ] *(Optional, TN edition)* Tamil content / translations, if we do the Tamil version.

### Step 3 — Manager & Government (you + your manager)
- [ ] Confirm: will the **government provide/buy the servers**, or do we? *(Decides who pays.)*
- [ ] Confirm the **pilot budget** *(testing itself = ₹0)*.
- [ ] Get **sign-off** on the plan + the model & hosting decisions.
- [ ] *(TN)* Confirm interest in the value-add features (Tamil, Samacheer→NEET bridge, dashboard).

### Step 4 — Help me test (during the build)
- [ ] Give me **~100–200 real NEET questions with correct answers** — so I can measure how accurate the open model is.
- [ ] **Try the app** after each feature is switched and tell me what feels wrong.

### Step 5 — Production hardware (LATER, after the pilot)
- [ ] Pick **Plan A (top) vs Plan B (cost-effective)** servers — see spec doc §6.6.
- [ ] Buy **ONE server first**; arrange data-center space (government / India).
- [ ] Scale to the full cluster based on **real pilot numbers** (not guesses).

---

## 🤖 MY WORK (the developer side — you don't do these)
Listed so you know what's happening behind the scenes:

1. **Clean up the repo** — remove the unrelated service, move the exposed DB password to secrets, add new keys.
2. **Build the central AI module** (`lib/llm.ts`) — one place that handles model switching, JSON, and streaming.
3. **Switch all 10 AI features** from Claude → the open model. *(The app looks and works exactly the same to students.)*
4. **Make answers reliable** — fix the 5 features that can currently crash on bad output.
5. **Wire Photo Doubt to Qwen Vision** (if you choose that).
6. **Add usage logging** — so we can measure real cost during the pilot.
7. **Build a small accuracy test** using your NEET questions — to prove quality with a number.
8. **Help deploy** to your VPS for the free pilot.

---

## 📋 The order we'll work in
1. **You:** Step 0 decisions + Step 1 Groq key.
2. **Me:** cleanup + central module + switch all features.
3. **You:** send NEET test questions (Step 4).
4. **Me + You:** test every feature on the open model — free, on your existing VPS.
5. **Manager/Govt:** hosting + hardware for the real launch (Step 3 & 5).

---

## 🚦 What I need from you to START coding
Just **two** things:
1. **Answer the Step 0 decisions.**
2. **A Together AI API key + small recharge (Step 1).**

Once I have those, I begin immediately. Everything else (content, government, hardware) can happen in parallel while I build.
