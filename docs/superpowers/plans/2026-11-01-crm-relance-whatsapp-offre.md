# CRM — relance WhatsApp, numéro après inscription, e-mail habillé, dossier offert — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** relancer un prospect par un e-mail habillé qui offre un dossier PDF au choix et un contact WhatsApp, permettre une relance WhatsApp manuelle tracée depuis la fiche CRM, et récupérer le numéro des nouveaux inscrits via un écran unique qui montre les avantages de WhatsApp.

**Architecture:** modules PURS testés (`lib/crm/telephone.ts`, `jetonBonus.ts`, `emailRelance.ts`, `whatsappRelance.ts`, `lib/bienvenue/redirection.ts`) consommés par des server actions minces. Une migration `0174` ajoute les colonnes (préférences, jeton bonus, canal WhatsApp). Le dossier offert est une page publique à jeton qui consomme sa place atomiquement avant de renvoyer une URL signée de 10 min.

**Tech Stack:** Next.js 14 App Router (server actions), Supabase (service_role côté serveur, RLS owner côté client), vitest, Resend (`lib/server/email.ts`), passerelle WhatsApp (`lib/whatsapp/passerelle.ts`).

**Spec :** `docs/superpowers/specs/2026-11-01-crm-relance-whatsapp-offre-design.md`. **Branche :** `feat/crm-relance-whatsapp-offre`. Chemins relatifs à la racine du dépôt ; `npx vitest` / `npx tsc` se lancent depuis `frontend/`.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0174_crm_whatsapp_offre.sql` (créé) | colonnes prefs, jeton bonus, canal/statut WhatsApp, source d'opposition |
| `frontend/lib/crm/telephone.ts` (+ test) | normalisation E.164, PUR, utilisable client |
| `frontend/lib/crm/jetonBonus.ts` (+ test) | état d'un jeton, fraîcheur d'un PDF, PUR |
| `frontend/lib/crm/emailRelance.ts` (+ test) | HTML + texte de l'e-mail habillé, PUR |
| `frontend/lib/crm/whatsappRelance.ts` (+ test) | texte WhatsApp, lien `wa.me`, STOP, PUR |
| `frontend/lib/bienvenue/redirection.ts` (+ test) | `nextSur`, `estNouveauCompte`, PUR |
| `frontend/lib/crm/types.ts`, `identite.ts`, `score.ts`, `charger.ts`, `opposition.ts` (modifiés) | contact WhatsApp + bonus, signal `bonus`, chronologie |
| `frontend/app/admin/crm/[cle]/actions.ts`, `RelanceForm.tsx`, `page.tsx` (modifiés), `RelanceWhatsapp.tsx` (créé) | e-mail habillé + offre ; relance WhatsApp préparée |
| `frontend/app/offre/dossier/page.tsx`, `Choix.tsx`, `actions.ts` (créés) | dossier offert |
| `frontend/app/bienvenue/whatsapp/page.tsx`, `Ecran.tsx`, `actions.ts` (créés) | écran d'après inscription |
| `frontend/app/auth/callback/route.ts`, `frontend/app/login/SignInClient.tsx` (modifiés) | redirection des nouveaux comptes |
| `frontend/components/settings/RecontactPrefs.tsx` (créé), `frontend/app/parametres/alertes/page.tsx` (modifié) | numéro + consentement dans les paramètres |
| `frontend/lib/whatsapp/stop.ts` (créé), `frontend/app/api/whatsapp/waha/route.ts` (modifié) | STOP → opposition |
| `frontend/lib/supabase/middleware.ts`, `frontend/app/api/account/export/route.ts` (modifiés) | page publique, export RGPD |

---

### Task 1 : Migration 0174 — écrire, appliquer, vérifier

**Files:** Create `supabase/migrations/0174_crm_whatsapp_offre.sql`

- [ ] **Step 1 : vérifier que rien n'existe déjà** (depuis la racine)
```bash
supabase db query --linked "select table_name, column_name from information_schema.columns where table_schema='public' and ((table_name='notification_prefs' and column_name in ('telephone_declare','recontact_optin_at','ecran_whatsapp_vu_at')) or (table_name='crm_actions' and column_name in ('jeton_bonus','bonus_code','bonus_at')))"
supabase db query --linked "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid in ('public.crm_actions'::regclass,'public.crm_oppositions'::regclass) and contype='c'"
```
Attendu : aucune colonne. Noter les NOMS exacts des CHECK sur `canal`, `statut`, `source` (défaut `crm_actions_canal_check`, `crm_actions_statut_check`, `crm_oppositions_source_check`) et les reporter dans le SQL s'ils diffèrent.

- [ ] **Step 2 : écrire la migration**
```sql
-- 0174 — CRM : relance WhatsApp, numéro après inscription, dossier offert.
-- Spec : docs/superpowers/specs/2026-11-01-crm-relance-whatsapp-offre-design.md
-- Idempotente.

-- 1. Préférences : numéro DÉCLARÉ (distinct de whatsapp_phone, prouvé par
--    appairage et verrouillé par 0162), consentement au recontact commercial,
--    écran d'après inscription déjà montré.
alter table public.notification_prefs
  add column if not exists telephone_declare text null,
  add column if not exists recontact_optin_at timestamptz null,
  add column if not exists ecran_whatsapp_vu_at timestamptz null;

alter table public.notification_prefs drop constraint if exists notification_prefs_telephone_declare_e164;
alter table public.notification_prefs add constraint notification_prefs_telephone_declare_e164
  check (telephone_declare is null or telephone_declare ~ '^\+[1-9][0-9]{7,14}$');

