# Synthèse voix off de prévisualisation (edge-tts, fr-FR-HenriNeural) avec
# horodatage WordBoundary mot à mot, compatible 100 % avec render.mjs.
#   python video/capsule-module/voix-edge.py n1-m1
import asyncio
import json
import pathlib
import re
import sys

import edge_tts

if len(sys.argv) < 2:
    print("Usage : python video/capsule-module/voix-edge.py <id> [--voix fr-FR-HenriNeural]")
    sys.exit(1)

cap_id = sys.argv[1]
voix = "fr-FR-HenriNeural"
if "--voix" in sys.argv:
    idx = sys.argv.index("--voix")
    if idx + 1 < len(sys.argv):
        voix = sys.argv[idx + 1]

ICI = pathlib.Path(__file__).resolve().parent
PLAN_PATH = ICI / "capsules" / f"{cap_id}.json"
if not PLAN_PATH.exists():
    print(f"Storyboard introuvable : {PLAN_PATH}")
    sys.exit(1)

# Marqueurs {auteur.*} résolus depuis auteur.json (local, hors dépôt). Même règle
# que auteur.mjs (render.mjs, voix-capsule.mjs) : à corriger des deux côtés.
brut = PLAN_PATH.read_text(encoding="utf-8")
if re.search(r"\{auteur\.[A-Za-z]+\}", brut):
    AUTEUR_PATH = ICI / "auteur.json"
    if not AUTEUR_PATH.exists():
        print(f"Identité de l'auteur absente : {AUTEUR_PATH} (fichier local, hors dépôt).")
        sys.exit(1)
    auteur = json.loads(AUTEUR_PATH.read_text(encoding="utf-8"))

    def remplacer(m: re.Match) -> str:
        valeur = auteur.get(m.group(1))
        if not isinstance(valeur, str) or not valeur.strip():
            print(f"auteur.json : champ « {m.group(1)} » manquant.")
            sys.exit(1)
        return json.dumps(valeur, ensure_ascii=False)[1:-1]

    brut = re.sub(r"\{auteur\.([A-Za-z]+)\}", remplacer, brut)
plan = json.loads(brut)
OUT = ICI.parent / "out" / "capsule-module" / cap_id / "voix-edge"
OUT.mkdir(parents=True, exist_ok=True)

segments = (
    [{"id": "hook", "texte": plan["hook"]["voix"]}]
    + [{"id": e["id"], "texte": e["voix"]} for e in plan["etapes"]]
    + [{"id": "fin", "texte": plan["fin"]["voix"]}]
)


async def synth(seg: dict) -> None:
    com = edge_tts.Communicate(seg["texte"], voix, rate="+4%", boundary="WordBoundary")
    mots = []
    mp3 = OUT / f"{seg['id']}.mp3"
    with open(mp3, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                a = chunk["offset"] / 1e7
                b = (chunk["offset"] + chunk["duration"]) / 1e7
                mots.append({"m": chunk["text"], "a": round(a, 3), "b": round(b, 3)})
    if not mots:
        mots = [{"m": "...", "a": 0.05, "b": 1.5}]
    (OUT / f"{seg['id']}.json").write_text(json.dumps(mots, ensure_ascii=False), encoding="utf-8")
    print(f"  {seg['id']:12s} {len(mots):3d} mots · fin {mots[-1]['b']:.2f}s")


async def main() -> None:
    print(f"Capsule {cap_id} · voix prévisualisation {voix}")
    for seg in segments:
        await synth(seg)
    (OUT / "ordre.json").write_text(
        json.dumps([s["id"] for s in segments], ensure_ascii=False), encoding="utf-8"
    )
    print(f"Voix prête → {OUT}")


asyncio.run(main())
