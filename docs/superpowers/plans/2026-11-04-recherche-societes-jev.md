# Recherche en langage naturel parmi les sociétés (Jev) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un abonné éligible tape une recherche en français sur `/societes` et obtient les sociétés cotées classées par Jev, avec les faits qui justifient le classement ; tout échec retombe sur une recherche par mots-clés prévisible.

**Architecture:** Modules purs dans `frontend/lib/recherche/` (normalisation, instantané des faits, dictionnaire, repli, statut, validation de Jev, orchestration par injection de dépendances) ; adaptateurs serveur minces (`lib/server/`) pour Supabase, le cache Next et le garde de fonctionnalité ; une route POST qui ne fait qu'assembler ; un composant client. Budget et verrou garantis par deux fonctions SQL atomiques.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Supabase (PostgREST + RPC), vitest, API TypeSafe `POST /v1/systemone` (contrat relevé dans le source MIT de `FrancoisChastel/jev-code` : `src/tools/rank.ts`, `src/core/client.ts`, `src/core/wires.ts`).

**Plan en deux fichiers :** ce document (tâches 0 à 5, modules purs) et `2026-11-04-recherche-societes-jev-partie-2.md` (tâches 6 à 12 : migration, chargeurs, route, interface, RGPD, évaluation).

**Convention d'extraction :** chaque bloc précédé de `<!-- fichier: chemin -->` est le contenu COMPLET de ce fichier (chemin relatif à la racine du dépôt).

---

## Écarts assumés par rapport à la spécification v2 (reportés dans la spec, tâche 0)