-- 2. Journal CRM : canal WhatsApp (préparé à la main par l'exploitant) et
--    jeton du dossier offert (un dossier, 14 jours).
alter table public.crm_actions drop constraint if exists crm_actions_canal_check;
alter table public.crm_actions add constraint crm_actions_canal_check check (canal in ('email', 'whatsapp'));
alter table public.crm_actions drop constraint if exists crm_actions_statut_check;
alter table public.crm_actions add constraint crm_actions_statut_check check (statut in ('note', 'envoi', 'envoye', 'echec', 'prepare'));

alter table public.crm_actions
  add column if not exists jeton_bonus text null unique,
  add column if not exists bonus_code text null,
  add column if not exists bonus_at timestamptz null;

alter table public.crm_actions drop constraint if exists crm_actions_bonus_code_format;
alter table public.crm_actions add constraint crm_actions_bonus_code_format
  check (bonus_code is null or bonus_code ~ '^[A-Z0-9]{2,8}$');

-- 3. Opposition reçue par WhatsApp (« STOP »).
alter table public.crm_oppositions drop constraint if exists crm_oppositions_source_check;
alter table public.crm_oppositions add constraint crm_oppositions_source_check check (source in ('parametres', 'lien', 'admin', 'whatsapp'));
```

- [ ] **Step 3 : appliquer** (autorisation permanente de l'utilisateur, 2026-11-01 ; JAMAIS `db push`)
```bash
supabase db query --linked -f supabase/migrations/0174_crm_whatsapp_offre.sql
```
Attendu : `"rows": []`, aucune erreur.

- [ ] **Step 4 : vérifier**
```bash
supabase db query --linked "select column_name from information_schema.columns where table_schema='public' and table_name in ('notification_prefs','crm_actions') and column_name in ('telephone_declare','recontact_optin_at','ecran_whatsapp_vu_at','jeton_bonus','bonus_code','bonus_at') order by 1"
supabase db query --linked "select relname, relrowsecurity from pg_class where relname in ('notification_prefs','crm_actions','crm_oppositions')"
supabase db advisors --linked --type security
```
Attendu : 6 colonnes ; RLS `true` partout ; aucun nouvel avis. Puis à la clé PUBLIQUE (lue dans `frontend/.env.local`, jamais affichée, `curl -A brvm-check`) : `GET /rest/v1/crm_actions?select=jeton_bonus&limit=1` → `[]` ou refus, jamais une ligne.

- [ ] **Step 5 : commit**
```bash
git add supabase/migrations/0174_crm_whatsapp_offre.sql
git commit -m "feat(crm): migration 0174 — numéro déclaré, consentement, jeton du dossier offert, canal WhatsApp"
```

---

### Task 2 : `lib/crm/telephone.ts` — normalisation E.164

**Files:** Create `frontend/lib/crm/telephone.ts`, Test `frontend/lib/crm/telephone.test.ts`

- [ ] **Step 1 : test**
```ts
import { describe, it, expect } from 'vitest';
import { normaliserTelephone } from './telephone';

describe('normaliserTelephone', () => {
  it('accepte le format international avec espaces', () => {
    expect(normaliserTelephone('+225 07 07 12 34 56')).toEqual({ ok: true, e164: '+2250707123456' });
  });
  it('accepte le préfixe 00', () => {
    expect(normaliserTelephone('00221 77 123 45 67')).toEqual({ ok: true, e164: '+221771234567' });
  });
  it('ignore tirets, points et parenthèses', () => {
    expect(normaliserTelephone('+33 (7) 43.65-72-71')).toEqual({ ok: true, e164: '+33743657271' });
  });
  it("refuse un numéro sans indicatif (ambigu d'un pays à l'autre)", () => {
    expect(normaliserTelephone('07 07 12 34 56').ok).toBe(false);
  });
  it('refuse trop court ou trop long', () => {
    expect(normaliserTelephone('+225 123').ok).toBe(false);
    expect(normaliserTelephone('+1234567890123456').ok).toBe(false);
  });
  it('refuse les lettres', () => {
    expect(normaliserTelephone('+225 07 ABC').ok).toBe(false);
  });
  it('vide = rien à enregistrer', () => {
    expect(normaliserTelephone('   ')).toEqual({ ok: true, e164: null });
  });
});
```
- [ ] **Step 2 :** `npx vitest run lib/crm/telephone.test.ts` → FAIL (module absent).
- [ ] **Step 3 : implémenter**
```ts
/**
 * Numéro saisi → E.164 (`+<indicatif><numéro>`). PUR, utilisable côté client.
 * L'indicatif est EXIGÉ : « 07 07… » est ivoirien, français ou autre selon le
 * pays — deviner enverrait la relance à un inconnu.
 * Même contrainte qu'en base (0174) : ^\+[1-9][0-9]{7,14}$.
 */
export type ResultatTelephone = { ok: true; e164: string | null } | { ok: false; erreur: string };

export const ERREUR_INDICATIF = "Indiquez l'indicatif du pays, par exemple +225 07 07 12 34 56.";

export function normaliserTelephone(saisie: string): ResultatTelephone {
  const brut = saisie.trim();
  if (!brut) return { ok: true, e164: null };
  if (/[^\d\s+().-]/.test(brut)) return { ok: false, erreur: 'Le numéro ne doit contenir que des chiffres.' };
  const compact = brut.replace(/[\s().-]/g, '');
  const international = compact.startsWith('+') ? compact.slice(1) : compact.startsWith('00') ? compact.slice(2) : null;
  if (international === null) return { ok: false, erreur: ERREUR_INDICATIF };
  if (!/^[1-9]\d{7,14}$/.test(international)) return { ok: false, erreur: 'Numéro trop court ou trop long.' };
  return { ok: true, e164: `+${international}` };
}
```
- [ ] **Step 4 :** relancer → PASS (7).
- [ ] **Step 5 :** `git add frontend/lib/crm/telephone.ts frontend/lib/crm/telephone.test.ts && git commit -m "feat(crm): normalisation E.164 du numéro (pur, testé)"`

---

### Task 3 : `lib/crm/jetonBonus.ts` — validité du jeton, fraîcheur du PDF

**Files:** Create `frontend/lib/crm/jetonBonus.ts`, Test `frontend/lib/crm/jetonBonus.test.ts`

- [ ] **Step 1 : test**
```ts
import { describe, it, expect } from 'vitest';
import { etatJeton, pdfFrais, estCodeValeur, VALIDITE_JOURS } from './jetonBonus';

const M = new Date('2026-11-15T12:00:00Z');

describe('etatJeton', () => {
  it('inconnu sans ligne', () => expect(etatJeton(null, M)).toBe('inconnu'));
  it('valide dans la fenêtre', () => expect(etatJeton({ created_at: '2026-11-10T08:00:00Z', bonus_at: null }, M)).toBe('valide'));
  it('utilisé dès que bonus_at est posé', () => expect(etatJeton({ created_at: '2026-11-14T08:00:00Z', bonus_at: '2026-11-14T09:00:00Z' }, M)).toBe('utilise'));
  it('expiré au-delà de 14 jours', () => {
    expect(VALIDITE_JOURS).toBe(14);
    expect(etatJeton({ created_at: '2026-10-31T11:59:00Z', bonus_at: null }, M)).toBe('expire');
  });
  it('date illisible = expiré (échec fermé)', () => expect(etatJeton({ created_at: 'n/a', bonus_at: null }, M)).toBe('expire'));
});

describe('pdfFrais', () => {
  it('frais à moins de 3 jours', () => expect(pdfFrais('2026-11-13T06:00:00Z', M)).toBe(true));
  it('périmé au-delà de 3 jours', () => expect(pdfFrais('2026-11-12T06:00:00Z', M)).toBe(false));
  it('absent = périmé', () => expect(pdfFrais(null, M)).toBe(false));
});

describe('estCodeValeur', () => {
  it('accepte SNTS, refuse le reste', () => {
    expect(estCodeValeur('SNTS')).toBe(true);
    for (const c of ['snts', 'S', 'SNTS/../X', 'ABCDEFGHI']) expect(estCodeValeur(c)).toBe(false);
  });
});
```
- [ ] **Step 2 :** → FAIL.
- [ ] **Step 3 : implémenter**
```ts
/**
 * Dossier offert — PUR. Un jeton par relance : un dossier, 14 jours. Toute
 * date illisible vaut « expiré » : le doute ne donne jamais accès.
 * Fraîcheur : même règle que l'envoi du samedi (scraper/src/dossiers/selection.ts,
 * 3 jours) — un dossier périmé livré en silence est pire qu'un dossier absent.
 */
export const VALIDITE_JOURS = 14;
export const FRAICHEUR_JOURS = 3;
const JOUR_MS = 86_400_000;

export type EtatJeton = 'inconnu' | 'expire' | 'utilise' | 'valide';

export function etatJeton(ligne: { created_at: string; bonus_at: string | null } | null, maintenant: Date): EtatJeton {
  if (!ligne) return 'inconnu';
  if (ligne.bonus_at) return 'utilise';
  const cree = Date.parse(ligne.created_at);
  if (!Number.isFinite(cree) || maintenant.getTime() - cree > VALIDITE_JOURS * JOUR_MS) return 'expire';
  return 'valide';
}

export function pdfFrais(majIso: string | null, maintenant: Date): boolean {
  const maj = majIso ? Date.parse(majIso) : NaN;
  return Number.isFinite(maj) && maintenant.getTime() - maj <= FRAICHEUR_JOURS * JOUR_MS;
}

/** Code de valeur accepté dans l'URL et en base (0174 : ^[A-Z0-9]{2,8}$). */
export const estCodeValeur = (c: string): boolean => /^[A-Z0-9]{2,8}$/.test(c);
```
- [ ] **Step 4 :** → PASS (9).
- [ ] **Step 5 :** commit `"feat(crm): validité du jeton du dossier offert et fraîcheur du PDF (pur)"`

---

### Task 4 : `lib/crm/emailRelance.ts` — e-mail habillé

**Files:** Create `frontend/lib/crm/emailRelance.ts`, Test `frontend/lib/crm/emailRelance.test.ts`

Charte (jetons de `app/globals.css`, thème sombre) : fond `#030303`, surface `#0a1417`, accent cyan `#56D7FD` (encre `#03141a` dessus), texte clair `#FCFCFC`, atténué `#b5b5b5`, bordure `#1b2a30`. Le message est sur une carte CLAIRE (`#ffffff`, texte `#1a1f24`) : un long texte se lit mieux, et plusieurs clients inversent les fonds sombres. Logo : `https://www.westbourse.com/icon-192.png` (PNG — Gmail n'affiche pas le SVG).

- [ ] **Step 1 : test**
```ts
import { describe, it, expect } from 'vitest';
import { construireEmailRelance, type OptionsEmail } from './emailRelance';

const base: OptionsEmail = {
  corps: 'Bonjour Awa,\n\nVoici <notre> offre & plus.',
  lienOpposition: 'https://www.westbourse.com/crm/opposition?t=abc',
  lienOffre: 'https://www.westbourse.com/offre/dossier?t=def',
  whatsappNumero: '+33 7 43 65 72 71',
  chaineWhatsappUrl: 'https://whatsapp.com/channel/XYZ',
};

describe('construireEmailRelance', () => {
  it('affiche le logo en PNG absolu', () => {
    const { html } = construireEmailRelance(base);
    expect(html).toContain('src="https://www.westbourse.com/icon-192.png"');
    expect(html).not.toMatch(/\.svg/);
  });
  it('échappe le corps saisi', () => {
    const { html } = construireEmailRelance(base);
    expect(html).toContain('&lt;notre&gt; offre &amp; plus.');
    expect(html).not.toContain('<notre>');
  });
  it("met le lien d'opposition en dernier, HTML et texte", () => {
    const { html, texte } = construireEmailRelance(base);
    expect(html.lastIndexOf('crm/opposition?t=abc')).toBeGreaterThan(html.lastIndexOf('offre/dossier'));
    expect(texte.trimEnd().endsWith('https://www.westbourse.com/crm/opposition?t=abc')).toBe(true);
  });
  it("inclut l'offre et le bouton WhatsApp quand ils sont fournis", () => {
    const { html, texte } = construireEmailRelance(base);
    expect(html).toContain('href="https://www.westbourse.com/offre/dossier?t=def"');
    expect(html).toContain('https://wa.me/33743657271?text=');
    expect(texte).toContain('https://www.westbourse.com/offre/dossier?t=def');
    expect(texte).toContain('https://wa.me/33743657271');
  });
  it("n'invente ni offre ni WhatsApp quand ils sont absents", () => {
    const { html, texte } = construireEmailRelance({ ...base, lienOffre: null, whatsappNumero: null, chaineWhatsappUrl: null });
    expect(html).not.toContain('offre/dossier');
    expect(html).not.toContain('wa.me');
    expect(html).not.toContain('whatsapp.com/channel');
    expect(texte).not.toContain('wa.me');
  });
  it('porte la mention de non-conseil', () => {
    expect(construireEmailRelance(base).html).toContain('pas un conseil en investissement');
  });
});
```
- [ ] **Step 2 :** → FAIL.
- [ ] **Step 3 : implémenter**
```ts
/**
 * E-mail de relance habillé — PUR. Mise en page en tableaux et styles en ligne
 * (les clients e-mail ignorent <style> et le flex), aucun script, polices
 * système. Le corps est celui que l'exploitant a relu dans la fiche CRM :
 * échappé, jamais réécrit. Aucun chiffre ajouté par le gabarit.
 * Le lien d'opposition (art. 21) est TOUJOURS le dernier élément.
 */
const SITE = 'https://www.westbourse.com';
const LOGO = `${SITE}/icon-192.png`;
const TELEGRAM = 'https://t.me/westbourse7';
const C = { fond: '#030303', surface: '#0a1417', accent: '#56D7FD', encre: '#03141a', clair: '#FCFCFC', attenue: '#b5b5b5', carte: '#ffffff', texte: '#1a1f24', bordure: '#1b2a30' };
const POLICE = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export interface OptionsEmail {
  corps: string;
  lienOpposition: string;
  lienOffre: string | null;
  whatsappNumero: string | null;
  chaineWhatsappUrl: string | null;
}

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Liens https cliquables ; la ponctuation finale reste du texte (comme gabarits.versHtml). */
function corpsHtml(texte: string): string {
  return echapper(texte)
    .replace(/https:\/\/(?:(?!&(?:quot|lt|gt);)[^\s<])+/g, (url) => {
      const fin = /[.,;:!?)]+$/.exec(url)?.[0] ?? '';
      const href = fin ? url.slice(0, -fin.length) : url;
      return `<a href="${href}" style="color:#0b6b6f">${href}</a>${fin}`;
    })
    .replace(/\n/g, '<br>');
}

export function lienWhatsappEntrant(numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour, je vous écris suite à votre e-mail WESTBOURSE.')}`;
}

