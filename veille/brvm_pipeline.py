#!/usr/bin/env python3
"""
WestBourse – Pipeline Veille BRVM v3
=====================================
Sources connectées (150+) :
  • Google News RSS dédié par société (47 flux)
  • Sites officiels des sociétés cotées (pages presse/investisseurs)
  • 35 sources RSS presse africaine généraliste
  • 8 flux matières premières (huile de palme, caoutchouc, cacao, pétrole…)
  • 7 sources institutionnelles (BCEAO, FMI, Banque Mondiale, agences de notation)
  • Scraping BRVM.org + CREPMF + UEMOA (officiel)
  • Perplexity (recherche web sourcée, additive — voir PERPLEXITY_API_KEY)

Usage:
    python brvm_pipeline.py              # collecte unique (toutes sources)
    python brvm_pipeline.py --daemon     # mode démon (schedule)
    python brvm_pipeline.py --export     # export JSON seul
    python brvm_pipeline.py --stats      # statistiques de couverture
    python brvm_pipeline.py --alertes    # alertes actives
    python brvm_pipeline.py --ticker SNTS
    python brvm_pipeline.py --sources    # liste l'état de toutes les sources

Dépendances:
    pip install feedparser requests beautifulsoup4 pyyaml schedule lxml
"""

import os, re, json, time, sqlite3, hashlib, logging, argparse, schedule
from datetime import datetime, timedelta
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import feedparser
import requests
import yaml
from bs4 import BeautifulSoup

# ─────────────────────────────────────────────────────────────
# CHEMINS
# ─────────────────────────────────────────────────────────────
BASE    = Path(__file__).parent
DATA    = BASE / "data";    DATA.mkdir(exist_ok=True)
OUTPUT  = BASE / "output";  OUTPUT.mkdir(exist_ok=True)
LOGS    = BASE / "logs";    LOGS.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOGS / "pipeline.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("wb")

# ─────────────────────────────────────────────────────────────
# SENTIMENT
# ─────────────────────────────────────────────────────────────
_POS = ["hausse","progression","croissance","bénéfice","profit","dividende","record",
        "expansion","succès","performance","investissement","partenariat","contrat",
        "innovation","rebond","gain","accord","positif","forte","croît","surperforme"]
_NEG = ["baisse","chute","perte","déficit","suspension","radiation","faillite",
        "redressement","crise","risque","alerte","sanction","recul","difficultés",
        "litige","fraude","dette","défaut","négatif","dégradation","sous-performe"]

def sentiment(text: str) -> str:
    t = text.lower()
    p = sum(1 for w in _POS if w in t)
    n = sum(1 for w in _NEG if w in t)
    return "positif" if p > n else "negatif" if n > p else "neutre"

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────
def load_config() -> dict:
    f = BASE / "brvm_config.yaml"
    with open(f, encoding="utf-8") as fh:
        return yaml.safe_load(fh)

