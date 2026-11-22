# Official SAT Practice Tests 4–11 (paper versions)

Source: `Digital SAT Practice Tests/1 - SAT/SAT Test NN/` (test, answer explanations, scoring guide).
Each test becomes two **premium, published** exams in two modules each, with that test's official
raw → scaled score table (results show the official 200–800 range):

| Exam | Questions | Time |
|---|---|---|
| SAT Practice Test N: Reading and Writing | 2 × 33 | 78 min (2 × 39) |
| SAT Practice Test N: Math | 2 × 27, incl. 14 typed (grid-in) answers | 86 min (2 × 43) |

## Install

1. Apply migration `supabase/migrations/20261121000001_student_produced_responses.sql`.
2. Run `sat_practice_tests.sql` in the Supabase SQL editor (safe to re-run: existing exams are skipped).
3. Deploy, so the figures in `public/sat/` are served.

## Rebuild pipeline

| Step | Script | Output |
|---|---|---|
| 1 | `python parse_keys.py` | `data/keys.json`: answer keys (incl. grid-in accepted answers) + score tables |
| 2 | `python parse_rw.py NN` | `data/sat-NN-rw.json` + table/graph crops in `public/sat/test-NN/` |
| 3 | `python parse_math.py NN [render dir]` | `data/math-NN-draft.json` + math figure crops (`data/crops.json` = hand-set boxes) |
| 4 | hand transcription | `data/sat-NN-math.txt` (format documented in `build_sat.py`) |
| 5 | `python build_sat.py` | `sat_practice_tests.sql` (validates every question; removes unused crops) |

`python sheet.py NN math out.png` makes a contact sheet of a test's figure crops for review.

## Notes

- **Keys** always come from the scoring guides. Every math answer was also re-solved during transcription.
- **R&W** text is read from the visible glyphs (`TEXT_IGNORE_ACTUALTEXT`); the PDFs' hidden accessibility
  layer is unreliable. Underlines are detected from the drawn rules and stored as `[[0|…]]` markers.
  Explanations are College Board's own.
- **Math** expressions don't survive extraction, so stems and choices were transcribed into LaTeX by hand,
  and the explanations were written fresh. All 4,624 LaTeX expressions render in KaTeX.
- Answer choices that are graphs or tables are images (`math-mM-qNN-A.png`) or Markdown tables.
- Typed-answer questions are kept out of the practice bank (`/practice` answers by option only).
