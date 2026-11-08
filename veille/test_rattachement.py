"""Rattachement d'un article à une valeur : sur preuve, en mot entier.

Cas réels de brvm_news (STAC = SETAO CI), constatés le 2026-11-08 : le flux
« SITAS » rattachait à STAC des articles sur Air France et le Mali.
"""
from pathlib import Path

import yaml

import brvm_pipeline as bp

CONFIG = yaml.safe_load((Path(__file__).parent / "brvm_config.yaml").read_text(encoding="utf8"))
IDX = bp.build_index(CONFIG["valeurs"])


def rattache(texte):
    return bp.match_tickers(texte, IDX)


def test_obstacle_ne_contient_pas_stac():
    # « stac » est dans « obstacle » : avec l'ancien mot-clé nu, l'article du
    # Journal du Mali sur l'école était rattaché à SETAO CI.
    texte = "Au Mali, la souveraineté commence à l'école. Le vrai obstacle n'est pas un peuple inapte."
    assert "STAC" not in rattache(texte)
    assert not bp.preuve_rattachement(texte, "STAC", IDX)


def test_motif_nu_stac_ne_prend_pas_un_mot_contenant():
    idx = bp.build_index([{"ticker": "STAC", "mots_cles": ["STAC"]}])
    assert bp.match_tickers("un obstacle de taille", idx) == []
    assert bp.match_tickers("Le titre STAC progresse", idx) == ["STAC"]


def test_transport_aerien_et_air_france_ne_rattachent_pas():
    for titre in [
        "Transport aérien : Air France baisse ses prix à destination de l'Europe - Abidjan.net",
        "Pascal Tigahiré: « Pourquoi Colombes Airlines revient » - L'economiste du faso",
        "Le nouvel Airbus A320 de Air Côte d'Ivoire reflète l'ambition d'imposer un nouveau standard",
    ]:
        assert "STAC" not in rattache(titre), titre


def test_sitas_n_est_plus_un_alias_de_stac():
    assert not bp.preuve_rattachement("Sitas CI : transport aérien à Abidjan", "STAC", IDX)


def test_article_sur_setao_est_rattache():
    titre = "BRVM : SETAO réduit fortement ses pertes de 72% en 2025 - Sika Finance"
    assert "STAC" in rattache(titre)
    assert bp.preuve_rattachement(titre, "STAC", IDX)


def test_code_en_mot_entier_est_rattache():
    assert bp.preuve_rattachement("Setao Côte d'Ivoire (STAC) — BRVM - Dabafinance", "STAC", IDX)


def test_un_pays_seul_ne_prouve_rien():
    # Le feed d'une société ne doit jamais tenir lieu de preuve à lui seul.
    assert not bp.preuve_rattachement("Le Mali, seul Etat à respecter la norme du déficit public", "STAC", IDX)


def test_valeur_inconnue_n_a_aucune_preuve():
    assert not bp.preuve_rattachement("SETAO", "ZZZZ", IDX)


def test_la_config_ne_declare_plus_de_code_inexistant_pour_setao():
    codes = [v["ticker"] for v in CONFIG["valeurs"]]
    assert "SETC" not in codes
    assert codes.count("STAC") == 1
    stac = next(v for v in CONFIG["valeurs"] if v["ticker"] == "STAC")
    assert stac["nom"] == "SETAO CI"
