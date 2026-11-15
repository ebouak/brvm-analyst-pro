"""
Qualité éditoriale de l'hebdo matières premières — fonctions PURES, sans réseau.

Ce module porte tout ce qui rend l'article vérifiable :
  - le référentiel des valeurs exposées, validé contre la cote réelle ;
  - le format français des nombres ;
  - le choix de l'édition (note, briefing, dossier) et le titre ;
  - les blocs calculés : francs CFA, scénarios, seuils, bilan de la semaine passée ;
  - les verrous de publication, dont la liste blanche des chiffres.

Règle héritée de l'hebdo des valeurs (scraper/src/hebdo/polish.ts) : aucun
chemin ne publie un texte de LLM non vérifié. Si un verrou échoue, l'article
sort avec le squelette déterministe de ce module.
"""
from __future__ import annotations

import html as _html
import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent
PARITE_EUR_XOF = 655.957  # parité fixe du franc CFA (UEMOA) avec l'euro


# ── Référentiel ───────────────────────────────────────────────────────────────

def charger_referentiel(chemin: Path | None = None) -> set[str]:
    """Codes réellement cotés, lus dans le registre du frontend (jamais saisis ici)."""
    chemin = chemin or RACINE / "frontend" / "lib" / "brvmSectors.json"
    return set(json.loads(chemin.read_text(encoding="utf-8")).keys())


NOMS = {
    "SHEC": "Vivo Energy CI",
    "TTLC": "TotalEnergies Marketing CI",
    "TTLS": "TotalEnergies Marketing Sénégal",
    "SMBC": "SMB CI",
    "SCRC": "Sucrivoire",
    "PALC": "Palm CI",
    "SPHC": "SAPH",
    "SOGC": "SOGB",
}

# Canal par lequel le cours de la matière atteint les comptes de la société.
# ⚠️ À VALIDER PAR L'ANALYSTE : ces mécanismes sont des éléments d'analyse
# (prix à la pompe administrés, marché du sucre encadré), pas des données.
EXPOSITIONS: dict[str, list[dict]] = {
    "petrole": [
        {"code": "SHEC", "canal": "Stocks et trésorerie ; prix à la pompe administrés"},
        {"code": "TTLC", "canal": "Stocks et trésorerie ; prix à la pompe administrés"},
        {"code": "TTLS", "canal": "Stocks et trésorerie ; prix à la pompe administrés"},
        {"code": "SMBC", "canal": "Le brut est la matière première du bitume"},
    ],
    "sucre": [{"code": "SCRC", "canal": "Prix de vente domestique encadré ; cours mondial en référence indirecte"}],
    "huile_palme": [
        {"code": "PALC", "canal": "Prix de vente de l'huile brute"},
        {"code": "SOGC", "canal": "Prix de vente de l'huile brute et du caoutchouc"},
    ],
    "caoutchouc": [
        {"code": "SPHC", "canal": "Prix de vente du caoutchouc naturel"},
        {"code": "SOGC", "canal": "Prix de vente du caoutchouc et de l'huile brute"},
    ],
}

MATIERE_PAR_SYMBOLE = {"CL=F": "petrole", "BZ=F": "petrole", "SB=F": "sucre"}
MATIERE_PAR_WB = {"CRUDE_OIL": "petrole", "PALM_OIL": "huile_palme", "RUBBER_TSR20": "caoutchouc"}
LIBELLE_MATIERE = {"petrole": "Pétrole", "sucre": "Sucre", "huile_palme": "Huile de palme", "caoutchouc": "Caoutchouc"}


def codes_exposes(matiere: str | None, referentiel: set[str]) -> list[str]:
    """Codes exposés à une matière, limités à ceux qui existent à la cote."""
    return [e["code"] for e in EXPOSITIONS.get(matiere or "", []) if e["code"] in referentiel]


def codes_inconnus(referentiel: set[str]) -> list[str]:
    """Codes du registre d'exposition absents de la cote : doit rester vide."""
    return sorted({e["code"] for lst in EXPOSITIONS.values() for e in lst} - referentiel)


# ── Nombres en français ───────────────────────────────────────────────────────

def fr(x: float, dec: int = 2) -> str:
    """3884.1 -> « 3 884,10 » (espace insécable fine, virgule, vrai signe moins)."""
    s = f"{abs(x):,.{dec}f}".replace(",", " ").replace(".", ",")
    return ("−" if x < 0 else "") + s


