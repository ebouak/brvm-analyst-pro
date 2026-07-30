# Enrichissement Perplexity (Veille + Commodities) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrichir les deux pipelines Python publics (Veille → `/veille`, Commodities → `/weekly`) avec l'API Perplexity (recherche web + citations), en source additive pour Veille et en contexte d'entrée pour Commodities — jamais de texte inventé, jamais de fusion citation/prose non vérifiée.

**Architecture:** Une fonction pure `valider_item_perplexity()` dupliquée dans les deux scripts (aucun package Python partagé entre eux) filtre toute réponse Perplexity mal formée avant usage. Côté Veille, un 7e fetcher inline (`fetch_perplexity`) suit exactement le même contrat que les 6 fetchers existants dans `veille/brvm_pipeline.py`. Côté Commodities, un nouveau contexte (`fetch_perplexity_context`) alimente le prompt DeepSeek déjà existant et un bloc HTML séparé (`build_sources_perplexity`) affiche les citations sans jamais les mélanger au texte généré.

**Tech Stack:** Python 3.11/3.12 (scripts flat, sans framework), `requests` (déjà présent), `pytest` (nouvelle dépendance dev, introduite ici), GitHub Actions (secrets).

Spec de référence : `docs/superpowers/specs/2026-07-30-perplexity-enrichissement-design.md`.

---

## Task 1: Fonction pure `valider_item_perplexity` côté Veille

**Files:**
- Modify: `veille/brvm_pipeline.py` (ajoute la fonction après `fetch_scraping`, avant `# EXPORT JSON`)
- Test: `veille/test_perplexity_client.py` (nouveau)

- [ ] **Step 1: Écrire le test qui échoue**

Créer `veille/test_perplexity_client.py` :

```python
from datetime import datetime, timedelta

from brvm_pipeline import valider_item_perplexity

MAINTENANT = datetime(2026, 7, 30, 12, 0, 0)


def item_valide(**overrides):
    base = {
        "titre": "BRVM : la capitalisation franchit un nouveau seuil",
        "resume": "La capitalisation boursière de la BRVM a progressé cette semaine.",
        "date": "2026-07-28",
        "url": "https://www.example.com/article",
    }
    base.update(overrides)
    return base


def test_item_complet_et_recent_est_accepte():
    assert valider_item_perplexity(item_valide(), MAINTENANT) is True


def test_url_absente_est_rejetee():
    item = item_valide(url="")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_url_malformee_est_rejetee():
    item = item_valide(url="pas-une-url")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_titre_vide_est_rejete():
    item = item_valide(titre="")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_resume_vide_est_rejete():
    item = item_valide(resume="")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_date_invalide_est_rejetee():
    item = item_valide(date="pas-une-date")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_date_trop_ancienne_est_rejetee():
    date_ancienne = (MAINTENANT - timedelta(days=30)).strftime("%Y-%m-%d")
    item = item_valide(date=date_ancienne)
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_date_dans_le_futur_est_rejetee():
    date_future = (MAINTENANT + timedelta(days=5)).strftime("%Y-%m-%d")
    item = item_valide(date=date_future)
    assert valider_item_perplexity(item, MAINTENANT) is False
```

- [ ] **Step 2: Installer pytest et lancer le test pour confirmer qu'il échoue**

Run (depuis `veille/`) :
```bash
pip install pytest
pytest test_perplexity_client.py -v
```
Expected: FAIL — `ImportError: cannot import name 'valider_item_perplexity' from 'brvm_pipeline'`.

- [ ] **Step 3: Ajouter la fonction pure**

Dans `veille/brvm_pipeline.py`, juste après la fin de `fetch_scraping` (juste avant le
commentaire `# EXPORT JSON (3 fichiers)`, ligne ~434), insérer :

