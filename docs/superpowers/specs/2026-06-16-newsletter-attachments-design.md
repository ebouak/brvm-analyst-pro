# Newsletter & email : pièces jointes + images inline — Design

**Date :** 2026-06-16
**Statut :** approuvé (brainstorming)
**Sous-projet (b)** du lot « gestion admin » (décomposition : b → Contenu → Rapports IA → Organisations).

## Objectif

Permettre à l'admin de joindre des fichiers (PDF, images) à une **campagne newsletter**
et à un **email individuel**, et d'**intégrer des images dans le corps** d'une campagne.
S'appuie sur le service email Resend déjà en place (`lib/server/email.ts`).

## Décisions structurantes (validées)

- Pièces jointes par **upload** depuis l'admin (PDF + PNG/JPG).
- En plus : **images inline** dans le corps de campagne (hébergées) **et** pièces
  jointes sur l'**email individuel**.

## Contexte existant (réutilisé)

- `lib/server/email.ts` : `sendEmail({to,subject,html})`, `sendBatch(messages)`, `EmailResult`.
- `lib/email/templates.ts` : `campaignHtml(body, unsubUrl)`, `individualHtml(body)`, `textToHtml`.
- `app/admin/newsletter/{actions.ts,CampaignForm.tsx,page.tsx}` : `sendCampaign(subject, body)`.
- `app/admin/users/[id]/{actions.ts,RightsPanel.tsx}` : `sendUserEmail(userId, subject, body)`.
- `lib/billing/serviceClient.ts` : `getServiceClient()` (service-role, lève si clé absente).
- `lib/server/audit.ts` : `recordAudit`.
- Resend : l'API `POST /emails` et `/emails/batch` accepte `attachments: [{ filename, content }]`
  où `content` est une chaîne **base64**.
- ⚠️ `RESEND_API_KEY` pas encore en prod → les envois échouent proprement (« RESEND non configurée »).

## Architecture

### 1. Service email — pièces jointes

- `EmailAttachment { filename: string; content: string }` (content = base64).
- `EmailMessage` gagne `attachments?: EmailAttachment[]`.
- `sendEmail` et `sendBatch` : si `attachments` présent, l'ajouter au corps JSON
  envoyé à Resend (`attachments: msg.attachments`). Inchangé sinon.

### 2. Stockage des images inline — bucket Supabase Storage

- Migration `0043_newsletter_assets.sql` : crée le bucket **`newsletter-assets`**
  (`storage.buckets`, `public = true`). Lecture publique (les clients mail doivent
  charger les `<img>`), écriture réservée à la service-role (qui bypasse la RLS).
- `lib/server/storage.ts` : `uploadInlineImage(file: File): Promise<string>` —
  upload `getServiceClient().storage.from('newsletter-assets').upload(path, bytes, {contentType})`
  avec `path = campaigns/<yyyy-mm>/<uuid>-<nom>` ; renvoie l'URL publique
  (`getPublicUrl`). Lève en cas d'erreur.

### 3. Campagne — `app/admin/newsletter`

- `CampaignForm.tsx` : deux zones d'upload distinctes —
  - **Pièces jointes** : `<input type="file" multiple accept="application/pdf,image/png,image/jpeg">`.
  - **Images intégrées** : `<input type="file" multiple accept="image/png,image/jpeg">`.
  - Soumission via **`FormData`** (subject, body, `attachments[]`, `inlineImages[]`) à l'action.
- `sendCampaign(formData: FormData)` :
  1. lit `subject`, `body`, `formData.getAll('attachments')`, `formData.getAll('inlineImages')` (File[]) ;
  2. **validation** (cf. § Garde-fous) ;
  3. upload chaque image inline → URL ; construit `bodyHtml = textToHtml(body) + images <img>` ;
  4. chaque pièce jointe → base64 → `EmailAttachment` ;
  5. `sendBatch` avec `attachments` + le HTML enrichi (et footer désabonnement) ;
  6. `recordAudit` (sujet, nb destinataires, noms/nb pièces, nb images inline).

### 4. Email individuel — `app/admin/users/[id]`

- `RightsPanel.tsx` : la section « Envoyer un email » gagne un `<input type="file" multiple>` (pièces jointes uniquement).
- `sendUserEmail(formData: FormData)` : lit `userId`, `subject`, `body`, `attachments[]` ;
  valide ; base64 → `sendEmail({to, subject, html: individualHtml(textToHtml(body)), attachments})` ; `recordAudit`.
- *(Pas d'images inline pour l'individuel — transactionnel simple.)*

### 5. Garde-fous (validation, partagés)

- Types autorisés : pièces jointes ∈ `{application/pdf, image/png, image/jpeg}` ;
  images inline ∈ `{image/png, image/jpeg}`.
- **Taille totale upload ≤ 8 Mo** ; **≤ 5 pièces jointes** ; image inline **≤ 2 Mo** chacune.
- Rejet explicite (message clair) si dépassement ou type interdit.
- Helper pur `validateUploads(files, opts)` testable (types + tailles).

### 6. Contrainte Next.js

- `next.config.js` (config **active** ; le `.mjs` est ignoré — anomalie séparée) :
  ajouter `experimental.serverActions.bodySizeLimit = '10mb'` (le défaut 1 Mo
  bloquerait tout PDF). Au-delà de 10 Mo, l'action renvoie une erreur côté Next.

## Flux de données

```
[CampaignForm] --FormData(subject,body,attachments,inlineImages)--> sendCampaign
  inlineImages -> uploadInlineImage -> URLs -> <img> dans bodyHtml
  attachments  -> base64 -> EmailAttachment[]
  -> sendBatch(confirmés, campaignHtml(bodyHtml, unsubUrl), attachments) -> Resend
[RightsPanel email] --FormData(userId,subject,body,attachments)--> sendUserEmail
  attachments -> base64 -> sendEmail(individualHtml, attachments) -> Resend
```

## Gestion d'erreurs

- `RESEND_API_KEY` absente → `EmailResult.ok=false` ; l'UI affiche l'échec.
- Validation échouée → `{ ok:false, message }` (taille/type), aucun envoi.
- Upload image inline échoué → l'action renvoie une erreur claire, pas d'envoi partiel.
- Body > 10 Mo → erreur Next (server action body limit) ; message générique côté UI.

## Sécurité / RGPD

- Campagne : **confirmés uniquement** + **lien de désabonnement** (inchangé).
- Pièces jointes : **flux base64 vers Resend, non stockées** → pas de PII conservée.
- Images inline : bucket **public en lecture** (assets marketing, aucune donnée perso),
  **écriture service-role only**. Validation stricte des types (jamais d'exécutable).
- Actions gardées par les permissions existantes (`content.publish` campagne, `users.write` individuel) + `recordAudit`.
- Mini-checklist RGPD : données = email abonnés (existant) + fichiers marketing
  (non personnels) ; base légale campagne = consentement ; conservation images =
  bucket (assets, purgeable) ; pas de nouveau traceur.

## Tests

Frontend sans harness → `npx tsc --noEmit` + `npx next build`. La logique pure
(`validateUploads`) est vérifiable par inspection. Envoi réel (campagne test PDF +
image inline vers l'adresse de contrôle) **après** configuration de `RESEND_API_KEY`.

## Hors-scope (YAGNI)

- Éditeur WYSIWYG / positionnement fin des images dans le corps (les images inline
  sont ajoutées en bas du corps).
- Stockage/versioning des pièces jointes (flux base64, non conservées).
- Purge automatique du bucket `newsletter-assets` (rétention manuelle ; à planifier si volumineux).
- Consolidation des deux `next.config` (anomalie latente, traitée séparément).
