#!/usr/bin/env python3
"""
WestBourse – Commodity Weekly Generator
=========================================
Génère un article HTML hebdomadaire sur les matières premières impactant la BRVM.

Pipeline :
  1. Prix yfinance (8 futures) sur 5 jours
  2. Snapshot World Bank CMO Pink Sheet (mensuel)
  3. Articles brvm_news récents liés aux commodités
  4. Score exposition BRVM par ticker
  5. Appel DeepSeek (deepseek-chat) → HTML article
  6. Sauvegarde public/weekly/<slug>.html
  7. Upsert brvm_news (content_html + slug + metadata)

Usage:
    python commodity_weekly_generator.py           # semaine courante
    python commodity_weekly_generator.py --dry-run # sans écriture

Secrets requis (variables d'environnement) :
    DEEPSEEK_API_KEY
    NEXT_PUBLIC_SUPABASE_URL  (ou SUPABASE_URL)
    SUPABASE_SERVICE_ROLE_KEY

Dépendances :
    pip install yfinance openai requests pandas openpyxl
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

log = logging.getLogger("wb-commodity-weekly")

# ── Constantes ────────────────────────────────────────────────────────────────

YFINANCE_TICKERS = {
    "CC=F":  {"nom": "Cacao",          "unite": "USD/t",    "brvm": ["NEIC", "SIFCA"]},
    "CL=F":  {"nom": "Pétrole WTI",    "unite": "USD/bbl",  "brvm": ["TTLS", "SVOC"]},
    "BZ=F":  {"nom": "Pétrole Brent",  "unite": "USD/bbl",  "brvm": ["TTLS", "SVOC"]},
    "KC=F":  {"nom": "Café",           "unite": "USc/lb",   "brvm": []},
    "SB=F":  {"nom": "Sucre",          "unite": "USc/lb",   "brvm": []},
    "CT=F":  {"nom": "Coton",          "unite": "USc/lb",   "brvm": []},
    "GC=F":  {"nom": "Or",             "unite": "USD/oz",   "brvm": []},
    "SI=F":  {"nom": "Argent",         "unite": "USD/oz",   "brvm": []},
}

# Huile de palme et caoutchouc: pas de futures yfinance stables → WB Pink Sheet
WB_COMMODITIES = {
    "COCOA":       {"nom": "Cacao",        "brvm": ["NEIC", "SIFCA"]},
    "RUBBER_TSR20":{"nom": "Caoutchouc",   "brvm": ["SOGB", "SAPH"]},
    "PALM_OIL":    {"nom": "Huile de palme","brvm": ["PALC", "SOGB", "SIFCA", "TTRC"]},
    "CRUDE_OIL":   {"nom": "Pétrole brut", "brvm": ["TTLS", "SVOC"]},
    "COTTON_A_IDX":{"nom": "Coton",        "brvm": []},
    "GOLD":        {"nom": "Or",           "brvm": []},
}

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY", "")


# ── 1. Prix yfinance ──────────────────────────────────────────────────────────

def fetch_yfinance_prices() -> dict[str, dict]:
    """Retourne {ticker: {nom, prix_actuel, variation_5j_pct, unite, brvm[]}}."""
    try:
        import yfinance as yf
    except ImportError:
        log.warning("yfinance non installé — skip")
        return {}

    results: dict[str, dict] = {}
    for sym, meta in YFINANCE_TICKERS.items():
        try:
            hist = yf.download(sym, period="7d", interval="1d", progress=False, auto_adjust=True)
            if hist.empty or len(hist) < 2:
                continue
            closes = hist["Close"].dropna()
            if len(closes) < 2:
                continue
            prix_actuel = float(closes.iloc[-1])
            prix_debut = float(closes.iloc[0])
            variation = (prix_actuel - prix_debut) / prix_debut * 100 if prix_debut else 0.0
            results[sym] = {
                "nom": meta["nom"],
                "symbole": sym,
                "prix_actuel": round(prix_actuel, 2),
                "variation_5j_pct": round(variation, 2),
                "unite": meta["unite"],
                "brvm_tickers": meta["brvm"],
                "source": "yfinance",
            }
            log.info("yfinance %s : %.2f %s (Δ %.1f%%)", sym, prix_actuel, meta["unite"], variation)
        except Exception as e:
            log.warning("yfinance %s erreur : %s", sym, e)

    return results


# ── 2. World Bank Pink Sheet ──────────────────────────────────────────────────

def fetch_world_bank_snapshot() -> dict[str, dict]:
    """Télécharge le CMO Pink Sheet et extrait les dernières valeurs mensuelles."""
    import requests

    WB_URL = (
        "https://thedocs.worldbank.org/en/doc/5d903e848db1d1b83e0ec8f744e55570-0350012021"
        "/related/CMO-Historical-Data-Monthly.xlsx"
    )
    try:
        resp = requests.get(WB_URL, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        log.warning("World Bank download error : %s", e)
        return {}

    try:
        import pandas as pd
        from io import BytesIO

        xl = pd.ExcelFile(BytesIO(resp.content))
        # Feuille "Monthly Prices"
        sheet = "Monthly Prices"
        if sheet not in xl.sheet_names:
            sheet = xl.sheet_names[0]

        df = xl.parse(sheet, header=4, index_col=0)
        df.dropna(how="all", inplace=True)
        df.dropna(axis=1, how="all", inplace=True)

        results: dict[str, dict] = {}
        latest_col = df.columns[-1]
        prev_col = df.columns[-2] if len(df.columns) >= 2 else None

        for wb_key, meta in WB_COMMODITIES.items():
            row = None
            for idx in df.index:
                if wb_key.lower() in str(idx).lower():
                    row = df.loc[idx]
                    break
            if row is None:
                continue
            try:
                val_latest = float(row[latest_col])
                val_prev = float(row[prev_col]) if prev_col is not None else val_latest
                variation = (val_latest - val_prev) / val_prev * 100 if val_prev else 0.0
                results[wb_key] = {
                    "nom": meta["nom"],
                    "prix_actuel": round(val_latest, 2),
                    "prix_mois_precedent": round(val_prev, 2),
                    "variation_mensuelle_pct": round(variation, 2),
                    "brvm_tickers": meta["brvm"],
                    "periode": str(latest_col),
                    "source": "World Bank CMO",
                }
                log.info("WB %s : %.2f (Δm %.1f%%)", wb_key, val_latest, variation)
            except Exception:
                pass

        return results

    except Exception as e:
        log.warning("World Bank parse error : %s", e)
        return {}


# ── 3. Articles brvm_news récents (commodités) ────────────────────────────────

def fetch_supabase_articles(days: int = 14) -> list[dict]:
    """Lit brvm_news filtré sur source_type=rss et commodité/agriculture."""
    if not SUPABASE_URL or not SERVICE_KEY:
        log.warning("Supabase non configuré — skip articles")
        return []

    import requests

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    url = (
        f"{SUPABASE_URL}/rest/v1/brvm_news"
        f"?date_publication=gte.{cutoff}"
        f"&select=titre,resume,source_label,date_publication,ticker_codes,secteur"
        f"&order=date_publication.desc"
        f"&limit=50"
    )
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        articles = resp.json()
        # Filtrer : secteurs liés aux matières premières
        secteurs_cibles = {"Agriculture", "Energie", "Agroalimentaire", "Agro-industrie"}
        return [a for a in articles if a.get("secteur") in secteurs_cibles]
    except Exception as e:
        log.warning("Supabase fetch erreur : %s", e)
        return []


# ── 4. Score exposition BRVM ──────────────────────────────────────────────────

def compute_brvm_scores(
    yf_prices: dict, wb_snapshot: dict
) -> dict[str, dict]:
    """
    Pour chaque ticker BRVM exposé, calcule un score d'impact pondéré.
    Retourne {ticker: {score, commodites[], variations[]}}.
    """
    scores: dict[str, dict] = {}

    def _add(ticker: str, nom_comm: str, variation_pct: float, poids: float = 1.0):
        if ticker not in scores:
            scores[ticker] = {"score": 0.0, "commodites": [], "variations": []}
        scores[ticker]["score"] += abs(variation_pct) * poids
        scores[ticker]["commodites"].append(nom_comm)
        scores[ticker]["variations"].append(round(variation_pct, 2))

    for sym, data in yf_prices.items():
        for ticker in data.get("brvm_tickers", []):
            _add(ticker, data["nom"], data["variation_5j_pct"])

    for key, data in wb_snapshot.items():
        for ticker in data.get("brvm_tickers", []):
            _add(ticker, data["nom"], data.get("variation_mensuelle_pct", 0))

    # Normaliser score 0-100
    max_score = max((v["score"] for v in scores.values()), default=1)
    for v in scores.values():
        v["score"] = round(min(v["score"] / max_score * 100, 100), 1)

    return dict(sorted(scores.items(), key=lambda x: x[1]["score"], reverse=True))


# ── 5. Prompt Claude ──────────────────────────────────────────────────────────

def build_prompt(
    year: int, week: int,
    yf_prices: dict, wb_snapshot: dict,
    brvm_scores: dict, articles: list[dict],
) -> str:
    yf_lines = "\n".join(
        f"- {d['nom']} ({sym}): {d['prix_actuel']} {d['unite']} "
        f"(Δ5j: {d['variation_5j_pct']:+.1f}%)"
        for sym, d in yf_prices.items()
    )
    wb_lines = "\n".join(
        f"- {d['nom']}: {d['prix_actuel']} (Δm: {d.get('variation_mensuelle_pct', 0):+.1f}%, période: {d.get('periode', '?')})"
        for d in wb_snapshot.values()
    )
    brvm_lines = "\n".join(
        f"- {ticker}: score {info['score']}/100 | matières: {', '.join(info['commodites'][:3])}"
        for ticker, info in list(brvm_scores.items())[:8]
    )
    art_lines = "\n".join(
        f"- [{a.get('source_label', '?')}] {a.get('titre', '')[:120]}"
        for a in articles[:10]
    )

    return f"""Tu es l'analyste en chef de WestBourse, plateforme spécialisée sur la BRVM (Bourse Régionale des Valeurs Mobilières, UEMOA).