```python
# ─────────────────────────────────────────────────────────────
# COLLECTE 7 — PERPLEXITY (recherche web sourcée, additive)
# ─────────────────────────────────────────────────────────────
def valider_item_perplexity(item: dict, maintenant: datetime, fenetre_jours: int = 14) -> bool:
    """Rejette tout item sans URL exploitable, sans titre/résumé, ou hors
    fenêtre de fraîcheur. Aucune tentative de réparer un item incomplet — on
    l'écarte silencieusement (design §3). Copie identique dans
    commodity_weekly_generator.py — toute correction doit être reportée des
    deux côtés (pas de module Python partagé entre les deux pipelines)."""
    if not isinstance(item, dict):
        return False
    url = item.get("url", "")
    if not isinstance(url, str) or not url.startswith("http"):
        return False
    if not item.get("titre") or not item.get("resume"):
        return False
    try:
        d = datetime.strptime(str(item.get("date", "")), "%Y-%m-%d")
    except (TypeError, ValueError):
        return False
    delta_jours = (maintenant.replace(tzinfo=None) - d).days
    return 0 <= delta_jours <= fenetre_jours
```

- [ ] **Step 4: Relancer le test pour confirmer qu'il passe**

Run: `pytest test_perplexity_client.py -v`
Expected: PASS — 8/8 tests verts.

- [ ] **Step 5: Commit**

```bash
git add veille/brvm_pipeline.py veille/test_perplexity_client.py
git commit -m "feat(veille): valider_item_perplexity - filtre les reponses Perplexity mal formees"
```

---

## Task 2: Fetcher `fetch_perplexity` + branchement dans `run_pipeline` (Veille)

**Files:**
- Modify: `veille/brvm_pipeline.py:26` (import `os`), `:64-68` (labels), section ajoutée en Task 1, `run_pipeline()` (~ligne 522-575)

- [ ] **Step 1: Ajouter l'import `os`**

Dans `veille/brvm_pipeline.py:26`, remplacer :

```python
import re, json, time, sqlite3, hashlib, logging, argparse, schedule
```

par :

```python
import os, re, json, time, sqlite3, hashlib, logging, argparse, schedule
```

- [ ] **Step 2: Ajouter `fetch_perplexity` juste après `valider_item_perplexity`**

Dans `veille/brvm_pipeline.py`, directement après la fonction `valider_item_perplexity`
ajoutée en Task 1 :

```python
def fetch_perplexity(idx: dict, alertes: list, global_kw: list, cfg: dict) -> list:
    """Source additive : interroge Perplexity (recherche web + citations) pour
    de l'actualité BRVM/UEMOA récente. Sortie JSON stricte imposée — un fait =
    une citation, jamais de synthèse libre non sourcée (design §3-4).
    Dégradation silencieuse si la clé est absente ou l'appel échoue : la
    pipeline continue avec les ~150 autres sources, comme n'importe quel
    fetcher de ce fichier."""
    api_key = os.environ.get("PERPLEXITY_API_KEY", "")
    if not api_key:
        log.info("[Perplex.] PERPLEXITY_API_KEY absente — source ignorée")
        return []

    prompt = (
        "Actualités financières récentes concernant la BRVM (Bourse Régionale "
        "des Valeurs Mobilières) et les marchés financiers de l'UEMOA. "
        "Réponds UNIQUEMENT avec un tableau JSON strict, sans texte autour, "
        'de la forme : [{"titre": "...", "resume": "...", "date": "YYYY-MM-DD", '
        '"url": "https://..."}]. Un objet par fait distinct, chacun avec sa '
        "propre source. N'invente aucune URL : n'inclus que des faits que tu "
        "peux citer."
    )
    try:
        resp = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "sonar", "messages": [{"role": "user", "content": prompt}]},
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        items = json.loads(content)
        if not isinstance(items, list):
            raise ValueError("réponse JSON n'est pas une liste")
    except Exception as ex:
        log.warning(f"[Perplex.] ✗ {ex}")
        return []

    maintenant = datetime.utcnow()
    results = []
    for item in items:
        if not valider_item_perplexity(item, maintenant):
            continue
        titre = item["titre"].strip()
        url_e = item["url"].strip()
        resume = item["resume"].strip()
        texte = f"{titre} {resume}"
        results.append({
            "hash": make_hash(titre, url_e), "titre": titre, "url": url_e,
            "source": "Perplexity (recherche web)", "source_type": "perplexity",
            "date_pub": item["date"], "resume": resume,
            "langue": "fr", "pertinence": max(0.5, score(texte, global_kw)),
            "sentiment": sentiment(texte),
            "est_alerte": is_alerte(texte, alertes),
            "_tickers": match_tickers(texte, idx),
        })
    if results:
        log.info(f"[Perplex.] {len(results):>3} art.")
    return results
```

