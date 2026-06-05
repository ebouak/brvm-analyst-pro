#!/usr/bin/env python3
"""
Extrait le texte de chaque PDF d'états financiers vers output/texts/{SYMBOLE}_{ANNEE}.txt.
Claude Code lit ensuite ces textes pour extraire les fondamentaux (analyse LLM
contextuelle : unités millions/milliers, narratif vs tableau, part groupe).

Usage :
    python scripts/extract_texts.py            # tous les PDF
    python scripts/extract_texts.py 2025       # filtre par année
"""
import sys
import re
from pathlib import Path

import pdfplumber

PDF_DIR = Path("data/financials")
OUT_DIR = Path("output/texts")
MAX_CHARS = 45000  # garde-fou taille


def symbol_year(p: Path) -> tuple[str, str]:
    stem = p.stem
    symbol = stem.split("_")[0].upper()
    m = re.search(r"(20\d{2})", stem)
    return symbol, (m.group(1) if m else "unknown")


def main() -> None:
    year_filter = sys.argv[1] if len(sys.argv) > 1 else None
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if year_filter:
        pdfs = [p for p in pdfs if year_filter in p.stem]
    if not pdfs:
        print("Aucun PDF trouvé.")
        return

    done = 0
    for pdf in pdfs:
        sym, yr = symbol_year(pdf)
        try:
            with pdfplumber.open(pdf) as doc:
                text = "\n".join((pg.extract_text() or "") for pg in doc.pages)
        except Exception as exc:  # PDF corrompu : on log et on continue
            print(f"  ! {pdf.name} illisible : {exc}")
            continue
        if len(text.strip()) < 200:
            print(f"  ! {pdf.name} : texte vide (PDF scanné ?) — ignoré")
            continue
        if len(text) > MAX_CHARS:
            text = text[:MAX_CHARS] + "\n... (tronqué)"
        out = OUT_DIR / f"{sym}_{yr}.txt"
        out.write_text(text, encoding="utf-8")
        print(f"  OK {pdf.name} -> {out.name} ({len(text)} car.)")
        done += 1

    print(f"\n{done} texte(s) extrait(s) dans {OUT_DIR}/")


if __name__ == "__main__":
    main()
