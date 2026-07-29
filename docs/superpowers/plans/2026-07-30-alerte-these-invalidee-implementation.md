# Alerte thèse invalidée (#15) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notifier proactivement (WhatsApp + email personnels) un utilisateur quand une de ses thèses d'investissement actives bascule vers l'état « à revoir », sans jamais utiliser le canal `dispatch()` global (qui spammerait l'exploitant).

**Architecture:** Un nouveau worker cron (`scraper/src/theses/runThesisAlerts.ts`) recalcule le statut de chaque thèse active avec `checkThesis` (copie testée du module pur déjà en prod côté frontend), détecte la *transition* vers `'a-revoir'` via une fonction pure `shouldNotify`, et notifie directement via `sendEmail()` (nouvellement exportée) et le mécanisme WhatsApp personnel déjà utilisé par `runAlerts.ts` — jamais `dispatch()`.

**Tech Stack:** Scraper Node 22 / TypeScript ESM / vitest ; Supabase Postgres (migration SQL) ; Next.js 14 (composant client `WhatsAppPrefs.tsx`) ; GitHub Actions (cron).

Spec de référence : `docs/superpowers/specs/2026-07-30-alerte-these-invalidee-design.md`.

---

## Task 1: Migration `0124_these_alerte.sql`

**Files:**
- Create: `supabase/migrations/0124_these_alerte.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- ============================================================================
-- 0124_these_alerte.sql
-- Alerte thèse invalidée (#15) :
--  - dernier_statut_evalue / derniere_alerte_le sur investment_theses :
--    mémoire du dernier statut connu pour détecter la TRANSITION vers
--    'a-revoir' (le worker ne doit notifier qu'une fois par épisode, pas à
--    chaque exécution tant que le titre reste décroché).
--  - alerts_email sur notification_prefs : opt-in personnel pour un canal
--    email en plus du WhatsApp déjà existant.
--
-- RGPD : alerts_email est un booléen de préférence, décoché par défaut
-- (consentement explicite, même discipline que alerts_whatsapp). Aucune
-- nouvelle donnée d'identification stockée : l'adresse email provient de
-- auth.users (déjà là depuis l'inscription), jamais dupliquée ici.
-- Conservation/suppression : suit notification_prefs, déjà couvert par
-- /api/account/export et /api/account/delete (select('*') → automatique).
--
-- RLS : aucune nouvelle policy — les deux tables ont déjà une RLS
-- owner-strict qui porte sur la ligne entière, colonnes incluses.
-- ============================================================================

alter table public.investment_theses
  add column if not exists dernier_statut_evalue text
       check (dernier_statut_evalue in ('intacte','a-revoir','objectif-atteint')),
  add column if not exists derniere_alerte_le timestamptz;

alter table public.notification_prefs
  add column if not exists alerts_email boolean not null default false;

comment on column public.notification_prefs.alerts_email is
  'Opt-in email pour les alertes de titres/thèses. Décoché par défaut — consentement explicite.';
```

- [ ] **Step 2: Appliquer la migration**

Run: `supabase db push --linked` (depuis la racine du repo — le projet est déjà
lié aux sessions précédentes). Si la CLI Supabase n'est pas authentifiée dans
l'environnement d'exécution, utiliser l'outil MCP Supabase `apply_migration`
avec le contenu du fichier ci-dessus à la place.

Expected: `Applying migration 0124_these_alerte.sql... done` (ou équivalent
MCP), sans erreur.

- [ ] **Step 3: Vérifier les colonnes en base**

Run:
```bash
supabase db query --linked "select column_name, data_type from information_schema.columns where table_name in ('investment_theses','notification_prefs') and column_name in ('dernier_statut_evalue','derniere_alerte_le','alerts_email') order by 1;"
```
Expected: 3 lignes — `alerts_email` (boolean), `derniere_alerte_le`
(timestamp with time zone), `dernier_statut_evalue` (text).

- [ ] **Step 4: Sonde RLS — confirmer que les nouvelles colonnes restent protégées**

Run (remplacer `$ANON_KEY`/`$SUPABASE_URL` par les valeurs de
`frontend/.env.local`) :
```bash
curl -s "$SUPABASE_URL/rest/v1/notification_prefs?select=alerts_email" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```
Expected: `[]` (RLS bloque sans session utilisateur — aucune ligne visible en
anonyme, comme le reste de la table).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0124_these_alerte.sql
git commit -m "feat(db): colonnes de detection de transition + opt-in email (#15)"
```

---

## Task 2: Exporter `sendEmail` et prouver l'absence de diffusion globale

**Files:**
- Modify: `scraper/src/alerts/channels.ts:35`
- Test: `scraper/tests/channels.test.ts`

- [ ] **Step 1: Écrire le test qui échoue (sendEmail n'est pas encore exportée)**

Ajouter en fin de `scraper/tests/channels.test.ts` (après le dernier
`describe`, avant la fin du fichier) :

```ts
import { sendEmail } from '../src/alerts/channels.js';

