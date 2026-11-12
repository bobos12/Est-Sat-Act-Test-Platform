# EST Examination Blueprint

Derived from the 24 source papers in `TESTS/` (Sample, January 2026, March 2026, May 2026 sessions).
Every module, topic and skill name below is copied from the official answer-key distribution tables.
Nothing here is invented. When new source papers are added, update this file only from their keys.

## Source inventory

| Test | Papers analysed | Questions | Duration |
|---|---|---|---|
| EST I HS Math | Sample, Jan, Mar, May 2026 | 50 MCQ (A–D) | 75 min |
| EST I HS Literacy | Sample, Jan, Mar, May 2026 | 85 MCQ (A–D), 3 modules | 90 min |
| EST II HS Math Level 1 | Jan 2026 | 40 MCQ | 60 min |
| EST II HS Math Level 2 | Jan 2026 | 40 MCQ (formula sheet) | 60 min |
| EST II HS Biology | Jan 2026 | 60 MCQ | 60 min |
| EST II HS Chemistry | Jan 2026 | 60 MCQ | 60 min |

Launch scope: **EST I Math** and **EST I Literacy** (the brief's "EST Math / EST English").
EST II subjects are already in the knowledge base and can be enabled later without schema changes.

---

## EST I — Math

- 50 multiple-choice questions, 4 options (A–D), one correct answer.
- 75 minutes. Calculator allowed. Some sessions include a "Reference Material" page.
- No modules — a single section.
- Questions may be grouped: *"Questions 25 – 27 refer to the information below"* with a shared
  stimulus (text, table, bar chart, graph).
- Answer options may be **images** (e.g. four candidate graphs in Sample Q1).
- Heavy use of inline math: fractions, exponents, complex numbers, radicals, function notation.

### Topic areas (official names)

| Topic | Sample | Jan | Mar | May | Typical share |
|---|---|---|---|---|---|
| Foundational Algebra | 14 | 14 | 14 | 15 | ~28–30% |
| Data Analysis and Probability | 16 | 14 | 15 | 15 | ~28–32% |
| Advanced Algebra and Functions | 16 | 15 | 15 | 15 | ~30–32% |
| Geometry and Trigonometry | 4 | 7 | 6 | 5 | ~8–14% |

### Cognitive levels (official names)

| Level | Sample | Jan | Mar | May |
|---|---|---|---|---|
| Knowledge | 38% | 36% | 38% | 36% |
| Application | 50% | 52% | 54% | 52% |
| Reasoning | 12% | 12% | 8% | 12% |

**Default generation blueprint (full mock):** 14 Foundational Algebra, 15 Data Analysis and Probability,
15 Advanced Algebra and Functions, 6 Geometry and Trigonometry; levels ≈ 37% / 52% / 11%.

---

## EST I — Literacy

- 85 multiple-choice questions, 4 options, 90 minutes total, **3 modules**.
- Directions: three question types — underlined part of the passage, a specific part of the passage,
  or the entire passage. Some questions offer **"NO CHANGE"** as option A.
- Layout: passage on the left, questions on the right. Underlined/bracketed numbered markers
  `[n]` in the passage link to question n.

### Module structure

| Module | Questions | Passages | Character |
|---|---|---|---|
| Module 1 | 35 | 3 (≈11–12 Qs each) | Editing in context: conventions + expression of ideas |
| Module 2 | 25 | 2 (≈12–13 Qs each) | Reading comprehension / analysis |
| Module 3 | 25 | 10–12 short passages (1–3 Qs each) | Mixed short-passage reading and editing |

### Skills (official names)

- Words in Context (also printed as "Words in Context Vocab")
- Expression of Ideas
- Standard English Conventions

### Passage domains (official names, vary by session)

Analysis in Literature, Analysis in History, Analysis in History/Social Studies, Analysis in Social Studies,
Analysis in Social Science, Analysis in Science, Analysis in Humanities, Analysis in Biography,
Analysis in Autobiography, Analysis in Technical.

In the platform: **skill** is stored per question; **passage domain** is stored on the shared stimulus.

---

## EST II (stored, not launched)

- **Math Level 1** topics: Numerations and Operations; Algebra and Functions; Plane Shapes; Measurements;
  Coordinate Systems; Trigonometry; Data Analysis, Statistics, and Probability.
- **Math Level 2** topics: Numerations and Operations; Algebra and Functions; Coordinate Systems; Solid Shapes;
  Trigonometry; Data Analysis, Statistics, and Probability.
- Math levels: Knowledge, Application, Reasoning, **Synthesis**.
- **Biology** topics: Cell Structure and Molecular Biology; Ecology; Genetics and Heredity; Body Systems and plants;
  Classification and Evolution.
- **Chemistry** topics: Foundation of Chemistry: Atoms, Bonds and Periodic Properties; Chemical Reactions and
  Quantitative Chemistry; Chemical Behavior (aqueous solutions and gaseous state); Chemical Kinetics and
  Chemical Equilibrium; Experimental Chemistry.

---

## Implications for the platform

1. **Question content model** must support: rich text with LaTeX math, images (in stem *and* in options),
   tables, and a shared **stimulus** (passage / chart / data set) referenced by several questions.
2. **Literacy** needs a split-pane layout with the passage persistent while navigating its questions, and
   in-passage markers that highlight the active question's location.
3. **Sections**: Literacy exams have 3 sections (modules); Math has 1. Timer is per exam (90 / 75 min).
4. **Practice exams** in the library can be smaller than full mocks (e.g. a single topic, 15–20 questions),
   filtered by the official topic names above.
5. **AI generation** should target the topic × level matrix above and never reuse source questions verbatim.
6. Images (graphs, diagrams, figures) do not survive text extraction — the PDF ingestion pipeline must render
   page images and let the admin crop/attach figures during review.
