# WhatsApp intelligent : aiguillage par Jev — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un message WhatsApp libre reçoit la réponse exacte des commandes existantes quand Jev en est sûr ; sinon il suit le chemin actuel.

**Architecture:** Client Jev générique (`lib/jev/client.ts`) partagé avec la recherche ; modules purs dans `lib/whatsapp/aiguillage/` (intentions, requête mixte, validation, décision, textes fixes, flux injectable) ; adaptateur serveur `lib/server/whatsappAiguillage.ts` ; branchement dans la route WAHA avant l'agent et la console. Budget générique atomique `jev_budget`.

**Tech Stack:** Next.js 14, TypeScript strict, Supabase, vitest, TypeSafe `POST /v1/systemone` (réponse `choice` : `{ type, choice, probabilities, confidence }` ; `noul` : `{ type, noul }`, relevé dans `src/core/types.ts` de `FrancoisChastel/jev-code`).

**Spec:** `docs/superpowers/specs/2026-11-04-whatsapp-aiguillage-jev-design.md`. Écart : l'intention `autre` retombe sur le **chemin actuel** (agent si abonné lié) au lieu de forcer la console, comme le doute ; seule `humain` force la console.

**Convention d'extraction :** `<!-- fichier: chemin -->` = contenu complet.

---

### Task 1 : client Jev générique

**Files:** Create `frontend/lib/jev/client.ts`; Modify `frontend/lib/recherche/jev.ts` (adaptateur)

<!-- fichier: frontend/lib/jev/client.ts -->
```ts
/**
 * Appel générique de Jev (TypeSafe) : `POST /v1/systemone`. Serveur uniquement :
 * la clé est lue dans l'environnement à l'appel et ne part qu'en en-tête Bearer.
 * Les erreurs ne portent qu'un code, jamais le contenu de la requête.
 */
const BASE_URL = 'https://api.typesafe.ai';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface CorpsJev {
  state: unknown;
  questions: Record<string, unknown>;
}

export async function appelerJev(corps: CorpsJev, signal: AbortSignal, fetchImpl: FetchLike = (url, init) => fetch(url, init)): Promise<unknown> {
  const cle = process.env.TYPESAFE_API_KEY;
  if (!cle) throw new Error('jev_cle_absente');
  const reponse = await fetchImpl(`${BASE_URL}/v1/systemone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json', 'User-Agent': 'westbourse' },
    body: JSON.stringify({ model: process.env.TYPESAFE_DEFAULT_MODEL ?? 'jev-latest', ...corps }),
    signal,
  });
  if (!reponse.ok) throw new Error(`jev_http_${reponse.status}`);
  return reponse.json();
}
```

- [ ] **Step 1:** Extraire `client.ts`. Dans `frontend/lib/recherche/jev.ts`, supprimer `BASE_URL` et `type FetchLike`, importer `{ appelerJev, type FetchLike } from '@/lib/jev/client'`, et remplacer le corps de `classerParJev` par :

```ts
  const requete = construireRequeteJev(q, fiches, process.env.TYPESAFE_DEFAULT_MODEL ?? 'jev-latest');
  return appelerJev({ state: requete.state, questions: requete.questions }, signal, fetchImpl);
```

- [ ] **Step 2:** `npx vitest run lib/recherche` → tout vert (URL, Bearer et codes d'erreur inchangés). tsc → 0. Commit `refactor(jev): client générique partagé`.

### Task 2 : modules purs de l'aiguillage

**Files:** Create `frontend/lib/whatsapp/aiguillage/{intentions,requete,valider,decider,textes,aiguiller}.ts`; Test `frontend/lib/whatsapp/aiguillage/aiguillage.test.ts`

<!-- fichier: frontend/lib/whatsapp/aiguillage/intentions.ts -->
```ts
/** Intentions d'un message WhatsApp libre ; la description EST le critère envoyé à Jev. */
export const INTENTIONS = {
  cours: 'Demande le cours, le prix ou la variation du jour d’une société cotée précise.',
  dividendes: 'Demande le dividende, le rendement ou la date de paiement du dividende d’une société cotée précise.',
  palmares_hausses: 'Demande les plus fortes hausses de la séance, les actions qui montent le plus.',
  palmares_baisses: 'Demande les plus fortes baisses de la séance, les actions qui baissent le plus.',
  palmares_volumes: 'Demande les actions les plus échangées de la séance, les plus gros volumes.',
  aide: 'Demande ce que le service sait faire ou comment l’utiliser.',
  humain: 'Veut parler à une personne de l’équipe, être rappelé ou contacté par quelqu’un.',
  conseil: 'Demande s’il faut acheter, vendre ou conserver, ou quelle action choisir : une recommandation d’investissement.',
  analyse: 'Pose une vraie question d’analyse ou d’explication (pourquoi, comparer, expliquer une notion), sans demander un simple chiffre.',
  salutation: 'Salue, remercie ou prend congé, sans autre demande.',
  autre: 'Rien de ce qui précède : hors sujet ou incompréhensible.',
} as const;

export type Intention = keyof typeof INTENTIONS;

export const LISTE_INTENTIONS = Object.keys(INTENTIONS) as Intention[];

export const estIntention = (x: unknown): x is Intention => typeof x === 'string' && x in INTENTIONS;
```

<!-- fichier: frontend/lib/whatsapp/aiguillage/requete.ts -->
```ts
import { INTENTIONS } from './intentions';

/** Identité d'une société : ce que Jev voit pour reconnaître de qui parle le message. */
export interface SocieteIdentite {
  code: string;
  nom: string;
  secteur: string | null;
  pays: string | null;
}

export const QUESTION_INTENTION = 'intention';

