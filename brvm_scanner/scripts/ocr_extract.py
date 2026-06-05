#!/usr/bin/env python3
"""
OCR des PDF scannés (sans couche texte) → output/texts/{SYMBOLE}_{ANNEE}.txt.

Complète extract_texts.py : ce dernier ignore les PDF scannés (texte vide) ;
ce script les rattrape via Tesseract OCR (rendu page→image puis reconnaissance).

Pré-requis (binaires, hors pip) :
  - Tesseract OCR  (UB-Mannheim) avec les langues fra+eng
  - poppler        (pour pdf2image : pdftoppm)
Sur Windows (PowerShell admin) :  choco install tesseract poppler -y

Libs pip :  pip install pytesseract pdf2image pillow

Usage :
  python scripts/ocr_extract.py                 # tous les PDF scannés
  python scripts/ocr_extract.py BOABF CFAC      # seulement ces symboles
  python scripts/ocr_extract.py --force         # ré-OCR même si un texte existe
"""
from __future__ import annotations

import os
import re
import sys
import shutil
from pathlib import Path

PDF_DIR = Path("data/financials")
OUT_DIR = Path("output/texts")
MAX_CHARS = 45000
OCR_LANG = "fra+eng"           # états financiers BRVM = français
DPI = 300                       # 300 dpi : bon compromis qualité/temps pour des tableaux
MIN_TEXT_LAYER = 200            # en-dessous → considéré comme scanné

# Emplacements habituels de Tesseract sur Windows (si pas dans le PATH).
_TESS_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
]


def _locate_tesseract() -> str | None:
    found = shutil.which("tesseract")
    if found:
        return found
    for c in _TESS_CANDIDATES:
        if Path(c).is_file():
            return c
    return None


def _ensure_deps():
    """Vérifie pytesseract + PyMuPDF (rendu PDF→image sans poppler) + Tesseract."""
    try:
        import pytesseract  # noqa: F401
        import fitz  # PyMuPDF  # noqa: F401
    except ImportError as e:
        sys.exit(f"Lib manquante : {e}. Lancez : pip install pytesseract pymupdf pillow")

    import pytesseract
    tess = _locate_tesseract()
    if not tess:
        sys.exit(
            "Tesseract introuvable. Installez-le (PowerShell admin) :\n"
            "  choco install tesseract -y\n"
            "ou https://github.com/UB-Mannheim/tesseract/wiki"
        )
    pytesseract.pytesseract.tesseract_cmd = tess

    # tessdata local (français) si présent — évite l'install admin de fra.traineddata.
    local_tessdata = Path(__file__).resolve().parent.parent / "tessdata"
    if (local_tessdata / "fra.traineddata").is_file():
        os.environ["TESSDATA_PREFIX"] = str(local_tessdata)
    return pytesseract


def _ocr_lang(pytesseract) -> str:
    """Renvoie 'fra+eng' si le français est disponible, sinon 'eng'."""
    try:
        langs = pytesseract.get_languages(config="")
        if "fra" in langs:
            return "fra+eng"
    except Exception:
        pass
    return "eng"


def symbol_year(p: Path) -> tuple[str, str]:
    stem = p.stem
    sym = stem.split("_")[0].upper()
    m = re.search(r"(20\d{2})", stem)
    return sym, (m.group(1) if m else "unknown")


def has_text_layer(pdf: Path) -> bool:
    """True si le PDF a déjà une couche texte exploitable (pas besoin d'OCR)."""
    try:
        import pdfplumber
        with pdfplumber.open(pdf) as doc:
            txt = "".join((pg.extract_text() or "") for pg in doc.pages[:4])
        return len(txt.strip()) >= MIN_TEXT_LAYER
    except Exception:
        return False


def ocr_pdf(pdf: Path, pytesseract, lang: str) -> str:
    """Rend chaque page en image (PyMuPDF, sans poppler) et OCRise."""
    import fitz  # PyMuPDF
    from PIL import Image
    import io as _io

    doc = fitz.open(str(pdf))
    zoom = DPI / 72.0  # 72 dpi = base PDF ; zoom pour atteindre DPI cible
    mat = fitz.Matrix(zoom, zoom)
    parts: list[str] = []
    for page in doc[:20]:  # tables financières en début de document
        pix = page.get_pixmap(matrix=mat)
        img = Image.open(_io.BytesIO(pix.tobytes("png")))
        parts.append(pytesseract.image_to_string(img, lang=lang))
        if sum(len(p) for p in parts) > MAX_CHARS:
            break
    doc.close()
    return "\n".join(parts)[:MAX_CHARS]


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    pytesseract = _ensure_deps()
    lang = _ocr_lang(pytesseract)
    print(f"Langue OCR : {lang}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if args:
        wanted = {a.upper() for a in args}
        pdfs = [p for p in pdfs if symbol_year(p)[0] in wanted]

    done = 0
    for pdf in pdfs:
        sym, yr = symbol_year(pdf)
        out = OUT_DIR / f"{sym}_{yr}.txt"
        if out.exists() and not force:
            print(f"  = {out.name} existe déjà (utiliser --force pour ré-OCR)")
            continue
        if has_text_layer(pdf):
            print(f"  · {pdf.name} a déjà du texte (extract_texts.py suffit) — ignoré")
            continue
        print(f"  OCR {pdf.name} ...", flush=True)
        try:
            text = ocr_pdf(pdf, pytesseract, lang)
        except Exception as exc:
            print(f"    ! échec OCR : {exc}")
            continue
        if len(text.strip()) < MIN_TEXT_LAYER:
            print(f"    ! OCR pauvre ({len(text.strip())} car.) — qualité scan insuffisante")
            continue
        out.write_text(text, encoding="utf-8")
        print(f"    -> {out.name} ({len(text)} car.)")
        done += 1

    print(f"\n{done} PDF OCRisé(s) dans {OUT_DIR}/")
    if done:
        print("Étape suivante : relancer l'extraction LLM des fondamentaux sur ces textes.")


if __name__ == "__main__":
    main()