def pct(x: float, dec: int = 2) -> str:
    signe = "+" if x > 0 else ("−" if x < 0 else "")
    return f"{signe}{fr(abs(x), dec)} %"


def dec_prix(x: float) -> int:
    return 0 if abs(x) >= 1000 and float(x).is_integer() else 2


def amplitude_pct(p) -> float:
    return (p.week_high - p.week_low) / p.current * 100 if p.current else 0.0


def position_pct(p) -> float | None:
    """Place de la clôture dans la fourchette (0 = plus bas, 100 = plus haut)."""
    etendue = p.week_high - p.week_low
    if etendue <= 0:
        return None
    return max(0.0, min(100.0, (p.current - p.week_low) / etendue * 100))


def cours_coherent(prix: float, bas: float, haut: float) -> bool:
    """Une clôture hors de sa propre fourchette trahit une donnée fautive."""
    return prix > 0 and bas > 0 and bas <= haut and bas * 0.999 <= prix <= haut * 1.001


def fenetre_hebdo(closes: list[float], lows: list[float], highs: list[float], n: int = 5) -> dict | None:
    """
    Variation sur n séances : dernière clôture contre celle d'il y a n séances,
    fourchette sur les n dernières séances. Indépendant du jour d'exécution.

    L'ancien calcul prenait la première clôture d'une fenêtre de 7 jours
    calendaires : lancé un samedi ou un dimanche, il ne couvrait que 4 séances
    (lundi → vendredi) et oubliait le mouvement du lundi. Mesuré le 15/11/2026 :
    Brent +3,5 % au lieu de −2,09 %.
    """
    if len(closes) < n + 1 or len(lows) < n or len(highs) < n:
        return None
    ref, dernier = closes[-(n + 1)], closes[-1]
    if not ref or ref <= 0:
        return None
    return {"prix": dernier, "reference": ref, "variation_pct": (dernier - ref) / ref * 100,
            "bas": min(lows[-n:]), "haut": max(highs[-n:]), "n_seances": n}


# ── Édition et titre ──────────────────────────────────────────────────────────

ARTICLE = {
    "Cacao": "le cacao", "Pétrole WTI": "le WTI", "Pétrole Brent": "le Brent",
    "Café": "le café", "Sucre": "le sucre", "Coton": "le coton", "Or": "l'or", "Argent": "l'argent",
}
NOM_EDITION = {"note": "Note d'analyste", "briefing": "Briefing", "dossier": "Dossier de la semaine"}


def choisir_edition(prices: list) -> str:
    """dossier : un marché domine nettement ; briefing : semaine calme ; note sinon."""
    v = sorted((abs(p.weekly_change_pct) for p in prices), reverse=True)
    if not v:
        return "note"
    second = v[1] if len(v) > 1 else 0.0
    if v[0] >= 5 and v[0] >= 1.5 * second:
        return "dossier"
    if v[0] < 2:
        return "briefing"
    return "note"


def _verbe(v: float) -> str:
    return "gagne" if v > 0 else "recule de"


def titre_article(prices: list, week: int, year: int) -> str:
    """Titre factuel : le plus fort mouvement, puis le plus fort en sens inverse."""
    base = f"Matières premières S{week:02d}/{year}"
    if not prices:
        return base
    top = max(prices, key=lambda p: abs(p.weekly_change_pct))
    if abs(top.weekly_change_pct) < 0.5:
        return f"{base} : une semaine sans mouvement marqué"
    nom = ARTICLE.get(top.label, top.label.lower())
    t = f"{base} : {nom} {_verbe(top.weekly_change_pct)} {fr(abs(top.weekly_change_pct))} %"
    inverses = [p for p in prices if p.weekly_change_pct * top.weekly_change_pct < 0 and abs(p.weekly_change_pct) >= 0.5]
    if inverses:
        o = max(inverses, key=lambda p: abs(p.weekly_change_pct))
        t += f", {ARTICLE.get(o.label, o.label.lower())} {_verbe(o.weekly_change_pct)} {fr(abs(o.weekly_change_pct))} %"
    return t


# ── Francs CFA ────────────────────────────────────────────────────────────────