1. **Fait `activite`** (banque / assurance, depuis `brvm_instruments.famille_comptable`) : les 17 « Services financiers » mêlent banques et assurances ; sans ce fait, « une banque » remonterait des assureurs.
2. **Rendement à base inconnue affiché** « (base fiscale non précisée) » au lieu d'être omis : 222 dividendes sur 267 sont en base `inconnu` ; la règle « double IRVM » interdit de *calculer un net* sur une base inconnue, pas d'afficher le rendement publié.
3. **Note A–F retirée des fiches** : ses libellés sont « Achat très fort / Achat / Vente » ; la donner à Jev ferait de « quelle action acheter ? » une recommandation déguisée.
4. **Ordre du flux** : verrou → quota → budget : une recherche qui attend le résultat d'une autre ne consomme pas de quota.
5. **Modules `orchestrer.ts`** (logique de la route, injectable, testable) et **`sequenceur.ts`** (ordre des réponses dans l'interface).
6. **`donnees_indisponibles`** : réponse vide en mode mots-clés (statut `aucune`), jamais d'erreur 503.

---

### Task 0 : reporter les écarts dans la spécification

**Files:** Modify `docs/superpowers/specs/2026-11-04-recherche-societes-jev-design.md`

- [ ] **Step 1:** Ajouter sous « Statut » une section « Écarts décidés au plan (2026-11-04) » reprenant les six points ci-dessus ; dans le tableau des faits, remplacer la ligne `note` par `activite` et la règle du rendement par « base inconnue → affiché avec “(base fiscale non précisée)” ».
- [ ] **Step 2:** Commit `docs(spec): recherche — écarts décidés au plan`.

### Task 1 : types et normalisation

**Files:** Create `frontend/lib/recherche/types.ts`, `frontend/lib/recherche/normaliser.ts`; Test `frontend/lib/recherche/normaliser.test.ts`

<!-- fichier: frontend/lib/recherche/types.ts -->
```ts
/** Contrat de la recherche en langage naturel parmi les sociétés. */

export type CleFait = 'activite' | 'secteur' | 'pays' | 'rendement' | 'liquidite' | 'perf12m';

export interface FaitSociete {
  cle: CleFait;
  libelle: string;
  valeur: string;
}

export interface FicheSociete {
  code: string;
  nom: string;
  faits: FaitSociete[];
  /** Texte envoyé à Jev : uniquement des faits en base. */
  texte: string;
}

export interface Instantane {
  /** Date de séance + empreinte des fiches : change dès qu'un fait change. */
  snapshotId: string;
  /** AAAA-MM-JJ, date de la séance. */
  actualiseLe: string;
  fiches: FicheSociete[];
}

export type ModeRecherche = 'jev' | 'mots-cles';

export type RaisonRepli =
  | 'non_connecte'
  | 'offre_non_eligible'
  | 'quota_atteint'
  | 'plafond_atteint'
  | 'compteur_indisponible'
  | 'jev_indisponible'
  | 'donnees_indisponibles';

export type StatutRecherche = 'correspondance' | 'partielle' | 'aucune';

export interface ResultatRecherche {
  code: string;
  nom: string;
  score: number;
  faits: FaitSociete[];
}

export interface ReponseRecherche {
  mode: ModeRecherche;
  /** null ⇔ mode 'jev'. */
  raison: RaisonRepli | null;
  cache: boolean;
  statut: StatutRecherche;
  resultats: ResultatRecherche[];
  snapshotId: string | null;
  actualiseLe: string | null;
}

/** Réponse de Jev après validation : un score par code, plus la pertinence globale. */
export interface ResultatJevValide {
  scores: Record<string, number>;
  pertinenceGlobale: number;
  modele: string;
}

export interface CleCache {
  empreinte: string;
  snapshotId: string;
}
```

<!-- fichier: frontend/lib/recherche/normaliser.test.ts -->
```ts
import { describe, it, expect } from 'vitest';
import { contientDonneePersonnelle, empreinte, hacherIdentifiant, normaliser, validerRequete } from './normaliser';

describe('normalisation de la requête', () => {
  it('ignore accents, casse, ponctuation et espaces superflus', () => {
    expect(normaliser('  Une BANQUE  ivoirienne, qui verse… un dividende ! ')).toBe('une banque ivoirienne qui verse un dividende');
    expect(normaliser("Télécoms d'Afrique")).toBe('telecoms d afrique');
  });

  it('même requête, même empreinte ; requête différente, empreinte différente', () => {
    expect(empreinte('Banque  Sénégalaise')).toBe(empreinte('banque senegalaise'));
    expect(empreinte('banque senegalaise')).not.toBe(empreinte('banque ivoirienne'));
    expect(empreinte('x')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('détecte e-mails et numéros de téléphone, pas les montants', () => {
    expect(contientDonneePersonnelle('écrire à jean.dupont@gmail.com')).toBe(true);
    expect(contientDonneePersonnelle('appelez le +225 07 08 09 10 11')).toBe(true);
    expect(contientDonneePersonnelle('rendement de 6 % et 1 000 000 FCFA')).toBe(false);
  });

  it('borne la longueur et refuse les données personnelles', () => {
    expect(validerRequete('ab')).toEqual({ ok: false, erreur: 'longueur' });
    expect(validerRequete('x'.repeat(151))).toEqual({ ok: false, erreur: 'longueur' });
    expect(validerRequete(42)).toEqual({ ok: false, erreur: 'longueur' });
    expect(validerRequete('contact: a@b.ci')).toEqual({ ok: false, erreur: 'donnee_personnelle' });
    expect(validerRequete('  une banque  ')).toEqual({ ok: true, q: 'une banque' });
  });

  it('hache un identifiant de compte sans le révéler', () => {
    const h = hacherIdentifiant('3f1c-uuid');
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).not.toContain('3f1c');
  });
});
```

<!-- fichier: frontend/lib/recherche/normaliser.ts -->
```ts
import { createHash } from 'node:crypto';

export const LONGUEUR_MIN = 3;
export const LONGUEUR_MAX = 150;

/** Minuscules, sans accents, ponctuation remplacée par une espace, espaces réduites. */
export function normaliser(q: string): string {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Clé de cache : seule l'empreinte est stockée, jamais le texte. */
export function empreinte(q: string): string {
  return createHash('sha256').update(normaliser(q)).digest('hex');
}

/** Clé de quota : l'identifiant du compte n'est jamais stocké en clair. */
export function hacherIdentifiant(id: string): string {
  return createHash('sha256').update(`recherche-societes:${id}`).digest('hex').slice(0, 32);
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
// Huit chiffres ou plus, séparateurs usuels admis : un numéro de téléphone.
const TELEPHONE = /(?:\+|00)?\d(?:[\s.\-()]*\d){7,}/;
// Un montant usuel (« 1 000 000 ») n'est pas un numéro : groupes de trois chiffres.
const MONTANT = /\b\d{1,3}(?:[   ]\d{3})+\b/g;

export function contientDonneePersonnelle(q: string): boolean {
  if (EMAIL.test(q)) return true;
  return TELEPHONE.test(q.replace(MONTANT, ' '));
}

export type RequeteValidee = { ok: true; q: string } | { ok: false; erreur: 'longueur' | 'donnee_personnelle' };

export function validerRequete(q: unknown): RequeteValidee {
  if (typeof q !== 'string') return { ok: false, erreur: 'longueur' };
  const t = q.trim();
  if (t.length < LONGUEUR_MIN || t.length > LONGUEUR_MAX) return { ok: false, erreur: 'longueur' };
  if (contientDonneePersonnelle(t)) return { ok: false, erreur: 'donnee_personnelle' };
  return { ok: true, q: t };
}
```

- [ ] **Step 1:** Extraire le test ; `cd frontend && npx vitest run lib/recherche/normaliser.test.ts` → FAIL (module absent).
- [ ] **Step 2:** Extraire `types.ts` et `normaliser.ts` ; relancer → PASS (5).
- [ ] **Step 3:** Commit `feat(recherche): types et normalisation de la requête`.

### Task 2 : instantané des faits

**Files:** Create `frontend/lib/recherche/instantane.ts`; Test `frontend/lib/recherche/instantane.test.ts`

<!-- fichier: frontend/lib/recherche/instantane.test.ts -->
```ts
import { describe, it, expect } from 'vitest';
import { construireFiche, construireInstantane, type DonneesSociete } from './instantane';

const base: DonneesSociete = {
  code: 'SNTS',
  nom: 'Sonatel',
  secteur: 'Télécommunications',
  activite: null,
  pays: 'SN',
  rendement: { valeur: 6.12, base: 'net' },
  liquidite: 'A',
  perf12m: 8.44,
};

describe('fiche-faits', () => {
  it('écrit chaque fait connu, dans l’ordre, en français', () => {
    const f = construireFiche(base);
    expect(f.texte).toBe(
      'SNTS — Sonatel. Secteur : Télécommunications. Pays : Sénégal. Rendement du dividende : 6,1 % (net). Liquidité : classe A. Performance sur 12 mois : +8,4 %.',
    );
    expect(f.faits.map((x) => x.cle)).toEqual(['secteur', 'pays', 'rendement', 'liquidite', 'perf12m']);
  });

  it('omet un fait absent au lieu de le supposer', () => {
    const f = construireFiche({ ...base, rendement: null, perf12m: null, liquidite: null, secteur: null });
    expect(f.texte).toBe('SNTS — Sonatel. Pays : Sénégal.');
    expect(f.faits.some((x) => x.cle === 'perf12m')).toBe(false);
  });

  it('dit la base fiscale inconnue, signe une baisse, nomme l’activité', () => {
    const f = construireFiche({ ...base, activite: 'banque', rendement: { valeur: 7, base: 'non_precisee' }, perf12m: -3.25 });
    expect(f.texte).toContain('Activité : banque.');
    expect(f.texte).toContain('7,0 % (base fiscale non précisée)');
    expect(f.texte).toContain('−3,3 %');
  });
});

describe('instantané', () => {
  it('mêmes données, même identifiant, quel que soit l’ordre', () => {
    const autre = { ...base, code: 'ORAC', nom: 'Orange CI', pays: 'CI' };
    expect(construireInstantane([base, autre], '2026-11-04').snapshotId).toBe(construireInstantane([autre, base], '2026-11-04').snapshotId);
  });

  it('un fait qui change ou une nouvelle séance change l’identifiant', () => {
    const a = construireInstantane([base], '2026-11-04');
    expect(construireInstantane([{ ...base, perf12m: 9 }], '2026-11-04').snapshotId).not.toBe(a.snapshotId);
    expect(construireInstantane([base], '2026-11-05').snapshotId).not.toBe(a.snapshotId);
    expect(a.snapshotId).toMatch(/^2026-11-04\.[0-9a-f]{12}$/);
    expect(a.actualiseLe).toBe('2026-11-04');
  });
});
```

<!-- fichier: frontend/lib/recherche/instantane.ts -->
```ts
import { createHash } from 'node:crypto';
import type { CleFait, FaitSociete, FicheSociete, Instantane } from './types';

/** Faits d'une société tels que lus en base ; null = inconnu (jamais supposé). */
export interface DonneesSociete {
  code: string;
  nom: string;
  secteur: string | null;
  /** `brvm_instruments.famille_comptable` quand elle distingue banque et assurance. */
  activite: 'banque' | 'assurance' | null;
  /** Code pays BRVM (CI, SN…). */
  pays: string | null;
  rendement: { valeur: number; base: 'net' | 'non_precisee' } | null;
  liquidite: 'A' | 'B' | 'C' | 'D' | null;
  perf12m: number | null;
}

const NOMS_PAYS: Record<string, string> = {
  CI: "Côte d'Ivoire",
  SN: 'Sénégal',
  BF: 'Burkina Faso',
  ML: 'Mali',
  BJ: 'Bénin',
  TG: 'Togo',
  NE: 'Niger',
  GW: 'Guinée-Bissau',
};

const decimal = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function construireFiche(d: DonneesSociete): FicheSociete {
  const faits: FaitSociete[] = [];
  const ajouter = (cle: CleFait, libelle: string, valeur: string | null) => {
    if (valeur) faits.push({ cle, libelle, valeur });
  };
  ajouter('activite', 'Activité', d.activite);
  ajouter('secteur', 'Secteur', d.secteur?.trim() || null);
  ajouter('pays', 'Pays', d.pays ? NOMS_PAYS[d.pays] ?? d.pays : null);
  ajouter(
    'rendement',
    'Rendement du dividende',
    d.rendement && Number.isFinite(d.rendement.valeur) && d.rendement.valeur >= 0
      ? `${decimal(d.rendement.valeur)} % (${d.rendement.base === 'net' ? 'net' : 'base fiscale non précisée'})`
      : null,
  );
  ajouter('liquidite', 'Liquidité', d.liquidite ? `classe ${d.liquidite}` : null);
  ajouter(
    'perf12m',
    'Performance sur 12 mois',
    d.perf12m != null && Number.isFinite(d.perf12m) ? `${d.perf12m >= 0 ? '+' : '−'}${decimal(Math.abs(d.perf12m))} %` : null,
  );
  const texte = [`${d.code} — ${d.nom}.`, ...faits.map((f) => `${f.libelle} : ${f.valeur}.`)].join(' ');
  return { code: d.code, nom: d.nom, faits, texte };
}

export function construireInstantane(donnees: DonneesSociete[], dateSeance: string): Instantane {
  const fiches = [...donnees].sort((a, b) => a.code.localeCompare(b.code)).map(construireFiche);
  const h = createHash('sha256')
    .update(`${dateSeance}\n${fiches.map((f) => f.texte).join('\n')}`)
    .digest('hex')
    .slice(0, 12);
  return { snapshotId: `${dateSeance}.${h}`, actualiseLe: dateSeance, fiches };
}
```

- [ ] **Step 1:** Extraire le test → FAIL. **Step 2:** extraire le module → PASS (5). **Step 3:** commit `feat(recherche): instantané des faits par société`.

### Task 3 : dictionnaire, statut et repli par mots-clés

**Files:** Create `frontend/lib/recherche/dictionnaire.ts`, `frontend/lib/recherche/decision.ts`, `frontend/lib/recherche/motsCles.ts`; Test `frontend/lib/recherche/motsCles.test.ts`

<!-- fichier: frontend/lib/recherche/dictionnaire.ts -->
```ts
import type { CleFait } from './types';

/** À incrémenter à chaque changement : l'évaluation note la version mesurée. */
export const VERSION_DICTIONNAIRE = '2026-11-04.1';

/** Une expression renvoie soit à un champ (phrase normalisée à y trouver), soit à la présence d'un fait. */
export type Cible = { champ: 'activite' | 'secteur' | 'pays'; jetons: string[] } | { fait: CleFait };

const secteur = (...jetons: string[]): Cible[] => [{ champ: 'secteur', jetons }];
const pays = (phrase: string): Cible[] => [{ champ: 'pays', jetons: [phrase] }];
const activite = (valeur: 'banque' | 'assurance'): Cible[] => [{ champ: 'activite', jetons: [valeur] }];
const fait = (cle: CleFait): Cible[] => [{ fait: cle }];

/** Clés = mots NORMALISÉS (sans accents, minuscules). */
export const DICTIONNAIRE: Record<string, Cible[]> = {
  banque: activite('banque'),
  banques: activite('banque'),
  bancaire: activite('banque'),
  bancaires: activite('banque'),
  assurance: activite('assurance'),
  assurances: activite('assurance'),
  assureur: activite('assurance'),
  assureurs: activite('assurance'),
  telecom: secteur('telecommunications'),
  telecoms: secteur('telecommunications'),
  telecommunication: secteur('telecommunications'),
  telecommunications: secteur('telecommunications'),
  operateur: secteur('telecommunications'),
  operateurs: secteur('telecommunications'),
  telephonie: secteur('telecommunications'),
  telephonique: secteur('telecommunications'),
  energie: secteur('energie'),
  petrole: secteur('energie'),
  petrolier: secteur('energie'),
  petroliere: secteur('energie'),
  carburant: secteur('energie'),
  industrie: secteur('industriels'),
  industriel: secteur('industriels'),
  industrielle: secteur('industriels'),
  industriels: secteur('industriels'),
  agroalimentaire: secteur('consommation de base'),
  alimentaire: secteur('consommation de base'),
  agricole: secteur('consommation de base'),
  eau: secteur('services publics'),
  electricite: secteur('services publics'),
  financier: secteur('services financiers'),
  financiere: secteur('services financiers'),
  financiers: secteur('services financiers'),
  finance: secteur('services financiers'),
  dividende: fait('rendement'),
  dividendes: fait('rendement'),
  rendement: fait('rendement'),
  distribue: fait('rendement'),
  liquide: fait('liquidite'),
  liquides: fait('liquidite'),
  liquidite: fait('liquidite'),
  echangee: fait('liquidite'),
  performance: fait('perf12m'),
  ivoire: pays('cote d ivoire'),
  ivoirien: pays('cote d ivoire'),
  ivoirienne: pays('cote d ivoire'),
  senegal: pays('senegal'),
  senegalais: pays('senegal'),
  senegalaise: pays('senegal'),
  burkina: pays('burkina faso'),
  burkinabe: pays('burkina faso'),
  mali: pays('mali'),
  malien: pays('mali'),
  malienne: pays('mali'),
  benin: pays('benin'),
  beninois: pays('benin'),
  beninoise: pays('benin'),
  togo: pays('togo'),
  togolais: pays('togo'),
  togolaise: pays('togo'),
  niger: pays('niger'),
  nigerien: pays('niger'),
  nigerienne: pays('niger'),
};

/** Mots qui n'informent pas la recherche. */
export const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'au', 'aux', 'en', 'dans', 'pour', 'avec',
  'qui', 'que', 'quoi', 'est', 'sont', 'sur', 'par', 'plus', 'tres', 'bon', 'bonne', 'bons', 'bonnes', 'gros',
  'grosse', 'fort', 'forte', 'eleve', 'elevee', 'eleves', 'elevees', 'societe', 'societes', 'entreprise',
  'entreprises', 'action', 'actions', 'valeur', 'valeurs', 'titre', 'titres', 'je', 'cherche', 'veux', 'mais',
  'verse', 'versent', 'an', 'secteur', 'cote', 'mois', '12',
]);

/** Le mot significatif qui SUIT une négation est exclu, pas favorisé. */
export const NEGATIONS = new Set(['hors', 'sauf', 'sans', 'ni', 'pas', 'non', 'excepte']);
```

<!-- fichier: frontend/lib/recherche/decision.ts -->
```ts
import type { FicheSociete, ResultatJevValide, ResultatRecherche, StatutRecherche } from './types';

export const SEUIL_PERTINENT = 0.5;
export const MAX_RESULTATS = 8;
export const MIN_CORRESPONDANCE = 3;

export function statutParNombre(n: number): StatutRecherche {
  if (n === 0) return 'aucune';
  return n < MIN_CORRESPONDANCE ? 'partielle' : 'correspondance';
}

const arrondi = (x: number) => Math.round(x * 100) / 100;

/** Pertinence globale < 0,5 ⇒ aucune société imposée ; sinon les scores ≥ 0,5, triés, 8 au plus. */
export function resultatsJev(v: ResultatJevValide, fiches: FicheSociete[]): { statut: StatutRecherche; resultats: ResultatRecherche[] } {
  if (v.pertinenceGlobale < SEUIL_PERTINENT) return { statut: 'aucune', resultats: [] };
  const resultats = fiches
    .filter((f) => (v.scores[f.code] ?? 0) >= SEUIL_PERTINENT)
    .sort((a, b) => (v.scores[b.code] ?? 0) - (v.scores[a.code] ?? 0) || a.code.localeCompare(b.code))
    .slice(0, MAX_RESULTATS)
    .map((f) => ({ code: f.code, nom: f.nom, score: arrondi(v.scores[f.code] ?? 0), faits: f.faits }));
  return { statut: statutParNombre(resultats.length), resultats };
}
```

<!-- fichier: frontend/lib/recherche/motsCles.test.ts -->
```ts
import { describe, it, expect } from 'vitest';
import { construireFiche, type DonneesSociete } from './instantane';
import { rechercheMotsCles, termes } from './motsCles';
import { resultatsJev, statutParNombre } from './decision';

const d = (o: Partial<DonneesSociete> & { code: string; nom: string }): DonneesSociete => ({
  secteur: null, activite: null, pays: null, rendement: null, liquidite: null, perf12m: null, ...o,
});
const fiches = [
  d({ code: 'SGBC', nom: 'Société Générale CI', secteur: 'Services financiers', activite: 'banque', pays: 'CI', rendement: { valeur: 8, base: 'net' }, liquidite: 'B' }),
  d({ code: 'BOAS', nom: 'Bank of Africa Sénégal', secteur: 'Services financiers', activite: 'banque', pays: 'SN', liquidite: 'C' }),
  d({ code: 'SNTS', nom: 'Sonatel', secteur: 'Télécommunications', pays: 'SN', rendement: { valeur: 6, base: 'non_precisee' }, liquidite: 'A' }),
  d({ code: 'SAFC', nom: 'Saham Assurance CI', secteur: 'Services financiers', activite: 'assurance', pays: 'CI' }),
  d({ code: 'TTLC', nom: 'TotalEnergies CI', secteur: 'Énergie', pays: 'CI', rendement: { valeur: 5, base: 'net' } }),
].map(construireFiche);

describe('repli par mots-clés', () => {
  it('rapproche les synonymes métier', () => {
    expect(rechercheMotsCles('établissement bancaire', fiches).resultats.map((r) => r.code)).toEqual(['BOAS', 'SGBC']);
    expect(rechercheMotsCles('opérateur téléphonique', fiches).resultats.map((r) => r.code)).toEqual(['SNTS']);
    expect(rechercheMotsCles('un assureur', fiches).resultats.map((r) => r.code)).toEqual(['SAFC']);
  });

  it('cumule les contraintes et classe par score puis par code', () => {
    expect(rechercheMotsCles('banque ivoirienne qui verse un dividende', fiches).resultats[0]!.code).toBe('SGBC');
  });

  it('une négation exclut au lieu de favoriser', () => {
    const r = rechercheMotsCles('société ivoirienne hors banques', fiches).resultats.map((x) => x.code);
    expect(r).not.toContain('SGBC');
    expect(r).toContain('TTLC');
    expect(rechercheMotsCles('pas de banque', fiches).resultats).toEqual([]);
  });

  it('le code et le nom pèsent plus que les autres faits', () => {
    expect(rechercheMotsCles('sonatel', fiches).resultats[0]!.code).toBe('SNTS');
    expect(rechercheMotsCles('SNTS', fiches).resultats[0]!.score).toBe(1);
  });

  it('aucun résultat de score nul ; requête sans écho ⇒ statut aucune', () => {
    const r = rechercheMotsCles('cryptomonnaie lunaire', fiches);
    expect(r.resultats).toEqual([]);
    expect(r.statut).toBe('aucune');
  });

  it('isole les termes et repère la négation', () => {
    expect(termes('banque hors du Sénégal')).toEqual([
      { mot: 'banque', nie: false },
      { mot: 'senegal', nie: true },
    ]);
  });
});

describe('statut', () => {
  it('par nombre de résultats', () => {
    expect([0, 1, 2, 3].map(statutParNombre)).toEqual(['aucune', 'partielle', 'partielle', 'correspondance']);
  });

  it('Jev : pertinence globale basse ⇒ aucune société imposée', () => {
    expect(resultatsJev({ scores: { SNTS: 0.9 }, pertinenceGlobale: 0.3, modele: 'm' }, fiches)).toEqual({ statut: 'aucune', resultats: [] });
  });

  it('Jev : scores ≥ 0,5, triés, égalités par code', () => {
    const r = resultatsJev({ scores: { SNTS: 0.8, BOAS: 0.8, SGBC: 0.95, TTLC: 0.2, SAFC: 0.5 }, pertinenceGlobale: 0.9, modele: 'm' }, fiches);
    expect(r.resultats.map((x) => x.code)).toEqual(['SGBC', 'BOAS', 'SNTS', 'SAFC']);
    expect(r.statut).toBe('correspondance');
  });
});
```

<!-- fichier: frontend/lib/recherche/motsCles.ts -->
```ts
import { DICTIONNAIRE, MOTS_VIDES, NEGATIONS } from './dictionnaire';
import { MAX_RESULTATS, statutParNombre } from './decision';
import { normaliser } from './normaliser';
import type { CleFait, FicheSociete, ResultatRecherche, StatutRecherche } from './types';

/**
 * Recherche simple, modeste et PRÉVISIBLE : elle ne cherche pas à imiter Jev.
 * Pondération : code > nom > secteur / activité / pays > autres faits.
 */
const POIDS = { code: 5, nom: 3, secteur: 2, activite: 2, pays: 2, autre: 1 } as const;
type Champ = keyof typeof POIDS;

export interface Terme {
  mot: string;
  nie: boolean;
}

export function termes(q: string): Terme[] {
  const out: Terme[] = [];
  let nier = false;
  for (const mot of normaliser(q).split(' ')) {
    if (!mot) continue;
    if (NEGATIONS.has(mot)) {
      nier = true;
      continue;
    }
    if (MOTS_VIDES.has(mot) || mot.length < 2) continue;
    out.push({ mot, nie: nier });
    nier = false;
  }
  return out;
}

interface FicheIndexee {
  fiche: FicheSociete;
  champs: Record<Champ, string>;
  faits: Set<CleFait>;
}

function indexer(fiche: FicheSociete): FicheIndexee {
  const valeur = (cle: CleFait) => normaliser(fiche.faits.find((f) => f.cle === cle)?.valeur ?? '');
  return {
    fiche,
    champs: {
      code: normaliser(fiche.code),
      nom: normaliser(fiche.nom),
      secteur: valeur('secteur'),
      activite: valeur('activite'),
      pays: valeur('pays'),
      autre: fiche.faits
        .filter((f) => !['secteur', 'activite', 'pays'].includes(f.cle))
        .map((f) => normaliser(f.valeur))
        .join(' '),
    },
    faits: new Set(fiche.faits.map((f) => f.cle)),
  };
}

const contient = (champ: string, jeton: string) => champ !== '' && ` ${champ} `.includes(` ${jeton} `);

function poids(mot: string, f: FicheIndexee): number {
  const cibles = DICTIONNAIRE[mot];
  if (cibles) {
    let meilleur = 0;
    for (const c of cibles) {
      if ('fait' in c) {
        if (f.faits.has(c.fait)) meilleur = Math.max(meilleur, POIDS.autre);
      } else if (c.jetons.some((j) => contient(f.champs[c.champ], j))) {
        meilleur = Math.max(meilleur, POIDS[c.champ]);
      }
    }
    return meilleur;
  }
  for (const champ of ['code', 'nom', 'secteur', 'activite', 'pays', 'autre'] as const) {
    if (contient(f.champs[champ], mot)) return POIDS[champ];
  }
  return 0;
}

export function rechercheMotsCles(q: string, fiches: FicheSociete[]): { statut: StatutRecherche; resultats: ResultatRecherche[] } {
  const ts = termes(q);
  const positifs = ts.filter((t) => !t.nie);
  const negatifs = ts.filter((t) => t.nie);
  const notes = fiches
    .map(indexer)
    .filter((f) => !negatifs.some((t) => poids(t.mot, f) > 0))
    .map((f) => ({ f, s: positifs.reduce((acc, t) => acc + poids(t.mot, f), 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.fiche.code.localeCompare(b.f.fiche.code));
  const max = notes[0]?.s ?? 1;
  const resultats = notes.slice(0, MAX_RESULTATS).map(({ f, s }) => ({
    code: f.fiche.code,
    nom: f.fiche.nom,
    score: Math.round((s / max) * 100) / 100,
    faits: f.fiche.faits,
  }));
  return { statut: statutParNombre(resultats.length), resultats };
}
```

- [ ] **Step 1:** Extraire le test → FAIL. **Step 2:** extraire les trois modules → PASS (9). **Step 3:** commit `feat(recherche): repli par mots-clés à dictionnaire métier`.

### Task 4 : validation de Jev, requête TypeSafe, séquenceur

**Files:** Create `frontend/lib/recherche/validerJev.ts`, `frontend/lib/recherche/jev.ts`, `frontend/lib/recherche/sequenceur.ts`; Test `frontend/lib/recherche/jev.test.ts`

<!-- fichier: frontend/lib/recherche/jev.test.ts -->
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { validerReponseJev } from './validerJev';
import { classerParJev, construireRequeteJev, CLE_GLOBALE } from './jev';
import { Sequenceur } from './sequenceur';
import type { FicheSociete } from './types';

const fiches: FicheSociete[] = [
  { code: 'SNTS', nom: 'Sonatel', faits: [], texte: 'SNTS — Sonatel.' },
  { code: 'SGBC', nom: 'SGCI', faits: [], texte: 'SGBC — SGCI.' },
];
const noul = (p: unknown) => ({ type: 'noul', noul: p });
const ok = { model: 'jev-1', answers: { SNTS: noul(0.9), SGBC: noul(0.1), [CLE_GLOBALE]: noul(0.8) } };

describe('validation de la réponse de Jev', () => {
  it('accepte une réponse complète et cohérente', () => {
    expect(validerReponseJev(ok, ['SNTS', 'SGBC'])).toEqual({ scores: { SNTS: 0.9, SGBC: 0.1 }, pertinenceGlobale: 0.8, modele: 'jev-1' });
  });

  it.each([
    ['code inconnu', { answers: { ...ok.answers, XXXX: noul(0.5) } }],
    ['doublon de casse', { answers: { ...ok.answers, snts: noul(0.5) } }],
    ['score hors [0,1]', { answers: { ...ok.answers, SNTS: noul(1.2) } }],
    ['score NaN', { answers: { ...ok.answers, SNTS: noul(Number.NaN) } }],
    ['score non numérique', { answers: { ...ok.answers, SNTS: noul('0.9') } }],
    ['code manquant', { answers: { SNTS: noul(0.9), [CLE_GLOBALE]: noul(0.8) } }],
    ['pertinence globale absente', { answers: { SNTS: noul(0.9), SGBC: noul(0.1) } }],
    ['mauvais type de question', { answers: { ...ok.answers, SNTS: { type: 'score', score: 0.9 } } }],
    ['corps sans answers', { model: 'x' }],
    ['corps nul', null],
  ])('rejette : %s', (_nom, brut) => {
    expect(validerReponseJev(brut, ['SNTS', 'SGBC'])).toBeNull();
  });
});

describe('requête TypeSafe', () => {
  afterEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  it('pose une question oui/non par société et une question globale', () => {
    const r = construireRequeteJev('une banque', fiches, 'jev-latest');
    expect(r.state).toEqual({ query: 'une banque', candidates: { SNTS: 'SNTS — Sonatel.', SGBC: 'SGBC — SGCI.' } });
    expect(Object.keys(r.questions).sort()).toEqual([CLE_GLOBALE, 'SGBC', 'SNTS'].sort());
    expect(r.questions.SNTS!.type).toBe('noul');
    expect(r.questions.SNTS!.instructions).toContain('`candidates.SNTS`');
  });

  it('envoie la clé en Bearer, jamais dans le corps', async () => {
    process.env.TYPESAFE_API_KEY = 'apikey_test';
    const vus: { url: string; init: RequestInit }[] = [];
    const fauxFetch = async (url: string, init?: RequestInit) => {
      vus.push({ url, init: init! });
      return new Response(JSON.stringify(ok), { status: 200 });
    };
    await classerParJev('une banque', fiches, new AbortController().signal, fauxFetch);
    const vu = vus[0]!;
    expect(vu.url).toBe('https://api.typesafe.ai/v1/systemone');
    expect((vu.init.headers as Record<string, string>).Authorization).toBe('Bearer apikey_test');
    expect(String(vu.init.body)).not.toContain('apikey_test');
  });

  it('échoue proprement sans clé ou sur erreur HTTP, sans citer la requête', async () => {
    await expect(classerParJev('secret q', fiches, new AbortController().signal)).rejects.toThrow('jev_cle_absente');
    process.env.TYPESAFE_API_KEY = 'k';
    const erreur500 = async () => new Response('boom', { status: 500 });
    await expect(classerParJev('secret q', fiches, new AbortController().signal, erreur500)).rejects.toThrow(/^jev_http_500$/);
  });
});

describe('séquenceur de l’interface', () => {
  it('seule la dernière recherche lancée est courante', () => {
    const s = new Sequenceur();
    const a = s.suivante();
    const b = s.suivante();
    expect(s.estCourante(a)).toBe(false);
    expect(s.estCourante(b)).toBe(true);
  });
});
```

<!-- fichier: frontend/lib/recherche/validerJev.ts -->
```ts
import { CLE_GLOBALE } from './jev';
import type { ResultatJevValide } from './types';

const probabilite = (reponse: unknown): number | null => {
  if (!reponse || typeof reponse !== 'object') return null;
  const r = reponse as { type?: unknown; noul?: unknown };
  if (r.type !== 'noul' || typeof r.noul !== 'number' || !Number.isFinite(r.noul) || r.noul < 0 || r.noul > 1) return null;
  return r.noul;
};

/**
 * Une réponse du fournisseur n'est utilisée que si elle est COMPLÈTE et
 * COHÉRENTE : chaque code attendu, aucun autre, aucune variante de casse,
 * chaque probabilité finie dans [0, 1]. Sinon : null, et la route se replie.
 */
export function validerReponseJev(brut: unknown, codes: readonly string[]): ResultatJevValide | null {
  if (!brut || typeof brut !== 'object') return null;
  const { answers, model } = brut as { answers?: unknown; model?: unknown };
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const attendus = new Set(codes);
  const vus = new Set<string>();
  const scores: Record<string, number> = {};
  let globale: number | null = null;
  for (const [cle, reponse] of Object.entries(answers as Record<string, unknown>)) {
    const p = probabilite(reponse);
    if (p === null) return null;
    if (cle === CLE_GLOBALE) {
      globale = p;
      continue;
    }
    if (!attendus.has(cle)) return null;
    const k = cle.toUpperCase();
    if (vus.has(k)) return null;
    vus.add(k);
    scores[cle] = p;
  }
  if (globale === null || vus.size !== attendus.size) return null;
  return { scores, pertinenceGlobale: globale, modele: typeof model === 'string' ? model : 'inconnu' };
}
```

<!-- fichier: frontend/lib/recherche/jev.ts -->
```ts
import type { FicheSociete } from './types';

/**
 * Appel de Jev (TypeSafe) en mode « rank » : une question oui/non par
 * société, plus une question globale. Contrat relevé dans le source MIT de
 * FrancoisChastel/jev-code (src/tools/rank.ts, src/core/client.ts).
 * Serveur uniquement : la clé est lue dans l'environnement à l'appel.
 */
export const CLE_GLOBALE = '__any_relevant';
const BASE_URL = 'https://api.typesafe.ai';

interface QuestionNoul {
  type: 'noul';
  instructions: string;
  criteria?: { true: string; false: string };
}

export interface RequeteJev {
  model: string;
  state: { query: string; candidates: Record<string, string> };
  questions: Record<string, QuestionNoul>;
}

export function construireRequeteJev(q: string, fiches: FicheSociete[], modele: string): RequeteJev {
  const questions: Record<string, QuestionNoul> = {};
  for (const f of fiches) {
    questions[f.code] = {
      type: 'noul',
      instructions: `La société décrite par \`candidates.${f.code}\` correspond-elle à ce que cherche \`query\` ? Juge cette société seule, uniquement d'après les faits écrits.`,
      criteria: {
        true: 'Les faits écrits de la société répondent à la recherche',
        false: 'La société ne répond pas à la recherche, ou ne partage que des mots en surface',
      },
    };
  }
  questions[CLE_GLOBALE] = {
    type: 'noul',
    instructions: 'Au moins une société de `candidates` correspond-elle à ce que cherche `query`, d’après les faits écrits ?',
  };
  return {
    model: modele,
    state: { query: q, candidates: Object.fromEntries(fiches.map((f) => [f.code, f.texte])) },
    questions,
  };
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Renvoie le corps brut (à valider). Les erreurs ne portent qu'un code, jamais la requête. */
export async function classerParJev(
  q: string,
  fiches: FicheSociete[],
  signal: AbortSignal,
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): Promise<unknown> {
  const cle = process.env.TYPESAFE_API_KEY;
  if (!cle) throw new Error('jev_cle_absente');
  const requete = construireRequeteJev(q, fiches, process.env.TYPESAFE_DEFAULT_MODEL ?? 'jev-latest');
  const reponse = await fetchImpl(`${BASE_URL}/v1/systemone`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/json',
      'User-Agent': 'westbourse-recherche-societes',
    },
    body: JSON.stringify(requete),
    signal,
  });
  if (!reponse.ok) throw new Error(`jev_http_${reponse.status}`);
  return reponse.json();
}
```

<!-- fichier: frontend/lib/recherche/sequenceur.ts -->
```ts
/** Numérote les recherches : une réponse arrivée après une recherche plus récente est ignorée. */
export class Sequenceur {
  private dernier = 0;

