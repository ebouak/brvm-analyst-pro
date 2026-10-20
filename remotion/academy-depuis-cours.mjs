// Script vidéo d'une leçon Academy, GÉNÉRÉ depuis le contenu publié
// (academy_courses.content.lessons[n]). Toute la leçon est retranscrite :
// chaque section, son texte intégral, ses chiffres, son tableau, ses étapes,
// et les graphiques de la leçon. Le texte affiché EST le texte publié ; la voix
// lit le même texte, chiffres écrits en toutes lettres (academy/verbaliser.mjs).
// Rien n'est ajouté ni reformulé : une erreur de la leçon se corrige DANS la
// leçon, puis on régénère.
//
// Usage : node academy-depuis-cours.mjs <slug> <n>     (n 1-indexé)
// Écrit academy/<id>.json (id : n1-l2, per-l3, …) et l'affiche.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verbaliser } from './academy/verbaliser.mjs';
import { entetesSupabase } from '../video/supabaseEntetes.mjs';
import {
  capitalPourObjectif, chargerDonnees, exemplesRendement, historiqueDividendes, simulerReinvestissement,
} from './academy/blocs-lecon.mjs';

const [slug, nArg] = process.argv.slice(2);
const numero = Number(nArg);
if (!slug || !/^[a-z0-9-]+$/.test(slug) || !Number.isInteger(numero) || numero < 1) {
  console.error('Usage : node academy-depuis-cours.mjs <slug> <n>');
  process.exit(1);
}

const PREFIXES = {
  'academy-niveau-1-initiation': 'n1', 'academy-niveau-2-fondamental': 'n2',
  'academy-niveau-3-technique': 'n3', 'academy-niveau-4-expert': 'n4',
  'ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang': 'ipo',
  'comprendre-le-per-et-la-valorisation-a-la-brvm': 'per',
  'suivi-dangote-brvm-ipo': 'dangote', 'etudes-de-cas-reels-brvm': 'cas',
};
const id = `${PREFIXES[slug] ?? slug.slice(0, 12)}-l${numero}`;

// ── Lecture du cours (service_role, jamais affichée) ──
const RACINE = fileURLToPath(new URL('..', import.meta.url));
const envTxt = readFileSync(`${RACINE}frontend/.env.local`, 'utf8').replace(/^﻿/, '');
const lire = (k) => envTxt.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1].trim().replace(/^"|"$/g, '') ?? '';
const get = async (chemin) => {
  const rep = await fetch(`${lire('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/${chemin}`, {
    headers: { ...entetesSupabase(lire('SUPABASE_SERVICE_ROLE_KEY')), 'User-Agent': 'westbourse-academy-video/1' },
  });
  if (!rep.ok) throw new Error(`Supabase ${chemin.split('?')[0]} : HTTP ${rep.status}`);
  return rep.json();
};
const [cours] = await get(`academy_courses?slug=eq.${slug}&select=titre,content`);
const lecons = cours?.content?.lessons ?? [];
const lecon = lecons[numero - 1];
if (!lecon) { console.error(`Leçon ${numero} introuvable dans ${slug} (${lecons.length} leçons).`); process.exit(1); }

// ── Découpage ──
const TYPE_VOIX = {
  definition: 'Définition', importance: 'Pourquoi c’est important', cas: 'Cas réel',
  piege: 'Pièges fréquents', retenir: 'À retenir', lexique: 'Lexique',
};
const PAGE_MAX = 480; // caractères affichés par écran de texte

// Nombres affichés à la française, espaces ordinaires (le verbaliseur les lit).
const nf = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n).replace(/[  ]/g, ' ');
const dateLongue = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Données réelles (blocs `donnees_reelles`) : lues UNE fois, au jour de la
// génération ; la vidéo les date à l'écran et à la voix.
const codesReels = [...new Set(lecon.sections.flatMap((s) => s.donnees_reelles?.codes ?? []))];
const reelles = codesReels.length ? await chargerDonnees(codesReels, get) : null;

