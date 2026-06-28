#!/usr/bin/env python3
"""
WestBourse – API Flask Veille BRVM
====================================
Sert les données du pipeline (feed.json, alertes.json, stats.json)
en tant qu'API JSON pour le widget JS et le frontend Next.js.

Usage:
    python api_brvm.py                        # port 5050
    python api_brvm.py --port 8080
    FLASK_ENV=production python api_brvm.py

Dépendances:
    pip install flask flask-cors pyyaml
"""

import argparse
import json
import logging
import os
from datetime import datetime
from pathlib import Path

import yaml
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE = Path(__file__).parent
OUTPUT = BASE / "output"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("wb-api")

app = Flask(__name__)
CORS(app, origins=["*"])  # Widget embarqué partout


# ── Helpers ──────────────────────────────────────────────────────────────────

def _load_json(filename: str) -> dict | list:
    path = OUTPUT / filename
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _load_config() -> dict:
    try:
        with open(BASE / "brvm_config.yaml", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except Exception:
        return {}


def _filter_articles(
    articles: list[dict],
    *,
    ticker: str | None = None,
    secteur: str | None = None,
    matiere: str | None = None,
    days: int = 7,
    limit: int = 50,
) -> list[dict]:
    """Filtre et trie les articles par critères."""
    from datetime import timezone, timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()

    result = []
    for art in articles:
        pub = art.get("date_pub") or art.get("date_publication") or ""
        if pub and pub[:10] < cutoff:
            continue
        if ticker and ticker.upper() not in [v.upper() for v in (art.get("valeurs") or [])]:
            continue
        if secteur and (art.get("secteur") or "").lower() != secteur.lower():
            continue
        if matiere and (art.get("matiere") or "").lower() != matiere.lower():
            continue
        result.append(art)

    # Tri par date décroissante
    result.sort(key=lambda a: a.get("date_pub") or a.get("date_publication") or "", reverse=True)
    return result[:limit]


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok", "ts": datetime.utcnow().isoformat()})


@app.route("/api/feed")
def feed():
    """
    GET /api/feed
    Paramètres optionnels :
        ticker=SNTS          filtre par ticker BRVM
        secteur=Banque       filtre par secteur
        matiere=cacao        filtre matière première
        days=7               fenêtre temporelle (1-365)
        limit=50             nombre max d'articles (1-200)
    """
    ticker = request.args.get("ticker")
    secteur = request.args.get("secteur")
    matiere = request.args.get("matiere")
    try:
        days = max(1, min(365, int(request.args.get("days", 7))))
    except (ValueError, TypeError):
        days = 7
    try:
        limit = max(1, min(200, int(request.args.get("limit", 50))))
    except (ValueError, TypeError):
        limit = 50

    data = _load_json("feed.json")
    articles = data.get("articles", []) if isinstance(data, dict) else []

    filtered = _filter_articles(
        articles, ticker=ticker, secteur=secteur,
        matiere=matiere, days=days, limit=limit,
    )

    return jsonify({
        "count": len(filtered),
        "days": days,
        "filters": {"ticker": ticker, "secteur": secteur, "matiere": matiere},
        "articles": filtered,
    })


@app.route("/api/alertes")
def alertes():
    """
    GET /api/alertes
    Paramètres :
        days=7
        limit=20
    """
    try:
        days = max(1, min(365, int(request.args.get("days", 7))))
    except (ValueError, TypeError):
        days = 7
    try:
        limit = max(1, min(100, int(request.args.get("limit", 20))))
    except (ValueError, TypeError):
        limit = 20

    data = _load_json("alertes.json")
    alertes_list = data.get("alertes", []) if isinstance(data, dict) else []
    filtered = _filter_articles(alertes_list, days=days, limit=limit)

    return jsonify({
        "count": len(filtered),
        "alertes": filtered,
    })


@app.route("/api/stats")
def stats():
    """GET /api/stats — métriques globales du pipeline."""
    data = _load_json("stats.json")
    return jsonify(data if isinstance(data, dict) else {"raw": data})


@app.route("/api/commodites")
def commodites():
    """GET /api/commodites — prix matières premières."""
    data = _load_json("commodites.json")
    return jsonify(data if isinstance(data, dict) else {"raw": data})


@app.route("/api/sources")
def sources():
    """GET /api/sources — liste des sources configurées et leur état."""
    cfg = _load_config()
    sources_list = []

    # RSS général
    for s in cfg.get("sources", {}).get("rss_general", []):
        sources_list.append({
            "name": s.get("name"),
            "url": s.get("url"),
            "type": "rss",
            "priorite": s.get("priorite", 3),
            "langue": s.get("langue", "fr"),
        })

    # Commodités
    for s in cfg.get("sources", {}).get("rss_commodites", []):
        sources_list.append({
            "name": s.get("name"),
            "url": s.get("url"),
            "type": "commodite",
            "matiere": s.get("matiere"),
            "tickers_impactes": s.get("tickers_impactes", []),
            "priorite": s.get("priorite", 3),
        })

    # Institutions
    for s in cfg.get("sources", {}).get("rss_institutions", []):
        sources_list.append({
            "name": s.get("name"),
            "url": s.get("url"),
            "type": s.get("type", "institution"),
            "priorite": s.get("priorite", 3),
        })

    # Sites sociétés
    for s in cfg.get("sites_societes", []):
        if s.get("google_news"):
            sources_list.append({
                "name": f"Google News – {s['ticker']}",
                "url": s.get("google_news"),
                "type": "google_news",
                "ticker": s.get("ticker"),
                "priorite": 1,
            })
        if s.get("site_presse"):
            sources_list.append({
                "name": f"Site officiel – {s['ticker']}",
                "url": s.get("site_presse"),
                "type": "site_officiel",
                "ticker": s.get("ticker"),
                "priorite": 1,
            })

    return jsonify({
        "total": len(sources_list),
        "sources": sources_list,
    })


@app.route("/api/tickers")
def tickers():
    """GET /api/tickers — liste des 47 valeurs BRVM avec métadonnées."""
    cfg = _load_config()
    valeurs = cfg.get("valeurs", [])
    return jsonify({
        "count": len(valeurs),
        "valeurs": valeurs,
    })


@app.route("/api/ticker/<code>")
def ticker_detail(code: str):
    """GET /api/ticker/<CODE> — articles récents pour un ticker donné."""
    code = code.upper()
    try:
        days = max(1, min(365, int(request.args.get("days", 30))))
    except (ValueError, TypeError):
        days = 30
    try:
        limit = max(1, min(200, int(request.args.get("limit", 30))))
    except (ValueError, TypeError):
        limit = 30

    data = _load_json("feed.json")
    articles = data.get("articles", []) if isinstance(data, dict) else []
    filtered = _filter_articles(articles, ticker=code, days=days, limit=limit)

    # Méta depuis config
    cfg = _load_config()
    meta = next((v for v in cfg.get("valeurs", []) if v.get("ticker") == code), {})

    return jsonify({
        "ticker": code,
        "meta": meta,
        "count": len(filtered),
        "articles": filtered,
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route introuvable", "status": 404}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Erreur interne", "status": 500}), 500


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="WestBourse Veille API")
    parser.add_argument("--port", type=int, default=5050)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    log.info("WestBourse Veille API — http://%s:%d", args.host, args.port)
    app.run(host=args.host, port=args.port, debug=args.debug)
