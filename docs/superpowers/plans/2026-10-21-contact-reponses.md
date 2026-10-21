# Réponses du formulaire de contact — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Étapes en `- [ ]`.

**Goal :** chaque message du formulaire est conservé, reçoit un brouillon IA
validé par l'exploitant, part de `support@westbourse.com`, et rien ne reste
sans réponse sans relance.

**Architecture :** table `contact_messages` (service_role seul) ; modules purs
`lib/contact/*` testés (validation du brouillon, retard en jours ouvrés, rendu
email) ; console `/admin/contact` (server components + route d'envoi
idempotente) ; relance Telegram par une CLI scraper planifiée.

**Tech Stack :** Next.js 14 App Router, Supabase (service_role), Resend,
cascade LLM `callAgentLlm`, vitest, GitHub Actions.

Spec : `docs/superpowers/specs/2026-10-21-contact-reponses-design.md`.

---

### Task 1 : migration `0158_contact_messages.sql`

**Files :** Create `supabase/migrations/0158_contact_messages.sql`

- [ ] Table `contact_messages` (colonnes §3.1 de la spec), `statut` en
  `check (statut in ('nouveau','envoi','repondu','clos','spam'))`, index
  `(statut, created_at)`.
- [ ] `enable row level security`, **aucune policy** ; `revoke all … from anon,
  authenticated`.
- [ ] Permissions `support.read` / `support.reply` dans `admin_permissions`,
  accordées à `super_admin` et `support_admin` (modèle `0045`).
- [ ] `purge_rgpd_retention()` recréée à l'identique de `0146` + `delete from
  public.contact_messages where derniere_activite_at < now() - interval '12
  months'` ; `revoke execute … from public, anon, authenticated`.
- [ ] Commit.

### Task 2 : modules purs + tests

**Files :** Create `frontend/lib/contact/validerBrouillon.ts`,
`frontend/lib/contact/delai.ts`, `frontend/lib/contact/rendu.ts`,
`frontend/lib/contact/contact.test.ts`

- [ ] Tests d'abord (vitest) :
  - `validerBrouillon` refuse : `**gras**`, ligne `> citation`, ligne `# titre`,
    préambule « Voici une version mise à jour… », téléphone `+225 07 07 11 51 15`,
    email `ebouak@gmail.com`, lien `https://exemple.com`, texte vide, > 4000
    caractères ; accepte un texte sobre avec `https://www.westbourse.com/...`,
    `https://www.amf-umoa.org/...` et `support@westbourse.com`.
  - `joursOuvresEcoules(depuis, maintenant)` : vendredi 17h → lundi 9h = 0 jour
    ouvré complet ; vendredi 17h → mardi 18h = 1 ; `enRetard` vrai au-delà
    d'un jour ouvré complet.
  - `renduReponse({prenom, reponse, messageOrigine, recuLe})` : HTML échappé
    (`<script>` neutralisé), paragraphes, signature fixe, citation du message ;
    texte brut joint.
- [ ] Implémenter, tests verts, commit.

### Task 3 : persistance dans `/api/contact`

**Files :** Modify `frontend/app/api/contact/route.ts`

- [ ] Insérer via `getServiceClient()` avant l'email ; `id` récupéré.
- [ ] Email exploitant : lien `https://www.westbourse.com/admin/contact/<id>`,
  ou mention « non enregistré en base » si l'insertion a échoué (l'email part
  quand même).
- [ ] Aucun contenu de message dans les journaux. tsc, commit.

### Task 4 : email paramétrable

**Files :** Modify `frontend/lib/server/email.ts`

- [ ] `EmailMessage` gagne `from?` et `text?` ; `EmailResult` gagne `id?`
  (identifiant Resend lu dans la réponse). Appelants existants inchangés.
- [ ] tsc, commit.

### Task 5 : brouillon IA

**Files :** Create `frontend/lib/contact/brouillon.ts`,
`frontend/lib/contact/ficheProduit.ts` ; Modify
`frontend/lib/whatsappAgent/systemPrompt.ts` (canal `email`)

- [ ] `buildSystemPrompt` : `canal: 'email'` → identité « rédacteur des
  réponses email, brouillon relu par un humain », règle de format email (texte
  brut, aucun symbole, commence par « Bonjour <prénom>, », pas de signature —
  ajoutée par le gabarit), règle d'outils limitée au marché. WhatsApp/Telegram
  inchangés.
- [ ] `ficheProduit.ts` : texte fixe (fonctions, liens publics vérifiés le
  2026-10-21).
- [ ] `genererBrouillon(message)` : outils filtrés (`cours_valeur`,
  `dividendes_valeur`, `historique_valeur`, `actualites_valeur`,
  `liquidite_valeur`, `palmares_seance`) ; un appel à un outil de compte est
  refusé à l'exécution même s'il était demandé ; offres lues dans
  `subscription_plans` ; sortie passée à `validerBrouillon`, une régénération
  au plus, sinon `{ brouillon: '', raison }`.
- [ ] tsc, commit.

### Task 6 : console admin

**Files :** Create `frontend/lib/admin/contact.ts`,
`frontend/app/admin/contact/page.tsx`,
`frontend/app/admin/contact/[id]/page.tsx`,
`frontend/app/admin/contact/[id]/ReponseForm.tsx`,
`frontend/app/admin/contact/actions.ts`,
`frontend/app/api/admin/contact/[id]/repondre/route.ts` ; Modify
`frontend/lib/server/rbac.ts`, `frontend/lib/admin-nav.ts`

- [ ] Liste (en attente d'abord, ancienneté, alerte > 1 jour ouvré).
- [ ] Fiche : brouillon généré à l'ouverture si absent puis enregistré ;
  actions *Régénérer*, *Clore*, *Spam* (server actions, `recordAudit`).
- [ ] Route d'envoi : `requirePermission('support.reply')`, revalidation
  serveur, transition `nouveau → envoi` conditionnelle, Resend depuis
  `WESTBOURSE <support@westbourse.com>`, succès → `repondu`, échec → `nouveau`.
- [ ] tsc, commit.

### Task 7 : relance Telegram

**Files :** Create `scraper/src/contact/rappel.ts` (pur + run),
`scraper/tests/contactRappel.test.ts`, `.github/workflows/contact-rappel.yml` ;
Modify `scraper/src/index.ts`, `scraper/package.json`

- [ ] Tests : jours ouvrés, message sans donnée personnelle, rien si zéro.
- [ ] CLI `contact:rappel` ; workflow 07:00 UTC lun-ven (`alerts.yml` ne
  tourne qu'à 16:30 : un workflow dédié plutôt qu'un second horaire).
- [ ] Tests scraper verts, commit.

### Task 8 : RGPD, documentation, PR

- [ ] `/api/account/export` : messages `contact_messages` dont l'email égale
  celui du compte (service_role, filtré).
- [ ] `/confidentialite` : section formulaire + `support@westbourse.com` en
  lieu du `Placeholder` email ; `docs/RGPD.md` ; `CLAUDE.md`.
- [ ] tsc + tests (frontend et scraper), push, PR. Migration appliquée par
  l'exploitant, vérification anon, puis fusion sur « fusionner ».