Génère un article HTML complet, professionnel et factuel sur l'impact des matières premières sur la BRVM pour la semaine {week} de {year}.

## DONNÉES DISPONIBLES

### Prix futures yfinance (variation 5 jours)
{yf_lines if yf_lines else "Données indisponibles cette semaine."}

### Données World Bank CMO Pink Sheet (variation mensuelle)
{wb_lines if wb_lines else "Données indisponibles."}

### Valeurs BRVM les plus exposées
{brvm_lines if brvm_lines else "Aucune exposition calculée."}

### Articles récents (contexte)
{art_lines if art_lines else "Aucun article récent disponible."}

## INSTRUCTIONS DE RÉDACTION

1. L'article doit être **factuel** : ne jamais inventer de chiffres ni extrapoler des prix non fournis.
2. Structure HTML attendue :
   - `<header>` avec titre, sous-titre, date de publication
   - `<section id="synthese">` : synthèse exécutive (3-4 phrases)
   - `<section id="marches">` : analyse par matière première (une sous-section par commodité avec données)
   - `<section id="brvm-impact">` : impact sur les valeurs BRVM (tableau ou liste)
   - `<section id="perspectives">` : perspectives pour la semaine à venir (prudent, non spéculatif)
   - `<footer>` : avertissement légal + copyright WestBourse