- [ ] **Step 3: Brancher l'appel dans `run_pipeline`**

Dans `veille/brvm_pipeline.py`, la fonction `run_pipeline` a 6 étapes numérotées
`[1/6]` à `[6/6]` (lignes ~526-573). Ajouter une 7e étape juste après la fin de
l'étape 6 (scraping officiel) et avant le commentaire `# ── Déduplication &
stockage ─────────────────────────────`  :

```python
    # ── 7. Perplexity (recherche web sourcée) ────────────────
    log.info(f"\n[7/7] Perplexity – recherche web sourcée")
    all_articles.extend(fetch_perplexity(idx, alertes_kw, global_kw, config))
    totals["perplexity"] = sum(1 for a in all_articles if a.get("source_type")=="perplexity")
```

Puis renuméroter les 6 labels existants de `[X/6]` vers `[X/7]` (mise à jour de
cohérence directement causée par l'ajout d'une 7e étape) :
- ligne ~526 : `log.info(f"\n[1/6] RSS général – {len(rss_general)} sources")` → `[1/7]`
- ligne ~534 : `log.info(f"\n[2/6] Google News – {len(sites_soc)} flux société")` → `[2/7]`
- ligne ~547 : `log.info(f"\n[3/6] Sites officiels – {len(sites_soc)} sociétés")` → `[3/7]`
- ligne ~555 : `log.info(f"\n[4/6] Matières premières – {len(rss_commodites)} flux")` → `[4/7]`
- ligne ~563 : `log.info(f"\n[5/6] Institutions – {len(rss_insts)} sources")` → `[5/7]`
- ligne ~571 : `log.info(f"\n[6/6] Scraping officiel – {len(scraping_off)} pages")` → `[6/7]`

- [ ] **Step 4: Mettre à jour le docstring d'en-tête (liste des sources)**

Dans `veille/brvm_pipeline.py:5-11`, après la ligne `• Scraping BRVM.org + CREPMF +
UEMOA (officiel)`, ajouter :

```
  • Perplexity (recherche web sourcée, additive — voir PERPLEXITY_API_KEY)
```

- [ ] **Step 5: Vérifier que le module s'importe sans erreur**

Run (depuis `veille/`) : `python -c "import brvm_pipeline"`
Expected: aucune erreur (le module s'importe, crée `data/`, `output/`, `logs/`
si absents — comportement déjà existant).

- [ ] **Step 6: Relancer les tests Task 1 pour confirmer l'absence de régression**

Run : `pytest test_perplexity_client.py -v`
Expected: PASS — 8/8 toujours verts (l'ajout de `fetch_perplexity` ne touche
pas `valider_item_perplexity`).

- [ ] **Step 7: Commit**

```bash
git add veille/brvm_pipeline.py
git commit -m "feat(veille): fetch_perplexity - 7e source additive dans run_pipeline"
```

---

## Task 3: Fonction pure `valider_item_perplexity` côté Commodities

**Files:**
- Modify: `commodity_weekly_generator.py` (ajoute la fonction après `fetch_brvm_correlations`, avant `build_editorial_prompt`)
- Test: `test_commodity_perplexity.py` (nouveau, racine du repo)

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test_commodity_perplexity.py` (à la racine du repo, à côté de
`commodity_weekly_generator.py`) :

