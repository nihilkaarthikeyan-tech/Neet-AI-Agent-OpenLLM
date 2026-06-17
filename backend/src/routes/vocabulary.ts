/**
 * English Comprehension Scaffolding — 600 NEET technical terms, bilingual.
 *
 * The real rural disadvantage isn't just language — it's reading English fast
 * under time pressure. ~600 technical terms appear repeatedly in NEET.
 * This trainer teaches them bilingually (EN + Tamil) with AI mnemonics.
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { chatJSON } from '../lib/llm.js';
import { NEET_GEN_SYSTEM } from '../lib/prompts.js';
import { languageInstruction, languageSchema } from '../lib/lang.js';

const router = Router();

// Curated high-yield NEET terms per subject
const NEET_TERMS: Record<string, string[]> = {
  Biology: [
    'Mitosis','Meiosis','Mitochondria','Chloroplast','Ribosome','Endoplasmic Reticulum',
    'Golgi apparatus','Lysosome','Vacuole','Nucleus','Nucleolus','Chromatin','Chromosome',
    'DNA replication','Transcription','Translation','Gene','Allele','Genotype','Phenotype',
    'Dominant','Recessive','Homozygous','Heterozygous','Mutation','Natural selection',
    'Adaptation','Speciation','Fossil','Taxonomy','Binomial nomenclature','Kingdom',
    'Photosynthesis','Respiration','Transpiration','Osmosis','Diffusion','Active transport',
    'Enzyme','Substrate','Catalyst','Hormone','Neurotransmitter','Synapse','Reflex',
    'Digestion','Absorption','Excretion','Nephron','Glomerulus','Dialysis','Circulation',
    'Haemoglobin','Platelet','Antibody','Antigen','Vaccine','Immunity','Pathogen',
    'Bacteria','Virus','Fungi','Protozoa','Algae','Ecosystem','Food chain','Biodiversity',
  ],
  Chemistry: [
    'Atom','Molecule','Ion','Cation','Anion','Isotope','Orbital','Valence',
    'Electronegativity','Ionic bond','Covalent bond','Metallic bond','Hydrogen bond',
    'Oxidation','Reduction','Redox','Electrolysis','Electrolyte','Catalyst','Inhibitor',
    'Exothermic','Endothermic','Enthalpy','Entropy','Equilibrium','Le Chatelier principle',
    'Acid','Base','Buffer','pH','Titration','Molarity','Normality','Molality',
    'Alkane','Alkene','Alkyne','Functional group','Isomer','Polymer','Monomer',
    'Carbohydrate','Protein','Lipid','Nucleic acid','Amino acid','Peptide bond',
    'Coordination compound','Ligand','Chelate','Oxidation state','Hybridisation',
    'Aromaticity','Benzene','Substitution','Addition','Elimination','Condensation',
  ],
  Physics: [
    'Velocity','Acceleration','Momentum','Force','Torque','Work','Power','Energy',
    'Kinetic energy','Potential energy','Conservation','Friction','Centripetal',
    'Gravitational','Pressure','Density','Buoyancy','Viscosity','Surface tension',
    'Temperature','Heat','Specific heat','Latent heat','Conduction','Convection',
    'Radiation','Thermodynamics','Entropy','Efficiency','Electric charge','Current',
    'Voltage','Resistance','Ohm law','Capacitor','Inductor','Magnetic field',
    'Electromagnetic','Flux','Induction','Transformer','Frequency','Wavelength',
    'Amplitude','Refraction','Reflection','Diffraction','Interference','Polarisation',
    'Photoelectric effect','de Broglie','Bohr model','Radioactivity','Fission','Fusion',
    'Semiconductor','Diode','Transistor','Logic gate','Bandwidth','Impedance',
  ],
};

// GET /api/vocabulary/terms?subject=Biology
router.get('/terms', authenticate, (req, res) => {
  const subject = (req.query as { subject?: string }).subject;
  if (subject && NEET_TERMS[subject]) {
    res.json({ terms: NEET_TERMS[subject], subject });
  } else {
    res.json({ terms: NEET_TERMS, subjects: Object.keys(NEET_TERMS) });
  }
});

// POST /api/vocabulary/explain — AI bilingual explanation + mnemonic for a term
const explainSchema = z.object({
  term: z.string().min(1).max(100),
  subject: z.enum(['Biology', 'Chemistry', 'Physics']),
  language: languageSchema,
});

const ExplainSchema = z.object({
  term: z.string(),
  definition: z.string(),
  tamilDefinition: z.string(),
  tamilPronunciation: z.string(),
  ncertContext: z.string(),
  exampleInNEET: z.string(),
  mnemonic: z.string(),
  relatedTerms: z.array(z.string()),
});

router.post('/explain', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = explainSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { term, subject, language } = parsed.data;

  const prompt = `You are a NEET vocabulary coach helping Tamil Nadu government-school students master English technical terms.

Explain this NEET ${subject} term for a student who struggles with English: "${term}"

Return a JSON object:
{
  "term": "${term}",
  "definition": "Clear English definition in simple words a Class 11 student understands",
  "tamilDefinition": "Definition in Tamil (தமிழ்) — simple spoken Tamil, not formal",
  "tamilPronunciation": "How to pronounce this English word phonetically in Tamil script (e.g. மைட்டோகாண்ட்ரியா)",
  "ncertContext": "The exact sentence or context where this term appears most in NCERT ${subject}",
  "exampleInNEET": "A real NEET question pattern that uses this term",
  "mnemonic": "A memorable trick to never forget this term — ideally with a Tamil connection",
  "relatedTerms": ["3-4 closely related NEET terms the student should also know"]
}${languageInstruction(language)}`;

  try {
    const explanation = await chatJSON({ user: prompt, system: NEET_GEN_SYSTEM, schema: ExplainSchema, maxTokens: 800, temperature: 0.4, feature: 'vocab-explain' });
    res.json({ explanation });
  } catch {
    res.status(503).json({ error: 'Could not generate explanation. Try again.' });
  }
});

// POST /api/vocabulary/quiz — generate a 5-question speed-reading quiz on these terms
const quizSchema = z.object({
  terms: z.array(z.string()).min(3).max(10),
  subject: z.enum(['Biology', 'Chemistry', 'Physics']),
  language: languageSchema,
});

router.post('/quiz', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = quizSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }
  const { terms, subject, language } = parsed.data;

  const prompt = `Generate 5 NEET-style MCQs that test understanding of these ${subject} terms: ${terms.join(', ')}.

Each question tests MEANING and USAGE of the term, not just definition. Focus on how NEET uses these terms in question stems.

Return JSON: { "questions": [{ "q": "Question?", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correct": "A", "explanation": "Why correct", "term": "which term this tests" }] }${languageInstruction(language)}`;

  try {
    const result = await chatJSON({ user: prompt, system: NEET_GEN_SYSTEM, schema: z.object({ questions: z.array(z.any()) }), maxTokens: 1500, temperature: 0.3, feature: 'vocab-quiz' });
    res.json(result);
  } catch {
    res.status(503).json({ error: 'Could not generate quiz. Try again.' });
  }
});

export default router;
