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
  5. Appel LLM (DeepSeek → Gemini → Grok) → HTML article
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
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta

# ── Chargement automatique .env ───────────────────────────────────────────────
def _load_env(*paths: str) -> None:
    for path in paths:
        try:
            with open(path, encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        if k.strip() and k.strip() not in os.environ:
                            os.environ[k.strip()] = v.strip()
        except FileNotFoundError:
            pass

_here = os.path.dirname(os.path.abspath(__file__))
_load_env(
    os.path.join(_here, "scraper", ".env.local"),
    os.path.join(_here, "scraper", ".env"),
    os.path.join(_here, ".env.local"),
    os.path.join(_here, ".env"),
)
import html as _html
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

import commodity_weekly_qualite as _q

log = logging.getLogger("wb-commodity-weekly")

# Codes réellement cotés (registre du frontend). Tout code d'exposition passe
# par lui : la S46/2026 citait SVOC, SIFCA, SAPH, SOGB et SUCR, absents de la cote.
REFERENTIEL = _q.charger_referentiel()
_INCONNUS = _q.codes_inconnus(REFERENTIEL)
if _INCONNUS:
    raise SystemExit(f"Registre d'exposition : codes absents de la cote {_INCONNUS}")


def _brvm(matiere: str | None) -> list[str]:
    return _q.codes_exposes(matiere, REFERENTIEL)

# ── Constantes ────────────────────────────────────────────────────────────────

YFINANCE_TICKERS = {
    "CC=F":  {"nom": "Cacao",          "unite": "USD/t",    "brvm": []},   # aucun émetteur cacao coté
    "CL=F":  {"nom": "Pétrole WTI",    "unite": "USD/bbl",  "brvm": _brvm("petrole")},
    "BZ=F":  {"nom": "Pétrole Brent",  "unite": "USD/bbl",  "brvm": _brvm("petrole")},
    "KC=F":  {"nom": "Café",           "unite": "USc/lb",   "brvm": []},
    "SB=F":  {"nom": "Sucre",          "unite": "USc/lb",   "brvm": _brvm("sucre")},
    "CT=F":  {"nom": "Coton",          "unite": "USc/lb",   "brvm": []},   # aucun émetteur coton coté
    "GC=F":  {"nom": "Or",             "unite": "USD/oz",   "brvm": []},   # pas de minier coté BRVM
    "SI=F":  {"nom": "Argent",         "unite": "USD/oz",   "brvm": []},
}

# Photos Unsplash par commodity (IDs vérifiés, libres de droits)
COMMODITY_PHOTOS: dict[str, str] = {
    "CC=F": "photo-1481391319762-47dff72954d9",  # cacao pods
    "CL=F": "photo-1611273426858-450d8e3c9fce",  # oil refinery at night
    "BZ=F": "photo-1614850523296-d8c1af93d400",  # offshore oil rig
    "KC=F": "photo-1447933601403-0c6688de566e",  # coffee beans close-up
    "SB=F": "photo-1559181567-c3190ca9d5db",     # sugarcane harvest
    "CT=F": "photo-1597916829826-02e5bb4a54e0",  # cotton field
    "GC=F": "photo-1610375461246-83df859d849d",  # gold bars
    "SI=F": "photo-1611091354429-99f5dc04af7b",  # silver coins
}
# Photo hero de fallback (marché financier Afrique)
HERO_FALLBACK_PHOTO = "photo-1559526324-4b87b5e36e44"  # stock market board

def _photo_url(photo_id: str, w: int = 800, h: int = 450) -> str:
    return f"https://images.unsplash.com/{photo_id}?w={w}&h={h}&fit=crop&auto=format&q=80"

# Huile de palme et caoutchouc: pas de futures yfinance stables → WB Pink Sheet
WB_COMMODITIES = {
    "COCOA":       {"nom": "Cacao",         "brvm": []},
    "RUBBER_TSR20":{"nom": "Caoutchouc",    "brvm": _brvm("caoutchouc")},
    "PALM_OIL":    {"nom": "Huile de palme","brvm": _brvm("huile_palme")},
    "CRUDE_OIL":   {"nom": "Pétrole brut",  "brvm": _brvm("petrole")},
    "COTTON_A_IDX":{"nom": "Coton",         "brvm": []},
    "GOLD":        {"nom": "Or",            "brvm": []},
}

@dataclass
class CommodityPrice:
    label: str
    ticker: str
    current: float
    unit: str
    weekly_change_pct: float
    week_low: float
    week_high: float

    @property
    def signal(self) -> str:
        if self.weekly_change_pct > 2:
            return "HAUSSE"
        elif self.weekly_change_pct < -2:
            return "BAISSE"
        return "STABLE"

    def to_prompt_line(self) -> str:
        sign = "+" if self.weekly_change_pct >= 0 else ""
        arrow = "↑" if self.weekly_change_pct >= 0 else "↓"
        return (
            f"{self.label} ({self.ticker}): {self.current:.2f} {self.unit} "
            f"— Δ5j {arrow} {sign}{self.weekly_change_pct:.2f}%"
        )


SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
def _resoudre_cle_llm(fournisseur: str) -> str:
    """Clé LLM : variable d'environnement d'abord, table `api_keys` ensuite.

    Même ordre que `resolveApiKey` (frontend) et `resolveApiKeyForScraper`
    (scraper). Ce script était le SEUL consommateur à n'avoir aucun repli : il
    dépendait donc d'un secret GitHub qu'il fallait tenir synchronisé à la main
    avec la table. Mesuré le 2026-09-26 : les deux portaient des clés
    DIFFÉRENTES, toutes deux valides ce jour-là — rien ne garantissait qu'elles
    le restent. Avec ce repli, mettre à jour `/admin/cles-api` suffit.
    """
    depuis_env = os.environ.get(f"{fournisseur.upper()}_API_KEY", "").strip()
    if depuis_env:
        return depuis_env
    if not SUPABASE_URL or not SERVICE_KEY:
        return ""
    try:
        import requests

        # Les clés `sb_secret_` veulent `apikey` SEUL : en Bearer, PostgREST
        # répond « Invalid JWT ». Les clés héritées veulent les deux.
        entetes = {"apikey": SERVICE_KEY, "User-Agent": "westbourse-weekly/1.0"}
        if not SERVICE_KEY.startswith("sb_"):
            entetes["Authorization"] = f"Bearer {SERVICE_KEY}"
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/api_keys",
            params={"select": "api_key", "provider": f"eq.{fournisseur}"},
            headers=entetes,
            timeout=15,
        )
        r.raise_for_status()
        lignes = r.json()
        return (lignes[0].get("api_key") or "").strip() if lignes else ""
    except Exception:
        # Une clé illisible ne doit pas faire tomber le script ici : l'appelant
        # lève déjà « DEEPSEEK_API_KEY non définie » avec un message clair.
        return ""


# Nettoyer la clé : supprimer espaces et caractères non-ASCII (problème copier-coller)
DEEPSEEK_KEY = _resoudre_cle_llm("deepseek")
DEEPSEEK_KEY = DEEPSEEK_KEY.encode("ascii", "ignore").decode("ascii")
PERPLEXITY_KEY = os.environ.get("PERPLEXITY_API_KEY", "").strip()


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
            hist = yf.download(sym, period="1mo", interval="1d", progress=False, auto_adjust=True)
            if hist.empty:
                continue
            # yfinance >= 0.2.x retourne un MultiIndex pour un seul ticker
            bars = hist[["Close", "Low", "High"]].dropna()
            f = _q.fenetre_hebdo(
                [float(x) for x in bars["Close"].squeeze().tolist()],
                [float(x) for x in bars["Low"].squeeze().tolist()],
                [float(x) for x in bars["High"].squeeze().tolist()],
            )
            if not f:
                log.warning("yfinance %s écarté : moins de 6 séances disponibles", sym)
                continue
            prix_actuel, variation = f["prix"], f["variation_pct"]
            week_low, week_high = round(f["bas"], 2), round(f["haut"], 2)
            if not _q.cours_coherent(prix_actuel, week_low, week_high):
                log.warning("yfinance %s écarté : clôture %.2f hors fourchette [%.2f ; %.2f]",
                            sym, prix_actuel, week_low, week_high)
                continue
            results[sym] = {
                "n_seances": f["n_seances"],
                "nom": meta["nom"],
                "symbole": sym,
                "prix_actuel": round(prix_actuel, 2),
                "variation_5j_pct": round(variation, 2),
                "week_low": week_low,
                "week_high": week_high,
                "unite": meta["unite"],
                "brvm_tickers": meta["brvm"],
                "source": "yfinance",
            }
            log.info("yfinance %s : %.2f %s (Δ %.1f%%)", sym, prix_actuel, meta["unite"], variation)
        except Exception as e:
            log.warning("yfinance %s erreur : %s", sym, e)

    return results


