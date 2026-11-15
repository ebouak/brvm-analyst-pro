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
import commodity_weekly_rendu as _r

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


def fetch_prix_mensuels() -> dict[str, tuple[float | None, str]]:
    """
    Dernière variation mensuelle de l'huile de palme et du caoutchouc, lue dans
    `commodity_prices` (alimentée par le scraper depuis la Pink Sheet). La
    lecture directe du classeur (fetch_world_bank_snapshot) ne trouvait pas ces
    lignes : le tableau publié affichait « n/d » pour Palm CI, SAPH et SOGB.
    """
    vide = {"huile_palme": (None, ""), "caoutchouc": (None, "")}
    if not SUPABASE_URL or not SERVICE_KEY:
        return vide
    import requests
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/commodity_prices?commodity=in.(palm_oil,rubber)"
            f"&select=commodity,date,price&order=date.desc&limit=12",
            headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}, timeout=15)
        resp.raise_for_status()
        rows = resp.json()
    except Exception as e:
        log.warning("Cours mensuels illisibles : %s", e)
        return vide
    out = dict(vide)
    for cle, matiere in (("palm_oil", "huile_palme"), ("rubber", "caoutchouc")):
        serie = [r for r in rows if r.get("commodity") == cle and r.get("price")]
        if len(serie) >= 2 and float(serie[1]["price"]) > 0:
            v = (float(serie[0]["price"]) / float(serie[1]["price"]) - 1) * 100
            mois = str(serie[0]["date"])[:7]
            out[matiere] = (round(v, 2), f"mois de {mois}, Banque mondiale")
    return out


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
        f"&select=titre,resume,source_label,source_url,date_publication,ticker_codes,secteur"
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
    items = [{"titre": a.get("titre", ""), "source_label": a.get("source_label", "")} for a in (articles or [])]
    items += [{"titre": it.get("titre", ""), "source_label": it.get("date", "")} for it in (perplexity_items or [])]
    par_matiere = _q.titres_par_matiere(items, prices)
    presse_ctx = "\n".join(
        f"  {p.label} :\n" + ("\n".join(f"    {t}" for t in par_matiere.get(p.label, [])) or "    (aucun titre)")
        for p in prices)

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

