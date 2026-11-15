"""
Rendu HTML de l'hebdo matières premières — fonctions PURES.

Grammaire du dossier valeur A4 : panneaux numérotés, mesures encadrées,
tableaux à filets. Ce module n'écrit QUE des classes `wk-*` (styles dans
frontend/app/weekly/[slug]/weekly.css) ; aucun style en ligne, sauf la
position calculée d'un repère. Les balises et attributs employés sont tous
admis par `sanitizeReportHtml` (frontend/lib/sanitizeHtml.ts) : une balise
refusée y disparaîtrait en silence.
"""
from __future__ import annotations

import html as _html
import re
from urllib.parse import urlparse

import commodity_weekly_qualite as q

E = _html.escape

FORMAT = "feuille-v1"  # metadata.format : la page choisit son rendu sur cette valeur


def url_sure(url) -> str:
    """URL http(s) uniquement, sinon chaîne vide (jamais javascript:/data:)."""
    if not isinstance(url, str):
        return ""
    u = url.strip()
    return E(u, quote=True) if urlparse(u).scheme.lower() in ("http", "https") else ""


def ton(v: float | None) -> str:
    if v is None:
        return "wk-faible"
    return "wk-hausse" if v >= 0.5 else "wk-baisse" if v <= -0.5 else ""


def fleche(v: float) -> str:
    return "▲" if v >= 0.5 else "▼" if v <= -0.5 else "■"


def _prix(x: float) -> str:
    return q.fr(x, q.dec_prix(x))


# ── Briques ───────────────────────────────────────────────────────────────────

def niveau(cle: str) -> str:
    nom, legende = {
        "essentiel": ("Essentiel", "Pour tous : la semaine en trente secondes"),
        "investisseur": ("Investisseur", "Pour suivre la cote : l'analyse"),
        "pro": ("Pro", "Pour aller plus loin : méthode, corrélations, sources"),
    }[cle]
    return (f'<div class="wk-niveau wk-niveau--{cle}"><span class="wk-badge">{nom}</span>'
            f'<span>{legende}</span></div>')


def panneau(n: int, titre: str, corps: str, chapo: str = "") -> str:
    return (f'<div class="wk-panneau"><h2 class="wk-titre"><span class="wk-numero">{n:02d}</span>'
            f'{E(titre)}</h2>' + (f'<p class="wk-chapo">{E(chapo)}</p>' if chapo else "") + corps + "</div>")


def mesure(libelle: str, valeur: str, note: str = "", classe: str = "") -> str:
    return (f'<div class="wk-mesure"><dt>{E(libelle)}</dt>'
            f'<dd class="{classe}">{E(valeur)}</dd>' + (f"<dd>{E(note)}</dd>" if note else "") + "</div>")


def tableau(entetes: list[str], lignes: list[str]) -> str:
    th = "".join(f"<th>{E(h)}</th>" for h in entetes)
    return (f'<div class="wk-tableau-cadre"><table class="wk-tableau"><thead><tr>{th}</tr></thead>'
            f'<tbody>{"".join(lignes)}</tbody></table></div>')


# ── Illustration de tête (SVG maison, sans image distante) ────────────────────
# La photo Unsplash de l'ancien gabarit ne se chargeait pas (naturalWidth 0 en
# production) : une illustration dessinée ne dépend d'aucun tiers.

_FOND = '<rect x="0" y="0" width="640" height="200" fill="#e6f2f5"></rect><rect x="0" y="160" width="640" height="40" fill="#cfe3ea"></rect>'