  suivante(): number {
    this.dernier += 1;
    return this.dernier;
  }

  estCourante(id: number): boolean {
    return id === this.dernier;
  }
}
```

- [ ] **Step 1:** Extraire le test → FAIL. **Step 2:** extraire les trois modules → PASS (16). **Step 3:** commit `feat(recherche): requête TypeSafe, validation de la réponse, séquenceur`.

### Task 5 : orchestration et invariants métier

**Files:** Create `frontend/lib/recherche/orchestrer.ts`; Test `frontend/lib/recherche/orchestrer.test.ts`

<!-- fichier: frontend/lib/recherche/orchestrer.test.ts -->
```ts
import { describe, it, expect, vi } from 'vitest';
import { rechercher, type DepsRecherche, type EntreeCache, type StockageRecherche } from './orchestrer';
import { construireInstantane } from './instantane';
import { empreinte } from './normaliser';
import { CLE_GLOBALE } from './jev';
import type { CleCache, ResultatJevValide } from './types';

const instantane = construireInstantane(
  [
    { code: 'SGBC', nom: 'SGCI', secteur: 'Services financiers', activite: 'banque', pays: 'CI', rendement: null, liquidite: 'B', perf12m: null },
    { code: 'SNTS', nom: 'Sonatel', secteur: 'Télécommunications', activite: null, pays: 'SN', rendement: null, liquidite: 'A', perf12m: null },
  ],
  '2026-11-04',
);
const Q = 'une banque ivoirienne confidentielle';
const brutJev = { model: 'jev-1', answers: { SGBC: { type: 'noul', noul: 0.92 }, SNTS: { type: 'noul', noul: 0.04 }, [CLE_GLOBALE]: { type: 'noul', noul: 0.9 } } };