TITRES DE PRESSE DE LA SEMAINE, PAR MATIÈRE (seule source d'explications autorisée) :
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
7b. Nomme les matières en minuscules, comme la presse : le Brent, le WTI, l'or, l'argent, le cacao, le café, le sucre, le coton.
7c. Après un verbe de sens (recule, cède, perd, gagne, progresse), écris la variation SANS signe : « l'or recule de 4,63 % ».
7. {consigne_edition}

CHAQUE BLOC a exactement quatre paragraphes, dans cet ordre, chacun ouvert par son étiquette en <strong> :
- « Fait vérifié. » Le mouvement chiffré, tiré de DONNÉES. Dis si la clôture est près du plus bas ou du plus haut quand c'est le cas.
- « Lecture. » L'explication donnée par les TITRES DE PRESSE, en nommant la source entre crochets. Si aucun titre ne porte sur cette matière, écris seulement : « Aucune cause identifiée dans nos sources. » N'en invente pas. Cette phrase ne peut apparaître que deux fois : regroupe en un seul bloc les matières sans explication.
- « Hypothèse. » Ce qui pourrait suivre, au conditionnel, rattaché à un seuil de DONNÉES (plus bas ou plus haut de la semaine).
- « Transmission à la BRVM. » Le canal vers les valeurs exposées, ou l'absence de société cotée exposée.

FORMAT : HTML sans aucun attribut (ni style, ni classe). Commence par <section> et termine par </section>. Un bloc =

<div>
  <h4>[Énergie | Métaux précieux | Agriculture]</h4>
  <h3>[Titre factuel de 12 mots au plus, qui nomme la ou les matières du bloc]</h3>
  <p><strong>Fait vérifié.</strong> …</p>
  <p><strong>Lecture.</strong> …</p>
  <p><strong>Hypothèse.</strong> …</p>
  <p><strong>Transmission à la BRVM.</strong> …</p>
</div>

Chaque matière de DONNÉES doit être nommée par son libellé exact dans au moins un bloc. 700 mots au plus au total."""


# ── 5a. Blocs calculés (aucun texte de LLM) ──────────────────────────────────


# ── 5bis. Assainissement (HTML servi en même origine) ─────────────────────────
# Le HTML est publié tel quel sous /weekly/<slug>.html : tout titre/URL issu de
# Perplexity et tout HTML produit par le LLM doivent être neutralisés avant
# insertion (XSS stocké sinon, exécuté sur l'origine du site).


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
                u = _r.url_sure(v)
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
            # quote=False : une apostrophe reste une apostrophe, que nettoyer() sait lire.
            self.out.append(_html.escape(data, quote=False))


def assainir_editorial(texte: str) -> str:
    p = _AssainisseurHtml()
    p.feed(texte or "")
    p.close()
    return "".join(p.out)


def assemble_content_html(editorial_html: str, prices: list, ctx: dict) -> str:
    """Corps de l'article, grammaire du dossier A4 (voir commodity_weekly_rendu.py)."""
    text = _q.nettoyer(assainir_editorial(editorial_html)).strip()
    if not text.startswith("<section"):
        text = f"<section>{text}</section>"
    return _r.assembler(text, prices, ctx)


CSS_FEUILLE = Path(__file__).resolve().parent / "frontend" / "app" / "weekly" / "[slug]" / "weekly.css"


def build_full_html(article_html: str, title: str, description: str, signature: str = "") -> str:
    css = CSS_FEUILLE.read_text(encoding="utf-8") if CSS_FEUILLE.exists() else ""
    return _r.page_autonome(article_html, title, description, signature, css)


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
    resume: str | None = None,
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
        "resume": resume or f"Analyse hebdomadaire des matières premières et leur impact sur la BRVM — S{week:02d} {year}",
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
    # TOUS les titres : le rédacteur reçoit la presse rangée par matière, puisée dans
    # l'ensemble des titres. Une liste blanche limitée aux 14 premiers refusait
    # « 4 000 dollars » sur l'or, cité tel quel dans un titre fourni.
    titres = [str(a.get("titre", "")) for a in articles] + [str(i.get("titre", "")) for i in perplexity_items]
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

    pm = {p.ticker: p for p in prices}
    mouvements = dict(fetch_prix_mensuels())
    if "BZ=F" in pm:
        mouvements["petrole"] = (pm["BZ=F"].weekly_change_pct, "Brent, semaine")
    if "SB=F" in pm:
        mouvements["sucre"] = (pm["SB=F"].weekly_change_pct, "sucre brut, semaine")
    expositions = _q.lignes_exposition(mouvements, REFERENTIEL)
    sources_lues = [{"titre": a.get("titre", ""), "url": a.get("source_url", ""), "date": a.get("date_publication", "")}
                    for a in articles] + list(perplexity_items)
    ctx = {"edition": edition, "fcfa": fcfa, "eurusd": eurusd, "scenarios": scenarios, "seuils": seuils,
           "bilan": bilan, "expositions": expositions, "correlations": correlations,
           "sources": sources_lues, "controles": controles, "year": year, "week": week}
    article_html = assemble_content_html(editorial_html, prices, ctx)

    # Étape 6 : HTML final
    title = _q.titre_article(prices, week, year)
    description = _q.chapo_article(prices)
    signature = (f"Rédaction WESTBOURSE · semaine {week:02d}/{year} · clôtures du vendredi · "
                 f"édition « {_q.NOM_EDITION[edition]} »")
    full_html = build_full_html(article_html, title, description, signature)

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
        resume=description,
        extra={"format": _r.FORMAT, "edition": edition, "seuils": seuils, "eurusd": eurusd, "controles": controles},
    )

    log.info("=== Terminé. Supabase: %s | Slug: %s ===", "OK" if ok else "ERREUR", slug)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