_ILLUSTRATIONS = {
    "metaux": (
        "lingots d'or et d'argent",
        _FOND
        + '<g stroke="#12161c" stroke-width="2">'
        '<path d="M190 160 L212 118 H308 L330 160 Z" fill="#d9a93a"></path><path d="M212 118 L224 104 H320 L308 118 Z" fill="#f0cb6b"></path><path d="M308 118 L320 104 L342 146 L330 160 Z" fill="#b58322"></path>'
        '<path d="M320 160 L342 118 H438 L460 160 Z" fill="#c9ced3"></path><path d="M342 118 L354 104 H450 L438 118 Z" fill="#e8ecef"></path><path d="M438 118 L450 104 L472 146 L460 160 Z" fill="#9ba3aa"></path>'
        '<path d="M255 118 L277 76 H373 L395 118 Z" fill="#e2b544"></path><path d="M277 76 L289 62 H385 L373 76 Z" fill="#f6d987"></path><path d="M373 76 L385 62 L407 104 L395 118 Z" fill="#b58322"></path>'
        "</g>",
    ),
    "energie": (
        "un pétrolier chargé",
        _FOND
        + '<circle cx="520" cy="56" r="26" fill="#f0b23a"></circle>'
        '<path d="M150 150 H490 L466 178 H174 Z" fill="#0b6c84" stroke="#12161c" stroke-width="2"></path>'
        '<rect x="400" y="104" width="62" height="46" fill="#ffffff" stroke="#12161c" stroke-width="2"></rect>'
        '<rect x="414" y="114" width="34" height="8" fill="#12161c"></rect>'
        '<rect x="420" y="80" width="16" height="24" fill="#b91c1c" stroke="#12161c" stroke-width="2"></rect>'
        '<path d="M180 150 V132 H380 V150" fill="none" stroke="#12161c" stroke-width="3"></path>'
        '<path d="M230 132 V150 M280 132 V150 M330 132 V150" stroke="#12161c" stroke-width="3"></path>'
        '<path d="M0 186 Q40 180 80 186 T160 186 T240 186 T320 186 T400 186 T480 186 T560 186 T640 186" fill="none" stroke="#0b6c84" stroke-width="2"></path>',
    ),
    "agriculture": (
        "des cabosses de cacao sur leur branche",
        _FOND
        + '<path d="M110 52 Q320 18 530 56" fill="none" stroke="#7a5a3a" stroke-width="7" stroke-linecap="round"></path>'
        '<path d="M258 110 A28 48 0 1 0 314 110 A28 48 0 1 0 258 110 Z" fill="#e2a52e" stroke="#12161c" stroke-width="2"></path>'
        '<path d="M286 64 V156 M272 70 Q264 110 272 150 M300 70 Q308 110 300 150" fill="none" stroke="#8f6a14" stroke-width="2"></path>'
        '<path d="M344 112 A25 42 0 1 0 394 112 A25 42 0 1 0 344 112 Z" fill="#c4622e" stroke="#12161c" stroke-width="2"></path>'
        '<path d="M369 72 V152 M357 78 Q351 112 357 146 M381 78 Q387 112 381 146" fill="none" stroke="#7a3614" stroke-width="2"></path>'
        '<path d="M190 48 Q214 82 182 98 Q168 70 190 48 Z M450 44 Q482 66 458 94 Q436 72 450 44 Z" fill="#15803d"></path>',
    ),
}


def illustration(prices: list) -> str:
    if not prices:
        return ""
    top = max(prices, key=lambda p: abs(p.weekly_change_pct))
    famille = q.FAMILLE.get(top.ticker, "")
    cle = "metaux" if famille == "Métaux précieux" else "energie" if famille == "Énergie" else "agriculture"
    sujet, dessin = _ILLUSTRATIONS[cle]
    return (f'<figure class="wk-illustration"><svg viewBox="0 0 640 200" role="img" '
            f'aria-label="Illustration : {E(sujet)}">{dessin}</svg>'
            f"<figcaption>Illustration WESTBOURSE : {E(sujet)}. Le plus fort mouvement de la semaine "
            f"concerne {E(q.ARTICLE.get(top.label, top.label.lower()))}.</figcaption></figure>")


# ── Essentiel et bilan ────────────────────────────────────────────────────────