def usd_xof(eurusd: float) -> float:
    return PARITE_EUR_XOF / eurusd


_CONV = {  # unité de cotation -> (diviseur vers l'unité locale, libellé)
    "USD/bbl": (1.0, "FCFA/baril"),
    "USD/oz": (31.1034768, "FCFA/gramme"),
    "USD/t": (1000.0, "FCFA/kg"),
    "USc/lb": (100 * 0.45359237, "FCFA/kg"),
}


def conversions_fcfa(prices: list, eurusd: dict | None) -> list[dict]:
    """Prix et variation hebdomadaire vus en francs CFA. Vide sans taux de change."""
    if not eurusd or not eurusd.get("actuel") or not eurusd.get("debut"):
        return []
    taux, taux_debut = usd_xof(eurusd["actuel"]), usd_xof(eurusd["debut"])
    lignes = []
    for p in prices:
        conv = _CONV.get(p.unit)
        if not conv:
            continue
        diviseur, unite = conv
        prix = p.current * taux / diviseur
        var = ((1 + p.weekly_change_pct / 100) * (taux / taux_debut) - 1) * 100
        lignes.append({"label": p.label, "ticker": p.ticker, "prix_fcfa": round(prix, 0 if prix >= 100 else 2),
                       "unite": unite, "var_usd": p.weekly_change_pct, "var_fcfa": round(var, 2)})
    return lignes


def scenarios_brent(prices: list, eurusd: dict | None) -> list[dict]:
    """Deux niveaux à ±10 % de la clôture (arrondis à 5 USD), traduits en FCFA."""
    brent = next((p for p in prices if p.ticker == "BZ=F"), None)
    if not brent or not eurusd or not eurusd.get("actuel"):
        return []
    taux = usd_xof(eurusd["actuel"])
    out = []
    for coef in (0.9, 1.1):
        niveau = round(brent.current * coef / 5) * 5
        if niveau <= 0 or niveau == round(brent.current):
            continue
        out.append({"niveau_usd": float(niveau), "fcfa_baril": round(niveau * taux),
                    "fcfa_litre": round(niveau * taux / 158.987, 1),
                    "ecart_pct": round((niveau / brent.current - 1) * 100, 1)})
    return out


# ── Seuils et bilan de la semaine précédente ──────────────────────────────────

def seuils_a_surveiller(prices: list, n: int = 3) -> list[dict]:
    """Pour les n plus forts mouvements : le plus bas (baisse) ou le plus haut (hausse)."""
    out = []
    for p in sorted(prices, key=lambda p: abs(p.weekly_change_pct), reverse=True)[:n]:
        if abs(p.weekly_change_pct) < 1:
            continue
        bas = p.weekly_change_pct < 0
        out.append({"ticker": p.ticker, "label": p.label, "unite": p.unit,
                    "type": "bas" if bas else "haut", "niveau": p.week_low if bas else p.week_high})
    return out


def seuils_depuis_metadata(meta: dict | None) -> list[dict]:
    """Seuils publiés la semaine passée ; reconstruits des cours si le champ manque."""
    if not meta:
        return []
    if meta.get("seuils"):
        return meta["seuils"]
    out = []
    yf = meta.get("yf_prices") or {}
    classes = sorted(yf.items(), key=lambda kv: abs(kv[1].get("variation_5j_pct", 0)), reverse=True)[:3]
    for sym, d in classes:
        v = d.get("variation_5j_pct", 0)
        if abs(v) < 1 or "week_low" not in d or "week_high" not in d:
            continue
        out.append({"ticker": sym, "label": d.get("nom", sym), "unite": d.get("unite", ""),
                    "type": "bas" if v < 0 else "haut", "niveau": d["week_low"] if v < 0 else d["week_high"]})
    return out