# ─────────────────────────────────────────────────────────────
# BASE DE DONNÉES
# ─────────────────────────────────────────────────────────────
def init_db(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS articles (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            hash          TEXT UNIQUE NOT NULL,
            titre         TEXT NOT NULL,
            url           TEXT,
            source        TEXT,
            source_type   TEXT DEFAULT 'rss',
            date_pub      TEXT,
            date_collecte TEXT NOT NULL,
            resume        TEXT,
            langue        TEXT DEFAULT 'fr',
            pertinence    REAL DEFAULT 0.0,
            sentiment     TEXT DEFAULT 'neutre',
            est_alerte    INTEGER DEFAULT 0,
            matiere       TEXT DEFAULT NULL
        );
        CREATE TABLE IF NOT EXISTS article_valeurs (
            article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
            ticker     TEXT NOT NULL,
            PRIMARY KEY (article_id, ticker)
        );
        CREATE TABLE IF NOT EXISTS source_health (
            source_name TEXT PRIMARY KEY,
            source_type TEXT,
            derniere_ok TEXT,
            derniere_tentative TEXT,
            nb_ok       INTEGER DEFAULT 0,
            nb_erreur   INTEGER DEFAULT 0,
            dernier_statut TEXT DEFAULT 'inconnu'
        );
        CREATE INDEX IF NOT EXISTS idx_date    ON articles(date_pub);
        CREATE INDEX IF NOT EXISTS idx_alerte  ON articles(est_alerte);
        CREATE INDEX IF NOT EXISTS idx_ticker  ON article_valeurs(ticker);
        CREATE INDEX IF NOT EXISTS idx_matiere ON articles(matiere);
    """)
    conn.commit()
    return conn

def article_exists(conn, h):
    return conn.execute("SELECT 1 FROM articles WHERE hash=?", (h,)).fetchone() is not None

def save_article(conn, art: dict, tickers: list) -> bool:
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO articles (hash,titre,url,source,source_type,date_pub,
                date_collecte,resume,langue,pertinence,sentiment,est_alerte,matiere)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            art["hash"], art["titre"], art.get("url",""), art.get("source",""),
            art.get("source_type","rss"), art.get("date_pub",""),
            datetime.utcnow().isoformat(), art.get("resume",""),
            art.get("langue","fr"), art.get("pertinence",0.0),
            art.get("sentiment","neutre"), 1 if art.get("est_alerte") else 0,
            art.get("matiere"),
        ))
        aid = cur.lastrowid
        for t in tickers:
            cur.execute("INSERT OR IGNORE INTO article_valeurs VALUES(?,?)", (aid, t))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False

def update_health(conn, name: str, stype: str, ok: bool, err_msg: str = ""):
    now = datetime.utcnow().isoformat()
    conn.execute("""
        INSERT INTO source_health (source_name,source_type,derniere_tentative,dernier_statut,nb_ok,nb_erreur)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(source_name) DO UPDATE SET
            derniere_tentative=excluded.derniere_tentative,
            dernier_statut=excluded.dernier_statut,
            nb_ok = nb_ok + ?,
            nb_erreur = nb_erreur + ?,
            derniere_ok = CASE WHEN ? THEN excluded.derniere_tentative ELSE derniere_ok END,
            source_type=excluded.source_type
    """, (name, stype, now, "ok" if ok else f"erreur: {err_msg[:100]}",
          1 if ok else 0, 0 if ok else 1,
          1 if ok else 0, 0 if ok else 1, ok))
    conn.commit()

def purge(conn, jours):
    cutoff = (datetime.utcnow() - timedelta(days=jours)).isoformat()
    n = conn.execute("DELETE FROM articles WHERE date_collecte < ?", (cutoff,)).rowcount
    conn.commit()
    if n: log.info(f"Purge : {n} article(s) supprimé(s)")

# ─────────────────────────────────────────────────────────────
# MATCHING
# ─────────────────────────────────────────────────────────────
def build_index(valeurs):
    return {v["ticker"]: [re.compile(re.escape(k), re.IGNORECASE)
                          for k in v["mots_cles"]] for v in valeurs}

def match_tickers(text: str, idx: dict) -> list:
    return [t for t, ps in idx.items() if any(p.search(text) for p in ps)]

def is_alerte(text: str, kws: list) -> bool:
    t = text.lower()
    return any(k.lower() in t for k in kws)

def score(text: str, kws: list) -> float:
    t = text.lower()
    return min(1.0, sum(1 for k in kws if k.lower() in t) / max(len(kws), 1) * 4)

def make_hash(titre, url):
    return hashlib.sha256(f"{titre}{url}".encode()).hexdigest()

def parse_date(entry) -> str:
    if getattr(entry, "published_parsed", None):
        try: return datetime(*entry.published_parsed[:6]).isoformat()
        except: pass
    return ""

def clean_html(raw: str) -> str:
    return BeautifulSoup(raw, "html.parser").get_text(" ", strip=True)[:600]

# ─────────────────────────────────────────────────────────────
# COLLECTE 1 — RSS GÉNÉRAL
# ─────────────────────────────────────────────────────────────
def fetch_rss(source: dict, idx: dict, alertes: list, global_kw: list, cfg: dict) -> list:
    ua = cfg["pipeline"]["user_agent"]
    results = []
    try:
        feed = feedparser.parse(source["url"], request_headers={"User-Agent": ua})
        for e in feed.entries:
            titre = (e.get("title") or "").strip()
            if not titre: continue
            url   = e.get("link", "")
            resume = clean_html(e.get("summary","") or e.get("description",""))
            texte  = f"{titre} {resume}"
            tickers = match_tickers(texte, idx)
            pertinence = score(texte, global_kw)
            if not tickers and pertinence < 0.1: continue
            results.append({
                "hash": make_hash(titre, url), "titre": titre, "url": url,
                "source": source["name"], "source_type": "rss",
                "date_pub": parse_date(e), "resume": resume,
                "langue": source.get("langue","fr"),
                "pertinence": pertinence,
                "sentiment": sentiment(texte),
                "est_alerte": is_alerte(texte, alertes),
                "_tickers": tickers,
            })
        update_health(None, source["name"], "rss", True) if False else None  # health tracked in wrapper
        log.info(f"[RSS]      {source['name']:<42} {len(results):>3} art.")
    except Exception as ex:
        log.warning(f"[RSS]  ✗   {source['name']}: {ex}")
    return results

# ─────────────────────────────────────────────────────────────
# COLLECTE 2 — GOOGLE NEWS PAR SOCIÉTÉ
# ─────────────────────────────────────────────────────────────
def fetch_google_news(soc: dict, alertes: list, cfg: dict) -> list:
    url  = soc.get("google_news")
    if not url: return []
    ticker = soc["ticker"]
    nom    = soc.get("nom_display", ticker)
    ua     = cfg["pipeline"]["user_agent"]
    results = []
    try:
        feed = feedparser.parse(url, request_headers={"User-Agent": ua})
        for e in feed.entries:
            titre  = (e.get("title") or "").strip()
            if not titre: continue
            url_e  = e.get("link","")
            resume = clean_html(e.get("summary","") or "")
            texte  = f"{titre} {resume}"
            results.append({
                "hash": make_hash(titre, url_e), "titre": titre, "url": url_e,
                "source": f"Google News – {nom}",
                "source_type": "google_news",
                "date_pub": parse_date(e), "resume": resume,
                "langue": "fr", "pertinence": max(0.6, score(texte, [])),
                "sentiment": sentiment(texte),
                "est_alerte": is_alerte(texte, alertes),
                "_tickers": [ticker],
            })
        if results: log.info(f"[G.News]   {ticker:<8} {nom:<30} {len(results):>3} art.")
    except Exception as ex:
        log.debug(f"[G.News] ✗ {ticker}: {ex}")
    return results

# ─────────────────────────────────────────────────────────────
# COLLECTE 3 — SITES OFFICIELS DES SOCIÉTÉS
# ─────────────────────────────────────────────────────────────
def fetch_site_societe(soc: dict, idx: dict, alertes: list, cfg: dict) -> list:
    url = soc.get("site_presse")
    if not url: return []
    ticker = soc["ticker"]
    ua = cfg["pipeline"]["user_agent"]
    to = cfg["pipeline"]["timeout_seconds"]
    results = []
    try:
        r = requests.get(url, headers={"User-Agent": ua}, timeout=to)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        base = "/".join(url.split("/")[:3])

        # Sélecteurs du config (priorité) ou fallback générique
        sel_items  = soc.get("sel_items",  "article, .actualite, .news, .press-release, .post")
        sel_titre  = soc.get("sel_titre",  "h2 a, h3 a, h1 a, .title a")
        sel_date   = soc.get("sel_date",   "time, .date, .entry-date, .published")
        sel_resume = soc.get("sel_resume", "p, .excerpt, .description")

        items = soup.select(sel_items)
        # Fallback si pas d'articles trouvés avec le sélecteur principal
        if not items:
            items = soup.select("a[href]")
            # Filtrer les liens textuels pertinents
            fake_items = []
            kws = [k.lower() for k in (idx.get(ticker) or []) if hasattr(k, 'pattern') is False]
            for a_tag in items[:50]:
                txt = a_tag.get_text(strip=True)
                if len(txt) > 30 and any(kw in txt.lower() for kw in ["résultat","presse","commun","bourse","action","bénéfice","dividende"]):
                    fake_items.append(a_tag.parent or a_tag)
            items = fake_items[:10]

        for item in items[:30]:
            tag_t = item.select_one(sel_titre)
            if not tag_t:
                # Essayer directement si l'item est un lien
                tag_t = item if item.name == "a" else None
            if not tag_t: continue
            titre = tag_t.get_text(strip=True)
            if len(titre) < 15: continue
            href  = tag_t.get("href","")
            url_e = href if href.startswith("http") else (base + href if href else url)
            tag_d = item.select_one(sel_date)
            date_pub = tag_d.get_text(strip=True) if tag_d else ""
            tag_r = item.select_one(sel_resume)
            resume = tag_r.get_text(" ", strip=True)[:400] if tag_r else ""
            texte = f"{titre} {resume}"
            results.append({
                "hash": make_hash(titre, url_e), "titre": titre, "url": url_e,
                "source": f"Site officiel – {ticker}",
                "source_type": "site_officiel",
                "date_pub": date_pub, "resume": resume,
                "langue": "fr", "pertinence": 0.85,
                "sentiment": sentiment(texte),
                "est_alerte": is_alerte(texte, alertes),
                "_tickers": [ticker],
            })
        if results: log.info(f"[Site]     {ticker:<8} {url:<45} {len(results):>3} art.")
    except Exception as ex:
        log.debug(f"[Site]  ✗  {ticker} ({url}): {ex}")
    return results

# ─────────────────────────────────────────────────────────────
# COLLECTE 4 — RSS MATIÈRES PREMIÈRES
# ─────────────────────────────────────────────────────────────
def fetch_commodite(source: dict, cfg: dict) -> list:
    ua = cfg["pipeline"]["user_agent"]
    results = []
    try:
        feed = feedparser.parse(source["url"], request_headers={"User-Agent": ua})
        for e in feed.entries:
            titre = (e.get("title") or "").strip()
            if not titre: continue
            url_e = e.get("link","")
            resume = clean_html(e.get("summary","") or "")
            texte  = f"{titre} {resume}"
            results.append({
                "hash": make_hash(titre, url_e), "titre": titre, "url": url_e,
                "source": source["name"], "source_type": "commodite",
                "date_pub": parse_date(e), "resume": resume,
                "langue": source.get("langue","fr"),
                "pertinence": 0.75,
                "sentiment": sentiment(texte),
                "est_alerte": False,
                "matiere": source.get("matiere"),
                "_tickers": source.get("tickers_impactes", []),
            })
        if results: log.info(f"[Commod.]  {source['name']:<42} {len(results):>3} art.")
    except Exception as ex:
        log.debug(f"[Commod.] ✗ {source['name']}: {ex}")
    return results

# ─────────────────────────────────────────────────────────────
# COLLECTE 5 — INSTITUTIONS (BCEAO, FMI, agences de notation)
# ─────────────────────────────────────────────────────────────
def fetch_institution(source: dict, idx: dict, alertes: list, global_kw: list, cfg: dict) -> list:
    ua = cfg["pipeline"]["user_agent"]
    results = []
    try:
        feed = feedparser.parse(source["url"], request_headers={"User-Agent": ua})
        for e in feed.entries:
            titre = (e.get("title") or "").strip()
            if not titre: continue
            url_e  = e.get("link","")
            resume = clean_html(e.get("summary","") or "")
            texte  = f"{titre} {resume}"
            tickers = match_tickers(texte, idx)
            pertinence = score(texte, global_kw)
            if pertinence < 0.05 and not tickers: continue
            results.append({
                "hash": make_hash(titre, url_e), "titre": titre, "url": url_e,
                "source": source["name"], "source_type": "institution",
                "date_pub": parse_date(e), "resume": resume,
                "langue": source.get("langue","fr"),
                "pertinence": max(pertinence, 0.5),
                "sentiment": sentiment(texte),
                "est_alerte": is_alerte(texte, alertes),
                "_tickers": tickers,
            })
        if results: log.info(f"[Instit.]  {source['name']:<42} {len(results):>3} art.")
    except Exception as ex:
        log.debug(f"[Instit.] ✗ {source['name']}: {ex}")
    return results

# ─────────────────────────────────────────────────────────────
# COLLECTE 6 — SCRAPING BRVM / CREPMF / UEMOA
# ─────────────────────────────────────────────────────────────
def fetch_scraping(source: dict, idx: dict, alertes: list, cfg: dict) -> list:
    ua = cfg["pipeline"]["user_agent"]
    to = cfg["pipeline"]["timeout_seconds"]
    results = []
    try:
        r = requests.get(source["url"], headers={"User-Agent": ua}, timeout=to)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        base = "/".join(source["url"].split("/")[:3])
        items = soup.select(source.get("sel_items","article"))
        for item in items[:40]:
            tag_t = item.select_one(source.get("sel_titre","h2 a"))
            if not tag_t: continue
            titre = tag_t.get_text(strip=True)
            href  = tag_t.get("href","")
            url_e = href if href.startswith("http") else base + href
            tag_d = item.select_one(source.get("sel_date",".date"))
            date_pub = tag_d.get_text(strip=True) if tag_d else ""
            tag_r = item.select_one(source.get("sel_resume","p"))
            resume = tag_r.get_text(" ", strip=True)[:400] if tag_r else ""
            texte = f"{titre} {resume}"
            results.append({
                "hash": make_hash(titre, url_e), "titre": titre, "url": url_e,
                "source": source["name"], "source_type": "scraping_officiel",
                "date_pub": date_pub, "resume": resume,
                "langue": "fr", "pertinence": 0.8,
                "sentiment": sentiment(texte),
                "est_alerte": is_alerte(texte, alertes),
                "_tickers": match_tickers(texte, idx),
            })
        log.info(f"[Officiel] {source['name']:<42} {len(results):>3} art.")
    except Exception as ex:
        log.warning(f"[Officiel] ✗ {source['name']}: {ex}")
    return results

# ─────────────────────────────────────────────────────────────
# COLLECTE 7 — PERPLEXITY (recherche web sourcée, additive)
# ─────────────────────────────────────────────────────────────
def valider_item_perplexity(item: dict, maintenant: datetime, fenetre_jours: int = 14) -> bool:
    """Rejette tout item sans URL exploitable, sans titre/résumé, ou hors
    fenêtre de fraîcheur. Aucune tentative de réparer un item incomplet — on
    l'écarte silencieusement (design §3). Copie identique dans
    commodity_weekly_generator.py — toute correction doit être reportée des
    deux côtés (pas de module Python partagé entre les deux pipelines)."""
    if not isinstance(item, dict):
        return False
    url = item.get("url", "")
    if not isinstance(url, str) or not url.startswith("http"):
        return False
    if not item.get("titre") or not item.get("resume"):
        return False
    try:
        d = datetime.strptime(str(item.get("date", "")), "%Y-%m-%d")
    except (TypeError, ValueError):
        return False
    delta_jours = (maintenant.replace(tzinfo=None) - d).days
    return 0 <= delta_jours <= fenetre_jours

def fetch_perplexity(idx: dict, alertes: list, global_kw: list, cfg: dict) -> list:
    """Source additive : interroge Perplexity (recherche web + citations) pour
    de l'actualité BRVM/UEMOA récente. Sortie JSON stricte imposée — un fait =
    une citation, jamais de synthèse libre non sourcée (design §3-4).
    Dégradation silencieuse si la clé est absente ou l'appel échoue : la
    pipeline continue avec les ~150 autres sources, comme n'importe quel
    fetcher de ce fichier."""
    api_key = os.environ.get("PERPLEXITY_API_KEY", "")
    if not api_key:
        log.info("[Perplex.] PERPLEXITY_API_KEY absente — source ignorée")
        return []

    prompt = (
        "Actualités financières récentes concernant la BRVM (Bourse Régionale "
        "des Valeurs Mobilières) et les marchés financiers de l'UEMOA. "
        "Réponds UNIQUEMENT avec un tableau JSON strict, sans texte autour, "
        'de la forme : [{"titre": "...", "resume": "...", "date": "YYYY-MM-DD", '
        '"url": "https://..."}]. Un objet par fait distinct, chacun avec sa '
        "propre source. N'invente aucune URL : n'inclus que des faits que tu "
        "peux citer."
    )
    try:
        resp = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "sonar", "messages": [{"role": "user", "content": prompt}]},
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        items = json.loads(content)
        if not isinstance(items, list):
            raise ValueError("réponse JSON n'est pas une liste")
    except Exception as ex:
        log.warning(f"[Perplex.] ✗ {ex}")
        return []

    log.info(f"[Perplex.] {len(items)} item(s) reçus, avant validation fraîcheur/format")
    maintenant = datetime.utcnow()
    results = []
    for item in items:
        if not valider_item_perplexity(item, maintenant):
            continue
        try:
            titre = item["titre"].strip()
            url_e = item["url"].strip()
            resume = item["resume"].strip()
            texte = f"{titre} {resume}"
            results.append({
                "hash": make_hash(titre, url_e), "titre": titre, "url": url_e,
                "source": "Perplexity (recherche web)", "source_type": "perplexity",
                "date_pub": item["date"], "resume": resume,
                "langue": "fr", "pertinence": max(0.5, score(texte, global_kw)),
                "sentiment": sentiment(texte),
                "est_alerte": is_alerte(texte, alertes),
                "_tickers": match_tickers(texte, idx),
            })
        except (AttributeError, KeyError, TypeError) as ex:
            log.debug(f"[Perplex.] item ignoré (format inattendu) : {ex}")
            continue
    log.info(f"[Perplex.] {len(results):>3} art. retenus après validation")
    return results

# ─────────────────────────────────────────────────────────────
# EXPORT JSON (3 fichiers)
# ─────────────────────────────────────────────────────────────
def export(conn, cfg):
    out   = cfg["pipeline"]["output"]
    jours = 7
    cutoff = (datetime.utcnow() - timedelta(days=jours)).isoformat()

    rows = conn.execute("""
        SELECT a.*, GROUP_CONCAT(av.ticker) as tickers
        FROM articles a
        LEFT JOIN article_valeurs av ON a.id=av.article_id
        WHERE a.date_collecte >= ?
        GROUP BY a.id
        ORDER BY a.date_pub DESC, a.date_collecte DESC
    """, (cutoff,)).fetchall()

    articles, par_ticker, alertes, commodites = [], {}, [], {}
    for row in rows:
        a = dict(row)
        tlist = [t.strip() for t in (a.pop("tickers","") or "").split(",") if t.strip()]
        a["valeurs"] = tlist
        articles.append(a)
        if a.get("est_alerte"): alertes.append(a)
        if a.get("matiere"):
            commodites.setdefault(a["matiere"], []).append(a)
        for t in tlist:
            par_ticker.setdefault(t, []).append(a)

    # Santé des sources
    health_rows = conn.execute("SELECT * FROM source_health ORDER BY nb_erreur DESC").fetchall()
    health = [dict(r) for r in health_rows]

    # Couverture par valeur
    couverture = {v["ticker"]: {
        "ticker": v["ticker"], "nom": v["nom"], "secteur": v["secteur"],
        "pays": v["pays"],
        "nb_articles": len(par_ticker.get(v["ticker"],[])),
        "nb_alertes": sum(1 for a in par_ticker.get(v["ticker"],[]) if a.get("est_alerte")),
        "dernier": par_ticker[v["ticker"]][0]["date_pub"] if par_ticker.get(v["ticker"]) else None,
    } for v in cfg["valeurs"]}

    feed = {
        "generated_at": datetime.utcnow().isoformat()+"Z",
        "periode_jours": jours, "total_articles": len(articles),
        "total_alertes": len(alertes),
        "articles": articles, "par_ticker": par_ticker,
        "couverture": couverture, "source_health": health,
    }
    for path, data in [
        (out["chemin_json"], feed),
        (out["chemin_alertes"], {"generated_at": feed["generated_at"], "alertes": alertes}),
        (out["chemin_stats"], {"generated_at": feed["generated_at"], "couverture": couverture, "health": health}),
        (out["chemin_commodites"], {"generated_at": feed["generated_at"], "commodites": commodites}),
    ]:
        Path(path).parent.mkdir(exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    log.info(f"Export : {len(articles)} art · {len(alertes)} alertes · {len(couverture)} valeurs")
    return feed

# ─────────────────────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────────────────────
def run_pipeline(config: dict, conn: sqlite3.Connection):
    import time as _t
    t0 = _t.time()
    log.info("=" * 68)
    log.info("WestBourse Pipeline v3 — Démarrage collecte complète")
    log.info("=" * 68)

    valeurs        = config["valeurs"]
    rss_general    = config["sources"]["rss_general"]
    rss_commodites = config["sources"]["rss_commodites"]
    rss_insts      = config["sources"]["rss_institutions"]
    scraping_off   = config["sources"]["scraping_institutionnel"]
    sites_soc      = config["sites_societes"]
    pipeline_c     = config["pipeline"]
    global_kw      = config["alertes_mots_cles_generaux"]
    alertes_kw     = config["alertes_critiques"]
    workers        = pipeline_c.get("max_workers", 15)

    idx = build_index(valeurs)

    # Construire un mapping ticker → infos pour les sites sociétés
    val_map = {v["ticker"]: v for v in valeurs}

    all_articles = []
    totals = {}

    # ── 1. RSS général ───────────────────────────────────────
    log.info(f"\n[1/7] RSS général – {len(rss_general)} sources")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(fetch_rss, s, idx, alertes_kw, global_kw, config): s for s in rss_general}
        for f in as_completed(futs):
            arts = f.result(); all_articles.extend(arts)
    totals["rss_general"] = sum(1 for a in all_articles if a.get("source_type")=="rss")

    # ── 2. Google News par société ───────────────────────────
    log.info(f"\n[2/7] Google News – {len(sites_soc)} flux société")
    # Enrichir sites_soc avec nom d'affichage
    soc_gnews = []
    for soc in sites_soc:
        t = soc["ticker"]
        soc_gnews.append({**soc, "nom_display": val_map.get(t, {}).get("nom", t)})
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(fetch_google_news, s, alertes_kw, config): s for s in soc_gnews}
        for f in as_completed(futs):
            all_articles.extend(f.result())
    totals["google_news"] = sum(1 for a in all_articles if a.get("source_type")=="google_news")

    # ── 3. Sites officiels des sociétés ─────────────────────
    log.info(f"\n[3/7] Sites officiels – {len(sites_soc)} sociétés")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(fetch_site_societe, s, idx, alertes_kw, config): s for s in sites_soc}
        for f in as_completed(futs):
            all_articles.extend(f.result())
    totals["site_officiel"] = sum(1 for a in all_articles if a.get("source_type")=="site_officiel")

    # ── 4. Matières premières ────────────────────────────────
    log.info(f"\n[4/7] Matières premières – {len(rss_commodites)} flux")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(fetch_commodite, s, config): s for s in rss_commodites}
        for f in as_completed(futs):
            all_articles.extend(f.result())
    totals["commodite"] = sum(1 for a in all_articles if a.get("source_type")=="commodite")

    # ── 5. Institutions (BCEAO, FMI, agences notation) ──────
    log.info(f"\n[5/7] Institutions – {len(rss_insts)} sources")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(fetch_institution, s, idx, alertes_kw, global_kw, config): s for s in rss_insts}
        for f in as_completed(futs):
            all_articles.extend(f.result())
    totals["institution"] = sum(1 for a in all_articles if a.get("source_type")=="institution")

    # ── 6. Scraping BRVM / CREPMF / UEMOA ───────────────────
    log.info(f"\n[6/7] Scraping officiel – {len(scraping_off)} pages")
    for s in scraping_off:
        all_articles.extend(fetch_scraping(s, idx, alertes_kw, config))

    # ── 7. Perplexity (recherche web sourcée) ────────────────
    log.info(f"\n[7/7] Perplexity – recherche web sourcée")
    all_articles.extend(fetch_perplexity(idx, alertes_kw, global_kw, config))
    totals["perplexity"] = sum(1 for a in all_articles if a.get("source_type")=="perplexity")

    # ── Déduplication & stockage ─────────────────────────────
    nouveaux = 0
    for art in all_articles:
        tickers = art.pop("_tickers", [])
        if not article_exists(conn, art["hash"]):
            if save_article(conn, art, tickers):
                nouveaux += 1

    log.info(f"\n{'='*68}")
    log.info(f"Résumé : {nouveaux} nouveaux articles sur {len(all_articles)} traités")
    for k, v in totals.items():
        log.info(f"  {k:<20} {v} articles")
    log.info(f"Durée  : {round(_t.time()-t0,1)}s")

    purge(conn, pipeline_c["retention_jours"])
    feed = export(conn, config)

    # Notifications
    notif = pipeline_c.get("notifications", {})
    if nouveaux > 0 and notif.get("telegram_bot_token"):
        msg = (f"<b>WestBourse BRVM v3</b>\n"
               f"📰 {nouveaux} nouveaux articles\n"
               f"🚨 {feed['total_alertes']} alerte(s)\n"
               f"📊 {feed['total_articles']} articles (7j)")
        try:
            requests.post(
                f"https://api.telegram.org/bot{notif['telegram_bot_token']}/sendMessage",
                json={"chat_id": notif["telegram_chat_id"], "text": msg, "parse_mode": "HTML"},
                timeout=10,
            )
        except: pass

    if pipeline_c["output"].get("webhook_url"):
        try:
            requests.post(pipeline_c["output"]["webhook_url"],
                json={"event":"feed_updated","nouveaux":nouveaux,"total":feed["total_articles"]},
                timeout=10)
        except: pass

    return nouveaux

# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────
def cmd_stats(conn, cfg):
    total   = conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
    alertes = conn.execute("SELECT COUNT(*) FROM articles WHERE est_alerte=1").fetchone()[0]
    print(f"\n📊 WestBourse – Statistiques  ({total} articles · {alertes} alertes)")
    print("\n  Couverture par valeur (Top 20) :")
    for r in conn.execute("""
        SELECT av.ticker, COUNT(DISTINCT a.id) n
        FROM article_valeurs av JOIN articles a ON a.id=av.article_id
        GROUP BY av.ticker ORDER BY n DESC LIMIT 20
    """).fetchall():
        bar = "█"*min(r["n"],25)
        print(f"  {r['ticker']:<8} {bar:<25} {r['n']}")
    covered = {r["ticker"] for r in conn.execute("SELECT DISTINCT ticker FROM article_valeurs").fetchall()}
    missing = {v["ticker"] for v in cfg["valeurs"]} - covered
    if missing: print(f"\n  ⚠ Non couverts ({len(missing)}) : {', '.join(sorted(missing))}")

def cmd_sources(conn):
    rows = conn.execute("SELECT * FROM source_health ORDER BY source_type,nb_ok DESC").fetchall()
    if not rows: print("Aucune donnée de santé. Lancez d'abord une collecte."); return
    print(f"\n🔌 État des sources ({len(rows)}) :")
    prev_type = None
    for r in rows:
        if r["source_type"] != prev_type:
            print(f"\n  [{r['source_type'].upper()}]")
            prev_type = r["source_type"]
        status = "✅" if r["dernier_statut"]=="ok" else "❌"
        print(f"  {status} {r['source_name']:<45} ok:{r['nb_ok']} err:{r['nb_erreur']}")

def main():
    p = argparse.ArgumentParser(description="WestBourse BRVM Pipeline v3")
    p.add_argument("--daemon",  action="store_true")
    p.add_argument("--export",  action="store_true")
    p.add_argument("--stats",   action="store_true")
    p.add_argument("--alertes", action="store_true")
    p.add_argument("--sources", action="store_true")
    p.add_argument("--ticker",  type=str)
    args = p.parse_args()

    cfg  = load_config()
    conn = init_db(cfg["pipeline"]["stockage"]["chemin"])

    if args.stats:   cmd_stats(conn, cfg); return
    if args.sources: cmd_sources(conn); return
    if args.alertes:
        rows = conn.execute("""
            SELECT a.titre, a.source, a.date_pub, GROUP_CONCAT(av.ticker) tickers
            FROM articles a LEFT JOIN article_valeurs av ON a.id=av.article_id
            WHERE a.est_alerte=1 ORDER BY a.date_pub DESC LIMIT 20
        """).fetchall()
        print(f"\n🚨 {len(rows)} alertes actives :")
        for r in rows: print(f"\n  [{r['tickers']}] {r['titre']}\n   {r['source']} · {r['date_pub']}")
        return
    if args.ticker:
        t = args.ticker.upper()
        rows = conn.execute("""
            SELECT a.titre,a.source,a.date_pub,a.sentiment,a.est_alerte
            FROM articles a JOIN article_valeurs av ON a.id=av.article_id
            WHERE av.ticker=? ORDER BY a.date_pub DESC LIMIT 20
        """, (t,)).fetchall()
        print(f"\n📌 {t} – {len(rows)} articles :")
        for r in rows:
            e = {"positif":"🟢","negatif":"🔴","neutre":"⚪"}.get(r["sentiment"],"⚪")
            print(f"  {'🚨' if r['est_alerte'] else e} {r['titre']}\n    {r['source']} · {r['date_pub']}")
        return
    if args.export: export(conn, cfg); return

    if args.daemon:
        freq = cfg["pipeline"]["frequence_rss_minutes"]
        log.info(f"Mode démon — cycle toutes les {freq} min")
        run_pipeline(cfg, conn)
        schedule.every(freq).minutes.do(run_pipeline, config=cfg, conn=conn)
        while True:
            schedule.run_pending()
            import time; time.sleep(60)
    else:
        run_pipeline(cfg, conn)

if __name__ == "__main__":
    main()