def fetch_eurusd() -> dict | None:
    """EUR/USD en début et fin de fenêtre : le franc CFA est arrimé à l'euro,
    donc USD/FCFA = 655,957 / EURUSD. None si la donnée manque (bloc FCFA absent)."""
    try:
        import yfinance as yf
        hist = yf.download("EURUSD=X", period="1mo", interval="1d", progress=False, auto_adjust=True)
        closes = hist["Close"].squeeze().dropna()
        if len(closes) < 6:
            return None
        actuel, debut = float(closes.iloc[-1]), float(closes.iloc[-6])
        if not (0.5 < actuel < 2.0 and 0.5 < debut < 2.0):
            return None
        return {"actuel": round(actuel, 5), "debut": round(debut, 5)}
    except Exception as e:
        log.warning("EUR/USD indisponible : %s", e)
        return None


def fetch_semaine_precedente(year: int, week: int) -> dict | None:
    """Métadonnées de l'hebdo de la semaine ISO précédente (pour le bilan)."""
    if not SUPABASE_URL or not SERVICE_KEY:
        return None
    import requests
    lundi = datetime.fromisocalendar(year, week, 1) - timedelta(days=7)
    y, w, _ = lundi.isocalendar()
    slug = f"westbourse-commodities-weekly-{y}-w{w:02d}"
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/brvm_news?slug=eq.{slug}&select=metadata&limit=1",
            headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}, timeout=15)
        resp.raise_for_status()
        rows = resp.json()
        return rows[0].get("metadata") if rows else None
    except Exception as e:
        log.warning("Hebdo précédent illisible : %s", e)
        return None


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


# ── 3b. Corrélations BRVM ↔ Matières premières (même calcul que /premium/correlations) ──

# Filières agro-industrielles BRVM : matière sous-jacente → producteurs cotés
_FILIERES_CORR = {
    "Huile de palme": {"commodity": "palm_oil", "codes": _brvm("huile_palme"), "couleur": "#f59e0b"},
    "Caoutchouc":     {"commodity": "rubber",   "codes": _brvm("caoutchouc"),  "couleur": "#22c55e"},
    "Sucre":          {"commodity": "sugar",    "codes": _brvm("sucre"),       "couleur": "#e879f9"},
    # Cacao retiré : aucun émetteur cacao n'est coté. L'ancienne ligne le
    # corrélait à CFAC (CFAO Motors, distribution automobile).
}


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    """Corrélation de Pearson sur rendements mensuels (même méthode que la page /correlations)."""
    n = len(xs)
    if n < 6:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    if dx == 0 or dy == 0:
        return None
    return round(num / (dx * dy), 3)


def _monthly_returns(levels: list[float]) -> list[float]:
    """Rendements mensuels (variation % mois sur mois). Évite les fausses corr. de tendance."""
    return [
        (levels[i] - levels[i - 1]) / levels[i - 1]
        for i in range(1, len(levels))
        if levels[i - 1] > 0
    ]


def fetch_brvm_correlations() -> list[dict]:
    """
    Calcule la corrélation Pearson (mensuelle) entre chaque filière agro BRVM
    et sa matière première sous-jacente. Données : commodity_prices + brvm_actions_daily.
    Retourne une liste de dicts prêts pour build_correlation_table() et le prompt.
    """
    if not SUPABASE_URL or not SERVICE_KEY:
        log.warning("Supabase non configuré — skip corrélations")
        return []

    import requests

    since = (datetime.now(timezone.utc).replace(year=datetime.now().year - 5)).date().isoformat()
    headers = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}

    # 1) Tous les prix commodity (monthly) depuis 5 ans
    commo_keys = ",".join({m["commodity"] for m in _FILIERES_CORR.values()})
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/commodity_prices"
            f"?commodity=in.({commo_keys})&date=gte.{since}"
            f"&select=commodity,date,price&order=date.asc&limit=5000",
            headers=headers, timeout=20,
        )
        resp.raise_for_status()
        commo_rows = resp.json()
    except Exception as e:
        log.warning("Supabase commodity_prices erreur : %s", e)
        return []

    # Index : commodity_key → {YYYY-MM: price}
    commo_by_month: dict[str, dict[str, float]] = {}
    for row in commo_rows:
        key = row["commodity"]
        month = row["date"][:7]
        commo_by_month.setdefault(key, {})[month] = float(row["price"])

    # 2) Cours des actions agro (journalier) → moyenne mensuelle
    all_codes = list({c for m in _FILIERES_CORR.values() for c in m["codes"]})
    codes_str = ",".join(all_codes)
    # PostgREST plafonne À 1000 LIGNES EN SILENCE, quel que soit `limit` :
    # mesuré le 2026-10-31, 1000 lignes reçues sur 4946 — les corrélations
    # portaient sur fin 2021 – mi-2022 seulement. D'où la pagination.
    page = 1000
    stock_rows = []
    try:
        while True:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/brvm_actions_daily"
                f"?code=in.({codes_str})&date_marche=gte.{since}"
                f"&select=code,cours_jour,date_marche"
                f"&cours_jour=not.is.null&order=date_marche.asc,code.asc"
                f"&limit={page}&offset={len(stock_rows)}",
                headers=headers, timeout=30,
            )
            resp.raise_for_status()
            lot = resp.json()
            stock_rows.extend(lot)
            if len(lot) < page:
                break
    except Exception as e:
        # Bloquant depuis le 2026-10-31 : le filtre était écrit
        # `not.cours_jour=is.null` (400 à chaque exécution) et l'avertissement
        # laissait partir un rapport sans les valeurs agricoles BRVM, sans que
        # rien ne le dise. Mieux vaut pas de rapport qu'un rapport amputé en silence.
        raise RuntimeError(f"Supabase brvm_actions_daily illisible : {e}") from e

    # Index : code → {YYYY-MM: [prices...]}
    stock_vals: dict[str, dict[str, list[float]]] = {}
    for row in stock_rows:
        code = row["code"]
        month = row["date_marche"][:7]
        val = row.get("cours_jour")
        if val is None:
            continue
        stock_vals.setdefault(code, {}).setdefault(month, []).append(float(val))

    # Moyenne mensuelle par code
    stock_by_month: dict[str, dict[str, float]] = {}
    for code, months in stock_vals.items():
        stock_by_month[code] = {m: sum(vs) / len(vs) for m, vs in months.items()}

    # 3) Calcul Pearson pour chaque filière
    results = []
    for label, meta in _FILIERES_CORR.items():
        commo_m = commo_by_month.get(meta["commodity"], {})

        # Moyenne mensuelle agrégée sur tous les codes de la filière
        all_months = set(commo_m.keys())
        for code in meta["codes"]:
            all_months &= set(stock_by_month.get(code, {}).keys())
        common = sorted(all_months)

        if len(common) < 6:
            results.append({
                "matiere": label, "codes": meta["codes"], "couleur": meta["couleur"],
                "coefficient": None, "n_months": len(common), "available": False,
                "interpretation": "Données insuffisantes", "direction": "neutre",
                "macro_reading": f"{label} : moins de 6 mois communs disponibles.",
            })
            continue

        # Moyenne des actions de la filière
        agg_stock = []
        for m in common:
            vals = [stock_by_month[code][m] for code in meta["codes"] if m in stock_by_month.get(code, {})]
            agg_stock.append(sum(vals) / len(vals) if vals else 0)

        commo_levels = [commo_m[m] for m in common]
        stock_ret = _monthly_returns(agg_stock)
        commo_ret = _monthly_returns(commo_levels)
        min_len = min(len(stock_ret), len(commo_ret))
        coeff = _pearson(commo_ret[:min_len], stock_ret[:min_len])

        # Interprétation
        abs_c = abs(coeff) if coeff is not None else 0
        if abs_c > 0.7:
            interp = "Forte"
        elif abs_c > 0.4:
            interp = "Modérée"
        else:
            interp = "Faible"
        direction = "positive" if (coeff or 0) >= 0 else "négative"

        # Lecture macro simplifiée (même logique que agroMacro.ts)
        if len(commo_levels) >= 12:
            change12 = (commo_levels[-1] - commo_levels[-13]) / commo_levels[-13] if commo_levels[-13] else 0
        else:
            change12 = 0
        trend = "hausse" if change12 > 0.05 else "baisse" if change12 < -0.05 else "stable"
        sign = "+" if change12 >= 0 else ""
        if coeff and abs_c > 0.3:
            impact = (
                f" Marges des producteurs orientées favorablement, corrélation {coeff:+.2f}."
                if trend == "hausse" else
                f" Pression sur les marges, susceptible de peser sur le cours (corrélation {coeff:+.2f})."
                if trend == "baisse" else ""
            )
        else:
            impact = " Lien faible avec le cours de l'action sur la période."
        macro = f"{label} : {sign}{change12*100:.1f}% sur 12 mois, tendance {trend}.{impact}"

        results.append({
            "matiere": label, "codes": meta["codes"], "couleur": meta["couleur"],
            "coefficient": coeff, "n_months": min_len + 1, "available": True,
            "interpretation": interp, "direction": direction,
            "macro_reading": macro,
        })
        log.info("Corrélation %s ↔ %s : r=%.3f (%s)", label, meta["commodity"], coeff or 0, interp)

    return results


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


