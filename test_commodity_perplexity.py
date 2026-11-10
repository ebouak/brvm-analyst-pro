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


# ── API Search de Perplexity (remplace l'appel Sonar, 2026-11-10) ──
# Client factice : aucune clé, aucun appel réseau.
from types import SimpleNamespace

import commodity_weekly_generator as cwg


class FauxClient:
    def __init__(self, resultats=None, erreur=None):
        self.appels = []
        self._resultats = resultats or []
        self._erreur = erreur
        self.search = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.appels.append(kwargs)
        if self._erreur:
            raise self._erreur
        return SimpleNamespace(id="r1", server_time=None, results=self._resultats)


def resultat(url, date=None, title="Le cacao recule", snippet="Extrait de la page."):
    date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return SimpleNamespace(title=title, url=url, snippet=snippet, date=date, last_updated=None)


def test_requetes_par_lots_de_cinq():
    lots = cwg.requetes_commodites([f"m{i}" for i in range(7)])
    assert [len(l) for l in lots] == [5, 2]
    assert lots[0][0] == "m0 prix actualité de la semaine"


def test_contexte_ne_garde_que_les_articles_joignables_et_dedoublonne(monkeypatch):
    monkeypatch.setattr(cwg, "url_joignable", lambda u, *a, **k: "injoignable" not in u)
    client = FauxClient([
        resultat("https://www.example.com/le-cacao-recule-sur-les-marches-mondiaux"),
        resultat("https://www.example.com/le-cacao-recule-sur-les-marches-mondiaux"),  # doublon
        resultat("https://www.example.com/actualites"),  # page de liste
        resultat("https://www.example.com/article-injoignable-sur-le-petrole-brut"),
        resultat("https://www.example.com/sans-date-ce-lien-est-ecarte-avant-tout", date="pas-une-date"),
    ])
    items = cwg.fetch_perplexity_context(["cacao"], client=client)
    assert [it["url"] for it in items] == ["https://www.example.com/le-cacao-recule-sur-les-marches-mondiaux"]
    assert items[0]["resume"] == "Extrait de la page."


def test_erreur_de_l_api_degrade_en_silence():
    assert cwg.fetch_perplexity_context(["cacao"], client=FauxClient(erreur=RuntimeError("401"))) == []


def test_un_appel_par_lot(monkeypatch):
    monkeypatch.setattr(cwg, "url_joignable", lambda u, *a, **k: True)
    client = FauxClient([])
    cwg.fetch_perplexity_context([f"m{i}" for i in range(6)], client=client)
    assert len(client.appels) == 2
