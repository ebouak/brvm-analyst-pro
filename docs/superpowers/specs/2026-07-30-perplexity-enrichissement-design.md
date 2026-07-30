# Enrichissement Perplexity — Veille & Commodities — design

**Date** : 2026-07-30
**Statut** : approuvé, prêt pour plan d'implémentation

## 1. Pourquoi, et ce qui existe déjà

Objectif : enrichir deux modules avec de l'actualité web fraîche et sourcée,
via l'API Perplexity (recherche + citations), sans jamais relâcher la
discipline « aucune donnée inventée » déjà appliquée ailleurs dans le projet
(`assertNoForeignNumber` du module hebdo).

**Découverte structurante** : chaque module a en réalité **deux pipelines
parallèles** — un pipeline TypeScript admin-only (`scraper/src/`), et un
pipeline **Python séparé** qui alimente réellement les pages publiques :

| Module | Pipeline public (cible de ce design) | Table | Page |
|---|---|---|---|
| Veille | `veille/brvm_pipeline.py` | `brvm_news` | `/veille` |
| Commodities | `commodity_weekly_generator.py` (racine) | `brvm_news` (`source_type='analyse'`) | `/weekly` |

Les deux scripts sont **totalement indépendants** l'un de l'autre (pas de
package Python partagé, vérifié) et tournent chacun dans leur propre workflow
GitHub Actions (`veille.yml` lun-ven 07:00 UTC, `commodity-weekly.yml`
vendredis 16:30 UTC).

**Veille (`brvm_pipeline.py`)** : scrape ~150 sources RSS/sites fixes
(`veille/brvm_config.yaml`), dédoublonne par hash SHA256 local, score
sentiment/pertinence par **heuristiques mots-clés** (aucun LLM), publie dans
`brvm_news` via `veille/supabase_writer.py::map_feed_article()`. Colonne
`source_type` : `text default 'rss'`, **sans contrainte CHECK** — texte
libre.

**Commodities (`commodity_weekly_generator.py`)** : ingère prix yfinance +
Banque mondiale + **articles déjà publiés par Veille** (`brvm_news` filtré
sur 4 secteurs), calcule scores d'exposition BRVM et corrélations réelles,
construit un prompt DeepSeek prescriptif (règles de style, citation de
chiffres obligatoire, jamais de causalité non prouvée) — mais **ces règles ne
sont vérifiées que par le prompt, jamais par du code** (contrairement à
`narrative.ts`). Publie l'article HTML dans `brvm_news`
(`source_type='analyse'`).