3. Utilise des classes CSS sémantiques : `.price-up`, `.price-down`, `.ticker-badge`, `.commodity-card`
4. Langue : **français professionnel**
5. Longueur : 600-900 mots de contenu (hors balises)
6. NE PAS inclure `<html>`, `<head>`, `<body>` — article embarqué dans une page existante

Génère uniquement le HTML de l'article, sans markdown, sans code fence.
"""


# ── 6. Appel DeepSeek ────────────────────────────────────────────────────────

def call_deepseek(prompt: str) -> str:
    if not DEEPSEEK_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY non définie")

    from openai import OpenAI

    client = OpenAI(api_key=DEEPSEEK_KEY, base_url="https://api.deepseek.com")
    resp = client.chat.completions.create(
        model="deepseek-chat",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content


# ── 7. Assemblage HTML final ──────────────────────────────────────────────────

_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta property="og:title" content="{title}">
  <meta property="og:type" content="article">
  <style>
    body {{ font-family: 'Supreme', system-ui, sans-serif; background: #030303; color: #FCFCFC; margin: 0; padding: 2rem; }}
    .commodity-weekly {{ max-width: 860px; margin: 0 auto; }}
    h1 {{ font-family: 'Bespoke Serif', Georgia, serif; color: #56D7FD; font-size: 2rem; }}
    h2 {{ color: #56D7FD; border-bottom: 1px solid #1a2a30; padding-bottom: 0.3rem; }}
    h3 {{ color: #FCFCFC; }}
    .price-up {{ color: #3fe18b; font-weight: 600; }}
    .price-down {{ color: #ff6b6b; font-weight: 600; }}
    .ticker-badge {{ display: inline-block; background: #0a1417; border: 1px solid #56D7FD33; color: #56D7FD; padding: 2px 8px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.8em; margin: 0 2px; }}
    .commodity-card {{ background: #0a1417; border: 1px solid #1a2a30; border-radius: 8px; padding: 1rem; margin: 1rem 0; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #1a2a30; }}
    th {{ color: #56D7FD; font-weight: 600; background: #0a1417; }}
    footer {{ color: #888; font-size: 0.8em; margin-top: 2rem; border-top: 1px solid #1a2a30; padding-top: 1rem; }}
  </style>
</head>
<body>
<div class="commodity-weekly">
{article_html}
</div>
</body>
</html>
"""


def build_full_html(article_html: str, title: str, description: str) -> str:
    return _HTML_TEMPLATE.format(
        title=title,
        description=description,
        article_html=article_html,
    )


# ── 8. Sauvegarde HTML ────────────────────────────────────────────────────────