describe('sendEmail — canal direct, sans diffusion globale', () => {
  it('envoie uniquement l\'email, sans toucher Telegram ni WhatsApp', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    process.env.TELEGRAM_CHAT_ID = 'chat';
    process.env.WHATSAPP_TO = '+225000000';
    const { bodies } = stubFetch();

    const res = await sendEmail({ to: 'utilisateur@example.com', subject: 'Sujet', body: 'Corps', code: 'SNTS' });

    expect(res).toEqual({ channel: 'email', status: 'sent' });
    // Un seul appel fetch (Resend) : la preuve que sendEmail() appelée seule
    // ne déclenche jamais dispatch() ni donc les canaux globaux de
    // l'exploitant (Telegram/WhatsApp) — c'est la correction centrale du
    // design #15 (voir spec §2).
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.to).toBe('utilisateur@example.com');
  });
});
```

- [ ] **Step 2: Lancer le test pour confirmer qu'il échoue**

Run (depuis `scraper/`): `npx vitest run tests/channels.test.ts`
Expected: FAIL — `"sendEmail" is not exported by "src/alerts/channels.ts"`
(erreur TypeScript/import, `sendEmail` est actuellement une fonction privée).

- [ ] **Step 3: Exporter `sendEmail`**

Dans `scraper/src/alerts/channels.ts:35`, changer :

```ts
async function sendEmail(n: Notification): Promise<SendResult | null> {
```

en :

```ts
export async function sendEmail(n: Notification): Promise<SendResult | null> {
```

- [ ] **Step 4: Relancer le test pour confirmer qu'il passe**

Run: `npx vitest run tests/channels.test.ts`
Expected: PASS — tous les tests du fichier (les existants + le nouveau) verts.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/alerts/channels.ts scraper/tests/channels.test.ts
git commit -m "feat(alerts): exporte sendEmail pour un envoi personnel direct (#15)"
```

---

## Task 3: Copie testée de `checkThesis` côté scraper

**Files:**
- Create: `scraper/src/theses/pure/status.ts`
- Test: `scraper/tests/theses-status.test.ts`

- [ ] **Step 1: Écrire le test qui échoue (le fichier n'existe pas encore)**

```ts
import { describe, it, expect } from 'vitest';
import { checkThesis } from '../src/theses/pure/status.js';

describe('checkThesis (copie scraper)', () => {
  it('intacte quand cours et signal vont dans le sens de la thèse', () => {
    const r = checkThesis({ stance: 'achat', coursReference: 1000, objectif: 1500, coursActuel: 1100, signalActuel: 'BUY' });
    expect(r.status).toBe('intacte');
    expect(r.perfPct).toBeCloseTo(10);
  });

  it('objectif-atteint quand le cours dépasse la cible (achat)', () => {
    const r = checkThesis({ stance: 'achat', coursReference: 1000, objectif: 1500, coursActuel: 1600, signalActuel: 'HOLD' });
    expect(r.status).toBe('objectif-atteint');
  });

  it('a-revoir quand le signal contredit la thèse', () => {
    const r = checkThesis({ stance: 'achat', coursReference: 1000, objectif: null, coursActuel: 1050, signalActuel: 'SELL' });
    expect(r.status).toBe('a-revoir');
    expect(r.raisons.length).toBeGreaterThan(0);
  });

  it('a-revoir quand le cours décroche fortement contre une thèse d achat', () => {
    const r = checkThesis({ stance: 'achat', coursReference: 1000, objectif: null, coursActuel: 750, signalActuel: 'HOLD' });
    expect(r.status).toBe('a-revoir');
  });

  it('gère les données manquantes (perf null, pas de plantage)', () => {
    const r = checkThesis({ stance: 'conserver', coursReference: null, objectif: null, coursActuel: null, signalActuel: null });
    expect(r.status).toBe('intacte');
    expect(r.perfPct).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test pour confirmer qu'il échoue**

Run (depuis `scraper/`): `npx vitest run tests/theses-status.test.ts`
Expected: FAIL — `Cannot find module '../src/theses/pure/status.js'`.

- [ ] **Step 3: Créer la copie**

Créer `scraper/src/theses/pure/status.ts` :

```ts
// Copie de frontend/lib/theses/status.ts — toute correction doit être
// reportée des deux côtés (pas de module partagé entre les deux paquets TS,
// même contrainte déjà rencontrée pour scraper/src/hebdo/pure/).
//
// Évalue si une thèse d'investissement tient toujours, en confrontant la
// conviction de l'utilisateur aux données réelles actuelles (cours + signal
// quantitatif). Fonction pure, testable. N'invente rien : compare seulement.

export type Stance = 'achat' | 'conserver' | 'vente';
export type ThesisStatus = 'intacte' | 'a-revoir' | 'objectif-atteint';

export interface ThesisCheckInput {
  stance: Stance;
  coursReference: number | null;
  objectif: number | null;
  coursActuel: number | null;
  signalActuel: 'BUY' | 'SELL' | 'HOLD' | null;
}

export interface ThesisCheckResult {
  status: ThesisStatus;
  perfPct: number | null; // évolution du cours depuis la rédaction
  raisons: string[];
}

const SIGNAL_STANCE: Record<string, Stance> = { BUY: 'achat', SELL: 'vente', HOLD: 'conserver' };

export function checkThesis(i: ThesisCheckInput): ThesisCheckResult {
  const raisons: string[] = [];
  const perfPct = i.coursReference && i.coursActuel ? (i.coursActuel / i.coursReference - 1) * 100 : null;

  // Objectif atteint (pour une thèse d'achat : cours ≥ objectif).
  if (i.objectif != null && i.coursActuel != null) {
    if (i.stance === 'achat' && i.coursActuel >= i.objectif) {
      raisons.push(`Objectif de ${i.objectif.toLocaleString('fr-FR')} FCFA atteint ou dépassé.`);
      return { status: 'objectif-atteint', perfPct, raisons };
    }
    if (i.stance === 'vente' && i.coursActuel <= i.objectif) {
      raisons.push(`Objectif de baisse (${i.objectif.toLocaleString('fr-FR')} FCFA) atteint.`);
      return { status: 'objectif-atteint', perfPct, raisons };
    }
  }

  // Le signal quantitatif contredit-il la conviction ?
  if (i.signalActuel) {
    const sigStance = SIGNAL_STANCE[i.signalActuel];
    const contradiction =
      (i.stance === 'achat' && i.signalActuel === 'SELL') ||
      (i.stance === 'vente' && i.signalActuel === 'BUY');
    if (contradiction) {
      raisons.push(`Le signal quantitatif (${sigStance}) contredit votre thèse (${i.stance}).`);
    }
  }

  // Décrochage marqué contre une thèse d'achat (ou rebond contre une thèse de vente).
  if (perfPct != null) {
    if (i.stance === 'achat' && perfPct <= -20) raisons.push(`Le cours a reculé de ${perfPct.toFixed(0)}% depuis votre thèse.`);
    if (i.stance === 'vente' && perfPct >= 20) raisons.push(`Le cours a progressé de +${perfPct.toFixed(0)}% malgré votre thèse de vente.`);
  }

  return { status: raisons.length > 0 ? 'a-revoir' : 'intacte', perfPct, raisons };
}
```

- [ ] **Step 4: Relancer le test pour confirmer qu'il passe**

Run: `npx vitest run tests/theses-status.test.ts`
Expected: PASS — 5/5 tests verts.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/theses/pure/status.ts scraper/tests/theses-status.test.ts
git commit -m "feat(theses): copie testee de checkThesis cote scraper (#15)"
```

---

## Task 4: Fonction pure `shouldNotify` (détection de transition)

**Files:**
- Create: `scraper/src/theses/runThesisAlerts.ts` (fonction `shouldNotify` uniquement à cette étape)
- Test: `scraper/tests/thesisAlerts.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
import { describe, it, expect } from 'vitest';
import { shouldNotify } from '../src/theses/runThesisAlerts.js';

describe('shouldNotify — front montant uniquement', () => {
  it('notifie sur la transition vers a-revoir depuis intacte', () => {
    expect(shouldNotify('a-revoir', 'intacte')).toBe(true);
  });
  it('ne répète pas si déjà a-revoir', () => {
    expect(shouldNotify('a-revoir', 'a-revoir')).toBe(false);
  });
  it('notifie si jamais évalué auparavant', () => {
    expect(shouldNotify('a-revoir', null)).toBe(true);
  });
  it('ne notifie pas un retour au vert (intacte après a-revoir)', () => {
    expect(shouldNotify('intacte', 'a-revoir')).toBe(false);
  });
  it('notifie une nouvelle transition après un objectif atteint', () => {
    expect(shouldNotify('a-revoir', 'objectif-atteint')).toBe(true);
  });
  it('ne notifie jamais sur objectif-atteint ou intacte en soi', () => {
    expect(shouldNotify('objectif-atteint', 'intacte')).toBe(false);
    expect(shouldNotify('intacte', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour confirmer qu'il échoue**

Run (depuis `scraper/`): `npx vitest run tests/thesisAlerts.test.ts`
Expected: FAIL — `Cannot find module '../src/theses/runThesisAlerts.js'`.

- [ ] **Step 3: Créer le fichier avec uniquement `shouldNotify`**

Créer `scraper/src/theses/runThesisAlerts.ts` :

```ts
import type { ThesisStatus } from './pure/status.js';

/**
 * Décide si une transition de statut mérite une notification : front montant
 * uniquement vers 'a-revoir'. Pas de répétition tant que le statut y reste
 * (un titre durablement décroché ne doit pas spammer l'utilisateur), pas de
 * notification sur 'objectif-atteint' (positif, hors périmètre de #15).
 */
export function shouldNotify(statutActuel: ThesisStatus, statutPrecedent: ThesisStatus | null): boolean {
  return statutActuel === 'a-revoir' && statutPrecedent !== 'a-revoir';
}
```

- [ ] **Step 4: Relancer le test pour confirmer qu'il passe**

Run: `npx vitest run tests/thesisAlerts.test.ts`
Expected: PASS — 6/6 tests verts.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/theses/runThesisAlerts.ts scraper/tests/thesisAlerts.test.ts
git commit -m "feat(theses): shouldNotify - detection de transition vers a-revoir (#15)"
```

---

## Task 5: Worker complet `runThesisAlerts`

**Files:**
- Modify: `scraper/src/theses/runThesisAlerts.ts` (ajoute `runThesisAlerts` sous `shouldNotify`)

- [ ] **Step 1: Compléter le fichier avec le worker**

Remplacer le contenu de `scraper/src/theses/runThesisAlerts.ts` en entier par :

```ts
/**
 * Worker d'évaluation des thèses d'investissement actives (#15).
 *  - charge les thèses actives (investment_theses) ;
 *  - recalcule leur statut avec checkThesis (cours + signal du jour) ;
 *  - notifie l'utilisateur UNIQUEMENT à la transition vers 'a-revoir' —
 *    jamais dispatch() : ce flux est personnel, pas une diffusion globale
 *    (voir docs/superpowers/specs/2026-07-30-alerte-these-invalidee-design.md §2) ;
 *  - journalise dans notifications_log, met à jour dernier_statut_evalue.
 *
 * Planifiable via cron (voir .github/workflows/thesis-alerts.yml).
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { checkThesis, type Stance, type ThesisStatus } from './pure/status.js';
import { sendEmail, sendWhatsAppTemplate, sendWhatsAppRaw } from '../alerts/channels.js';

interface ThesisRow {
  id: string;
  user_id: string;
  code: string;
  stance: Stance;
  cours_reference: number | null;
  objectif: number | null;
  dernier_statut_evalue: ThesisStatus | null;
}

export interface ThesisAlertsRunResult {
  status: 'success' | 'failed' | 'mock';
  evaluated: number;
  notified: number;
  message: string | null;
}

/**
 * Décide si une transition de statut mérite une notification : front montant
 * uniquement vers 'a-revoir'. Pas de répétition tant que le statut y reste
 * (un titre durablement décroché ne doit pas spammer l'utilisateur), pas de
 * notification sur 'objectif-atteint' (positif, hors périmètre de #15).
 */
export function shouldNotify(statutActuel: ThesisStatus, statutPrecedent: ThesisStatus | null): boolean {
  return statutActuel === 'a-revoir' && statutPrecedent !== 'a-revoir';
}

export async function runThesisAlerts(opts: { mock?: boolean } = {}): Promise<ThesisAlertsRunResult> {
  const cfg = getConfig();
  if (opts.mock || cfg.USE_MOCK) {
    logger.warn('Mode MOCK alertes de thèse : aucune notification envoyée');
    return { status: 'mock', evaluated: 0, notified: 0, message: null };
  }

  try {
    const sb = getSupabase();
    const { data: theses, error } = await sb
      .from('investment_theses')
      .select('id, user_id, code, stance, cours_reference, objectif, dernier_statut_evalue')
      .eq('statut', 'active');
    if (error) throw new Error(error.message);
    const rows = (theses ?? []) as ThesisRow[];
    if (rows.length === 0) return { status: 'success', evaluated: 0, notified: 0, message: null };

    // Derniers cours par code (un seul select batché, comme runAlerts.ts).
    const codes = [...new Set(rows.map((r) => r.code))];
    const { data: lastDateRow } = await sb
      .from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
    const lastDate = lastDateRow?.[0]?.date_marche as string | undefined;
    const coursByCode: Record<string, number | null> = {};
    if (lastDate) {
      const { data: quotes } = await sb
        .from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', lastDate).in('code', codes);
      for (const q of (quotes ?? []) as { code: string; cours_jour: number | null }[]) {
        coursByCode[q.code] = q.cours_jour;
      }
    }

    // Dernier signal par code.
    const signalByCode: Record<string, 'BUY' | 'SELL' | 'HOLD' | null> = {};
    const { data: sigs } = await sb
      .from('signals_daily').select('code, signal, date_marche')
      .in('code', codes).order('date_marche', { ascending: false });
    for (const s of (sigs ?? []) as { code: string; signal: 'BUY' | 'SELL' | 'HOLD' | null }[]) {
      if (!(s.code in signalByCode)) signalByCode[s.code] = s.signal; // garde le plus récent
    }

    // Prefs de notification par propriétaire de thèse (une lecture batchée).
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const prefsByUser = new Map<string, { phone: string | null; email: boolean }>();
    if (userIds.length > 0) {
      const { data: prefs } = await sb
        .from('notification_prefs')
        .select('user_id, whatsapp_phone, whatsapp_optin, alerts_whatsapp, alerts_email')
        .in('user_id', userIds);
      for (const p of (prefs ?? []) as {
        user_id: string; whatsapp_phone: string | null; whatsapp_optin: boolean;
        alerts_whatsapp: boolean; alerts_email: boolean;
      }[]) {
        const phoneCandidate = p.whatsapp_optin && p.alerts_whatsapp ? p.whatsapp_phone?.trim() ?? null : null;
        prefsByUser.set(p.user_id, {
          phone: phoneCandidate && /^\+\d{8,15}$/.test(phoneCandidate) ? phoneCandidate : null,
          email: p.alerts_email,
        });
      }
    }

    let notified = 0;
    for (const t of rows) {
      const check = checkThesis({
        stance: t.stance,
        coursReference: t.cours_reference,
        objectif: t.objectif,
        coursActuel: coursByCode[t.code] ?? null,
        signalActuel: signalByCode[t.code] ?? null,
      });

      const doNotify = shouldNotify(check.status, t.dernier_statut_evalue);
      if (doNotify) {
        notified++;
        const subject = `Thèse à revoir — ${t.code}`;
        const body = `Votre thèse « ${t.stance} » sur ${t.code} semble à revoir :\n${check.raisons.join('\n')}\nVoir : https://www.westbourse.com/journal`;
        const prefs = prefsByUser.get(t.user_id);
        const results: { channel: string; status: 'sent' | 'failed' }[] = [];

        if (prefs?.phone) {
          let wa = await sendWhatsAppTemplate(prefs.phone, 'these_a_revoir', [t.code, body]);
          if (wa?.status !== 'sent') wa = (await sendWhatsAppRaw(prefs.phone, `${subject}\n${body}`)) ?? wa;
          if (wa) results.push(wa);
        }
        if (prefs?.email) {
          try {
            const { data: userData } = await sb.auth.admin.getUserById(t.user_id);
            const email = userData?.user?.email;
            if (email) {
              const mail = await sendEmail({ to: email, subject, body, code: t.code });
              if (mail) results.push(mail);
            }
          } catch (err) {
            logger.warn(
              { err: err instanceof Error ? err.message : String(err), userId: t.user_id },
              'Récupération email utilisateur échouée — WhatsApp reste tenté indépendamment',
            );
          }
        }

        if (!cfg.DRY_RUN) {
          for (const r of results) {
            await sb.from('notifications_log').insert({
              user_id: t.user_id, alert_id: null, code: t.code,
              channel: r.channel, message: body, status: r.status,
            });
          }
        }
      }

      if (!cfg.DRY_RUN) {
        await sb.from('investment_theses').update({
          dernier_statut_evalue: check.status,
          ...(doNotify ? { derniere_alerte_le: new Date().toISOString() } : {}),
        }).eq('id', t.id);
      }
    }

    logger.info({ evaluated: rows.length, notified }, 'Évaluation des thèses terminée');
    return { status: 'success', evaluated: rows.length, notified, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Évaluation des thèses échouée');
    return { status: 'failed', evaluated: 0, notified: 0, message };
  }
}
```

- [ ] **Step 2: Vérifier le typage**

Run (depuis `scraper/`): `npx tsc -p tsconfig.json --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Relancer toute la suite scraper pour confirmer l'absence de régression**