# ── 4b. Convertisseurs pour build_prompt ────────────────────────────────────

def build_prices_list(yf_prices: dict) -> list[CommodityPrice]:
    """Convertit yf_prices dict → liste de CommodityPrice triée par variation abs."""
    result = []
    for sym, data in yf_prices.items():
        result.append(CommodityPrice(
            label=data["nom"],
            ticker=sym,
            current=data["prix_actuel"],
            unit=data["unite"],
            weekly_change_pct=data["variation_5j_pct"],
            week_low=data.get("week_low", data["prix_actuel"]),
            week_high=data.get("week_high", data["prix_actuel"]),
        ))
    return sorted(result, key=lambda p: abs(p.weekly_change_pct), reverse=True)


def build_wb_summary(wb_snapshot: dict) -> dict:
    """Convertit wb_snapshot → dict plat {nom: prix, 'month': periode}."""
    summary: dict = {}
    for data in wb_snapshot.values():
        summary[data["nom"]] = data.get("prix_actuel", 0)
        if "periode" in data and "month" not in summary:
            summary["month"] = str(data["periode"])
    return summary


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


def url_joignable(url: str, requete=None, timeout: int = 10) -> bool:
    """Le lien cité par Perplexity mène-t-il réellement quelque part ?

    `valider_item_perplexity` ne contrôle que la FORME de l'URL. Or c'est un
    modèle qui la fournit : une URL plausible mais inexistante passerait, et
    s'afficherait dans « Sources consultées » (décision du 2026-09-28). On
    interroge donc le site : HEAD d'abord, GET si le serveur refuse HEAD
    (403/405/501, fréquent), redirections suivies. Statut final < 400 →
    joignable. Toute erreur réseau → non joignable : un doute écarte l'item.

    `requete(methode, url)` → code HTTP, injectable pour les tests. Copie
    identique dans veille/brvm_pipeline.py — toute correction doit être
    reportée des deux côtés."""
    if requete is None:
        import requests

        def requete(methode: str, u: str) -> int:
            r = requests.request(methode, u, allow_redirects=True, timeout=timeout, stream=True,
                                 headers={"User-Agent": "Mozilla/5.0 (compatible; WestBourseVeille/1.0)"})
            r.close()
            return r.status_code
    # Notre propre site n'est pas une source externe : Perplexity résumait
    # nos pages, republiées ensuite comme actualité (5 articles sur 40 au
    # 2026-09-28). Écarté avant tout appel réseau.
    try:
        hote = (urlparse(url).hostname or "").lower()
    except ValueError:
        return False
    if hote == "westbourse.com" or hote.endswith(".westbourse.com"):
        return False
    try:
        code = requete("HEAD", url)
        if code in (403, 405, 501):
            code = requete("GET", url)
        return code < 400
    except Exception:
        return False


def ressemble_a_un_article(url: str) -> bool:
    """Le lien désigne-t-il UN article, et pas une page de liste ? Dernier
    segment du chemin : au moins 20 caractères avec un tiret.
    Copie identique dans veille/brvm_pipeline.py (voir la raison là-bas) —
    toute correction doit être reportée des deux côtés."""
    try:
        chemin = urlparse(url).path.rstrip("/")
    except ValueError:
        return False
    dernier = chemin.rsplit("/", 1)[-1] if chemin else ""
    return len(dernier) >= 20 and "-" in dernier


def rechercher_perplexity(requetes, maintenant: datetime, client=None, fenetre_jours: int = 14,
                          max_results: int = 20) -> list[dict]:
    """API Search de Perplexity (POST /search) : des résultats RÉELS, classés,
    avec titre, URL, extrait et date de la page. Aucun texte de modèle, donc
    aucune URL inventée (l'ancien appel Sonar faisait écrire les adresses par le
    modèle). Un champ absent reste absent : une date nulle échoue à la
    validation, elle n'est jamais complétée.

    Filtres calés sur le comportement déjà observé : fenêtre de 14 jours (celle
    de valider_item_perplexity), français et anglais, westbourse.com exclu
    (url_joignable l'écarte déjà).

    `client` injectable pour les tests ; sinon le SDK `perplexityai` lit
    PERPLEXITY_API_KEY dans l'environnement. Copie identique dans
    veille/brvm_pipeline.py — toute correction doit être reportée des deux
    côtés (pas de module Python partagé entre les deux pipelines)."""
    if client is None:
        from perplexity import Perplexity
        client = Perplexity(timeout=30)
    debut = (maintenant - timedelta(days=fenetre_jours)).strftime("%m/%d/%Y")
    reponse = client.search.create(
        query=list(requetes),
        max_results=max_results,
        search_after_date_filter=debut,
        search_language_filter=["fr", "en"],
        search_domain_filter=["-westbourse.com"],
    )
    items = []
    for r in getattr(reponse, "results", None) or []:
        date = r.date
        # Une date ISO avec heure garde son jour ; tout autre format est laissé
        # tel quel et sera rejeté à la validation.
        if isinstance(date, str) and re.match(r"^\d{4}-\d{2}-\d{2}", date):
            date = date[:10]
        items.append({"titre": r.title, "resume": r.snippet, "date": date, "url": r.url})
    return items


def requetes_commodites(commodites: list[str], par_lot: int = 5) -> list[list[str]]:
    """Une requête par matière première, par lots de 5 : l'API Search accepte
    jusqu'à cinq requêtes par appel, facturées comme une seule."""
    requetes = [f"{nom} prix actualité de la semaine" for nom in commodites]
    return [requetes[i:i + par_lot] for i in range(0, len(requetes), par_lot)]


def fetch_perplexity_context(commodites: list[str], client=None) -> list[dict]:
    """Contexte macro récent via l'API Search de Perplexity — injecté dans le
    prompt DeepSeek comme bloc distinct (design §5 : rôle volontairement limité
    au contexte d'entrée). Titre et extrait viennent des pages trouvées, plus
    d'un résumé rédigé par un modèle. Dégradation silencieuse si la clé est
    absente ou l'appel échoue : l'article se génère sans ce bloc, exactement
    comme aujourd'hui."""
    if not PERPLEXITY_KEY and client is None:
        log.info("PERPLEXITY_API_KEY absente — contexte macro ignoré")
        return []

    maintenant = datetime.now(timezone.utc)
    items: list[dict] = []
    try:
        for lot in requetes_commodites(commodites):
            items.extend(rechercher_perplexity(lot, maintenant, client=client))
    except Exception as e:
        # Le SDK ne place jamais la clé dans ses messages d'erreur.
        log.warning("Perplexity contexte macro erreur : %s: %s", type(e).__name__, e)
        return []

    valides = [it for it in items if valider_item_perplexity(it, maintenant)]
    uniques: dict[str, dict] = {}
    for it in valides:
        uniques.setdefault(str(it["url"]).strip(), it)  # un article = une URL
    articles = [u for u in uniques if ressemble_a_un_article(u)]
    joignables = [uniques[u] for u in articles if url_joignable(u)]
    if len(joignables) < len(valides):
        log.info("Perplexity : %d item(s) écarté(s) (doublon, page de liste ou lien injoignable)", len(valides) - len(joignables))
    # Ligne de bilan stable : comparer le taux d'URL joignables avant / après
    # le passage à l'API Search.
    taux = f"{len(joignables) / len(articles):.0%}" if articles else "n/a"
    log.info("Perplexity bilan recus=%d valides=%d articles=%d joignables=%d taux_joignables=%s",
             len(items), len(uniques), len(articles), len(joignables), taux)
    return joignables


# ── 5. Prompt DeepSeek + Builders visuels Python ─────────────────────────────

