"""
BRVM Scanner — application Streamlit d'analyse des 48 actions de la BRVM.

Lecture des données via la couche utils/ :
  - cours & backtest  : data/prices/{SYMBOLE}_backtest.csv
  - fondamentaux      : data/extracted/{SYMBOLE}_fundamentals.json
  - référentiel       : data/metadata/symbols.json

Lancement :  streamlit run app.py
"""
from __future__ import annotations

import logging

import pandas as pd
import streamlit as st

from utils import (
    get_available_symbols,
    load_price_data,
    load_fundamentals,
    get_symbol_info,
)

logging.basicConfig(level=logging.INFO)

st.set_page_config(
    page_title="BRVM Scanner",
    page_icon="📈",
    layout="wide",
)


# --- Helpers d'affichage ----------------------------------------------------
def _fmt_fcfa(value) -> str:
    """Formate un montant en FCFA (séparateur d'espace), ou '—' si absent."""
    if value is None:
        return "—"
    try:
        return f"{int(value):,}".replace(",", " ") + " FCFA"
    except (TypeError, ValueError):
        return str(value)


def render_price_section(symbol: str) -> None:
    """Affiche le graphique de cours + backtest et les métriques associées."""
    df = load_price_data(symbol)
    if df is None or df.empty:
        st.info("Aucun historique de cours disponible pour cette action.")
        return

    st.subheader("📈 Cours & backtest")

    # Métriques rapides à partir de la colonne Cours.
    if "Cours" in df.columns and df["Cours"].notna().any():
        cours = df["Cours"].dropna()
        last = float(cours.iloc[-1])
        first = float(cours.iloc[0])
        perf = (last / first - 1) * 100 if first else 0.0
        c1, c2, c3 = st.columns(3)
        c1.metric("Dernier cours", _fmt_fcfa(round(last)))
        c2.metric("Performance période", f"{perf:+.1f} %")
        c3.metric("Séances", f"{len(df)}")

    # Courbes : Cours + (si présentes) Stratégie vs Buy&Hold.
    x = "Date" if "Date" in df.columns else None
    cours_cols = [c for c in ["Cours"] if c in df.columns]
    bt_cols = [c for c in ["Stratégie", "Buy&Hold"] if c in df.columns]

    if cours_cols:
        st.line_chart(df, x=x, y=cours_cols, height=260)
    if bt_cols:
        st.caption("Backtest — Stratégie vs Buy & Hold (base normalisée)")
        st.line_chart(df, x=x, y=bt_cols, height=260)

    with st.expander("Voir les données brutes"):
        st.dataframe(df, use_container_width=True, hide_index=True)


def render_fundamentals_section(symbol: str) -> None:
    """Affiche les fondamentaux extraits, ou un message si indisponibles."""
    st.subheader("🧾 Fondamentaux")
    fund = load_fundamentals(symbol)

    if fund is None:
        st.warning("Données non disponibles.")
        st.caption(
            "Déposez les PDFs dans `data/financials/` puis lancez "
            "`python -m utils.extract_fundamentals`."
        )
        return

    year = fund.get("year")
    if year:
        st.caption(f"Exercice {year}")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Chiffre d'affaires", _fmt_fcfa(fund.get("revenue")))
    c2.metric("Résultat net", _fmt_fcfa(fund.get("net_income")))
    c3.metric("Capitaux propres", _fmt_fcfa(fund.get("equity")))
    c4.metric("Trésorerie", _fmt_fcfa(fund.get("cash")))

    # Indicateurs complémentaires si présents.
    extra = {k: fund.get(k) for k in ("debt", "bfr") if fund.get(k) is not None}
    if extra:
        d1, d2 = st.columns(2)
        if "debt" in extra:
            d1.metric("Dette financière", _fmt_fcfa(extra["debt"]))
        if "bfr" in extra:
            d2.metric("BFR", _fmt_fcfa(extra["bfr"]))

    # Ratios dérivés simples (si données suffisantes).
    rev, ni, eq = fund.get("revenue"), fund.get("net_income"), fund.get("equity")
    ratios: dict[str, str] = {}
    if rev and ni:
        ratios["Marge nette"] = f"{ni / rev * 100:.1f} %"
    if eq and ni:
        ratios["ROE"] = f"{ni / eq * 100:.1f} %"
    if ratios:
        st.caption("Ratios dérivés")
        st.table(pd.DataFrame([ratios]))


# --- Application ------------------------------------------------------------
def main() -> None:
    st.title("📊 BRVM Scanner")
    st.caption("Analyse des 48 actions de la Bourse Régionale des Valeurs Mobilières (UEMOA)")

    symbols = get_available_symbols()

    with st.sidebar:
        st.header("Sélection")
        if not symbols:
            st.warning(
                "Aucune action disponible.\n\n"
                "Ajoutez des fichiers `data/prices/{SYMBOLE}_backtest.csv`."
            )
            st.stop()
        symbol = st.selectbox("Action", symbols, format_func=lambda s: f"{s} — {get_symbol_info(s)['name']}")
        st.caption(f"{len(symbols)} action(s) disponible(s)")

    info = get_symbol_info(symbol)
    st.markdown(f"### {info['code']} — {info['name']}")
    meta_bits = [b for b in (info.get("sector"), info.get("country")) if b]
    if meta_bits:
        st.caption(" · ".join(meta_bits))

    render_price_section(symbol)
    st.divider()
    render_fundamentals_section(symbol)


if __name__ == "__main__":
    main()
