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
            return "Haussier"
        elif self.weekly_change_pct < -2:
            return "Baissier"
        return "Neutre"

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


# ── 5. Prompt DeepSeek ────────────────────────────────────────────────────────

def build_prompt(prices: list, wb: dict, articles: list, brvm_scores: dict) -> str:
    """
    Construit le prompt envoyé à DeepSeek pour générer le content_html.
    Produit du HTML self-contained : styles inline + SVG charts.
    """
    now = datetime.now(timezone(timedelta(hours=1)))
    week_num = now.isocalendar()[1]
    year = now.year

    price_lines = "\n".join(f"  - {p.to_prompt_line()}" for p in prices)

    wb_lines = ""
    if wb:
        wb_lines = f"\nDonnées World Bank ({wb.get('month', 'N/A')}) :"
        for k, v in wb.items():
            if k != "month" and v:
                wb_lines += f"\n  - {k}: {v:.1f}"

    art_lines = ""
    if articles:
        art_lines = "\nActualités commodités semaine (sources BRVM/Afrique) :"
        for a in articles[:8]:
            art_lines += f"\n  - [{a.get('source_label','')}] {a.get('titre','')[:130]}"

    brvm_lines = "\nImpact BRVM (top valeurs scorées) :"
    for tk, score in list(brvm_scores.items())[:6]:
        brvm_lines += f"\n  - {tk}: {score}/10"

    svg_data = [
        {"label": p.label[:6], "pct": round(p.weekly_change_pct, 1),
         "color": "#10b981" if p.weekly_change_pct >= 0 else "#ef4444"}
        for p in prices
    ]
    svg_chart = _build_svg_barchart(svg_data)
    price_table_html = _build_price_table_html(prices)
    brvm_table_html = _build_brvm_table_html(prices, brvm_scores)

    return f"""Tu es rédacteur senior spécialisé marchés financiers Afrique / UEMOA pour WestBourse.
Génère l'analyse hebdomadaire des matières premières et leur impact BRVM pour la semaine {week_num}/{year}.

DONNÉES DE MARCHÉ (yfinance, vendredi clôture) :
{price_lines}
{wb_lines}
{art_lines}
{brvm_lines}

CONTRAINTES HTML ABSOLUES — RESPECTE CHAQUE POINT :

1. STRUCTURE : commence par <article> et termine par </article>. RIEN avant ni après.

2. STYLES 100% INLINE : n'utilise AUCUNE balise <style>, AUCUNE classe CSS externe.
   Tous les styles via attribut style="..." directement sur chaque élément.

3. GRAPHIQUES : n'utilise JAMAIS <canvas>, Chart.js, ou toute librairie JS externe.
   Les graphiques sont déjà fournis en SVG inline — insère-les tels quels là où indiqué.

4. LONGUEUR : 900 à 1200 mots de texte éditorial (hors balises).

STRUCTURE EXACTE À PRODUIRE :

<article style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 860px; margin: 0 auto; color: #1e293b; line-height: 1.7;">

  <!-- SYNTHÈSE EXÉCUTIVE -->
  <section style="background: #f8fafc; border-left: 4px solid #1d4ed8; padding: 16px 20px; margin-bottom: 28px; border-radius: 0 8px 8px 0;">
    <p style="font-size: 11px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: .08em; margin: 0 0 8px;">Synthèse exécutive — Semaine {week_num}/{year}</p>
    <p style="margin: 0; font-size: 15px; color: #0f172a; font-weight: 500;">[2-3 phrases résumant les faits saillants de la semaine]</p>
  </section>

  <!-- GRAPHIQUE SVG — INSÈRE ICI EXACTEMENT CE SVG : -->
  {svg_chart}

  <!-- TABLEAU PRIX — INSÈRE ICI EXACTEMENT CE HTML : -->
  {price_table_html}

  <!-- ANALYSE PAR MATIÈRE : répète ce bloc pour chaque matière (8 blocs) -->
  <section style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
    <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px;">
      <span style="font-size: 11px; color: #64748b; font-weight: 600;">[FAMILLE]  [TICKER]</span>
    </div>
    <h3 style="font-size: 16px; font-weight: 700; color: [#10b981 si hausse | #ef4444 si baisse | #f59e0b si stable]; margin: 0 0 10px;">
      [LABEL] : [PRIX] [UNITÉ] — Δ5j [VARIATION%]
    </h3>
    <p style="margin: 0; font-size: 14px; color: #334155;">[Analyse 3-4 phrases : facteurs prix, contexte macro, lien BRVM]</p>
  </section>

  <!-- TABLEAU IMPACT BRVM — INSÈRE ICI EXACTEMENT CE HTML : -->
  {brvm_table_html}

  <!-- RÉACTIONS DE MARCHÉ -->
  <section style="margin: 24px 0;">
    <h2 style="font-size: 17px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 14px;">Réactions de marché observées</h2>
    <p style="font-size: 14px; color: #334155;">[3-4 phrases sur les mouvements BRVM de la semaine]</p>
  </section>

  <!-- PERSPECTIVES -->
  <section style="background: #eff6ff; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
    <h2 style="font-size: 17px; font-weight: 700; color: #1d4ed8; margin: 0 0 10px;">Perspectives — Semaine {week_num + 1}</h2>
    <p style="font-size: 14px; color: #1e40af; margin: 0 0 8px;">[Scénario central 2-3 phrases]</p>
    <p style="font-size: 14px; color: #0f172a; margin: 0;"><strong>Recommandation WestBourse :</strong> [recommandation 1 phrase]</p>
  </section>

  <!-- DISCLAIMER -->
  <footer style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 8px;">
    <p style="font-size: 11px; color: #94a3b8; margin: 0 0 4px;">
      <strong style="color: #64748b;">Avertissement légal :</strong> Ce document est produit à titre informatif uniquement par WestBourse.
      Il ne constitue pas un conseil en investissement ni une sollicitation à acheter ou vendre des instruments financiers.
      Les performances passées ne préjugent pas des résultats futurs.
    </p>
    <p style="font-size: 11px; color: #94a3b8; margin: 0;">© {year} WestBourse — Plateforme d'analyse de la BRVM. Tous droits réservés.</p>
  </footer>

</article>

RAPPEL FINAL : styles 100% inline, pas de <style>, pas de <canvas>, pas de Chart.js.
Les blocs SVG et tables HTML fournis ci-dessus doivent être copiés tels quels dans l'output.
"""


