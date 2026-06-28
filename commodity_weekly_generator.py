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
from dataclasses import dataclass
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
# Nettoyer la clé : supprimer espaces et caractères non-ASCII (problème copier-coller)
DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_KEY = DEEPSEEK_KEY.encode("ascii", "ignore").decode("ascii")


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
            # yfinance >= 0.2.x retourne un MultiIndex pour un seul ticker
            closes = hist["Close"].squeeze().dropna()
            if len(closes) < 2:
                continue
            prix_actuel = float(closes.iloc[-1])
            prix_debut = float(closes.iloc[0])
            variation = (prix_actuel - prix_debut) / prix_debut * 100 if prix_debut else 0.0
            try:
                lows = hist["Low"].squeeze().dropna()
                highs = hist["High"].squeeze().dropna()
                week_low = round(float(lows.min()), 2) if not lows.empty else round(prix_actuel, 2)
                week_high = round(float(highs.max()), 2) if not highs.empty else round(prix_actuel, 2)
            except Exception:
                week_low = week_high = round(prix_actuel, 2)
            results[sym] = {
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
    "Huile de palme": {"commodity": "palm_oil", "codes": ["PALC", "SOGC"], "couleur": "#f59e0b"},
    "Caoutchouc":     {"commodity": "rubber",   "codes": ["SAPH", "SOGB"], "couleur": "#22c55e"},
    "Sucre":          {"commodity": "sugar",     "codes": ["STAC", "SUCR"], "couleur": "#e879f9"},
    "Cacao":          {"commodity": "cocoa",     "codes": ["CFAC"],         "couleur": "#a16207"},
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
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/brvm_actions_daily"
            f"?code=in.({codes_str})&date_marche=gte.{since}"
            f"&select=code,cours_jour,date_marche"
            f"&not.cours_jour=is.null&order=date_marche.asc&limit=20000",
            headers=headers, timeout=30,
        )
        resp.raise_for_status()
        stock_rows = resp.json()
    except Exception as e:
        log.warning("Supabase brvm_actions_daily erreur : %s", e)
        return []

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


# ── 5. Prompt DeepSeek + Builders visuels Python ─────────────────────────────