Run: `npm test`
Expected: tous les tests verts, y compris `theses-status.test.ts` et
`thesisAlerts.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add scraper/src/theses/runThesisAlerts.ts
git commit -m "feat(theses): worker runThesisAlerts complet (#15)"
```

---

## Task 6: Câbler la commande CLI `these-alertes`

**Files:**
- Modify: `scraper/src/index.ts:49` (import) et après le `case 'obligations':` block (~ligne 266)
- Modify: `scraper/package.json` (scripts)

- [ ] **Step 1: Ajouter l'import**

Dans `scraper/src/index.ts`, après la ligne `import { runAlerts } from './alerts/runAlerts.js';` (ligne 49), ajouter :

```ts
import { runThesisAlerts } from './theses/runThesisAlerts.js';
```

- [ ] **Step 2: Ajouter le case, instrumenté avec `withMonitoring`**

Dans `scraper/src/index.ts`, juste après le bloc `case 'obligations': { ... }`
(qui se termine à la ligne 266 par `return res.status === 'failed' ? 1 : 0; }`),
insérer :

```ts
    case 'these-alertes': {
      const res = await monitored(
        { code: 'these-alertes', label: 'Alertes de thèses invalidées' },
        async () => {
          const r = await runThesisAlerts({ mock });
          const outcomeStatus = r.status === 'failed' ? 'failed' : 'success';
          return {
            value: r,
            outcome: {
              status: outcomeStatus,
              rows_extracted: r.evaluated,
              rows_upserted: r.notified,
              metadata: { status: r.status, evaluated: r.evaluated, notified: r.notified },
            },
          };
        },
      );
      return res.status === 'failed' ? 1 : 0;
    }
```

