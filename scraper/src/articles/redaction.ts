/**
 * Squelette déterministe d'un article. Chaque nombre écrit passe par `Plume`,
 * qui l'inscrit dans la liste blanche : le texte ne peut contenir que ce que la
 * donnée contient. La reformulation LLM (polishNarrative) est jugée contre
 * cette même liste, et les verrous la relisent avant publication.
 *
 * Écriture (skill article-writing) : le fait concret d'abord, la preuve plutôt
 * que l'adjectif, aucun paragraphe générique. Les repères (skill thesis-tracker)
 * sont des faits mesurés, jamais une recommandation.
 */
import type { SkeletonSection } from '../hebdo/polish.js';
import type { Mouvement } from './detecteurs.js';
import { nomDit } from './noms.js';
import type { Fait, RecordValeur, Reperes } from './types.js';

export interface Source {
  label: string;
  url: string;
}

export interface Brouillon {
  slug: string;
  titre: string;
  chapo: string;
  sections: SkeletonSection[];
  chiffres: number[];
  sources: Source[];
  /** Ce que l'image met en avant. */
  image: { chiffre: string; legende: string };
}

export const AVERTISSEMENT = 'Information de marché, pas un conseil en investissement.';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

class Plume {
  readonly liste: number[] = [];

  n(x: number, d = 0): string {
    const r = Number(x.toFixed(d));
    this.liste.push(r);
    return r.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[  ]/g, ' ');
  }

  /** Montant en francs : décimales seulement s'il en a. */
  f(x: number): string {
    return this.n(x, x % 1 ? 2 : 0);
  }

  /** Valeur absolue : le signe est écrit à part (le garde-fou lit les nombres sans signe). */
  pct(x: number, d = 2): string {
    return `${this.n(Math.abs(x), d)} %`;
  }

  /** Montant en FCFA, en milliards au-delà d'un milliard. */
  fcfa(x: number): string {
    const a = Math.abs(x);
    if (a >= 1e11) return `${this.n(a / 1e9, 0)} milliards FCFA`;
    return a >= 1e9 ? `${this.n(a / 1e9, 2)} milliards FCFA` : `${this.n(a / 1e6, 0)} millions FCFA`;
  }

  date(iso: string): string {
    const [a = 0, m = 1, j = 0] = iso.split('-').map(Number);
    this.liste.push(j, a);
    return `${j} ${MOIS[m - 1] ?? ''} ${a}`;
  }

  /** Les chiffres d'un texte issu de la base (nom, exercice) sont de la donnée. */
  nom(texte: string): string {
    for (const x of texte.match(/\d+/g) ?? []) this.liste.push(Number(x));
    return texte;
  }
}

const SOURCE_DIVIDENDE: Source = { label: 'BRVM — calendrier des dividendes', url: 'https://www.brvm.org/fr/esv/calendrier-dividendes' };
const SOURCE_COURS: Source = { label: 'BRVM — cours des actions', url: 'https://www.brvm.org/fr/cours-actions/0' };
const SOURCE_INDICES: Source = { label: 'BRVM — indices', url: 'https://www.brvm.org/fr/indices' };
const SOURCE_AVIS: Source = { label: 'BRVM — avis et communiqués', url: 'https://www.brvm.org/fr/avis' };