export function construireRequeteAiguillage(message: string, societes: SocieteIdentite[]) {
  const fiches: Record<string, string> = {};
  const questions: Record<string, unknown> = {
    [QUESTION_INTENTION]: {
      type: 'choice',
      instructions: 'Que demande l’auteur de `message`, adressé au service d’information boursière WESTBOURSE (BRVM) ?',
      criteria: { ...INTENTIONS },
    },
  };
  for (const s of societes) {
    fiches[s.code] = [`${s.code} — ${s.nom}.`, s.secteur ? `Secteur : ${s.secteur}.` : '', s.pays ? `Pays : ${s.pays}.` : ''].filter(Boolean).join(' ');
    questions[s.code] = {
      type: 'noul',
      instructions: `\`message\` parle-t-il de la société \`societes.${s.code}\` (par son nom, son code ou une description sans ambiguïté) ?`,
      criteria: { true: 'Le message désigne cette société', false: 'Le message ne désigne pas cette société' },
    };
  }
  return { state: { message, societes: fiches }, questions };
}
```

<!-- fichier: frontend/lib/whatsapp/aiguillage/valider.ts -->
```ts
import { estIntention, type Intention } from './intentions';
import { QUESTION_INTENTION } from './requete';

export interface AiguillageValide {
  intention: Intention;
  probabilites: Partial<Record<Intention, number>>;
  societes: Record<string, number>;
}

const proba = (p: unknown): p is number => typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1;

/** Réponse complète et cohérente, sinon null (le message suit alors le chemin actuel). */
export function validerAiguillage(brut: unknown, codes: readonly string[]): AiguillageValide | null {
  if (!brut || typeof brut !== 'object') return null;
  const answers = (brut as { answers?: unknown }).answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const a = answers as Record<string, unknown>;

  const choix = a[QUESTION_INTENTION] as { type?: unknown; choice?: unknown; probabilities?: unknown } | undefined;
  if (!choix || choix.type !== 'choice' || !estIntention(choix.choice)) return null;
  if (!choix.probabilities || typeof choix.probabilities !== 'object') return null;
  const probabilites: Partial<Record<Intention, number>> = {};
  for (const [k, p] of Object.entries(choix.probabilities as Record<string, unknown>)) {
    if (!estIntention(k) || !proba(p)) return null;
    probabilites[k] = p;
  }
  if (probabilites[choix.choice] === undefined) return null;

  const attendus = new Set(codes);
  const societes: Record<string, number> = {};
  for (const [cle, rep] of Object.entries(a)) {
    if (cle === QUESTION_INTENTION) continue;
    if (!attendus.has(cle)) return null;
    const r = rep as { type?: unknown; noul?: unknown };
    if (r?.type !== 'noul' || !proba(r.noul)) return null;
    societes[cle] = r.noul;
  }
  if (Object.keys(societes).length !== attendus.size) return null;
  return { intention: choix.choice, probabilites, societes };
}
```

<!-- fichier: frontend/lib/whatsapp/aiguillage/decider.ts -->
```ts
import type { Commande } from '@/lib/whatsapp/commandes';
import type { AiguillageValide } from './valider';

export const SEUIL_INTENTION = 0.85;
export const MARGE_INTENTION = 0.5;
export const SEUIL_SOCIETE = 0.8;
export const MAX_AMBIGUES = 3;

export type Decision =
  | { type: 'commande'; commande: Commande }
  | { type: 'clarification'; intention: 'cours' | 'dividendes'; codes: string[] }
  | { type: 'refus_conseil' }
  | { type: 'salutation' }
  | { type: 'agent' }
  | { type: 'console' }
  | { type: 'aiguillage_actuel' };

/** Réponse validée → action. Le doute retombe TOUJOURS sur le chemin actuel. */
export function decider(v: AiguillageValide): Decision {
  const p = v.probabilites[v.intention] ?? 0;
  const second = Math.max(0, ...Object.entries(v.probabilites).filter(([k]) => k !== v.intention).map(([, x]) => x ?? 0));
  if (p < SEUIL_INTENTION || p - second < MARGE_INTENTION) return { type: 'aiguillage_actuel' };

  switch (v.intention) {
    case 'cours':
    case 'dividendes': {
      const codes = Object.entries(v.societes)
        .filter(([, s]) => s >= SEUIL_SOCIETE)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([c]) => c);
      if (codes.length === 1) return { type: 'commande', commande: { type: v.intention, valeur: codes[0]! } };
      return { type: 'clarification', intention: v.intention, codes: codes.length <= MAX_AMBIGUES ? codes : [] };
    }
    case 'palmares_hausses':
      return { type: 'commande', commande: { type: 'palmares', critere: 'hausses' } };
    case 'palmares_baisses':
      return { type: 'commande', commande: { type: 'palmares', critere: 'baisses' } };
    case 'palmares_volumes':
      return { type: 'commande', commande: { type: 'palmares', critere: 'volumes' } };
    case 'aide':
      return { type: 'commande', commande: { type: 'aide' } };
    case 'conseil':
      return { type: 'refus_conseil' };
    case 'salutation':
      return { type: 'salutation' };
    case 'analyse':
      return { type: 'agent' };
    case 'humain':
      return { type: 'console' };
    default:
      return { type: 'aiguillage_actuel' };
  }
}
```

<!-- fichier: frontend/lib/whatsapp/aiguillage/textes.ts -->
```ts
/** Textes FIXES : aucun chiffre, aucune donnée de marché, rien de généré. */

export function texteClarification(intention: 'cours' | 'dividendes', codes: string[]): string {
  const mot = intention === 'cours' ? 'COURS' : 'DIV';
  if (codes.length === 0) return `Pour quelle société ? Précisez son code, par exemple *${mot} SNTS*.`;
  return ['Pour quelle société ? Répondez par exemple :', ...codes.map((c) => `• *${mot} ${c}*`)].join('\n');
}

export const TEXTE_REFUS_CONSEIL = [
  'Nous ne donnons pas de conseil d’achat ou de vente : la décision dépend de votre situation. Pour vous faire votre propre avis :',
  '• *COURS SNTS* — le cours d’une valeur',
  '• *DIV SNTS* — ses dividendes',
  '• *PALMARES* — les mouvements de la séance',
  '👉 Fiches et analyses : https://www.westbourse.com/societes',
].join('\n');

