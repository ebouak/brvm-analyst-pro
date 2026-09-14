# Envoi hebdomadaire des dossiers valeur — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque samedi, après la production des PDF, envoyer par email et/ou Telegram à chaque porteur qui l'a demandé le dossier PDF de chaque action de son portefeuille — jamais deux fois la même semaine, jamais un PDF périmé sans le dire, jamais un message vide.

**Architecture:** Un job `dossiers:envoi` dans le paquet `scraper` (3ᵉ étape de `dossier.yml`), composé de deux modules **purs et testés** (`selection.ts`, `message.ts`) et d'un orchestrateur I/O (`runEnvoi.ts`) qui lit `notification_prefs` + `portfolios_positions`, télécharge les PDF du bucket privé, envoie via `channels.ts` (email Resend étendu aux pièces jointes, nouveau `sendTelegramDocument`) et journalise dans `dossier_envois` (idempotence par `(user_id, semaine, canal)`). Côté frontend : deux cases de consentement dans `/parametres/alertes` et l'export RGPD étendu.

**Tech Stack:** Node ≥ 20 / TypeScript ESM (`.js` dans les imports), vitest, `@supabase/supabase-js` (service_role), Resend HTTP API, Telegram Bot API (multipart `FormData`), Next.js 14 (composant client), PostgreSQL (migration SQL écrite, **pas appliquée** par l'exécutant).

**Spec :** `docs/superpowers/specs/2026-09-15-envoi-dossiers-design.md`

**Garde-fous d'exécution :** branche `main`, pas de worktree. Jamais `npm run build` (utiliser `npx tsc --noEmit`). Aucun secret en clair : tout vient de l'environnement. Les migrations sont écrites, jamais appliquées par l'exécutant.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0132_dossier_envois.sql` | Créer : colonnes de consentement, table `dossier_envois`, purge 90 j |
| `scraper/src/dossiers/selection.ts` | Créer : `cleSemaine`, `selectionnerLignes` — pur |
| `scraper/src/dossiers/message.ts` | Créer : `composerMessage` — pur |
| `scraper/src/dossiers/runEnvoi.ts` | Créer : orchestration I/O |
| `scraper/src/alerts/channels.ts` | Modifier : `attachments` sur `sendEmail`, exporter `sendTelegramDocument` |
| `scraper/src/index.ts` | Modifier : case `dossiers:envoi` |
| `scraper/package.json` | Modifier : scripts `dossiers:envoi`, `dossiers:envoi:mock` |
| `scraper/tests/dossiersSelection.test.ts` | Créer |
| `scraper/tests/dossiersMessage.test.ts` | Créer |
| `scraper/tests/channelsAttachments.test.ts` | Créer |
| `frontend/components/settings/DossiersPrefs.tsx` | Créer : deux cases de consentement |
| `frontend/app/parametres/alertes/page.tsx` | Modifier : monter `DossiersPrefs` |
| `frontend/app/api/account/export/route.ts` | Modifier : ajouter `dossier_envois` |
| `.github/workflows/dossier.yml` | Modifier : 3ᵉ étape |
| `CLAUDE.md` | Modifier : section du passage |

---

### Task 1 : Migration `0132` — consentement, journal, purge

**Files:**
- Create: `supabase/migrations/0132_dossier_envois.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 0132 — Envoi hebdomadaire des dossiers valeur : consentement, journal, purge.
--
-- RGPD. Finalité : recevoir chaque samedi le dossier PDF de chaque valeur
-- détenue. Base légale : consentement explicite, cases décochées par défaut.
-- Aucune donnée nouvelle : l'email vient de profiles, le chat_id de
-- l'appairage Telegram (0129). Conservation : jusqu'au retrait ou suppression
-- du compte (cascade). Export : /api/account/export (notification_prefs déjà
-- couverte ; dossier_envois ajoutée dans le même passage).

alter table public.notification_prefs
  add column if not exists dossiers_email    boolean not null default false,
  add column if not exists dossiers_telegram boolean not null default false,
  add column if not exists dossiers_optin_at timestamptz;

comment on column public.notification_prefs.dossiers_email is
  'Recevoir chaque samedi par email le dossier PDF de chaque valeur détenue. Consentement explicite.';
comment on column public.notification_prefs.dossiers_telegram is
  'Idem, sur la conversation Telegram appairée (telegram_chat_id). Consentement explicite.';
comment on column public.notification_prefs.dossiers_optin_at is
  'Première activation de l''un des deux canaux ; remis à null quand les deux sont décochés.';

-- ── Journal des envois : l'idempotence du samedi ─────────────────────────
-- Un (compte, semaine, canal) en `envoye` n'est jamais renvoyé, même si le
-- workflow est relancé à la main. `semaine` = lundi ISO de la semaine d'envoi.
create table if not exists public.dossier_envois (
  user_id    uuid not null references auth.users(id) on delete cascade,
  semaine    date not null,
  canal      text not null check (canal in ('email', 'telegram')),
  codes      text[] not null default '{}',
  statut     text not null check (statut in ('en_cours', 'envoye', 'echec', 'vide')),
  erreur     text,
  created_at timestamptz not null default now(),
  primary key (user_id, semaine, canal)
);

comment on table public.dossier_envois is
  'Journal des envois hebdomadaires de dossiers valeur. Idempotence par (user_id, semaine, canal). Donnée perso liée au compte : lecture owner, écriture service_role, rétention 90 jours, cascade à la suppression.';

alter table public.dossier_envois enable row level security;

drop policy if exists "dossier_envois_select_own" on public.dossier_envois;
create policy "dossier_envois_select_own" on public.dossier_envois
  for select using (auth.uid() = user_id);
-- Pas de policy insert/update/delete : seul service_role écrit (job scraper).

-- ── Purge 90 jours, dans la fonction de rétention existante (0129) ────────
create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  delete from public.auth_events        where created_at < now() - interval '12 months';
  delete from public.whatsapp_conversations where created_at < now() - interval '90 days';
  delete from public.whatsapp_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.telegram_conversations where created_at < now() - interval '90 days';
  delete from public.telegram_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.dossier_envois         where created_at < now() - interval '90 days';
end;
$$;

revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
```

- [ ] **Step 2 : Vérifier que le corps de la purge reprend bien les lignes existantes**

Run : `grep -n "delete from" supabase/migrations/0129_telegram_alerts.sql`
Expected : 7 lignes `delete from`, toutes présentes dans 0132 avec en plus `dossier_envois`. Si 0129 en contient d'autres, les recopier — une purge réécrite qui en oublie une **désactive** cette rétention en silence.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0132_dossier_envois.sql
git commit -m "feat(dossiers): consentement, journal d'envois et purge 90 j (migration 0132)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2 : `selection.ts` — semaine ISO, fraîcheur, tri, plafond (pur)

**Files:**
- Create: `scraper/src/dossiers/selection.ts`
- Test: `scraper/tests/dossiersSelection.test.ts`

- [ ] **Step 1 : Écrire les tests (échouent : module absent)**

```ts
// scraper/tests/dossiersSelection.test.ts
import { describe, it, expect } from 'vitest';
import { cleSemaine, selectionnerLignes, PLAFOND_EMAIL, FRAICHEUR_MS } from '../src/dossiers/selection.js';

const J = 24 * 3600 * 1000;
const maintenant = new Date('2026-09-19T11:30:00Z'); // un samedi

function ligne(code: string, quantite: number, cours: number | null, majIlYaJours: number | null, designation = code) {
  return {
    code,
    designation,
    quantite,
    cours,
    pdf_updated_at: majIlYaJours == null ? null : new Date(maintenant.getTime() - majIlYaJours * J).toISOString(),
  };
}

describe('cleSemaine', () => {
  it('renvoie le lundi ISO de la semaine, en date UTC', () => {
    expect(cleSemaine(new Date('2026-09-19T11:30:00Z'))).toBe('2026-09-14'); // samedi → lundi
    expect(cleSemaine(new Date('2026-09-14T00:10:00Z'))).toBe('2026-09-14'); // lundi → lui-même
    expect(cleSemaine(new Date('2026-09-20T23:59:00Z'))).toBe('2026-09-14'); // dimanche → lundi précédent
  });
});

describe('selectionnerLignes', () => {
  it('écarte un PDF de plus de 3 jours et le nomme avec sa raison', () => {
    const r = selectionnerLignes([ligne('NEIC', 10, 2750, 0), ligne('SVOC', 5, 1000, 8)], maintenant);
    expect(r.retenues.map((l) => l.code)).toEqual(['NEIC']);
    expect(r.exclues).toEqual([{ code: 'SVOC', designation: 'SVOC', raison: 'dossier de cette semaine non disponible' }]);
  });

  it('écarte un code sans PDF du tout', () => {
    const r = selectionnerLignes([ligne('XXXX', 1, 100, null)], maintenant);
    expect(r.retenues).toEqual([]);
    expect(r.exclues[0]?.code).toBe('XXXX');
  });

  it('trie par valorisation décroissante (quantité × cours), cours inconnu en dernier', () => {
    const r = selectionnerLignes(
      [ligne('A', 10, 100, 0), ligne('B', 1, 5000, 0), ligne('C', 100, null, 0)],
      maintenant,
    );
    expect(r.retenues.map((l) => l.code)).toEqual(['B', 'A', 'C']);
  });

  it('plafonne les pièces jointes email et liste le reste', () => {
    const lignes = Array.from({ length: PLAFOND_EMAIL + 3 }, (_, i) => ligne(`C${i}`, 1, 1000 - i, 0));
    const r = selectionnerLignes(lignes, maintenant);
    expect(r.retenues).toHaveLength(PLAFOND_EMAIL + 3);
    expect(r.pieces_jointes_email).toHaveLength(PLAFOND_EMAIL);
    expect(r.reste_email.map((l) => l.code)).toEqual([`C${PLAFOND_EMAIL}`, `C${PLAFOND_EMAIL + 1}`, `C${PLAFOND_EMAIL + 2}`]);
  });

  it('ignore les quantités nulles ou négatives', () => {
    const r = selectionnerLignes([ligne('A', 0, 100, 0), ligne('B', -3, 100, 0), ligne('C', 2, 100, 0)], maintenant);
    expect(r.retenues.map((l) => l.code)).toEqual(['C']);
    expect(r.exclues).toEqual([]);
  });

  it('la fraîcheur est exactement 3 jours', () => {
    expect(FRAICHEUR_MS).toBe(3 * J);
    const limite = selectionnerLignes([ligne('A', 1, 100, 3.01)], maintenant);
    expect(limite.retenues).toEqual([]);
    const ok = selectionnerLignes([ligne('A', 1, 100, 2.99)], maintenant);
    expect(ok.retenues).toHaveLength(1);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `cd scraper && npx vitest run tests/dossiersSelection.test.ts`
Expected : FAIL — `Cannot find module '../src/dossiers/selection.js'`.

- [ ] **Step 3 : Implémenter**

```ts
// scraper/src/dossiers/selection.ts
/**
 * Sélection des dossiers à envoyer — PUR, testé.
 *
 * Trois règles, toutes explicites ici et nulle part ailleurs :
 *   1. FRAÎCHEUR : un PDF de plus de 3 jours n'est pas envoyé. Il est ÉCARTÉ
 *      ET NOMMÉ dans le message. Un document périmé livré sans le dire est
 *      pire qu'un document absent.
 *   2. TRI : par valorisation décroissante (quantité × dernier cours) ; cours
 *      inconnu en dernier. C'est l'ordre dans lequel un porteur regarde son
 *      portefeuille.
 *   3. PLAFOND email : 12 pièces jointes (~2 Mo). Au-delà, le reste est
 *      listé comme disponible sur /portefeuille. Telegram n'a pas ce plafond
 *      (un document par envoi).
 */

export const FRAICHEUR_MS = 3 * 24 * 3600 * 1000;
export const PLAFOND_EMAIL = 12;
export const RAISON_PERIME = 'dossier de cette semaine non disponible';

export interface LigneCandidate {
  code: string;
  designation: string;
  quantite: number;
  /** Dernier cours connu, null si aucune cotation. */
  cours: number | null;
  /** `updated_at` de `<CODE>/dernier.pdf` dans le bucket, null si absent. */
  pdf_updated_at: string | null;
}

export interface LigneRetenue {
  code: string;
  designation: string;
  valorisation: number | null;
}

export interface LigneExclue {
  code: string;
  designation: string;
  raison: string;
}

export interface Selection {
  retenues: LigneRetenue[];
  exclues: LigneExclue[];
  pieces_jointes_email: LigneRetenue[];
  reste_email: LigneRetenue[];
}

/** Lundi ISO de la semaine contenant `d`, au format AAAA-MM-JJ (UTC). */
export function cleSemaine(d: Date): string {
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jour = u.getUTCDay(); // 0 = dimanche
  const recul = jour === 0 ? 6 : jour - 1;
  u.setUTCDate(u.getUTCDate() - recul);
  return u.toISOString().slice(0, 10);
}

export function selectionnerLignes(lignes: LigneCandidate[], maintenant: Date): Selection {
  const retenues: LigneRetenue[] = [];
  const exclues: LigneExclue[] = [];
  const seuil = maintenant.getTime() - FRAICHEUR_MS;

  for (const l of lignes) {
    if (!(l.quantite > 0)) continue;
    const maj = l.pdf_updated_at ? Date.parse(l.pdf_updated_at) : NaN;
    if (!Number.isFinite(maj) || maj < seuil) {
      exclues.push({ code: l.code, designation: l.designation, raison: RAISON_PERIME });
      continue;
    }
    retenues.push({
      code: l.code,
      designation: l.designation,
      valorisation: l.cours != null ? l.quantite * l.cours : null,
    });
  }

  retenues.sort((a, b) => {
    if (a.valorisation == null && b.valorisation == null) return a.code.localeCompare(b.code);
    if (a.valorisation == null) return 1;
    if (b.valorisation == null) return -1;
    return b.valorisation - a.valorisation;
  });

  return {
    retenues,
    exclues,
    pieces_jointes_email: retenues.slice(0, PLAFOND_EMAIL),
    reste_email: retenues.slice(PLAFOND_EMAIL),
  };
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run : `cd scraper && npx vitest run tests/dossiersSelection.test.ts`
Expected : `Tests  7 passed`.

- [ ] **Step 5 : Commit**

```bash
git add scraper/src/dossiers/selection.ts scraper/tests/dossiersSelection.test.ts
git commit -m "feat(dossiers): sélection pure — semaine ISO, fraîcheur 3 j, tri, plafond 12

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3 : `message.ts` — sujet et corps sans chiffre (pur)

**Files:**
- Create: `scraper/src/dossiers/message.ts`
- Test: `scraper/tests/dossiersMessage.test.ts`

- [ ] **Step 1 : Écrire les tests (échouent : module absent)**

```ts
// scraper/tests/dossiersMessage.test.ts
import { describe, it, expect } from 'vitest';
import { composerMessage } from '../src/dossiers/message.js';
import type { Selection } from '../src/dossiers/selection.js';

const sel: Selection = {
  retenues: [
    { code: 'NEIC', designation: 'NEI CEDA CI', valorisation: 27500 },
    { code: 'SGBC', designation: 'SOCIETE GENERALE CI', valorisation: 15000 },
  ],
  exclues: [{ code: 'SVOC', designation: 'SOLIBRA', raison: 'dossier de cette semaine non disponible' }],
  pieces_jointes_email: [{ code: 'NEIC', designation: 'NEI CEDA CI', valorisation: 27500 }],
  reste_email: [{ code: 'SGBC', designation: 'SOCIETE GENERALE CI', valorisation: 15000 }],
};

describe('composerMessage', () => {
  const m = composerMessage(sel, '2026-09-14', 'email');

  it('sujet daté du lundi de la semaine', () => {
    expect(m.sujet).toBe('Vos dossiers valeur — semaine du 14/09/2026');
  });

  it('une ligne par pièce jointe, le reste renvoyé au portefeuille, les exclus nommés', () => {
    expect(m.corps).toContain('NEIC — NEI CEDA CI');
    expect(m.corps).toContain('SGBC — SOCIETE GENERALE CI');
    expect(m.corps).toContain('/portefeuille');
    expect(m.corps).toContain('SVOC — SOLIBRA : dossier de cette semaine non disponible');
  });

  it('porte le cadre et le rappel de retrait', () => {
    expect(m.corps).toContain('ne constitue pas un conseil en investissement');
    expect(m.corps).toContain('Paramètres › Alertes');
  });

  it('AUCUN chiffre dans le corps, hors dates JJ/MM/AAAA', () => {
    const sansDates = m.corps.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '');
    expect(sansDates).not.toMatch(/\d/);
  });

  it('en Telegram, pas de plafond : toutes les retenues sont listées, sans renvoi au portefeuille', () => {
    const t = composerMessage(sel, '2026-09-14', 'telegram');
    expect(t.corps).toContain('NEIC — NEI CEDA CI');
    expect(t.corps).toContain('SGBC — SOCIETE GENERALE CI');
    expect(t.corps).not.toContain('/portefeuille');
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `cd scraper && npx vitest run tests/dossiersMessage.test.ts`
Expected : FAIL — module absent.

- [ ] **Step 3 : Implémenter**

```ts
// scraper/src/dossiers/message.ts
/**
 * Texte du message hebdomadaire — PUR, testé.
 *
 * AUCUN CHIFFRE hors dates. Les chiffres sont dans les PDF, déjà vérifiés
 * ligne à ligne ; en remettre ici créerait une seconde source à tenir juste,
 * et un jour elle divergerait. Le test `AUCUN chiffre` fait respecter cette
 * règle à chaque modification du gabarit.
 *
 * Texte brut, pas de HTML : lisible partout, rien à échapper, rien à styler.
 */
import type { Selection } from './selection.js';

export interface Message {
  sujet: string;
  corps: string;
}

/** AAAA-MM-JJ → JJ/MM/AAAA */
function dateFR(iso: string): string {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

export function composerMessage(sel: Selection, semaine: string, canal: 'email' | 'telegram'): Message {
  const sujet = `Vos dossiers valeur — semaine du ${dateFR(semaine)}`;
  const jointes = canal === 'email' ? sel.pieces_jointes_email : sel.retenues;
  const reste = canal === 'email' ? sel.reste_email : [];

  const lignes: string[] = [];
  lignes.push(sujet, '');
  lignes.push(
    canal === 'email'
      ? 'Vous trouverez en pièces jointes le dossier de chaque valeur de votre portefeuille :'
      : 'Voici le dossier de chaque valeur de votre portefeuille :',
  );
  for (const l of jointes) lignes.push(`  • ${l.code} — ${l.designation} — dossier de sept pages`);

  if (reste.length > 0) {
    lignes.push('', 'Également disponibles sur votre portefeuille (limite de pièces jointes atteinte) :');
    for (const l of reste) lignes.push(`  • ${l.code} — ${l.designation}`);
    lignes.push('  https://www.westbourse.com/portefeuille');
  }

  if (sel.exclues.length > 0) {
    lignes.push('', 'Non envoyés cette semaine :');
    for (const e of sel.exclues) lignes.push(`  • ${e.code} — ${e.designation} : ${e.raison}`);
  }

  lignes.push(
    '',
    'Document d’information établi à partir des données Westbourse ; ne constitue pas un conseil en investissement.',
    '',
    'Vous recevez ceci parce que vous l’avez activé dans Paramètres › Alertes. Pour arrêter : décochez la case.',
  );

  return { sujet, corps: lignes.join('\n') };
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run : `cd scraper && npx vitest run tests/dossiersMessage.test.ts`
Expected : `Tests  5 passed`.

- [ ] **Step 5 : Commit**

```bash
git add scraper/src/dossiers/message.ts scraper/tests/dossiersMessage.test.ts
git commit -m "feat(dossiers): message hebdomadaire pur, sans chiffre hors dates

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4 : `channels.ts` — pièces jointes email, document Telegram

**Files:**
- Modify: `scraper/src/alerts/channels.ts` (interface `Notification` lignes 11-28, `sendEmail` lignes 47-72, après `sendTelegram`)
- Test: `scraper/tests/channelsAttachments.test.ts`

- [ ] **Step 1 : Écrire le test (échoue : `attachments` inconnu, `sendTelegramDocument` absent)**

```ts
// scraper/tests/channelsAttachments.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, sendTelegramDocument } from '../src/alerts/channels.js';

describe('sendEmail avec pièces jointes', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.ALERTS_EMAIL_FROM = 'noreply@example.test';
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it('transmet filename + content base64 dans le corps Resend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const pdf = Buffer.from('%PDF-1.4 test');
    const r = await sendEmail({
      to: 'client@example.test',
      subject: 'S',
      body: 'B',
      attachments: [{ filename: 'westbourse-dossier-NEIC.pdf', content: pdf }],
    });
    expect(r?.status).toBe('sent');
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(body.attachments).toEqual([{ filename: 'westbourse-dossier-NEIC.pdf', content: pdf.toString('base64') }]);
  });

  it('sans attachments, le corps Resend ne porte pas la clé', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await sendEmail({ to: 'client@example.test', subject: 'S', body: 'B' });
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(body).not.toHaveProperty('attachments');
  });
});

describe('sendTelegramDocument', () => {
  const env = { ...process.env };
  beforeEach(() => { process.env.TELEGRAM_BOT_TOKEN = '123:abc'; });
  afterEach(() => { process.env = { ...env }; vi.restoreAllMocks(); });

  it('poste en multipart vers sendDocument avec chat_id, document et caption', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    const r = await sendTelegramDocument(4242, Buffer.from('%PDF'), 'westbourse-dossier-NEIC.pdf', 'NEIC — NEI CEDA CI');
    expect(r?.status).toBe('sent');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.telegram.org/bot123:abc/sendDocument');
    const form = init!.body as FormData;
    expect(form.get('chat_id')).toBe('4242');
    expect(form.get('caption')).toBe('NEIC — NEI CEDA CI');
    expect((form.get('document') as File).name).toBe('westbourse-dossier-NEIC.pdf');
  });

  it('sans jeton, ne fait rien et rend null', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(await sendTelegramDocument(1, Buffer.from('x'), 'a.pdf', 'a')).toBeNull();
  });

  it('relaie la description Telegram, jamais l’URL (qui contient le jeton)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":false,"description":"Bad Request: chat not found"}', { status: 400 }));
    const r = await sendTelegramDocument(1, Buffer.from('x'), 'a.pdf', 'a');
    expect(r).toEqual({ channel: 'telegram', status: 'failed', error: 'Bad Request: chat not found' });
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `cd scraper && npx vitest run tests/channelsAttachments.test.ts`
Expected : FAIL (erreur de type sur `attachments` ou `sendTelegramDocument is not a function`).

- [ ] **Step 3 : Étendre `Notification` et `sendEmail`**

Dans `scraper/src/alerts/channels.ts`, ajouter à l'interface `Notification` (après `operateur?: boolean;`) :

```ts
  /**
   * Pièces jointes (email seulement). Resend attend le contenu en base64 ;
   * on accepte un Buffer et on encode ici, pour que l'appelant manipule des
   * octets, jamais du texte encodé.
   */
  attachments?: { filename: string; content: Buffer }[];
```

Puis remplacer dans `sendEmail` la ligne
`body: JSON.stringify({ from, to, subject: n.subject, text: n.body }),`
par :

```ts
      body: JSON.stringify({
        from,
        to,
        subject: n.subject,
        text: n.body,
        ...(n.attachments && n.attachments.length > 0
          ? { attachments: n.attachments.map((a) => ({ filename: a.filename, content: a.content.toString('base64') })) }
          : {}),
      }),
```

- [ ] **Step 4 : Ajouter `sendTelegramDocument` (après `sendTelegram`, avant `whatsAppConfig`)**

```ts
/**
 * Envoie un DOCUMENT (PDF) à une conversation Telegram, en multipart.
 * Même règle que sendTelegram : destinataire explicite, aucun repli vers la
 * conversation de l'exploitant. Modèle : sendVideo dans video/publie.mjs.
 *
 * Le message d'erreur de Telegram peut contenir l'URL appelée, donc le jeton :
 * on ne relaie que `description`.
 */
export async function sendTelegramDocument(
  chatId: number | string,
  octets: Buffer,
  filename: string,
  caption: string,
): Promise<SendResult | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return null;
  try {
    const form = new FormData();
    form.set('chat_id', String(chatId));
    form.set('document', new Blob([octets], { type: 'application/pdf' }), filename);
    form.set('caption', caption.slice(0, 1024));
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
    const rep = (await resp.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!resp.ok || !rep.ok) {
      return { channel: 'telegram', status: 'failed', error: rep.description ?? `HTTP ${resp.status}` };
    }
    return { channel: 'telegram', status: 'sent' };
  } catch (err) {
    return { channel: 'telegram', status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 5 : Lancer, vérifier le succès + non-régression**

Run : `cd scraper && npx vitest run tests/channelsAttachments.test.ts tests/alerts.test.ts && npx tsc --noEmit`
Expected : tous verts, tsc silencieux.

- [ ] **Step 6 : Commit**

```bash
git add scraper/src/alerts/channels.ts scraper/tests/channelsAttachments.test.ts
git commit -m "feat(alerts): pièces jointes Resend et sendTelegramDocument multipart

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5 : `runEnvoi.ts` — orchestration, journal, CLI

**Files:**
- Create: `scraper/src/dossiers/runEnvoi.ts`
- Modify: `scraper/src/index.ts` (ajouter un `case` après `case 'hebdo'`, ligne 190)
- Modify: `scraper/package.json` (scripts, après la ligne `"hebdo:mock"`)

- [ ] **Step 1 : Écrire l'orchestrateur**

```ts
// scraper/src/dossiers/runEnvoi.ts
/**
 * Envoi hebdomadaire des dossiers valeur — orchestration I/O.
 *
 * Toute la logique de décision est dans selection.ts et message.ts (purs,
 * testés). Ici : lire, télécharger, envoyer, journaliser. Un compte en échec
 * n'arrête pas le lot ; le résultat compte envoyés / vides / échecs et
 * l'appelant sort en code 1 s'il y a au moins un échec.
 *
 * IDEMPOTENCE : une ligne dossier_envois (user_id, semaine, canal) est écrite
 * en `en_cours` AVANT l'envoi, puis passée à `envoye` ou `echec`. Un compte
 * déjà `envoye` cette semaine est sauté — relancer le workflow ne renvoie
 * rien.
 *
 * FRAÎCHEUR : seul `<CODE>/dernier.pdf` mis à jour depuis moins de 3 jours
 * est envoyé (selection.ts). Un PDF périmé est nommé dans le message.
 *
 * --mock : n'envoie rien, n'écrit rien, imprime ce qui serait parti.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { sendEmail, sendTelegramDocument } from '../alerts/channels.js';
import { cleSemaine, selectionnerLignes, type LigneCandidate, type Selection } from './selection.js';
import { composerMessage } from './message.js';

const BUCKET = 'dossiers';

export interface EnvoiResult {
  semaine: string;
  comptes: number;
  envoyes: number;
  vides: number;
  echecs: number;
  sautes: number;
}

interface Pref {
  user_id: string;
  dossiers_email: boolean;
  dossiers_telegram: boolean;
  telegram_chat_id: number | null;
}

export async function runEnvoi(opts: { mock?: boolean } = {}): Promise<EnvoiResult> {
  const mock = Boolean(opts.mock);
  const sb = getSupabase();
  const maintenant = new Date();
  const semaine = cleSemaine(maintenant);
  const res: EnvoiResult = { semaine, comptes: 0, envoyes: 0, vides: 0, echecs: 0, sautes: 0 };

  // 1. Comptes éligibles
  const { data: prefsRows, error: e1 } = await sb
    .from('notification_prefs')
    .select('user_id, dossiers_email, dossiers_telegram, telegram_chat_id')
    .or('dossiers_email.eq.true,dossiers_telegram.eq.true');
  if (e1) throw new Error(`notification_prefs : ${e1.message}`);
  const prefs = (prefsRows ?? []) as Pref[];
  res.comptes = prefs.length;
  if (prefs.length === 0) return res;

  // 2. Emails (profiles), positions, désignations, derniers cours, PDF — en une passe chacun
  const userIds = prefs.map((p) => p.user_id);
  const [{ data: profils }, { data: positions }, { data: instruments }, { data: derniere }] = await Promise.all([
    sb.from('profiles').select('id, email').in('id', userIds),
    sb.from('portfolios_positions').select('user_id, code, quantite').in('user_id', userIds),
    sb.from('brvm_instruments').select('code, designation'),
    sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const emailPar = new Map((profils ?? []).map((p: { id: string; email: string | null }) => [p.id, p.email]));
  const nomPar = new Map((instruments ?? []).map((i: { code: string; designation: string | null }) => [i.code, i.designation ?? i.code]));

  const coursPar = new Map<string, number>();
  if (derniere?.date_marche) {
    const { data: cours } = await sb.from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', derniere.date_marche);
    for (const c of (cours ?? []) as { code: string; cours_jour: number | null }[]) if (c.cours_jour != null) coursPar.set(c.code, c.cours_jour);
  }

  // 3. Fraîcheur des PDF : un listing par code détenu (bucket privé, service_role)
  const codesDetenus = Array.from(new Set((positions ?? []).map((p: { code: string }) => p.code)));
  const majPar = new Map<string, string | null>();
  for (const code of codesDetenus) {
    const { data: objets } = await sb.storage.from(BUCKET).list(code, { search: 'dernier.pdf' });
    const o = (objets ?? []).find((x) => x.name === 'dernier.pdf');
    majPar.set(code, o?.updated_at ?? null);
  }

  // 4. Déjà envoyés cette semaine
  const { data: dejaRows } = await sb.from('dossier_envois').select('user_id, canal').eq('semaine', semaine).eq('statut', 'envoye');
  const deja = new Set((dejaRows ?? []).map((r: { user_id: string; canal: string }) => `${r.user_id}:${r.canal}`));

  const pdfCache = new Map<string, Buffer>();
  const telecharger = async (code: string): Promise<Buffer> => {
    const cached = pdfCache.get(code);
    if (cached) return cached;
    const { data, error } = await sb.storage.from(BUCKET).download(`${code}/dernier.pdf`);
    if (error || !data) throw new Error(`${code}/dernier.pdf : ${error?.message ?? 'vide'}`);
    const buf = Buffer.from(await data.arrayBuffer());
    pdfCache.set(code, buf);
    return buf;
  };

  const journal = async (user_id: string, canal: 'email' | 'telegram', statut: 'en_cours' | 'envoye' | 'echec' | 'vide', codes: string[], erreur?: string) => {
    if (mock) return;
    const { error } = await sb.from('dossier_envois').upsert({ user_id, semaine, canal, codes, statut, erreur: erreur ?? null }, { onConflict: 'user_id,semaine,canal' });
    if (error) logger.warn({ user_id, canal, err: error.message }, 'dossier_envois : écriture du journal échouée');
  };

  // 5. Par compte, par canal
  for (const p of prefs) {
    const lignes: LigneCandidate[] = (positions ?? [])
      .filter((x: { user_id: string }) => x.user_id === p.user_id)
      .map((x: { code: string; quantite: number }) => ({
        code: x.code,
        designation: nomPar.get(x.code) ?? x.code,
        quantite: Number(x.quantite),
        cours: coursPar.get(x.code) ?? null,
        pdf_updated_at: majPar.get(x.code) ?? null,
      }));
    const sel: Selection = selectionnerLignes(lignes, maintenant);

    const canaux: ('email' | 'telegram')[] = [];
    if (p.dossiers_email && emailPar.get(p.user_id)) canaux.push('email');
    if (p.dossiers_telegram && p.telegram_chat_id) canaux.push('telegram');

    for (const canal of canaux) {
      if (deja.has(`${p.user_id}:${canal}`)) { res.sautes += 1; continue; }

      if (sel.retenues.length === 0) {
        await journal(p.user_id, canal, 'vide', []);
        res.vides += 1;
        continue;
      }

      const msg = composerMessage(sel, semaine, canal);
      const codes = (canal === 'email' ? sel.pieces_jointes_email : sel.retenues).map((l) => l.code);
      await journal(p.user_id, canal, 'en_cours', codes);

      if (mock) {
        logger.info({ user_id: p.user_id, canal, codes, sujet: msg.sujet }, 'mock : envoi simulé');
        res.envoyes += 1;
        continue;
      }

      try {
        if (canal === 'email') {
          const attachments = [];
          for (const l of sel.pieces_jointes_email) attachments.push({ filename: `westbourse-dossier-${l.code}.pdf`, content: await telecharger(l.code) });
          const r = await sendEmail({ to: emailPar.get(p.user_id)!, subject: msg.sujet, body: msg.corps, attachments });
          if (!r || r.status !== 'sent') throw new Error(r?.error ?? 'email non configuré');
        } else {
          const ouverture = await sendEmailLikeTelegram(p.telegram_chat_id!, msg.sujet, msg.corps);
          if (ouverture && ouverture.status !== 'sent') throw new Error(ouverture.error);
          for (const l of sel.retenues) {
            const r = await sendTelegramDocument(p.telegram_chat_id!, await telecharger(l.code), `westbourse-dossier-${l.code}.pdf`, `${l.code} — ${l.designation}`);
            if (!r || r.status !== 'sent') throw new Error(`${l.code} : ${r?.error ?? 'telegram non configuré'}`);
          }
        }
        await journal(p.user_id, canal, 'envoye', codes);
        res.envoyes += 1;
      } catch (err) {
        const e = err instanceof Error ? err.message : String(err);
        await journal(p.user_id, canal, 'echec', codes, e);
        res.echecs += 1;
        logger.error({ user_id: p.user_id, canal, err: e }, 'envoi de dossiers échoué');
      }
    }
  }

  logger.info(res, 'envoi des dossiers terminé');
  return res;
}

/**
 * Message d'ouverture Telegram (texte) avant les documents. Passe par
 * l'export `dispatch`-compatible de channels.ts : on réutilise sendTelegram
 * via une Notification portant telegramChatId, sans repli opérateur.
 */
async function sendEmailLikeTelegram(chatId: number, subject: string, body: string) {
  const { sendTelegramText } = await import('../alerts/channels.js');
  return sendTelegramText({ subject, body, telegramChatId: chatId });
}
```

**Note d'implémentation :** `sendTelegram` de `channels.ts` n'est pas exporté. Exporter un alias nommé `sendTelegramText` : ajouter à la fin de `channels.ts` :

```ts
/** Export nominal du canal texte Telegram (utilisé par dossiers/runEnvoi.ts). */
export const sendTelegramText = sendTelegram;
```

- [ ] **Step 2 : Brancher la commande CLI**

Dans `scraper/src/index.ts`, après le `case 'hebdo': { … }` (ligne 190), ajouter :

```ts
    case 'dossiers:envoi': {
      const { runEnvoi } = await import('./dossiers/runEnvoi.js');
      const res = await monitored(
        { code: 'dossiers-envoi', label: 'Envoi des dossiers valeur' },
        async () => {
          const r = await runEnvoi({ mock });
          return {
            value: r,
            outcome: {
              status: r.echecs > 0 ? 'partial' : 'success',
              rows_extracted: r.comptes,
              rows_upserted: r.envoyes,
              metadata: { semaine: r.semaine, envoyes: r.envoyes, vides: r.vides, echecs: r.echecs, sautes: r.sautes },
            },
          };
        },
      );
      return res.value.echecs > 0 ? 1 : 0;
    }
```

- [ ] **Step 3 : Scripts npm**

Dans `scraper/package.json`, après `"hebdo:mock": …,` :

```json
    "dossiers:envoi": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts dossiers:envoi",
    "dossiers:envoi:mock": "NODE_TLS_REJECT_UNAUTHORIZED=0 tsx src/index.ts dossiers:envoi --mock",
```

- [ ] **Step 4 : Typecheck et mock**

Run : `cd scraper && npx tsc --noEmit && npm run dossiers:envoi:mock`
Expected : tsc silencieux ; le mock journalise `envoi des dossiers terminé` avec `comptes: 0` (aucune case cochée encore) et sort en 0. Si `notification_prefs` n'a pas encore les colonnes (migration non appliquée), l'erreur `notification_prefs : column … does not exist` est attendue et **acceptable à ce stade** — l'utilisateur applique 0132 avant le premier vrai passage.

- [ ] **Step 5 : Commit**

```bash
git add scraper/src/dossiers/runEnvoi.ts scraper/src/index.ts scraper/package.json scraper/src/alerts/channels.ts
git commit -m "feat(dossiers): job d'envoi hebdomadaire — sélection, journal idempotent, CLI

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6 : Consentement dans `/parametres/alertes`

**Files:**
- Create: `frontend/components/settings/DossiersPrefs.tsx`
- Modify: `frontend/app/parametres/alertes/page.tsx` (après `<TelegramPrefs userId={user.id} />`, ligne 55)

- [ ] **Step 1 : Composant**

```tsx
// frontend/components/settings/DossiersPrefs.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Consentement à l'envoi hebdomadaire des dossiers valeur (migration 0132).
 *
 * Deux cases, décochées par défaut : email, Telegram. La case Telegram est
 * désactivée tant que la conversation n'est pas appairée (telegram_chat_id
 * nul) — et ce composant n'écrit JAMAIS telegram_chat_id : seul le webhook
 * le pose, après validation d'un code. Même règle que TelegramPrefs.
 *
 * dossiers_optin_at : posé à la première activation, remis à null quand les
 * deux cases sont décochées — c'est l'horodatage du consentement (preuve RGPD).
 */

interface Prefs {
  dossiers_email: boolean;
  dossiers_telegram: boolean;
  dossiers_optin_at: string | null;
  telegram_chat_id: number | null;
}

const DEFAULTS: Prefs = { dossiers_email: false, dossiers_telegram: false, dossiers_optin_at: null, telegram_chat_id: null };

export default function DossiersPrefs({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'error' | 'unavailable'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const supabase = createClient();

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('notification_prefs')
      .select('dossiers_email, dossiers_telegram, dossiers_optin_at, telegram_chat_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      // 42703 = colonne inconnue : migration 0132 non appliquée → on masque.
      setState(error.code === '42703' || error.code === '42P01' ? 'unavailable' : 'error');
      setErrMsg(error.message);
      return;
    }
    if (data) setPrefs({ ...DEFAULTS, ...(data as unknown as Prefs) });
    setState('ready');
  }, [supabase, userId]);

  useEffect(() => { void charger(); }, [charger]);

  const enregistrer = async (patch: Partial<Pick<Prefs, 'dossiers_email' | 'dossiers_telegram'>>) => {
    setState('saving');
    setErrMsg(null);
    const suivant = { ...prefs, ...patch };
    const actif = suivant.dossiers_email || suivant.dossiers_telegram;
    const optinAt = actif ? (prefs.dossiers_optin_at ?? new Date().toISOString()) : null;
    setPrefs({ ...suivant, dossiers_optin_at: optinAt });

    const { error } = await supabase.from('notification_prefs').upsert(
      { user_id: userId, dossiers_email: suivant.dossiers_email, dossiers_telegram: suivant.dossiers_telegram, dossiers_optin_at: optinAt },
      { onConflict: 'user_id' },
    );
    if (error) { setState('error'); setErrMsg(error.message); return; }
    setState('ready');
  };

  if (state === 'unavailable') return null;

  const telegramAppaire = prefs.telegram_chat_id != null;

  return (
    <section className="rounded-panel border border-border bg-surface p-5 space-y-3">
      <h2 className="font-display text-lg text-white">Dossiers valeur du samedi</h2>
      <p className="text-sm text-muted">
        Chaque samedi, le dossier PDF (sept pages) de chaque valeur de votre portefeuille. Rien n&apos;est envoyé
        si votre portefeuille est vide.
      </p>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={prefs.dossiers_email}
          disabled={state !== 'ready'}
          onChange={(e) => void enregistrer({ dossiers_email: e.target.checked })}
          className="mt-1"
        />
        <span>
          <span className="text-ivory">Par email</span>
          <span className="block text-xs text-faint">Les PDF en pièces jointes, à l&apos;adresse de votre compte.</span>
        </span>
      </label>

      <label className={`flex items-start gap-3 text-sm ${telegramAppaire ? '' : 'opacity-60'}`}>
        <input
          type="checkbox"
          checked={prefs.dossiers_telegram}
          disabled={state !== 'ready' || !telegramAppaire}
          onChange={(e) => void enregistrer({ dossiers_telegram: e.target.checked })}
          className="mt-1"
        />
        <span>
          <span className="text-ivory">Sur Telegram</span>
          <span className="block text-xs text-faint">
            {telegramAppaire ? 'Un document par valeur, dans votre conversation appairée.' : 'Appairez Telegram ci-dessus pour activer.'}
          </span>
        </span>
      </label>

      {prefs.dossiers_optin_at && (
        <p className="text-xs text-faint">Activé le {new Date(prefs.dossiers_optin_at).toLocaleDateString('fr-FR')}. Décochez pour arrêter.</p>
      )}
      {state === 'error' && errMsg && <p className="text-xs text-down">{errMsg}</p>}
    </section>
  );
}
```

- [ ] **Step 2 : Monter le composant**

Dans `frontend/app/parametres/alertes/page.tsx` : ajouter `import DossiersPrefs from '@/components/settings/DossiersPrefs';` après l'import de `TelegramPrefs` (ligne 6), et `<DossiersPrefs userId={user.id} />` juste après `<TelegramPrefs userId={user.id} />` (ligne 55).

- [ ] **Step 3 : Typecheck**

Run : `cd frontend && npx tsc --noEmit`
Expected : silencieux.

- [ ] **Step 4 : Commit**

```bash
git add frontend/components/settings/DossiersPrefs.tsx frontend/app/parametres/alertes/page.tsx
git commit -m "feat(dossiers): cases de consentement email/Telegram dans /parametres/alertes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7 : Export RGPD

**Files:**
- Modify: `frontend/app/api/account/export/route.ts` (la liste des `from(...)`, après la ligne `from('notification_prefs')…`)

- [ ] **Step 1 : Ajouter la table au export**

Repérer le tableau de requêtes parallèles (`Promise.all([...])`) et l'objet de résultat associé. Ajouter, à la suite de `notification_prefs`, la requête :

```ts
    supabase.from('dossier_envois').select('*').eq('user_id', user.id),
```

et la clé correspondante dans l'objet exporté (même nom de table, même position). Ouvrir le fichier pour respecter exactement le motif existant (variable de client, destructuration) — ne pas deviner : le nom du client et l'indexation des résultats sont dans le fichier.

- [ ] **Step 2 : Typecheck + commit**

Run : `cd frontend && npx tsc --noEmit`

```bash
git add frontend/app/api/account/export/route.ts
git commit -m "feat(rgpd): l'export couvre dossier_envois

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8 : Workflow et documentation

**Files:**
- Modify: `.github/workflows/dossier.yml` (après l'étape « Imprimer et ranger les PDF », avant « Conserver les PDF produits »)
- Modify: `CLAUDE.md` (section « Ajouts (passage 2026-09-14) — Dossier valeur », remplacer le point « Reste à faire (vous) »)

- [ ] **Step 1 : Étape d'envoi**

```yaml
      - name: Envoyer les dossiers aux porteurs
        # Après l'impression, jamais avant : le job n'envoie que des PDF de
        # moins de 3 jours et nomme les autres. Un échec ici ne remet pas en
        # cause les PDF déjà rangés ; il est signalé (code 1).
        if: inputs.codes == ''
        working-directory: scraper
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ALERTS_EMAIL_FROM: ${{ secrets.ALERTS_EMAIL_FROM }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
        run: npm install && npm run dossiers:envoi
```

`if: inputs.codes == ''` : un lancement manuel ciblé sur quelques codes réimprime, mais n'envoie pas — on n'écrit pas à un client parce qu'on a relancé un PDF.

- [ ] **Step 2 : CLAUDE.md**

Remplacer le point `- **Reste à faire (vous)** : …` de la section 2026-09-14 par :

```markdown
- **Envoi hebdomadaire (2026-09-15)** : spec
  `docs/superpowers/specs/2026-09-15-envoi-dossiers-design.md`. Job
  `scraper` `dossiers:envoi[:mock]`, 3ᵉ étape de `dossier.yml`. Consentement
  distinct (`notification_prefs.dossiers_email/telegram`, 0132), journal
  `dossier_envois` **idempotent** par (compte, semaine, canal), verrou de
  fraîcheur 3 j (un PDF périmé est nommé, jamais envoyé), plafond 12 pièces
  jointes email, **aucun chiffre dans le corps** (test qui le fait respecter).
  Aucun message pour un portefeuille vide. Export RGPD étendu, purge 90 j.
  **Reste à faire (vous)** : appliquer `0132`, `get_advisors` + test anon sur
  `dossier_envois` (0 ligne sans session), cocher la case sur votre compte et
  lancer `dossier.yml` sans codes pour le premier envoi réel.
```

- [ ] **Step 3 : Tests complets, typecheck des deux paquets, commit, push**

Run : `cd scraper && npm test && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected : tous les tests verts (417 + 15 nouveaux), tsc silencieux des deux côtés.

```bash
git add .github/workflows/dossier.yml CLAUDE.md
git commit -m "feat(dossiers): envoi aux porteurs en 3e étape du cron, doc du passage

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git pull --rebase --autostash && git push
```

---

## Auto-relecture

**Couverture de la spec** — §1 consentement → Task 1 + 6 ; §2 journal → Task 1 + 5 ; §3 job (sélection, fraîcheur, téléchargement, plafond, envoi, journal, vide) → Task 2 + 5 ; §4 message → Task 3 ; §5 workflow → Task 8 ; §6 tests → Task 2, 3, 4 ; export RGPD → Task 7 ; purge → Task 1.

**Cohérence des types** — `LigneCandidate`/`Selection`/`LigneRetenue` définis en Task 2, consommés tels quels en Task 3 et 5. `sendTelegramDocument(chatId, octets, filename, caption)` défini en Task 4, appelé avec cette signature en Task 5. `sendTelegramText` : alias exporté en Task 5 (note d'implémentation), consommé dans le même fichier. `attachments: {filename, content: Buffer}[]` en Task 4, produit en Task 5.

**Hors plan, délibérément** — WhatsApp ; choix des valeurs ; HTML ; fréquence.