- [ ] **Step 3: Ajouter les scripts npm**

Dans `scraper/package.json`, après la ligne `"alerts:mock": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts alerts --mock",`, ajouter :

```json
    "these-alertes": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts these-alertes",
    "these-alertes:mock": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts these-alertes --mock",
```

- [ ] **Step 4: Vérifier le typage**

Run (depuis `scraper/`): `npx tsc -p tsconfig.json --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Tester la commande en mode mock**

Run (depuis `scraper/`): `npm run these-alertes:mock`
Expected: log `Mode MOCK alertes de thèse : aucune notification envoyée`,
process exit code 0.

- [ ] **Step 6: Commit**

```bash
git add scraper/src/index.ts scraper/package.json
git commit -m "feat(cli): commande these-alertes instrumentee (#15)"
```

---

## Task 7: Cron GitHub Actions

**Files:**
- Create: `.github/workflows/thesis-alerts.yml`

Suit le même gabarit que `.github/workflows/alerts.yml` (retry ×3, notification
Slack en cas d'échec). Pas d'étape « verify written » : contrairement à
`score`/`daily`, un run à **zéro** notification est un résultat normal la
plupart des jours (aucune thèse n'a forcément basculé) — un contrôle
« ≥ 1 attendu » y produirait un faux positif permanent.

- [ ] **Step 1: Créer le workflow**

```yaml
name: Thesis Alerts Evaluation

