"""
Exporte les articles de output/feed.json (pipeline brvm_pipeline.py) vers brvm_news.

Variables d'environnement requises :
    SUPABASE_URL              https://<ref>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY  (clé service_role)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import requests
import yaml

log = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ── Chargement du référentiel YAML (ticker → secteur BRVM) ───────────────────
def _load_ticker_secteur_map(yaml_path: str = "brvm_config.yaml") -> dict[str, str]:
    """Retourne {ticker: secteur_BRVM} depuis brvm_config.yaml."""
    try:
        with open(yaml_path, encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        return {v["ticker"]: v.get("secteur", "") for v in cfg.get("valeurs", [])}
    except Exception as e:
        log.warning("Impossible de charger %s : %s", yaml_path, e)
        return {}

TICKER_SECTEUR: dict[str, str] = {}


# ── Sentiment ────────────────────────────────────────────────────────────────
SENTIMENT_POSITIF = ["hausse", "progression", "bénéfice", "croissance", "dividende",
                     "augmentation", "record", "rebond", "profit", "fort"]
SENTIMENT_NEGATIF = ["baisse", "chute", "perte", "déficit", "recul", "déclin",
                     "faillite", "sanction", "avertissement", "difficultés", "risque"]


def _sentiment_fallback(titre: str, resume: str | None) -> str:
    text = (titre + " " + (resume or "")).lower()
    pos = sum(1 for w in SENTIMENT_POSITIF if w in text)
    neg = sum(1 for w in SENTIMENT_NEGATIF if w in text)
    return "positif" if pos > neg else "négatif" if neg > pos else "neutre"


def _norm_sentiment(raw: str | None) -> str:
    return {"negatif": "négatif", "positif": "positif", "neutre": "neutre"}.get(
        raw or "neutre", "neutre"
    )


def _score_impact(ticker_codes: list[str], sentiment: str, source_type: str) -> int:
    score = 30
    score += min(len(ticker_codes) * 10, 25)
    if sentiment in ("positif", "négatif"):
        score += 15
    if source_type == "site_officiel":
        score += 15
    elif source_type == "institution":
        score += 10
    return min(score, 100)


# ── Mapping principal ────────────────────────────────────────────────────────
def map_feed_article(art: dict[str, Any]) -> dict[str, Any]:
    """
    Convertit un article feed.json → ligne brvm_news.
    feed.json keys: titre, url, source (nom), source_type, date_pub, resume,
                    sentiment, valeurs[], matiere, hash, est_alerte, pertinence
    """
    titre = art.get("titre") or ""
    resume = art.get("resume") or None
    # source_label = nom réel de la source (flux RSS, Google News, site officiel…)
    source_label = (art.get("source") or "Inconnu").strip()[:200]
    source_type = art.get("source_type") or "rss"

    # date_publication : YYYY-MM-DD
    pub_raw = art.get("date_pub") or art.get("date_publication")
    if pub_raw:
        try:
            dt = datetime.fromisoformat(str(pub_raw).replace("Z", "+00:00"))
            date_pub = dt.date().isoformat()
        except ValueError:
            date_pub = datetime.now(timezone.utc).date().isoformat()
    else:
        date_pub = datetime.now(timezone.utc).date().isoformat()

    # Sentiment normalisé
    raw_sent = art.get("sentiment") or _sentiment_fallback(titre, resume)
    sentiment = _norm_sentiment(raw_sent)

    # Tickers depuis "valeurs" (pipeline) — instrument_code = null (FK brvm_instruments)
    ticker_codes: list[str] = art.get("valeurs") or []

    # Secteur BRVM : depuis YAML si tickers disponibles, sinon matiere (commodités)
    secteur: str | None = None
    if ticker_codes and TICKER_SECTEUR:
        secteur = TICKER_SECTEUR.get(ticker_codes[0])
    if not secteur:
        secteur = art.get("matiere") or None

    dedupe_hash = art.get("hash") or hashlib.sha256(
        f"{source_label}|{titre}".encode()
    ).hexdigest()

    score = _score_impact(ticker_codes, sentiment, source_type)

    return {
        "dedupe_hash": dedupe_hash,
        "titre": titre[:500],
        "date_publication": date_pub,
        "source": "brvm",
        "source_label": source_label,
        "source_type": source_type,
        "source_url": art.get("url") or None,
        "resume": resume[:1000] if resume else None,
        "instrument_code": None,  # FK brvm_instruments — null pour éviter violation
        "secteur": secteur,
        "sentiment": sentiment,
        "score_impact": score,
        "ticker_codes": ticker_codes,
    }


# ── Export Supabase ──────────────────────────────────────────────────────────
def upsert_to_supabase(rows: list[dict[str, Any]]) -> int:
    if not SUPABASE_URL or not SERVICE_KEY:
        log.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non définis")
        return 0
    if not rows:
        return 0

    url = f"{SUPABASE_URL}/rest/v1/brvm_news?on_conflict=dedupe_hash"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    BATCH = 500
    total = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        resp = requests.post(url, headers=headers, data=json.dumps(batch), timeout=30)
        if resp.status_code in (200, 201):
            total += len(batch)
            log.info("Supabase upsert OK : %d articles", len(batch))
        else:
            log.error("Supabase upsert ERREUR %d : %s", resp.status_code, resp.text[:400])

    return total


def export_from_feed(feed_path: str = "output/feed.json") -> int:
    """Lit feed.json et exporte vers Supabase."""
    global TICKER_SECTEUR
    TICKER_SECTEUR = _load_ticker_secteur_map()
    log.info("Référentiel secteurs chargé : %d tickers", len(TICKER_SECTEUR))

    if not os.path.exists(feed_path):
        log.error("feed.json introuvable : %s", feed_path)
        return 0

    with open(feed_path, encoding="utf-8") as f:
        data = json.load(f)

    articles = data.get("articles", [])
    log.info("Lu %d articles depuis %s", len(articles), feed_path)

    # Mapper + dédoublonner
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    for art in articles:
        row = map_feed_article(art)
        h = row["dedupe_hash"]
        if h and h not in seen:
            seen.add(h)
            rows.append(row)

    # Stats de contrôle
    by_type: dict[str, int] = {}
    for r in rows:
        by_type[r.get("source_type", "?")] = by_type.get(r.get("source_type", "?"), 0) + 1
    secteurs_brvm = sum(1 for r in rows if r["secteur"] and r["secteur"] not in
                        {"petrole","caoutchouc","huile_palme","coton","cacao","utilities","metaux"})
    log.info("Après dédup : %d articles | %d avec tickers | %d secteurs BRVM | types: %s",
             len(rows),
             sum(1 for r in rows if r["ticker_codes"]),
             secteurs_brvm,
             by_type)

    return upsert_to_supabase(rows)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    n = export_from_feed()
    print(f"Export terminé : {n} articles envoyés vers Supabase")