def bilan_semaine_precedente(seuils_prec: list[dict], prices: list) -> list[dict]:
    """Chaque seuil publié la semaine passée : a-t-il été franchi ? Fait, pas opinion."""
    courant = {p.ticker: p for p in prices}
    out = []
    for s in seuils_prec:
        p = courant.get(s["ticker"])
        if not p:
            continue
        niveau = float(s["niveau"])
        d = 2
        if s["type"] == "bas":
            franchi = p.week_low < niveau
            extreme = p.week_low
            texte = (f"{s['label']} : le plus bas de {fr(niveau, d)} {s['unite']} "
                     + (f"a été enfoncé (nouveau plus bas : {fr(extreme, d)})." if franchi
                        else f"a tenu (plus bas de la semaine : {fr(extreme, d)})."))
        else:
            franchi = p.week_high > niveau
            extreme = p.week_high
            texte = (f"{s['label']} : le plus haut de {fr(niveau, d)} {s['unite']} "
                     + (f"a été dépassé (nouveau plus haut : {fr(extreme, d)})." if franchi
                        else f"n'a pas été dépassé (plus haut de la semaine : {fr(extreme, d)})."))
        out.append({"ticker": s["ticker"], "franchi": franchi, "texte": texte})
    return out


# ── Liste blanche des chiffres ────────────────────────────────────────────────

_RE_BALISE = re.compile(r"<[^>]*>")
_RE_NOMBRE = re.compile(r"(?<![\w=.,])(\d{1,3}(?:[   ]\d{3})+|\d+)(?:[.,](\d+))?(?![\w=])")


def texte_visible(html_txt: str) -> str:
    return _html.unescape(_RE_BALISE.sub(" ", html_txt or ""))


def extraire_nombres(texte: str) -> list[float]:
    out = []
    for m in _RE_NOMBRE.finditer(texte):
        entier = re.sub(r"[   ]", "", m.group(1))
        out.append(float(f"{entier}.{m.group(2)}" if m.group(2) else entier))
    return out


def nombres_autorises(prices: list, *, correlations=None, fcfa=None, scenarios=None,
                      titres=None, week: int = 0, year: int = 0) -> set[float]:
    """Tout nombre que le texte a le droit de contenir : les données, rien d'autre."""
    a: set[float] = {100.0, float(week), float(week + 1), float(year)}
    for p in prices:
        a.update({abs(p.current), abs(p.weekly_change_pct), p.week_low, p.week_high,
                  round(amplitude_pct(p), 1), round(p.week_high - p.week_low, 2)})
        pos = position_pct(p)
        if pos is not None:
            a.add(round(pos))
    for c in correlations or []:
        if c.get("coefficient") is not None:
            r = abs(c["coefficient"])
            a.update({round(r, 2), round(r * r * 100), float(c.get("n_months", 0))})
    for l in fcfa or []:
        a.update({l["prix_fcfa"], abs(l["var_fcfa"])})
    for s in scenarios or []:
        a.update({s["niveau_usd"], float(s["fcfa_baril"]), s["fcfa_litre"], abs(s["ecart_pct"])})
    for t in titres or []:
        a.update(extraire_nombres(t))
    return a


def chiffres_etrangers(html_txt: str, autorises: set[float]) -> list[float]:
    """Nombres du texte absents des données. Petits entiers et années tolérés."""
    etrangers = []
    for v in extraire_nombres(texte_visible(html_txt)):
        if v.is_integer() and (v <= 31 or 1990 <= v <= 2100):  # quantièmes, années
            continue
        if any(abs(v - x) <= 0.0051 or v == round(x, 1) or v == round(x) for x in autorises):
            continue
        etrangers.append(v)
    return etrangers


# ── Nettoyage et verrous ──────────────────────────────────────────────────────

_RE_EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿️⬀-⯿➡]")
_RE_DECIMALE = re.compile(r"(?<=\d)\.(?=\d)")


def nettoyer(html_txt: str) -> str:
    """Retire les émojis et met les décimales à la française, hors balises."""
    morceaux = re.split(r"(<[^>]*>)", html_txt or "")
    for i, m in enumerate(morceaux):
        if not m.startswith("<"):
            morceaux[i] = _RE_DECIMALE.sub(",", _RE_EMOJI.sub("", m))
    return "".join(morceaux)


_SIGLES = {"BRVM", "OPEP", "UEMOA", "BCEAO", "COMEX", "NYMEX", "FCFA", "ICE"}
_RE_CONSEIL = re.compile(
    r"recommand|à l['’]achat|\bachetez|\bvendez|surpond|sous-?pond|\brenforcer\b|\balléger\b|objectif de cours|opportunité d['’]achat",
    re.I)
