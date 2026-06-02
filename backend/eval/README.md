# NEET Accuracy Eval Harness

Phase 4 of `OPENSOURCE_LLM_BUILD_SPEC.md`. Scores the configured open-source
model against a fixed set of NEET MCQs with a known answer key, so we can state
model quality as a **number** ("scores X% on N graded NEET questions") in the
government technical review — not a vibe.

## Run

```bash
# from backend/
npm run eval                          # uses the 3-question sample
npm run eval -- eval/my-200-qs.json   # your own bank (the 100–200 real NEET Qs)
```

Needs the same env as the app (`backend/.env`): `LLM_API_KEY`, `LLM_BASE_URL`,
`LLM_MODEL_TEXT`. It uses the same central `lib/llm.ts` module the app uses, so
it tests the **exact** model + endpoint that ships.

## Question file format

A JSON array of objects:

```json
[
  {
    "id": "phy-001",
    "subject": "Physics",
    "topic": "Laws of Motion",
    "question": "A body of mass 2 kg ...?",
    "options": { "A": "2 N", "B": "4 N", "C": "8 N", "D": "16 N" },
    "correct": "B"
  }
]
```

- `id`, `subject`, `question`, `options` (A–D), `correct` (A/B/C/D) are required.
- `topic` is optional.

## Output

- Overall accuracy (`correct/total = %`).
- Per-subject breakdown (Physics / Chemistry / Biology).
- A list of every missed question (chosen vs expected) for error analysis.

To compare against the old Claude baseline, point `LLM_*` at the Claude-compatible
endpoint (or temporarily set a Claude model) and re-run on the same file — the
two percentages are your before/after number.