def build_editorial_prompt(
    prices: list,
    wb: dict,
    articles: list,
    correlations: list | None = None,
    perplexity_items: list[dict] | None = None,
    week: int | None = None,
    year: int | None = None,
    edition: str = "note",
    fcfa: list[dict] | None = None,
    refus: list[str] | None = None,
) -> str:
    """
    Le LLM ne rédige QUE l'analyse par matière. Titre, synthèse, tableaux,
    conversions, scénarios et bilan sont calculés par Python. Tout nombre du
    texte doit figurer dans DONNÉES : `verrous()` le contrôle après coup.
    """
    def ligne(p) -> str:
        d = _q.dec_prix(p.current)
        pos = _q.position_pct(p)
        return (f"  - {p.label} ({p.ticker}) : clôture {_q.fr(p.current, d)} {p.unit} ; variation semaine "
                f"{_q.pct(p.weekly_change_pct)} ; fourchette {_q.fr(p.week_low, d)} à {_q.fr(p.week_high, d)} ; "
                f"amplitude {_q.fr(_q.amplitude_pct(p), 1)} % ; clôture à "
                f"{'n/d' if pos is None else round(pos)} % de la fourchette")

    price_lines = "\n".join(ligne(p) for p in prices)
    presse = [f"  [{a.get('source_label','')}] {str(a.get('titre',''))[:130]}" for a in (articles or [])[:6]]
    presse += [f"  [{it.get('date','')}] {str(it.get('titre',''))[:130]}" for it in (perplexity_items or [])[:8]]
    presse_ctx = "\n".join(presse) or "  (aucun titre disponible)"

    expo_ctx = "\n".join(
        f"  {_q.LIBELLE_MATIERE[m]} : " + ", ".join(f"{_q.NOMS[e['code']]} ({e['code']}) — {e['canal']}"
                                                   for e in lst if e["code"] in REFERENTIEL)
        for m, lst in _q.EXPOSITIONS.items())

    corr_ctx = "\n".join(
        f"  {c['matiere']} ({', '.join(c['codes'])}) : r = {_q.fr(c['coefficient'], 2)} sur {c['n_months']} mois"
        for c in (correlations or []) if c.get("available") and c.get("coefficient") is not None
    ) or "  (aucune corrélation disponible)"

    fcfa_ctx = "\n".join(
        f"  {l['label']} : {_q.fr(l['prix_fcfa'], 0 if l['prix_fcfa'] >= 100 else 2)} {l['unite']} ; "
        f"variation en FCFA {_q.pct(l['var_fcfa'])}" for l in (fcfa or [])) or "  (taux de change indisponible)"

    consigne_edition = {
        "note": "Chaque matière reçoit un bloc de longueur comparable.",
        "briefing": "Semaine calme : deux phrases au plus par paragraphe, aucun développement.",
        "dossier": f"La matière dominante ({prices[0].label}) reçoit un bloc deux fois plus long que les autres, placé en premier.",
    }[edition]

    reprise = ""
    if refus:
        reprise = ("\nTA VERSION PRÉCÉDENTE A ÉTÉ REFUSÉE pour ces raisons, corrige-les toutes :\n"
                   + "\n".join(f"  - {r}" for r in refus) + "\n")

    return f"""Tu es analyste matières premières pour WESTBOURSE (BRVM, UEMOA).
Rédige l'analyse par matière de l'hebdo — semaine {week}/{year}. Édition : {_q.NOM_EDITION[edition]}.
{reprise}
DONNÉES (seule source de chiffres autorisée) :
{price_lines}

PRIX EN FRANCS CFA :
{fcfa_ctx}

TITRES DE PRESSE DE LA SEMAINE (seule source d'explications autorisée) :
{presse_ctx}

VALEURS BRVM EXPOSÉES (seuls codes autorisés, à citer sous la forme « Nom (CODE) ») :
{expo_ctx}
  Cacao, café, coton, or, argent : aucune société cotée exposée directement.

CORRÉLATIONS HISTORIQUES :
{corr_ctx}

RÈGLES, chacune vérifiée par un contrôle automatique qui refuse le texte :
1. Tout nombre que tu écris figure tel quel dans DONNÉES, PRIX EN FRANCS CFA, CORRÉLATIONS ou un TITRE DE PRESSE. Aucun calcul, aucun arrondi nouveau, aucun niveau de prix de mémoire.
2. Nombres à la française : virgule décimale, espace des milliers, « % » précédé d'une espace.
3. Aucun code de valeur hors de la liste ci-dessus.
4. Aucune recommandation ni orientation de portefeuille : tu informes, tu ne conseilles pas.
5. Tu ne parles ni de « score », ni de « notation ».
6. Phrases de 22 mots au plus, voix active, présent. Pas d'émoji, pas de point d'exclamation, pas de superlatif.
7. {consigne_edition}

CHAQUE BLOC a exactement quatre paragraphes, dans cet ordre, chacun ouvert par son étiquette en <strong> :
- « Fait vérifié. » Le mouvement chiffré, tiré de DONNÉES. Dis si la clôture est près du plus bas ou du plus haut quand c'est le cas.
- « Lecture. » L'explication donnée par les TITRES DE PRESSE, en nommant la source entre crochets. Si aucun titre ne porte sur cette matière, écris seulement : « Aucune cause identifiée dans nos sources. » N'en invente pas. Cette phrase ne peut apparaître que deux fois : regroupe en un seul bloc les matières sans explication.
- « Hypothèse. » Ce qui pourrait suivre, au conditionnel, rattaché à un seuil de DONNÉES (plus bas ou plus haut de la semaine).
- « Transmission à la BRVM. » Le canal vers les valeurs exposées, ou l'absence de société cotée exposée.

FORMAT : HTML, styles en ligne uniquement. Commence par <section> et termine par </section>. Un bloc =

<div style="border:1px solid #e2e8f0;border-radius:8px;padding:18px 20px;margin-bottom:16px;">
  <p style="font-size:11px;color:#64748b;font-weight:600;margin:0 0 6px 0;">[Énergie | Métaux précieux | Agriculture]</p>
  <h3 style="font-size:17px;font-weight:700;margin:0 0 10px 0;color:#0f172a;">[Titre factuel de 12 mots au plus, qui nomme la ou les matières du bloc]</h3>
  <p style="margin:0 0 8px 0;font-size:14px;color:#334155;"><strong style="color:#0f172a;">Fait vérifié.</strong> …</p>
  <p style="margin:0 0 8px 0;font-size:14px;color:#334155;"><strong style="color:#0f172a;">Lecture.</strong> …</p>
  <p style="margin:0 0 8px 0;font-size:14px;color:#334155;"><strong style="color:#0f172a;">Hypothèse.</strong> …</p>
  <p style="margin:0;font-size:14px;color:#334155;"><strong style="color:#0f172a;">Transmission à la BRVM.</strong> …</p>
</div>

Chaque matière de DONNÉES doit être nommée par son libellé exact dans au moins un bloc. 700 mots au plus au total."""


# ── 5a. Blocs calculés (aucun texte de LLM) ──────────────────────────────────

_H2 = 'style="font-size:18px;font-weight:700;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:0 0 12px 0;"'
_TH = 'style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;"'
_TD = 'style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;"'
_NIVEAUX = {
    "essentiel": ("Essentiel", "Pour tous : l'essentiel en 30 secondes", "#065f46", "#d1fae5"),
    "investisseur": ("Investisseur", "Pour suivre la cote : l'analyse", "#1e3a8a", "#dbeafe"),
    "pro": ("Pro", "Pour aller plus loin : méthode, corrélations, sources", "#3b0764", "#ede9fe"),
}


def build_badge(niveau: str) -> str:
    """Bandeau de niveau de lecture : le lecteur sait où s'arrêter."""
    nom, legende, encre, fond = _NIVEAUX[niveau]
    return (f'<div style="display:flex;align-items:center;gap:10px;margin:32px 0 14px 0;">'
            f'<span style="background:{fond};color:{encre};font-size:11px;font-weight:700;'
            f'padding:4px 10px;border-radius:12px;">{nom}</span>'
            f'<span style="font-size:12px;color:#64748b;">{legende}</span></div>')


def build_essentiel(prices: list, fcfa: list[dict], edition: str) -> str:
    """Synthèse en langage simple, calculée : trois phrases, aucun jargon."""
    if not prices:
        return ""
    top = max(prices, key=lambda p: abs(p.weekly_change_pct))
    hausses = sum(1 for p in prices if p.weekly_change_pct >= 0.5)
    baisses = sum(1 for p in prices if p.weekly_change_pct <= -0.5)
    stables = len(prices) - hausses - baisses
    nom = _q.ARTICLE.get(top.label, top.label.lower())
    puces = [
        f"Le plus fort mouvement de la semaine : {nom} "
        f"{'gagne' if top.weekly_change_pct > 0 else 'perd'} {_q.fr(abs(top.weekly_change_pct))} %.",
        f"Sur {len(prices)} matières suivies : {hausses} en hausse, {baisses} en baisse, {stables} stable(s).",
    ]
    brent = next((l for l in fcfa if l["ticker"] == "BZ=F"), None)
    if brent:
        puces.append(f"En francs CFA, le baril de Brent vaut {_q.fr(brent['prix_fcfa'], 0)} FCFA "
                     f"({_q.pct(brent['var_fcfa'])} sur la semaine).")
    puces.append("Une matière première qui monte ou baisse ne fait pas à elle seule monter ou baisser "
                 "une action : le tableau « Valeurs exposées » dit par quel canal elle peut peser.")
    items = "".join(f'<li style="margin-bottom:6px;">{_html.escape(t)}</li>' for t in puces)
    return (build_badge("essentiel")
            + f'<div style="background:#f0fdf4;border-radius:8px;padding:16px 20px;margin-bottom:8px;">'
            f'<ul style="margin:0;padding-left:18px;font-size:15px;color:#0f172a;">{items}</ul>'
            f'<p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">Édition de la semaine : '
            f'{_q.NOM_EDITION[edition]}.</p></div>')


def build_bilan(bilan: list[dict]) -> str:
    """Ce que nous surveillions la semaine passée, et ce qui s'est produit."""
    if not bilan:
        return ""
    items = "".join(
        f'<li style="margin-bottom:6px;"><strong style="color:{"#b91c1c" if b["franchi"] else "#065f46"};">'
        f'{"Seuil franchi" if b["franchi"] else "Seuil tenu"}.</strong> {_html.escape(b["texte"])}</li>'
        for b in bilan)
    return (f'<div style="border:1px solid #0f172a;border-radius:8px;padding:16px 20px;margin:16px 0 8px 0;">'
            f'<p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#0f172a;">'
            f'Bilan de la semaine précédente : les seuils que nous surveillions</p>'
            f'<ul style="margin:0;padding-left:18px;font-size:14px;color:#334155;">{items}</ul></div>')


