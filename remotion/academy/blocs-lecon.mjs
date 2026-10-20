// Calculs des blocs éditoriaux d'une leçon Academy, pour la VIDÉO.
//
// COPIE des fonctions pures du site — à corriger DES DEUX CÔTÉS :
//   frontend/lib/academy/simulations.ts    (simulerReinvestissement, capitalPourObjectif)
//   frontend/lib/academy/donneesReelles.ts (exemplesRendement, historiqueDividendes)
// `remotion/` est un paquet distinct (même choix que scraper/src/hebdo/pure/).
// Le site calcule au rendu ; la vidéo fige le calcul au jour de la génération,
// et le DIT (date de séance affichée et lue).

const arrondi2 = (x) => Math.round(x * 100) / 100;

export function simulerReinvestissement(p) {
  if (!(p.actions > 0) || !(p.dpa > 0) || !(p.cours > 0) || !(p.annees >= 1)) throw new Error('simulation : paramètres impossibles');
  const g = 1 + p.croissance_pct / 100;
  const lignes = [];
  let actions = p.actions, reliquat = 0;
  for (let t = 1; t <= p.annees; t++) {
    const dpa = arrondi2(p.dpa * g ** (t - 1));
    const cours = arrondi2(p.cours * g ** (t - 1));
    const revenuEspeces = Math.round(p.actions * dpa);
    const revenuReinvest = Math.round(actions * dpa);
    const disponible = reliquat + revenuReinvest;
    const actionsAchetees = Math.floor(disponible / cours);
    lignes.push({ annee: t, dpa, cours, revenuEspeces, actionsReinvest: actions, revenuReinvest, actionsAchetees });
    reliquat = arrondi2(disponible - actionsAchetees * cours);
    actions += actionsAchetees;
  }
  return lignes;
}

export function capitalPourObjectif(revenuCible, rendementsPct) {
  return rendementsPct.map((r) => {
    if (!(r > 0)) throw new Error(`rendement ${r} % impossible`);
    return { rendementPct: r, capital: Math.round(revenuCible / (r / 100)) };
  });
}

const dernierDistribue = (code, dividendes) =>
  dividendes
    .filter((d) => d.code === code && d.exercice != null && d.montant != null && d.montant > 0)
    .sort((a, b) => b.exercice - a.exercice)[0] ?? null;

export function exemplesRendement(codes, noms, dividendes, cotations, actions) {
  const lignes = [], manquants = [];
  for (const code of codes) {
    const d = dernierDistribue(code, dividendes);
    const c = cotations.find((x) => x.code === code && x.cours > 0);
    if (!d || !c) { manquants.push(code); continue; }
    lignes.push({
      code, nom: noms[code] ?? code, exercice: d.exercice, dividende: d.montant, baseNette: d.base_fiscale === 'net',
      cours: c.cours, dateCours: c.date, rendementPct: (d.montant / c.cours) * 100,
      revenu: actions ? Math.round(actions * d.montant) : null,
    });
  }
  return { dateCours: lignes.map((l) => l.dateCours).sort().at(-1) ?? null, lignes, manquants };
}

export function historiqueDividendes(codes, noms, dividendes, nbExercices = 5) {
  const concernes = dividendes.filter((d) => codes.includes(d.code) && d.exercice != null);
  const dernier = Math.max(...concernes.map((d) => d.exercice));
  const exercices = Number.isFinite(dernier) ? Array.from({ length: nbExercices }, (_, i) => dernier - nbExercices + 1 + i) : [];
  const lignes = [], manquants = [];
  for (const code of codes) {
    const montants = exercices.map((exercice) => {
      const d = concernes.find((x) => x.code === code && x.exercice === exercice && x.montant != null && x.montant > 0);
      return { exercice, montant: d ? d.montant : null };
    });
    const verses = montants.filter((m) => m.montant != null).map((m) => m.montant);
    if (!verses.length) { manquants.push(code); continue; }
    let baisses = 0;
    for (let i = 1; i < verses.length; i++) if (verses[i] < verses[i - 1]) baisses++;
    lignes.push({ code, nom: noms[code] ?? code, montants, versements: verses.length, baisses });
  }
  return { exercices, lignes, manquants };
}

/**
 * Lecture des données réelles (lecture seule) : dividendes, désignations,
 * cours de la dernière séance enregistrée. `get(chemin)` renvoie le JSON de
 * l'API REST Supabase (en-têtes fournis par l'appelant, clé jamais affichée).
 */
export async function chargerDonnees(codes, get) {
  const liste = codes.join(',');
  const [dividendes, instruments, derniere] = await Promise.all([
    get(`dividends?select=code,exercice,montant,base_fiscale,payment_date,source&code=in.(${liste})`),
    get(`brvm_instruments?select=code,designation&code=in.(${liste})`),
    get('brvm_actions_daily?select=date_marche&order=date_marche.desc&limit=1'),
  ]);
  const date = derniere?.[0]?.date_marche ?? null;
  const cours = date ? await get(`brvm_actions_daily?select=code,cours_jour&date_marche=eq.${date}&code=in.(${liste})`) : [];
  return {
    dividendes,
    noms: Object.fromEntries(instruments.map((r) => [r.code, r.designation ?? r.code])),
    cotations: cours.filter((r) => r.cours_jour > 0).map((r) => ({ code: r.code, cours: r.cours_jour, date })),
  };
}
