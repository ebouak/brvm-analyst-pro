#!/usr/bin/env python3
"""
Synchronisation complète des données depuis Supabase :
  1. CSV de cours + backtest      (brvm_actions_daily)  -> data/prices/
  2. PDF des états financiers      (publications)        -> data/financials/
  3. Extraction des fondamentaux   (PDF -> JSON)         -> data/extracted/

Une seule commande remplace les dépôts manuels :
    python -m utils.sync_data
"""
from __future__ import annotations

import logging

import requests

from .fetch_prices import fetch_all_prices
from .fetch_financials import fetch_all_financials
from .extract_fundamentals import extract_fundamentals_from_pdfs

logger = logging.getLogger(__name__)


def sync_all(with_financials: bool = True, with_extraction: bool = True) -> dict[str, int]:
    """
    Lance la synchro complète. Chaque étape est indépendante : un échec
    n'empêche pas les suivantes.

    Returns:
        Récap {"prices": n, "financials": n, "fundamentals": n}.
    """
    result = {"prices": 0, "financials": 0, "fundamentals": 0}

    logger.info("1/3 — Cours & backtest…")
    try:
        result["prices"] = fetch_all_prices()
    except Exception as exc:
        logger.error("Synchro cours échouée : %s", exc)

    if with_financials:
        logger.info("2/3 — États financiers (PDF)…")
        try:
            requests.packages.urllib3.disable_warnings()  # type: ignore[attr-defined]
            result["financials"] = fetch_all_financials()
        except Exception as exc:
            logger.error("Synchro états financiers échouée : %s", exc)

    if with_extraction:
        logger.info("3/3 — Extraction des fondamentaux…")
        try:
            extracted = extract_fundamentals_from_pdfs()
            result["fundamentals"] = len(extracted)
        except Exception as exc:
            logger.error("Extraction fondamentaux échouée : %s", exc)

    logger.info(
        "Synchro terminée — cours: %d, états financiers: %d, fondamentaux: %d",
        result["prices"], result["financials"], result["fundamentals"],
    )
    return result


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    sync_all()


if __name__ == "__main__":
    main()