def build_seuils(seuils: list[dict]) -> str:
    if not seuils:
        return ""
    items = "".join(
        f'<li style="margin-bottom:4px;">{_html.escape(s["label"])} : '
        f'{"plus bas" if s["type"] == "bas" else "plus haut"} de la semaine à '
        f'{_q.fr(s["niveau"], _q.dec_prix(s["niveau"]))} {_html.escape(s["unite"])}</li>' for s in seuils)
    return (f'<div style="margin-bottom:28px;"><h2 {_H2}>Seuils à surveiller la semaine prochaine</h2>'
            f'<ul style="margin:0;padding-left:18px;font-size:14px;color:#334155;">{items}</ul>'
            f'<p style="font-size:12px;color:#64748b;margin:8px 0 0 0;">Nous dirons dans le prochain numéro '
            f'si chacun a tenu ou cédé.</p></div>')


def build_legende_preuve() -> str:
    return ('<p style="font-size:12px;color:#64748b;margin:0 0 14px 0;">'
            '<strong style="color:#0f172a;">Fait vérifié</strong> : chiffre de marché contrôlé. '
            '<strong style="color:#0f172a;">Lecture</strong> : explication donnée par une source nommée. '
            '<strong style="color:#0f172a;">Hypothèse</strong> : ce qui pourrait suivre, sans certitude.</p>')


def _lecture_valeur(matiere: str, var: float | None) -> str:
    if var is None:
        return "Cours de la matière non disponible cette semaine."
    if matiere == "sucre":
        return "Effet limité : le prix de vente domestique est encadré."
    if abs(var) < 1:
        return "Neutre : variation inférieure à 1 %."
    if matiere == "petrole":
        return ("Effet ambigu : stocks dévalorisés, besoin de trésorerie allégé." if var < 0
                else "Effet ambigu : stocks revalorisés, besoin de trésorerie accru.")
    return "Prix de vente orienté à la hausse." if var > 0 else "Prix de vente orienté à la baisse."


def build_valeurs_exposees(prices: list, wb_snapshot: dict) -> str:
    """Valeurs exposées : canal de transmission et lecture, sans score ni verdict."""
    pm = {p.ticker: p for p in prices}
    var: dict[str, tuple[float | None, str]] = {
        "petrole": (pm["BZ=F"].weekly_change_pct, "Brent, semaine") if "BZ=F" in pm else (None, ""),
        "sucre": (pm["SB=F"].weekly_change_pct, "sucre brut, semaine") if "SB=F" in pm else (None, ""),
    }
    for cle, d in (wb_snapshot or {}).items():
        m = _q.MATIERE_PAR_WB.get(cle)
        if m in ("huile_palme", "caoutchouc") and d.get("variation_mensuelle_pct") is not None:
            var[m] = (d["variation_mensuelle_pct"], "Banque mondiale, mois")
    rows = ""
    for matiere, lst in _q.EXPOSITIONS.items():
        v, base = var.get(matiere, (None, ""))
        for e in lst:
            if e["code"] not in REFERENTIEL:
                continue
            mouvement = f"{_q.pct(v)} ({base})" if v is not None else "n/d"
            rows += (f'<tr><td {_TD}><strong style="color:#0f172a;">{_q.NOMS[e["code"]]}</strong> '
                     f'<span style="font-family:monospace;font-size:11px;color:#64748b;">{e["code"]}</span></td>'
                     f'<td {_TD}>{_q.LIBELLE_MATIERE[matiere]}</td><td {_TD}>{mouvement}</td>'
                     f'<td {_TD}>{_html.escape(e["canal"])}</td>'
                     f'<td {_TD}>{_html.escape(_lecture_valeur(matiere, v))}</td></tr>')
    return (f'<div style="margin-bottom:28px;"><h2 {_H2}>Valeurs BRVM exposées</h2>'
            f'<p style="font-size:13px;color:#64748b;margin-bottom:12px;">Le tableau décrit un canal de '
            f'transmission. Il ne note pas les titres et ne dit pas dans quel sens ils évolueront.</p>'
            f'<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">'
            f'<thead><tr style="background:#0f172a;"><th {_TH}>Valeur</th><th {_TH}>Matière</th>'
            f'<th {_TH}>Mouvement</th><th {_TH}>Canal</th><th {_TH}>Lecture</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div></div>')


def build_fcfa(fcfa: list[dict], eurusd: dict | None) -> str:
    if not fcfa or not eurusd:
        return ""
    rows = "".join(
        f'<tr><td {_TD}><strong style="color:#0f172a;">{l["label"]}</strong></td>'
        f'<td {_TD}>{_q.fr(l["prix_fcfa"], 0 if l["prix_fcfa"] >= 100 else 2)} {l["unite"]}</td>'
        f'<td {_TD}>{_q.pct(l["var_usd"])}</td><td {_TD}>{_q.pct(l["var_fcfa"])}</td></tr>' for l in fcfa)
    taux = _q.usd_xof(eurusd["actuel"])
    return (f'<div style="margin-bottom:28px;"><h2 {_H2}>Les mêmes prix en francs CFA</h2>'
            f'<p style="font-size:13px;color:#64748b;margin-bottom:12px;">1 dollar = {_q.fr(taux, 1)} FCFA '
            f'(parité fixe de 655,957 FCFA pour 1 euro, euro à {_q.fr(eurusd["actuel"], 4)} dollar). '
            f'La variation en FCFA ajoute l\'effet du change à celle du cours.</p>'
            f'<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">'
            f'<thead><tr style="background:#0f172a;"><th {_TH}>Matière</th><th {_TH}>Prix</th>'
            f'<th {_TH}>Variation en dollars</th><th {_TH}>Variation en FCFA</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div></div>')


def build_scenarios(scenarios: list[dict], prices: list) -> str:
    brent = next((p for p in prices if p.ticker == "BZ=F"), None)
    if not scenarios or not brent:
        return ""
    rows = "".join(
        f'<tr><td {_TD}><strong style="color:#0f172a;">Brent à {_q.fr(s["niveau_usd"], 0)} USD</strong></td>'
        f'<td {_TD}>{_q.pct(s["ecart_pct"], 1)}</td><td {_TD}>{_q.fr(s["fcfa_baril"], 0)} FCFA</td>'
        f'<td {_TD}>{_q.fr(s["fcfa_litre"], 1)} FCFA</td></tr>' for s in scenarios)
    return (f'<div style="margin-bottom:28px;"><h2 {_H2}>Scénarios : et si le Brent bougeait de 10 % ?</h2>'
            f'<p style="font-size:13px;color:#64748b;margin-bottom:12px;">Calcul à change constant, depuis la '
            f'clôture de {_q.fr(brent.current)} USD. Ce ne sont pas des prévisions.</p>'
            f'<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">'
            f'<thead><tr style="background:#0f172a;"><th {_TH}>Scénario</th><th {_TH}>Écart</th>'
            f'<th {_TH}>Prix du baril</th><th {_TH}>Prix du litre de brut</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div>'
            f'<p style="font-size:12px;color:#64748b;margin:8px 0 0 0;">Le litre de brut n\'est pas le prix à la '
            f'pompe, fixé par les États. L\'effet sur le résultat des distributeurs cotés n\'est pas chiffré : '
            f'leurs niveaux de stock ne sont pas publiés.</p></div>')


def build_methode(prices: list, controles: dict) -> str:
    repli = controles.get("texte") == "squelette"
    return (f'<div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:24px;">'
            f'<p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#0f172a;">Méthode et limites</p>'
            f'<ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;">'
            f'<li>Variations de clôture à clôture sur la fenêtre de cotation de la semaine, contrat à terme le plus proche.</li>'
            f'<li>Chaque chiffre du texte est comparé aux données avant publication ; un chiffre absent des données fait refuser le texte.</li>'
            f'<li>Les explications reprennent des titres de presse datés et nommés ; elles ne sont pas des certitudes.</li>'
            f'<li>Huile de palme et caoutchouc : cours mensuels de la Banque mondiale, sans cotation hebdomadaire.</li>'
            + ('<li>Cette semaine, l\'analyse rédigée n\'a pas passé les contrôles : seuls les faits calculés sont publiés.</li>' if repli else '')
            + '</ul></div>')


_LIB_COURT = {"CL=F": "WTI", "BZ=F": "Brent"}