```python
from datetime import datetime, timedelta, timezone

from commodity_weekly_generator import valider_item_perplexity

MAINTENANT = datetime(2026, 7, 30, 12, 0, 0, tzinfo=timezone.utc)


def item_valide(**overrides):
    base = {
        "titre": "Le cacao progresse sur fond de tensions climatiques",
        "resume": "Les cours du cacao ont augmenté cette semaine en Côte d'Ivoire.",
        "date": "2026-07-28",
        "url": "https://www.example.com/cacao",
    }
    base.update(overrides)
    return base


def test_item_complet_et_recent_est_accepte():
    assert valider_item_perplexity(item_valide(), MAINTENANT) is True


def test_url_absente_est_rejetee():
    item = item_valide(url="")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_url_malformee_est_rejetee():
    item = item_valide(url="pas-une-url")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_titre_vide_est_rejete():
    item = item_valide(titre="")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_resume_vide_est_rejete():
    item = item_valide(resume="")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_date_invalide_est_rejetee():
    item = item_valide(date="pas-une-date")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_date_trop_ancienne_est_rejetee():
    date_ancienne = (MAINTENANT - timedelta(days=30)).strftime("%Y-%m-%d")
    item = item_valide(date=date_ancienne)
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_date_dans_le_futur_est_rejetee():
    date_future = (MAINTENANT + timedelta(days=5)).strftime("%Y-%m-%d")
    item = item_valide(date=date_future)
    assert valider_item_perplexity(item, MAINTENANT) is False
```

Ce test passe un `maintenant` **timezone-aware** (`tzinfo=timezone.utc`),
contrairement au test Veille (Task 1) qui passe un `datetime` naïf — c'est
précisément le cas que `.replace(tzinfo=None)` doit gérer dans
`valider_item_perplexity`, pour que la même fonction fonctionne dans les deux
fichiers sans changement.

- [ ] **Step 2: Lancer le test pour confirmer qu'il échoue**

Run (depuis la racine du repo) :
```bash
pytest test_commodity_perplexity.py -v
```
Expected: FAIL — `ImportError: cannot import name 'valider_item_perplexity' from 'commodity_weekly_generator'`.

- [ ] **Step 3: Ajouter la fonction pure (copie identique à Task 1)**

Dans `commodity_weekly_generator.py`, juste après la fin de
`fetch_brvm_correlations` (avant le commentaire `# ── 4. Prompt éditorial
──...` ou équivalent précédant `build_editorial_prompt`, ligne ~525), insérer :

```python
# ── 3c. Contexte macro récent (Perplexity) ──────────────────────────────────

def valider_item_perplexity(item: dict, maintenant: datetime, fenetre_jours: int = 14) -> bool:
    """Rejette tout item sans URL exploitable, sans titre/résumé, ou hors
    fenêtre de fraîcheur. Aucune tentative de réparer un item incomplet — on
    l'écarte silencieusement (design §3). Copie identique dans
    veille/brvm_pipeline.py — toute correction doit être reportée des deux
    côtés (pas de module Python partagé entre les deux pipelines)."""
    if not isinstance(item, dict):
        return False
    url = item.get("url", "")
    if not isinstance(url, str) or not url.startswith("http"):
        return False
    if not item.get("titre") or not item.get("resume"):
        return False
    try:
        d = datetime.strptime(str(item.get("date", "")), "%Y-%m-%d")
    except (TypeError, ValueError):
        return False
    delta_jours = (maintenant.replace(tzinfo=None) - d).days
    return 0 <= delta_jours <= fenetre_jours
```

- [ ] **Step 4: Relancer le test pour confirmer qu'il passe**

Run: `pytest test_commodity_perplexity.py -v`
Expected: PASS — 8/8 tests verts, y compris le cas timezone-aware.

- [ ] **Step 5: Commit**

```bash
git add commodity_weekly_generator.py test_commodity_perplexity.py
git commit -m "feat(commodities): valider_item_perplexity - copie identique cote commodities"
```

---

## Task 4: `fetch_perplexity_context` + injection dans le prompt DeepSeek

**Files:**
- Modify: `commodity_weekly_generator.py` (ajoute la fonction après `valider_item_perplexity` de Task 3 ; modifie `build_editorial_prompt` ; ajoute `PERPLEXITY_KEY`)