/** Stockage en mémoire, atomique comme les fonctions SQL. */
function memoire() {
  const lignes = new Map<string, EntreeCache>();
  const k = (c: CleCache) => `${c.empreinte}|${c.snapshotId}`;
  const s: StockageRecherche & { lignes: typeof lignes } = {
    lignes,
    lire: async (c) => lignes.get(k(c)) ?? null,
    verrouiller: async (c) => {
      if (lignes.has(k(c))) return false;
      lignes.set(k(c), { etat: 'en_cours', resultat: null });
      return true;
    },
    ecrire: async (c, r: ResultatJevValide) => {
      lignes.set(k(c), { etat: 'prete', resultat: r });
    },
    liberer: async (c) => {
      if (lignes.get(k(c))?.etat === 'en_cours') lignes.delete(k(c));
    },
  };
  return s;
}

function deps(o: Partial<DepsRecherche> = {}): DepsRecherche & { journaux: unknown[][] } {
  const journaux: unknown[][] = [];
  return {
    journaux,
    instantane: async () => instantane,
    utilisateur: async () => ({ id: 'u1', email: null }),
    eligible: async () => true,
    quota: async () => true,
    stockage: memoire(),
    reserverBudget: async () => 'ok',
    jev: vi.fn(async () => brutJev),
    attendre: (ms) => new Promise((r) => setTimeout(r, ms)),
    journal: (...args) => journaux.push(args),
    delaiJevMs: 200,
    attenteMs: 5,
    attenteEssais: 40,
    ...o,
  };
}