const bouton = (href: string, libelle: string, fond: string, encre: string) =>
  `<a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:${fond};color:${encre};font-weight:700;font-size:15px;text-decoration:none;font-family:${POLICE}">${libelle}</a>`;

export function construireEmailRelance(o: OptionsEmail): { html: string; texte: string } {
  const wa = o.whatsappNumero ? lienWhatsappEntrant(o.whatsappNumero) : null;

  const offre = o.lienOffre
    ? `<tr><td style="padding:0 32px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.bordure};border-radius:16px"><tr><td style="padding:22px 24px;font-family:${POLICE}">
<p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${C.accent}">Offert</p>
<p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${C.clair}">Votre dossier valeur, au choix</p>
<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${C.attenue}">Choisissez une société cotée à la BRVM : vous recevez son dossier complet en PDF, tel que nous le produisons chaque semaine.</p>
${bouton(o.lienOffre, 'Choisir mon dossier', C.accent, C.encre)}
</td></tr></table></td></tr>`
    : '';

  const whatsapp = wa
    ? `<tr><td align="center" style="padding:16px 32px 4px;font-family:${POLICE}"><p style="margin:0 0 10px;font-size:14px;color:${C.texte}">Une question ? Écrivez-nous directement.</p>${bouton(wa, 'Écrire sur WhatsApp', '#25D366', '#06210f')}</td></tr>`
    : '';

  const liens = [
    `<a href="${SITE}" style="color:${C.attenue}">westbourse.com</a>`,
    `<a href="${TELEGRAM}" style="color:${C.attenue}">Telegram</a>`,
    ...(o.chaineWhatsappUrl ? [`<a href="${o.chaineWhatsappUrl}" style="color:${C.attenue}">Chaîne WhatsApp</a>`] : []),
  ].join(' &nbsp;·&nbsp; ');

  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:${C.fond}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fond}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:8px 8px 20px;font-family:${POLICE}"><img src="${LOGO}" width="36" height="36" alt="" style="vertical-align:middle;border-radius:8px"> <span style="vertical-align:middle;font-size:18px;font-weight:800;letter-spacing:.04em;color:${C.clair}">WESTBOURSE</span></td></tr>
<tr><td style="background:${C.carte};border-radius:20px;overflow:hidden"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="height:4px;background:${C.accent};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 20px;font-family:${POLICE};font-size:15px;line-height:1.65;color:${C.texte}">${corpsHtml(o.corps)}</td></tr>
${offre}
${whatsapp}
<tr><td style="padding:20px">&nbsp;</td></tr>
</table></td></tr>
<tr><td align="center" style="padding:22px 16px 6px;font-family:${POLICE};font-size:12px;line-height:1.7;color:${C.attenue}">${liens}<br>Données de marché de la BRVM, pas un conseil en investissement.</td></tr>
<tr><td align="center" style="padding:6px 16px 24px;font-family:${POLICE};font-size:11px;color:#7d8a90">Vous ne souhaitez plus recevoir ce type de message ? <a href="${o.lienOpposition}" style="color:#7d8a90">${o.lienOpposition}</a></td></tr>
</table></td></tr></table></body></html>`;

  const texte = [
    o.corps,
    ...(o.lienOffre ? ['', 'OFFERT — votre dossier valeur, au choix :', o.lienOffre] : []),
    ...(wa ? ['', 'Une question ? Écrivez-nous sur WhatsApp :', wa] : []),
    '',
    '—',
    'Données de marché de la BRVM, pas un conseil en investissement.',
    `Vous ne souhaitez plus recevoir ce type de message ? ${o.lienOpposition}`,
  ].join('\n');

  return { html, texte };
}
```
- [ ] **Step 4 :** → PASS (6).
- [ ] **Step 5 :** commit `"feat(crm): e-mail de relance habillé — logo, offre, WhatsApp, pied (pur, testé)"`

---

### Task 5 : `lib/crm/whatsappRelance.ts` — texte, lien, STOP

**Files:** Create `frontend/lib/crm/whatsappRelance.ts`, Test `frontend/lib/crm/whatsappRelance.test.ts`

- [ ] **Step 1 : test**
```ts
import { describe, it, expect } from 'vitest';
import { avecMentionStop, lienWaMeVers, estStop, MENTION_STOP, texteOffre } from './whatsappRelance';

describe('whatsappRelance', () => {
  it('ajoute la mention STOP si elle manque, une seule fois', () => {
    expect(avecMentionStop('Bonjour')).toBe(`Bonjour\n\n${MENTION_STOP}`);
    expect(avecMentionStop(`Bonjour\n\n${MENTION_STOP}`)).toBe(`Bonjour\n\n${MENTION_STOP}`);
  });
  it('construit un lien wa.me vers le numéro E.164', () => {
    expect(lienWaMeVers('+2250707123456', 'Salut & bienvenue')).toBe('https://wa.me/2250707123456?text=Salut%20%26%20bienvenue');
  });
  it('reconnaît STOP et ses variantes, rien d’autre', () => {
    for (const t of ['STOP', ' stop ', 'Stop.', 'ARRET', 'arrêt', '/stop']) expect(estStop(t)).toBe(true);
    for (const t of ['stop les alertes demain', 'cours SNTS', 'arrêtez de m’écrire svp']) expect(estStop(t)).toBe(false);
  });
  it("le texte d'offre porte le lien", () => {
    expect(texteOffre('https://x/offre?t=1')).toContain('https://x/offre?t=1');
  });
});
```
- [ ] **Step 2 :** → FAIL.
- [ ] **Step 3 : implémenter**
```ts
/**
 * Relance WhatsApp — PUR. Le message est préparé ici, relu par l'exploitant,
 * puis envoyé À LA MAIN depuis son téléphone (wa.me) : jamais par la
 * passerelle (non officielle — un envoi commercial en série fait bannir le numéro).
 */
export const MENTION_STOP = 'Répondez STOP pour ne plus être recontacté.';

export function avecMentionStop(texte: string): string {
  const t = texte.trim();
  return t.includes(MENTION_STOP) ? t : `${t}\n\n${MENTION_STOP}`;
}

export function texteOffre(lien: string): string {
  return `Offert : le dossier PDF d'une valeur de votre choix → ${lien}`;
}

export function lienWaMeVers(e164: string, texte: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(texte)}`;
}

/** Un message qui n'est QUE « STOP » (ou ARRÊT), ponctuation finale et « / » tolérés. */
export function estStop(texte: string): boolean {
  const t = texte.trim().replace(/^[/!]\s*/, '').replace(/[.!]+$/, '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return t === 'stop' || t === 'arret';
}
```
- [ ] **Step 4 :** → PASS (4).
- [ ] **Step 5 :** commit `"feat(crm): gabarit WhatsApp, lien wa.me et reconnaissance de STOP (pur)"`

---

### Task 6 : `lib/bienvenue/redirection.ts`

**Files:** Create `frontend/lib/bienvenue/redirection.ts`, Test `frontend/lib/bienvenue/redirection.test.ts`

