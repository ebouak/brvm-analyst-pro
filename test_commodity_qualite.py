"""Tests purs de l'hebdo matières premières, sur les chiffres réels de la S46/2026."""
from dataclasses import dataclass

import commodity_weekly_qualite as q


@dataclass
class P:
    label: str
    ticker: str
    current: float
    unit: str
    weekly_change_pct: float
    week_low: float
    week_high: float


S46 = [
    P("Argent", "SI=F", 48.67, "USD/oz", -6.05, 48.40, 53.21),
    P("Or", "GC=F", 3884.10, "USD/oz", -4.68, 3856.70, 4157.70),
    P("Cacao", "CC=F", 5267.0, "USD/t", 2.17, 4640.0, 5330.0),
    P("Café", "KC=F", 274.0, "USc/lb", -2.14, 266.70, 282.50),
    P("Pétrole Brent", "BZ=F", 96.27, "USD/bbl", -2.09, 89.15, 100.92),
    P("Pétrole WTI", "CL=F", 89.10, "USD/bbl", -1.90, 83.88, 92.53),
    P("Sucre", "SB=F", 18.40, "USc/lb", 0.9, 17.92, 18.60),
    P("Coton", "CT=F", 79.02, "USc/lb", -0.1, 77.98, 79.90),
]
REF = q.charger_referentiel()
EURUSD = {"actuel": 1.10, "debut": 1.10}


def test_registre_d_exposition_ne_cite_que_des_codes_cotes():
    assert q.codes_inconnus(REF) == []


def test_les_codes_fautifs_de_la_s46_ne_sont_pas_a_la_cote():
    # SVOC, SIFCA, SAPH, SOGB, SUCR figuraient dans l'article publié.
    for faux in ("SVOC", "SIFCA", "SAPH", "SOGB", "SUCR"):
        assert faux not in REF


def test_petrole_pointe_vers_les_distributeurs_reels():
    assert q.codes_exposes("petrole", REF) == ["SHEC", "TTLC", "TTLS", "SMBC"]
    assert q.codes_exposes("cacao", REF) == []


def test_un_code_absent_de_la_cote_est_ecarte():
    assert q.codes_exposes("petrole", {"TTLC"}) == ["TTLC"]


def test_format_francais():
    assert q.fr(3884.1) == "3 884,10"
    assert q.pct(-6.05) == "−6,05 %"
    assert q.pct(2.17) == "+2,17 %"


def test_position_et_amplitude():
    argent, brent = S46[0], S46[4]
    assert round(q.position_pct(argent)) == 6
    assert round(q.amplitude_pct(brent), 1) == 12.2


def test_cours_hors_fourchette_refuse():
    assert q.cours_coherent(96.27, 89.15, 100.92)
    assert not q.cours_coherent(120.0, 89.15, 100.92)
    assert not q.cours_coherent(0, 0, 0)


def test_edition():
    assert q.choisir_edition(S46) == "note"  # argent 6,05 contre or 4,68 : pas de domination nette
    calme = [P("Or", "GC=F", 100, "USD/oz", 0.4, 99, 101), P("Sucre", "SB=F", 18, "USc/lb", -1.1, 17, 19)]
    assert q.choisir_edition(calme) == "briefing"
    domine = [P("Or", "GC=F", 100, "USD/oz", -7.0, 99, 108), P("Sucre", "SB=F", 18, "USc/lb", 1.0, 17, 19)]
    assert q.choisir_edition(domine) == "dossier"


def test_titre_factuel_sans_nom_de_marque():
    t = q.titre_article(S46, 46, 2026)
    assert t == "Matières premières S46/2026 : l'argent recule de 6,05 %, le cacao gagne 2,17 %"
    assert "WestBourse" not in t


def test_conversion_fcfa():
    lignes = {l["ticker"]: l for l in q.conversions_fcfa(S46, EURUSD)}
    taux = 655.957 / 1.10
    assert lignes["BZ=F"]["prix_fcfa"] == round(96.27 * taux)
    assert lignes["BZ=F"]["unite"] == "FCFA/baril"
    assert lignes["CC=F"]["prix_fcfa"] == round(5267 * taux / 1000)
    assert lignes["BZ=F"]["var_fcfa"] == -2.09  # change inchangé : même variation
    assert q.conversions_fcfa(S46, None) == []