- [ ] **Step 1: Déclarer `PERPLEXITY_KEY`**

Dans `commodity_weekly_generator.py`, juste après la ligne `DEEPSEEK_KEY =
DEEPSEEK_KEY.encode("ascii", "ignore").decode("ascii")` (ligne ~136), ajouter :

```python
PERPLEXITY_KEY = os.environ.get("PERPLEXITY_API_KEY", "").strip()
```

- [ ] **Step 2: Ajouter `fetch_perplexity_context`**

Juste après `valider_item_perplexity` (ajoutée en Task 3), ajouter :

```python
def fetch_perplexity_context(commodites: list[str]) -> list[dict]:
    """Contexte macro récent via Perplexity (recherche web + citations) —
    injecté dans le prompt DeepSeek comme bloc distinct, jamais vérifié a
    posteriori (design §5 : rôle volontairement limité au contexte d'entrée,
    pas de garde-fou de rapprochement texte/citation). Dégradation silencieuse
    si la clé est absente ou l'appel échoue : l'article se génère sans ce
    bloc, exactement comme aujourd'hui."""
    if not PERPLEXITY_KEY:
        log.info("PERPLEXITY_API_KEY absente — contexte macro ignoré")
        return []

    import requests

    liste = ", ".join(commodites)
    prompt = (
        f"Actualités récentes ayant affecté les prix de : {liste}, cette "
        "semaine. Réponds UNIQUEMENT avec un tableau JSON strict, sans texte "
        'autour, de la forme : [{"titre": "...", "resume": "...", '
        '"date": "YYYY-MM-DD", "url": "https://..."}]. Un objet par fait '
        "distinct, chacun avec sa propre source. N'invente aucune URL."
    )
    try:
        resp = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers={"Authorization": f"Bearer {PERPLEXITY_KEY}", "Content-Type": "application/json"},
            json={"model": "sonar", "messages": [{"role": "user", "content": prompt}]},
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        items = json.loads(content)
        if not isinstance(items, list):
            raise ValueError("réponse JSON n'est pas une liste")
    except Exception as e:
        log.warning("Perplexity contexte macro erreur : %s", e)
        return []

    maintenant = datetime.now(timezone.utc)
    return [it for it in items if valider_item_perplexity(it, maintenant)]
```

Notez l'`import requests` **local** à la fonction — ce fichier importe déjà
`requests` localement dans `fetch_supabase_articles` et
`fetch_brvm_correlations` plutôt qu'en haut de fichier ; on suit la même
convention plutôt que d'ajouter un import global.

- [ ] **Step 3: Ajouter le paramètre et le bloc de contexte dans `build_editorial_prompt`**

Dans `commodity_weekly_generator.py`, la signature de `build_editorial_prompt`
(ligne ~527) passe de :

```python
def build_editorial_prompt(
    prices: list,
    wb: dict,
    articles: list,
    brvm_scores: dict,
    correlations: list | None = None,
    week: int | None = None,
    year: int | None = None,
) -> str:
```

à :

```python
def build_editorial_prompt(
    prices: list,
    wb: dict,
    articles: list,
    brvm_scores: dict,
    correlations: list | None = None,
    perplexity_items: list[dict] | None = None,
    week: int | None = None,
    year: int | None = None,
) -> str:
```

Juste après le bloc `art_ctx` existant (qui se termine par `art_ctx += f"\n
[{a.get('source_label','')}] {a.get('titre','')[:130]}"`, avant la ligne
`top_brvm = ...`), ajouter :

```python
    perplex_ctx = ""
    if perplexity_items:
        perplex_ctx = "\nContexte macro récent (sources externes vérifiées) :"
        for it in perplexity_items[:6]:
            perplex_ctx += f"\n  [{it.get('date','')}] {it.get('titre','')[:130]}"
```

Puis dans le f-string retourné, juste après la ligne `{art_ctx}` (dans le bloc
`DONNÉES :`), ajouter `{perplex_ctx}` :