**Précédent le plus proche déjà en prod** : `frontend/lib/diagnostic/webSearch.ts`
utilise Tavily (même famille d'outil), avec dégradation silencieuse si la clé
est absente et un cache 30 jours (`diagnostic_search_cache`) — pattern non
repris ici car chaque appel Perplexity de ce design est déjà borné à une
exécution planifiée (pas d'appels redondants à mettre en cache).

## 2. Décisions de cadrage

| Question | Décision |
|---|---|
| Pipeline visé | Le pipeline **public** Python (pas le TS admin-only) — pour les deux modules |
| Rôle Veille | **Nouvelle source, en plus** des ~150 flux RSS existants — ne touche pas au scoring existant |
| Rôle Commodities | **Contexte d'entrée** pour le prompt DeepSeek — pas de vérification a posteriori de l'article généré |
| Garde-fou anti-invention | **Sortie structurée JSON, un fait = une citation** (pas de rapprochement texte↔citation a posteriori, jugé trop fragile) |
| Cache | Aucun — chaque appel est déjà borné à une exécution cron planifiée |

## 3. Client Perplexity partagé (dupliqué, pas de package commun)

Les deux scripts n'ayant aucune dépendance croisée aujourd'hui, le client est
**dupliqué** dans chacun (même discipline que `scraper/src/hebdo/pure/` :
copie + commentaire d'en-tête expliquant pourquoi, toute correction à
reporter des deux côtés).

Modèle `sonar`, API compatible OpenAI (`base_url=https://api.perplexity.ai`).
`veille/brvm_pipeline.py` a déjà `requests` importé ; `commodity_weekly_generator.py`
a déjà `openai` et `requests` dans son `pip install` — **aucune nouvelle
dépendance pip** dans les deux workflows.

Le prompt impose une réponse JSON stricte :

```json
[
  {"titre": "...", "resume": "...", "date": "YYYY-MM-DD", "url": "https://..."}
]
```

Fonction pure de validation (dupliquée aux deux mêmes endroits que le
client) :

```python
def valider_item(item: dict, aujourdhui: date, fenetre_jours: int = 14) -> bool:
    """Rejette tout item sans URL exploitable, sans date récente, ou vide.
    Aucune tentative de « corriger » un item incomplet — on l'écarte."""
    if not item.get("url", "").startswith("http"):
        return False
    if not item.get("titre") or not item.get("resume"):
        return False
    try:
        d = date.fromisoformat(item["date"])
    except (KeyError, ValueError):
        return False
    return 0 <= (aujourdhui - d).days <= fenetre_jours
```

Tout item qui échoue est silencieusement écarté (pas d'exception, pas de
tentative de réparation).

## 4. Intégration Veille

- Nouvelle fonction dans `veille/brvm_pipeline.py`, appelée une fois par run
  du cron existant (`veille.yml`, pas de nouveau workflow).
- Requête : *« Actualités financières récentes concernant la BRVM et les
  marchés financiers UEMOA »*.
- Chaque item validé → une ligne `brvm_news`, même mapping que
  `map_feed_article()` :
  - `source='brvm'` (même valeur que les autres lignes marché BRVM)
  - `source_type='perplexity'` (texte libre, aucune migration requise)
  - `source_label='Perplexity (recherche web)'`
  - `source_url=<url citée>`
  - `dedupe_hash` calculé identiquement (évite les doublons avec un item
    qu'un flux RSS aurait déjà remonté)
- Sentiment / `score_impact` : **réutilise les heuristiques mots-clés déjà en
  place** pour les items RSS — pas de nouvelle logique de scoring, cohérence
  de traitement entre toutes les sources.
- Affichage : **aucun changement frontend**. `ArticleCard` sur `/veille`
  fonctionne déjà pour n'importe quelle ligne `brvm_news`, quelle que soit sa
  source.

## 5. Intégration Commodities

- Dans `commodity_weekly_generator.py`, avant `build_editorial_prompt()` :
  requête *« Actualités récentes ayant affecté les prix du cacao, pétrole,
  café, sucre, coton, or, argent cette semaine »*.
- Les items validés sont ajoutés au prompt DeepSeek comme bloc contextuel
  **distinct et étiqueté** (« Contexte macro récent — sources externes
  vérifiées »), séparé des blocs de données chiffrées (Banque
  mondiale/yfinance) déjà présents. `call_deepseek()` n'est pas modifiée.
- Les citations sont **aussi** rendues séparément, en HTML généré par Python
  (même logique que les tableaux BRVM-exposure/corrélation déjà construits
  aujourd'hui autour du HTML DeepSeek) — un bloc « Sources consultées » sous
  l'article, jamais fondu dans le texte généré par DeepSeek.
- Zéro JS client ajouté : bloc HTML statique, cohérent avec le fait que
  `content_html` est déjà injecté tel quel côté page (`dangerouslySetInnerHTML`
  après `sanitizeReportHtml`).

## 6. Configuration & dégradation

- Nouveau secret GitHub `PERPLEXITY_API_KEY`, ajouté à `veille.yml` et
  `commodity-weekly.yml`.
- Absence de clé ou échec d'appel → log d'avertissement, la fonction renvoie
  une liste vide, le pipeline continue exactement comme aujourd'hui — même
  philosophie que le fetcher LinkedIn déjà en place (« jamais de mock en mode
  réel », retour vide honnête plutôt qu'une donnée inventée).
- Coût borné et prévisible : 1 appel Perplexity par run Veille (quotidien
  lun-ven), 1 appel par run Commodities (hebdomadaire).

## 7. Tests

Aucune convention de test Python n'existe aujourd'hui dans ce repo (ni
`pytest` ni `unittest` sur `veille/` ou `commodity_weekly_generator.py`).
Introduction de `pytest` (nouvelle dépendance dev, ajoutée uniquement aux
étapes CI concernées) pour tester **uniquement** la fonction pure
`valider_item()`, dupliquée aux deux mêmes emplacements que le client — même
discipline « logique pure testée » que le reste du projet, sans construire
une infrastructure de test plus large que nécessaire.

Cas à couvrir : URL absente/malformée → rejeté ; titre ou résumé vide →
rejeté ; date invalide/non parsable → rejeté ; date hors fenêtre (trop
ancienne ou future) → rejeté ; item complet et récent → accepté.

## 8. Hors périmètre (explicite)

- Garde-fou de rapprochement texte↔citation a posteriori (Approche B,
  écartée — jugée trop fragile comparée au rapprochement exact de nombres
  qu'utilise `assertNoForeignNumber`).
- Remplacement du scoring sentiment/pertinence existant de Veille.
- Vérification a posteriori de l'article DeepSeek généré par Commodities.
- Nouvelle page ou composant frontend — réutilise l'affichage existant des
  deux côtés.
- Intégration du pipeline TypeScript admin-only (`scraper/src/runners/runVeille.ts`,
  `brvm_veille_digest`) — hors périmètre, pipeline non public.

## 9. Risques

| Risque | Traitement |
|---|---|
| Perplexity renvoie du texte libre au lieu du JSON demandé | `valider_item()` rejette tout ce qui ne parse pas — dégradation silencieuse, pas de crash |
| Coût API qui dérive | Fréquence bornée par design (1/jour Veille, 1/semaine Commodities), pas de boucle ni de retry agressif |
| Doublon avec un article RSS déjà remonté | `dedupe_hash` identique au mécanisme existant — le second arrivé est ignoré par l'upsert `on_conflict` |
| Item daté dans le futur ou aberrant | Fenêtre de validation stricte (0 à 14 jours) dans `valider_item()` |
| Divergence entre les deux copies du client dupliqué | Commentaire d'en-tête explicite sur les deux fichiers, même convention que `hebdo/pure/` |
