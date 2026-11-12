Paste this into Claude Code from inside `est platform/northmark`, after unzipping this kit into `./_redesign/`:

---

Apply the 16hundred homepage redesign (this also renames the product from Northmark to 16hundred) in `./_redesign/` to this project. Follow `./_redesign/INTEGRATE.md` exactly.

1. Back up the current homepage, then copy the kit's `src/` files into place. Merge the fonts and CSS import from
   `layout.example.tsx` into our real `src/app/layout.tsx` without removing any existing providers.
2. Replace `FALLBACK_CATALOG` on the homepage with a server function `getShelfExams()` that reads **published** exams
   from Supabase using our existing server client and exam tables. Map each one to the `ShelfExam` type
   (access free/pro from our premium flag, subject from the exam's subject, minutes from duration, modules from
   section question counts), sorted free first. Then append the EST II "soon" entries from the catalog.
   Never list unpublished exams.
3. Make sure every homepage link matches our real routes (exam detail slug or id, pricing, login, signup,
   dashboard). Point `FREE_START_HREF` to the published free exam.
4. Apply the brand to the shared header/footer of the exam library, exam detail and pricing pages so they match
   (logo, colours, fonts, buttons). Do NOT restyle the exam engine or the admin dashboard in this pass.
5. Rename the product to "16hundred" everywhere users can see it: `src/lib/brand.ts`, page titles and metadata, emails, the footer, and the support address placeholder (`support@16hundred.app`).
6. Run lint, type-check and `npm run build`. Start the dev server and check `/` at 1440px and 390px:
   no horizontal scroll, every shelf card links to a real exam, and the filter chips work.
7. Report what changed and anything you couldn't map.
