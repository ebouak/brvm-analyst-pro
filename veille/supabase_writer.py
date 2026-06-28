"""
Adaptateur : exporte les articles du pipeline brvm_pipeline.py vers la table
brvm_news de Supabase.

Source privilégiée : output/feed.json (produit par brvm_pipeline.py)
  → contient titre, url, source, sentiment, valeurs[], matiere, hash, date_pub, resume

Variables d'environnement requises :
    SUPABASE_URL              https://<ref>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY  (clé service_role — jamais exposée au frontend)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import requests

log = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

SENTIMENT_POSITIF = [
    "hausse", "progression", "bénéfice", "croissance", "résultats positifs",
    "dividende", "augmentation", "record", "fort", "rebond", "profit",
]
SENTIMENT_NEGATIF = [
    "baisse", "chute", "perte", "déficit", "recul", "déclin", "faillite",
    "sanction", "avertissement", "difficultés", "risque", "incertitude",
]


def _sentiment_fallback(titre: str, resume: str | None) -> str:
    text = (titre + " " + (resume or "")).lower()
    pos = sum(1 for w in SENTIMENT_POSITIF if w in text)
    neg = sum(1 for w in SENTIMENT_NEGATIF if w in text)
    if pos > neg:
        return "positif"
    if neg > pos:
        return "négatif"
    return "neutre"


def _score_impact(ticker_codes: list[str], sentiment: str, source_label: str) -> int:
    score = 30
    score += min(len(ticker_codes) * 10, 25)
    if sentiment in ("positif", "négatif"):
        score += 15
    src = source_label.lower()
    if "officiel" in src or "brvm" in src or "cosumaf" in src:
        score += 15
    return min(score, 100)


def _norm_sentiment(raw: str | None) -> str:
    """Normalise le sentiment (pipeline écrit 'negatif' sans accent)."""
    return {"negatif": "négatif", "positif": "positif", "neutre": "neutre"}.get(
        raw or "neutre", "neutre"
    )


def map_feed_article(art: dict[str, Any]) -> dict[str, Any]:
    """
    Convertit un article du feed.json pipeline vers le schéma brvm_news.
    feed.json columns: titre, url, source, source_type, date_pub, resume,
                       sentiment, valeurs[], matiere, hash, est_alerte, pertinence
    """
    titre = art.get("titre") or ""
    resume = art.get("resume") or None
    source_label = art.get("source") or "Inconnu"

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

    # Tickers (feed.json stocke la liste dans "valeurs")
    ticker_codes: list[str] = art.get("valeurs") or []
    instrument_code = ticker_codes[0] if ticker_codes else None

    # Secteur depuis matiere (commodité) ou None
    secteur = art.get("matiere") or None

    # dedupe_hash : utiliser celui du pipeline
    dedupe_hash = art.get("hash") or hashlib.sha256(
        f"{source_label}|{titre}".encode()
    ).hexdigest()

    score = _score_impact(ticker_codes, sentiment, source_label)

    return {
        "dedupe_hash": dedupe_hash,
        "titre": titre[:500],
        "date_publication": date_pub,
        "source": "brvm",
        "source_label": source_label[:200],
        "source_url": art.get("url") or None,
        "resume": resume[:1000] if resume else None,
        "instrument_code": instrument_code,
        "secteur": secteur,
        "sentiment": sentiment,
        "score_impact": score,
        "ticker_codes": ticker_codes,
    }


def upsert_to_supabase(rows: list[dict[str, Any]]) -> int:
    """Upsert des rows déjà mappés dans brvm_news. Retourne le nombre envoyé."""
    if not SUPABASE_URL or not SERVICE_KEY:
        log.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non définis — export annulé")
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
    """Lit feed.json (produit par le pipeline) et exporte vers Supabase."""
    if not os.path.exists(feed_path):
        log.error("feed.json introuvable : %s", feed_path)
        return 0

    with open(feed_path, encoding="utf-8") as f:
        data = json.load(f)

    articles = data.get("articles", [])
    log.info("Lu %d articles depuis %s", len(articles), feed_path)

    # Mapper + dédoublonner par dedupe_hash
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    for art in articles:
        row = map_feed_article(art)
        h = row["dedupe_hash"]
        if h and h not in seen:
            seen.add(h)
            rows.append(row)

    log.info("Après déduplication : %d articles uniques", len(rows))
    log.info(
        "  Avec tickers : %d | Avec secteur : %d | Sentiment pos/neg : %d/%d",
        sum(1 for r in rows if r["ticker_codes"]),
        sum(1 for r in rows if r["secteur"]),
        sum(1 for r in rows if r["sentiment"] == "positif"),
        sum(1 for r in rows if r["sentiment"] == "négatif"),
    )
    return upsert_to_supabase(rows)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    n = export_from_feed()
    print(f"Export terminé : {n} articles envoyés vers Supabase")