export const TEXTE_SALUTATION = '👋 WESTBOURSE à votre service : cours, dividendes et palmarès de la BRVM. Tapez *AIDE* pour les exemples.';
```

<!-- fichier: frontend/lib/whatsapp/aiguillage/aiguiller.ts -->
```ts
import { contientDonneePersonnelle } from '@/lib/recherche/normaliser';
import { decider, type Decision } from './decider';
import type { Intention } from './intentions';
import { construireRequeteAiguillage, type SocieteIdentite } from './requete';
import { validerAiguillage } from './valider';

export interface EntreeJournal {
  intention: Intention;
  decision: Decision['type'];
  probabilite: number;
}

export interface DepsAiguillage {
  actif(): Promise<boolean>;
  societes(): Promise<SocieteIdentite[]>;
  /** true = autorisé (et consommé). */
  quota(chatId: string): Promise<boolean>;
  reserverBudget(): Promise<'ok' | 'refuse' | 'erreur'>;
  jev(corps: ReturnType<typeof construireRequeteAiguillage>, signal: AbortSignal): Promise<unknown>;
  /** Journal anonyme (table) : jamais le texte ni le numéro. */
  journaliser(e: EntreeJournal): Promise<void>;
  /** Journal d'exploitation : codes d'événement seulement. */
  journal(evenement: string): void;
  delaiMs?: number;
}

export const DELAI_MS = 6_000;
export const LONGUEUR_MIN = 3;
export const LONGUEUR_MAX = 500;
const ACTUEL: Decision = { type: 'aiguillage_actuel' };
const DELAI = Symbol('delai');

/** Toute défaillance, tout doute ⇒ chemin actuel : on ne perd jamais un message. */
export async function aiguillerParJev(texte: string, chatId: string, deps: DepsAiguillage): Promise<Decision> {
  if (!(await deps.actif().catch(() => false))) return ACTUEL;
  const t = texte.trim();
  if (t.length < LONGUEUR_MIN || t.length > LONGUEUR_MAX) return ACTUEL;
  if (contientDonneePersonnelle(t)) {
    deps.journal('donnee_personnelle');
    return ACTUEL;
  }
  const societes = await deps.societes().catch(() => [] as SocieteIdentite[]);
  if (societes.length === 0) {
    deps.journal('societes_indisponibles');
    return ACTUEL;
  }
  if (!(await deps.quota(chatId).catch(() => true))) {
    deps.journal('quota_atteint');
    return ACTUEL;
  }
  const budget = await deps.reserverBudget().catch(() => 'erreur' as const);
  if (budget !== 'ok') {
    deps.journal(budget === 'refuse' ? 'plafond_atteint' : 'compteur_indisponible');
    return ACTUEL;
  }

  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), deps.delaiMs ?? DELAI_MS);
  let brut: unknown;
  try {
    const appel = deps.jev(construireRequeteAiguillage(t, societes), ctrl.signal);
    appel.catch(() => undefined);
    const delai = new Promise<typeof DELAI>((r) => ctrl.signal.addEventListener('abort', () => r(DELAI), { once: true }));
    brut = await Promise.race([appel, delai]);
    if (brut === DELAI) throw new Error('delai');
  } catch {
    deps.journal('jev_indisponible');
    return ACTUEL;
  } finally {
    clearTimeout(minuterie);
  }

  const valide = validerAiguillage(brut, societes.map((s) => s.code));
  if (!valide) {
    deps.journal('jev_reponse_invalide');
    return ACTUEL;
  }
  const decision = decider(valide);
  await deps
    .journaliser({ intention: valide.intention, decision: decision.type, probabilite: valide.probabilites[valide.intention] ?? 0 })
    .catch(() => deps.journal('journal_non_ecrit'));
  return decision;
}
```

<!-- fichier: frontend/lib/whatsapp/aiguillage/aiguillage.test.ts -->
```ts
import { describe, it, expect, vi } from 'vitest';
import { construireRequeteAiguillage, QUESTION_INTENTION, type SocieteIdentite } from './requete';
import { validerAiguillage, type AiguillageValide } from './valider';
import { decider } from './decider';
import { TEXTE_REFUS_CONSEIL, TEXTE_SALUTATION, texteClarification } from './textes';
import { aiguillerParJev, type DepsAiguillage } from './aiguiller';
import { LISTE_INTENTIONS, type Intention } from './intentions';

const societes: SocieteIdentite[] = [
  { code: 'SNTS', nom: 'Sonatel', secteur: 'Télécommunications', pays: 'SN' },
  { code: 'ORAC', nom: 'Orange Côte d’Ivoire', secteur: 'Télécommunications', pays: 'CI' },
];
const choix = (choice: Intention, p = 0.95) => ({
  type: 'choice',
  choice,
  confidence: p,
  probabilities: Object.fromEntries(LISTE_INTENTIONS.map((k) => [k, k === choice ? p : (1 - p) / (LISTE_INTENTIONS.length - 1)])),
});
const noul = (p: number) => ({ type: 'noul', noul: p });
const brut = (choice: Intention, snts: number, orac: number, p = 0.95) => ({ answers: { [QUESTION_INTENTION]: choix(choice, p), SNTS: noul(snts), ORAC: noul(orac) } });
const valide = (choice: Intention, snts: number, orac: number, p = 0.95) => validerAiguillage(brut(choice, snts, orac, p), ['SNTS', 'ORAC'])!;

describe('requête mixte', () => {
  it('une question d’intention et une question oui/non par société', () => {
    const r = construireRequeteAiguillage('cours de sonatel', societes);
    expect(Object.keys(r.questions).sort()).toEqual(['ORAC', 'SNTS', QUESTION_INTENTION].sort());
    expect(r.state.societes.SNTS).toBe('SNTS — Sonatel. Secteur : Télécommunications. Pays : SN.');
    expect((r.questions[QUESTION_INTENTION] as { criteria: Record<string, string> }).criteria).toHaveProperty('conseil');
  });
});