def build_svg_barchart(prices: list) -> str:
    """Graphique barres SVG inline — variation % hebdomadaire. Zero dépendance JS."""
    W, H = 740, 220
    PL, PR, PT, PB = 44, 16, 24, 44
    chart_w = W - PL - PR
    chart_h = H - PT - PB
    n = max(len(prices), 1)
    slot = chart_w // n
    bw = min(52, slot - 10)
    max_abs = max(abs(p.weekly_change_pct) for p in prices) or 1
    zero_y = PT + chart_h // 2

    grid = ""
    for pct_ref, label in [
        (max_abs, f"+{max_abs:.0f}%"), (max_abs / 2, f"+{max_abs/2:.0f}%"),
        (0, "0%"), (-max_abs / 2, f"-{max_abs/2:.0f}%"), (-max_abs, f"-{max_abs:.0f}%"),
    ]:
        gy = zero_y - int(pct_ref / max_abs * chart_h / 2)
        grid += (f'<line x1="{PL}" y1="{gy}" x2="{W - PR}" y2="{gy}" '
                 f'stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,3"/>'
                 f'<text x="{PL - 4}" y="{gy + 4}" text-anchor="end" '
                 f'font-size="9" fill="#94a3b8" font-family="system-ui">{label}</text>')

    bars = ""
    for i, p in enumerate(prices):
        pct = round(p.weekly_change_pct, 1)
        color = "#10b981" if pct >= 0 else "#ef4444"
        cx = PL + i * slot + slot // 2
        bx = cx - bw // 2
        bar_h = max(2, int(abs(pct) / max_abs * chart_h / 2))
        by = zero_y - bar_h if pct >= 0 else zero_y
        sign = "+" if pct >= 0 else ""
        vy = by - 5 if pct >= 0 else by + bar_h + 12
        bars += (
            f'<rect x="{bx}" y="{by}" width="{bw}" height="{bar_h}" fill="{color}" rx="3" opacity="0.88"/>'
            f'<text x="{cx}" y="{vy}" text-anchor="middle" font-size="10" '
            f'fill="{color}" font-weight="700" font-family="system-ui">{_q.pct(pct, 1)}</text>'
            f'<text x="{cx}" y="{H - PB + 14}" text-anchor="middle" '
            f'font-size="10" fill="#64748b" font-family="system-ui">{_LIB_COURT.get(p.ticker, p.label[:7])}</text>'
        )
    zero_line = (f'<line x1="{PL}" y1="{zero_y}" x2="{W - PR}" y2="{zero_y}" '
                 f'stroke="#94a3b8" stroke-width="1.5"/>')
    return (
        f'<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;">'
        f'<p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px 0;">Variations hebdomadaires des matières premières (%)</p>'
        f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">'
        f'{grid}{zero_line}{bars}</svg></div>'
    )


def build_price_table(prices: list) -> str:
    """Table des prix avec styles 100% inline."""
    rows = ""
    for p in prices:
        color = "#10b981" if p.weekly_change_pct >= 0 else "#ef4444"
        sign = "+" if p.weekly_change_pct >= 0 else ""
        arrow = "▲" if p.weekly_change_pct >= 0 else "▼"
        sig_bg = "#f0fdf4" if p.signal == "HAUSSE" else "#fef2f2" if p.signal == "BAISSE" else "#fefce8"
        sig_col = "#059669" if p.signal == "HAUSSE" else "#dc2626" if p.signal == "BAISSE" else "#d97706"
        rows += (
            f'<tr>'
            f'<td style="padding:10px 12px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">{p.label}</td>'
            f'<td style="padding:10px 12px;font-family:monospace;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;">{p.ticker}</td>'
            f'<td style="padding:10px 12px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">{_q.fr(p.current, _q.dec_prix(p.current))} <span style="font-size:11px;font-weight:400;color:#94a3b8;">{p.unit}</span></td>'
            f'<td style="padding:10px 12px;color:#475569;border-bottom:1px solid #f1f5f9;">{_q.fr(p.week_low, _q.dec_prix(p.week_low))} – {_q.fr(p.week_high, _q.dec_prix(p.week_high))}</td>'
            f'<td style="padding:10px 12px;font-weight:700;color:{color};border-bottom:1px solid #f1f5f9;">{arrow} {_q.pct(p.weekly_change_pct)}</td>'
            f'<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">'
            f'<span style="background:{sig_bg};color:{sig_col};padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700;">{p.signal}</span>'
            f'</td></tr>'
        )
    th = 'style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;"'
    return (
        f'<div style="overflow-x:auto;margin-bottom:28px;">'
        f'<table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
        f'<thead><tr style="background:#0f172a;">'
        f'<th {th}>Matière</th><th {th}>Ticker</th><th {th}>Cours</th>'
        f'<th {th}>Range 5j</th><th {th}>Var. hebdo</th><th {th}>Signal</th>'
        f'</tr></thead><tbody>{rows}</tbody></table></div>'
    )


def build_hero_section(prices: list, week: int, year: int) -> str:
    """Section hero pleine largeur avec photo de la matière la plus mouvementée."""
    if not prices:
        return ""
    top = max(prices, key=lambda p: abs(p.weekly_change_pct))
    photo_id = COMMODITY_PHOTOS.get(top.ticker, HERO_FALLBACK_PHOTO)
    photo_url = _photo_url(photo_id, 1200, 500)
    color = "#10b981" if top.weekly_change_pct >= 0 else "#ef4444"
    sign = "+" if top.weekly_change_pct >= 0 else ""
    arrow = "▲" if top.weekly_change_pct >= 0 else "▼"
    return (
        f'<div style="position:relative;width:100%;height:320px;overflow:hidden;border-radius:12px;margin-bottom:28px;">'
        f'<img src="{photo_url}" alt="{top.label}" loading="eager" '
        f'style="width:100%;height:100%;object-fit:cover;display:block;"/>'
        f'<div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.72) 100%);"></div>'
        f'<div style="position:absolute;bottom:0;left:0;right:0;padding:24px 28px;">'
        f'<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);'
        f'text-transform:uppercase;letter-spacing:.1em;">Matières premières BRVM — Semaine {week:02d}/{year}</p>'
        f'<h2 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#fff;line-height:1.2;">'
        f'{top.label} : {_q.fr(top.current, _q.dec_prix(top.current))} {top.unit}</h2>'
        f'<p style="margin:0;font-size:17px;font-weight:700;color:{color};">'
        f'{arrow} {_q.pct(top.weekly_change_pct)} sur la semaine</p>'
        f'</div>'
        f'<div style="position:absolute;top:16px;right:16px;background:rgba(0,0,0,0.45);'
        f'backdrop-filter:blur(8px);padding:6px 14px;border-radius:20px;">'
        f'<span style="font-size:11px;color:rgba(255,255,255,0.85);font-weight:600;">'
        f'© Photo : <a href="https://unsplash.com" target="_blank" '
        f'style="color:rgba(255,255,255,0.7);text-decoration:none;">Unsplash</a></span>'
        f'</div></div>'
    )


def build_commodity_cards(prices: list) -> str:
    """Grille de cartes visuelles par matière (photo + données) — remplace la table prix."""
    cards = ""
    for p in prices:
        photo_id = COMMODITY_PHOTOS.get(p.ticker)
        photo_html = ""
        if photo_id:
            url = _photo_url(photo_id, 500, 220)
            photo_html = (
                f'<div style="width:100%;height:160px;overflow:hidden;border-radius:8px 8px 0 0;">'
                f'<img src="{url}" alt="{p.label}" loading="lazy" '
                f'style="width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s;"/>'
                f'</div>'
            )
        color = "#10b981" if p.weekly_change_pct >= 0 else "#ef4444"
        sign = "+" if p.weekly_change_pct >= 0 else ""
        arrow = "▲" if p.weekly_change_pct >= 0 else "▼"
        sig = p.signal
        sig_bg  = "#f0fdf4" if sig == "HAUSSE" else "#fef2f2" if sig == "BAISSE" else "#fefce8"
        sig_col = "#059669" if sig == "HAUSSE" else "#dc2626" if sig == "BAISSE" else "#d97706"
        sig_icon = "▲" if sig == "HAUSSE" else "▼" if sig == "BAISSE" else "■"
        cards += (
            f'<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;'
            f'overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">'
            + photo_html +
            f'<div style="padding:14px 16px;">'
            f'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
            f'<span style="font-size:15px;font-weight:700;color:#0f172a;">{p.label}</span>'
            f'<code style="font-size:10px;background:#f1f5f9;padding:2px 7px;border-radius:4px;color:#475569;">{p.ticker}</code>'
            f'</div>'
            f'<p style="margin:0 0 6px;font-size:20px;font-weight:800;color:#0f172a;">'
            f'{_q.fr(p.current, _q.dec_prix(p.current))} <span style="font-size:12px;font-weight:400;color:#94a3b8;">{p.unit}</span></p>'
            f'<p style="margin:0 0 10px;font-size:15px;font-weight:700;color:{color};">'
            f'{arrow} {_q.pct(p.weekly_change_pct)}</p>'
            f'<div style="display:flex;align-items:center;justify-content:space-between;">'
            f'<span style="font-size:11px;color:#94a3b8;">Fourchette de la semaine : {_q.fr(p.week_low, _q.dec_prix(p.week_low))} – {_q.fr(p.week_high, _q.dec_prix(p.week_high))}</span>'
            f'<span style="background:{sig_bg};color:{sig_col};padding:3px 10px;border-radius:12px;'
            f'font-size:11px;font-weight:700;">{sig_icon} {sig}</span>'
            f'</div>'
            f'</div></div>'
        )
    return (
        f'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:28px;">'
        + cards +
        f'</div>'
    )