/** Une ligne de contenu → bloc typé (marqueur retiré de l'affichage). */
function bloc(ligne) {
  const l = ligne.trim();
  if (/^[✗✘]/.test(l)) return { genre: 'ko', texte: l.replace(/^[✗✘]\s*/, '') };
  if (/^[✓✔]/.test(l)) return { genre: 'ok', texte: l.replace(/^[✓✔]\s*/, '') };
  const num = l.match(/^(\d{1,2})[.)]\s+(.*)$/);
  if (num) return { genre: 'num', n: Number(num[1]), texte: num[2] };
  if (/^[•▪\-–]\s+/.test(l)) return { genre: 'puce', texte: l.replace(/^[•▪\-–]\s+/, '') };
  return { genre: 'para', texte: l };
}

/** Coupe un bloc trop long en phrases, sans jamais couper une phrase. */
function scinder(b) {
  if (b.texte.length <= PAGE_MAX) return [b];
  const phrases = b.texte.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [b.texte];
  const out = [];
  let cur = '';
  for (const p of phrases) {
    if (cur && (cur + p).length > PAGE_MAX) { out.push({ ...b, texte: cur.trim() }); cur = ''; }
    cur += p;
  }
  if (cur.trim()) out.push({ ...b, texte: cur.trim() });
  return out.map((x, i) => (i ? { ...x, genre: x.genre === 'num' ? 'para' : x.genre, suite: true } : x));
}

