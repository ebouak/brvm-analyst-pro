#!/usr/bin/env python3
"""
Télécharge automatiquement les états financiers (PDF IFRS / SYSCOHADA) des
actions BRVM depuis Supabase (table `publications`, alimentée par le scraper
BDFIN). Plus besoin de déposer les PDF à la main : `python -m utils.fetch_financials`.

Sortie : data/financials/{SYMBOLE}_{ANNEE}_{NORME}.pdf
"""
from __future__ import annotations

import logging
import re
from pathlib import Path

import requests

from .supabase_client import fetch

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
FINANCIALS_DIR = BASE_DIR / "data" / "financials"


def _norme(libelle: str) -> str:
    """Déduit la norme comptable du libellé."""
    up = libelle.upper()
    if "IFRS" in up:
        return "IFRS"
    if "SYSCOHADA" in up or "SYSCOA" in up:
        return "SYSCOHADA"
    return "ETATS"


def _year(libelle: str) -> str:
    """Extrait l'exercice (20xx) du libellé, sinon 'NA'."""
    m = re.search(r"(20\d{2})", libelle)
    return m.group(1) if m else "NA"


def fetch_financial_publications() -> list[dict]:
    """Récupère les publications de type 'etats_financiers' avec une URL PDF."""
    return fetch(
        "publications",
        {
            "select": "code,libelle,date_publication,source_url,type_publication",
            "type_publication": "eq.etats_financiers",
            "source_url": "not.is.null",
            "order": "date_publication.desc",
        },
    )


def download_pdf(url: str, dest: Path) -> bool:
    """Télécharge un PDF. Retourne False (et journalise) si échec/contenu invalide."""
    try:
        resp = requests.get(url, timeout=60, verify=False)  # cert BDFIN intermédiaire
        if resp.status_code != 200:
            logger.warning("HTTP %s — %s", resp.status_code, url[:90])
            return False
        if not resp.content[:5].startswith(b"%PDF"):
            logger.warning("Contenu non-PDF ignoré — %s", url[:90])
            return False
        dest.write_bytes(resp.content)
        return True
    except Exception as exc:  # réseau / URL invalide → on continue
        logger.error("Téléchargement échoué (%s) : %s", url[:90], exc)
        return False


def fetch_all_financials(latest_per_norme: bool = True) -> int:
    """
    Télécharge les états financiers de toutes les actions.

    Args:
        latest_per_norme: si True, ne garde que l'exercice le plus récent par
            (symbole, norme) — évite de télécharger 15 ans d'historique.

    Returns:
        Nombre de PDF téléchargés.
    """
    FINANCIALS_DIR.mkdir(parents=True, exist_ok=True)
    pubs = fetch_financial_publications()
    if not pubs:
        logger.warning("Aucune publication 'etats_financiers' trouvée dans Supabase.")
        return 0

    # Dédoublonnage : garder la plus récente par (code, norme) si demandé.
    seen: set[tuple[str, str]] = set()
    downloaded = 0
    for p in pubs:
        code = p["code"]
        libelle = p.get("libelle") or ""
        norme = _norme(libelle)
        year = _year(libelle)
        key = (code, norme)
        if latest_per_norme and key in seen:
            continue  # pubs triées desc → la 1ʳᵉ vue est la plus récente
        dest = FINANCIALS_DIR / f"{code}_{year}_{norme}.pdf"
        if download_pdf(p["source_url"], dest):
            seen.add(key)
            downloaded += 1
            logger.info("✓ %s", dest.name)
    logger.info("États financiers téléchargés : %d PDF.", downloaded)
    return downloaded


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    # Silence l'avertissement TLS (cert BDFIN intermédiaire non vérifié).
    requests.packages.urllib3.disable_warnings()  # type: ignore[attr-defined]
    fetch_all_financials()


if __name__ == "__main__":
    main()
