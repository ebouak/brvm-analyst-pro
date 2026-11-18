"""Voix off des vidéos « étudiants » : une piste MP3 par scène ET l'instant de
chaque mot prononcé (WordBoundary d'edge-tts), pour des sous-titres mot à mot
calés sur la voix réelle — pas sur une estimation par la longueur du texte.

    python etudiants-tts.py <voix> <debit> <texte> <sortie.mp3> <sortie.json>

Le JSON est une liste de mots au format Caption de @remotion/captions
(text, startMs, endMs, timestampMs, confidence).
"""
import asyncio
import json
import sys

import edge_tts


async def principal(voix: str, debit: str, texte: str, mp3: str, sortie: str) -> None:
    com = edge_tts.Communicate(texte, voix, rate=debit, boundary="WordBoundary")
    mots = []
    with open(mp3, "wb") as f:
        async for bloc in com.stream():
            if bloc["type"] == "audio":
                f.write(bloc["data"])
            elif bloc["type"] == "WordBoundary":
                debut = bloc["offset"] / 10_000  # unités de 100 ns -> ms
                fin = (bloc["offset"] + bloc["duration"]) / 10_000
                mots.append({
                    "text": bloc["text"],
                    "startMs": round(debut),
                    "endMs": round(fin),
                    "timestampMs": round(debut),
                    "confidence": None,
                })
    if not mots:
        raise SystemExit(f"aucun mot horodaté pour {mp3}")
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump(aligner(texte, mots), f, ensure_ascii=False, indent=1)


def _norme(s: str) -> str:
    return "".join(c for c in s.lower() if c.isalnum())


def aligner(texte: str, mots: list) -> list:
    """Les sous-titres affichent le TEXTE ÉCRIT (ponctuation comprise), calé
    sur les instants des mots prononcés. Une ponctuation isolée (« : », « ? »
    précédés d'une espace insécable à la française) rejoint le mot d'avant."""
    jetons: list[str] = []
    for j in texte.split():
        if jetons and not _norme(j):
            jetons[-1] += " " + j
        else:
            jetons.append(j)
    sortie = []
    k = 0
    for j in jetons:
        cle = _norme(j)
        debut = fin = None
        reste = cle
        # Un jeton peut couvrir plusieurs mots prononcés (« d'argent » → « d' », « argent »).
        while k < len(mots) and reste:
            m = _norme(mots[k]["text"])
            if not m:
                k += 1
                continue
            if not reste.startswith(m):
                break
            debut = mots[k]["startMs"] if debut is None else debut
            fin = mots[k]["endMs"]
            reste = reste[len(m):]
            k += 1
        if debut is None:
            raise SystemExit(f"jeton non aligné : {j!r} (mot prononcé : {mots[k]['text'] if k < len(mots) else 'fin'!r})")
        sortie.append({"text": j, "startMs": debut, "endMs": fin, "timestampMs": debut, "confidence": None})
    if k != len(mots):
        raise SystemExit(f"{len(mots) - k} mot(s) prononcé(s) sans jeton écrit")
    return sortie


if __name__ == "__main__":
    asyncio.run(principal(*sys.argv[1:6]))
