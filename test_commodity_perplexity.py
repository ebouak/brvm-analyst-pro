from datetime import datetime, timedelta, timezone

from commodity_weekly_generator import valider_item_perplexity

MAINTENANT = datetime(2026, 7, 30, 12, 0, 0, tzinfo=timezone.utc)


def item_valide(**overrides):
    base = {
        "titre": "Le cacao progresse sur fond de tensions climatiques",
        "resume": "Les cours du cacao ont augmenté cette semaine en Côte d'Ivoire.",
        "date": "2026-07-28",
        "url": "https://www.example.com/cacao",
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
from commodity_weekly_generator import url_joignable


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


from commodity_weekly_generator import ressemble_a_un_article


def test_page_de_liste_ecartee():
    assert ressemble_a_un_article("https://www.brvm.org/fr/marche/avis-et-publications/avis") is False


def test_article_accepte():
    assert ressemble_a_un_article("https://www.sikafinance.com/marches/brvm-29-valeurs-en-baisse_64333") is True
