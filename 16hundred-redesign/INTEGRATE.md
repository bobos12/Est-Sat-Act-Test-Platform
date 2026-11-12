# 16hundred redesign: how to drop it in

This kit contains the new brand and homepage as real Next.js code. It was built and production-tested
against Next 16 in a clean project (type-check, build and render all pass). It doesn't touch the exam engine,
admin or payments. The styles are scoped under `.sh`, so the homepage can't break any other page.

## What's in the box

```
src/styles/16hundred.css            brand tokens + every homepage style (scoped to .sh)
src/components/brand/Logo.tsx        the "16" bubble + "hundred" wordmark
src/components/home/HomePage.tsx     the full homepage (server component), takes `exams`
src/components/home/TryQuestion.tsx  hero "try 3 questions" card (client)
src/components/home/ExamShelf.tsx    filterable exam shelf (client)
src/components/home/EngineDemo.tsx   interactive exam-room preview (client)
src/components/home/GraphPaper.tsx   hero graph paper + score line climbing to 1600 (client, canvas)
src/components/home/Reveal.tsx       scroll reveal, 400→1600 counter, sticky-nav border
src/components/home/Icons.tsx        arrows / small icons
src/lib/exam-catalog.ts              ShelfExam type + the EST catalog from the blueprint
src/app/page.tsx                     new homepage route
src/app/layout.example.tsx           fonts (Instrument Sans, Instrument Serif, JetBrains Mono) + CSS import + metadata
src/app/icon.svg                     favicon
preview/index.html                   standalone prototype (open in a browser)
```

## Steps

1. **Back up** your current `src/app/page.tsx` (e.g. rename it to `page.old.tsx`, outside `app/`).
2. Copy `src/styles`, `src/components/brand`, `src/components/home`, `src/lib/exam-catalog.ts`, `src/app/icon.svg`
   and `src/app/page.tsx` into the project. If you have a `(marketing)` route group, put `page.tsx` there.
3. In your existing `src/app/layout.tsx`, add the three `next/font/google` fonts from `layout.example.tsx`,
   put their `.variable` classes on `<html>`, and `import "@/styles/16hundred.css"`. Keep your providers.
4. **Wire the shelf to Supabase.** `page.tsx` currently uses `FALLBACK_CATALOG`. Replace it with a
   `getShelfExams()` that reads published exams and maps each one to `ShelfExam`:
   - `access`: `"free"` if the exam is free, `"pro"` if premium
   - `subject`: `"math"` / `"lit"` (EST II later: `"m1" | "m2" | "bio" | "chem"`)
   - `modules`: question count per section (Literacy full mock = `[35,25,25]`)
   - then append the EST II entries from `FALLBACK_CATALOG` with `access: "soon"` until you enable them.
   Use only what's actually published. Don't show catalog mocks that don't exist yet.
5. Check the routes the homepage links to: `/exams`, `/exams/[slug]`, `/pricing`, `/login`, `/signup`,
   `/dashboard`, `/terms`, `/privacy`. Change the hrefs if any of yours are named differently.
   `FREE_START_HREF` in `exam-catalog.ts` points to the live free exam.
6. `npm run build`, then open http://localhost:3000.

## Brand rules (for the rest of the site)

- **Name:** 16hundred, written lowercase as one word. The logo is a filled blue bubble holding "16", followed by "hundred".
  1600 is the top EST I score (800 Math + 800 Literacy), so the name is the goal.
- **Concept:** graph paper and the answer bubble. Graph paper is the background, answer bubbles mark options
  and progress, and a score line climbing to 1600 is the hero motif.
- **Colours:** white #FFFFFF and cool off-white #F5F7FC, ink #0A0F1C, exam blue #1559ED (primary actions + Math),
  navy #0A1A3A (dark sections, exam top bars), sky #6AA4FF (accents on navy). Literacy is ink. Green and red are
  only for right and wrong answers.
- **Type:** Instrument Sans 650 at 88% width with tight tracking for headlines. Instrument Serif italic in blue is
  the accent (always used for "1600"). JetBrains Mono uppercase for labels, timers and counts.
- **Tone:** encouraging but honest. Never promise a score. "Aim for 1600", "find your next ten points".
  Parents read this site too, so keep it plain, specific and without hype.
