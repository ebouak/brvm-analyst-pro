# Synthèse de la voix off (edge-tts) avec l'horodatage de chaque mot.
#   python voix.py            -> video/out/lecon0-carte/voix/<id>.mp3 + <id>.json
# Le JSON donne, pour chaque mot prononcé, son début et sa fin en secondes
# depuis le début du segment : l'animation se cale sur ces instants.
import asyncio
import json
import pathlib

import edge_tts

ICI = pathlib.Path(__file__).resolve().parent
OUT = ICI.parent / "out" / "lecon0-carte" / "voix"
OUT.mkdir(parents=True, exist_ok=True)


async def segment(voix: str, debit: str, seg: dict) -> None:
    com = edge_tts.Communicate(seg["texte"], voix, rate=debit, boundary="WordBoundary")
    mots = []
    with open(OUT / f"{seg['id']}.mp3", "wb") as f:
        async for c in com.stream():
            if c["type"] == "audio":
                f.write(c["data"])
            elif c["type"] == "WordBoundary":
                debut = c["offset"] / 1e7
                mots.append({"m": c["text"], "a": round(debut, 3), "b": round(debut + c["duration"] / 1e7, 3)})
    (OUT / f"{seg['id']}.json").write_text(json.dumps(mots, ensure_ascii=False), encoding="utf-8")
    print(seg["id"], len(mots), "mots, fin", mots[-1]["b"] if mots else None)


async def main() -> None:
    conf = json.loads((ICI / "voix.json").read_text(encoding="utf-8"))
    for seg in conf["segments"]:
        await segment(conf["voixTts"], conf.get("debit", "+0%"), seg)


asyncio.run(main())