def build_correlation_table(correlations: list[dict]) -> str:
    """Table corrélations BRVM ↔ Matières premières (données réelles Supabase)."""
    if not correlations:
        return ""
    rows = ""
    for c in correlations:
        coeff = c.get("coefficient")
        if not c["available"] or coeff is None:
            badge = '<span style="font-size:11px;color:#94a3b8;">n/d</span>'
            interp_cell = '<span style="font-size:12px;color:#94a3b8;">Historique insuffisant</span>'
        else:
            abs_c = abs(coeff)
            if abs_c > 0.7:
                b_bg, b_col = ("#f0fdf4", "#059669") if coeff > 0 else ("#fef2f2", "#dc2626")
                strength = "Forte"
            elif abs_c > 0.4:
                b_bg, b_col = "#fefce8", "#d97706"
                strength = "Modérée"
            else:
                b_bg, b_col = "#f8fafc", "#64748b"
                strength = "Faible"
            sign = "+" if coeff >= 0 else ""
            badge = (
                f'<span style="background:{b_bg};color:{b_col};padding:2px 9px;'
                f'border-radius:12px;font-size:11px;font-weight:700;">'
                f'{_q.fr(coeff, 2) if coeff < 0 else '+' + _q.fr(coeff, 2)} — {strength}</span>'
            )
            interp_cell = (
                f'<span style="font-size:12px;color:#475569;">'
                f'{"Mouvement synchrone" if abs_c > 0.7 else "Corrélation partielle" if abs_c > 0.4 else "Peu corrélé"}'
                f' · corr. {c["direction"]}</span>'
            )
        rows += (
            f'<tr>'
            f'<td style="padding:10px 12px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">'
            f'<span style="display:inline-block;width:10px;height:10px;border-radius:50%;'
            f'background:{c["couleur"]};margin-right:7px;vertical-align:middle;"></span>'
            f'{c["matiere"]}</td>'
            f'<td style="padding:10px 12px;font-family:monospace;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;">{", ".join(c["codes"])}</td>'
            f'<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">{badge}</td>'
            f'<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">{interp_cell}</td>'
            f'<td style="padding:10px 12px;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;">'
            f'{c["n_months"]} mois</td>'
            f'</tr>'
        )
    th = 'style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;"'
    return (
        f'<div style="margin-bottom:28px;">'
        f'<h2 style="font-size:18px;font-weight:700;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:6px;">Corrélations BRVM ↔ Matières premières</h2>'
        f'<p style="font-size:12px;color:#64748b;margin-bottom:14px;">Corrélation de Pearson sur les variations mensuelles · Prix matières : World Bank Pink Sheet · Actions : cours moyen mensuel BRVM</p>'
        f'<div style="overflow-x:auto;">'
        f'<table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
        f'<thead><tr style="background:#0f172a;">'
        f'<th {th}>Filière</th><th {th}>Actions BRVM</th>'
        f'<th {th}>Corrélation</th><th {th}>Interprétation</th><th {th}>Période</th>'
        f'</tr></thead><tbody>{rows}</tbody></table></div></div>'
    )


# ── 5bis. Assainissement (HTML servi en même origine) ─────────────────────────
# Le HTML est publié tel quel sous /weekly/<slug>.html : tout titre/URL issu de
# Perplexity et tout HTML produit par le LLM doivent être neutralisés avant
# insertion (XSS stocké sinon, exécuté sur l'origine du site).

def _url_sure(url) -> str:
    """URL http(s) uniquement, sinon chaîne vide (jamais javascript:/data:)."""
    if not isinstance(url, str):
        return ""
    u = url.strip()
    if urlparse(u).scheme.lower() not in ("http", "https"):
        return ""
    return _html.escape(u, quote=True)


_TAGS_EDITORIAL = {
    "section", "div", "p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em",
    "b", "i", "br", "span", "table", "thead", "tbody", "tr", "th", "td", "a",
    "blockquote", "hr", "code", "small", "sup", "sub",
}
_STYLE_SUR = re.compile(r"^[\w\s:;#%.,()'\-!/]*$")