def _build_svg_barchart(data: list[dict]) -> str:
    """SVG inline de barres — variation % hebdomadaire. Zero dépendance JS."""
    width, height = 760, 200
    padding_left, padding_bottom, padding_top = 50, 40, 20
    bar_area_width = width - padding_left - 20
    n = max(len(data), 1)
    bar_width = min(60, bar_area_width // n - 8)
    spacing = bar_area_width // n
    max_abs = max((abs(d["pct"]) for d in data), default=1) or 1
    zero_y = padding_top + (height - padding_top - padding_bottom) // 2

    bars = labels = values = ""
    for i, d in enumerate(data):
        x = padding_left + i * spacing + (spacing - bar_width) // 2
        bar_h = max(2, int(abs(d["pct"]) / max_abs * (height - padding_top - padding_bottom) / 2))
        y = (zero_y - bar_h) if d["pct"] >= 0 else zero_y
        lx = x + bar_width // 2
        bars += f'<rect x="{x}" y="{y}" width="{bar_width}" height="{bar_h}" fill="{d["color"]}" rx="3" opacity="0.9"/>'
        labels += (f'<text x="{lx}" y="{height - padding_bottom + 14}" text-anchor="middle" '
                   f'font-size="10" fill="#64748b" font-family="system-ui">{d["label"]}</text>')
        vy = (y - 4) if d["pct"] >= 0 else (y + bar_h + 13)
        sign = "+" if d["pct"] >= 0 else ""
        values += (f'<text x="{lx}" y="{vy}" text-anchor="middle" font-size="10" '
                   f'fill="{d["color"]}" font-weight="700" font-family="system-ui">'
                   f'{sign}{d["pct"]}%</text>')

    zero_line = (f'<line x1="{padding_left}" y1="{zero_y}" x2="{width-10}" y2="{zero_y}" '
                 f'stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4,3"/>')
    return (f'<div style="margin:0 0 24px;background:#f8fafc;border:1px solid #e2e8f0;'
            f'border-radius:8px;padding:16px;">'
            f'<p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;'
            f'letter-spacing:.08em;margin:0 0 12px;">Variations hebdomadaires des matières premières (%)</p>'
            f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" '
            f'style="width:100%;max-width:{width}px;display:block;">'
            f'{zero_line}{bars}{labels}{values}</svg></div>')


def _build_price_table_html(prices: list) -> str:
    """Table des prix avec styles 100% inline."""
    rows = ""
    for p in prices:
        color = "#10b981" if p.weekly_change_pct >= 0 else "#ef4444"
        sign = "+" if p.weekly_change_pct >= 0 else ""
        arrow = "▲" if p.weekly_change_pct >= 0 else "▼"
        bg = "#f0fdf4" if p.weekly_change_pct >= 0 else "#fef2f2"
        rows += (
            f'<tr>'
            f'<td style="padding:10px 12px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">{p.label}</td>'
            f'<td style="padding:10px 12px;font-family:monospace;color:#64748b;border-bottom:1px solid #f1f5f9;font-size:12px;">{p.ticker}</td>'
            f'<td style="padding:10px 12px;font-weight:700;border-bottom:1px solid #f1f5f9;">{p.current:.2f} <span style="font-size:11px;color:#94a3b8;font-weight:400;">{p.unit}</span></td>'
            f'<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">{p.week_low:.2f} – {p.week_high:.2f}</td>'
            f'<td style="padding:10px 12px;font-weight:700;color:{color};border-bottom:1px solid #f1f5f9;">{arrow} {sign}{p.weekly_change_pct:.1f}%</td>'
            f'<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">'
            f'<span style="background:{bg};color:{color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">{p.signal}</span>'
            f'</td></tr>'
        )
    th = 'style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;"'
    return (
        f'<div style="overflow-x:auto;margin-bottom:28px;">'
        f'<table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
        f'<thead><tr style="background:#0f172a;">'
        f'<th {th}>Matière</th><th {th}>Ticker</th><th {th}>Cours</th>'
        f'<th {th}>Range 5j</th><th {th}>Var. hebdo</th><th {th}>Signal</th>'
        f'</tr></thead><tbody>{rows}</tbody></table></div>'
    )


def _build_brvm_table_html(prices: list, brvm_scores: dict) -> str:
    """Table impact BRVM avec styles 100% inline."""
    price_map = {p.ticker: p for p in prices}
    BRVM_EXPOSURE = {
        "NEIC":  {"CC=F": 4, "SB=F": 2},
        "SIFCA": {"CC=F": 4, "CL=F": 1},
        "PALC":  {"CC=F": 1},
        "SOGB":  {"CC=F": 1},
        "SAPH":  {"CC=F": 1},
        "TTLS":  {"CL=F": 5, "BZ=F": 5},
        "SVOC":  {"CL=F": 5, "BZ=F": 5},
        "SLBC":  {"SB=F": 2},
        "BRVBC": {"SB=F": 2},
    }
    LABELS = {
        "CC=F": "Cacao", "CL=F": "Pétrole WTI", "BZ=F": "Brent",
        "KC=F": "Café", "SB=F": "Sucre", "CT=F": "Coton",
        "GC=F": "Or", "SI=F": "Argent",
    }
    rows = ""
    for tk, score in list(brvm_scores.items())[:8]:
        exp = BRVM_EXPOSURE.get(tk, {})
        matieres = ", ".join(LABELS.get(ct, ct) for ct in exp)
        weighted = sum(
            (price_map[ct].weekly_change_pct if ct in price_map else 0) * w
            for ct, w in exp.items()
        )
        if weighted > 0.5:
            tendance, t_color = "Favorable", "#059669"
        elif weighted < -0.5:
            tendance, t_color = "Défavorable", "#dc2626"
        else:
            tendance, t_color = "Neutre", "#d97706"
        detail = "; ".join(
            f"{LABELS.get(ct, ct)} {'+' if (price_map[ct].weekly_change_pct if ct in price_map else 0) >= 0 else ''}"
            f"{price_map[ct].weekly_change_pct:.1f}%"
            for ct in exp if ct in price_map
        )
        bar_w = min(int(score * 8), 60)
        bar_color = "#10b981" if weighted > 0 else "#ef4444" if weighted < 0 else "#f59e0b"
        rows += (
            f'<tr>'
            f'<td style="padding:10px 12px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">{tk}</td>'
            f'<td style="padding:10px 12px;color:#475569;border-bottom:1px solid #f1f5f9;font-size:13px;">{matieres}</td>'
            f'<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">'
            f'<div style="display:flex;align-items:center;gap:6px;">'
            f'<div style="width:{bar_w}px;height:6px;background:{bar_color};border-radius:3px;"></div>'
            f'<span style="font-size:12px;color:#64748b;">{score}/10</span></div></td>'
            f'<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:{t_color};font-weight:700;">{tendance}</td>'
            f'<td style="padding:10px 12px;font-size:12px;color:{t_color};border-bottom:1px solid #f1f5f9;">{detail}</td>'
            f'</tr>'
        )
    th = 'style="padding:10px 12px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;"'
    return (
        f'<section style="margin-bottom:28px;">'
        f'<h2 style="font-size:17px;font-weight:700;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:14px;">Impact sur les valeurs BRVM exposées</h2>'
        f'<p style="font-size:13px;color:#64748b;margin-bottom:12px;">Scores d\'exposition (1 à 10) calculés par WestBourse selon la corrélation CA / prix des commodités.</p>'
        f'<div style="overflow-x:auto;">'
        f'<table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
        f'<thead><tr style="background:#0f172a;">'
        f'<th {th}>Valeur</th><th {th}>Matières liées</th><th {th}>Score exposition</th>'
        f'<th {th}>Tendance</th><th {th}>Détail variation</th>'
        f'</tr></thead><tbody>{rows}</tbody></table></div></section>'
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
    log.info("4/6 Calcul scores exposition BRVM...")
    brvm_scores = compute_brvm_scores(yf_prices, wb_snapshot)
    log.info("    → %d tickers scorés", len(brvm_scores))

    # Étape 5 : Prompt + DeepSeek
    log.info("5/6 Génération article via DeepSeek...")
    prices = build_prices_list(yf_prices)
    wb_summary = build_wb_summary(wb_snapshot)
    # Convertir scores 0-100 → 0-10 pour le prompt et les tables
    brvm_scores_simple = {tk: round(v["score"] / 10, 1) for tk, v in brvm_scores.items()}
    prompt = build_prompt(prices, wb_summary, articles, brvm_scores_simple)

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
        yf_prices=yf_prices,
        wb_snapshot=wb_snapshot,
        dry_run=args.dry_run,
    )

    log.info("=== Terminé. Supabase: %s | Slug: %s ===", "OK" if ok else "ERREUR", slug)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
