"""
Client REST minimal pour lire Supabase en lecture seule (clé anon, RLS publique).

La clé anon est PUBLIQUE par conception (elle est livrée au navigateur par le
frontend) et protégée par les Row-Level-Security policies — ce n'est pas un
secret. Le service_role (écriture) n'est JAMAIS utilisé ici.

Surcharge possible par variables d'environnement :
    SUPABASE_URL, SUPABASE_ANON_KEY
"""
from __future__ import annotations

import os
from typing import Any

import requests

# Valeurs par défaut = projet BRVM Analyst Pro (clé anon publique, RLS).
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://vozwivhmjfmnnnjbbkpt.supabase.co"
).rstrip("/")
SUPABASE_ANON_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvendpdmhtamZtbm5uamJia3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTAzMjcsImV4cCI6MjA5NTI2NjMyN30."
    "doCjWCzRgBHraASg8LIiPrJTJeJZHJoByPQjYiTJZLM",
)

_PAGE = 1000


def _headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Accept": "application/json",
    }


def fetch(table: str, params: dict[str, Any], paginate: bool = True) -> list[dict]:
    """
    GET sur /rest/v1/{table} avec pagination par Range (1000 lignes/page).

    Args:
        table: nom de la table (ex. "brvm_actions_daily").
        params: filtres PostgREST (ex. {"code": "eq.SNTS",
                "select": "date_marche,cours_jour", "order": "date_marche.asc"}).
        paginate: si True, enchaîne les pages jusqu'à épuisement.

    Returns:
        Liste de dicts (lignes).
    """
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    rows: list[dict] = []
    offset = 0
    while True:
        headers = _headers()
        headers["Range-Unit"] = "items"
        headers["Range"] = f"{offset}-{offset + _PAGE - 1}"
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        batch = resp.json()
        rows.extend(batch)
        if not paginate or len(batch) < _PAGE:
            break
        offset += _PAGE
    return rows
