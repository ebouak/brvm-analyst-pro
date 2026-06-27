"""
Adaptateur : exporte les articles du pipeline brvm_pipeline.py vers la table
brvm_news de Supabase.

Usage standalone (après avoir lancé brvm_pipeline.py) :
    python supabase_writer.py

Ou intégré en fin de pipeline :
    from supabase_writer import export_to_supabase
    export_to_supabase(articles)

Variables d'environnement requises :
    SUPABASE_URL              https://<ref>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY  (clé service_role — jamais exposée au frontend)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sqlite3
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


def _sentiment(titre: str, resume: str | None) -> str:
    text = (titre + " " + (resume or "")).lower()
    pos = sum(1 for w in SENTIMENT_POSITIF if w in text)
    neg = sum(1 for w in SENTIMENT_NEGATIF if w in text)
    if pos > neg:
        return "positif"
    if neg > pos:
        return "négatif"
    return "neutre"


def _score_impact(article: dict[str, Any]) -> int:
    """Heuristique 0-100 : sociétés/secteurs nommés + sentiment fort."""
    score = 30
    if article.get("instrument_code"):
        score += 20
    tickers = article.get("ticker_codes") or []
    score += min(len(tickers) * 5, 20)
    sent = article.get("sentiment", "neutre")
    if sent in ("positif", "négatif"):
        score += 15
    source = (article.get("source_label") or "").lower()
    if "officiel" in source or "brvm" in source or "cosumaf" in source:
        score += 15
    return min(score, 100)


def _dedupe_hash(source: str, titre: str) -> str:
    return hashlib.sha256(f"{source}|{titre}".encode()).hexdigest()


def _supabase_headers() -> dict[str, str]:
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    }


def map_article_to_row(article: dict[str, Any]) -> dict[str, Any]:
    """Convertit un article du pipeline vers le schéma brvm_news."""
    source_label = article.get("source_label") or article.get("source") or "Inconnu"
    titre = article.get("title") or article.get("titre") or ""
    resume = article.get("summary") or article.get("resume") or None
    ticker = article.get("ticker") or article.get("instrument_code") or None

    # date_publication : YYYY-MM-DD
    pub_raw = article.get("published") or article.get("date_publication")
    if pub_raw:
        try:
            dt = datetime.fromisoformat(str(pub_raw).replace("Z", "+00:00"))
            date_pub = dt.date().isoformat()
        except ValueError:
            date_pub = datetime.now(timezone.utc).date().isoformat()
    else:
        date_pub = datetime.now(timezone.utc).date().isoformat()

    sentiment = _sentiment(titre, resume)
    row: dict[str, Any] = {
        "dedupe_hash": _dedupe_hash(source_label, titre),
        "titre": titre[:500],
        "date_publication": date_pub,
        "source": "brvm",
        "source_label": source_label[:200],
        "source_url": article.get("link") or article.get("source_url") or None,
        "resume": (resume[:1000] if resume else None),
        "instrument_code": ticker,
        "secteur": article.get("secteur") or None,
        "sentiment": sentiment,
        "score_impact": 0,
        "ticker_codes": article.get("ticker_codes") or (
            [ticker] if ticker else []
        ),
    }
    row["score_impact"] = _score_impact({**article, **row})
    return row


def export_to_supabase(articles: list[dict[str, Any]]) -> int:
    """Upsert les articles dans brvm_news. Retourne le nombre envoyé."""
    if not SUPABASE_URL or not SERVICE_KEY:
        log.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non définis — export annulé")
        return 0

    rows = [map_article_to_row(a) for a in articles]
    if not rows:
        return 0

    url = f"{SUPABASE_URL}/rest/v1/brvm_news"
    headers = _supabase_headers()

    # Supabase accepte jusqu'à ~1000 lignes par requête.
    BATCH = 500
    total = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        resp = requests.post(url, headers=headers, data=json.dumps(batch), timeout=30)
        if resp.status_code in (200, 201):
            total += len(batch)
            log.info("Supabase upsert OK : %d articles", len(batch))
        else:
            log.error("Supabase upsert ERREUR %d : %s", resp.status_code, resp.text[:300])

    return total


def export_from_sqlite(db_path: str = "brvm_veille.db") -> int:
    """Lit tous les articles de la DB SQLite du pipeline et les exporte."""
    if not os.path.exists(db_path):
        log.error("SQLite introuvable : %s", db_path)
        return 0

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.execute(
        "SELECT * FROM articles ORDER BY published DESC LIMIT 5000"
    )
    articles = [dict(row) for row in cur.fetchall()]
    conn.close()
    log.info("Lu %d articles depuis %s", len(articles), db_path)
    return export_to_supabase(articles)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    n = export_from_sqlite()
    print(f"Export terminé : {n} articles envoyés vers Supabase")
