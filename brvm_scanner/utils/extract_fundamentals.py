#!/usr/bin/env python3
"""
Extraction des indicateurs financiers clés depuis les PDFs des états financiers
(IFRS / SYSCOHADA) des actions BRVM. Génère un fichier JSON par action dans
data/extracted/{SYMBOLE}_fundamentals.json.

Basé sur le script pdfplumber fourni, enrichi :
  - résolution des chemins indépendante du cwd ;
  - prise en charge IFRS *et* SYSCOHADA ;
  - détection de l'exercice (année) depuis le nom de fichier ;
  - indicateurs supplémentaires : dette, BFR ;
  - PDFs corrompus : journalisés puis ignorés (on continue) ;
  - fusion multi-fichiers par symbole (exercice le plus récent, IFRS prioritaire).

Prérequis : pip install pdfplumber

Usage :
    python -m utils.extract_fundamentals            # depuis brvm_scanner/
    python utils/extract_fundamentals.py            # exécution directe
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Optional

try:
    import pdfplumber
except ImportError:  # message clair si la dépendance manque
    pdfplumber = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

# --- Chemins (racine = parent de utils/) ------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_DIR = BASE_DIR / "data" / "financials"
OUTPUT_DIR = BASE_DIR / "data" / "extracted"

# Les deux normes comptables sont traitées (IFRS prioritaire à la fusion).
PDF_GLOBS = ["*_IFRS.pdf", "*_SYSCOHADA.pdf", "*.pdf"]

# Libellés recherchés (un nombre entier suit le libellé). Calibrés sur les
# états IFRS/SYSCOHADA BRVM ; ajustez si vos PDFs diffèrent.
PATTERNS: dict[str, list[str]] = {
    "revenue": [
        r"Chiffre[s]? d['’]affaires[^\d\n]*(\d[\d.,\xa0 ]*)",
        r"Produits des ventes[^\d\n]*(\d[\d.,\xa0 ]*)",
        r"Chiffre d['’]affaires net[^\d\n]*(\d[\d.,\xa0 ]*)",
    ],
    "net_income": [
        r"R[ée]sultat net de l['’]ensemble[^\d\n]*(\d[\d.,\xa0 ]*)",
        r"R[ée]sultat net part du groupe[^\d\n]*(\d[\d.,\xa0 ]*)",
        r"R[ée]sultat net[^\d\n]*(\d[\d.,\xa0 ]*)",
    ],
    "equity": [
        r"Total capitaux propres[^\d\n]*(\d[\d.,\xa0 ]*)",
        r"Capitaux propres[^\d\n]*(\d[\d.,\xa0 ]*)",
    ],
    "cash": [
        r"Tr[ée]sorerie et [ée]quivalents de tr[ée]sorerie[^\d\n]*(\d[\d.,\xa0 ]*)",
        r"Disponibilit[ée]s et quasi-disponibilit[ée]s[^\d\n]*(\d[\d.,\xa0 ]*)",
        r"Tr[ée]sorerie[^\d\n]*(\d[\d.,\xa0 ]*)",
    ],
    "debt": [
        r"Total dettes financi[èe]res[^\d\n]*(\d[\d.,\xa0 ]*)",
        r"Dettes financi[èe]res[^\d\n]*(\d[\d.,\xa0 ]*)",
        r"Emprunts[^\d\n]*(\d[\d.,\xa0 ]*)",
    ],
    "bfr": [
        r"Besoin en fonds de roulement[^\d\n]*(\d[\d.,\xa0 ]*)",
        r"BFR[^\d\n]*(\d[\d.,\xa0 ]*)",
    ],
}

NUMERIC_FIELDS = list(PATTERNS.keys())


def extract_number_from_text(text: str, patterns: list[str]) -> Optional[int]:
    """Retourne le premier entier trouvé pour l'un des patterns, sinon None."""
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            # Ne conserver que les chiffres (retire espaces, nbsp, points, virgules).
            raw = re.sub(r"\D", "", match.group(1))
            if raw:
                return int(raw)
    return None


def _year_from_filename(path: Path) -> Optional[int]:
    """Détecte un exercice (2019-2099) dans le nom de fichier."""
    m = re.search(r"(20\d{2})", path.stem)
    return int(m.group(1)) if m else None