env:
  SCRAPER_TRIGGER: ${{ github.event_name == 'schedule' && 'cron' || 'manual' }}

on:
  schedule:
    # Après scoring (16:00 UTC) et les alertes de prix (16:30 UTC) : 16:40 UTC.
    # Lun-ven uniquement (séance BRVM).
    - cron: '40 16 * * 1-5'
  workflow_dispatch: {}

concurrency:
  group: thesis-alerts-evaluation
  cancel-in-progress: false

jobs:
  thesis-alerts:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      max-parallel: 1
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
      - name: Install scraper deps
        working-directory: scraper
        run: npm install

      - name: Run thesis alerts evaluation with retry
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LOG_LEVEL: info
          # Notification channels (all optional).
          # If any env var is missing, that channel is silently skipped.
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ALERTS_EMAIL_FROM: ${{ secrets.ALERTS_EMAIL_FROM }}
          WHATSAPP_TOKEN: ${{ secrets.WHATSAPP_TOKEN }}
          WHATSAPP_PHONE_ID: ${{ secrets.WHATSAPP_PHONE_ID }}
        run: |
          MAX_RETRIES=3
          RETRY_DELAY=30
          for attempt in $(seq 1 $MAX_RETRIES); do
            echo "Attempt $attempt/$MAX_RETRIES..."
            if npm run these-alertes; then
              echo "✅ Thesis alerts evaluation succeeded"
              exit 0
            else
              if [ $attempt -lt $MAX_RETRIES ]; then
                echo "⚠️ Attempt $attempt failed, retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
              fi
            fi
          done
          echo "❌ Thesis alerts evaluation failed after $MAX_RETRIES attempts"
          exit 1

      - name: Notify failure on Slack
        if: failure()
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
        run: |
          if [ -n "$SLACK_WEBHOOK" ]; then
            curl -X POST "$SLACK_WEBHOOK" \
              -H 'Content-Type: application/json' \
              -d "{\"text\":\"⚠️ Thesis Alerts Evaluation FAILED after 3 retries at $(date -u +'%H:%M UTC'). Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"}"
          fi