def test_variation_fcfa_tient_compte_du_change():
    # L'euro recule de 2 % face au dollar : le dollar vaut plus de francs CFA.
    l = {x["ticker"]: x for x in q.conversions_fcfa(S46, {"actuel": 1.078, "debut": 1.10})}
    assert l["BZ=F"]["var_fcfa"] > -2.09


def test_scenarios_brent():
    s = q.scenarios_brent(S46, EURUSD)
    assert [x["niveau_usd"] for x in s] == [85.0, 105.0]
    assert s[0]["ecart_pct"] == -11.7
    assert q.scenarios_brent(S46, None) == []


def test_seuils_et_bilan():
    seuils = q.seuils_a_surveiller(S46)
    assert [(s["ticker"], s["type"], s["niveau"]) for s in seuils] == [
        ("SI=F", "bas", 48.40), ("GC=F", "bas", 3856.70), ("CC=F", "haut", 5330.0)]
    suivante = [
        P("Argent", "SI=F", 47.0, "USD/oz", -3.4, 46.5, 49.0),      # plus bas enfoncé
        P("Or", "GC=F", 3950.0, "USD/oz", 1.7, 3870.0, 3990.0),     # plus bas tenu
        P("Cacao", "CC=F", 5200.0, "USD/t", -1.3, 5100.0, 5300.0),  # plus haut non dépassé
    ]
    bilan = q.bilan_semaine_precedente(seuils, suivante)
    assert [b["franchi"] for b in bilan] == [True, False, False]
    assert "a été enfoncé" in bilan[0]["texte"] and "a tenu" in bilan[1]["texte"]


def test_seuils_reconstruits_d_une_ancienne_metadata():
    meta = {"yf_prices": {"GC=F": {"nom": "Or", "unite": "USD/oz", "variation_5j_pct": -4.68,
                                   "week_low": 3856.7, "week_high": 4157.7}}}
    assert q.seuils_depuis_metadata(meta)[0]["niveau"] == 3856.7
    assert q.seuils_depuis_metadata(None) == []


def _texte_valide():
    return q.squelette_editorial(S46, REF).replace(
        "<p><strong>Transmission à la BRVM.</strong>",
        "<p><strong>Lecture.</strong> Selon la presse.</p><p><strong>Transmission à la BRVM.</strong>")


def test_un_texte_fonde_sur_les_donnees_passe():
    autorises = q.nombres_autorises(S46, week=46, year=2026)
    assert q.verrous(_texte_valide(), S46, REF, autorises) == []


def test_chiffre_invente_refuse():
    autorises = q.nombres_autorises(S46, week=46, year=2026)
    faux = _texte_valide().replace("</section>", "<p>Berenberg vise 75 dollars.</p></section>")
    assert any("chiffres absents" in r for r in q.verrous(faux, S46, REF, autorises))
    # Le même chiffre devient légitime s'il figure dans un titre de presse fourni.
    avec_source = q.nombres_autorises(S46, week=46, year=2026, titres=["Berenberg table sur 75 dollars"])
    assert q.verrous(faux, S46, REF, avec_source) == []


def test_code_absent_de_la_cote_refuse():
    autorises = q.nombres_autorises(S46, week=46, year=2026)
    faux = _texte_valide().replace("</section>", "<p>Vivo Energy CI (SVOC) domine.</p></section>")
    assert any("SVOC" in r for r in q.verrous(faux, S46, REF, autorises))


def test_texte_tronque_refuse():
    autorises = q.nombres_autorises(S46, week=46, year=2026)
    tronque = _texte_valide()[:-40]
    assert any("tronqué" in r for r in q.verrous(tronque, S46, REF, autorises))


def test_conseil_et_score_mal_lu_refuses():
    autorises = q.nombres_autorises(S46, week=46, year=2026)
    conseil = _texte_valide().replace("</section>", "<p>Recommandation : renforcer les pétrolières.</p></section>")
    assert any("conseil" in r for r in q.verrous(conseil, S46, REF, autorises))
    score = _texte_valide().replace("</section>", "<p>TTLC affiche une notation technique maximale.</p></section>")
    assert any("score" in r for r in q.verrous(score, S46, REF, autorises))


def test_nettoyage():
    brut = '<p style="line-height:1.75">Argent : 48.67 USD/oz 📉</p>'
    assert q.nettoyer(brut) == '<p>Argent : 48,67 USD/oz </p>'


