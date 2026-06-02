#!/usr/bin/env python3
"""
Génère automatiquement les CSV de cours + backtest pour les actions BRVM,
à partir de Supabase (brvm_actions_daily). Plus besoin de déposer les CSV à la
main : `python -m utils.fetch_prices`.

Sortie : data/prices/{SYMBOLE}_backtest.csv  (Date, Stratégie, Buy&Hold, Cours)

Stratégie répliquée du module de backtest du frontend :
  - signal : variation > 2% → BUY, < -2% → SELL, sinon HOLD ;
  - long-only, equity base 100 ; Buy&Hold = cours / cours_initial × 100.
"""
from __future__ import annotations

import csv
import logging
from pathlib import Path

from .supabase_client import fetch

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
PRICES_DIR = BASE_DIR / "data" / "prices"


def load_symbols() -> list[str]:
    """Liste les codes d'actions actives depuis brvm_instruments."""
    rows = fetch(
        "brvm_instruments",
        {"select": "code", "type": "eq.action", "actif": "eq.true", "order": "code.asc"},
    )
    return [r["code"] for r in rows]


def fetch_prices_for(symbol: str) -> list[tuple[str, float]]:
    """Retourne [(date_marche, cours_jour)] trié, cours non nuls, pour un code."""
    rows = fetch(
        "brvm_actions_daily",
        {
            "select": "date_marche,cours_jour",
            "code": f"eq.{symbol}",
            "cours_jour": "not.is.null",
            "order": "date_marche.asc",
        },
    )
    return [(r["date_marche"], float(r["cours_jour"])) for r in rows if r.get("cours_jour") is not None]


def compute_backtest(closes: list[float]) -> tuple[list[float], list[float]]:
    """
    Calcule les courbes Stratégie et Buy&Hold (base 100), alignées sur `closes`.
    Réplique exactement la logique du frontend (entrée/sortie puis mark-to-market).
    """
    n = len(closes)
    if n == 0:
        return [], []
    base = closes[0] or 1.0
    equity = 100.0
    in_position = False
    strat: list[float] = []
    bh: list[float] = []
    for i, c in enumerate(closes):
        # Signal du jour (variation vs veille).
        if i > 0 and closes[i - 1]:
            var = (c - closes[i - 1]) / closes[i - 1] * 100
            signal = "BUY" if var > 2 else ("SELL" if var < -2 else "HOLD")
        else:
            signal = "HOLD"
        # Entrée / sortie.
        if not in_position and signal == "BUY":
            in_position = True
        elif in_position and signal == "SELL":
            in_position = False
        # Mark-to-market si en position.
        if in_position and i > 0 and closes[i - 1]:
            equity *= 1 + (c - closes[i - 1]) / closes[i - 1]
        strat.append(round(equity, 2))
        bh.append(round(c / base * 100, 2))
    return strat, bh


def write_csv(symbol: str, series: list[tuple[str, float]]) -> bool:
    """Écrit data/prices/{symbol}_backtest.csv. Retourne False si pas de données."""
    if len(series) < 2:
        logger.info("%s : historique insuffisant (%d pts) — ignoré", symbol, len(series))
        return False
    dates = [d for d, _ in series]
    closes = [c for _, c in series]
    strat, bh = compute_backtest(closes)

    PRICES_DIR.mkdir(parents=True, exist_ok=True)
    out = PRICES_DIR / f"{symbol}_backtest.csv"
    with out.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["Date", "Stratégie", "Buy&Hold", "Cours"])
        for d, s, b, c in zip(dates, strat, bh, closes):
            w.writerow([d, s, b, c])
    logger.info("✓ %s (%d séances)", out.name, len(series))
    return True


def fetch_all_prices(symbols: list[str] | None = None) -> int:
    """
    Génère les CSV pour tous les symboles (ou la liste fournie).
    Returns: nombre de fichiers écrits.
    """
    syms = symbols or load_symbols()
    written = 0
    for sym in syms:
        try:
            series = fetch_prices_for(sym)
            if write_csv(sym, series):
                written += 1
        except Exception as exc:  # une action en erreur n'arrête pas le lot
            logger.error("%s : échec récupération cours (%s)", sym, exc)
    logger.info("Cours synchronisés : %d/%d actions.", written, len(syms))
    return written


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    fetch_all_prices()


if __name__ == "__main__":
    main()