```

- [ ] **Step 2: Valider la syntaxe YAML**

Run: `npx -y js-yaml .github/workflows/thesis-alerts.yml > /dev/null && echo OK`
Expected: `OK` (aucune erreur de parsing).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/thesis-alerts.yml
git commit -m "feat(cron): planifie these-alertes 10 min apres les alertes de prix (#15)"
```

**Note opérationnelle (pas une tâche de code)** : le template Meta WhatsApp
`these_a_revoir` référencé dans `runThesisAlerts.ts` doit être créé et
approuvé dans le Meta Business Manager avant que le canal WhatsApp personnel
ne fonctionne hors fenêtre de 24 h — exactement la même contrainte déjà
acceptée pour le template `alerte_titre` des alertes de prix. Le repli
`sendWhatsAppRaw` continue de fonctionner dans la fenêtre de 24 h en
attendant l'approbation ; ce n'est pas un régression introduite par #15.

---

## Task 8: UI — case à cocher email personnel

**Files:**
- Modify: `frontend/components/settings/WhatsAppPrefs.tsx`

Le composant s'appelle « Notifications WhatsApp » mais gère désormais aussi un
canal email indépendant : la case doit être visible **que l'opt-in WhatsApp
soit actif ou non**, et le titre/sous-titre doivent rester honnêtes sur ce
qu'ils couvrent.