- [ ] **Step 1 : test**
```ts
import { describe, it, expect } from 'vitest';
import { nextSur, estNouveauCompte, versEcranWhatsapp } from './redirection';

const M = new Date('2026-11-02T10:00:00Z');

describe('redirection', () => {
  it('nextSur garde un chemin interne', () => expect(nextSur('/societes/SNTS?x=1')).toBe('/societes/SNTS?x=1'));
  it('nextSur refuse un domaine externe', () => {
    for (const n of ['//evil.com', 'https://evil.com', '/\\evil.com', '', null, undefined]) expect(nextSur(n)).toBe('/dashboard');
  });
  it('nouveau compte = créé il y a moins de 24 h', () => {
    expect(estNouveauCompte('2026-11-02T08:00:00Z', M)).toBe(true);
    expect(estNouveauCompte('2026-11-01T09:59:00Z', M)).toBe(false);
    expect(estNouveauCompte(undefined, M)).toBe(false);
  });
  it("l'URL de l'écran encode la destination", () => {
    expect(versEcranWhatsapp('/bienvenue')).toBe('/bienvenue/whatsapp?next=%2Fbienvenue');
  });
});
```
- [ ] **Step 2 :** → FAIL.
- [ ] **Step 3 : implémenter**
```ts
/** Redirection des nouveaux comptes vers l'écran WhatsApp — PUR. */
const JOUR_MS = 86_400_000;

export function nextSur(next: string | null | undefined, defaut = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return defaut;
  return next;
}

/** Compte créé il y a moins de 24 h : seuls les nouveaux inscrits voient l'écran. */
export function estNouveauCompte(createdAt: string | null | undefined, maintenant: Date): boolean {
  const c = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(c) && maintenant.getTime() - c < JOUR_MS;
}

export function versEcranWhatsapp(destination: string): string {
  return `/bienvenue/whatsapp?next=${encodeURIComponent(destination)}`;
}
```
- [ ] **Step 4 :** → PASS (4).
- [ ] **Step 5 :** commit `"feat(bienvenue): redirection des nouveaux comptes, next sûr (pur)"`

---

### Task 7 : le dossier CRM connaît le contact WhatsApp et l'offre utilisée

**Files:** Modify `frontend/lib/crm/types.ts`, `identite.ts`, `score.ts`, `charger.ts`, `opposition.ts` ; Tests `identite.test.ts`, `score.test.ts`