def save_html(html: str, slug: str, dry_run: bool = False) -> Path:
    dest_dir = Path(__file__).parent / "frontend" / "public" / "weekly"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{slug}.html"

    if dry_run:
        log.info("[DRY-RUN] Fichier HTML : %s (%d octets)", dest, len(html))
        return dest

    dest.write_text(html, encoding="utf-8")
    log.info("HTML sauvegardé : %s", dest)
    return dest


# ── 9. Upsert Supabase ────────────────────────────────────────────────────────

def publish_supabase(
    slug: str, titre: str, article_html: str,
    year: int, week: int, brvm_scores: dict,
    dry_run: bool = False,
) -> bool:
    if dry_run:
        log.info("[DRY-RUN] Supabase upsert ignoré")
        return True
    if not SUPABASE_URL or not SERVICE_KEY:
        log.error("Supabase non configuré")
        return False

    import requests

    dedupe_hash = hashlib.md5(slug.encode()).hexdigest()[:12]
    date_pub = datetime.now(timezone.utc).date().isoformat()
    ticker_codes = list(brvm_scores.keys())[:10]

    row = {
        "dedupe_hash": dedupe_hash,
        "titre": titre[:500],
        "date_publication": date_pub,
        "source": "westbourse",
        "source_label": "WESTBOURSE PRO",
        "source_type": "analyse",
        "source_url": f"/weekly/{slug}.html",
        "resume": f"Analyse hebdomadaire des matières premières et leur impact sur la BRVM — S{week:02d} {year}",
        "instrument_code": None,
        "secteur": "Marchés – Matières premières",
        "sentiment": "neutre",
        "score_impact": 85,
        "ticker_codes": ticker_codes,
        "content_html": article_html,
        "slug": slug,
        "metadata": json.dumps({
            "type": "commodity_weekly",
            "year": year,
            "week": week,
            "tickers_count": len(ticker_codes),
        }),
    }

    url = f"{SUPABASE_URL}/rest/v1/brvm_news?on_conflict=dedupe_hash"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    resp = requests.post(url, headers=headers, json=[row], timeout=20)
    if resp.status_code in (200, 201):
        log.info("Supabase upsert OK : %s", slug)
        return True
    else:
        log.error("Supabase upsert ERREUR %d : %s", resp.status_code, resp.text[:300])
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    parser = argparse.ArgumentParser(description="WestBourse Commodity Weekly Generator")
    parser.add_argument("--dry-run", action="store_true", help="Sans écriture (test)")
    parser.add_argument("--year", type=int, default=None)
    parser.add_argument("--week", type=int, default=None)
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    year = args.year or now.year
    week = args.week or now.isocalendar()[1]
    slug = f"westbourse-commodities-weekly-{year}-w{week:02d}"

    log.info("=== Commodity Weekly Generator — %s ===", slug)

    # Étape 1 : Prix yfinance
    log.info("1/6 Récupération prix yfinance...")
    yf_prices = fetch_yfinance_prices()

    # Étape 2 : World Bank
    log.info("2/6 Snapshot World Bank CMO Pink Sheet...")
    wb_snapshot = fetch_world_bank_snapshot()

    # Étape 3 : Articles Supabase
    log.info("3/6 Articles récents (commodités) depuis brvm_news...")
    articles = fetch_supabase_articles(days=14)
    log.info("    → %d articles récupérés", len(articles))

    # Étape 4 : Scores BRVM
    log.info("4/6 Calcul scores exposition BRVM...")
    brvm_scores = compute_brvm_scores(yf_prices, wb_snapshot)
    log.info("    → %d tickers scorés", len(brvm_scores))

    # Étape 5 : Prompt + Claude
    log.info("5/6 Génération article via Claude...")
    prompt = build_prompt(year, week, yf_prices, wb_snapshot, brvm_scores, articles)

    if args.dry_run:
        log.info("[DRY-RUN] Appel DeepSeek ignoré")
        article_html = "<article><p>[DRY-RUN] Contenu DeepSeek non généré.</p></article>"
    else:
        article_html = call_deepseek(prompt)

    # Étape 6 : HTML final
    title = f"Matières premières BRVM – Semaine {week:02d}/{year} | WestBourse"
    description = (
        f"Analyse hebdomadaire de l'impact des matières premières "
        f"(cacao, pétrole, caoutchouc, huile de palme) sur les valeurs BRVM. "
        f"Semaine {week:02d}, {year}."
    )
    full_html = build_full_html(article_html, title, description)

    # Étape 7 : Sauvegarde fichier
    log.info("6/6 Sauvegarde + publication...")
    save_html(full_html, slug, dry_run=args.dry_run)

    # Étape 8 : Upsert Supabase
    ok = publish_supabase(
        slug=slug,
        titre=title,
        article_html=article_html,
        year=year,
        week=week,
        brvm_scores=brvm_scores,
        dry_run=args.dry_run,
    )

    log.info("=== Terminé. Supabase: %s | Slug: %s ===", "OK" if ok else "ERREUR", slug)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