- [ ] **Step 1: Étendre l'interface `Prefs` et les valeurs par défaut**

Dans `frontend/components/settings/WhatsAppPrefs.tsx:8-20`, remplacer :

```ts
interface Prefs {
  whatsapp_phone: string | null;
  whatsapp_optin: boolean;
  brief_whatsapp: boolean;
  alerts_whatsapp: boolean;
}

const DEFAULTS: Prefs = {
  whatsapp_phone: null,
  whatsapp_optin: false,
  brief_whatsapp: false,
  alerts_whatsapp: false,
};
```

par :

```ts
interface Prefs {
  whatsapp_phone: string | null;
  whatsapp_optin: boolean;
  brief_whatsapp: boolean;
  alerts_whatsapp: boolean;
  alerts_email: boolean;
}

const DEFAULTS: Prefs = {
  whatsapp_phone: null,
  whatsapp_optin: false,
  brief_whatsapp: false,
  alerts_whatsapp: false,
  alerts_email: false,
};
```

- [ ] **Step 2: Inclure la colonne dans le `select` et le `upsert`**

Dans `frontend/components/settings/WhatsAppPrefs.tsx:40-44`, remplacer :

```ts
      const { data, error } = await sb
        .from('notification_prefs')
        .select('whatsapp_phone, whatsapp_optin, brief_whatsapp, alerts_whatsapp')
        .eq('user_id', userId)
        .maybeSingle();
```

par :

```ts
      const { data, error } = await sb
        .from('notification_prefs')
        .select('whatsapp_phone, whatsapp_optin, brief_whatsapp, alerts_whatsapp, alerts_email')
        .eq('user_id', userId)
        .maybeSingle();
```

Dans `frontend/components/settings/WhatsAppPrefs.tsx:65-75`, remplacer :

```ts
    const { error } = await sb.from('notification_prefs').upsert(
      {
        user_id: userId,
        whatsapp_phone: next.whatsapp_phone,
        whatsapp_optin: next.whatsapp_optin,
        whatsapp_optin_at: next.whatsapp_optin ? new Date().toISOString() : null,
        brief_whatsapp: next.brief_whatsapp,
        alerts_whatsapp: next.alerts_whatsapp,
      },
      { onConflict: 'user_id' },
    );
```

par :

```ts
    const { error } = await sb.from('notification_prefs').upsert(
      {
        user_id: userId,
        whatsapp_phone: next.whatsapp_phone,
        whatsapp_optin: next.whatsapp_optin,
        whatsapp_optin_at: next.whatsapp_optin ? new Date().toISOString() : null,
        brief_whatsapp: next.brief_whatsapp,
        alerts_whatsapp: next.alerts_whatsapp,
        alerts_email: next.alerts_email,
      },
      { onConflict: 'user_id' },
    );
```