```python
DONNÉES :
{price_lines}
{wb_ctx}
{art_ctx}
{perplex_ctx}
Top BRVM scorées : {top_brvm}
{corr_ctx}
```

- [ ] **Step 4: Vérifier que le module s'importe et que la fonction s'exécute sans clé**

Run (depuis la racine du repo) :
```bash
python -c "
from commodity_weekly_generator import fetch_perplexity_context, build_editorial_prompt
items = fetch_perplexity_context(['Cacao', 'Pétrole'])
print('items sans cle:', items)
assert items == []
"
```
Expected: affiche `items sans cle: []` sans lever d'exception (aucune clé
`PERPLEXITY_API_KEY` dans cet environnement de test).

- [ ] **Step 5: Relancer les tests Task 3 pour confirmer l'absence de régression**

Run: `pytest test_commodity_perplexity.py -v`
Expected: PASS — 8/8 toujours verts.

- [ ] **Step 6: Commit**

```bash
git add commodity_weekly_generator.py
git commit -m "feat(commodities): fetch_perplexity_context - contexte macro dans le prompt DeepSeek"
```

---

## Task 5: Bloc HTML « Sources consultées » + branchement dans `main()`

**Files:**
- Modify: `commodity_weekly_generator.py` (`assemble_content_html`, `main`)

- [ ] **Step 1: Ajouter `build_sources_perplexity`**

Dans `commodity_weekly_generator.py`, juste après `build_footer` (ligne ~952,
avant `def assemble_content_html`), ajouter :

```python
def build_sources_perplexity(items: list[dict]) -> str:
    """Bloc « Sources consultées » : rendu Python déterministe, jamais fondu
    dans le texte DeepSeek (design §5 — contexte d'entrée uniquement, les
    citations restent affichées séparément et vérifiables individuellement)."""
    if not items:
        return ""
    rows = "".join(
        f'<li style="margin-bottom:6px;font-size:12px;color:#475569;">'
        f'<a href="{it.get("url","")}" style="color:#1d4ed8;text-decoration:none;" '
        f'target="_blank" rel="noopener noreferrer">{it.get("titre","")}</a>'
        f' <span style="color:#94a3b8;">— {it.get("date","")}</span></li>'
        for it in items
    )
    return (
        '<div style="border-top:1px solid #e2e8f0;padding-top:14px;margin-top:20px;">'
        '<p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;'
        'letter-spacing:.08em;margin:0 0 10px 0;">Contexte macro — sources consultées</p>'
        f'<ul style="margin:0;padding-left:18px;">{rows}</ul>'
        '</div>'
    )
```

- [ ] **Step 2: Ajouter le paramètre et l'insertion dans `assemble_content_html`**

Dans `commodity_weekly_generator.py`, la signature de `assemble_content_html`
(ligne ~955) passe de :

```python
def assemble_content_html(
    editorial_html: str,
    prices: list,
    brvm_scores: dict,
    correlations: list | None = None,
    year: int | None = None,
    week: int | None = None,
) -> str:
```

à :

```python
def assemble_content_html(
    editorial_html: str,
    prices: list,
    brvm_scores: dict,
    correlations: list | None = None,
    perplexity_items: list[dict] | None = None,
    year: int | None = None,
    week: int | None = None,
) -> str:
```

Le corps actuel :

```python
    corr_html = build_correlation_table(correlations or [])
    return (
        '<article style="font-family:\'Segoe UI\',system-ui,sans-serif;'
        'max-width:900px;margin:0 auto;color:#1e293b;line-height:1.8;">\n'
        + build_hero_section(prices, week_num, year) + "\n"
        + build_svg_barchart(prices) + "\n"
        + build_commodity_cards(prices) + "\n"
        + text + "\n"
        + build_brvm_table(prices, brvm_scores) + "\n"
        + corr_html + "\n"
        + build_footer(year) + "\n"
        + "</article>"
    )
```

devient :