describe('recherche : flux nominal', () => {
  it('appelle Jev, valide, met en cache et renvoie les faits de l’instantané', async () => {
    const d = deps();
    const r = await rechercher(Q, d);
    expect(r).toMatchObject({ mode: 'jev', raison: null, cache: false, statut: 'partielle', snapshotId: instantane.snapshotId, actualiseLe: '2026-11-04' });
    expect(r.resultats.map((x) => x.code)).toEqual(['SGBC']);
    expect(r.resultats[0]!.faits).toEqual(instantane.fiches.find((f) => f.code === 'SGBC')!.faits);
    expect(d.jev).toHaveBeenCalledTimes(1);
  });
});

describe('recherche : invariants', () => {
  it('Accès — non connecté : mots-clés, Jev jamais appelé', async () => {
    const d = deps({ utilisateur: async () => null });
    expect(await rechercher(Q, d)).toMatchObject({ mode: 'mots-cles', raison: 'non_connecte' });
    expect(d.jev).not.toHaveBeenCalled();
  });

  it('Accès — compte non éligible : jamais de réponse Jev, même en cache', async () => {
    const d = deps({ eligible: async () => false });
    await d.stockage.ecrire({ empreinte: empreinte(Q), snapshotId: instantane.snapshotId }, { scores: { SGBC: 1, SNTS: 0 }, pertinenceGlobale: 1, modele: 'm' });
    const lire = vi.spyOn(d.stockage, 'lire');
    expect(await rechercher(Q, d)).toMatchObject({ mode: 'mots-cles', raison: 'offre_non_eligible', cache: false });
    expect(lire).not.toHaveBeenCalled();
  });

  it('Quota — une réponse en cache ne consomme ni quota ni budget', async () => {
    const quota = vi.fn(async () => true);
    const reserverBudget = vi.fn(async () => 'ok' as const);
    const d = deps({ quota, reserverBudget });
    await rechercher(Q, d);
    const r = await rechercher(Q, d);
    expect(r.cache).toBe(true);
    expect(quota).toHaveBeenCalledTimes(1);
    expect(reserverBudget).toHaveBeenCalledTimes(1);
    expect(d.jev).toHaveBeenCalledTimes(1);
  });

  it('Cache — recherches identiques simultanées : un seul appel Jev', async () => {
    let ouvrir!: () => void;
    const barriere = new Promise<void>((r) => (ouvrir = r));
    const jev = vi.fn(async () => {
      await barriere;
      return brutJev;
    });
    const d = deps({ jev });
    const lot = Promise.all([rechercher(Q, d), rechercher(Q, d), rechercher(Q, d)]);
    setTimeout(ouvrir, 30);
    const reponses = await lot;
    expect(jev).toHaveBeenCalledTimes(1);
    expect(reponses.every((r) => r.mode === 'jev')).toBe(true);
    expect(reponses.filter((r) => r.cache)).toHaveLength(2);
  });

  it('Versionnement — un nouvel instantané invalide l’ancien résultat', async () => {
    const d = deps();
    await d.stockage.ecrire({ empreinte: empreinte(Q), snapshotId: '2026-11-03.ancien' }, { scores: { SGBC: 0, SNTS: 1 }, pertinenceGlobale: 1, modele: 'm' });
    expect((await rechercher(Q, d)).cache).toBe(false);
    expect(d.jev).toHaveBeenCalledTimes(1);
  });

  it('Budget — plafond atteint ou compteur illisible : repli, verrou libéré', async () => {
    const d1 = deps({ reserverBudget: async () => 'refuse' });
    expect(await rechercher(Q, d1)).toMatchObject({ mode: 'mots-cles', raison: 'plafond_atteint' });
    expect((d1.stockage as ReturnType<typeof memoire>).lignes.size).toBe(0);
    const d2 = deps({
      reserverBudget: async () => {
        throw new Error('rpc');
      },
    });
    expect(await rechercher(Q, d2)).toMatchObject({ raison: 'compteur_indisponible' });
    expect(d2.jev).not.toHaveBeenCalled();
  });

  it('Quota atteint : repli, verrou libéré, budget intact', async () => {
    const reserverBudget = vi.fn(async () => 'ok' as const);
    const d = deps({ quota: async () => false, reserverBudget });
    expect(await rechercher(Q, d)).toMatchObject({ raison: 'quota_atteint' });
    expect(reserverBudget).not.toHaveBeenCalled();
    expect((d.stockage as ReturnType<typeof memoire>).lignes.size).toBe(0);
  });

  it.each([
    ['code inconnu', { answers: { ...brutJev.answers, XXXX: { type: 'noul', noul: 0.5 } } }],
    ['score invalide', { answers: { ...brutJev.answers, SGBC: { type: 'noul', noul: 7 } } }],
  ])('Fournisseur — %s : repli jev_indisponible', async (_n, brut) => {
    const d = deps({ jev: async () => brut });
    expect(await rechercher(Q, d)).toMatchObject({ mode: 'mots-cles', raison: 'jev_indisponible' });
    expect((d.stockage as ReturnType<typeof memoire>).lignes.size).toBe(0);
  });

  it('Fournisseur — délai dépassé : repli', async () => {
    const d = deps({
      jev: (_q, _i, signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('abort')))),
      delaiJevMs: 20,
    });
    expect(await rechercher(Q, d)).toMatchObject({ raison: 'jev_indisponible' });
  });

  it('Persistance — échec d’écriture du cache après succès : la réponse reste correcte', async () => {
    const d = deps();
    d.stockage.ecrire = async () => {
      throw new Error('ecriture');
    };
    const r = await rechercher(Q, d);
    expect(r).toMatchObject({ mode: 'jev', cache: false });
    expect(r.resultats[0]!.code).toBe('SGBC');
    expect(d.journaux.some((j) => j[0] === 'cache_ecriture_echec')).toBe(true);
  });

  it('Confidentialité — une exception ne journalise jamais le texte de la requête', async () => {
    const d = deps({
      jev: async (q) => {
        throw new Error(`échec pour « ${q} »`);
      },
    });
    await rechercher(Q, d);
    const d2 = deps({
      stockage: {
        ...memoire(),
        verrouiller: async () => {
          throw new Error(Q);
        },
      },
    });
    await rechercher(Q, d2);
    const tout = JSON.stringify([...d.journaux, ...d2.journaux]);
    expect(tout).not.toContain('confidentielle');
    expect(d.journaux.length + d2.journaux.length).toBeGreaterThan(0);
  });

  it('Données — instantané indisponible : réponse vide, jamais d’erreur', async () => {
    const d = deps({
      instantane: async () => {
        throw new Error('db');
      },
    });
    expect(await rechercher(Q, d)).toEqual({
      mode: 'mots-cles', raison: 'donnees_indisponibles', cache: false, statut: 'aucune', resultats: [], snapshotId: null, actualiseLe: null,
    });
  });
});
```

<!-- fichier: frontend/lib/recherche/orchestrer.ts -->
```ts
import { resultatsJev } from './decision';
import { rechercheMotsCles } from './motsCles';
import { empreinte } from './normaliser';
import { validerReponseJev } from './validerJev';
import type { CleCache, Instantane, RaisonRepli, ReponseRecherche, ResultatJevValide } from './types';