- [ ] **Step 3: Renommer le titre du bloc pour rester honnête sur son contenu**

Dans `frontend/components/settings/WhatsAppPrefs.tsx:114-118`, remplacer :

```tsx
          <h2 className="text-sm font-semibold text-ivory">Notifications WhatsApp</h2>
          <p className="mt-0.5 text-xs text-muted">
            Brief quotidien et alertes de vos titres, directement sur WhatsApp.
          </p>
```

par :

```tsx
          <h2 className="text-sm font-semibold text-ivory">Notifications d&apos;alertes</h2>
          <p className="mt-0.5 text-xs text-muted">
            Brief quotidien et alertes de vos titres, sur WhatsApp et par email.
          </p>
```

- [ ] **Step 4: Ajouter la case email, visible indépendamment de l'opt-in WhatsApp**

Dans `frontend/components/settings/WhatsAppPrefs.tsx`, juste avant la ligne
`{state === 'saved' && ...}` (fin du JSX, après le `</>` qui ferme le bloc
conditionnel `!prefs.whatsapp_optin ? ... : ...`), ajouter un nouveau bloc
**hors** de la condition `whatsapp_optin` (donc toujours visible) :

```tsx
      <label className="flex items-center gap-2 text-sm text-muted border-t border-border/60 pt-3">
        <input
          type="checkbox"
          checked={prefs.alerts_email}
          onChange={(e) => void save({ ...prefs, alerts_email: e.target.checked })}
          className="accent-[#56D7FD]"
        />
        Recevoir un email si une de mes thèses d&apos;investissement est à revoir
      </label>

      {state === 'saved' && <p className="text-xs text-up">✓ Préférences enregistrées.</p>}
      {state === 'error' && <p className="text-xs text-down">{errMsg ?? 'Erreur — réessayez.'}</p>}
```

(cela remplace le bloc final existant `{state === 'saved' && ...} {state ===
'error' && ...}` — ne pas le dupliquer.)

- [ ] **Step 5: Vérifier le typage**

Run (depuis `frontend/`): `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Vérification manuelle**

Run: `npm run dev` (depuis `frontend/`), ouvrir
`http://localhost:3000/parametres/alertes` connecté avec un compte de test.
Vérifier : la case « Recevoir un email si une de mes thèses… » apparaît que
le WhatsApp soit activé ou non ; la cocher affiche « ✓ Préférences
enregistrées » ; recharger la page confirme la persistance (la case reste
cochée).

- [ ] **Step 7: Commit**

```bash
git add frontend/components/settings/WhatsAppPrefs.tsx
git commit -m "feat(ui): opt-in email personnel pour les alertes de theses (#15)"
```

---

## Self-Review

**Couverture de la spec** (`2026-07-30-alerte-these-invalidee-design.md`) :

- §2 (jamais `dispatch()`) → Task 5 (`runThesisAlerts` appelle `sendEmail`/
  `sendWhatsAppTemplate`/`sendWhatsAppRaw` directement) + Task 2 (test qui
  encode explicitement l'absence de diffusion globale).
- §3 (email sans nouvelle donnée stockée) → Task 5 (`auth.admin.getUserById`),
  Task 1 (colonne booléenne uniquement).
- §4/§5 (front montant, migration) → Task 1, Task 4.
- §6 (copie testée de `checkThesis`) → Task 3.
- §7 (worker, CLI, cron) → Task 5, Task 6, Task 7.
- §8 (UI) → Task 8.
- §9 (tests) → Task 2 (régression sendEmail), Task 3 (mirroir checkThesis),
  Task 4 (shouldNotify), Task 1 Step 4 (RGPD/RLS).
- §10 (hors périmètre) : rien à implémenter, confirmé non touché.
- §11 (risques) : traités inline (try/catch admin API en Task 5, commentaire
  anti-régression `dispatch()` en Task 2, note opérationnelle template Meta en
  Task 7).

**Balayage placeholders** : aucun « TBD »/« TODO » — chaque étape contient le
code exact à écrire.

**Cohérence des types** : `ThesisStatus` (Task 3) utilisé tel quel dans
`shouldNotify` (Task 4) et `runThesisAlerts` (Task 5) — pas de renommage entre
tâches. `ThesisAlertsRunResult` défini en Task 5 et consommé tel quel en
Task 6 (`r.status`, `r.evaluated`, `r.notified`).
