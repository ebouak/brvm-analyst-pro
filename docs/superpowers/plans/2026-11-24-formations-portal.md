# Formations Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/formations` as an Academy-first learning portal that matches the current Academy catalog without changing access, data, or destination behavior.

**Architecture:** Keep the existing server route and its data loaders. Update only its page composition and styling, reusing current components and server-derived counts; preserve the access-gate branch and all existing links.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS, existing WESTBOURSE design tokens.

## Global Constraints

- Conserver `canAccess('formations')`, `AccessGate`, `accesAcademy`, `OffresNiveaux` et l’ordre de priorité des accès.
- La Leçon 0 demeure accessible même lorsque le reste de la page est bloqué.
- Ne pas fabriquer de compte, de progression, de date ni de disponibilité.
- Ne pas afficher un format absent comme s’il était disponible.
- Maintenir les états vides existants et l’affichage responsive/accessibilité (titres hiérarchisés, liens focalisables, contrastes du thème).
- Pas de changement aux cours, règles d’accès, tarifs, données de session, catalogue Academy, ni contenu des replays.

---

### Task 1: Refondre le portail des formations

**Files:**
- Modify: `frontend/app/formations/page.tsx`
- Reference: `frontend/components/academy/AcademyCatalogCoursera.tsx`
- Reference: `frontend/components/academy/Lecon0Carte.tsx`
- Reference: `docs/superpowers/specs/2026-11-24-formations-portal-design.md`

**Interfaces:**
- Consumes: `listFormations`, `listPublishedCourses`, `listerSessionsAVenir`, `listCourses`, `canAccess`, `accesAcademy`.
- Produces: the same `/formations` route, data-backed previews, and existing navigation targets.

- [x] **Step 1: Rework the page hierarchy and visual composition**

Keep the current server-side loading and gate decisions. Replace the generic
heading/list presentation with an editorial header and Academy-primary action,
keep `Lecon0Carte` as a prominent free starting point, then present the
Academy, sessions, and available video modules as visually related route
cards. Keep the course preview compact with its existing catalogue link, and
render replay/conference cards only when published records exist.

Use the existing design tokens (`bg`, `surface`, `elevated`, `border`,
`accent-ink`, `muted`, `faint`) and Academy visual language. Retain the current
real-volume labels and all route destinations. Do not add a new data source,
access rule, or progress claim.

- [x] **Step 2: Verify types and frontend tests**

Run from `frontend`:

```powershell
npm run typecheck
npm test
```

Expected: TypeScript succeeds and the existing Vitest suite has no failures.
Review the final diff for `frontend/app/formations/page.tsx` to ensure existing
uncommitted changes were preserved and no unrelated files were altered.