class _AssainisseurHtml(HTMLParser):
    """Reconstruit le HTML en ne gardant qu'une liste blanche de balises ;
    attributs : href (http/https) sur <a>, style restreint, rien d'autre."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self._ignore = 0  # contenu de <script>/<style> supprimé

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "iframe", "object", "embed"):
            self._ignore += 1
            return
        if tag not in _TAGS_EDITORIAL or self._ignore:
            return
        parts = []
        for k, v in attrs:
            v = v or ""
            if k == "href" and tag == "a":
                u = _url_sure(v)
                if u:
                    parts.append(f' href="{u}" target="_blank" rel="noopener noreferrer"')
            elif k == "style":
                low = v.lower()
                if _STYLE_SUR.match(v) and not any(x in low for x in ("url(", "expression", "javascript", "@import", "behavior")):
                    parts.append(f' style="{_html.escape(v, quote=True)}"')
        self.out.append(f"<{tag}{''.join(parts)}>")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "iframe", "object", "embed"):
            self._ignore = max(0, self._ignore - 1)
            return
        if tag in _TAGS_EDITORIAL and tag not in ("br", "hr") and not self._ignore:
            self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if not self._ignore:
            self.out.append(_html.escape(data))


def assainir_editorial(texte: str) -> str:
    p = _AssainisseurHtml()
    p.feed(texte or "")
    p.close()
    return "".join(p.out)



def build_footer(year: int) -> str:
    return (
        f'<footer style="border-top:1px solid #e2e8f0;padding-top:14px;margin-top:8px;">'
        f'<p style="font-size:11px;color:#94a3b8;margin:0 0 4px 0;">'
        f'<strong style="color:#64748b;">Avertissement légal :</strong> Ce document est produit à titre informatif '
        f'uniquement par WestBourse. Il ne constitue pas un conseil en investissement ni une sollicitation '
        f'à acheter ou vendre des instruments financiers. Les performances passées ne préjugent pas des '
        f'performances futures. Sources : Yahoo Finance (contrats à terme COMEX, NYMEX, ICE), Banque mondiale (Pink Sheet), BRVM.'
        f'</p>'
        f'<p style="font-size:11px;color:#94a3b8;margin:0;">© {year} WestBourse — Plateforme d\'analyse de la BRVM. Tous droits réservés.</p>'
        f'</footer>'
    )


def build_sources_perplexity(items: list[dict]) -> str:
    """Bloc « Sources consultées » : rendu Python déterministe, jamais fondu
    dans le texte DeepSeek (design §5 — contexte d'entrée uniquement, les
    citations restent affichées séparément et vérifiables individuellement)."""
    if not items:
        return ""
    rows = "".join(
        f'<li style="margin-bottom:6px;font-size:12px;color:#475569;">'
        f'<a href="{_url_sure(it.get("url",""))}" style="color:#56D7FD;text-decoration:none;" '
        f'target="_blank" rel="noopener noreferrer">{_html.escape(str(it.get("titre","")))}</a>'
        f' <span style="color:#94a3b8;">— {_html.escape(str(it.get("date","")))}</span></li>'
        for it in items
    )
    return (
        '<div style="border-top:1px solid #e2e8f0;padding-top:14px;margin-top:20px;">'
        '<p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;'
        'letter-spacing:.08em;margin:0 0 10px 0;">Contexte macro — sources consultées</p>'
        f'<ul style="margin:0;padding-left:18px;">{rows}</ul>'
        '</div>'
    )


def assemble_content_html(editorial_html: str, prices: list, ctx: dict) -> str:
    """
    Assemble l'article en trois niveaux de lecture (Essentiel, Investisseur, Pro).
    L'ordre des blocs dépend de l'édition, pour que deux numéros ne se ressemblent pas.
    """
    edition = ctx.get("edition", "note")
    text = _q.nettoyer(assainir_editorial(editorial_html)).strip()
    if not text.startswith("<section"):
        text = (f'<section style="font-family:\'Segoe UI\',system-ui,sans-serif;'
                f'color:#1e293b;line-height:1.8;">{text}</section>')
    analyse = ('<h2 ' + _H2 + '>Analyse par matière</h2>' + build_legende_preuve() + text)
    graphique = build_svg_barchart(prices) + "\n" + build_commodity_cards(prices)
    valeurs = build_valeurs_exposees(prices, ctx.get("wb_snapshot") or {})
    fcfa = build_fcfa(ctx.get("fcfa") or [], ctx.get("eurusd"))
    scenarios = build_scenarios(ctx.get("scenarios") or [], prices)
    seuils = build_seuils(ctx.get("seuils") or [])
    corps = {
        "note": [graphique, analyse, valeurs, fcfa, scenarios, seuils],
        "briefing": [graphique, fcfa, valeurs, analyse, seuils, scenarios],
        "dossier": [analyse, graphique, valeurs, scenarios, fcfa, seuils],
    }[edition]
    return (
        '<article style="font-family:\'Segoe UI\',system-ui,sans-serif;'
        'max-width:900px;margin:0 auto;color:#1e293b;line-height:1.8;">\n'
        + build_hero_section(prices, ctx["week"], ctx["year"]) + "\n"
        + build_essentiel(prices, ctx.get("fcfa") or [], edition) + "\n"
        + build_bilan(ctx.get("bilan") or []) + "\n"
        + build_badge("investisseur") + "\n"
        + "\n".join(b for b in corps if b) + "\n"
        + build_badge("pro") + "\n"
        + build_methode(prices, ctx.get("controles") or {}) + "\n"
        + build_correlation_table(ctx.get("correlations") or []) + "\n"
        + build_sources_perplexity(ctx.get("perplexity_items") or []) + "\n"
        + build_footer(ctx["year"]) + "\n"
        + "</article>"
    )


def rediger_editorial(prompt_pour, prices: list, autorises: set[float], appel=None) -> tuple[str, dict]:
    """
    Deux essais au plus, chacun passé aux verrous. Le second reçoit les raisons
    du refus. Si les deux échouent, on publie le squelette calculé : aucun
    chemin ne publie un texte de LLM non vérifié.
    """
    appel = appel or call_llm
    refus: list[str] = []
    for essai in (1, 2):
        try:
            texte = _q.nettoyer(assainir_editorial(appel(prompt_pour(refus)))).strip()
        except Exception as e:
            refus = [f"appel LLM en échec : {str(e)[:160]}"]
            break
        refus = _q.verrous(texte, prices, REFERENTIEL, autorises)
        if not refus:
            return texte, {"texte": "llm", "essais": essai, "refus": []}
        log.warning("Texte refusé (essai %d) : %s", essai, " ; ".join(refus))
    return _q.squelette_editorial(prices, REFERENTIEL), {"texte": "squelette", "essais": 2, "refus": refus}


# ── 6. Appel LLM ────────────────────────────────────────────────────────────

# Même cascade et mêmes modèles que `frontend/lib/server/llmModels.ts` (deux
# paquets distincts : à corriger des deux côtés). Ajoutée le 2026-10-31 : ce
# script n'avait AUCUN repli et s'arrêtait sur le 402 « Insufficient Balance »
# de DeepSeek pendant que le reste du produit basculait sur Gemini puis Grok.
CASCADE_LLM = (
    ("deepseek", "https://api.deepseek.com", "deepseek-chat", {}),
    # Gemini (compatible OpenAI) : sans `reasoning_effort` bas, la réflexion
    # consomme le budget de jetons et la réponse revient vide ou tronquée.
    ("gemini", "https://generativelanguage.googleapis.com/v1beta/openai/", "gemini-3.8-flash", {"reasoning_effort": "low"}),
    ("xai", "https://api.x.ai/v1", "grok-4.6", {}),
)


def call_llm(prompt: str) -> str:
    from openai import OpenAI

    echecs: list[str] = []
    for fournisseur, base_url, modele, extra in CASCADE_LLM:
        cle = DEEPSEEK_KEY if fournisseur == "deepseek" else _resoudre_cle_llm(fournisseur)
        cle = cle.encode("ascii", "ignore").decode("ascii")
        if not cle:
            echecs.append(f"{fournisseur}: clé absente")
            continue
        try:
            client = OpenAI(api_key=cle, base_url=base_url)
            resp = client.chat.completions.create(
                model=modele,
                max_tokens=7000,
                messages=[{"role": "user", "content": prompt}],
                **extra,
            )
            texte = (resp.choices[0].message.content or "").strip()
            if not texte:
                echecs.append(f"{fournisseur}: réponse vide")
                continue
            if echecs:
                log.warning("LLM : repli sur %s après %s", fournisseur, " ; ".join(echecs))
            return texte
        except Exception as e:
            # Le message de l'API ne contient pas la clé ; on n'en garde que le début.
            echecs.append(f"{fournisseur}: {str(e)[:160]}")
    raise RuntimeError("Tous les fournisseurs LLM ont échoué — " + " ; ".join(echecs))


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
    yf_prices: dict | None = None,
    wb_snapshot: dict | None = None,
    dry_run: bool = False,
    extra: dict | None = None,
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
        "source": "autre",
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
        "metadata": {
            "type": "commodity_weekly",
            "year": year,
            "week": week,
            "tickers_count": len(ticker_codes),
            "yf_prices": yf_prices or {},
            "wb_snapshot": wb_snapshot or {},
            "brvm_scores": brvm_scores,
            **(extra or {}),
        },
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
    log.info("4/7 Calcul scores exposition BRVM...")
    brvm_scores = compute_brvm_scores(yf_prices, wb_snapshot)
    log.info("    → %d tickers scorés", len(brvm_scores))

    # Étape 4b : Corrélations BRVM ↔ Matières premières
    log.info("4b/7 Calcul corrélations BRVM ↔ matières premières...")
    correlations = fetch_brvm_correlations()
    log.info("    → %d filières analysées (%d disponibles)",
             len(correlations), sum(1 for c in correlations if c["available"]))

    # Étape 4c : Contexte macro Perplexity
    log.info("4c/7 Contexte macro récent (Perplexity)...")
    noms_commodites = [v["nom"] for v in YFINANCE_TICKERS.values()]
    perplexity_items = fetch_perplexity_context(noms_commodites)
    log.info("    → %d item(s) de contexte retenus", len(perplexity_items))

    # Garde-fou : sous quatre contrats exploitables, la collecte a échoué.
    # Mieux vaut une semaine sans hebdo qu'un article sur des données partielles.
    prices = build_prices_list(yf_prices)
    if len(prices) < 4:
        log.error("Seulement %d contrat(s) exploitable(s) : rien n'est publié.", len(prices))
        return 1

    # Étape 4d : blocs calculés (FCFA, scénarios, seuils, bilan de la semaine passée)
    eurusd = fetch_eurusd()
    fcfa = _q.conversions_fcfa(prices, eurusd)
    scenarios = _q.scenarios_brent(prices, eurusd)
    seuils = _q.seuils_a_surveiller(prices)
    precedent = fetch_semaine_precedente(year, week)
    bilan = _q.bilan_semaine_precedente(_q.seuils_depuis_metadata(precedent), prices)
    edition = _q.choisir_edition(prices)
    log.info("    → édition « %s », %d ligne(s) FCFA, %d seuil(s), bilan : %d",
             edition, len(fcfa), len(seuils), len(bilan))

    # Étape 5 : rédaction sous verrous
    log.info("5/7 Rédaction de l'analyse (LLM sous contrôle)...")
    wb_summary = build_wb_summary(wb_snapshot)
    titres = [str(a.get("titre", "")) for a in articles[:6]] + [str(i.get("titre", "")) for i in perplexity_items[:8]]
    autorises = _q.nombres_autorises(prices, correlations=correlations, fcfa=fcfa, scenarios=scenarios,
                                     titres=titres, week=week, year=year)

    def prompt_pour(refus: list[str]) -> str:
        return build_editorial_prompt(prices, wb_summary, articles, correlations,
                                      perplexity_items=perplexity_items, week=week, year=year,
                                      edition=edition, fcfa=fcfa, refus=refus)

    if args.dry_run:
        log.info("[DRY-RUN] Appel LLM ignoré : squelette calculé")
        editorial_html, controles = _q.squelette_editorial(prices, REFERENTIEL), {"texte": "squelette", "essais": 0, "refus": []}
    else:
        editorial_html, controles = rediger_editorial(prompt_pour, prices, autorises)
    log.info("    → texte : %s", controles["texte"])

    ctx = {"edition": edition, "fcfa": fcfa, "eurusd": eurusd, "scenarios": scenarios, "seuils": seuils,
           "bilan": bilan, "wb_snapshot": wb_snapshot, "correlations": correlations,
           "perplexity_items": perplexity_items, "controles": controles, "year": year, "week": week}
    article_html = assemble_content_html(editorial_html, prices, ctx)

    # Étape 6 : HTML final
    title = _q.titre_article(prices, week, year)
    description = (
        f"Analyse hebdomadaire des matières premières et de leur transmission aux valeurs BRVM. "
        f"Semaine {week:02d}, {year}."
    )
    full_html = build_full_html(article_html, title, description)

    # Étape 7 : Sauvegarde fichier
    log.info("6/7 Sauvegarde + publication...")
    save_html(full_html, slug, dry_run=args.dry_run)

    # Étape 8 : Upsert Supabase
    ok = publish_supabase(
        slug=slug,
        titre=title,
        article_html=article_html,
        year=year,
        week=week,
        brvm_scores=brvm_scores,
        yf_prices=yf_prices,
        wb_snapshot=wb_snapshot,
        dry_run=args.dry_run,
        extra={"edition": edition, "seuils": seuils, "eurusd": eurusd, "controles": controles},
    )

    log.info("=== Terminé. Supabase: %s | Slug: %s ===", "OK" if ok else "ERREUR", slug)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