/** Pages d'au plus PAGE_MAX caractères ou 5 blocs. */
function pages(contenu) {
  const blocs = String(contenu ?? '').split(/\n+/).filter((l) => l.trim()).map(bloc).flatMap(scinder);
  const out = [];
  let cur = [], n = 0;
  for (const b of blocs) {
    if (cur.length && (n + b.texte.length > PAGE_MAX || cur.length >= 5)) { out.push(cur); cur = []; n = 0; }
    cur.push(b); n += b.texte.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Voix d'une suite de segments + position relative (0..1) du début de chacun. */
function voixEtParts(segments) {
  const lus = segments.map((s) => verbaliser(s));
  const total = lus.reduce((a, s) => a + s.length + 1, 0) || 1;
  let cum = 0;
  const parts = lus.map((s) => { const p = cum / total; cum += s.length + 1; return Math.round(p * 1000) / 1000; });
  return { voix: lus.join(' '), parts };
}

// Certains titres publiés portent un numéro décalé (« Leçon 6 — … » en 5e
// position) : on le retire pour ne pas faire dire « Leçon 5. Leçon 6 ».
const titreLecon = String(lecon.titre).replace(/^Le[çc]on\s+\d+\s*[—–:-]\s*/i, '');

const ORDINAUX = ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit'];
const sections = [];
const titres = lecon.sections.map((s) => s.titre);

sections.push({
  n: 0, type: 'intro', titre: 'Introduction',
  scenes: [{
    id: 'intro', gabarit: 'ouverture',
    sommaire: titres.map((t) => (t.length > 46 ? `${t.slice(0, 45).trimEnd()}…` : t)),
    voix: verbaliser(`Leçon ${numero}. ${titreLecon}. ${lecon.sous_titre ? `${lecon.sous_titre} ` : ''}${lecon.resume ?? ''}`),
  }],
});

lecon.sections.forEach((s, i) => {
  const k = i + 1;
  // Un « cas » n'est annoncé « réel » que s'il l'est (même règle que le site).
  const annonce = s.type === 'cas' ? (s.reel ? 'Cas réel' : 'Exemple') : TYPE_VOIX[s.type] ?? '';
  const scenes = [{ id: `s${k}-chapitre`, gabarit: 'chapitre', voix: verbaliser(`${annonce}. ${s.titre}`) }];

  pages(s.contenu).forEach((blocs, p) => {
    const { voix, parts } = voixEtParts(blocs.map((b) => (b.genre === 'num' ? `${ORDINAUX[b.n - 1] ?? b.n} : ${b.texte}` : b.texte)));
    scenes.push({ id: `s${k}-texte-${p + 1}`, gabarit: 'texte', blocs: blocs.map((b, j) => ({ ...b, part: parts[j] })), voix });
  });

  // ── Blocs éditoriaux (2026-10-20), dans l'ordre de la page du site ──
  if (s.flux?.length) {
    // Schéma du mécanisme : chaîne animée (gabarit « étapes », générique).
    const { voix, parts } = voixEtParts(s.flux.map((e) => `${e.titre}. ${e.detail ?? ''}`));
    scenes.push({
      id: `s${k}-mecanisme`, gabarit: 'etapes',
      etapes: s.flux.map((e, j) => ({ titre: e.titre, detail: e.detail ?? '', cle: false, part: parts[j] })),
      voix,
    });
  }

  if (s.formules?.length) {
    // Trois colonnes : la grille ne rend pas les retours à la ligne d'une cellule.
    const lignes = s.formules.map((f) => [f.nom, f.expression, f.exemple ?? '']);
    const { voix, parts } = voixEtParts(
      s.formules.map((f) => `${f.nom} égale ${f.expression}.${f.exemple ? ` Exemple : ${f.exemple}.` : ''}`),
    );
    scenes.push({ id: `s${k}-formules`, gabarit: 'grille', colonnes: ['Formule', 'Calcul', 'Exemple'], lignes, note: '', parts, voix });
  }

  if (s.stats?.length) {
    const { voix, parts } = voixEtParts(s.stats.map((x) => `${x.label} : ${x.valeur}. ${x.detail ?? ''}`));
    scenes.push({
      id: `s${k}-chiffres`, gabarit: 'stats',
      stats: s.stats.map((x, j) => ({ label: x.label, valeur: x.valeur, unite: '', detail: x.detail ?? '', part: parts[j] })),
      voix,
    });
  }

  if (s.simulation?.type === 'reinvestissement') {
    const sim = s.simulation;
    const l = simulerReinvestissement(sim);
    const der = l.at(-1);
    const hyp = `Dividende et cours progressent de ${nf(sim.croissance_pct)} % par an ; réinvestissement en actions entières ; montants bruts, sans frais ni impôt.`;
    scenes.push({
      id: `s${k}-simulation`, gabarit: 'graphique', type: 'bar', titre: 'Revenu annuel, dividendes réinvestis',
      labels: l.map((x) => `An ${x.annee}`), valeurs: l.map((x) => x.revenuReinvest), unite: 'FCFA', note: `Simulation pédagogique. ${hyp}`, reel: false,
      voix: verbaliser(
        `Simulation, valeurs d’exemple. Avec des dividendes réinvestis, le revenu passe de ${nf(l[0].revenuReinvest)} FCFA la première année ` +
          `à ${nf(der.revenuReinvest)} FCFA au bout de ${sim.annees} ans, contre ${nf(der.revenuEspeces)} FCFA en les conservant en espèces. Hypothèses : ${hyp}`,
      ),
    });
    const segs = l.map((x) => `Année ${x.annee} : ${nf(x.actionsReinvest)} actions, ${nf(x.revenuReinvest)} FCFA réinvestis, contre ${nf(x.revenuEspeces)} en espèces.`);
    const { voix, parts } = voixEtParts(segs);
    scenes.push({
      id: `s${k}-simulation-tableau`, gabarit: 'grille', colonnes: ['Année', 'Actions détenues', 'Revenu réinvesti', 'En espèces'],
      lignes: l.map((x) => [`Année ${x.annee}`, nf(x.actionsReinvest), `${nf(x.revenuReinvest)} FCFA`, `${nf(x.revenuEspeces)} FCFA`]),
      note: `Simulation pédagogique : ni des données de marché, ni une prévision.`, parts, voix,
    });
  }

  if (s.simulation?.type === 'objectif') {
    const sim = s.simulation;
    const l = capitalPourObjectif(sim.revenu_cible, sim.rendements_pct);
    scenes.push({
      id: `s${k}-objectif`, gabarit: 'graphique', type: 'bar', titre: `Capital pour ${nf(sim.revenu_cible)} FCFA de dividendes par an`,
      labels: l.map((x) => `à ${nf(x.rendementPct)} %`), valeurs: l.map((x) => x.capital), unite: 'FCFA',
      note: 'Capital = revenu visé ÷ rendement. Rendements hypothétiques, non garantis.', reel: false,
      voix: verbaliser(
        `Capital nécessaire pour ${nf(sim.revenu_cible)} FCFA de dividendes bruts par an : ` +
          // « dix millions DE francs » : un million se lit avec « de ».
          `${l.map((x) => `${x.capital >= 1e6 ? `${nf(x.capital / 1e6)} millions de FCFA` : `${nf(x.capital)} FCFA`} à ${nf(x.rendementPct)} %`).join(', ')}. ` +
          'Ces rendements sont des hypothèses, pas des promesses.',
      ),
    });
  }

  if (s.donnees_reelles && reelles) {
    const spec = s.donnees_reelles;
    if (spec.vue === 'rendement') {
      const r = exemplesRendement(spec.codes, reelles.noms, reelles.dividendes, reelles.cotations, spec.actions);
      if (r.lignes.length) {
        const segs = r.lignes.map((x, j) =>
          `${j === 0 ? `Données réelles de la BRVM, séance du ${dateLongue(r.dateCours)}. ` : ''}${x.nom} : dividende net de ${nf(x.dividende)} FCFA, ` +
          `cours de ${nf(x.cours)} FCFA, soit ${nf(Math.round(x.rendementPct * 100) / 100)} %.${x.revenu != null ? ` Pour ${nf(spec.actions)} actions : ${nf(x.revenu)} FCFA.` : ''}`);
        const { voix, parts } = voixEtParts(segs);
        scenes.push({
          id: `s${k}-reel-rendement`, gabarit: 'grille', colonnes: ['Société', 'Dividende net', 'Cours', 'Rendement'],
          lignes: r.lignes.map((x) => [x.nom, `${nf(x.dividende)} FCFA (ex. ${x.exercice})`, `${nf(x.cours)} FCFA`, `${nf(Math.round(x.rendementPct * 100) / 100)} %`]),
          note: `Données réelles BRVM · dernier cours enregistré, séance du ${dateLongue(r.dateCours)} · dividendes de la base WestBourse.` +
            `${r.manquants.length ? ` Sans donnée : ${r.manquants.join(', ')}.` : ''}`,
          parts, voix,
        });
      }
    } else {
      const h = historiqueDividendes(spec.codes, reelles.noms, reelles.dividendes);
      if (h.lignes.length) {
        const segs = h.lignes.map((x, j) => {
          const v = x.montants.filter((m) => m.montant != null);
          const baisses = x.baisses === 0 ? 'aucune baisse' : x.baisses === 1 ? 'une baisse' : `${x.baisses} baisses`;
          return `${j === 0 ? `Données réelles : dividende par action, de ${h.exercices[0]} à ${h.exercices.at(-1)}. ` : ''}` +
            `${x.nom} : de ${nf(v[0].montant)} à ${nf(v.at(-1).montant)} FCFA, ${baisses}.`;
        });
        const { voix, parts } = voixEtParts(segs);
        scenes.push({
          id: `s${k}-reel-historique`, gabarit: 'grille', colonnes: ['Société', 'Baisses', `Dividende par action, ${h.exercices[0]} → ${h.exercices.at(-1)}`],
          lignes: h.lignes.map((x) => [x.nom, String(x.baisses), x.montants.map((m) => (m.montant != null ? nf(m.montant) : '—')).join(' · ')]),
          note: 'Données réelles BRVM, base WestBourse ; montants par action en FCFA, base brut ou net non vérifiée pour certains exercices anciens.' +
            `${h.manquants.length ? ` Sans donnée : ${h.manquants.join(', ')}.` : ''}`,
          parts, voix,
        });
      }
    }
  }

  if (s.tableau?.lignes?.length) {
    const t = s.tableau;
    const segs = [...t.lignes.map((l) => l.join('. ')), ...(t.note ? [t.note] : [])];
    const { voix, parts } = voixEtParts(segs);
    scenes.push({ id: `s${k}-tableau`, gabarit: 'grille', colonnes: t.colonnes, lignes: t.lignes, note: t.note ?? '', parts, voix });
  }

  if (s.etapes?.length) {
    const { voix, parts } = voixEtParts(s.etapes.map((e, j) => `${ORDINAUX[j]} : ${e.titre}. ${e.detail ?? ''}`));
    scenes.push({
      id: `s${k}-etapes`, gabarit: 'etapes',
      etapes: s.etapes.map((e, j) => ({ titre: e.titre, detail: e.detail ?? '', cle: !!e.cle, part: parts[j] })),
      voix,
    });
  }
  if (s.points?.length && s.type === 'retenir') {
    // Gabarit « idées » : chaque idée apparaît quand la voix prononce ses premiers mots.
    const textes = s.points.map((p) => (p.detail ? `${p.titre} — ${p.detail}` : p.titre));
    const voix = verbaliser(s.points.map((p) => `${p.titre}. ${p.detail ?? ''}`).join(' '));
    scenes.push({
      id: `s${k}-idees`, gabarit: 'idees',
      idees: s.points.map((p, j) => ({ texte: textes[j], mot: verbaliser(p.titre).split(/\s+/).slice(0, 3).join(' ') })),
      voix,
    });
  } else if (s.points?.length) {
    const { voix, parts } = voixEtParts(
      s.points.map((p, j) => `${ORDINAUX[j]} : ${p.titre}. ${p.detail ?? ''}${p.verifier ? ` À vérifier : ${p.verifier}` : ''}`),
    );
    scenes.push({
      id: `s${k}-points`, gabarit: 'etapes',
      etapes: s.points.map((p, j) => ({
        titre: p.titre, detail: `${p.detail ?? ''}${p.verifier ? ` · À vérifier : ${p.verifier}` : ''}`, cle: false, part: parts[j],
      })),
      voix,
    });
  }

  sections.push({ n: k, type: s.type, titre: s.titre, scenes });
});

// Graphiques de la leçon : à la fin de la dernière section qui n'est pas « À retenir ».
const graphiques = [...(lecon.chart ? [lecon.chart] : []), ...(lecon.charts ?? [])];
const cible = [...sections].reverse().find((x) => x.n > 0 && x.type !== 'retenir') ?? sections.at(-1);
graphiques.forEach((g, j) => {
  cible.scenes.push({
    id: `graphique-${j + 1}`, gabarit: 'graphique', type: g.type, titre: g.titre, labels: g.labels, valeurs: g.valeurs,
    unite: g.unite ?? '', note: g.note ?? '', reel: !!g.reel,
    voix: verbaliser(`${g.reel ? '' : 'Graphique d’illustration, valeurs d’exemple. '}${g.titre}. ${g.note ?? ''}`),
  });
});

const derniere = numero === lecons.length;
sections.at(-1).scenes.push({
  id: 'fin', gabarit: 'fin', surtitre: `Fin de la leçon ${numero}`, retenir: titreLecon,
  voix: verbaliser(`C’était la leçon ${numero} : ${titreLecon}. ${lecon.quiz?.length ? `Testez-vous avec les ${lecon.quiz.length} questions du quiz de la leçon. ` : lecon.qcm ? 'Testez-vous avec le quiz de la leçon. ' : ''}${derniere ? 'Vous avez terminé ce cours.' : 'Rendez-vous dans la leçon suivante.'}`),
});

const plan = {
  _: `Généré par academy-depuis-cours.mjs depuis academy_courses (${slug}, leçon ${numero}) le ${new Date().toISOString().slice(0, 10)}. Texte affiché = texte publié ; voix = même texte, chiffres en lettres. Ne pas éditer à la main : corriger la leçon, puis régénérer.`,
  voixTts: 'fr-FR-DeniseNeural',
  slug, numero,
  cours: String(cours.titre ?? '').replace(/\s+[—–-]\s+/, ' · '),
  lecon: `Leçon ${numero}`,
  titreLecon,
  mention: 'Contenu de la leçon WestBourse Academy, reproduit tel que publié',
  // Photo de la leçon (déjà affichée sur le site, crédit inclus), en fond de l'ouverture.
  photo: lecon.image?.url ? { url: lecon.image.url, credit: lecon.image.credit ?? '' } : null,
  sections,
};
const sortie = fileURLToPath(new URL(`./academy/${id}.json`, import.meta.url));
writeFileSync(sortie, JSON.stringify(plan, null, 2));
const scenes = sections.flatMap((x) => x.scenes);
const car = scenes.reduce((a, x) => a + x.voix.length, 0);
console.log(`${id} · ${titreLecon} · ${scenes.length} scènes · ${car} caractères de voix (≈ ${Math.round(car / 900)} min)`);