- [ ] **Step 1 : tests** — dans `identite.test.ts`, compléter le constructeur de `Sources` du fichier avec `prefs: [], liaisons: []` et `bonus_code: null, bonus_at: null` sur chaque action (lire l'en-tête du fichier), puis ajouter :
```ts
import { contactWhatsapp } from './identite';

describe('contactWhatsapp', () => {
  it('préfère le numéro prouvé au déclaré', () => {
    expect(contactWhatsapp({ whatsapp_phone: '+2250101010101', whatsapp_chat_id: '2250101010101@c.us', telephone_declare: '+2250707070707', recontact_optin_at: '2026-11-01T00:00:00Z' }, []))
      .toEqual({ numero: '+2250101010101', source: 'prouve', lieSansNumero: false, recontact: true });
  });
  it('prend un numéro prouvé de la table des liaisons', () => {
    expect(contactWhatsapp({ whatsapp_phone: null, whatsapp_chat_id: null, telephone_declare: null, recontact_optin_at: null }, [{ chat_id: 'x@c.us', telephone: '+33743657271' }]))
      .toEqual({ numero: '+33743657271', source: 'prouve', lieSansNumero: false, recontact: false });
  });
  it('signale une liaison sans numéro (@lid)', () => {
    expect(contactWhatsapp({ whatsapp_phone: null, whatsapp_chat_id: '123@lid', telephone_declare: null, recontact_optin_at: null }, []))
      .toEqual({ numero: null, source: null, lieSansNumero: true, recontact: false });
  });
  it('replie sur le déclaré', () => {
    expect(contactWhatsapp({ whatsapp_phone: null, whatsapp_chat_id: null, telephone_declare: '+2250707070707', recontact_optin_at: null }, []).source).toBe('declare');
  });
  it('rien sans préférences', () => {
    expect(contactWhatsapp(undefined, [])).toEqual({ numero: null, source: null, lieSansNumero: false, recontact: false });
  });
});
```
Dans `score.test.ts`, ajouter au constructeur de `Dossier` du fichier `whatsapp: { numero: null, source: null, lieSansNumero: false, recontact: false }, bonus: []`, puis (en reprenant le nom réel de ce constructeur à la place de `dossierVide`) :
```ts
it("compte l'offre utilisée dans les 30 jours", () => {
  const s = scorer({ ...dossierVide(), bonus: [{ code: 'SNTS', date: '2026-10-30T10:00:00Z' }] }, MAINTENANT);
  expect(s.raisons.find((r) => r.code === 'bonus')).toMatchObject({ points: 25, texte: 'a téléchargé le dossier SNTS le 30/10' });
});
```
- [ ] **Step 2 :** `npx vitest run lib/crm` → FAIL.
- [ ] **Step 3 : implémenter**

`types.ts` — ajouter à `Dossier` :
```ts
  /** Joignabilité WhatsApp : numéro prouvé (appairage) d'abord, sinon déclaré. */
  whatsapp: { numero: string | null; source: 'prouve' | 'declare' | null; lieSansNumero: boolean; recontact: boolean };
  /** Dossiers offerts téléchargés (crm_actions.bonus_*). */
  bonus: { code: string; date: string }[];
```
et ajouter `| 'bonus'` à l'union de `Raison['code']`.

`identite.ts` — dans `Sources`, ajouter :
```ts
  prefs: { user_id: string; whatsapp_phone: string | null; whatsapp_chat_id: string | null; telephone_declare: string | null; recontact_optin_at: string | null }[];
  liaisons: { user_id: string; chat_id: string; telephone: string | null }[];
```
compléter le type de `actions` avec `bonus_code: string | null; bonus_at: string | null;`, puis ajouter :
```ts
type PrefsWa = Omit<Sources['prefs'][number], 'user_id'>;

export function contactWhatsapp(p: PrefsWa | undefined, liaisons: { chat_id: string; telephone: string | null }[]): Dossier['whatsapp'] {
  const prouve = p?.whatsapp_phone ?? liaisons.find((l) => l.telephone)?.telephone ?? null;
  const lie = Boolean(p?.whatsapp_chat_id) || liaisons.length > 0;
  const recontact = Boolean(p?.recontact_optin_at);
  if (prouve) return { numero: prouve, source: 'prouve', lieSansNumero: false, recontact };
  if (p?.telephone_declare) return { numero: p.telephone_declare, source: 'declare', lieSansNumero: false, recontact };
  return { numero: null, source: null, lieSansNumero: lie, recontact };
}
```
Dans `assemblerDossiers` : `const prefs = new Map(s.prefs.map((p) => [p.user_id, p]));` et `const liaisons = grouper(s.liaisons, (l) => l.user_id);`. Dans `commun` (ajouter `'bonus'` au `Pick`) :
`bonus: (actions.get(emailNorm) ?? []).filter((a) => a.bonus_code && a.bonus_at).map((a) => ({ code: a.bonus_code as string, date: a.bonus_at as string })),`.
Compte : `whatsapp: contactWhatsapp(prefs.get(c.id), liaisons.get(c.id) ?? []),` ; prospect sans compte : `whatsapp: { numero: null, source: null, lieSansNumero: false, recontact: false },`.
Dans `chronologie` : ajouter `for (const b of d.bonus) ev.push({ date: b.date, libelle: `Dossier ${b.code} téléchargé (offre)` });` et remplacer la ligne des actions par :
```ts
  for (const a of d.actions) ev.push({ date: a.date, libelle: a.type === 'note' ? `Note : ${a.contenu.slice(0, 80)}` : a.canal === 'whatsapp' ? 'Relance WhatsApp préparée (envoi manuel)' : `Relance ${a.canal ?? ''} (${a.statut}) : ${a.sujet ?? ''}` });
```

`score.ts` — `PONDERATIONS` gagne `bonus: 25`, `FENETRES_JOURS` gagne `bonus: 30`, et avant le total :
```ts
  const bonus = plusRecent(d.bonus.filter((b) => age(b.date, maintenant) <= FENETRES_JOURS.bonus));
  if (bonus) raisons.push({ code: 'bonus', points: PONDERATIONS.bonus, date: bonus.date, texte: `a téléchargé le dossier ${bonus.code} le ${fmtJour(bonus.date)}` });
```

`charger.ts` — ajouter au `Promise.all` (et `prefs, liaisons` au déstructurage et au retour) :
```ts
    lireTout<Sources['prefs'][number]>((a, b) => sb.from('notification_prefs').select('user_id, whatsapp_phone, whatsapp_chat_id, telephone_declare, recontact_optin_at').order('user_id').range(a, b), 'préférences'),
    lireTout<Sources['liaisons'][number]>((a, b) => sb.from('whatsapp_liaisons').select('user_id, chat_id, telephone').order('id').range(a, b), 'liaisons WhatsApp'),
```
et `bonus_code, bonus_at` au select de `crm_actions`.

`opposition.ts` — `export type SourceOpposition = 'parametres' | 'lien' | 'admin' | 'whatsapp';`
- [ ] **Step 4 :** `npx vitest run lib/crm` → PASS ; `npx tsc --noEmit` → vert.
- [ ] **Step 5 :** commit `"feat(crm): contact WhatsApp et offre utilisée dans le dossier, signal bonus"`

---

### Task 8 : relance e-mail habillée avec l'offre

**Files:** Modify `frontend/app/admin/crm/[cle]/actions.ts`, `RelanceForm.tsx`, `page.tsx`

- [ ] **Step 1 : `actions.ts`** — retirer `piedOpposition, versHtml` de l'import de `gabarits`, ajouter `import { construireEmailRelance } from '@/lib/crm/emailRelance';`. Signature : `envoyerRelance(cle: string, sujet: string, corps: string, templateId: TemplateId, inclureOffre: boolean)`. Après `const jeton = …` : `const jetonBonus = inclureOffre ? randomBytes(24).toString('hex') : null;` et `jeton_bonus: jetonBonus,` dans l'insert. Remplacer la construction de `texte` et l'appel `sendEmail` par :
```ts
  const { html, texte } = construireEmailRelance({
    corps: c,
    lienOpposition: `${SITE}/crm/opposition?t=${jeton}`,
    lienOffre: jetonBonus ? `${SITE}/offre/dossier?t=${jetonBonus}` : null,
    whatsappNumero: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || null,
    chaineWhatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_CHAINE_URL || null,
  });
  let res: EmailResult;
  try {
    res = await sendEmail({ to: d.emailNorm, subject: s, text: texte, html, from: EXPEDITEUR, replyTo: ADRESSE_SUPPORT });
```
Ajouter `offre: inclureOffre` à la `metadata` de l'audit. `piedOpposition`/`versHtml` restent dans `gabarits.ts` (testés) : ne pas élargir le périmètre.
- [ ] **Step 2 : `RelanceForm.tsx`** — `const [offre, setOffre] = useState(true);`, avant le bouton :
```tsx
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={offre} onChange={(e) => setOffre(e.target.checked)} />
        Inclure l&apos;offre « dossier valeur au choix » (lien valable 14 jours, un dossier)
      </label>
```
remplacer le texte d'aide par `Logo, bouton WhatsApp, pied de page et lien d&apos;opposition sont ajoutés automatiquement.` et passer `offre` en 5e argument d'`envoyerRelance`.
- [ ] **Step 3 : `page.tsx`** — filtre de la relance récente : `.filter((a) => a.type === 'relance' && (a.statut === 'envoye' || a.statut === 'prepare'))`.
- [ ] **Step 4 :** `npx tsc --noEmit` → vert.
- [ ] **Step 5 :** commit `"feat(crm): relance e-mail habillée avec l'offre dossier"`

---

### Task 9 : relance WhatsApp préparée depuis la fiche

**Files:** Modify `frontend/app/admin/crm/[cle]/actions.ts`, `page.tsx` ; Create `frontend/app/admin/crm/[cle]/RelanceWhatsapp.tsx`

- [ ] **Step 1 : server action** (ajouter à `actions.ts`, + `import { avecMentionStop, lienWaMeVers, texteOffre } from '@/lib/crm/whatsappRelance';`)
```ts
export async function preparerRelanceWhatsapp(cle: string, texte: string, templateId: TemplateId, inclureOffre: boolean): Promise<Retour & { url?: string }> {
  const ctx = await requirePermission('crm.write');
  if (!estTemplateId(templateId)) return { ok: false, message: 'Gabarit inconnu.' };
  const brut = String(texte ?? '').trim().slice(0, 3000);
  if (!brut) return { ok: false, message: 'Message vide.' };
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.' };
  try {
    if (await estOppose(d.emailNorm)) return { ok: false, message: "Cette personne s'est opposée aux propositions commerciales : rien n'est préparé." };
  } catch {
    return { ok: false, message: "Vérification de l'opposition impossible : rien n'est préparé." };
  }
  if (d.premium || d.admin) return { ok: false, message: 'Personne Premium ou administratrice : relance refusée.' };
  if (!d.whatsapp.recontact || !d.whatsapp.numero) return { ok: false, message: 'Pas de numéro avec consentement au recontact : relance WhatsApp impossible.' };

  const sb = getServiceClient();
  const deuxMinutes = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: enCours } = await sb.from('crm_actions').select('id').eq('email_norm', d.emailNorm).in('statut', ['envoi', 'envoye', 'prepare']).gte('created_at', deuxMinutes).limit(1);
  if (enCours && enCours.length > 0) return { ok: false, message: "Une relance vient d'être faite pour cette personne." };

  const jetonBonus = inclureOffre ? randomBytes(24).toString('hex') : null;
  // Le lien d'offre est ajouté AU SERVEUR : le texte relu ne peut pas porter un jeton forgé.
  const message = avecMentionStop(jetonBonus ? `${brut}\n\n${texteOffre(`${SITE}/offre/dossier?t=${jetonBonus}`)}` : brut);
  const score = scorer(d, new Date());
  const { data: ligne, error } = await sb.from('crm_actions').insert({
    email_norm: d.emailNorm, user_id: d.userId, type: 'relance', canal: 'whatsapp', template_id: templateId,
    sujet: null, contenu: message, score_at_envoi: score.score, signaux_json: score.raisons, statut: 'prepare',
    jeton_bonus: jetonBonus, auteur: ctx.userId,
  }).select('id').single();
  if (error || !ligne) return { ok: false, message: "Journal indisponible : rien n'est préparé." };
  // Audit sans numéro ni e-mail.
  await recordAudit(ctx, { action: 'crm.relance_whatsapp', resourceType: 'crm_action', resourceId: String(ligne.id), targetUserId: d.userId ?? undefined, severity: 'info', metadata: { template: templateId, offre: inclureOffre, source: d.whatsapp.source } });
  revalidatePath(`/admin/crm/${encodeURIComponent(cle)}`);
  return { ok: true, message: 'Message prêt dans WhatsApp : relisez-le et envoyez-le depuis votre téléphone.', url: lienWaMeVers(d.whatsapp.numero, message) };
}
```
- [ ] **Step 2 : `RelanceWhatsapp.tsx`**
```tsx
// frontend/app/admin/crm/[cle]/RelanceWhatsapp.tsx
'use client';
import { useState, useTransition } from 'react';
import { preparerRelanceWhatsapp } from './actions';
import type { TemplateId } from '@/lib/crm/gabarits';

export default function RelanceWhatsapp({ cle, templateId, texteInitial, numero, source }: {
  cle: string; templateId: TemplateId; texteInitial: string; numero: string; source: 'prouve' | 'declare';
}) {
  const [texte, setTexte] = useState(texteInitial);
  const [offre, setOffre] = useState(true);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [envoi, demarrer] = useTransition();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        <span className="tabular text-ivory">{numero}</span> · {source === 'prouve' ? 'numéro prouvé (appairage)' : 'numéro déclaré, non vérifié'}
      </p>
      <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={6} className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm" aria-label="Message WhatsApp" />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={offre} onChange={(e) => setOffre(e.target.checked)} />
        Ajouter le lien « dossier valeur au choix »
      </label>
      <p className="text-xs text-faint">La mention « Répondez STOP » est ajoutée automatiquement. WhatsApp s&apos;ouvre avec le message : c&apos;est vous qui l&apos;envoyez.</p>
      <button
        disabled={envoi}
        onClick={() => {
          // Fenêtre ouverte AVANT l'appel serveur : sinon le navigateur bloque le popup.
          const fenetre = window.open('', '_blank');
          demarrer(async () => {
            try {
              const r = await preparerRelanceWhatsapp(cle, texte, templateId, offre);
              setRetour(r);
              if (r.ok && r.url && fenetre) fenetre.location.href = r.url;
              else fenetre?.close();
            } catch {
              fenetre?.close();
              setRetour({ ok: false, message: "Erreur serveur : rien n'a été préparé." });
            }
          });
        }}
        className="rounded-full bg-[#25D366] px-5 py-2 text-sm font-semibold text-[#06210f] disabled:opacity-50"
      >
        {envoi ? 'Préparation…' : 'Ouvrir WhatsApp avec ce message'}
      </button>
      {retour && <p className={`text-sm ${retour.ok ? 'text-up' : 'text-down'}`}>{retour.message}</p>}
    </div>
  );
}
```
- [ ] **Step 3 : `page.tsx`** — importer `RelanceWhatsapp` ; après la section « Relance par e-mail » (même bloc `can(ctx, 'crm.write')`) :
```tsx
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ivory">Relance par WhatsApp</h2>
            {d.premium || d.admin || d.oppose ? (
              <p className="text-sm text-muted">Relance commerciale désactivée pour cette personne.</p>
            ) : d.whatsapp.numero && d.whatsapp.recontact && d.whatsapp.source ? (
              <RelanceWhatsapp cle={d.cle} templateId={templateId} texteInitial={corps} numero={d.whatsapp.numero} source={d.whatsapp.source} />
            ) : d.whatsapp.lieSansNumero ? (
              <p className="text-sm text-muted">WhatsApp lié sans numéro visible : joignable en répondant dans la console de contact WhatsApp.</p>
            ) : d.whatsapp.numero ? (
              <p className="text-sm text-muted">Numéro connu, mais pas de consentement au recontact : pas de relance WhatsApp.</p>
            ) : (
              <p className="text-sm text-muted">Aucun numéro WhatsApp connu.</p>
            )}
          </section>
```
- [ ] **Step 4 :** `npx tsc --noEmit` → vert.
- [ ] **Step 5 :** commit `"feat(crm): relance WhatsApp préparée et journalisée depuis la fiche"`

---

### Task 10 : page publique du dossier offert

**Files:** Create `frontend/app/offre/dossier/page.tsx`, `Choix.tsx`, `actions.ts` ; Modify `frontend/lib/supabase/middleware.ts`

- [ ] **Step 1 : middleware** — ajouter `'/offre/dossier',` à `PUBLIC_EXACT`, juste après `'/crm/opposition',`.
- [ ] **Step 2 : `actions.ts`**
```ts
// frontend/app/offre/dossier/actions.ts
'use server';
import { headers } from 'next/headers';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { etatJeton, pdfFrais, estCodeValeur } from '@/lib/crm/jetonBonus';

type Retour = { ok: true; url: string } | { ok: false; message: string };
const DUREE_URL_S = 600;

export async function choisirDossier(jeton: string, codeBrut: string): Promise<Retour> {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnue';
  const { allowed } = await checkRateLimit({ route: 'offre-dossier', ip, maxHits: 20, windowSeconds: 600 });
  if (!allowed) return { ok: false, message: 'Trop de tentatives. Réessayez dans quelques minutes.' };
  const code = String(codeBrut ?? '').toUpperCase();
  if (!/^[a-f0-9]{48}$/.test(String(jeton ?? '')) || !estCodeValeur(code)) return { ok: false, message: 'Lien invalide.' };

  const sb = getServiceClient();
  const { data: ligne } = await sb.from('crm_actions').select('id, created_at, bonus_at').eq('jeton_bonus', jeton).maybeSingle();
  const etat = etatJeton(ligne ?? null, new Date());
  if (etat !== 'valide' || !ligne) return { ok: false, message: etat === 'utilise' ? 'Votre dossier offert a déjà été choisi.' : 'Ce lien a expiré.' };

  // Fraîcheur AVANT consommation : un dossier périmé ne coûte pas le jeton.
  const { data: objets } = await sb.storage.from('dossiers').list(code, { search: 'dernier.pdf' });
  const maj = objets?.find((o) => o.name === 'dernier.pdf')?.updated_at ?? null;
  if (!pdfFrais(maj, new Date())) return { ok: false, message: 'Ce dossier est en cours de mise à jour. Choisissez-en un autre.' };

  // Consommation ATOMIQUE : deux clics simultanés ne donnent pas deux dossiers.
  const { data: pris } = await sb.from('crm_actions').update({ bonus_code: code, bonus_at: new Date().toISOString() }).eq('id', ligne.id).is('bonus_at', null).select('id');
  if (!pris || pris.length === 0) return { ok: false, message: 'Votre dossier offert a déjà été choisi.' };

  const { data: signe, error } = await sb.storage.from('dossiers').createSignedUrl(`${code}/dernier.pdf`, DUREE_URL_S, { download: `westbourse-dossier-${code}.pdf` });
  if (error || !signe?.signedUrl) {
    // Rendre la place : l'échec est le nôtre, pas celui de la personne.
    await sb.from('crm_actions').update({ bonus_code: null, bonus_at: null }).eq('id', ligne.id);
    return { ok: false, message: 'Téléchargement momentanément impossible. Réessayez dans un instant.' };
  }
  return { ok: true, url: signe.signedUrl };
}
```
Vérifier la signature réelle de `checkRateLimit` (`lib/server/rateLimit.ts`) avant d'écrire ; elle est utilisée ainsi dans `app/api/whatsapp/pairing/route.ts`.
- [ ] **Step 3 : `page.tsx`**
```tsx
// frontend/app/offre/dossier/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { etatJeton } from '@/lib/crm/jetonBonus';
import Choix from './Choix';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Votre dossier offert — WESTBOURSE', robots: { index: false, follow: false } };

const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

export default async function Page({ searchParams }: { searchParams: { t?: string } }) {
  const jeton = /^[a-f0-9]{48}$/.test(searchParams.t ?? '') ? (searchParams.t as string) : null;
  const sb = getServiceClient();
  const { data: ligne } = jeton
    ? await sb.from('crm_actions').select('created_at, bonus_at, user_id').eq('jeton_bonus', jeton).maybeSingle()
    : { data: null };
  const etat = etatJeton(ligne ?? null, new Date());

  if (etat !== 'valide' || !jeton) {
    const titre = etat === 'utilise' ? 'Votre dossier offert a déjà été choisi' : etat === 'expire' ? 'Ce lien a expiré' : 'Lien introuvable';
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="overline mb-3 text-gold-2">Dossier offert</p>
        <h1 className="mb-4 font-display text-3xl text-ivory [letter-spacing:-0.03em]">{titre}</h1>
        <p className="mb-8 text-sm text-muted">Créez votre compte gratuit pour suivre toutes les sociétés de la BRVM, ou écrivez-nous : nous vous répondons personnellement.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-bg">Créer mon compte gratuit</Link>
          {WHATSAPP && <a href={`https://wa.me/${WHATSAPP}`} className="rounded-full border border-border px-5 py-2.5 text-sm text-ivory">Écrire sur WhatsApp</a>}
        </div>
      </main>
    );
  }

  const userId = (ligne as { user_id: string | null } | null)?.user_id ?? null;
  const [{ data: instruments }, positions] = await Promise.all([
    sb.from('brvm_instruments').select('code, designation, secteur').eq('type', 'action').order('designation'),
    userId ? sb.from('portfolios_positions').select('code').eq('user_id', userId).gt('quantite', 0).then((r) => r.data ?? []) : Promise.resolve([] as { code: string }[]),
  ]);
  const detenus = new Set((positions as { code: string }[]).map((p) => p.code));
  const valeurs = ((instruments ?? []) as { code: string; designation: string | null; secteur: string | null }[])
    .map((i) => ({ code: i.code, designation: i.designation ?? i.code, secteur: i.secteur, detenu: detenus.has(i.code) }))
    .sort((a, b) => Number(b.detenu) - Number(a.detenu) || a.designation.localeCompare(b.designation));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <p className="overline mb-3 text-gold-2">Offert par WESTBOURSE</p>
      <h1 className="mb-3 font-display text-3xl text-ivory md:text-4xl [letter-spacing:-0.03em]">Choisissez votre dossier valeur</h1>
      <p className="mb-8 max-w-[56ch] text-sm leading-relaxed text-muted">Une société cotée, son dossier complet en PDF, tel que nous le produisons chaque semaine. Un seul choix : prenez celle qui compte pour vous.</p>
      <Choix jeton={jeton} valeurs={valeurs} />
    </main>
  );
}
```
- [ ] **Step 4 : `Choix.tsx`**
```tsx
// frontend/app/offre/dossier/Choix.tsx
'use client';
import { useMemo, useState, useTransition } from 'react';
import { choisirDossier } from './actions';