def build_editorial_prompt(prices: list, wb: dict, articles: list, brvm_scores: dict, correlations: list | None = None) -> str:
    """
    DeepSeek génère UNIQUEMENT le texte éditorial (synthèse + 8 analyses + réactions + perspectives).
    Python construit séparément le SVG, les tables et le footer.
    """
    now = datetime.now(timezone(timedelta(hours=1)))
    week_num = now.isocalendar()[1]
    year = now.year

    price_lines = "\n".join(f"  - {p.to_prompt_line()}" for p in prices)

    wb_ctx = ""
    if wb:
        wb_ctx = f"\nBanque Mondiale ({wb.get('month','')}) : "
        wb_ctx += ", ".join(f"{k}={v:.1f}" for k, v in wb.items() if k != "month" and v)

    art_ctx = ""
    if articles:
        art_ctx = "\nActualités commodités BRVM (7 derniers jours) :"
        for a in articles[:6]:
            art_ctx += f"\n  [{a.get('source_label','')}] {a.get('titre','')[:130]}"

    top_brvm = ", ".join(f"{tk}({s}/10)" for tk, s in list(brvm_scores.items())[:5])

    corr_ctx = ""
    if correlations:
        corr_ctx = "\nCorrélations BRVM ↔ Matières premières (Pearson, variations mensuelles) :"
        for c in correlations:
            if c["available"] and c["coefficient"] is not None:
                corr_ctx += (
                    f"\n  {c['matiere']} ({', '.join(c['codes'])}) : r={c['coefficient']:+.2f}"
                    f" [{c['interpretation']}] — {c['macro_reading']}"
                )
            else:
                corr_ctx += f"\n  {c['matiere']} ({', '.join(c['codes'])}) : données insuffisantes"

    return f"""Tu es rédacteur senior marchés/commodities pour WestBourse (BRVM Abidjan).
Génère l'analyse éditoriale des matières premières — Semaine {week_num}/{year}.

DONNÉES :
{price_lines}
{wb_ctx}
{art_ctx}
Top BRVM scorées : {top_brvm}
{corr_ctx}

CONSIGNE STRICTE :
- Produis UNIQUEMENT les sections texte ci-dessous.
- Styles CSS 100% INLINE sur chaque balise (pas de <style>, pas de class externe).
- Commence par <section> et termine par </section>.
- Aucune table de prix, aucun graphique, aucune table de corrélation (tous déjà générés par le système).
- Si une corrélation est forte (|r| > 0.7), cite-la explicitement dans l'analyse de la matière concernée.
- Longueur : 800 à 1100 mots de texte éditorial.

STRUCTURE EXACTE À PRODUIRE :

<section style="font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;line-height:1.75;">

  <!-- SYNTHÈSE EXÉCUTIVE -->
  <div style="background:#eff6ff;border-left:4px solid #1d4ed8;padding:16px 20px;margin-bottom:28px;border-radius:0 8px 8px 0;">
    <p style="font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px 0;">Synthèse exécutive — Semaine {week_num}/{year}</p>
    <p style="margin:0;font-size:15px;color:#0f172a;font-weight:500;">[2-3 phrases résumant les faits saillants : quelle matière a dominé, quel impact BRVM, ton général]</p>
  </div>

  <!-- ANALYSE PAR MATIÈRE : un bloc par matière (8 blocs total) -->
  <div style="border:1px solid #e2e8f0;border-radius:8px;padding:18px 20px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
      <span style="font-size:11px;color:#64748b;font-weight:600;">[FAMILLE EX: Agriculture]</span>
      <code style="font-size:10px;background:#f1f5f9;padding:2px 6px;border-radius:4px;color:#475569;">[TICKER EX: CC=F]</code>
    </div>
    <h3 style="font-size:16px;font-weight:700;margin:0 0 10px 0;color:[#10b981 si hausse | #ef4444 si baisse | #d97706 si stable];">
      [LABEL] : [PRIX] [UNITÉ] — Δ5j [VARIATION%]
    </h3>
    <p style="margin:0;font-size:14px;color:#334155;">[Analyse 3-4 phrases : facteurs prix, contexte géopolitique/météo/offre-demande, corrélation BRVM nominée]</p>
  </div>

  <!-- RÉACTIONS DE MARCHÉ -->
  <div style="margin:28px 0 20px;">
    <h2 style="font-size:18px;font-weight:700;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:14px;">Réactions de marché observées</h2>
    <p style="font-size:14px;color:#334155;">[3-4 phrases sur les mouvements observés sur la BRVM cette semaine en lien avec les matières premières]</p>
  </div>

  <!-- PERSPECTIVES -->
  <div style="background:#f0fdf4;border-radius:8px;padding:18px 20px;margin-bottom:20px;">
    <h2 style="font-size:18px;font-weight:700;color:#065f46;margin:0 0 12px 0;">Perspectives — Semaine {week_num + 1}/{year}</h2>
    <p style="font-size:14px;color:#064e3b;margin:0 0 10px 0;">[Scénario central 2-3 phrases : tendances attendues sur les principales matières]</p>
    <p style="font-size:14px;color:#064e3b;margin:0 0 10px 0;">[Risques à surveiller 1-2 phrases]</p>
    <p style="font-size:14px;color:#0f172a;margin:0;"><strong>Recommandation WestBourse :</strong> [1 phrase d'orientation portefeuille claire et actionnable]</p>
  </div>

</section>"""


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
            f'fill="{color}" font-weight="700" font-family="system-ui">{sign}{pct}%</text>'
            f'<text x="{cx}" y="{H - PB + 14}" text-anchor="middle" '
            f'font-size="10" fill="#64748b" font-family="system-ui">{p.label[:7]}</text>'
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
            f'<td style="padding:10px 12px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">{p.current:.2f} <span style="font-size:11px;font-weight:400;color:#94a3b8;">{p.unit}</span></td>'
            f'<td style="padding:10px 12px;color:#475569;border-bottom:1px solid #f1f5f9;">{p.week_low:.2f} – {p.week_high:.2f}</td>'
            f'<td style="padding:10px 12px;font-weight:700;color:{color};border-bottom:1px solid #f1f5f9;">{arrow} {sign}{p.weekly_change_pct:.1f}%</td>'
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


