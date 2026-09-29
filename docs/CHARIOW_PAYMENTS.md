# Paiements Chariow

Vente **à l'unité** via [Chariow](https://chariow.dev) (Mobile Money, carte), sans
abonnement récurrent — Chariow ne fait que des achats uniques :

| Produit | Code catalogue | Effet |
|---|---|---|
| Niveau de l'Academy | `academy:<niveau>` | leçons + examen + certificat du niveau, **à vie** |
| Rachat après refonte | `academy:<niveau>:upgrade` | même accès, tarif réduit, réservé aux acheteurs rattrapés par une refonte |
| Pass premium | `pass:<plan>:<cycle>` | Premium/Platinium pour 1, 3 ou 12 mois, **sans prélèvement automatique** |

Chariow **coexiste** avec `PAYMENT_PROVIDER` (manual / CinetPay) : il ne le remplace pas.

Règle produit des niveaux (décision du 2026-09-29) : accès à vie, **sauf** une refonte
majeure publiée plus de 12 mois après l'achat ; le certificat reste acquis, le contenu
refondu se rachète à tarif réduit.

## 1. Flux

```
navigateur ── POST /api/payments/chariow/checkout {productCode, prénom, nom, téléphone}
                 │  session exigée ; prix, devise, produit Chariow lus au CATALOGUE
                 │  billing_transactions (pending) créée AVANT l'appel
                 ├─► Chariow POST /v1/checkout (custom_metadata.txn = notre id)
                 │  sal_… rangé sur la transaction
                 ◄── { url } → page de paiement Chariow
client paie ──► Chariow ── Pulse signé ──► POST /api/webhooks/chariow
                                   │ 1. HMAC-SHA256 du corps BRUT (401 sinon)
                                   │ 2. x-pulse-delivery-id → payment_webhook_events (idempotence)
                                   │ 3. transaction retrouvée (sal_…, sinon custom_metadata.txn)
                                   │ 4. GET /v1/sales/{id} : statut, produit, devise, montant
                                   │ 5. accorder_achat() — UNE transaction SQL, verrou FOR UPDATE
client ◄── /paiement/succes?txn=… (lecture seule, interroge /api/payments/chariow/status)
```

La page de succès **n'accorde jamais rien** : n'importe qui peut forger son URL.

## 2. Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0146_chariow_paiements.sql` | tables, fonctions `accorder_achat` / `revoquer_achat` / `expirer_pass_chariow`, fermeture du contenu des cours |
| `frontend/lib/billing/chariow/regles.ts` | **pur** : signature, lecture du Pulse, vérification de la vente, règle des 12 mois, schéma du formulaire |
| `frontend/lib/billing/chariow/traiterPulse.ts` | **pur** (I/O injectées) : logique du webhook |
| `frontend/lib/billing/chariow/client.ts` | client HTTP `server-only` (clé jamais journalisée) |
| `frontend/lib/billing/chariow/catalogue.ts` | lecture de `chariow_products` |
| `frontend/lib/billing/chariow/checkout.ts` | démarrage d'un achat |
| `frontend/lib/server/academyAccess.ts` | `hasActiveEntitlement`, `niveauxAchetes`, `peutSuivreNiveau` |
| `frontend/app/api/payments/chariow/{checkout,status}` | routes |
| `frontend/app/api/webhooks/chariow/route.ts` | webhook |
| `frontend/app/paiement/{succes,annule}`, `frontend/app/account/achats` | pages |
| `frontend/components/billing/*` | bouton d'achat, offres de niveaux, suivi |
| `scraper/src/pass/*` + `.github/workflows/pass.yml` | expiration des pass + rappel J-7 (05:15 UTC) |
| `frontend/tests/chariow-*.test.ts`, `scraper/tests/passRappels.test.ts` | 50 tests |

## 3. Données (migration 0146)

