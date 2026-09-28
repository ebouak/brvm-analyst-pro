from datetime import datetime, timedelta

from brvm_pipeline import valider_item_perplexity

MAINTENANT = datetime(2026, 7, 30, 12, 0, 0)


def item_valide(**overrides):
    base = {
        "titre": "BRVM : la capitalisation franchit un nouveau seuil",
        "resume": "La capitalisation boursière de la BRVM a progressé cette semaine.",
        "date": "2026-07-28",
        "url": "https://www.example.com/article",
    }
    base.update(overrides)
    return base


def test_item_complet_et_recent_est_accepte():
    assert valider_item_perplexity(item_valide(), MAINTENANT) is True


def test_url_absente_est_rejetee():
    item = item_valide(url="")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_url_malformee_est_rejetee():
    item = item_valide(url="pas-une-url")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_titre_vide_est_rejete():
    item = item_valide(titre="")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_resume_vide_est_rejete():
    item = item_valide(resume="")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_date_invalide_est_rejetee():
    item = item_valide(date="pas-une-date")
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_date_trop_ancienne_est_rejetee():
    date_ancienne = (MAINTENANT - timedelta(days=30)).strftime("%Y-%m-%d")
    item = item_valide(date=date_ancienne)
    assert valider_item_perplexity(item, MAINTENANT) is False


def test_date_dans_le_futur_est_rejetee():
    date_future = (MAINTENANT + timedelta(days=5)).strftime("%Y-%m-%d")
    item = item_valide(date=date_future)
    assert valider_item_perplexity(item, MAINTENANT) is False


# ── url_joignable : le lien cité doit exister (décision du 2026-09-28) ──
from brvm_pipeline import url_joignable


def faux_serveur(codes: dict):
    """Renvoie un requete(methode, url) qui répond selon la méthode."""
    appels = []

    def requete(methode, url):
        appels.append(methode)
        rep = codes[methode]
        if isinstance(rep, Exception):
            raise rep
        return rep
    requete.appels = appels
    return requete


def test_lien_qui_repond_200_est_joignable():
    assert url_joignable("https://x.test/a", faux_serveur({"HEAD": 200})) is True


def test_lien_404_est_ecarte():
    assert url_joignable("https://x.test/a", faux_serveur({"HEAD": 404})) is False


def test_head_refuse_bascule_sur_get():
    req = faux_serveur({"HEAD": 405, "GET": 200})
    assert url_joignable("https://x.test/a", req) is True
    assert req.appels == ["HEAD", "GET"]


def test_head_refuse_puis_get_404_est_ecarte():
    assert url_joignable("https://x.test/a", faux_serveur({"HEAD": 403, "GET": 404})) is False


def test_erreur_reseau_est_ecartee():
    assert url_joignable("https://x.test/a", faux_serveur({"HEAD": TimeoutError("délai")})) is False


def test_serveur_en_erreur_500_est_ecarte():
    assert url_joignable("https://x.test/a", faux_serveur({"HEAD": 500})) is False


def test_notre_propre_site_est_ecarte_sans_appel_reseau():
    req = faux_serveur({"HEAD": 200})
    assert url_joignable("https://www.westbourse.com/societes/SNTS", req) is False
    assert url_joignable("https://westbourse.com/brief", req) is False
    assert req.appels == []


def test_domaine_voisin_n_est_pas_confondu():
    assert url_joignable("https://notwestbourse.com/a", faux_serveur({"HEAD": 200})) is True


# ── ressemble_a_un_article : les pages de liste sont écartées (2026-09-28) ──
from brvm_pipeline import ressemble_a_un_article, metadonnees_editeur


def test_pages_de_liste_vues_en_production_sont_ecartees():
    for url in [
        "https://www.brvm.org/fr/marche/avis-et-publications/avis",
        "https://www.westbourse.com/actualites",
        "https://www.richbourse.com/common/news/index",
        "https://www.brvm.org/fr/mediacentre/actualites",
        "https://www.example.com/",
        "https://www.example.com",
    ]:
        assert ressemble_a_un_article(url) is False, url


