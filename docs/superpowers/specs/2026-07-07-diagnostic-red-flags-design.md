# Détecteur de red flags — 9e section du Diagnostic IA

## Contexte

Un lead magnet marketing (« 10 prompts Claude pour la bourse », The French Bot) a été passé en
revue via `/brainstorming` pour évaluer sa pertinence pour WESTBOURSE. Sur les 10 prompts :

- **Déjà couverts** : rapport complet (Diagnostic IA existant, mieux — fondamentaux audités réels),
  checklist débutant (mode débutant + `lib/narrative.ts`).
- **Hors périmètre BRVM** (risque d'invention de données) : earnings call (pas de transcript public
  sur la BRVM), calendrier catalyseurs spéculatif (le `/calendrier` réel existe déjà), qualité de la
  direction notée sur 12 critères (disclosure BRVM insuffisante pour la plupart).
- **Vrai gap retenu pour cette itération** : le **détecteur de red flags avec score de gravité**.
  Aucun scoring d'anomalie n'existe aujourd'hui dans `lib/diagnostic/` ni ailleurs. Réutilise les
  fondamentaux déjà extraits et vérifiés (44/48 sociétés) — zéro nouvelle source de données pour les
  8 catégories principales.

Les autres gaps identifiés (débat bulls/bears, DCF 3 scénarios, valorisation vs pairs sectoriels,
moat 10 dimensions) sont documentés mais **hors périmètre** de cette spec — à brainstormer
séparément si voulu.

## Objectif

Ajouter une 9e section « RED FLAGS » au rapport Diagnostic IA existant (`/premium/diagnostic/[code]`),
avec un score de gravité global 1-10, calculé **en code** (jamais par le LLM) pour être déterministe
et reproductible, puis narré par le LLM à partir des résultats déjà calculés.

## Architecture

Trois nouveaux modules purs dans `frontend/lib/diagnostic/`, branchés en amont de
`buildDiagnosticPrompt` (appelée depuis `app/api/diagnostic/[code]/route.ts`) :

### 1. `redFlags.ts` — 8 checks déterministes

Fonction pure `computeRedFlags(inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m: DiagnosticMetrics)` →
`{ checks: RedFlagCheck[]; overallScore: number }`.

```ts
interface RedFlagCheck {
  id: string;               // ex. 'effet_ciseaux'
  label: string;            // ex. "Effet ciseaux (CA↑, RN↓)"
  triggered: boolean;
  severity: number;         // 0-10, formule déterministe par check
  evidence: string;         // phrase avec les VRAIS chiffres (ex. "CA +8,2 %, RN -14,6 %")
  dataAvailable: boolean;   // false → exclu du score global, "non évaluable" dans le rapport
}
```

Les 8 checks (formules exactes à fixer en implémentation, à partir des champs confirmés dans
`lib/financials/types.ts` et `lib/diagnostic/metrics.ts` — `revenu_total`, `resultat_net`,
`marge_brute_n/n1`, `ebitda_n/n1`, `m.fcf_n/n1`, `m.bfr_n/n1`, `m.net_debt_n`, `m.interest_cover`,
`m.debt_ebitda`, `m.payout_ratio`, `m.fcf_div_cover`, `m.current_ratio`, `m.quick_ratio`,
`m.cash_ratio`, `m.altman_z`, `inc.actions_en_circulation` nullable) :

1. **Effet ciseaux** — CA en hausse mais RN en baisse (n vs n1)
2. **Compression des marges** — marge brute et/ou marge EBITDA en recul
3. **Divergence RN ↔ cash réel** — résultat net positif mais FCF ou flux d'exploitation négatif
   (précédent réel : BNBC 2025)
4. **Dette sous-évaluée** — BFR élevé (jours de CA) financé par découverts alors que la dette LT
   affichée est faible (précédent réel : ONTBF)
5. **Dividende non couvert** — payout ratio élevé mais `fcf_div_cover` < 1
6. **Tension de liquidité** — quick ratio < 1 et/ou current ratio proche de 1
7. **Détresse financière** — seuils Altman Z explicites (>2.6 sain / 1.1–2.6 gris / <1.1 détresse)
8. **Dilution actionnariale** — `actions_en_circulation` n vs n1, en hausse significative ;
   `dataAvailable: false` si l'un des deux champs est `null` (nullable confirmé)

Score global = moyenne pondérée des `severity` des checks `dataAvailable: true` uniquement, poids
fixes par check (constante exportée, ajustable sans casser la formule) :

| Check | Poids | Justification |
|---|---|---|
| Divergence RN ↔ cash réel | 2 | Le signal le plus trompeur — un résultat net positif qui masque un cash-flow négatif |
| Dette sous-évaluée (BFR) | 2 | Risque structurel de liquidité souvent invisible au bilan affiché |
| Détresse financière (Altman) | 1.5 | Indicateur composite déjà robuste |
| Effet ciseaux | 1 | |
| Compression des marges | 1 | |
| Dividende non couvert | 1 | |
| Tension de liquidité | 1 | |
| Dilution actionnariale | 0.5 | Signal plus faible isolément (dilution peut être saine — levée de capital de croissance) |