def essentiel(prices: list, fcfa: list[dict]) -> str:
    if not prices:
        return ""
    baisse = min(prices, key=lambda p: p.weekly_change_pct)
    hausse = max(prices, key=lambda p: p.weekly_change_pct)
    h = sum(1 for p in prices if p.weekly_change_pct >= 0.5)
    b = sum(1 for p in prices if p.weekly_change_pct <= -0.5)
    s = len(prices) - h - b
    cases = []
    if baisse.weekly_change_pct < 0:
        cases.append(mesure("Plus forte baisse", q.pct(baisse.weekly_change_pct),
                            f"{baisse.label} · {_prix(baisse.current)} {baisse.unit}", "wk-baisse"))
    if hausse.weekly_change_pct > 0:
        cases.append(mesure("Plus forte hausse", q.pct(hausse.weekly_change_pct),
                            f"{hausse.label} · {_prix(hausse.current)} {hausse.unit}", "wk-hausse"))
    brent = next((l for l in fcfa if l["ticker"] == "BZ=F"), None)
    if brent:
        cases.append(mesure("Brent en francs CFA", f"{q.fr(brent['prix_fcfa'], 0)} F",
                            f"par baril · {q.pct(brent['var_fcfa'])} sur la semaine", ton(brent["var_fcfa"])))
    cases.append(mesure("Sens du marché", f"{h} / {b} / {s}", "hausses / baisses / stables"))
    top = max(prices, key=lambda p: abs(p.weekly_change_pct))
    nom = q.ARTICLE.get(top.label, top.label.lower())
    phrases = [
        f"Le mouvement de la semaine : {nom} {'gagne' if top.weekly_change_pct > 0 else 'perd'} "
        f"{q.fr(abs(top.weekly_change_pct))} %, à {_prix(top.current)} {top.unit}.",
        "Une matière première qui bouge ne fait pas, à elle seule, bouger une action : "
        "le panneau « Valeurs BRVM exposées » dit par quel canal elle peut peser.",
    ]
    items = "".join(f"<li>{E(t)}</li>" for t in phrases)
    return (f'<dl class="wk-grille">{"".join(cases)}</dl><ul class="wk-liste">{items}</ul>')


def bilan(lignes: list[dict]) -> str:
    if not lignes:
        return ""
    items = "".join(
        f'<li class="{"wk-cede" if b["franchi"] else "wk-tient"}"><span><strong>'
        f'{"Seuil franchi." if b["franchi"] else "Seuil tenu."}</strong> {E(b["texte"])}</span></li>'
        for b in lignes)
    return (f'<div class="wk-encadre"><h3>Depuis la dernière édition : les seuils que nous surveillions</h3>'
            f'<ul class="wk-liste">{items}</ul></div>')


# ── Panneaux de l'analyse ─────────────────────────────────────────────────────

def graphique(prices: list) -> str:
    """Barres horizontales des variations, classées. Libellés à gauche, valeurs
    dans une colonne fixe à droite : une barre longue ne recouvre plus rien."""
    lignes = sorted(prices, key=lambda p: p.weekly_change_pct, reverse=True)
    if not lignes:
        return ""
    pas = 26
    haut = pas * len(lignes) + 24
    zero, demi = 360, 180
    maxi = max(abs(p.weekly_change_pct) for p in lignes) or 1
    rangs = []
    for i, p in enumerate(lignes):
        y = 14 + i * pas
        w = abs(p.weekly_change_pct) / maxi * demi
        x = zero if p.weekly_change_pct >= 0 else zero - w
        cls = "wk-g-hausse" if p.weekly_change_pct >= 0.5 else "wk-g-baisse" if p.weekly_change_pct <= -0.5 else "wk-g-neutre"
        rangs.append(
            f'<text class="wk-g-fin" x="160" y="{y + 8}">{E(q.court(p.label))}</text>'
            f'<rect class="{cls}" x="{x:.1f}" y="{y}" width="{max(w, 1.5):.1f}" height="16" rx="2"></rect>'
            f'<text class="wk-g-val wk-g-fin" x="636" y="{y + 8}">{E(q.pct(p.weekly_change_pct))}</text>')
    axe = f'<line x1="{zero}" y1="6" x2="{zero}" y2="{haut - 6}" stroke="#8b949e" stroke-width="1"></line>'
    return (f'<figure class="wk-figure"><svg viewBox="0 0 640 {haut}" role="img" '
            f'aria-label="Variations des matières premières sur cinq séances">{axe}{"".join(rangs)}</svg>'
            f"<figcaption>Variation sur cinq séances, de la clôture du vendredi précédent à celle de vendredi.</figcaption></figure>")


