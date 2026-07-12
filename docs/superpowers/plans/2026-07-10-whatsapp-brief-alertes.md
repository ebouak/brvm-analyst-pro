# Brief & alertes WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opt-in RGPD + envoi du brief quotidien et des alertes titres sur WhatsApp par utilisateur — code complet testable en mock, activation réelle à la config Meta (templates approuvés + secrets).

**Architecture:** Table `notification_prefs` (RLS owner) ; canal `sendWhatsAppTo/Template` paramétré par destinataire dans le scraper ; worker `brief:whatsapp` (cron post-brief, idempotent via `notifications_log`) ; section opt-in dans `/parametres/alertes` ; couverture export/suppression compte.

**Tech Stack:** Supabase (SQL + RLS), scraper TS ESM (vitest), Next.js 14.

**Spec:** `docs/superpowers/specs/2026-07-10-whatsapp-brief-alertes-design.md`

---

### Task 1 : Migration `0087_notification_prefs.sql`

Create `supabase/migrations/0087_notification_prefs.sql` : table (cf. spec §4.1),
RLS owner (select/insert/update `auth.uid() = user_id`), pas de delete policy
(suppression via cascade compte), trigger `updated_at`, commentaire RGPD.
⚠️ MCP Supabase indisponible dans la session courante → fichier committé,
**application prod à faire** (SQL editor ou MCP) avant activation réelle.
Post-application : scan advisors + test clé anon (discipline pentest).

### Task 2 : Canal WhatsApp par destinataire (scraper)

Modify `scraper/src/alerts/channels.ts` :
- Extraire `sendWhatsAppRaw(to, body)` (texte, fenêtre 24 h) et ajouter
  `sendWhatsAppTemplate(to, templateName, params: string[])` (messages
  business-initiated — production). `sendWhatsApp(n)` (canal global existant)
  délègue à `sendWhatsAppRaw` avec `WHATSAPP_TO` (comportement inchangé).
- Aucune clé → renvoie `null` (patron existant).

### Task 3 : Worker `brief:whatsapp`

Create `scraper/src/brief/runBriefWhatsapp.ts` :
- Pur : `formatBriefForWhatsApp(brief)` → corps ≤ 950 caractères (marge template).
- IO : lit `brief_daily` du jour ; lit `notification_prefs` (`whatsapp_optin`
  et `brief_whatsapp` true, `whatsapp_phone` non null) ; idempotence : saute si
  `notifications_log` contient (user_id, channel 'whatsapp', message LIKE
  'Brief {date}%') ; envoie via `sendWhatsAppTemplate('daily_brief', …)` sinon
  repli `sendWhatsAppRaw` ; journalise `notifications_log`.
- `--mock` : aucun réseau/DB, brief factice loggé.
- CLI `brief:whatsapp` dans `index.ts` (monitored, source `brief:whatsapp`) +
  script npm `brief:whatsapp` / `brief:whatsapp:mock`.
- Test vitest `scraper/tests/briefWhatsapp.test.ts` : formatage (longueur,
  contenu), sélection opt-ins (fonction pure `selectRecipients`), idempotence
  (déjà-envoyé filtré).

### Task 4 : Alertes par utilisateur

Modify `scraper/src/alerts/runAlerts.ts` : après le `dispatch()` global, si
l'alerte a un `user_id`, lire ses prefs (`alerts_whatsapp` + optin + phone) et
envoyer aussi `sendWhatsAppTemplate('alerte_titre', [code, body])` (repli raw) ;
journaliser le résultat dans `notifications_log` (channel 'whatsapp'). Charger
les prefs une fois par run (map user_id → pref).

### Task 5 : UI opt-in `/parametres/alertes`

- Create `frontend/lib/notifications/phone.ts` : `normalizeE164UEMOA(input)`
  (accepte "+2250701020304", "07 01 02 03 04" + indicatif choisi ; renvoie
  E.164 ou null) + `frontend/lib/notifications/phone.test.mjs`.
- Create `frontend/components/settings/WhatsAppPrefs.tsx` (client) : lit/écrit
  `notification_prefs` via supabase client (RLS owner) ; champ téléphone,
  case consentement explicite (texte finalité + retrait), toggles brief/alertes ;
  états : non configuré (table absente → message discret), sauvegardé, erreur.
- Modify `frontend/app/parametres/alertes/page.tsx` : section « WhatsApp »
  sous les alertes existantes.

### Task 6 : RGPD — export & suppression

- Modify `frontend/app/api/account/export/route.ts` : ajouter
  `notification_prefs` au bundle.
- Modify `frontend/app/api/account/delete/route.ts` : ajouter
  `notification_prefs` à la liste des tables purgées par `user_id`.

### Task 7 : Cron

Modify `.github/workflows/daily.yml` : étape « Brief WhatsApp » après l'étape
brief (`npx tsx src/index.ts brief:whatsapp --trigger=cron`), `continue-on-error:
true` tant que les secrets Meta ne sont pas posés.

### Task 8 : Vérification

`cd scraper && npm test && npx tsc --noEmit` (dette préexistante tolérée hors
fichiers touchés) ; `cd frontend && npx tsx lib/notifications/phone.test.mjs &&
npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=4096 npm run build` ;
commit par tâche ; push final.

**Activation réelle (hors code, actions user)** : appliquer 0087 en prod ;
créer app Meta Business + numéro ; faire approuver les templates `daily_brief`
(2 variables) et `alerte_titre` (2 variables) ; poser `WHATSAPP_TOKEN` +
`WHATSAPP_PHONE_ID` dans les secrets GitHub Actions.