def build_brvm_table(prices: list, brvm_scores: dict) -> str:
    """Table impact BRVM avec barres de score visuelles."""
    BRVM_EXPOSURE = {
        "NEIC":  {"CC=F": 4, "SB=F": 2},
        "SIFCA": {"CC=F": 4, "CL=F": 1},
        "PALC":  {"CC=F": 1}, "SOGB": {"CC=F": 1}, "SAPH": {"CC=F": 1},
        "TTLS":  {"CL=F": 5, "BZ=F": 5},
        "SVOC":  {"CL=F": 5, "BZ=F": 5},
        "SLBC":  {"SB=F": 2}, "BRVBC": {"SB=F": 2},
    }
    LABELS = {
        "CC=F": "Cacao", "CL=F": "Pétrole WTI", "BZ=F": "Brent",
        "KC=F": "Café", "SB=F": "Sucre", "CT=F": "Coton", "GC=F": "Or", "SI=F": "Argent",
    }
    pm = {p.ticker: p for p in prices}
    rows = ""
    for tk, score in list(brvm_scores.items())[:8]:
        exp = BRVM_EXPOSURE.get(tk, {})
        matieres = ", ".join(LABELS.get(ct, ct) for ct in exp)
        weighted = sum((pm[ct].weekly_change_pct if ct in pm else 0) * w for ct, w in exp.items())
        if weighted > 0.5:
            tend, t_col, bar_col = "Favorable", "#059669", "#10b981"
        elif weighted < -0.5:
            tend, t_col, bar_col = "Défavorable", "#dc2626", "#ef4444"
        else:
            tend, t_col, bar_col = "Neutre", "#d97706", "#f59e0b"
        detail = " | ".join(
            f"{LABELS.get(ct, ct)} {'+' if (pm[ct].weekly_change_pct if ct in pm else 0) >= 0 else ''}"
            f"{pm[ct].weekly_change_pct:.1f}%"
            for ct in exp if ct in pm
        )
        bar_w = min(int(score * 9), 80)
        rows += (
            f'<tr>'
            f'<td style="padding:10px 12px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">{tk}</td>'
            f'<td style="padding:10px 12px;color:#475569;font-size:13px;border-bottom:1px solid #f1f5f9;">{matieres}</td>'
            f'<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">'
            f'<div style="display:flex;align-items:center;gap:8px;">'
            f'<div style="width:{bar_w}px;height:7px;background:{bar_col};border-radius:4px;"></div>'
            f'<span style="font-size:12px;color:#64748b;font-weight:600;">{score}/10</span>'
            f'</div></td>'
            f'<td style="padding:10px 12px;font-weight:700;color:{t_col};border-bottom:1px solid #f1f5f9;">{tend}</td>'
            f'<td style="padding:10px 12px;font-size:12px;color:{t_col};border-bottom:1px solid #f1f5f9;">{detail}</td>'
            f'</tr>'
        )
    th = 'style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;"'
    return (
        f'<div style="margin-bottom:28px;">'
        f'<h2 style="font-size:18px;font-weight:700;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:14px;">Impact sur les valeurs BRVM exposées</h2>'
        f'<p style="font-size:13px;color:#64748b;margin-bottom:12px;">Scores d\'exposition (0–10) calculés par WestBourse selon la corrélation chiffre d\'affaires × prix commodités.</p>'
        f'<div style="overflow-x:auto;">'
        f'<table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
        f'<thead><tr style="background:#0f172a;">'
        f'<th {th}>Valeur</th><th {th}>Matières liées</th><th {th}>Score exposition</th>'
        f'<th {th}>Tendance semaine</th><th {th}>Détail variation</th>'
        f'</tr></thead><tbody>{rows}</tbody></table></div></div>'
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
                f'{sign}{coeff:.2f} — {strength}</span>'
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


def build_footer(year: int) -> str:
    return (
        f'<footer style="border-top:1px solid #e2e8f0;padding-top:14px;margin-top:8px;">'
        f'<p style="font-size:11px;color:#94a3b8;margin:0 0 4px 0;">'
        f'<strong style="color:#64748b;">Avertissement légal :</strong> Ce document est produit à titre informatif '
        f'uniquement par WestBourse. Il ne constitue pas un conseil en investissement ni une sollicitation '
        f'à acheter ou vendre des instruments financiers. Les performances passées ne préjugent pas des '
        f'résultats futurs. Sources : yfinance, Banque Mondiale CMO Pink Sheet, actualités sectorielles BRVM.'
        f'</p>'
        f'<p style="font-size:11px;color:#94a3b8;margin:0;">© {year} WestBourse — Plateforme d\'analyse de la BRVM. Tous droits réservés.</p>'
        f'</footer>'
    )


def assemble_content_html(
    editorial_html: str,
    prices: list,
    brvm_scores: dict,
    correlations: list | None = None,
) -> str:
    """
    Assemble le HTML final : visuels Python + texte DeepSeek.
    Structure : <article> SVG + table prix + éditorial + table BRVM + table corrélations + footer </article>
    """
    year = datetime.now(timezone(timedelta(hours=1))).year
    text = editorial_html.strip()
    if not text.startswith("<section"):
        text = (f'<section style="font-family:\'Segoe UI\',system-ui,sans-serif;'
                f'color:#1e293b;line-height:1.75;">{text}</section>')
    corr_html = build_correlation_table(correlations or [])
    return (
        '<article style="font-family:\'Segoe UI\',system-ui,sans-serif;'
        'max-width:860px;margin:0 auto;color:#1e293b;line-height:1.75;">\n'
        + build_svg_barchart(prices) + "\n"
        + build_price_table(prices) + "\n"
        + text + "\n"
        + build_brvm_table(prices, brvm_scores) + "\n"
        + corr_html + "\n"
        + build_footer(year) + "\n"
        + "</article>"
    )


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
    yf_prices: dict | None = None,
    wb_snapshot: dict | None = None,
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

    # Étape 5 : Prompt + DeepSeek
    log.info("5/7 Génération article via DeepSeek...")
    prices = build_prices_list(yf_prices)
    wb_summary = build_wb_summary(wb_snapshot)
    # Convertir scores 0-100 → 0-10 pour le prompt et les tables
    brvm_scores_simple = {tk: round(v["score"] / 10, 1) for tk, v in brvm_scores.items()}
    prompt = build_editorial_prompt(prices, wb_summary, articles, brvm_scores_simple, correlations)

    if args.dry_run:
        log.info("[DRY-RUN] Appel DeepSeek ignoré")
        editorial_html = "<section><p>[DRY-RUN] Contenu éditorial non généré.</p></section>"
    else:
        editorial_html = call_deepseek(prompt)

    article_html = assemble_content_html(editorial_html, prices, brvm_scores_simple, correlations)

    # Étape 6 : HTML final
    title = f"Matières premières BRVM – Semaine {week:02d}/{year} | WestBourse"
    description = (
        f"Analyse hebdomadaire de l'impact des matières premières "
        f"(cacao, pétrole, caoutchouc, huile de palme) sur les valeurs BRVM. "
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
    )

    log.info("=== Terminé. Supabase: %s | Slug: %s ===", "OK" if ok else "ERREUR", slug)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