`overallScore = round(Σ(severity_i × poids_i) / Σ(poids_i))`, calculé uniquement sur les checks
`dataAvailable: true`. Chaque `severity` individuelle est calculée proportionnellement à l'écart au
seuil de déclenchement (ex. quick ratio : seuil 1,0 → severity 3 à 0,9, severity 8 à 0,5 ; formule
linéaire bornée [0,10], précisée par check en implémentation avec un test par cas).

### 2. `newsSignals.ts` — veille interne (gratuit)

Fonction pure/async `findNewsSignals(code, designation)` → recherche dans `brvm_news` (table déjà
peuplée par la veille) par ticker + nom de société, filtrée par mots-clés par catégorie :

- **Litiges** : litige, poursuite, judiciaire, tribunal, contentieux, sanction
- **Insiders** : démission, dirigeant, actionnaire majoritaire, cession de titres, PDG
- **Concentration client** : client principal, dépendance, contrat majeur perdu/gagné

Retourne, par catégorie, la liste des articles correspondants (titre, source, date, URL réels —
déjà en base, jamais inventés).

### 3. `webSearch.ts` — repli Tavily (conditionnel)

`findWebSignals(code, designation, categoriesSansResultat)` — appelée **uniquement** pour les
catégories où `newsSignals` n'a rien trouvé, et **uniquement si `TAVILY_API_KEY` est configurée**
(sinon no-op silencieux, même pattern que `GOOGLE_TTS_API_KEY`/`NEXT_PUBLIC_POSTHOG_KEY`).

Résultats mis en cache dans une nouvelle table `diagnostic_search_cache` (TTL 30 jours — un litige
ou un changement de dirigeant ne se périme pas en 7 jours comme le reste du diagnostic) :

```sql
create table diagnostic_search_cache (
  code text not null,
  category text not null,       -- 'litiges' | 'insiders' | 'concentration_client'
  results jsonb not null,       -- [{title, url, snippet, date}]
  fetched_at timestamptz not null default now(),
  primary key (code, category)
);
```

RLS : lecture publique (données non personnelles), écriture service_role uniquement — même
convention que les autres tables de cache du projet.

## Intégration au prompt

`buildDiagnosticPrompt` reçoit un nouveau paramètre `redFlags: { checks, overallScore, newsSignals,
webSignals }`. Le prompt instruit explicitement le LLM :

> Section 9 — RED FLAGS : voici les 8 vérifications déjà calculées avec leurs valeurs réelles
> (ci-dessous). Pour chaque red flag déclenché, rédige 2-3 phrases de contexte expliquant pourquoi
> c'est préoccupant. N'invente AUCUN chiffre — utilise uniquement les valeurs fournies. Pour les
> catégories « non évaluable », si des signaux de veille/recherche sont fournis ci-dessous, cite-les
> avec leur source et leur date ; sinon écris explicitement « non évaluable — aucune source publique
> trouvée ». Le score global de gravité (déjà calculé : {overallScore}/10) doit être repris tel quel,
> jamais recalculé ou réinterprété par toi.

## Stockage

- Nouvelle colonne `diagnostic_reports.red_flag_score` (smallint, nullable) — stockée en plus de la
  section markdown, pour réutilisation future (badge Screener/fiche action) **hors périmètre de
  cette itération** : cette spec couvre uniquement l'affichage dans le Diagnostic IA.
- Nouvelle table `diagnostic_search_cache` (ci-dessus).

## Variables d'environnement

- `TAVILY_API_KEY` (nouvelle, facultative) — même registre que `OPENAI_API_KEY`/`GOOGLE_TTS_API_KEY`
  (docs de config existants), à ajouter dans les secrets Vercel (route API, contexte serveur).

## Gestion d'erreurs

- Champ financier manquant → check individuel `dataAvailable: false`, exclu du score global
- Pas de `TAVILY_API_KEY` → étape ignorée, veille interne (`newsSignals`) fonctionne seule
- Échec réseau Tavily → capturé, traité comme "rien trouvé", jamais bloquant pour la génération
- Cache `diagnostic_search_cache` expiré (>30j) → re-requête au prochain rafraîchissement du
  diagnostic (7j) uniquement si toujours nécessaire (catégorie toujours sans signal interne)

## Tests

- `redFlags.test.ts` : par catégorie — 1 cas déclenché (avec vraies valeurs seuils), 1 cas non
  déclenché, 1 cas `dataAvailable: false` ; déterminisme du score global (mêmes inputs → même score)
- `newsSignals.test.ts` : matching mots-clés sur fixtures `brvm_news` (vrais/faux positifs)

## Hors périmètre (YAGNI, notes pour plus tard)

- Badge `red_flag_score` visible sur Screener/fiche action/Conseiller (la colonne existe, l'UI non)
- Les 4 autres gaps identifiés lors du brainstorming initial (bulls/bears, DCF 3 scénarios,
  valorisation vs pairs, moat) — sujets de brainstorming séparés si voulu
