/**
 * Clôture confirmée : la seule preuve qu'une séance est définitive.
 *
 * POURQUOI. La ligne du jour de `brvm_actions_daily` existe dès la première
 * collecte intraday, bien avant la fin de séance (la BRVM clôture à 15:00 UTC).
 * Publier sur elle, c'est publier des chiffres provisoires. La consolidation
 * de clôture, elle, est la commande `daily` du scraper (workflow `bdfin.yml`,
 * source BDFIN), monitorée dans `scraper_runs` sous la source `daily`.
 *
 * Colonnes RÉELLES utilisées (migration 0041 + scraper/src/index.ts) :
 *   scraper_sources.code = 'daily'
 *   scraper_runs.status = 'success'
 *   scraper_runs.finished_at            (timestamptz)
 *   scraper_runs.metadata.date_marche   (AAAA-MM-JJ, séance lue chez BDFIN)
 *   scraper_runs.metadata.nb_actions    (lignes d'actions écrites)
 * `scraper_runs` n'a PAS de colonne « date de séance » : elle n'existe que dans
 * `metadata`, écrite par le CLI `daily`. On ne l'invente pas ailleurs.
 * Le seuil de 20 lignes porte sur `nb_actions` et non sur `rows_upserted`
 * (qui additionne actions, obligations et indices) : ce sont les cours
 * d'actions que la vidéo et le point de clôture affichent.
 *
 * DUPLICATION ASSUMÉE : scraper/src/cloture/confirmation.ts porte la même
 * règle (deux paquets distincts). Toute correction se reporte des deux côtés.
 */

export const SEUIL_ACTIONS = 20;
export const HEURE_CLOTURE_UTC = 15;

/**
 * PURE. `runs` : lignes de scraper_runs de la source `daily`
 * ({ id, status, finished_at, metadata }).
 * @returns {{ confirmee: boolean, raison: string, run_id: string|null, fin: string|null }}
 */
export function evaluerCloture(seance, runs) {
  const non = (raison) => ({ confirmee: false, raison, run_id: null, fin: null });
  if (!seance || !/^\d{4}-\d{2}-\d{2}$/.test(seance)) return non('séance inconnue');
  const liste = Array.isArray(runs) ? runs : [];

  const reussis = liste.filter((r) => r && r.status === 'success' && r.finished_at);
  if (!reussis.length) return non(`aucun run « daily » réussi connu pour la séance du ${seance}`);

  const memeSeance = reussis.filter((r) => r.metadata?.date_marche === seance);
  if (!memeSeance.length) {
    const vues = [...new Set(reussis.map((r) => r.metadata?.date_marche ?? 'sans date'))].join(', ');
    return non(`aucun run « daily » réussi pour la séance du ${seance} (séances lues : ${vues})`);
  }

  const seuilFin = Date.parse(`${seance}T${String(HEURE_CLOTURE_UTC).padStart(2, '0')}:00:00Z`);
  const apres = memeSeance.filter((r) => Date.parse(r.finished_at) >= seuilFin);
  if (!apres.length) {
    return non(`run « daily » de la séance du ${seance} terminé avant ${HEURE_CLOTURE_UTC}:00 UTC (chiffres possiblement provisoires)`);
  }

  const complets = apres.filter((r) => Number(r.metadata?.nb_actions) >= SEUIL_ACTIONS);
  if (!complets.length) {
    const max = Math.max(...apres.map((r) => Number(r.metadata?.nb_actions) || 0));
    return non(`run « daily » de la séance du ${seance} avec ${max} action(s) écrite(s), moins de ${SEUIL_ACTIONS}`);
  }

  const r = [...complets].sort((a, b) => Date.parse(b.finished_at) - Date.parse(a.finished_at))[0];
  return { confirmee: true, raison: `clôture confirmée par le run « daily » terminé le ${r.finished_at}`, run_id: r.id ?? null, fin: r.finished_at };
}

/**
 * Lecture des runs `daily` utiles à une séance : réservée à la clé service
 * (scraper_runs est sous RLS sans policy). Lève si la base ne répond pas —
 * une lecture impossible n'est jamais une « clôture non confirmée » muette.
 */
