# Plan — Lecture de séance : premium, cohérence, événements

Spec : `docs/superpowers/specs/2026-09-24-lecture-seance-premium-coherence-design.md`
Branche : `main` (convention du dépôt). Cinq tâches, séquentielles.

Validation après chaque tâche : `npx tsc --noEmit` (frontend) et
`npx vitest run <fichiers de test touchés>`. **Ne jamais lancer `npm run build`.**

---

## Tâche 1 — `lib/coherence/` : les quatre règles, pures et testées

**Fichiers** : `frontend/lib/coherence/regles.ts` (CREATE),
`frontend/lib/coherence/regles.test.ts` (CREATE).

Aucune I/O, aucun composant, aucun accès Supabase. Entrées passées en
paramètres, sorties `Anomalie[]`.

### Type

```ts
export type RegleCode = 'notation_perimee' | 'etiquette_contredite'
  | 'publication_mal_attribuee' | 'comptes_perimes';

export interface Anomalie {
  regle: RegleCode;
  gravite: 'trompeuse' | 'a_surveiller';
  message: string;                                  // phrase destinée au lecteur
  preuve: Record<string, string | number | null>;   // champs déclencheurs, pour l'admin
}
```

### Les fonctions

1. `verifierNotation({ dateNotation, publications })` → `Anomalie | null`
   — `publications: { date_publication: string; libelle: string }[]`.
   — Anomalie `trompeuse` si une publication dont le libellé contient
     « notation » (insensible à la casse et aux accents) est **postérieure** à
     `dateNotation`. Message : « La notation affichée date de <mois année> ;
     une notation plus récente a été publiée le <date> et n'est pas encore
     reprise. » `null` si `dateNotation` est absente (rien à contredire).

2. `verifierEtiquetteTechnique({ explication, sousScores })` → `Anomalie | null`
   — `sousScores: Partial<Record<'rsi'|'macd'|'volume'|'variation'|'tendance', number|null>>`.
   — Anomalie `a_surveiller` si l'`explication` qualifie un facteur de
     « (neutre) » alors que `|sous-score correspondant| >= 0.6`.
   — Ne traiter que les facteurs effectivement nommés dans la phrase.

3. `verifierAttribution({ code, designation, libelle, autresSocietes })` → `Anomalie | null`
   — `autresSocietes: { code: string; designation: string }[]`.
   — **Les trois conditions de la spec §4 doivent TOUTES tenir.** Liste des
     termes génériques à exclure : `SOCIETE, BANK, BANQUE, AFRICA, AFRICAN,
     NATIONALE, NATIONAL, GENERALE, IVOIRIENNE, INTERNATIONALE, CREDIT,
     ASSURANCE, GROUPE, CI, SN, BN, NG, BF, TG, ML, NE`.
   — Normaliser accents et casse avant comparaison.
   — **Deux correspondances ou zéro ⇒ `null`.**

4. `verifierFraicheurComptes({ dernierExercice, publicationsEtatsFinanciers })` → `Anomalie | null`
   — Anomalie `a_surveiller` si une publication d'états financiers porte sur
     une période postérieure au dernier exercice en base.
   — Détecter l'année dans le libellé (`/(?:exercice|semestre|trimestre)\s+(20\d{2})/i`).
     Aucune année lisible ⇒ la publication est ignorée, pas devinée.

5. `collecterAnomalies(entree)` → `Anomalie[]` — appelle les quatre, filtre les
   `null`, ordonne `trompeuse` avant `a_surveiller`.

### Tests exigés (cas réels du 2026-09-24)

Positifs : PALC notation (2025-07-01 vs publication 2026-08-26) ·
SNTS « RSI 70 (neutre) » avec `rsi: -0.9871` · « Notation Financière - SAFCA CI »
sur PALC (PALMCI) · « Etats financiers - Exercice 2025 - TRACTAFRIC MOTORS CI »
sur CFAC (CFAO MOTORS CI).

**Négatifs, obligatoires** (ils protègent contre le défaut de correspondance
floue des dividendes) :
- « Rapport d'activités - 1er semestre 2026 - SOCIETE GENERALE CI » sur SGBC
  (SGBCI) ⇒ **aucune** anomalie ;
- « Rapport des CAC … - BOA NG » sur BOAN (BANK OF AFRICA NIGER) ⇒ **aucune** ;
- un libellé nommant deux cotées ⇒ **aucune** (ambiguïté refusée) ;
- « RSI 45 (neutre) » avec `rsi: 0.1` ⇒ **aucune**.

---

## Tâche 2 — Migration 0140 : drapeau et table

**Fichier** : `supabase/migrations/0140_coherence_et_flag_lecture_seance.sql` (CREATE).

1. `INSERT INTO feature_flags (code, label, acces, description)` →
   `('lecture_seance', 'Lecture commentée de la séance', 'premium', '…')`,
   avec `ON CONFLICT (code) DO NOTHING` (idempotence).

2. `CREATE TABLE IF NOT EXISTS coherence_anomalies` :
   `id bigserial primary key`, `code text not null`, `regle text not null`,
   `gravite text not null`, `message text not null`, `preuve jsonb`,
   `detectee_le date not null default current_date`, `resolue_le date`,
   `created_at timestamptz default now()`.
   Contrainte d'unicité `(code, regle, detectee_le)` pour que le balayage soit
   idempotent.