describe('validation', () => {
  it('accepte une réponse complète', () => {
    expect(valide('cours', 0.9, 0.1)).toMatchObject({ intention: 'cours', societes: { SNTS: 0.9, ORAC: 0.1 } });
  });
  it.each([
    ['intention inconnue', { answers: { ...brut('cours', 1, 0).answers, [QUESTION_INTENTION]: { ...choix('cours'), choice: 'acheter' } } }],
    ['probabilité hors [0,1]', { answers: { ...brut('cours', 1, 0).answers, SNTS: noul(3) } }],
    ['code inconnu', { answers: { ...brut('cours', 1, 0).answers, XXXX: noul(0.2) } }],
    ['code manquant', { answers: { [QUESTION_INTENTION]: choix('cours'), SNTS: noul(1) } }],
    ['intention absente', { answers: { SNTS: noul(1), ORAC: noul(0) } }],
    ['mauvais type', { answers: { ...brut('cours', 1, 0).answers, [QUESTION_INTENTION]: noul(0.9) } }],
    ['corps nul', null],
  ])('rejette : %s', (_n, b) => {
    expect(validerAiguillage(b, ['SNTS', 'ORAC'])).toBeNull();
  });
});

describe('décision', () => {
  it('une société sûre ⇒ commande exacte', () => {
    expect(decider(valide('cours', 0.92, 0.1))).toEqual({ type: 'commande', commande: { type: 'cours', valeur: 'SNTS' } });
    expect(decider(valide('dividendes', 0.05, 0.9))).toEqual({ type: 'commande', commande: { type: 'dividendes', valeur: 'ORAC' } });
  });
  it('deux sociétés plausibles ⇒ clarification, jamais une réponse sur un seul code', () => {
    expect(decider(valide('cours', 0.9, 0.85))).toEqual({ type: 'clarification', intention: 'cours', codes: ['SNTS', 'ORAC'] });
    expect(decider(valide('cours', 0.2, 0.3))).toEqual({ type: 'clarification', intention: 'cours', codes: [] });
  });
  it('intention incertaine ⇒ chemin actuel', () => {
    expect(decider(valide('cours', 1, 0, 0.6))).toEqual({ type: 'aiguillage_actuel' });
    const serre: AiguillageValide = { intention: 'cours', probabilites: { cours: 0.86, conseil: 0.5 }, societes: { SNTS: 1, ORAC: 0 } };
    expect(decider(serre)).toEqual({ type: 'aiguillage_actuel' });
  });
  it('conseil ⇒ refus, jamais une commande', () => {
    expect(decider(valide('conseil', 1, 0))).toEqual({ type: 'refus_conseil' });
  });
  it('autres intentions', () => {
    expect(decider(valide('palmares_baisses', 0, 0))).toEqual({ type: 'commande', commande: { type: 'palmares', critere: 'baisses' } });
    expect(decider(valide('aide', 0, 0))).toEqual({ type: 'commande', commande: { type: 'aide' } });
    expect(decider(valide('salutation', 0, 0))).toEqual({ type: 'salutation' });
    expect(decider(valide('analyse', 1, 0))).toEqual({ type: 'agent' });
    expect(decider(valide('humain', 0, 0))).toEqual({ type: 'console' });
    expect(decider(valide('autre', 0, 0))).toEqual({ type: 'aiguillage_actuel' });
  });
});

describe('textes fixes', () => {
  it('aucun chiffre dans les textes de service', () => {
    for (const t of [TEXTE_REFUS_CONSEIL, TEXTE_SALUTATION, texteClarification('cours', ['SNTS', 'ORAC']), texteClarification('dividendes', [])]) {
      expect(t).not.toMatch(/\d/);
    }
    expect(texteClarification('dividendes', ['ORAC'])).toContain('*DIV ORAC*');
  });
});

const TEXTE = 'quel est le cours de sonatel, message confidentiel';
function deps(o: Partial<DepsAiguillage> = {}): DepsAiguillage & { journaux: unknown[]; lignes: unknown[] } {
  const journaux: unknown[] = [];
  const lignes: unknown[] = [];
  return {
    journaux,
    lignes,
    actif: async () => true,
    societes: async () => societes,
    quota: async () => true,
    reserverBudget: async () => 'ok',
    jev: vi.fn(async () => brut('cours', 0.95, 0.02)),
    journaliser: async (e) => {
      lignes.push(e);
    },
    journal: (e) => journaux.push(e),
    delaiMs: 200,
    ...o,
  };
}