export async function lireRunsDaily({ urlSupabase, entetes, seance, fetchImpl = fetch }) {
  const get = async (chemin) => {
    const r = await fetchImpl(`${urlSupabase}/rest/v1/${chemin}`, { headers: entetes });
    if (!r.ok) throw new Error(`${chemin.split('?')[0]} → HTTP ${r.status}`);
    return r.json();
  };
  const sources = await get('scraper_sources?select=id&code=eq.daily&limit=1');
  if (!sources.length) return [];
  /* Un run de la séance D démarre au plus tôt le jour D : on borne par
     started_at pour ne pas relire tout l'historique. */
  return get(
    `scraper_runs?select=id,status,finished_at,metadata&source_id=eq.${sources[0].id}` +
      `&started_at=gte.${seance}T00:00:00Z&order=finished_at.desc.nullslast&limit=50`,
  );
}

/** Chemin du marqueur « séance entièrement publiée » dans le bucket seance-video. */
export const cheminTermine = (seance) => `publication/${seance}.json`;
/** Chemin du marqueur d'une destination irréversible (telegram-canal, facebook…). */
export const cheminDestination = (seance, destination) => `publication/${seance}/${destination}.json`;

/** Un objet du bucket existe-t-il ? Lève sur toute réponse autre que 200/400/404. */
export async function objetExiste({ urlSupabase, entetes, chemin, bucket = 'seance-video', fetchImpl = fetch }) {
  const r = await fetchImpl(`${urlSupabase}/storage/v1/object/${bucket}/${chemin}`, { headers: entetes });
  if (r.ok) return true;
  const corps = await r.text().catch(() => '');
  /* Le stockage Supabase répond 400 { error: "not_found" } ou 404 pour un objet absent. */
  if (r.status === 404 || /not_found|Object not found/i.test(corps)) return false;
  throw new Error(`${chemin} → HTTP ${r.status} ${corps.slice(0, 200)}`);
}

/**
 * PURE. Décision de la porte du workflow vidéo.
 * @returns {{ a_publier: boolean, generer: boolean, raison: string }}
 */
export function decisionPorte({ generationSeule = false, dejaPubliee, cloture }) {
  if (generationSeule) {
    return { a_publier: false, generer: true, raison: 'génération seule demandée (aucune publication)' };
  }
  if (dejaPubliee) return { a_publier: false, generer: false, raison: 'séance déjà publiée — rien à refaire' };
  if (!cloture?.confirmee) return { a_publier: false, generer: false, raison: `clôture non confirmée : ${cloture?.raison ?? 'inconnue'}` };
  return { a_publier: true, generer: true, raison: cloture.raison };
}

/* ── Veille « séance sans publication » (23:00 UTC) ─────────────────────── */

/**
 * PURE. Séance visée par la veille : le jour de (maintenant − 23 h), en UTC.
 * Le cron GitHub de 23:00 part parfois avec plusieurs heures de retard ; un
 * passage à 06:00 le lendemain doit encore juger la veille, pas le jour neuf.
 */
export function jourVeille(maintenant) {
  return new Date(maintenant.getTime() - 23 * 3600_000).toISOString().slice(0, 10);
}

/** PURE. Lundi-vendredi et pas déclaré fermé dans market_calendar. */
export function estOuvre(jour, fermes = []) {
  const j = new Date(`${jour}T12:00:00Z`).getUTCDay();
  return j >= 1 && j <= 5 && !fermes.includes(jour);
}

/**
 * PURE. Faut-il alerter l'exploitant ? Jamais de saut silencieux : un jour
 * ouvré sans marqueur de Chaîne produit TOUJOURS une alerte, avec sa raison.
 * @returns {{ alerter: boolean, message: string }}
 */
export function decisionVeille({ jour, ouvre, chainePubliee, termine, cloture }) {
  if (!ouvre) return { alerter: false, message: `${jour} : jour non ouvré, rien attendu` };
  if (chainePubliee) return { alerter: false, message: `${jour} : Chaîne publiée` };
  let raison;
  if (!cloture?.confirmee) raison = `clôture non confirmée — ${cloture?.raison ?? 'inconnue'}`;
  else if (termine) raison = 'séance marquée publiée mais sans marqueur de Chaîne (Chaîne non configurée ou en échec ?)';
  else raison = `${cloture.raison}, mais la vidéo n'est pas partie — voir les runs de video-seance.yml`;
  return {
    alerter: true,
    message: `Séance du ${jour} : aucune publication sur la Chaîne WhatsApp à 23:00 UTC.\nRaison : ${raison}`,
  };
}