- `chariow_products` — **seule source des prix**. Service-role uniquement. Les pass sont
  amorcés depuis `subscription_plans` (inactifs, sans identifiant Chariow) ; les niveaux
  ne le sont pas (aucun prix décidé — on n'en invente pas).
- `user_entitlements` — un droit par vente (`unique (source, source_ref)`), RLS lecture
  propriétaire, aucune écriture utilisateur.
- `payment_webhook_events` — journal des livraisons, `unique (provider, delivery_id)`,
  **sans email, nom ni téléphone**. Rétention 12 mois (`purge_rgpd_retention`).
- `billing_transactions` + `provider_sale_id` (unique), `product_code`, `objet` ∈
  `module | pass`.
- `subscriptions` + `source` (`chariow`), `rappel_expiration_at`, `expired_at`.
- `academy_courses` + `refonte_majeure_le`.

## 4. Événements traités

| Pulse | Traitement |
|---|---|
| `successful.sale` | vérification chez Chariow puis accord (idempotent) |
| `failed.sale`, `abandoned.sale` | transaction `failed` **seulement si `pending`** — un paiement accordé n'est jamais rétrogradé |
| `license.revoked` | `a_verifier` + alerte exploitant (le Pulse ne porte pas l'identifiant de vente) |
| autres | `ignore` |

Codes HTTP : **401** signature invalide ; **500** quand un retry peut réussir (Chariow ou
base indisponibles, vente encore `awaiting_payment`) — Chariow réessaie jusqu'à ~3 h ;
**200** pour tout refus définitif. Un événement de test du tableau de bord (sans
`x-pulse-delivery-id`) est accusé sans rien écrire.

**Remboursements** : Chariow n'émet **aucun** événement de remboursement ni de litige.
Un remboursement se traduit par le bouton **« Révoquer (remboursé) »** de
`/admin/payments` (permission `billing.refund`) → `revoquer_achat()` : niveau révoqué,
ou période du pass retirée (le premium tombe si plus rien ne le justifie).

## 5. Sécurité

- Clé API et secret du Pulse : serveur uniquement (`server-only`), jamais `NEXT_PUBLIC_`,
  jamais journalisés. Les journaux du webhook ne contiennent jamais le corps.
- Le navigateur n'envoie qu'un **code produit** ; `corpsCheckout` est `.strict()` : un
  champ `amount`, `product_id`, `plan` ou `role` fait échouer la requête.
- Accord conditionné à la **relecture de la vente** : statut `completed|settled`, même
  produit que le catalogue, même devise, montant ≥ attendu. Vaut aussi pour la
  confirmation manuelle admin.
- Anti-emballement : 6 intentions d'achat par heure et par compte.
- Idempotence à trois niveaux : livraison (journal), transaction (`paid` + verrou),
  droit (`unique source_ref`).

## 6. Mise en service (dans l'ordre)

1. **Appliquer `0146`** dans l'éditeur SQL Supabase, puis :
   - `get_advisors` (security) ;
   - à la **clé anon** : `user_entitlements`, `payment_webhook_events`,
     `chariow_products` → `[]` ou `42501` ; `academy_courses?select=content` → **refusé**,
     `academy_courses?select=slug,titre` → OK.
2. **Chez Chariow (mode test d'abord)** :
   - niveaux : un produit **Cours** ou **Téléchargeable** par niveau (contenu minimal :
     l'accès se fait sur westbourse.com) ;
   - pass : produits **Licence** — seul type qui accepte le rachat (les autres
     répondent `already_purchased` tant que l'accès Chariow est actif) ;
   - prix en **XOF**, identiques au catalogue (et, pour les pass, à `subscription_plans`) ;
   - un **Pulse** vers `https://www.westbourse.com/api/webhooks/chariow` avec
     `successful.sale`, `failed.sale`, `abandoned.sale`, `license.revoked`.
3. **Secrets Vercel** (Production + Preview) : `CHARIOW_API_KEY`, `CHARIOW_WEBHOOK_SECRET`
   (+ `NEXT_PUBLIC_APP_URL` facultatif). Via le tableau de bord ou `vercel env add`,
   **jamais** dans une conversation.
4. **Catalogue** (exemple, valeurs à remplacer) :
   ```sql
   insert into public.chariow_products
     (product_code, kind, libelle, niveau, amount, currency, chariow_product_id, active)
   values ('academy:debutant', 'module', 'Academy — niveau Débutant', 'debutant',
           <prix>, 'XOF', 'prd_…', true);

   update public.chariow_products
      set chariow_product_id = 'prd_…', active = true
    where product_code = 'pass:premium:monthly';
   ```
   Tant qu'aucune ligne n'est active, **aucune offre ne s'affiche**.
5. Achat test de bout en bout (`sk_test_`), puis vérifier dans
   `payment_webhook_events` : statut `traite`.

**Refonte majeure d'un niveau** :
`update academy_courses set refonte_majeure_le = now() where slug = '…';` puis créer le
produit Chariow de rachat et la ligne `academy:<niveau>:upgrade` (kind `upgrade`).

## 7. Tests

```bash
cd frontend && npx vitest run tests/chariow-regles.test.ts tests/chariow-webhook.test.ts   # 42
cd scraper  && npx vitest run tests/passRappels.test.ts                                    # 8
```

Couverts : signature (corps re-sérialisé refusé, mauvais secret, longueurs), champs
interdits au formulaire, vente non conforme (statut, produit, devise, montant), règle des
12 mois, **doublons** (même livraison, livraisons distinctes d'une même vente), **ordre**
(échec après succès, succès après abandon), Pulse arrivé avant le rattachement,
métadonnée désignant la transaction d'une autre vente, pannes Chariow et retry.

## 8. Décisions ouvertes

- **Expiration des abonnements existants.** Avant cette migration, rien ne faisait
  expirer un abonnement : `renews_at` était écrit mais jamais appliqué, `is_premium`
  restait vrai. `expirer_pass_chariow()` ne traite **que** les pass Chariow. Étendre la
  règle aux abonnements manuels/CinetPay couperait des clients actuels : décision
  commerciale à prendre à part.
- **Édition Intégrale statique** (`public/academy/index.html`, 44 leçons, tous niveaux)
  reste servie publiquement comme fichier statique. Le lien n'est plus montré qu'aux
  abonnés, mais le fichier reste accessible à qui connaît l'URL.
- Consultation `fable-advisor` (exigée avant un contrat de webhook et un cron non
  surveillé) : **tentée deux fois, échouée faute de crédit** — conception non revue par lui.
