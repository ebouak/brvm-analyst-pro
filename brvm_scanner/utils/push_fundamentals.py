#!/usr/bin/env python3
"""
Pousse les fondamentaux extraits (data/extracted/*.json) vers la table Supabase
`fundamentals`, pour qu'ils soient durables et lus par le site Next.js et l'app.

⚠️ Écriture = service_role REQUIS (la clé anon ne peut pas écrire, RLS). Ce
script ne tourne donc QUE là où SUPABASE_SERVICE_ROLE_KEY est disponible
(poste local, CI) — jamais dans l'app publique Streamlit.

Variables d'environnement :
    SUPABASE_URL                 (ou défaut projet)
    SUPABASE_SERVICE_ROLE_KEY    (obligatoire)

Usage :
    SUPABASE_SERVICE_ROLE_KEY=... python -m utils.push_fundamentals
"""
from __future__ import annotations

import glob
import json
import logging
import os
from pathlib import Path

import requests

from .supabase_client import SUPABASE_URL

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
EXTRACTED_DIR = BASE_DIR / "data" / "extracted"

NUMERIC_FIELDS = ["revenue", "net_income", "equity", "cash", "debt", "bfr"]


def _service_key() -> str:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        raise SystemExit(
            "SUPABASE_SERVICE_ROLE_KEY manquant — requis pour écrire dans Supabase.\n"
            "Ex. (PowerShell) : $env:SUPABASE_SERVICE_ROLE_KEY='...'; "
            "python -m utils.push_fundamentals"
        )
    return key


def build_rows() -> list[dict]:
    """Construit les lignes à upserter depuis les JSON extraits non vides."""
    rows: list[dict] = []
    for path in sorted(glob.glob(str(EXTRACTED_DIR / "*_fundamentals.json"))):
        code = os.path.basename(path).split("_")[0].upper()
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        # On ne pousse que si au moins un indicateur est présent.
        if not any(data.get(k) for k in NUMERIC_FIELDS):
            continue
        rows.append(
            {
                "code": code,
                "year": data.get("year"),
                **{k: data.get(k) for k in NUMERIC_FIELDS},
                "source": "bdfin-pdf",
                "source_file": data.get("source_file"),
            }
        )
    return rows


def push_fundamentals() -> int:
    """Upsert les fondamentaux dans Supabase (onConflict code,year). Retourne le nb poussé."""
    rows = build_rows()
    if not rows:
        logger.warning("Aucun fondamental non vide à pousser.")
        return 0

    key = _service_key()
    url = f"{SUPABASE_URL}/rest/v1/fundamentals"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    resp = requests.post(
        url, headers=headers, params={"on_conflict": "code,year"}, json=rows, timeout=60
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"Upsert fundamentals échoué ({resp.status_code}): {resp.text[:300]}")
    logger.info("Fondamentaux poussés : %d ligne(s).", len(rows))
    return len(rows)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    push_fundamentals()


if __name__ == "__main__":
    main()
