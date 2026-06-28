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
        # merge-duplicates : upsert par la clé de conflit (dedupe_hash)
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }


def map_article_to_row(article: dict[str, Any], tickers: list[str] | None = None) -> dict[str, Any]:
    """Convertit un article du pipeline (colonnes SQLite) vers le schéma brvm_news."""
    # Colonnes SQLite du pipeline : hash, titre, url, source, source_type,
    #   date_pub, date_collecte, resume, langue, pertinence, sentiment, est_alerte, matiere
    titre = article.get("titre") or article.get("title") or ""
    resume = article.get("resume") or article.get("summary") or None
    source_label = article.get("source") or "Inconnu"
    source_type = article.get("source_type") or "rss"

    # date_publication : YYYY-MM-DD
    pub_raw = article.get("date_pub") or article.get("date_publication") or article.get("published")
    if pub_raw:
        try:
            dt = datetime.fromisoformat(str(pub_raw).replace("Z", "+00:00"))
            date_pub = dt.date().isoformat()
        except ValueError:
            date_pub = datetime.now(timezone.utc).date().isoformat()
    else:
        date_pub = datetime.now(timezone.utc).date().isoformat()

    # Sentiment : normaliser (pipeline stocke "negatif" sans accent)
    raw_sent = article.get("sentiment") or _sentiment(titre, resume)
    sentiment = {"negatif": "négatif", "positif": "positif", "neutre": "neutre"}.get(
        raw_sent, "neutre"
    )

    # Ticker principal (premier ticker associé à l'article)
    ticker_codes = tickers or []
    instrument_code = ticker_codes[0] if ticker_codes else None

    row: dict[str, Any] = {
        "dedupe_hash": article.get("hash") or _dedupe_hash(source_label, titre),
        "titre": titre[:500],
        "date_publication": date_pub,
        "source": "brvm",
        "source_label": source_label[:200],
        "source_url": article.get("url") or article.get("source_url") or None,
        "resume": (resume[:1000] if resume else None),
        "instrument_code": instrument_code,
        "secteur": article.get("matiere") or None,
        "sentiment": sentiment,
        "score_impact": 0,
        "ticker_codes": ticker_codes,
    }
    row["score_impact"] = _score_impact({**article, **row})
    return row


def export_to_supabase(articles: list[dict[str, Any]]) -> int:
    """Upsert les articles dans brvm_news. Retourne le nombre envoyé."""
    if not SUPABASE_URL or not SERVICE_KEY:
        log.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non définis — export annulé")
        return 0

    rows_raw = [map_article_to_row(a) for a in articles]
    # Dédoublonner par dedupe_hash (le pipeline peut stocker des doublons internes)
    seen: set[str] = set()
    rows = []
    for r in rows_raw:
        h = r.get("dedupe_hash", "")
        if h and h not in seen:
            seen.add(h)
            rows.append(r)
    if not rows:
        return 0

    # ?on_conflict=dedupe_hash : upsert idempotent par la clé unique
    url = f"{SUPABASE_URL}/rest/v1/brvm_news?on_conflict=dedupe_hash"
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


def export_from_sqlite(db_path: str = "data/westbourse_veille.db") -> int:
    """Lit les articles récents de la DB SQLite et les exporte vers Supabase."""
    if not os.path.exists(db_path):
        log.error("SQLite introuvable : %s", db_path)
        return 0

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Articles des 7 derniers jours
    since = (datetime.now(timezone.utc).date().isoformat()[:10])
    # Récupérer les tickers associés par article
    tickers_map: dict[int, list[str]] = {}
    for row in conn.execute("SELECT article_id, ticker FROM article_valeurs"):
        aid = row["article_id"]
        if aid not in tickers_map:
            tickers_map[aid] = []
        tickers_map[aid].append(row["ticker"])

    cur = conn.execute(
        "SELECT * FROM articles ORDER BY date_collecte DESC LIMIT 5000"
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    log.info("Lu %d articles depuis %s", len(rows), db_path)

    mapped = [map_article_to_row(r, tickers_map.get(r["id"], [])) for r in rows]
    return export_to_supabase(mapped)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    n = export_from_sqlite()
    print(f"Export terminé : {n} articles envoyés vers Supabase")