describe('flux d’aiguillage : invariants', () => {
  it('nominal : commande exacte, journal anonyme', async () => {
    const d = deps();
    expect(await aiguillerParJev(TEXTE, '225070000@c.us', d)).toEqual({ type: 'commande', commande: { type: 'cours', valeur: 'SNTS' } });
    expect(d.lignes).toEqual([{ intention: 'cours', decision: 'commande', probabilite: 0.95 }]);
  });
  it('drapeau coupé ⇒ aucun appel', async () => {
    const d = deps({ actif: async () => false });
    expect(await aiguillerParJev(TEXTE, 'x', d)).toEqual({ type: 'aiguillage_actuel' });
    expect(d.jev).not.toHaveBeenCalled();
  });
  it('e-mail ou numéro dans le message ⇒ jamais envoyé', async () => {
    const d = deps();
    expect(await aiguillerParJev('rappelez-moi au +225 07 08 09 10 11', 'x', d)).toEqual({ type: 'aiguillage_actuel' });
    expect(await aiguillerParJev('écrivez à a@b.ci pour le cours', 'x', d)).toEqual({ type: 'aiguillage_actuel' });
    expect(d.jev).not.toHaveBeenCalled();
  });
  it.each([
    ['quota atteint', { quota: async () => false }],
    ['plafond atteint', { reserverBudget: async () => 'refuse' as const }],
    ['compteur en erreur', { reserverBudget: async () => { throw new Error('rpc'); } }],
    ['Jev en erreur', { jev: async () => { throw new Error('http'); } }],
    ['réponse invalide', { jev: async () => ({ answers: {} }) }],
    ['sociétés indisponibles', { societes: async () => [] }],
  ])('%s ⇒ chemin actuel', async (_n, o) => {
    expect(await aiguillerParJev(TEXTE, 'x', deps(o as Partial<DepsAiguillage>))).toEqual({ type: 'aiguillage_actuel' });
  });
  it('délai dépassé ⇒ chemin actuel', async () => {
    const d = deps({ jev: (_c, signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('abort')))), delaiMs: 20 });
    expect(await aiguillerParJev(TEXTE, 'x', d)).toEqual({ type: 'aiguillage_actuel' });
  });
  it('aucun journal ne contient le texte ni le numéro', async () => {
    const d = deps({ jev: async () => { throw new Error(TEXTE); } });
    await aiguillerParJev(TEXTE, '225070000@c.us', d);
    const d2 = deps();
    await aiguillerParJev(TEXTE, '225070000@c.us', d2);
    const tout = JSON.stringify([d.journaux, d.lignes, d2.journaux, d2.lignes]);
    expect(tout).not.toContain('confidentiel');
    expect(tout).not.toContain('225070000');
  });
  it('un journal non écrit ne change pas la décision', async () => {
    const d = deps({ journaliser: async () => { throw new Error('db'); } });
    expect((await aiguillerParJev(TEXTE, 'x', d)).type).toBe('commande');
    expect(d.journaux).toContain('journal_non_ecrit');
  });
});
```

- [ ] **Step 1:** Extraire le test → FAIL. **Step 2:** extraire les six modules → PASS. **Step 3:** tsc → 0. Commit `feat(whatsapp): aiguillage des messages libres par Jev (modules purs)`.

### Task 3 : migration 0192

**Files:** Create `supabase/migrations/0192_whatsapp_aiguillage_jev.sql`, `frontend/scripts/verif-budget-jev.mjs`

<!-- fichier: supabase/migrations/0192_whatsapp_aiguillage_jev.sql -->
```sql
-- 0192 — WhatsApp : aiguillage des messages libres par Jev (TypeSafe).
--
-- Budget générique par usage (réutilisable par d'autres chantiers Jev), journal
-- anonyme des aiguillages (ni texte ni numéro), drapeau livré COUPÉ : il ne
-- s'active qu'après une évaluation favorable. RLS activée SANS policy.

create table if not exists public.jev_budget (
  usage  text not null check (usage ~ '^[a-z_]{2,40}$'),
  jour   date not null,
  appels integer not null check (appels >= 0),
  primary key (usage, jour)
);
alter table public.jev_budget enable row level security;
revoke all on public.jev_budget from public, anon, authenticated;

create or replace function public.jev_reserver_budget(p_usage text, p_plafond integer, p_jour date default current_date)
returns boolean
language sql
set search_path = public, pg_temp
as $$
  with r as (
    insert into public.jev_budget as b (usage, jour, appels)
    select p_usage, p_jour, 1 where p_plafond > 0
    on conflict (usage, jour) do update set appels = b.appels + 1 where b.appels < p_plafond
    returning 1
  )
  select exists (select 1 from r);
$$;
revoke execute on function public.jev_reserver_budget(text, integer, date) from public, anon, authenticated;
grant execute on function public.jev_reserver_budget(text, integer, date) to service_role;

create table if not exists public.whatsapp_aiguillages (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  intention   text not null check (intention in ('cours','dividendes','palmares_hausses','palmares_baisses','palmares_volumes','aide','humain','conseil','analyse','salutation','autre')),
  decision    text not null check (decision in ('commande','clarification','refus_conseil','salutation','agent','console','aiguillage_actuel')),
  probabilite numeric not null check (probabilite >= 0 and probabilite <= 1)
);
create index if not exists idx_whatsapp_aiguillages_created_at on public.whatsapp_aiguillages (created_at);
alter table public.whatsapp_aiguillages enable row level security;
revoke all on public.whatsapp_aiguillages from public, anon, authenticated;

insert into public.feature_flags (code, label, acces, description) values
  ('whatsapp_jev', 'WhatsApp : aiguillage par Jev', 'disabled',
   'Classe les messages WhatsApp libres (Jev, TypeSafe) pour donner la réponse exacte des commandes. Livré coupé : à activer après une évaluation favorable.')
on conflict (code) do nothing;

-- Rétention : reprise de 0191 + deux lignes.
create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  delete from public.auth_events        where created_at < now() - interval '12 months';
  delete from public.whatsapp_conversations where created_at < now() - interval '90 days';
  delete from public.whatsapp_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.telegram_conversations where created_at < now() - interval '90 days';
  delete from public.telegram_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.dossier_envois         where created_at < now() - interval '90 days';
  delete from public.formation_inscriptions i
   using public.formation_sessions s
   where s.id = i.session_id and s.debut_at < now() - interval '3 years';
  delete from public.payment_webhook_events where received_at < now() - interval '12 months';
  delete from public.contact_messages       where derniere_activite_at < now() - interval '12 months';
  delete from public.crm_signaux            where created_at < now() - interval '90 days';
  delete from public.crm_actions            where created_at < now() - interval '24 months';
  delete from public.academy_exam_sessions  where created_at < now() - interval '7 days';
  delete from public.recherche_societes_cache  where cree_le < now() - interval '24 hours';
  delete from public.recherche_societes_budget where jour < current_date - 30;
  delete from public.whatsapp_aiguillages      where created_at < now() - interval '90 days';
  delete from public.jev_budget                where jour < current_date - 30;
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
```

<!-- fichier: frontend/scripts/verif-budget-jev.mjs -->
```js
// Budget Jev générique : 20 réservations SIMULTANÉES, plafond 5, usage de test
// sur un jour fictif supprimé ensuite. Attendu : exactement 5. Aucune clé affichée.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'User-Agent': 'westbourse-verif-budget' } },
});
const cle = { usage: 'verification', jour: '1900-01-01' };
await db.from('jev_budget').delete().match(cle);
const reponses = await Promise.all(
  Array.from({ length: 20 }, () => db.rpc('jev_reserver_budget', { p_usage: cle.usage, p_plafond: 5, p_jour: cle.jour })),
);
const erreurs = reponses.filter((r) => r.error).length;
const accordees = reponses.filter((r) => r.data === true).length;
const { data: ligne } = await db.from('jev_budget').select('appels').match(cle).maybeSingle();
await db.from('jev_budget').delete().match(cle);
console.log(`réservations accordées : ${accordees}/20, erreurs : ${erreurs}, compteur : ${ligne?.appels ?? 'absent'}`);
process.exit(accordees === 5 && erreurs === 0 && ligne?.appels === 5 ? 0 : 1);
```

- [ ] **Step 1:** Vérifier que la purge en production contient les 16 `delete` de 0191. **Step 2:** appliquer. **Step 3:** `node scripts/verif-budget-jev.mjs` → 5/20, 0 erreur. **Step 4:** clé publique : refus. **Step 5:** commit.

### Task 4 : adaptateur serveur et branchement WAHA

**Files:** Create `frontend/lib/server/whatsappAiguillage.ts`; Modify `frontend/lib/server/featureGate.ts`, `frontend/app/api/whatsapp/waha/route.ts`

<!-- fichier: frontend/lib/server/whatsappAiguillage.ts -->
```ts
import 'server-only';
import { createHmac } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createPublicClient } from '@/lib/supabase/public';
import { getFlag } from '@/lib/server/featureGate';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { appelerJev } from '@/lib/jev/client';
import { passerelleWhatsapp } from '@/lib/whatsapp/passerelle';
import { repondreCommande } from '@/lib/whatsapp/repondreCommande';
import type { DepsAiguillage } from '@/lib/whatsapp/aiguillage/aiguiller';
import type { Decision } from '@/lib/whatsapp/aiguillage/decider';
import type { SocieteIdentite } from '@/lib/whatsapp/aiguillage/requete';
import { TEXTE_REFUS_CONSEIL, TEXTE_SALUTATION, texteClarification } from '@/lib/whatsapp/aiguillage/textes';

