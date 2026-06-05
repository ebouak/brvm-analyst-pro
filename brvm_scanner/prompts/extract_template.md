# Extraction des fondamentaux financiers

Tu es un expert en analyse financière. À partir du texte du rapport ci-dessous, extrait les données suivantes **pour l'exercice indiqué** et renvoie **uniquement un JSON valide** (sans aucun texte avant ou après).

Les valeurs doivent être en **millions de FCFA**, sauf `eps` (FCFA par action) et `shares_outstanding` (nombre d'actions).

## Règles d'unité (CRITIQUE)

Les états financiers BRVM indiquent leur unité en en-tête de tableau : **« en millions de FCFA »**, **« en milliers de FCFA »** ou **« en FCFA »**. Tu DOIS :
1. Repérer l'unité réelle du tableau (pas du texte marketing).
2. **Convertir toutes les valeurs monétaires en MILLIONS de FCFA.**
   - Si le tableau est en milliers → diviser par 1 000.
   - Si en FCFA bruts → diviser par 1 000 000.
3. **Ignorer les chiffres des infographies / communiqués marketing** (ex. « chiffre d'affaires aux distributeurs », « contribution économique »). Ne prendre QUE les lignes du compte de résultat et du bilan consolidés IFRS/SYSCOHADA.

## Champs demandés

- `revenue` : chiffre d'affaires / produits des activités ordinaires (en millions)
- `net_income` : résultat net **part du groupe** (attribuable aux propriétaires de la société mère) ; si non trouvé, résultat net consolidé.
- `equity` : capitaux propres totaux (part du groupe + minoritaires) (en millions)
- `debt_total` : dette financière totale (passifs financiers courants + non courants) ; sinon `null`
- `cash` : trésorerie et équivalents de trésorerie (en millions) ; sinon `null`
- `eps` : bénéfice net par action (FCFA) ; sinon `null`
- `dividend_per_share` : dividende brut par action (FCFA) ; sinon `null`
- `shares_outstanding` : nombre total d'actions (unités) ; à calculer si possible (capital social / valeur nominale, ou RN / EPS)

## Texte du rapport

{{TEXT}}

## Réponse (JSON uniquement)