```python
    corr_html = build_correlation_table(correlations or [])
    sources_html = build_sources_perplexity(perplexity_items or [])
    return (
        '<article style="font-family:\'Segoe UI\',system-ui,sans-serif;'
        'max-width:900px;margin:0 auto;color:#1e293b;line-height:1.8;">\n'
        + build_hero_section(prices, week_num, year) + "\n"
        + build_svg_barchart(prices) + "\n"
        + build_commodity_cards(prices) + "\n"
        + text + "\n"
        + build_brvm_table(prices, brvm_scores) + "\n"
        + corr_html + "\n"
        + sources_html + "\n"
        + build_footer(year) + "\n"
        + "</article>"
    )
```

- [ ] **Step 3: Brancher dans `main()`**

Dans `commodity_weekly_generator.py::main()`, juste après l'étape « 4b/7
Calcul corrélations » (qui se termine par `log.info("    → %d filières
analysées ...")`, ligne ~1175) et avant l'étape 5 (`log.info("5/7 Génération
article via DeepSeek...")`), ajouter :

```python
    # Étape 4c : Contexte macro Perplexity
    log.info("4c/7 Contexte macro récent (Perplexity)...")
    noms_commodites = [v["nom"] for v in YFINANCE_TICKERS.values()]
    perplexity_items = fetch_perplexity_context(noms_commodites)
    log.info("    → %d item(s) de contexte retenus", len(perplexity_items))
```

Puis, dans le même `main()`, l'appel à `build_editorial_prompt` :

```python
    prompt = build_editorial_prompt(
        prices, wb_summary, articles, brvm_scores_simple, correlations,
        week=week, year=year,
    )
```

devient :

```python
    prompt = build_editorial_prompt(
        prices, wb_summary, articles, brvm_scores_simple, correlations,
        perplexity_items=perplexity_items, week=week, year=year,
    )
```

Et l'appel à `assemble_content_html` :

```python
    article_html = assemble_content_html(
        editorial_html, prices, brvm_scores_simple, correlations, year=year, week=week,
    )
```

devient :

```python
    article_html = assemble_content_html(
        editorial_html, prices, brvm_scores_simple, correlations,
        perplexity_items=perplexity_items, year=year, week=week,
    )
```

- [ ] **Step 4: Vérifier en dry-run que le script s'exécute de bout en bout**

Run (depuis la racine du repo, sans `PERPLEXITY_API_KEY` ni `DEEPSEEK_API_KEY`
dans l'environnement) :
```bash
python commodity_weekly_generator.py --dry-run
```
Expected: le script se termine sans lever d'exception (retourne 0 ou 1 selon
`publish_supabase`, mais ne doit pas planter sur l'absence de clé Perplexity —
`fetch_perplexity_context` doit avoir loggé « PERPLEXITY_API_KEY absente —
contexte macro ignoré » et continué).

- [ ] **Step 5: Relancer les tests Task 3 pour confirmer l'absence de régression**

Run: `pytest test_commodity_perplexity.py -v`
Expected: PASS — 8/8 toujours verts.

- [ ] **Step 6: Commit**

```bash
git add commodity_weekly_generator.py
git commit -m "feat(commodities): build_sources_perplexity - bloc citations separe + branchement main()"
```

---

## Task 6: Secrets GitHub Actions

**Files:**
- Modify: `.github/workflows/veille.yml`, `.github/workflows/commodity-weekly.yml`

Aucune nouvelle dépendance pip dans les deux workflows : `requests` est déjà
présent dans les deux `pip install` (vérifié — `veille.yml` l'a explicitement,
`commodity-weekly.yml` aussi).

- [ ] **Step 1: Ajouter le secret dans `veille.yml`**

Dans `.github/workflows/veille.yml`, l'étape « Run pipeline » (ligne ~32-44)
passe de :

```yaml
      - name: Run pipeline
        working-directory: veille
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
```

à :

```yaml
      - name: Run pipeline
        working-directory: veille
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          PERPLEXITY_API_KEY: ${{ secrets.PERPLEXITY_API_KEY }}
        run: |
```