def tableau_de_bord(prices: list) -> str:
    lignes = []
    for p in prices:
        pos = q.position_pct(p)
        repere = (f'<span class="wk-position"><span style="left:{pos:.0f}%"></span></span>' if pos is not None else "")
        lignes.append(
            f"<tr><td><strong>{E(q.court(p.label))}</strong><span class=\"wk-code\">{E(p.ticker)}</span></td>"
            f'<td class="wk-num">{_prix(p.current)} <span class="wk-faible">{E(p.unit)}</span></td>'
            f'<td class="wk-num {ton(p.weekly_change_pct)}">{fleche(p.weekly_change_pct)} {q.pct(p.weekly_change_pct)}</td>'
            f'<td class="wk-num">{_prix(p.week_low)} – {_prix(p.week_high)}</td>'
            f'<td class="wk-num">{q.fr(q.amplitude_pct(p), 1)} %</td>'
            f"<td>{repere}</td></tr>")
    return (graphique(prices)
            + tableau(["Contrat", "Clôture", "Semaine", "Fourchette", "Amplitude", "Position"], lignes)
            + '<p class="wk-note">Position : place de la clôture dans la fourchette de la semaine, du plus bas '
              '(à gauche) au plus haut (à droite). Amplitude : écart entre plus haut et plus bas, rapporté à la clôture.</p>')


def analyse(editorial_html: str) -> str:
    """Texte vérifié : la <section> du rédacteur devient le conteneur des blocs."""
    corps = re.sub(r"^\s*<section[^>]*>", '<div class="wk-blocs">', editorial_html.strip())
    corps = re.sub(r"</section>\s*$", "</div>", corps)
    return ('<p class="wk-legende-preuve"><strong>Fait vérifié</strong> : chiffre de marché contrôlé. '
            '<strong>Lecture</strong> : explication donnée par une source nommée. '
            '<strong>Hypothèse</strong> : ce qui pourrait suivre, sans certitude.</p>' + corps)


def valeurs_exposees(lignes: list[dict]) -> str:
    rangs = []
    for l in lignes:
        mouv = " ; ".join(
            f"{m['matiere']} {q.pct(m['variation'])} ({m['base']})" if m["variation"] is not None
            else f"{m['matiere']} : cours indisponible" for m in l["mouvements"])
        rangs.append(
            f"<tr><td><strong>{E(l['nom'])}</strong><span class=\"wk-code\">{E(l['code'])}</span></td>"
            f'<td class="wk-texte">{E(mouv)}</td><td class="wk-texte">{E(l["canal"])}</td>'
            f'<td class="wk-texte">{E(l["lecture"])}</td></tr>')
    return (tableau(["Valeur", "Matière et mouvement", "Canal de transmission", "Lecture"], rangs)
            + '<p class="wk-note">Ce tableau décrit par où un cours peut atteindre les comptes d\'une société. '
              "Il ne note pas les titres et ne dit pas dans quel sens ils évolueront.</p>")


def prix_fcfa(fcfa: list[dict], eurusd: dict | None) -> str:
    if not fcfa or not eurusd:
        return ""
    rangs = [
        f"<tr><td><strong>{E(q.court(l['label']))}</strong></td>"
        f'<td class="wk-num">{q.fr(l["prix_fcfa"], 0 if l["prix_fcfa"] >= 100 else 2)} <span class="wk-faible">{E(l["unite"])}</span></td>'
        f'<td class="wk-num {ton(l["var_usd"])}">{q.pct(l["var_usd"])}</td>'
        f'<td class="wk-num {ton(l["var_fcfa"])}">{q.pct(l["var_fcfa"])}</td></tr>' for l in fcfa]
    taux = q.usd_xof(eurusd["actuel"])
    return (tableau(["Matière", "Prix", "En dollars", "En francs CFA"], rangs)
            + f'<p class="wk-note">1 dollar = {q.fr(taux, 1)} FCFA : parité fixe de 655,957 FCFA pour 1 euro, '
              f'euro à {q.fr(eurusd["actuel"], 4)} dollar. La variation en francs CFA ajoute l\'effet du change à celle du cours.</p>')