export interface EntreeCache {
  etat: 'en_cours' | 'prete';
  resultat: ResultatJevValide | null;
}

/** Cache + verrou, atomiques côté stockage (fonctions SQL en production). */
export interface StockageRecherche {
  lire(cle: CleCache): Promise<EntreeCache | null>;
  /** true = verrou obtenu (aucune entrée, ou entrée abandonnée / expirée). */
  verrouiller(cle: CleCache): Promise<boolean>;
  ecrire(cle: CleCache, resultat: ResultatJevValide): Promise<void>;
  liberer(cle: CleCache): Promise<void>;
}

export interface Utilisateur {
  id: string;
  email: string | null;
}

export interface DepsRecherche {
  instantane(): Promise<Instantane | null>;
  utilisateur(): Promise<Utilisateur | null>;
  eligible(u: Utilisateur): Promise<boolean>;
  /** true = autorisé (et consommé). */
  quota(u: Utilisateur): Promise<boolean>;
  stockage: StockageRecherche;
  reserverBudget(): Promise<'ok' | 'refuse' | 'erreur'>;
  jev(q: string, instantane: Instantane, signal: AbortSignal): Promise<unknown>;
  attendre(ms: number): Promise<void>;
  /** Journal d'exploitation : JAMAIS le texte de la requête ni un message d'erreur. */
  journal(evenement: string, details?: Record<string, string | number>): void;
  delaiJevMs?: number;
  attenteMs?: number;
  attenteEssais?: number;
}

