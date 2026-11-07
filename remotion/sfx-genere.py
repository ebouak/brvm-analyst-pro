"""Bruitages de la vidéo de séance (modèle verre et version 16:9 du site).

Synthétisés, donc libres de droits et reproductibles : relancer ce script
réécrit les mêmes fichiers dans public/sfx/. Volume volontairement bas : ils
passent SOUS la voix, jamais devant.

    python sfx-genere.py   (numpy requis)
"""
import wave
from pathlib import Path
import numpy as np

SR = 44100
OUT = Path(__file__).parent / "public" / "sfx"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


def bruit_filtre(n, largeur):
    k = np.exp(-np.linspace(-3, 3, largeur) ** 2)
    return np.convolve(rng.standard_normal(n), k / k.sum(), "same")


def ecrire(nom, s, gain=0.9):
    s = s / max(1e-9, np.abs(s).max()) * gain
    fade = min(len(s), int(0.01 * SR))
    s[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(str(OUT / f"{nom}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((s * 32767).astype(np.int16).tobytes())


def t(d):
    return np.arange(int(d * SR)) / SR


# Souffle de transition : bruit adouci, montée puis descente.
x = t(0.9); env = np.sin(np.pi * x / 0.9) ** 2
ecrire("souffle", bruit_filtre(len(x), 60) * env, 0.8)

# Flèche qui file vers le haut : bruit + glissando ascendant.
x = t(0.55); f = 500 + 2600 * (x / 0.55) ** 1.4
s = 0.6 * bruit_filtre(len(x), 25) + 0.25 * np.sin(2 * np.pi * np.cumsum(f) / SR)
ecrire("fleche", s * np.sin(np.pi * x / 0.55) ** 2, 0.8)

# Pose d'un panneau de verre : petit choc cristallin.
x = t(0.5)
s = sum(a * np.sin(2 * np.pi * fr * x) * np.exp(-x * d) for a, fr, d in [(1, 1760, 14), (0.5, 2640, 18), (0.3, 3520, 24)])
s += 0.4 * bruit_filtre(len(x), 4) * np.exp(-x * 60)
ecrire("verre", s, 0.7)

# Tic discret pour l'arrivée d'une ligne.
x = t(0.08)
ecrire("tic", np.sin(2 * np.pi * 2200 * x) * np.exp(-x * 90) + 0.3 * rng.standard_normal(len(x)) * np.exp(-x * 160), 0.6)

# Impact sourd sous un grand chiffre.
x = t(0.6); f = 55 + 70 * np.exp(-x * 18)
ecrire("impact", np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 7) + 0.15 * bruit_filtre(len(x), 8) * np.exp(-x * 30), 0.9)

# Reflet qui balaie un texte : scintillement aigu.
x = t(0.7); env = np.sin(np.pi * x / 0.7) ** 2
s = sum(np.sin(2 * np.pi * fr * x + p) for fr, p in [(3951, 0), (4699, 1), (5274, 2)]) * (0.5 + 0.5 * np.sin(2 * np.pi * 18 * x))
ecrire("scintille", s * env, 0.45)

# Montée d'ouverture.
x = t(1.4); f = 180 + 420 * (x / 1.4) ** 2
s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5 + bruit_filtre(len(x), 40) * 0.5
ecrire("montee", s * (x / 1.4) ** 2 * np.exp(-np.maximum(0, x - 1.3) * 40), 0.7)

# Carillon de la signature (logo).
x = t(1.8)
s = sum(np.sin(2 * np.pi * 440 * 2 ** (o / 12) * x) * np.exp(-x * (2.5 + i)) for i, o in enumerate([12, 19, 24, 28]))
ecrire("carillon", s, 0.75)
print("ok", sorted(p.name for p in OUT.iterdir()))