def scenarios(sc: list[dict], prices: list) -> str:
    brent = next((p for p in prices if p.ticker == "BZ=F"), None)
    if not sc or not brent:
        return ""
    rangs = [
        f"<tr><td><strong>Brent à {q.fr(s['niveau_usd'], 0)} USD</strong></td>"
        f'<td class="wk-num">{q.pct(s["ecart_pct"], 1)}</td>'
        f'<td class="wk-num">{q.fr(s["fcfa_baril"], 0)} F</td>'
        f'<td class="wk-num">{q.fr(s["fcfa_litre"], 1)} F</td></tr>' for s in sc]
    return (tableau(["Scénario", "Écart", "Baril", "Litre de brut"], rangs)
            + f'<p class="wk-note">Calcul à change constant depuis la clôture de {q.fr(brent.current)} USD. '
              "Ce ne sont pas des prévisions. Le litre de brut n'est pas le prix à la pompe, fixé par les États ; "
              "l'effet sur le résultat des distributeurs cotés n'est pas chiffré, leurs niveaux de stock n'étant pas publiés.</p>")


def seuils(lignes: list[dict]) -> str:
    if not lignes:
        return ""
    items = "".join(
        f"<li><span>{E(q.court(s['label']))} : {'plus bas' if s['type'] == 'bas' else 'plus haut'} de la semaine à "
        f"<strong>{q.fr(s['niveau'], 2)} {E(s['unite'])}</strong></span></li>" for s in lignes)
    return (f'<ul class="wk-liste">{items}</ul>'
            '<p class="wk-note">Le prochain numéro dira si chacun a tenu ou cédé.</p>')


def methode(controles: dict) -> str:
    points = [
        "Variations de clôture à clôture sur cinq séances, contrat à terme le plus proche (Yahoo Finance).",
        "Chaque chiffre du texte est comparé aux données avant publication ; un chiffre absent des données fait refuser le texte.",
        "Les explications reprennent des titres de presse datés et nommés ; ce ne sont pas des certitudes.",
        "Huile de palme et caoutchouc : moyennes mensuelles de la Banque mondiale, sans cotation hebdomadaire.",
    ]
    if controles.get("texte") == "squelette":
        points.append("Cette semaine, l'analyse rédigée n'a pas passé les contrôles : seuls les faits calculés sont publiés.")
    return '<ul class="wk-liste">' + "".join(f"<li><span>{E(t)}</span></li>" for t in points) + "</ul>"


def correlations(cs: list[dict]) -> str:
    rangs = []
    for c in cs:
        r = c.get("coefficient")
        valeur = "n/d" if not c.get("available") or r is None else q.fr(r, 2) if r < 0 else "+" + q.fr(r, 2)
        force = "" if r is None else "faible" if abs(r) < 0.4 else "modérée" if abs(r) < 0.7 else "forte"
        rangs.append(
            f"<tr><td><strong>{E(c['matiere'])}</strong></td><td class=\"wk-num\">{E(', '.join(c['codes']))}</td>"
            f'<td class="wk-num">{valeur}</td><td class="wk-texte">{E(force)}</td>'
            f'<td class="wk-num">{c.get("n_months", 0)} mois</td></tr>')
    if not rangs:
        return ""
    return (tableau(["Filière", "Valeurs", "Corrélation", "Intensité", "Période"], rangs)
            + '<p class="wk-note">Corrélation de Pearson entre les variations mensuelles du cours de la matière '
              "(Banque mondiale) et du cours moyen des actions (BRVM). Une corrélation faible ne permet pas de "
              "déduire un cours d'action d'un mouvement de matière première.</p>")


def sources(items: list[dict]) -> str:
    lignes = []
    for it in items:
        u = url_sure(it.get("url", ""))
        titre = E(str(it.get("titre", "")))
        date = E(str(it.get("date", "")))
        lignes.append(f'<li><a href="{u}" target="_blank" rel="noopener noreferrer">{titre}</a> — {date}</li>'
                      if u else f"<li>{titre} — {date}</li>")
    return f'<ol class="wk-sources">{"".join(lignes)}</ol>' if lignes else ""