export const DELAI_JEV_MS = 8_000;
export const ATTENTE_MS = 500;
export const ATTENTE_ESSAIS = 16;

const DELAI = Symbol('delai');

/**
 * Ordre : instantané → session → éligibilité (AVANT tout cache) → cache →
 * verrou → quota → budget → Jev → validation → écriture du cache. Toute
 * défaillance retombe sur la recherche par mots-clés, avec sa raison.
 */
export async function rechercher(q: string, deps: DepsRecherche): Promise<ReponseRecherche> {
  let lu: Instantane | null = null;
  try {
    lu = await deps.instantane();
  } catch {
    lu = null;
  }
  if (!lu) {
    deps.journal('donnees_indisponibles');
    return { mode: 'mots-cles', raison: 'donnees_indisponibles', cache: false, statut: 'aucune', resultats: [], snapshotId: null, actualiseLe: null };
  }
  const instantane = lu;
  const meta = { snapshotId: instantane.snapshotId, actualiseLe: instantane.actualiseLe };
  const repli = (raison: RaisonRepli): ReponseRecherche => ({ mode: 'mots-cles', raison, cache: false, ...rechercheMotsCles(q, instantane.fiches), ...meta });
  const parJev = (r: ResultatJevValide, cache: boolean): ReponseRecherche => ({ mode: 'jev', raison: null, cache, ...resultatsJev(r, instantane.fiches), ...meta });

  const utilisateur = await deps.utilisateur().catch(() => null);
  if (!utilisateur) return repli('non_connecte');
  const eligible = await deps.eligible(utilisateur).catch(() => false);
  if (!eligible) return repli('offre_non_eligible');

  const cle: CleCache = { empreinte: empreinte(q), snapshotId: instantane.snapshotId };
  const resultatPret = async (): Promise<ResultatJevValide | null> => {
    try {
      const e = await deps.stockage.lire(cle);
      return e?.etat === 'prete' && e.resultat ? e.resultat : null;
    } catch {
      return null;
    }
  };

  const enCache = await resultatPret();
  if (enCache) return parJev(enCache, true);

  let verrou: boolean;
  try {
    verrou = await deps.stockage.verrouiller(cle);
  } catch {
    deps.journal('stockage_indisponible');
    return repli('compteur_indisponible');
  }
  if (!verrou) {
    // La même recherche est calculée ailleurs : on attend son résultat.
    const essais = deps.attenteEssais ?? ATTENTE_ESSAIS;
    for (let i = 0; i < essais; i += 1) {
      await deps.attendre(deps.attenteMs ?? ATTENTE_MS);
      const r = await resultatPret();
      if (r) return parJev(r, true);
    }
    deps.journal('attente_verrou_expiree');
    return repli('jev_indisponible');
  }
  const liberer = async () => {
    try {
      await deps.stockage.liberer(cle);
    } catch {
      deps.journal('verrou_non_libere');
    }
  };

  // Le quota est un anti-abus : ouvert si son infrastructure faillit. Le budget, lui, ferme.
  const quotaOk = await deps.quota(utilisateur).catch(() => true);
  if (!quotaOk) {
    await liberer();
    return repli('quota_atteint');
  }

  const budget = await deps.reserverBudget().catch(() => 'erreur' as const);
  if (budget !== 'ok') {
    await liberer();
    const raison = budget === 'refuse' ? 'plafond_atteint' : 'compteur_indisponible';
    deps.journal(raison);
    return repli(raison);
  }

  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), deps.delaiJevMs ?? DELAI_JEV_MS);
  let brut: unknown;
  try {
    const appel = deps.jev(q, instantane, ctrl.signal);
    appel.catch(() => undefined); // un rejet tardif (après le délai) ne doit pas rester orphelin
    const delai = new Promise<typeof DELAI>((resoudre) => ctrl.signal.addEventListener('abort', () => resoudre(DELAI), { once: true }));
    brut = await Promise.race([appel, delai]);
    if (brut === DELAI) throw new Error('delai');
  } catch {
    await liberer();
    deps.journal('jev_indisponible');
    return repli('jev_indisponible');
  } finally {
    clearTimeout(minuterie);
  }

  const valide = validerReponseJev(brut, instantane.fiches.map((f) => f.code));
  if (!valide) {
    await liberer();
    deps.journal('jev_reponse_invalide');
    return repli('jev_indisponible');
  }
  try {
    await deps.stockage.ecrire(cle, valide);
  } catch {
    deps.journal('cache_ecriture_echec');
  }
  return parJev(valide, false);
}
```

- [ ] **Step 1:** Extraire le test → FAIL. **Step 2:** extraire le module → PASS (14). **Step 3:** commit `feat(recherche): orchestration et invariants (accès, cache, budget, fournisseur, confidentialité)`.