3. **RLS** : `alter table … enable row level security;` et **aucune policy**
   pour `anon`/`authenticated`. Écriture service_role uniquement.
   `revoke all on coherence_anomalies from anon, authenticated;` —
   **les deux rôles nommément**, `from public` ne suffit pas (voir CLAUDE.md §11).

Ne pas appliquer la migration : le contrôleur s'en charge.

---

## Tâche 3 — Verrou premium sur les trois surfaces

**Fichiers** : `frontend/app/actions/[code]/page.tsx`,
`frontend/app/dashboard/page.tsx`, `frontend/app/societes/[code]/page.tsx`.

- `const gateSeance = await canAccess('lecture_seance');` — sur `/actions` et
  `/societes`, l'ajouter au `Promise.all` de `canAccess` existant plutôt que
  d'ouvrir un aller-retour de plus.
- Si `!gateSeance.allowed` : **ne pas rendre** `<CarnetCommentaire>`. Rendre
  `<SectionLock required={gateSeance.required === 'free' ? 'premium' : gateSeance.required} />`
  en suivant exactement le motif du bloc Fondamentaux de `/actions/[code]`.
- Le masquage CSS est proscrit : aucune phrase d'analyse ne doit figurer dans
  le HTML d'un visiteur non autorisé.
- `/societes/[code]` n'affiche pas encore le commentaire : l'y ajouter **sous
  le carnet**, derrière le même verrou, en réutilisant les données que la page
  charge déjà. Si une donnée manque (contexte, bruit, économie), passer
  `undefined` — le module dégrade proprement, il ne faut rien inventer.

Vérifier après coup : `curl` anonyme sur `/societes/<CODE>` ne doit contenir
**aucune** phrase du commentaire.

---

## Tâche 4 — Événements de marché et mesure de ce qui a suivi

**Fichiers** : `frontend/lib/carnet/evenements.ts` (CREATE),
`frontend/lib/carnet/evenements.test.ts` (CREATE),
`frontend/lib/carnet/commentaire.ts`, `frontend/components/CarnetCommentaire.tsx`,
`frontend/app/actions/[code]/page.tsx`.

### Module pur `evenements.ts`

```ts
export interface EvenementMarche {
  event_date: string; event_type: string | null; title: string;
}
export interface MesureEvenement {
  evenement: EvenementMarche;
  /** null tant que la fenêtre de 5 séances n'est pas complète. */
  surperformancePct: number | null;
  volumeRatio: number | null;
  fenetreComplete: boolean;
}
export function selectionnerEvenements(evts: EvenementMarche[], aujourdhui: string, max = 3): EvenementMarche[]
export function phraseEvenement(m: MesureEvenement): { fait: string; portee?: string }
```

- Priorité de type : `resultats` 1, `dividende` 1, `autre` 2, `assemblee` 3 ;
  à priorité égale, du plus récent au plus ancien. Exclure les dates futures.
- `phraseEvenement` : formulation **imposée** « Dans les 5 séances qui ont
  suivi, le titre a fait X % de mieux/moins bien que le BRVM Composite ».
  Fenêtre incomplète ⇒ portée = « La fenêtre de 5 séances n'est pas encore
  complète : aucune mesure n'est publiée. » Mesure nulle ⇒ **pas de portée
  du tout**.

### Intégration

- `commenterSeance` accepte `evenements?: MesureEvenement[]` et produit des
  constats `origine: 'evenement'`. Ajouter la limite « Ces mesures décrivent ce
  qui a suivi la date, pas ce que l'événement a produit. »
- `CarnetCommentaire` : pastille « Événement ».
- Page action : charger `market_events` (6 derniers, pour en retenir 3 après
  tri) et l'indice BRVM Composite depuis `brvm_indices_daily`, appeler
  `eventStudy` de `lib/eventStudy.ts` avec `window = 5`.
- **Interdits** : ne jamais lire `sentiment` ni afficher `reaction`.

### Tests

Sélection (priorité, exclusion du futur, plafond 3) · fenêtre incomplète ⇒
aucun chiffre · mesure nulle ⇒ événement listé sans portée · aucun verbe de
causalité dans la sortie (reprendre la liste d'interdits de
`commentaire.test.ts`).

---

## Tâche 5 — Balayage hebdomadaire et page admin

**Fichiers** : `scraper/src/coherence/pure/regles.ts` (COPIE du module frontend,
avec le commentaire de duplication assumée en tête, comme `scraper/src/hebdo/pure/`),
`scraper/src/coherence/runCoherence.ts` (CREATE),
`scraper/src/index.ts` (commande `coherence`),
`.github/workflows/coherence.yml` (CREATE, dimanche 08:00 UTC),
`frontend/app/admin/coherence/page.tsx` (CREATE).

- `runCoherence` : pagine les 48 instruments (PostgREST plafonne à 1000 lignes
  **en silence** — paginer explicitement), applique les règles, upsert dans
  `coherence_anomalies` sur `(code, regle, detectee_le)`.
- Le job **échoue bruyamment** s'il n'écrit rien alors que des instruments ont
  été lus : un run vert qui ne prouve rien est le défaut déjà payé sur les
  emails (CLAUDE.md §9).
- `/admin/coherence` : `requirePermission` comme les autres pages admin,
  tableau groupé par règle, compteur par gravité, lien vers la fiche.
- La duplication frontend/scraper est **assumée et commentée** : deux paquets
  TS distincts, pas de module partagé. Toute correction se reporte des deux
  côtés.