def avertissement(year: int) -> str:
    return ('<div class="wk-pied"><p><strong>Avertissement.</strong> Document d\'information produit par '
            "WESTBOURSE. Il ne constitue ni un conseil en investissement ni une sollicitation d'achat ou de vente. "
            "Les performances passées ne préjugent pas des performances futures.</p>"
            "<p><strong>Sources des données.</strong> Contrats à terme : Yahoo Finance (COMEX, NYMEX, ICE). "
            "Cours mensuels : Banque mondiale (Pink Sheet). Actions : BRVM.</p>"
            f"<p>© {year} WESTBOURSE.</p></div>")


# ── Assemblage ────────────────────────────────────────────────────────────────

ORDRE = {
    "note": ["bord", "analyse", "valeurs", "fcfa", "scenarios", "seuils"],
    "briefing": ["bord", "fcfa", "valeurs", "analyse", "seuils", "scenarios"],
    "dossier": ["analyse", "bord", "valeurs", "scenarios", "fcfa", "seuils"],
}
TITRES = {
    "bord": ("Tableau de bord de la semaine", "Huit contrats à terme de référence, clôtures du vendredi."),
    "analyse": ("Analyse par matière", ""),
    "valeurs": ("Valeurs BRVM exposées", ""),
    "fcfa": ("Les mêmes prix en francs CFA", ""),
    "scenarios": ("Scénarios : et si le Brent bougeait de 10 % ?", ""),
    "seuils": ("Seuils à surveiller la semaine prochaine", ""),
}


def assembler(editorial_html: str, prices: list, ctx: dict) -> str:
    edition = ctx.get("edition", "note")
    blocs = {
        "bord": tableau_de_bord(prices),
        "analyse": analyse(editorial_html),
        "valeurs": valeurs_exposees(ctx.get("expositions") or []),
        "fcfa": prix_fcfa(ctx.get("fcfa") or [], ctx.get("eurusd")),
        "scenarios": scenarios(ctx.get("scenarios") or [], prices),
        "seuils": seuils(ctx.get("seuils") or []),
    }
    n = 0
    investisseur = []
    for cle in ORDRE[edition]:
        if not blocs[cle]:
            continue
        n += 1
        titre, chapo = TITRES[cle]
        investisseur.append(panneau(n, titre, blocs[cle], chapo))
    pro = []
    for titre, corps in (("Méthode et limites", methode(ctx.get("controles") or {})),
                         ("Corrélations historiques", correlations(ctx.get("correlations") or [])),
                         ("Sources consultées", sources(ctx.get("sources") or []))):
        if corps:
            n += 1
            pro.append(panneau(n, titre, corps))
    return "\n".join([
        illustration(prices),
        niveau("essentiel"),
        essentiel(prices, ctx.get("fcfa") or []),
        bilan(ctx.get("bilan") or []),
        niveau("investisseur"),
        *investisseur,
        niveau("pro"),
        *pro,
        avertissement(ctx["year"]),
    ])


def page_autonome(contenu: str, titre: str, chapeau: str, signature: str, css: str) -> str:
    """Fichier HTML autonome (frontend/public/weekly/) : même feuille, même CSS que le site."""
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{E(titre)}</title>
<meta name="description" content="{E(chapeau, quote=True)}">
<meta property="og:title" content="{E(titre, quote=True)}">
<meta property="og:type" content="article">
<style>
:root {{ --font-sans: 'Helvetica Neue', Arial; --font-display: Georgia; --font-mono: ui-monospace; }}
body {{ margin: 0; }}
{css}
</style>
</head>
<body>
<div class="wk">
<article class="wk-feuille">
<div class="wk-courant"><span class="wk-marque">WESTBOURSE</span><span>Hebdo matières premières</span></div>
<header class="wk-entete">
<h1 class="wk-h1">{E(titre)}</h1>
<p class="wk-chapeau">{E(chapeau)}</p>
<p class="wk-signature">{E(signature)}</p>
</header>
{contenu}
</article>
</div>
</body>
</html>
"""