const QUOTA_HEURE = 30;
const plafondJour = () => {
  const n = Number(process.env.WHATSAPP_JEV_PLAFOND_JOUR ?? 300);
  return Number.isInteger(n) && n >= 0 ? n : 300;
};

/** Identités des sociétés cotées (code, nom, secteur, pays), relues au plus toutes les 6 h. */
const identitesSocietes = unstable_cache(
  async (): Promise<SocieteIdentite[]> => {
    const { data, error } = await createPublicClient()
      .from('brvm_instruments')
      .select('code, designation, secteur, pays')
      .eq('type', 'action')
      .eq('actif', true)
      .order('code');
    if (error || !data?.length) throw new Error('societes_indisponibles');
    return data.map((r) => ({ code: r.code as string, nom: (r.designation as string) ?? (r.code as string), secteur: r.secteur ?? null, pays: r.pays ?? null }));
  },
  ['whatsapp-identites-societes-v1'],
  { revalidate: 6 * 3600 },
);

export function depsAiguillageWhatsapp(): DepsAiguillage {
  return {
    // Drapeau non déclaré ⇒ coupé (prudence) ; sans clé TypeSafe ⇒ coupé (rien ne serait réservé pour rien).
    actif: async () => {
      if (!process.env.TYPESAFE_API_KEY) return false;
      const f = await getFlag('whatsapp_jev');
      return !!f && f.acces !== 'disabled';
    },
    societes: () => identitesSocietes(),
    quota: async (chatId) => {
      const cle = createHmac('sha256', process.env.WAHA_WEBHOOK_HMAC_KEY ?? 'westbourse-waha').update(`jev:${chatId}`).digest('hex');
      return (await checkRateLimit({ route: 'whatsapp-jev', ip: cle, maxHits: QUOTA_HEURE, windowSeconds: 3600 })).allowed;
    },
    reserverBudget: async () => {
      const { data, error } = await getServiceClient().rpc('jev_reserver_budget', { p_usage: 'whatsapp', p_plafond: plafondJour() });
      if (error) return 'erreur';
      return data === true ? 'ok' : 'refuse';
    },
    jev: (corps, signal) => appelerJev(corps, signal),
    journaliser: async (e) => {
      const { error } = await getServiceClient().from('whatsapp_aiguillages').insert(e);
      if (error) throw new Error('journal');
    },
    journal: (evenement) => console.warn('[whatsapp-jev]', evenement),
  };
}

/**
 * Exécute une décision qui se suffit à elle-même. Renvoie false si le message
 * doit suivre le chemin actuel (agent, console) ou si l'envoi a échoué :
 * un message n'est jamais perdu.
 */
