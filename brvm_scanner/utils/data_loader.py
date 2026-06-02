"""
Couche de chargement des données pour BRVM Scanner.

Organisation des données (cf. README) :
    data/prices/{SYMBOLE}_backtest.csv     historique de cours + backtest
    data/financials/{SYMBOLE}_{ANNEE}_{NORME}.pdf   états financiers bruts
    data/extracted/{SYMBOLE}_fundamentals.json      indicateurs extraits
    data/metadata/symbols.json             référentiel des 48 actions

Règle de nommage : le SYMBOLE (code BRVM 4 lettres) est toujours la première
partie du nom de fichier, avant le premier underscore.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

# --- Résolution des chemins (robuste, indépendante du cwd) ------------------
# data_loader.py est dans brvm_scanner/utils/ → la racine est deux niveaux au-dessus.
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PRICES_DIR = DATA_DIR / "prices"
FINANCIALS_DIR = DATA_DIR / "financials"
EXTRACTED_DIR = DATA_DIR / "extracted"
METADATA_DIR = DATA_DIR / "metadata"
SYMBOLS_FILE = METADATA_DIR / "symbols.json"

PRICE_SUFFIX = "_backtest.csv"
FUNDAMENTALS_SUFFIX = "_fundamentals.json"


def _symbol_from_filename(path: Path) -> str:
    """Extrait le symbole : première partie du nom avant le premier underscore."""
    return path.stem.split("_")[0].upper()


def get_available_symbols() -> list[str]:
    """
    Liste les symboles disponibles en lisant les CSV de cours dans data/prices/.

    Returns:
        Liste triée des codes BRVM pour lesquels un fichier
        {SYMBOLE}_backtest.csv existe. Liste vide si le dossier est absent.
    """
    if not PRICES_DIR.is_dir():
        logger.warning("Dossier des cours introuvable : %s", PRICES_DIR)
        return []

    symbols: set[str] = set()
    for csv_path in PRICES_DIR.glob(f"*{PRICE_SUFFIX}"):
        symbols.add(_symbol_from_filename(csv_path))
    return sorted(symbols)


def load_price_data(symbol: str) -> Optional[pd.DataFrame]:
    """
    Charge le CSV d'historique de cours d'une action.

    Colonnes attendues : Date, Stratégie, Buy&Hold, Cours.
    La colonne Date est convertie en datetime quand c'est possible.

    Args:
        symbol: code BRVM (ex. "ABJC").

    Returns:
        DataFrame trié par date, ou None si le fichier est absent / illisible.
    """
    symbol = symbol.strip().upper()
    path = PRICES_DIR / f"{symbol}{PRICE_SUFFIX}"
    if not path.is_file():
        logger.info("Aucun fichier de cours pour %s (%s)", symbol, path.name)
        return None

    try:
        df = pd.read_csv(path)
    except Exception as exc:  # CSV corrompu / vide → on n'interrompt pas l'app
        logger.error("Lecture du CSV %s impossible : %s", path.name, exc)
        return None

    if "Date" in df.columns:
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce", dayfirst=True)
        df = df.sort_values("Date").reset_index(drop=True)
    return df


def load_fundamentals(symbol: str) -> Optional[dict]:
    """
    Charge les fondamentaux extraits depuis data/extracted/{SYMBOLE}_fundamentals.json.

    Args:
        symbol: code BRVM.

    Returns:
        Dict des indicateurs (revenue, net_income, equity, cash, year, ...),
        ou None si le JSON n'existe pas ou est illisible.
    """
    symbol = symbol.strip().upper()
    path = EXTRACTED_DIR / f"{symbol}{FUNDAMENTALS_SUFFIX}"
    if not path.is_file():
        return None

    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("JSON fondamentaux %s illisible : %s", path.name, exc)
        return None


def load_symbols_metadata() -> dict[str, dict]:
    """
    Charge le référentiel des actions depuis data/metadata/symbols.json.

    Returns:
        Dict {code: {name, sector, country, shares, ...}}. Dict vide si absent.
    """
    if not SYMBOLS_FILE.is_file():
        logger.warning("Référentiel symbols.json introuvable : %s", SYMBOLS_FILE)
        return {}
    try:
        with SYMBOLS_FILE.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("symbols.json illisible : %s", exc)
        return {}


def get_symbol_info(symbol: str) -> dict:
    """
    Renvoie les métadonnées d'une action (nom complet, secteur, pays…).

    Toujours un dict exploitable : si le symbole est inconnu, le champ `name`
    reprend le code et les autres champs valent None.
    """
    symbol = symbol.strip().upper()
    meta = load_symbols_metadata().get(symbol)
    if meta:
        return {"code": symbol, **meta}
    return {"code": symbol, "name": symbol, "sector": None, "country": None, "shares": None}