def test_squelette_publiable_sauf_niveau_lecture():
    # Le repli ne contient que des faits : il ne doit porter aucun chiffre étranger.
    autorises = q.nombres_autorises(S46, week=46, year=2026)
    assert q.chiffres_etrangers(q.squelette_editorial(S46, REF), autorises) == []


# ── Assemblage et rédaction sous verrous (générateur) ─────────────────────────

import commodity_weekly_generator as g


def _prix():
    return [g.CommodityPrice(p.label, p.ticker, p.current, p.unit, p.weekly_change_pct, p.week_low, p.week_high) for p in S46]


def _ctx(edition="note", controles=None):
    prices = _prix()
    fcfa = q.conversions_fcfa(prices, EURUSD)
    return {"edition": edition, "fcfa": fcfa, "eurusd": EURUSD, "scenarios": q.scenarios_brent(prices, EURUSD),
            "seuils": q.seuils_a_surveiller(prices), "bilan": [], "wb_snapshot": {}, "correlations": [],
            "perplexity_items": [], "controles": controles or {"texte": "llm"}, "year": 2026, "week": 46}


def test_le_generateur_ne_connait_plus_les_codes_fautifs():
    for meta in list(g.YFINANCE_TICKERS.values()) + list(g.WB_COMMODITIES.values()) + list(g._FILIERES_CORR.values()):
        for code in meta.get("brvm", meta.get("codes", [])):
            assert code in REF
    assert g.YFINANCE_TICKERS["BZ=F"]["brvm"] == ["SHEC", "TTLC", "TTLS", "SMBC"]
    assert "Cacao" not in g._FILIERES_CORR


def test_article_assemble_trois_niveaux_sans_residu():
    html = g.assemble_content_html(q.squelette_editorial(_prix(), REF), _prix(), _ctx())
    for attendu in ("Essentiel", "Investisseur", "Pro", "Valeurs BRVM exposées", "francs CFA",
                    "Scénarios", "Seuils à surveiller", "Vivo Energy CI", "SHEC"):
        assert attendu in html
    visible = q.texte_visible(html)
    for interdit in ("SVOC", "SIFCA", "yfinance", "Recommandation", "Score exposition", "48.67", "| WestBourse"):
        assert interdit not in visible
    assert html.count("<div") == html.count("</div>")


def test_les_editions_ordonnent_les_blocs_differemment():
    sq = q.squelette_editorial(_prix(), REF)
    note = g.assemble_content_html(sq, _prix(), _ctx("note"))
    dossier = g.assemble_content_html(sq, _prix(), _ctx("dossier"))
    assert note.index("Analyse par matière") > note.index("wk-figure")
    assert dossier.index("Analyse par matière") < dossier.index("wk-figure")


def test_un_texte_refuse_deux_fois_cede_la_place_au_squelette():
    prices = _prix()
    autorises = q.nombres_autorises(prices, week=46, year=2026)
    appels = []

    def llm_fautif(prompt):
        appels.append(prompt)
        return "<section><p>Vivo Energy CI (SVOC) : notation maximale, objectif 75 dollars.</p></section>"

    texte, controles = g.rediger_editorial(lambda refus: "REFUS:" + "|".join(refus), prices, autorises, appel=llm_fautif)
    assert controles["texte"] == "squelette" and len(appels) == 2
    assert "SVOC" in appels[1]            # le second essai reçoit les raisons du refus
    assert "SVOC" not in texte            # et rien de fautif n'est publié


def test_le_prompt_ne_donne_que_des_chiffres_autorises():
    prices = _prix()
    fcfa = q.conversions_fcfa(prices, EURUSD)
    prompt = g.build_editorial_prompt(prices, {}, [], [], week=46, year=2026, edition="note", fcfa=fcfa)
    donnees = prompt[prompt.index("DONNÉES"):prompt.index("TITRES DE PRESSE")]
    autorises = q.nombres_autorises(prices, fcfa=fcfa, week=46, year=2026)
    assert q.chiffres_etrangers(donnees, autorises) == []
    assert "SVOC" not in prompt and "Recommandation WestBourse" not in prompt