export async function appliquerDecision(chatId: string, d: Decision): Promise<boolean> {
  const envoyer = async (texte: string) => (await passerelleWhatsapp().envoyerTexte(chatId, texte)).ok;
  switch (d.type) {
    case 'commande':
      await repondreCommande(chatId, d.commande);
      return true;
    case 'clarification':
      return envoyer(texteClarification(d.intention, d.codes));
    case 'refus_conseil':
      return envoyer(TEXTE_REFUS_CONSEIL);
    case 'salutation':
      return envoyer(TEXTE_SALUTATION);
    default:
      return false;
  }
}
```

- [ ] **Step 1:** Extraire l'adaptateur ; `featureGate.ts` : ajouter `| 'whatsapp_jev'` à `FeatureCode`.
- [ ] **Step 2:** Route WAHA : importer `{ aiguillerParJev }` et `{ appliquerDecision, depsAiguillageWhatsapp }` ; remplacer le bloc « abonné lié → agent » par :

```ts
  if (ev.texte.trim() && !estDemandeHumain(ev.texte) && !estStop(ev.texte)) {
    // Jev (si activé) : réponse exacte, clarification ou refus de conseil ; sinon chemin actuel.
    const decision = autoTest ? ({ type: 'aiguillage_actuel' } as const) : await aiguillerParJev(ev.texte, ev.de, depsAiguillageWhatsapp());
    if (await appliquerDecision(ev.de, decision)) return NextResponse.json({ ok: true, aiguillage: decision.type });
    if (decision.type !== 'console') {
      const abonne = await abonneAvecAgent(ev.de);
      if (abonne) {
        await repondreAgent(ev.de, abonne, ev.texte);
        return NextResponse.json({ ok: true, agent: true });
      }
    }
  }
```

- [ ] **Step 3:** tsc → 0 ; tests verts. Commit `feat(whatsapp): branchement de l'aiguillage Jev (drapeau coupé)`.

### Task 5 : RGPD

- [ ] `/confidentialite`, mention TypeSafe étendue aux messages WhatsApp libres (texte seul, jamais le numéro) ; `docs/RGPD.md` : ligne d'inventaire `whatsapp_aiguillages` / `jev_budget` + mini-checklist. Commit.

### Task 6 : évaluation figée (Jev contre aiguillage actuel)

**Files:** Create `frontend/lib/whatsapp/aiguillage/evaluation/jeu.ts`, `frontend/lib/whatsapp/aiguillage/evaluation/aiguillage.eval.ts`; Modify `frontend/vitest.eval.config.ts`

<!-- fichier: frontend/lib/whatsapp/aiguillage/evaluation/jeu.ts -->
```ts
import type { Intention } from '../intentions';

export interface MessageEval {
  texte: string;
  intention: Intention;
  /** Code attendu pour cours / dividendes. */
  code?: string;
}

export const JEU: MessageEval[] = [
  { texte: 'quel est le cours de Sonatel aujourd’hui ?', intention: 'cours', code: 'SNTS' },
  { texte: 'combien vaut l’action Orange Côte d’Ivoire', intention: 'cours', code: 'ORAC' },
  { texte: 'prix de la SGBCI', intention: 'cours', code: 'SGBC' },
  { texte: 'le titre TotalEnergies Côte d’Ivoire a bougé comment aujourd’hui ?', intention: 'cours', code: 'TTLC' },
  { texte: 'cours Nestlé CI', intention: 'cours', code: 'NTLC' },
  { texte: 'à combien est la CIE ?', intention: 'cours', code: 'CIEC' },
  { texte: 'Sonatel est à combien ce matin', intention: 'cours', code: 'SNTS' },
  { texte: 'donne moi le cours de palmci', intention: 'cours', code: 'PALC' },
  { texte: 'ecobank transnational cours du jour', intention: 'cours', code: 'ETIT' },
  { texte: 'cours de l’opérateur télécom du Burkina', intention: 'cours', code: 'ONTBF' },
  { texte: 'Sonatel verse combien de dividende ?', intention: 'dividendes', code: 'SNTS' },
  { texte: 'quand est payé le dividende d’Orange CI', intention: 'dividendes', code: 'ORAC' },
  { texte: 'dividende SGBCI cette année', intention: 'dividendes', code: 'SGBC' },
  { texte: 'la SODECI distribue-t-elle un dividende ?', intention: 'dividendes', code: 'SDCC' },
  { texte: 'rendement du dividende de TotalEnergies CI', intention: 'dividendes', code: 'TTLC' },
  { texte: 'DIV PALC', intention: 'dividendes', code: 'PALC' },
  { texte: 'quelles actions montent le plus aujourd’hui ?', intention: 'palmares_hausses' },
  { texte: 'les plus fortes baisses de la séance', intention: 'palmares_baisses' },
  { texte: 'quels titres ont le plus échangé aujourd’hui', intention: 'palmares_volumes' },
  { texte: 'top des hausses', intention: 'palmares_hausses' },
  { texte: 'PALMARES', intention: 'palmares_hausses' },
  { texte: 'comment ça marche ?', intention: 'aide' },
  { texte: 'qu’est-ce que je peux vous demander', intention: 'aide' },
  { texte: 'je dois acheter Sonatel maintenant ?', intention: 'conseil' },
  { texte: 'quelle action acheter pour avoir des dividendes', intention: 'conseil' },
  { texte: 'est-ce le moment de vendre mes Orange CI ?', intention: 'conseil' },
  { texte: 'tu me conseilles SGBCI ou Ecobank ?', intention: 'conseil' },
  { texte: 'quelle est la meilleure action de la BRVM', intention: 'conseil' },
  { texte: 'faut-il garder mes actions TotalEnergies', intention: 'conseil' },
  { texte: 'bonjour', intention: 'salutation' },
  { texte: 'merci beaucoup', intention: 'salutation' },
  { texte: 'bonsoir', intention: 'salutation' },
  { texte: 'merci pour l’info', intention: 'salutation' },
  { texte: 'je voudrais parler à quelqu’un de l’équipe', intention: 'humain' },
  { texte: 'pouvez-vous me rappeler s’il vous plaît', intention: 'humain' },
  { texte: 'pourquoi Sonatel a baissé cette semaine ?', intention: 'analyse' },
  { texte: 'compare Orange CI et Sonatel sur cinq ans', intention: 'analyse' },
  { texte: 'expliquez-moi ce qu’est un dividende', intention: 'analyse' },
  { texte: 'je cherche un appartement à Abidjan', intention: 'autre' },
  { texte: 'quelle heure est-il', intention: 'autre' },
];
```

