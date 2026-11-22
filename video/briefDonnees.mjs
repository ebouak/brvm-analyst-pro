/**
 * Données du brief de clôture — fonctions PURES, testées (briefDonnees.test.mjs).
 *
 * `genere.mjs` les applique UNE fois pour figer `seance.json` (la même lecture
 * que la vidéo) ; `brief.mjs` et `brief-envoi.mjs` ne font que lire le
 * résultat. Aucune n'interroge la base : une seconde lecture serait une
 * seconde chance de se contredire (la voix qui annonçait 31 hausses quand
 * l'écran en montrait 18).
 */

const nombre = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/* ── Actualités : un résumé qui n'en est pas un ne s'affiche pas ───────────
   Constaté le 28/09/2026 : la « phare » affichait « Ce contenu est réservé
   aux membres. Visitez le site et connectez-vous… » — le texte d'un mur
   payant récupéré à la place du résumé. */
const MUR_PAYANT = /réservé aux (membres|abonnés)|connectez-vous|adhérez|abonnez-vous|lire la suite|contenu (premium|réservé)|subscribe to read/i;

export function nettoyerResume(resume) {
  const t = String(resume ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < 40 || MUR_PAYANT.test(t)) return null;
  return t;
}

/* ── Clôture de la veille ──────────────────────────────────────────────── */

/** `cours_precedent` quand la base le donne, sinon déduit de la variation publiée. */
export function precedentDe(a) {
  const cp = nombre(a.cours_precedent);
  if (cp != null && cp > 0) return cp;
  const c = nombre(a.cours_jour);
  const v = nombre(a.variation_pct);
  if (c == null || v == null || v <= -100) return null;
  return Math.round((c / (1 + v / 100)) * 100) / 100;
}

/** Cours de la séance pour toutes les valeurs : ce dont a besoin « Votre séance ». */
export function coursSeance(actions) {
  return (actions ?? [])
    .filter((a) => nombre(a.cours_jour) != null && nombre(a.cours_jour) > 0)
    .map((a) => ({
      code: a.code,
      cours: nombre(a.cours_jour),
      variation_pct: nombre(a.variation_pct),
      precedent: precedentDe(a),
    }));
}

/* ── Courbe du jour de l'indice ────────────────────────────────────────────
   Relevés réels de la collecte (brvm_indices_snapshots, migration 0256).
   Les relevés pris après la séance qui répètent la dernière valeur sont
   écartés ; aucun point n'est ajouté entre deux relevés. */
export function pointsIntraday(releves, finSeanceUtc = 16) {
  const tries = (releves ?? [])
    .map((r) => ({ t: r.captured_at, ms: Date.parse(r.captured_at), valeur: nombre(r.valeur) }))
    .filter((p) => Number.isFinite(p.ms) && p.valeur != null && p.valeur > 0)
    .sort((a, b) => a.ms - b.ms);
  const points = [];
  for (const p of tries) {
    const dernier = points[points.length - 1];
    if (dernier && dernier.ms === p.ms) continue;
    if (dernier && new Date(p.ms).getUTCHours() >= finSeanceUtc && dernier.valeur === p.valeur) continue;
    points.push(p);
  }
  return points.map(({ t, valeur }) => ({ t, valeur }));
}

/* ── À l'agenda ─────────────────────────────────────────────────────────────
   Les jours qui suivent la séance : détachements et paiements de dividendes,
   assemblées générales. Seules les lignes fiables entrent :
   - dividende : montant > 0 ET exercice connu (les lignes à 0 ou sans
     exercice sont écartées, comme le fait l'agent — CLAUDE.md, audit du
     2026-09-08) ; le montant est NET (base de la table) ;
   - assemblée : listée par le DERNIER bulletin lu (sinon retirée ou reportée). */
const plusJours = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function construireAgenda({ seance, dividendes = [], assemblees = [], dernierBulletin = null, jours = 7, max = 6 }) {
  const fin = plusJours(seance, jours);
  const dans = (d) => typeof d === 'string' && d > seance && d <= fin;
  const items = [];
  for (const d of dividendes ?? []) {
    const montant = nombre(d.montant);
    if (!d.code || montant == null || montant <= 0 || d.exercice == null) continue;
    if (dans(d.ex_date)) items.push({ date: d.ex_date, type: 'detachement', code: d.code, montant });
    if (dans(d.payment_date)) items.push({ date: d.payment_date, type: 'paiement', code: d.code, montant });
  }
  for (const a of assemblees ?? []) {
    if (!a.code || !dans(a.date_ag)) continue;
    if (dernierBulletin && a.dernier_bulletin !== dernierBulletin) continue;
    items.push({ date: a.date_ag, type: 'ag', code: a.code, nature: a.nature_cle ?? null });
  }
  const vus = new Set();
  const ordre = { detachement: 0, paiement: 1, ag: 2 };
  return items
    .filter((i) => {
      const k = `${i.type}|${i.code}|${i.date}`;
      if (vus.has(k)) return false;
      vus.add(k);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : ordre[a.type] - ordre[b.type] || a.code.localeCompare(b.code)))
    .slice(0, max);
}

/* ── Votre séance (personnel, jamais stocké) ───────────────────────────────
   Variation du jour des positions EN ACTIONS (liquidités exclues), au cours
   de clôture, contre la clôture de la veille. Une valeur sans cours ou sans
   veille connus est comptée à part, jamais estimée. */
export function votreSeance(positions, m) {
  const cours = new Map((m?.cours_seance ?? []).map((c) => [c.code, c]));
  const parCode = new Map();
  for (const p of positions ?? []) {
    const q = nombre(p.quantite);
    if (!p.code || p.code === 'LIQUIDITES' || q == null || q <= 0) continue;
    parCode.set(p.code, (parCode.get(p.code) ?? 0) + q);
  }
  const lignes = [];
  let ecart = 0;
  let valeur = 0;
  let veille = 0;
  let sansCours = 0;
  for (const [code, quantite] of parCode) {
    const c = cours.get(code);
    if (!c || c.cours == null || c.precedent == null) { sansCours++; continue; }
    const e = quantite * (c.cours - c.precedent);
    lignes.push({ code, quantite, cours: c.cours, variation_pct: c.variation_pct, ecart: e });
    ecart += e;
    valeur += quantite * c.cours;
    veille += quantite * c.precedent;
  }
  if (lignes.length === 0) return null;
  lignes.sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart) || a.code.localeCompare(b.code));
  return {
    lignes,
    ecart: Math.round(ecart),
    valeur: Math.round(valeur),
    pct: veille > 0 ? (ecart / veille) * 100 : null,
    sansCours,
  };
}