type Valeur = { code: string; designation: string; secteur: string | null; detenu: boolean };

export default function Choix({ jeton, valeurs }: { jeton: string; valeurs: Valeur[] }) {
  const [filtre, setFiltre] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [, demarrer] = useTransition();
  const liste = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return f ? valeurs.filter((v) => v.code.toLowerCase().includes(f) || v.designation.toLowerCase().includes(f)) : valeurs;
  }, [filtre, valeurs]);

  const choisir = (code: string) => {
    setEnCours(code);
    setMessage(null);
    demarrer(async () => {
      try {
        const r = await choisirDossier(jeton, code);
        if (r.ok) {
          setMessage({ ok: true, texte: 'Votre dossier se télécharge. Bonne lecture !' });
          window.location.href = r.url;
        } else setMessage({ ok: false, texte: r.message });
      } catch {
        setMessage({ ok: false, texte: 'Erreur de connexion : réessayez.' });
      } finally {
        setEnCours(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher une société (ex. Sonatel, SNTS)" aria-label="Rechercher une société" className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ivory placeholder:text-faint" />
      {message && <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${message.ok ? 'border-up/40 bg-up/10 text-up' : 'border-down/40 bg-down/10 text-down'}`}>{message.texte}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {liste.map((v) => (
          <li key={v.code}>
            <button disabled={enCours !== null} onClick={() => choisir(v.code)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent/60 disabled:opacity-60">
              <span>
                <span className="tabular block text-sm font-semibold text-ivory">
                  {v.code}
                  {v.detenu && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">dans votre portefeuille</span>}
                </span>
                <span className="block text-xs text-muted">{v.designation}{v.secteur ? ` · ${v.secteur}` : ''}</span>
              </span>
              <span className="text-xs text-accent">{enCours === v.code ? '…' : 'Choisir →'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```
- [ ] **Step 5 :** `npx tsc --noEmit` → vert.
- [ ] **Step 6 :** commit `"feat(crm): page publique du dossier offert (jeton, consommation atomique, fraîcheur)"`

---

### Task 11 : écran WhatsApp d'après inscription

**Files:** Create `frontend/app/bienvenue/whatsapp/page.tsx`, `Ecran.tsx`, `actions.ts` ; Modify `frontend/app/auth/callback/route.ts`, `frontend/app/login/SignInClient.tsx`

- [ ] **Step 1 : `actions.ts`**
```ts
// frontend/app/bienvenue/whatsapp/actions.ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { normaliserTelephone } from '@/lib/crm/telephone';

type Retour = { ok: boolean; message?: string };

/** Ferme l'écran pour de bon ; enregistre numéro déclaré et consentement s'ils sont fournis. RLS owner. */
export async function terminerEcran(numero: string, recontact: boolean): Promise<Retour> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, message: 'Session expirée : reconnectez-vous.' };
  const tel = normaliserTelephone(numero ?? '');
  if (!tel.ok) return { ok: false, message: tel.erreur };
  const maintenant = new Date().toISOString();
  const { error } = await sb.from('notification_prefs').upsert(
    {
      user_id: user.id,
      ecran_whatsapp_vu_at: maintenant,
      ...(tel.e164 ? { telephone_declare: tel.e164 } : {}),
      recontact_optin_at: recontact ? maintenant : null,
    },
    { onConflict: 'user_id' },
  );
  return error ? { ok: false, message: 'Enregistrement impossible : réessayez.' } : { ok: true };
}
```
- [ ] **Step 2 : `page.tsx`**
```tsx
// frontend/app/bienvenue/whatsapp/page.tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { estNouveauCompte, nextSur } from '@/lib/bienvenue/redirection';
import Ecran from './Ecran';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'WESTBOURSE sur WhatsApp', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: { next?: string } }) {
  const next = nextSur(searchParams.next);
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: prefs }, { count }] = await Promise.all([
    sb.from('notification_prefs').select('ecran_whatsapp_vu_at, whatsapp_optin').eq('user_id', user.id).maybeSingle(),
    sb.from('whatsapp_liaisons').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);
  const dejaLie = Boolean(prefs?.whatsapp_optin) || (count ?? 0) > 0;
  if (!estNouveauCompte(user.created_at, new Date()) || prefs?.ecran_whatsapp_vu_at || dejaLie) redirect(next);
  return <Ecran next={next} numeroAgent={(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')} />;
}
```
- [ ] **Step 3 : `Ecran.tsx`**
```tsx
// frontend/app/bienvenue/whatsapp/Ecran.tsx
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { terminerEcran } from './actions';
import { normaliserTelephone } from '@/lib/crm/telephone';

// Uniquement ce qui fonctionne aujourd'hui (lots A, D, E). L'assistant est Premium.
const AVANTAGES = [
  { titre: 'Vos alertes de cours', texte: 'Un seuil franchi sur une valeur suivie : vous êtes prévenu sur WhatsApp.' },
  { titre: 'Le point du soir', texte: 'La séance de la BRVM résumée, chaque soir de bourse.' },
  { titre: 'Vos dossiers du samedi', texte: 'Le dossier PDF des valeurs de votre portefeuille.' },
  { titre: 'Les cours à la demande', texte: 'Écrivez « cours SNTS », « div ORAC » ou « top » : réponse immédiate.' },
  { titre: "L'équipe, sans détour", texte: 'Écrivez « HUMAIN » : un membre de l’équipe vous répond.' },
];

export default function Ecran({ next, numeroAgent }: { next: string; numeroAgent: string }) {
  const router = useRouter();
  const [recontact, setRecontact] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [saisie, setSaisie] = useState(false);
  const [numero, setNumero] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, demarrer] = useTransition();

  const finir = (num: string) =>
    demarrer(async () => {
      setErreur(null);
      const r = await terminerEcran(num, recontact).catch(() => ({ ok: false, message: 'Erreur de connexion : réessayez.' }));
      if (!r.ok) { setErreur(r.message ?? 'Erreur.'); return; }
      router.push(next);
      router.refresh();
    });

  const lier = async () => {
    setErreur(null);
    const res = await fetch('/api/whatsapp/pairing', { method: 'POST' }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { code?: string; error?: string } | null;
    if (!res?.ok || !body?.code) { setErreur(body?.error ?? 'Génération du code impossible : réessayez.'); return; }
    setCode(body.code);
    window.open(`https://wa.me/${numeroAgent}?text=${encodeURIComponent(body.code)}`, '_blank', 'noopener');
  };

  const numeroValide = normaliserTelephone(numero);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <p className="overline mb-3 text-gold-2">Une dernière étape, facultative</p>
      <h1 className="mb-3 font-display text-3xl text-ivory md:text-4xl [letter-spacing:-0.03em]">Recevez WESTBOURSE sur WhatsApp</h1>
      <p className="mb-8 max-w-[56ch] text-sm leading-relaxed text-muted">Là où vous lisez déjà vos messages. Gratuit, et vous pouvez tout couper à tout moment.</p>

      <ul className="mb-8 grid gap-3 sm:grid-cols-2">
        {AVANTAGES.map((a) => (
          <li key={a.titre} className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-1 text-sm font-semibold text-ivory">{a.titre}</p>
            <p className="text-sm leading-relaxed text-muted">{a.texte}</p>
          </li>
        ))}
        <li className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="mb-1 text-sm font-semibold text-ivory">
            L&apos;assistant WESTBOURSE <span className="ml-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">Premium</span>
          </p>
          <p className="text-sm leading-relaxed text-muted">Posez vos questions sur vos valeurs, en langage courant.</p>
        </li>
      </ul>

      <label className="mb-6 flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" className="mt-1" checked={recontact} onChange={(e) => setRecontact(e.target.checked)} />
        <span>J&apos;accepte d&apos;être recontacté par WESTBOURSE sur WhatsApp au sujet de son offre. Facultatif, retirable à tout moment dans mes paramètres.</span>
      </label>

      {!code ? (
        <button disabled={occupe || !numeroAgent} onClick={lier} className="w-full rounded-full bg-[#25D366] px-6 py-3.5 text-base font-semibold text-[#06210f] disabled:opacity-50 sm:w-auto">
          Lier mon WhatsApp
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-2 text-sm text-muted">WhatsApp s&apos;est ouvert avec votre code. Envoyez le message tel quel, puis continuez.</p>
          <p className="tabular mb-4 text-2xl font-semibold tracking-[0.2em] text-ivory">{code}</p>
          <button disabled={occupe} onClick={() => finir('')} className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg disabled:opacity-50">C&apos;est envoyé, continuer</button>
        </div>
      )}

      <div className="mt-6">
        {!saisie ? (
          <button onClick={() => setSaisie(true)} className="text-sm text-muted underline underline-offset-4 hover:text-ivory">ou laissez simplement votre numéro</button>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+225 07 07 12 34 56" aria-label="Votre numéro WhatsApp" className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ivory placeholder:text-faint" />
            <button disabled={occupe || !numero.trim() || !numeroValide.ok} onClick={() => finir(numero)} className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">Enregistrer</button>
          </div>
        )}
        {saisie && numero.trim() && !numeroValide.ok && <p className="mt-2 text-xs text-down">{numeroValide.erreur}</p>}
      </div>

      {erreur && <p role="alert" className="mt-4 text-sm text-down">{erreur}</p>}

      <button disabled={occupe} onClick={() => finir('')} className="mt-10 text-sm text-faint hover:text-muted">Plus tard</button>
    </main>
  );
}
```
- [ ] **Step 4 : redirection Google** — `app/auth/callback/route.ts` : importer `estNouveauCompte, nextSur, versEcranWhatsapp` depuis `@/lib/bienvenue/redirection` ; `const next = nextSur(searchParams.get('next'));` ; remplacer le `return NextResponse.redirect(`${origin}${next}`);` final par :
```ts
  const { data: { user } } = await supabase.auth.getUser();
  const destination = user && estNouveauCompte(user.created_at, new Date()) ? versEcranWhatsapp(next) : next;
  return NextResponse.redirect(`${origin}${destination}`);
```
- [ ] **Step 5 : redirection code e-mail** — `app/login/SignInClient.tsx` : importer `estNouveauCompte, versEcranWhatsapp` ; dans `onSuccess`, remplacer `router.push(next ?? (subscribeNewsletter ? '/bienvenue' : '/dashboard'));` + `router.refresh();` par :
```ts
        const destination = next ?? (subscribeNewsletter ? '/bienvenue' : '/dashboard');
        void supabase.auth
          .getUser()
          .then(({ data: { user } }) => {
            router.push(user && estNouveauCompte(user.created_at, new Date()) ? versEcranWhatsapp(destination) : destination);
            router.refresh();
          })
          .catch(() => {
            router.push(destination);
            router.refresh();
          });
```
(le `getUser()` PostHog juste au-dessus reste inchangé).
- [ ] **Step 6 :** `npx tsc --noEmit` → vert.
- [ ] **Step 7 :** commit `"feat(bienvenue): écran WhatsApp après la première connexion (appairage d'abord, numéro en repli)"`

---

### Task 12 : numéro et consentement dans les paramètres

**Files:** Create `frontend/components/settings/RecontactPrefs.tsx` ; Modify `frontend/app/parametres/alertes/page.tsx`

- [ ] **Step 1 : composant**
```tsx
// frontend/components/settings/RecontactPrefs.tsx
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { normaliserTelephone } from '@/lib/crm/telephone';

/**
 * Numéro DÉCLARÉ et consentement au recontact commercial (0174). Distinct du
 * WhatsApp lié par appairage (WhatsAppPrefs, numéro prouvé) : celui-ci
 * n'active aucun service, il sert seulement à vous recontacter si vous
 * l'acceptez. Se masque si la colonne est absente.
 */
export default function RecontactPrefs({ userId }: { userId: string }) {
  const [pret, setPret] = useState(false);
  const [absent, setAbsent] = useState(false);
  const [numero, setNumero] = useState('');
  const [recontact, setRecontact] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => {
    void createClient()
      .from('notification_prefs')
      .select('telephone_declare, recontact_optin_at')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { setAbsent(true); return; }
        setNumero(data?.telephone_declare ?? '');
        setRecontact(Boolean(data?.recontact_optin_at));
        setPret(true);
      });
  }, [userId]);

  if (absent || !pret) return null;
  const tel = normaliserTelephone(numero);

  const enregistrer = async () => {
    if (!tel.ok) return;
    const { error } = await createClient()
      .from('notification_prefs')
      .upsert({ user_id: userId, telephone_declare: tel.e164, recontact_optin_at: recontact ? new Date().toISOString() : null }, { onConflict: 'user_id' });
    setMsg(error ? { ok: false, texte: 'Enregistrement impossible : réessayez.' } : { ok: true, texte: 'Enregistré.' });
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-ivory">Être recontacté sur WhatsApp</h2>
      <p className="text-sm text-muted">Facultatif. Votre numéro ne sert qu&apos;à vous recontacter au sujet de l&apos;offre WESTBOURSE, et seulement si vous cochez la case. Videz le champ pour l&apos;effacer.</p>
      <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+225 07 07 12 34 56" aria-label="Numéro WhatsApp" className="w-full rounded-xl border border-border bg-sunken px-4 py-2.5 text-sm text-ivory" />
      {!tel.ok && <p className="text-xs text-down">{tel.erreur}</p>}
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" className="mt-1" checked={recontact} onChange={(e) => setRecontact(e.target.checked)} />
        <span>J&apos;accepte d&apos;être recontacté par WESTBOURSE sur WhatsApp au sujet de son offre.</span>
      </label>
      <button disabled={!tel.ok} onClick={enregistrer} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50">Enregistrer</button>
      {msg && <p className={`text-sm ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.texte}</p>}
    </section>
  );
}
```
Vérifier le chemin réel du client navigateur Supabase (`grep -n "from '@/lib/supabase" frontend/components/settings/WhatsAppPrefs.tsx`) et l'aligner.
- [ ] **Step 2 : page** — importer `RecontactPrefs` et l'insérer juste après `<WhatsAppPrefs userId={user.id} />`.
- [ ] **Step 3 :** `npx tsc --noEmit` → vert.
- [ ] **Step 4 :** commit `"feat(parametres): numéro WhatsApp déclaré et consentement au recontact"`

---

### Task 13 : STOP sur WhatsApp → opposition

**Files:** Create `frontend/lib/whatsapp/stop.ts` ; Modify `frontend/app/api/whatsapp/waha/route.ts`

- [ ] **Step 1 : lire** `frontend/lib/whatsapp/appairage.ts:33-37` (`telephoneDepuisChatId`) pour savoir s'il renvoie `+…` ou des chiffres seuls ; adapter `versE164` ci-dessous en conséquence.
- [ ] **Step 2 : `stop.ts`**
```ts
// frontend/lib/whatsapp/stop.ts
import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { enregistrerOpposition } from '@/lib/crm/opposition';
import { userParChat } from './liaisons';
import { telephoneDepuisChatId } from './appairage';
import { passerelleWhatsapp } from './passerelle';

const ACCUSE_OK = "C'est noté : WESTBOURSE ne vous enverra plus de propositions commerciales. Vos alertes et services restent actifs ; vous pouvez les couper dans vos paramètres.";
const ACCUSE_INCONNU = 'STOP bien reçu. Si vous avez un compte WESTBOURSE, vous pouvez aussi vous opposer depuis vos paramètres.';

const versE164 = (t: string | null): string | null => {
  const chiffres = (t ?? '').replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(chiffres) ? `+${chiffres}` : null;
};

/**
 * STOP reçu : opposition (art. 21) de l'e-mail du compte rattaché — par la
 * conversation (couvre @lid), sinon par numéro prouvé ou déclaré. true =
 * opposition enregistrée ; false = expéditeur non rattaché (l'appelant
 * transmet alors à la console, comme tout message).
 */
export async function traiterStop(chatId: string): Promise<boolean> {
  const db = getServiceClient();
  let userId = await userParChat(db, chatId).catch(() => null);
  const tel = versE164(telephoneDepuisChatId(chatId));
  if (!userId && tel) {
    const { data } = await db.from('whatsapp_liaisons').select('user_id').eq('telephone', tel).limit(1);
    userId = (data?.[0]?.user_id as string | undefined) ?? null;
    if (!userId) {
      // tel est validé ^\+\d{8,15}$ ci-dessus : aucune injection possible dans le filtre .or().
      const { data: d2 } = await db.from('notification_prefs').select('user_id').or(`whatsapp_phone.eq.${tel},telephone_declare.eq.${tel}`).limit(1);
      userId = (d2?.[0]?.user_id as string | undefined) ?? null;
    }
  }
  const email = userId ? (await db.auth.admin.getUserById(userId)).data.user?.email ?? null : null;
  const ok = email ? await enregistrerOpposition(email, 'whatsapp') : false;
  if (ok) await passerelleWhatsapp().envoyerTexte(chatId, ACCUSE_OK).catch(() => null);
  else await passerelleWhatsapp().envoyerTexte(chatId, ACCUSE_INCONNU).catch(() => null);
  return ok;
}
```
- [ ] **Step 3 : route** — importer `estStop` (`@/lib/crm/whatsappRelance`) et `traiterStop` (`@/lib/whatsapp/stop`) ; juste après le bloc `isPairingCode` :
```ts
  if (estStop(ev.texte)) {
    const enregistre = await traiterStop(ev.de).catch(() => false);
    if (enregistre) return NextResponse.json({ ok: true, stop: true });
    // Non rattaché : le message suit le chemin normal jusqu'à la console.
  }
```
et ajouter `&& !estStop(ev.texte)` à la condition du bloc agent (`if (ev.texte.trim() && !estDemandeHumain(ev.texte) && !estStop(ev.texte))`). `lireCommande('STOP')` renvoie déjà `null`.
- [ ] **Step 4 :** `npx tsc --noEmit` ; `npx vitest run lib/whatsapp lib/crm` → verts.
- [ ] **Step 5 :** commit `"feat(whatsapp): STOP enregistre l'opposition au recontact commercial"`

---

### Task 14 : export RGPD

**Files:** Modify `frontend/app/api/account/export/route.ts:104`

- [ ] **Step 1 :** `const colonnesCrm = 'id, type, canal, sujet, contenu, statut, created_at, bonus_code, bonus_at';` (`notification_prefs` est déjà exportée en `select('*')`).
- [ ] **Step 2 :** commit `"fix(rgpd): l'export inclut le dossier offert choisi"`

---

### Task 15 : vérification, PR, mise en ligne, essais réels

- [ ] **Step 1 :** depuis `frontend/` : `npx vitest run`, `npx tsc --noEmit`, `npm run build` → verts. Rapporter les chiffres réels.
- [ ] **Step 2 : aperçu de l'e-mail** — script jetable dans le scratchpad : importe `construireEmailRelance` (via `npx tsx`), écrit le HTML, capture Edge (`chromium.launch({ channel: 'msedge' })`, Playwright importé par chemin absolu depuis `frontend/node_modules/playwright/index.mjs`) en 1366 et 390 px. Vérifier : logo, carte lisible, bouton offre, bouton WhatsApp, pied, opposition en dernier.
- [ ] **Step 3 : PR** — `git push -u origin feat/crm-relance-whatsapp-offre` ; `gh pr create` (titre `feat(crm): relance WhatsApp, numéro après inscription, e-mail habillé, dossier offert` ; corps : changements, 0174 DÉJÀ appliquée, essais à faire ; terminer par la ligne d'attribution) ; checks verts ; `gh pr merge --merge`.
- [ ] **Step 4 : production** — statut Vercel `success` sur le commit de fusion (`gh api repos/ebouak/brvm-analyst-pro/commits/<sha>/status`).
- [ ] **Step 5 : essai réel de l'e-mail** — l'admin étant exclu des relances, insérer une ligne d'essai (`email_norm='ebouak@gmail.com'`, `type='note'`, `statut='note'`, `contenu='essai offre dossier'`, `jeton_bonus=<48 hex>`) via `supabase db query --linked`, puis envoyer un exemplaire à `ebouak@gmail.com` par un script jetable (`construireEmailRelance` + API Resend, `RESEND_API_KEY` lue dans `frontend/.env.local`, jamais affichée, User-Agent explicite). Demander à l'utilisateur de valider le rendu Gmail bureau + mobile.
- [ ] **Step 6 : parcours du dossier offert** — Edge/Playwright sur `https://www.westbourse.com/offre/dossier?t=<jeton d'essai>` : liste visible, choix d'une valeur fraîche → téléchargement ; rechargement → « déjà choisi ». Puis `delete from crm_actions where contenu='essai offre dossier' and email_norm='ebouak@gmail.com'`.
- [ ] **Step 7 : écran WhatsApp** — en local (`next dev` + compte de test, mémoire `verifier-page-connectee`) : affichage, « Plus tard » → ne revient pas, numéro invalide refusé.
- [ ] **Step 8 : CLAUDE.md** — section « Ajouts (passage 2026-11-01) — CRM : WhatsApp, numéro, e-mail habillé, dossier offert » (décisions, verrous, 0174 appliquée) ; commit sur `main` après fusion.