_RE_SCORE = re.compile(r"notation|meilleurs? scores?|note maximale|score maximal", re.I)
_RE_SANS_CAUSE = re.compile(r"non couvert|aucune cause", re.I)
PREUVES = ("Fait vérifié.", "Lecture.", "Hypothèse.")


def verrous(editorial_html: str, prices: list, referentiel: set[str], autorises: set[float]) -> list[str]:
    """Raisons de refuser le texte du LLM. Liste vide = publiable."""
    raisons: list[str] = []
    txt = (editorial_html or "").strip()
    visible = texte_visible(txt)
    if not txt.endswith("</section>"):
        raisons.append("texte tronqué : la section n'est pas refermée")
    for balise in ("div", "p", "h3", "ul"):
        if len(re.findall(rf"<{balise}[\s>]", txt)) != txt.count(f"</{balise}>"):
            raisons.append(f"balises <{balise}> non équilibrées")
    manquantes = [p.label for p in prices if p.label not in visible]
    if manquantes:
        raisons.append("matières absentes : " + ", ".join(manquantes))
    if any(visible.count(etq) < 1 for etq in PREUVES[:2]):
        raisons.append("niveaux de preuve absents (Fait vérifié / Lecture)")
    inconnus = sorted({c for c in re.findall(r"\(([A-Z]{4,5})\)", visible)
                       if c not in referentiel and c not in _SIGLES})
    if inconnus:
        raisons.append("codes absents de la cote : " + ", ".join(inconnus))
    if _RE_CONSEIL.search(visible):
        raisons.append("formulation de conseil en investissement")
    if _RE_SCORE.search(visible):
        raisons.append("score d'exposition présenté comme une note")
    if len(_RE_SANS_CAUSE.findall(visible)) > 2:
        raisons.append("« aucune cause identifiée » répété plus de deux fois")
    etrangers = chiffres_etrangers(txt, autorises)
    if etrangers:
        raisons.append("chiffres absents des données : " + ", ".join(fr(v, 2) for v in etrangers[:8]))
    return raisons


# ── Squelette déterministe (repli si le texte du LLM est refusé) ──────────────

FAMILLE = {"CC=F": "Agriculture", "KC=F": "Agriculture", "SB=F": "Agriculture", "CT=F": "Agriculture",
           "CL=F": "Énergie", "BZ=F": "Énergie", "GC=F": "Métaux précieux", "SI=F": "Métaux précieux"}


def phrase_fait(p) -> str:
    d = dec_prix(p.current)
    sens = "progresse de" if p.weekly_change_pct > 0 else "recule de"
    s = (f"{p.label} : {fr(p.current, d)} {p.unit}. Le contrat {sens} "
         f"{fr(abs(p.weekly_change_pct))} % sur la semaine, dans une fourchette de "
         f"{fr(p.week_low, d)} à {fr(p.week_high, d)}.")
    pos = position_pct(p)
    if pos is not None and (pos <= 15 or pos >= 85):
        s += " Il clôture " + ("près de son plus bas." if pos <= 15 else "près de son plus haut.")
    return s


def phrase_transmission(p, referentiel: set[str]) -> str:
    codes = codes_exposes(MATIERE_PAR_SYMBOLE.get(p.ticker), referentiel)
    if not codes:
        return "Aucune société cotée à la BRVM n'est exposée directement à cette matière."
    return "Valeurs exposées : " + ", ".join(f"{NOMS.get(c, c)} ({c})" for c in codes) + "."


def squelette_editorial(prices: list, referentiel: set[str]) -> str:
    blocs = []
    for p in prices:
        blocs.append(
            '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:18px 20px;margin-bottom:16px;">'
            f'<p style="font-size:11px;color:#64748b;font-weight:600;margin:0 0 6px 0;">{FAMILLE.get(p.ticker, "")}</p>'
            f'<p style="margin:0 0 8px 0;font-size:14px;color:#334155;"><strong style="color:#0f172a;">Fait vérifié.</strong> {_html.escape(phrase_fait(p))}</p>'
            f'<p style="margin:0;font-size:14px;color:#334155;"><strong style="color:#0f172a;">Transmission à la BRVM.</strong> {_html.escape(phrase_transmission(p, referentiel))}</p>'
            '</div>')
    return ('<section style="font-family:\'Segoe UI\',system-ui,sans-serif;color:#1e293b;line-height:1.75;">'
            + "".join(blocs) + "</section>")