<!-- fichier: frontend/lib/whatsapp/aiguillage/evaluation/aiguillage.eval.ts -->
```ts
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { appelerJev } from '@/lib/jev/client';
import { lireCommande, estDemandeHumain } from '@/lib/whatsapp/commandes';
import { aiguillerParJev } from '../aiguiller';
import type { Decision } from '../decider';
import type { SocieteIdentite } from '../requete';
import { JEU, type MessageEval } from './jeu';

const ATTENDU_COMMANDE = new Set(['cours', 'dividendes', 'palmares_hausses', 'palmares_baisses', 'palmares_volumes', 'aide']);
const CODE = /^[A-Z]{3,6}$/;

/** Aiguillage actuel : commande figée, sinon HUMAIN, sinon chemin actuel (agent ou console). */
function actuel(texte: string): Decision {
  const c = lireCommande(texte);
  if (c) return { type: 'commande', commande: c };
  if (estDemandeHumain(texte)) return { type: 'console' };
  return { type: 'aiguillage_actuel' };
}

function exacte(m: MessageEval, d: Decision): boolean {
  if (m.intention === 'conseil') return d.type === 'refus_conseil';
  if (m.intention === 'salutation') return d.type === 'salutation';
  if (d.type !== 'commande') return false;
  const c = d.commande;
  if (m.intention === 'cours' || m.intention === 'dividendes') {
    // L'aiguillage actuel transmet le texte (« Nestlé CI », résolu ensuite par nom) ; Jev transmet le code.
    return c.type === m.intention && 'valeur' in c && (c.valeur.toUpperCase() === m.code || !CODE.test(c.valeur));
  }
  if (m.intention === 'aide') return c.type === 'aide';
  return c.type === 'palmares' && `palmares_${c.critere}` === m.intention;
}

interface Mesures {
  exactes: number;
  attendues: number;
  mauvaiseSociete: number;
  conseilEnCommande: number;
  consoleATort: number;
}
const vides = (): Mesures => ({ exactes: 0, attendues: 0, mauvaiseSociete: 0, conseilEnCommande: 0, consoleATort: 0 });

function noter(mes: Mesures, m: MessageEval, d: Decision) {
  if (ATTENDU_COMMANDE.has(m.intention) || m.intention === 'conseil' || m.intention === 'salutation') {
    mes.attendues += 1;
    if (exacte(m, d)) mes.exactes += 1;
  }
  if (d.type === 'commande' && 'valeur' in d.commande && m.code && CODE.test(d.commande.valeur) && d.commande.valeur !== m.code) mes.mauvaiseSociete += 1;
  if (m.intention === 'conseil' && d.type === 'commande') mes.conseilEnCommande += 1;
  if (ATTENDU_COMMANDE.has(m.intention) && (d.type === 'console' || d.type === 'aiguillage_actuel')) mes.consoleATort += 1;
}

describe('évaluation de l’aiguillage WhatsApp (manuelle — appels payants)', () => {
  it(
    'Jev contre l’aiguillage actuel',
    async () => {
      const { data } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
        .from('brvm_instruments')
        .select('code, designation, secteur, pays')
        .eq('type', 'action')
        .eq('actif', true)
        .order('code');
      const societes: SocieteIdentite[] = (data ?? []).map((r) => ({ code: r.code, nom: r.designation ?? r.code, secteur: r.secteur, pays: r.pays }));
      for (const m of JEU) if (m.code) expect(societes.some((s) => s.code === m.code)).toBe(true);

      const jev = vides();
      const base = vides();
      const ecarts: string[] = [];
      for (const m of JEU) {
        const d = await aiguillerParJev(m.texte, 'evaluation', {
          actif: async () => true,
          societes: async () => societes,
          quota: async () => true,
          reserverBudget: async () => 'ok',
          jev: (corps, signal) => appelerJev(corps, signal),
          journaliser: async () => undefined,
          journal: () => undefined,
          delaiMs: 20_000,
        });
        noter(jev, m, d);
        noter(base, m, actuel(m.texte));
        if (!exacte(m, d)) ecarts.push(`${m.intention.padEnd(17)} → ${d.type}${d.type === 'commande' && 'valeur' in d.commande ? ` ${d.commande.valeur}` : ''} · « ${m.texte} »`);
      }
      const ligne = (x: Mesures) => ({
        'réponses exactes': `${x.exactes}/${x.attendues}`,
        'mauvaise société': x.mauvaiseSociete,
        'conseil traité en commande': x.conseilEnCommande,
        'envoyés à la console à tort': x.consoleATort,
      });
      console.table({ Jev: ligne(jev), Actuel: ligne(base) });
      console.log(ecarts.length ? `Écarts Jev :\n${ecarts.join('\n')}` : 'Aucun écart Jev.');
      const activation = jev.exactes > base.exactes && jev.consoleATort < base.consoleATort && jev.mauvaiseSociete === 0 && jev.conseilEnCommande === 0;
      console.log(`Règle d’activation : ${activation ? 'SATISFAITE — activer whatsapp_jev' : 'NON SATISFAITE — laisser le drapeau coupé'}`);
      expect(jev.conseilEnCommande).toBe(0);
    },
    900_000,
  );
});
```

- [ ] **Step 1:** Extraire ; ajouter `'lib/whatsapp/aiguillage/evaluation/**/*.eval.ts'` à `include` de `vitest.eval.config.ts`. **Step 2:** tsc → 0 ; commit. **Step 3:** `npx vitest run --config vitest.eval.config.ts lib/whatsapp` ; consigner. Règle satisfaite ⇒ `whatsapp_jev` passe à `free` en production ; sinon reste coupé.

### Task 7 : PR

- [ ] Suite complète verte, tsc 0 ; push ; PR empilée sur #163 (base `feat/recherche-societes-jev`) ; pas de fusion sans « fusionne ».