def _symbol_from_filename(path: Path) -> str:
    """Symbole = première partie avant le premier underscore."""
    return path.stem.split("_")[0].upper()


def process_pdf(pdf_path: Path) -> dict:
    """
    Extrait les indicateurs d'un PDF. Un PDF corrompu/illisible est journalisé
    et renvoie un dict de None (le traitement global continue).
    """
    result: dict[str, Optional[int]] = {k: None for k in NUMERIC_FIELDS}
    if pdfplumber is None:
        logger.error("pdfplumber non installé — `pip install pdfplumber`")
        return result
    try:
        with pdfplumber.open(pdf_path) as pdf:
            full_text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    except Exception as exc:  # PDF corrompu → log + on continue
        logger.error("PDF illisible, ignoré : %s (%s)", pdf_path.name, exc)
        return result

    for key, patterns in PATTERNS.items():
        result[key] = extract_number_from_text(full_text, patterns)
    return result


def _merge(into: dict, new: dict) -> dict:
    """Complète les champs manquants de `into` avec ceux de `new`."""
    for k in NUMERIC_FIELDS:
        if into.get(k) is None and new.get(k) is not None:
            into[k] = new[k]
    return into


def extract_fundamentals_from_pdfs(
    input_dir: Path | str = INPUT_DIR,
    output_dir: Path | str = OUTPUT_DIR,
) -> dict[str, dict]:
    """
    Parcourt input_dir, extrait les fondamentaux de chaque PDF et écrit un
    JSON par symbole dans output_dir.

    Fusion par symbole : on retient l'exercice le plus récent ; pour un même
    exercice, l'IFRS est prioritaire et le SYSCOHADA complète les trous.

    Returns:
        Dict {symbole: fondamentaux} pour les symboles traités.
    """
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.is_dir():
        logger.warning("Dossier des PDFs introuvable : %s", input_dir)
        return {}

    # Collecte unique des PDFs (un fichier peut matcher plusieurs globs).
    pdf_files: list[Path] = []
    seen: set[Path] = set()
    for glob in PDF_GLOBS:
        for p in input_dir.glob(glob):
            if p not in seen:
                seen.add(p)
                pdf_files.append(p)

    if not pdf_files:
        logger.warning("Aucun PDF trouvé dans %s", input_dir)
        return {}

    # Agrégation par symbole.
    per_symbol: dict[str, dict] = {}
    for pdf_path in sorted(pdf_files):
        symbol = _symbol_from_filename(pdf_path)
        year = _year_from_filename(pdf_path)
        is_ifrs = "IFRS" in pdf_path.stem.upper()
        logger.info("Traitement %s (%s, %s)", symbol, year or "?", "IFRS" if is_ifrs else "SYSCOHADA")

        data = process_pdf(pdf_path)
        data["year"] = year
        data["source_file"] = pdf_path.name

        current = per_symbol.get(symbol)
        if current is None:
            per_symbol[symbol] = data
            continue

        cur_year = current.get("year") or 0
        new_year = year or 0
        if new_year > cur_year:
            # Exercice plus récent : on bascule entièrement (pas de mélange d'années).
            per_symbol[symbol] = data
        elif new_year == cur_year:
            # Même exercice : IFRS prioritaire, l'autre complète.
            if is_ifrs:
                per_symbol[symbol] = _merge(data, current)
            else:
                per_symbol[symbol] = _merge(current, data)
        else:
            # Exercice plus ancien : ne sert qu'à combler des trous.
            per_symbol[symbol] = _merge(current, data)

    # Écriture des JSON.
    for symbol, data in per_symbol.items():
        out_path = output_dir / f"{symbol}_fundamentals.json"
        try:
            with out_path.open("w", encoding="utf-8") as fh:
                json.dump(data, fh, indent=2, ensure_ascii=False)
            logger.info("✓ %s", out_path.name)
        except OSError as exc:
            logger.error("Écriture %s impossible : %s", out_path.name, exc)

    logger.info("Extraction terminée : %d action(s).", len(per_symbol))
    return per_symbol


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    extract_fundamentals_from_pdfs()


if __name__ == "__main__":
    main()
