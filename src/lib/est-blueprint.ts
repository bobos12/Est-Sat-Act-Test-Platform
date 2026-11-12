/** Blueprint facts given to the AI (from docs/EST_BLUEPRINT.md — official names only). */
export const blueprints: Record<string, { text: string; topicWeights?: Record<string, number> }> = {
  "est1-math": {
    text: `EST I Math: 50 multiple-choice questions (A–D), 75 minutes, calculator allowed, single section.
Topics (official names, typical share of a full paper): Foundational Algebra ~28–30%; Data Analysis and Probability ~28–32%; Advanced Algebra and Functions ~30–32%; Geometry and Trigonometry ~8–14%.
Cognitive levels: Knowledge ~37%, Application ~52%, Reasoning ~11%.
Style: short stems, realistic contexts (prices, ratios, surveys, tables, bar charts), groups of 2–3 questions sharing one scenario or table, complex numbers, polynomial division, function composition, exponents, probability with and without replacement, statistics (mean, median, IQR), lines and slopes, midpoints, quadratics and vertex problems.`,
    topicWeights: {
      "Foundational Algebra": 14,
      "Data Analysis and Probability": 15,
      "Advanced Algebra and Functions": 15,
      "Geometry and Trigonometry": 6,
    },
  },
  "est1-literacy": {
    text: `EST I Literacy: 85 multiple-choice questions (A–D), 90 minutes, three modules.
Module 1 (35 Qs): 3 passages, editing questions tied to numbered markers in the passage ("Which option is the most grammatically correct?", "Which word works best in this context?", "Which option provides the most logical transition?", "Which option is the most concise and precise?"), option A is often "NO CHANGE".
Module 2 (25 Qs): 2 longer passages with reading-comprehension and vocabulary-in-context questions.
Module 3 (25 Qs): 10–12 short passages with 1–3 questions each.
Skills (official): Words in Context; Expression of Ideas; Standard English Conventions.
Passage domains (official): Analysis in Literature, History, Social Studies, Science, Humanities, Biography, Technical.`,
  },
};