def test_fenetre_hebdo_independante_du_jour_d_execution():
    # Vendredi précédent 98,33 ; lundi 92,60 ; ... ; vendredi 96,27.
    closes = [97.0, 98.33, 92.60, 93.5, 94.1, 95.0, 96.27]
    lows = [96.0, 97.5, 89.15, 92.0, 93.0, 94.0, 95.1]
    highs = [98.0, 99.0, 100.92, 94.5, 95.0, 96.0, 97.0]
    f = q.fenetre_hebdo(closes, lows, highs)
    assert abs(f["variation_pct"] - (-2.095)) < 0.01  # vendredi contre vendredi, pas lundi contre vendredi
    assert (f["bas"], f["haut"], f["n_seances"]) == (89.15, 100.92, 5)
    assert f["reference"] == 98.33


def test_fenetre_hebdo_refuse_un_historique_trop_court():
    assert q.fenetre_hebdo([1, 2, 3, 4, 5], [1] * 5, [5] * 5) is None
    assert q.fenetre_hebdo([0, 2, 3, 4, 5, 6], [1] * 6, [7] * 6) is None


def test_nettoyage_forme_de_presse():
    brut = "<p>Le Pétrole Brent cède −2,52 % ; l'Or baisse de -4,63 % et le Sucre gagne +0,93 %.</p>"
    assert q.nettoyer(brut) == "<p>Le Brent cède 2,52 % ; l'or baisse de 4,63 % et le sucre gagne 0,93 %.</p>"


def test_une_matiere_nommee_en_minuscules_est_reconnue():
    autorises = q.nombres_autorises(S46, week=46, year=2026)
    texte = q.nettoyer(_texte_valide())  # « Pétrole Brent » devient « Brent »
    assert "Pétrole Brent" not in q.texte_visible(texte)
    assert q.verrous(texte, S46, REF, autorises) == []


def test_presse_rangee_par_matiere():
    items = [{"titre": "Le Brent tombe sous 94 dollars", "source_label": "Sika"},
             {"titre": "L'or chute de 3% sous la pression du dollar", "source_label": "2026-11-12"},
             {"titre": "Le sucre n° 11 s'assouplit", "source_label": "CMB"},
             {"titre": "Or, la BRVM reste calme", "source_label": "x"}]
    par = q.titres_par_matiere(items, S46)
    assert par["Or"] == ["[2026-11-12] L'or chute de 3% sous la pression du dollar"]
    assert par["Pétrole Brent"] == ["[Sika] Le Brent tombe sous 94 dollars"]
    assert par["Cacao"] == []


def test_une_ligne_par_valeur_exposee():
    lignes = q.lignes_exposition({"petrole": (-2.52, "Brent, semaine"), "huile_palme": (1.2, "mois"),
                                  "caoutchouc": (None, "")}, REF)
    sogb = [l for l in lignes if l["code"] == "SOGC"]
    assert len(sogb) == 1 and [m["matiere"] for m in sogb[0]["mouvements"]] == ["Huile de palme", "Caoutchouc"]
    assert len({l["code"] for l in lignes}) == len(lignes)


def test_chapo_factuel():
    c = q.chapo_article(S46)
    assert c.startswith("Sur la semaine, l'argent perd 6,05\u00a0%, l'or perd 4,68\u00a0% et le Brent recule de 2,09\u00a0%, à 96,27 dollars.")


def test_le_rendu_n_emploie_que_des_balises_admises_par_le_site():
    import re
    from pathlib import Path
    ts = Path(__file__).parent.joinpath("frontend/lib/sanitizeHtml.ts").read_text(encoding="utf-8")
    tags = set(re.findall(r"'([a-z0-9]+)'", ts[ts.index("ALLOWED_TAGS"):ts.index("ALLOWED_ATTR")]))
    attrs = set(re.findall(r"'([a-zA-Z-]+)'", ts[ts.index("ALLOWED_ATTR"):ts.index("export function")]))
    html = g.assemble_content_html(_texte_valide(), _prix(), {**_ctx(), "sources": [{"titre": "t", "url": "https://x.fr", "date": "d"}],
                                   "expositions": q.lignes_exposition({}, REF), "bilan": [{"franchi": True, "texte": "x"}]})
    employes = set(re.findall(r"<([a-z0-9]+)[\s>]", html))
    assert employes <= tags, employes - tags
    attributs = set(re.findall(r"\s([a-zA-Z-]+)=\"", html))
    assert attributs <= attrs, attributs - attrs


def test_les_apostrophes_survivent_a_l_assainissement():
    html = g.assemble_content_html("<section><div><h3>L'Or et l'Argent reculent</h3></div></section>", _prix(), _ctx())
    assert "L'or et l'argent reculent" in html
