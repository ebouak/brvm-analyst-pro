# Academy — leçon éditoriale : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the Academy lesson page into a light, editorial article (warm paper, navy, turquoise) with formulas, a mechanism diagram, computed simulations and a timeline — lesson 5 (dividends) as pilot.

**Architecture:** Optional blocks added to the existing zod schema (`lib/academy/types.ts`); pure simulation functions (`lib/academy/simulations.ts`); `LessonContent` re-rendered as an article scoped under `.lp` (own CSS, like `.dv` of the stock report); small presentational components in `components/academy/lecon/`. `ToolsPanel` gets readability fixes only.

**Spec:** `docs/superpowers/specs/2026-10-20-academy-lecon-editoriale-design.md`
**Worktree / branch:** `C:/Users/adego/wt/brvm-lecon`, `feat/academy-lecon-editoriale`.
**Rules:** no `npm run build` locally; `npx tsc --noEmit` + vitest; lesson 5 content is written to production only after the new renderer is live, with a full backup first.

---

### Task 1 — Pure simulations (TDD)
- [ ] `lib/academy/simulations.test.ts`: reinvestment 300 / 1 000 / 10 000 / 5 % → year 1 income 300 000, 30 shares bought; year 2 income 346 500 with 330 shares; cash strategy year 2 = 315 000; objective 600 000 → 10 000 000 at 6 %, 7 500 000 at 8 %; zero or negative yield rejected.
- [ ] Run → FAIL (module missing).
- [ ] `lib/academy/simulations.ts`: `simulerReinvestissement(p)` and `capitalPourObjectif(revenu, rendementsPct)`.
- [ ] Run → PASS. Commit.

### Task 2 — Schema extension (TDD)
- [ ] `lib/academy/types.lecon.test.ts`: a legacy lesson still parses; a lesson with `sous_titre`, `avertissement`, `formules`, `flux`, `points`, `etapes_style: 'frise'`, both `simulation` variants parses; a 1-step `flux` and an unknown `icone` are rejected; the `cas` label no longer claims « réel » unless `reel: true`.
- [ ] Run → FAIL.
- [ ] Add the optional fields, `ICONES_FLUX`, `simulationSchema`, `libelleSection(s)`.
- [ ] Run → PASS; `npx tsc --noEmit`. Commit.

### Task 3 — Article surface and blocks
- [ ] `components/academy/lecon/lecon.css` (`.lp` tokens, editorial styles, flux/frise horizontal ≥ 640 px, vertical below, tables scroll in their own container).
- [ ] `Pictogramme.tsx` (8 inline-SVG line icons), `Blocs.tsx` (`Formules`, `Flux`, `Points`, `Frise`, `ChiffresCles`, `Tableau`), `SimulationReinvestissement.tsx` (Recharts, accessible label, table, hypotheses), `SimulationObjectif.tsx` (CSS bars, table, « rendement hypothétique, non garanti »).
- [ ] tsc. Commit.

### Task 4 — `LessonContent` as an article
- [ ] `<article className="lp">`: header (category · duration · title · `sous_titre` · resume), reduced image after the header, sections without boxes (traps / takeaways: left rule), legacy blocks restyled, `LessonChart variant="slide"`, exercise and quiz (`QcmBlock variant="papier"`), `avertissement` last.
- [ ] tsc + vitest. Commit.

### Task 5 — Tools panel readability
- [ ] Clear active tab, `aria-controls`, tighter paddings, panel content scrolls within `calc(100vh - 9rem)`, glossary without its own fixed height; notes saving untouched.
- [ ] tsc. Commit.

### Task 6 — Lesson 5 content
- [ ] `frontend/lib/academy/contenus/lecon5-dividendes.json`: 8 sections B → I with the owner's figures, `sous_titre`, `avertissement`, quiz kept.
- [ ] Test: parses with `lessonSchema`; its simulations give 346 500 and 10 M / 7,5 M; no section labelled real.
- [ ] Commit.

### Task 7 — Visual check before any DB write
- [ ] Development-only override in `lib/academy/learn.ts`: when `NODE_ENV === 'development'` and `ACADEMY_LECON_LOCALE=<slug>:<index>:<path-to-json>` is set, the lesson at `<index>` is replaced by the parsed JSON. Inert in production (guard + env var absent on Vercel); documented in the file.
- [ ] `next dev` in the worktree, signed-in session (memory « vérifier une page connectée »), lesson 5 and lesson 1 (legacy content) at 1440 / 768 / 390 px; `document.documentElement.scrollWidth <= innerWidth`; screenshots to the owner.

### Task 8 — PR, then production (user-gated)
- [ ] Push, PR (summary, files, new components, tests, limits). No merge without « fusionner ».
- [ ] After deploy, on the owner's go: back up the course content, write lesson 5 (schema-validated), re-read, check the live page.