const PREFIXE: Record<Fait['type'], string> = {
  dividende_annonce: 'dividende',
  detachement_rappel: 'detachement',
  paiement_rappel: 'paiement',
  operation_titres: 'operation',
  seance_hors_norme: 'seance',
};
const slugDe = (f: Fait) => `${PREFIXE[f.type]}-${f.code}-${f.cle}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

type Corps = Omit<Brouillon, 'slug' | 'chiffres'>;
interface Outils {
  p: Plume;
  nom: string;
  nomDe: (code: string) => string;
  reperes: Reperes | null;
}

/* ── Repères « thèse » : faits mesurés, du pour comme du contre ─────────── */

const SIGNAL: Record<string, string> = {
  BUY: 'achat',
  SELL: 'vente',
  HOLD: 'neutre — le moteur ne relève ni signal d’achat ni signal de vente',
};

function reperesSection(o: Outils, cours: number | null, haut: number | null, bas: number | null): SkeletonSection | null {
  const { p, reperes: r } = o;
  const lignes: string[] = [];
  if (r?.bpa && r.bpa > 0 && cours) {
    lignes.push(
      `- **Valorisation** : ${p.n(cours / r.bpa, 1)} fois le bénéfice par action de l’exercice ${p.nom(r.exercice_bpa ?? '')} (${p.f(r.bpa)} F).`,
    );
  }
  const [d0, d1] = r?.dividendes ?? [];
  if (d0 && cours) {
    const evolution =
      d1 && d1.montant > 0
        ? ` Il était de ${p.f(d1.montant)} F au titre de l’exercice ${p.nom(String(d1.exercice))}, soit une ${d0.montant >= d1.montant ? 'hausse' : 'baisse'} de ${p.pct(((d0.montant - d1.montant) / d1.montant) * 100, 1)}.`
        : '';
    lignes.push(
      `- **Rendement** : dividende de ${p.f(d0.montant)} F au titre de l’exercice ${p.nom(String(d0.exercice))}, soit ${p.pct((d0.montant / cours) * 100)} au cours du jour.${evolution}`,
    );
  }
  if (r?.liquidite_classe && r.liquidite_score != null) {
    lignes.push(`- **Liquidité** : classe ${r.liquidite_classe}, score de ${p.n(r.liquidite_score)} sur ${p.n(100)}.`);
  }
  if (cours && haut && bas && haut > bas) {
    lignes.push(
      cours >= haut
        ? `- **Sur ${p.n(52)} semaines** : le cours est à son plus haut (${p.f(haut)} F).`
        : `- **Sur ${p.n(52)} semaines** : le cours est ${p.pct(((haut - cours) / haut) * 100, 1)} sous son plus haut (${p.f(haut)} F) et ${p.pct(((cours - bas) / bas) * 100, 1)} au-dessus de son plus bas (${p.f(bas)} F).`,
    );
  }
  if (r?.signal && SIGNAL[r.signal]) lignes.push(`- **Signal WESTBOURSE** : ${SIGNAL[r.signal]}.`);
  return lignes.length ? { titre: 'Repères pour l’investisseur', texte: lignes.join('\n') } : null;
}

/* ── Dividendes ─────────────────────────────────────────────────────────── */

function dividende(f: Fait, o: Outils): Corps {
  const { p, nom } = o;
  const d = f.donnees;
  const montant = p.f(num(d.montant)!);
  const exercice = p.nom(String(num(d.exercice)));
  const ex = str(d.ex_date);
  const paie = str(d.payment_date);
  const rend = num(d.rendement);
  const cours = num(d.cours);
  const dates = [ex ? `Détachement le ${p.date(ex)}` : null, paie ? `paiement le ${p.date(paie)}` : null]
    .filter(Boolean)
    .join(', ')
    .replace(/^p/, 'P');
  const datesPhrase = dates ? `${dates}.` : '';
  const rendementPhrase =
    rend != null && cours != null && str(d.date_cours)
      ? `Ce dividende représente un rendement de ${p.pct(rend)} au cours de clôture du ${p.date(str(d.date_cours)!)} (${p.f(cours)} F).`
      : '';
  const annonce = `${nom} distribuera ${montant} F par action au titre de l’exercice ${exercice}.`;

  if (f.type === 'dividende_annonce') {
    const reperes = reperesSection(o, cours, null, null);
    return {
      titre: `${nom} versera ${montant} F par action au titre de l’exercice ${exercice}`,
      chapo: [rendementPhrase, datesPhrase].filter(Boolean).join(' ') || annonce,
      sections: [
        { titre: 'Le dividende', texte: [annonce, rendementPhrase].filter(Boolean).join(' ') },
        ...(datesPhrase ? [{ titre: 'Les dates à retenir', texte: datesPhrase }] : []),
        ...(reperes ? [reperes] : []),
      ],
      sources: [SOURCE_DIVIDENDE],
      image: { chiffre: `${montant} F`, legende: `Dividende par action, exercice ${exercice}` },
    };
  }

  if (f.type === 'detachement_rappel') {
    const date = p.date(ex!);
    return {
      titre: `${nom} : détachement du dividende de ${montant} F le ${date}`,
      chapo: `Le ${date}, l’action ${nom} se négociera sans le droit au dividende de ${montant} F par action (exercice ${exercice}).${paie ? ` Paiement le ${p.date(paie)}.` : ''}`,
      sections: [
        { titre: 'Le calendrier', texte: datesPhrase },
        {
          titre: 'Ce que change le détachement',
          texte:
            'Le jour du détachement, le cours de référence est en principe diminué du montant du dividende. Le dividende revient aux actionnaires qui détenaient l’action avant cette date.',
        },
        ...(rendementPhrase ? [{ titre: 'Le rendement', texte: rendementPhrase }] : []),
      ],
      sources: [SOURCE_DIVIDENDE],
      image: { chiffre: `${montant} F`, legende: `Détachement le ${date}` },
    };
  }

  const date = p.date(paie!);
  return {
    titre: `${nom} : paiement du dividende de ${montant} F le ${date}`,
    chapo: `${nom} paiera le ${date} son dividende de ${montant} F par action au titre de l’exercice ${exercice}.`,
    sections: [
      { titre: 'Le calendrier', texte: datesPhrase },
      {
        titre: 'Comment il est versé',
        texte:
          'Le dividende est crédité sur le compte titres, auprès de la SGI qui tient le compte, après déduction de la retenue à la source applicable.',
      },
    ],
    sources: [SOURCE_DIVIDENDE],
    image: { chiffre: `${montant} F`, legende: `Paiement le ${date}` },
  };
}

/* ── Opération sur titres ───────────────────────────────────────────────── */

function operation(f: Fait, o: Outils): Corps {
  const { p, nom } = o;
  const d = f.donnees;
  const ratio = num(d.ratio)!;
  const date = p.date(str(d.date_effet)!);
  const fractionnement = d.operation === 'fractionnement';
  const k = fractionnement ? ratio : 1 / ratio;
  const kTxt = p.n(k);
  const un = p.n(1);
  const exemple = fractionnement
    ? `Un portefeuille de ${p.n(100)} actions en compte ${p.n(100 * k)}.`
    : `Un portefeuille de ${p.n(100 * k)} actions en compte ${p.n(100)}.`;
  return {
    titre: fractionnement
      ? `${nom} divise son action par ${kTxt} à compter du ${date}`
      : `${nom} regroupe ses actions par ${kTxt} à compter du ${date}`,
    chapo: fractionnement
      ? `À compter du ${date}, chaque action ${nom} est remplacée par ${kTxt} actions nouvelles, et le cours est divisé par ${kTxt}.`
      : `À compter du ${date}, ${kTxt} actions ${nom} anciennes forment une action nouvelle, et le cours est multiplié par ${kTxt}.`,
    sections: [
      {
        titre: 'Pour un actionnaire',
        texte: `${exemple} La valeur de la ligne ne change pas : seuls le nombre d’actions et le cours unitaire changent.`,
      },
      {
        titre: 'Sur WESTBOURSE',
        texte:
          'L’historique des cours, des dividendes et des portefeuilles est ajusté, pour que les variations restent comparables avant et après l’opération.',
      },
    ],
    sources: [SOURCE_AVIS],
    image: {
      chiffre: fractionnement ? `${un} → ${kTxt}` : `${kTxt} → ${un}`,
      legende: `${fractionnement ? 'Fractionnement' : 'Regroupement'} le ${date}`,
    },
  };
}

/* ── Compte rendu de séance ─────────────────────────────────────────────── */

const LIBELLE_INDICE: Record<string, string> = { BRVMC: 'BRVM Composite', BRVM30: 'BRVM 30', BRVMPRES: 'BRVM Prestige' };

function seance(f: Fait, o: Outils): Corps {
  const { p, nom, nomDe } = o;
  const d = f.donnees;
  const date = p.date(f.cle);
  const v = num(d.variation)!;
  const cours = num(d.cours)!;
  const rang = num(d.rang) ?? 1;
  const gagne = (x: number) => (x > 0 ? 'gagne' : x < 0 ? 'perd' : 'est stable');
  const signe = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '');
  const variationDe = (x: number) => (x === 0 ? 'stable' : `${signe(x)}${p.pct(x)}`);

  // Le marché
  const indices = (d.indices ?? {}) as Record<string, { valeur: number; variation: number } | null>;
  const composite = indices.BRVMC ?? null;
  const phrasesIndices = Object.entries(LIBELLE_INDICE)
    .filter(([k]) => indices[k])
    .map(([k, libelle]) => {
      const i = indices[k]!;
      return i.variation === 0
        ? `le ${libelle} est stable à ${p.n(i.valeur, 2)} points`
        : `le ${libelle} ${i.variation > 0 ? 'gagne' : 'perd'} ${p.pct(i.variation)} à ${p.n(i.valeur, 2)} points`;
    });
  const sens = !composite ? null : composite.variation > 0 ? 'en hausse' : composite.variation < 0 ? 'en baisse' : 'à l’équilibre';
  const ouverture = sens ? `La BRVM termine la séance du ${date} ${sens}` : `Séance du ${date} à la BRVM`;
  // Énumération française : « a, b et c » (pas de regex — les décimales portent des virgules).
  const enumere = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}` : (xs[0] ?? ''));
  const marche =
    `${ouverture}${phrasesIndices.length ? ` : ${enumere(phrasesIndices)}` : ''}. ` +
    `${p.n(num(d.hausses)!)} valeurs progressent, ${p.n(num(d.baisses)!)} reculent et ${p.n(num(d.stables)!)} sont stables ; ` +
    `${p.fcfa(num(d.total)!)} ont été échangés.`;

  // La valeur du jour
  const prec = num(d.cours_precedent);
  const valeur = num(d.valeur) ?? 0;
  const part = num(d.part) ?? 0;
  const lignesValeur: string[] = [
    `${nom} clôture à ${p.f(cours)} F (${variationDe(v)}${prec ? `, contre ${p.f(prec)} F la veille` : ''}).`,
  ];
  if (valeur > 0) {
    lignesValeur.push(
      `${p.n(num(d.volume) ?? 0)} titres ont changé de mains pour ${p.fcfa(valeur)}, soit ${p.pct(part)} des capitaux de la séance.`,
    );
  }
  const delta = num(d.capitalisation_delta);
  if (delta != null && Math.abs(delta) >= 1e6) {
    lignesValeur.push(`Sa capitalisation ${delta > 0 ? 'augmente' : 'recule'} de ${p.fcfa(delta)}.`);
  }
  const rec = d.record_prec as RecordValeur | null;
  if (d.record_valeur === true && rec) {
    lignesValeur.push(
      `C’est la plus forte valeur échangée sur ${nom} depuis le début de notre historique, le ${p.date(rec.depuis)} ; le précédent sommet datait du ${p.date(rec.date)} (${p.fcfa(rec.valeur)}).`,
    );
  }
  const ratio = num(d.ratio_volume);
  if (ratio != null && ratio >= 1.5) {
    lignesValeur.push(`Le volume représente ${p.n(ratio, ratio % 1 ? 1 : 0)} fois la moyenne des ${p.n(num(d.seances_moyenne)!)} séances précédentes.`);
  }
  if (d.record === 'haut' || d.record === 'bas') {
    lignesValeur.push(`Le cours touche son ${d.record === 'haut' ? 'plus haut' : 'plus bas'} sur ${p.n(52)} semaines.`);
  }
  const op = d.operation as { type: string; ratio: number; date_effet: string } | null;
  if (op) {
    lignesValeur.push(
      op.type === 'fractionnement'
        ? `L’action se négocie depuis le ${p.date(op.date_effet)} après un fractionnement : une action ancienne est devenue ${p.n(op.ratio)} actions nouvelles.`
        : `L’action se négocie depuis le ${p.date(op.date_effet)} après un regroupement de ses titres.`,
    );
  }
  const detache = num(d.dividende_detache);
  if (detache != null && str(d.date_detachement)) {
    lignesValeur.push(`Le dividende de ${p.f(detache)} F par action a été détaché le ${p.date(str(d.date_detachement)!)}.`);
  }

  // Les autres mouvements
  const liste = (ms: Mouvement[]) => ms.map((m) => `${nomDe(m.code)} (${signe(m.variation)}${p.pct(m.variation)} à ${p.f(m.cours)} F)`).join(', ');
  const hausses = (d.top_hausses ?? []) as Mouvement[];
  const baisses = (d.top_baisses ?? []) as Mouvement[];
  const autres = [
    hausses.length ? `Côté hausses : ${liste(hausses)}.` : '',
    baisses.length ? `Côté baisses : ${liste(baisses)}.` : '',
  ].filter(Boolean);

  const sections: SkeletonSection[] = [
    { titre: 'Le marché', texte: marche },
    { titre: nom, texte: lignesValeur.join(' ') },
  ];
  if (autres.length) sections.push({ titre: 'Les autres mouvements', texte: autres.join(' ') });
  const reperes = reperesSection(o, cours, num(d.cours_haut_52s), num(d.cours_bas_52s));
  if (reperes) sections.push(reperes);

  const titre =
    rang === 4 && valeur > 0
      ? `BRVM : ${nom} signe un record de ${p.fcfa(valeur)} échangés`
      : rang === 3
        ? `BRVM : ${nom} concentre ${p.pct(part, 0)} des échanges et ${gagne(v)}${v !== 0 ? ` ${p.pct(v)}` : ''}`
        : rang === 2 && ratio != null
          ? `BRVM : ${nom} ${gagne(v)}${v !== 0 ? ` ${p.pct(v)}` : ''} sur un volume ${p.n(ratio, ratio % 1 ? 1 : 0)} fois supérieur à sa moyenne`
          : composite
            ? `BRVM : le Composite ${composite.variation > 0 ? 'progresse' : composite.variation < 0 ? 'recule' : 'est stable'}${composite.variation !== 0 ? ` de ${p.pct(composite.variation)}` : ''}, ${nom} ${gagne(v)}${v !== 0 ? ` ${p.pct(v)}` : ''}`
            : `BRVM : ${nom} ${gagne(v)}${v !== 0 ? ` ${p.pct(v)}` : ''}`;

  const image =
    rang === 4 && valeur > 0
      ? { chiffre: p.fcfa(valeur).replace(' milliards FCFA', ' Md'), legende: `${nom} · record de capitaux` }
      : rang === 3
        ? { chiffre: p.pct(part, 0), legende: `des échanges captés par ${nom}` }
        : { chiffre: variationDe(v), legende: `${nom} · séance du ${date}` };

  return {
    titre,
    chapo: `${ouverture}${composite ? ` : le BRVM Composite ${gagne(composite.variation)}${composite.variation !== 0 ? ` ${p.pct(composite.variation)}` : ''}` : ''}. ${lignesValeur.slice(0, 2).join(' ')}`,
    sections,
    sources: [SOURCE_COURS, SOURCE_INDICES],
    image,
  };
}

export function rediger(f: Fait, noms: Record<string, string>, reperes: Reperes | null = null): Brouillon {
  const p = new Plume();
  const toutes = Object.values(noms);
  const nomDe = (code: string) => p.nom(nomDit(noms[code] ?? code, toutes));
  const o: Outils = { p, nom: nomDe(f.code), nomDe, reperes };
  const corps = f.type === 'operation_titres' ? operation(f, o) : f.type === 'seance_hors_norme' ? seance(f, o) : dividende(f, o);
  return { ...corps, slug: slugDe(f), chiffres: [...new Set(p.liste)] };
}

/** Corps Markdown publié : sections, puis avertissement et sources (sans chiffre). */
export function assembler(sections: SkeletonSection[], sources: Source[]): string {
  const blocs = sections.map((s) => `## ${s.titre}\n\n${s.texte}`);
  blocs.push(`_${AVERTISSEMENT} Source : ${sources.map((s) => s.label).join(' ; ')}._`);
  return blocs.join('\n\n');
}