def test_articles_vus_en_production_sont_acceptes():
    for url in [
        "https://www.sikafinance.com/marches/brvm-29-valeurs-en-baisse-et-le-composite-retombe-sous-les-550-points_64333",
        "https://dabafinance.com/fr/nouvelles/brvm-atteint-les-555-points-alors-que-la-reprise-se-prolonge-en-septembre",
        "https://www.brvm.org/fr/mediacentre/actualites/le-bulletin-officiel-de-la-cote-de-la-brvm-des-evolutions-majeures-pour-une-0",
        "https://www.financialafrik.com/2026/09/25/brvm-bridge-bank-group-cote-divoire-fait-son-entree/",
    ]:
        assert ressemble_a_un_article(url) is True, url


# ── metadonnees_editeur : le texte de l'éditeur remplace celui du modèle ──

def test_og_title_et_og_description_prioritaires():
    html = """<html><head><title>Titre onglet</title>
    <meta property="og:title" content="BRVM : le marché retient son souffle">
    <meta property="og:description" content="  Le Composite  cède du terrain.  ">
    <meta name="description" content="autre"></head></html>"""
    assert metadonnees_editeur(html) == {
        "titre": "BRVM : le marché retient son souffle",
        "resume": "Le Composite cède du terrain.",
    }


def test_repli_sur_title_et_meta_description():
    html = '<html><head><title> Séance du 23 </title><meta name="description" content="Résumé éditeur"></head></html>'
    assert metadonnees_editeur(html) == {"titre": "Séance du 23", "resume": "Résumé éditeur"}


def test_rien_a_lire_donne_des_chaines_vides_jamais_une_invention():
    assert metadonnees_editeur("") == {"titre": "", "resume": ""}
    assert metadonnees_editeur("<html><body>sans en-tête</body></html>") == {"titre": "", "resume": ""}


# ── titre_pertinent : le titre de l'éditeur doit parler du marché ──
from brvm_pipeline import titre_pertinent


def test_titres_hors_sujet_vus_en_production_sont_ecartes():
    assert titre_pertinent("Conseil des ministres | lejecos Le journal de l’économie sénégalaise") is False
    assert titre_pertinent("Actualités des Institutions Internationales en Afrique | Financial Afrik") is False
    assert titre_pertinent("") is False


def test_titres_du_marche_sont_gardes_accents_et_casse_ignores():
    assert titre_pertinent("BRVM : 29 valeurs en baisse et le Composite retombe sous les 550 points") is True
    assert titre_pertinent("UEMOA : près de 7 000 milliards FCFA de liquidités") is True
    assert titre_pertinent("Rapport sur la Politique Monétaire dans l'UMOA - Septembre 2026 | BCEAO") is True
    assert titre_pertinent("Dabafinance - BIIC Hits All-Time High as BRVM Rally Lifts Banking Stocks") is True
    assert titre_pertinent("Première COTATION des emprunts obligataires TPCI") is True


def test_cote_d_ivoire_seule_n_est_pas_un_sujet_de_marche():
    assert titre_pertinent("Côte d’Ivoire : le gouvernement inaugure un pont") is False
    assert titre_pertinent("Bulletin Officiel de la Cote de la BRVM du 21 septembre 2026") is True


# ── pages de rubrique : adresse d'article, contenu générique (2026-09-28) ──
from brvm_pipeline import titre_generique


def test_rubrique_sans_tiret_dans_l_adresse_est_ecartee():
    assert ressemble_a_un_article("https://www.sikafinance.com/marches/actualites_bourse_brvm") is False


def test_titres_de_rubrique_sont_generiques():
    assert titre_generique("Toutes | BRVM - Bourse Régionale des Valeurs Mobilières") is True
    assert titre_generique("Bulletin Officiel de la Cote | BRVM - Bourse Régionale des Valeurs Mobilières") is True
    assert titre_generique("Bulletins Officiels de la Cote | BRVM") is True


def test_titres_d_articles_ne_sont_pas_generiques():
    assert titre_generique("La BRVM franchit le cap des 20 000 milliards de FCFA | Financial Afrik") is False
    assert titre_generique("BRVM : 29 valeurs en baisse et le Composite retombe sous les 550 points") is False
    assert titre_generique("Dabafinance - BRVM Hits 555 Points as Rally Extends Into September") is False


def test_emissions_du_tresor_sont_du_marche():
    assert titre_pertinent("Mali : le Trésor lève 60,5 milliards FCFA - FINECO") is True
    assert titre_pertinent("Sénégal : succès de l’émission de titres publics") is True