- [ ] **Step 2: Ajouter le secret dans `commodity-weekly.yml`**

Dans `.github/workflows/commodity-weekly.yml`, l'étape « Générer l'article »
(ligne ~38-45) passe de :

```yaml
      - name: Générer l'article
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
```

à :

```yaml
      - name: Générer l'article
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          PERPLEXITY_API_KEY: ${{ secrets.PERPLEXITY_API_KEY }}
        run: |
```

- [ ] **Step 3: Valider la syntaxe YAML des deux fichiers**

Run :
```bash
npx -y js-yaml .github/workflows/veille.yml > /dev/null && echo "veille.yml OK"
npx -y js-yaml .github/workflows/commodity-weekly.yml > /dev/null && echo "commodity-weekly.yml OK"
```
Expected: `veille.yml OK` puis `commodity-weekly.yml OK`, sans erreur de
parsing.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/veille.yml .github/workflows/commodity-weekly.yml
git commit -m "feat(cron): cable PERPLEXITY_API_KEY dans les workflows veille et commodity-weekly"
```

**Note opérationnelle (pas une tâche de code)** : le secret GitHub
`PERPLEXITY_API_KEY` doit être ajouté manuellement dans les paramètres du
dépôt (`Settings → Secrets and variables → Actions`) avec la clé déjà déposée
dans `frontend/.env.local` — ce fichier sert le frontend Next.js, pas les
workflows GitHub Actions, qui ont leur propre magasin de secrets séparé.

---

## Self-Review

**Couverture de la spec** (`2026-07-30-perplexity-enrichissement-design.md`) :

- §2 (pipeline public visé, rôles additif/contexte, pas de cache) → confirmé
  par construction (Task 2 = fetcher additif Veille, Task 4-5 = contexte +
  citations séparées Commodities, aucune table de cache créée).
- §3 (client partagé dupliqué, sortie JSON structurée, `valider_item`) →
  Task 1 (Veille) et Task 3 (Commodities), fonctions identiques.
- §4 (intégration Veille) → Task 2.
- §5 (intégration Commodities, citations séparées) → Task 4 (contexte prompt)
  et Task 5 (bloc HTML séparé).
- §6 (configuration/dégradation, secrets, coût borné) → Task 6 (secrets),
  dégradation silencieuse déjà codée dans Task 2/4 (`if not api_key: return
  []`, jamais d'exception qui remonte).
- §7 (tests pytest sur `valider_item`) → Task 1 Step 1 et Task 3 Step 1 (8 cas
  chacun, dont date invalide/hors fenêtre/future — couverture légèrement plus
  large que les 5 cas minimum listés dans la spec).
- §8 (hors périmètre) : aucune tâche ne touche au scoring sentiment/pertinence
  existant au-delà de la réutilisation en lecture (`sentiment()`, `score()`),
  aucune vérification a posteriori de l'article DeepSeek, aucune nouvelle
  page frontend, aucune intégration du pipeline TS admin-only — confirmé.

**Balayage placeholders** : aucun « TBD »/« TODO » — chaque étape contient le
code exact.

**Cohérence des types/signatures** : `valider_item_perplexity(item: dict,
maintenant: datetime, fenetre_jours: int = 14) -> bool` identique dans les
deux fichiers (Task 1 et Task 3). `fetch_perplexity(idx, alertes, global_kw,
cfg)` (Task 2) suit exactement la signature des fetchers voisins
(`fetch_institution(source, idx, alertes, global_kw, cfg)` — ordre des
paramètres légèrement différent car `fetch_perplexity` n'a pas de `source`
individuelle à itérer, mais les noms `idx`/`alertes`/`global_kw`/`cfg`
correspondent). `fetch_perplexity_context(commodites: list[str]) ->
list[dict]` (Task 4) et `build_sources_perplexity(items: list[dict]) -> str`
(Task 5) utilisés de façon cohérente dans `main()` (Task 5 Step 3) —
`perplexity_items` est le nom de variable utilisé de bout en bout (fetch →
prompt → HTML), pas de renommage en cours de route.
