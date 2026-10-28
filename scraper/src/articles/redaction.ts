/**
 * Squelette déterministe d'un article. Chaque nombre écrit passe par `Plume`,
 * qui l'inscrit dans la liste blanche : le texte ne peut contenir que ce que la
 * donnée contient. La reformulation LLM (polishNarrative) est jugée contre
 * cette même liste, et les verrous la relisent avant publication.
 */
import type { SkeletonSection } from '../hebdo/polish.js';
import type { Fait } from './types.js';

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
  pct(x: number): string {
    return `${this.n(Math.abs(x), 2)} %`;
  }

  date(iso: string): string {
    const [a = 0, m = 1, j = 0] = iso.split('-').map(Number);
    this.liste.push(j, a);
    return `${j} ${MOIS[m - 1] ?? ''} ${a}`;
  }

  /** Les chiffres d'un nom propre sont de la donnée, pas une invention. */
  nom(texte: string): string {
    for (const x of texte.match(/\d+/g) ?? []) this.liste.push(Number(x));
    return texte;
  }
}

const SOURCE_DIVIDENDE: Source = { label: 'BRVM — calendrier des dividendes', url: 'https://www.brvm.org/fr/esv/calendrier-dividendes' };
const SOURCE_COURS: Source = { label: 'BRVM — cours des actions', url: 'https://www.brvm.org/fr/cours-actions/0' };
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

function dividende(f: Fait, nom: string, p: Plume): Corps {
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
      ? `Ce dividende représente un rendement de ${p.pct(rend)} au cours de clôture du ${p.date(str(d.date_cours)!)} (${p.n(cours)} F).`
      : '';
  const annonce = `${nom} distribuera ${montant} F par action au titre de l’exercice ${exercice}.`;

  if (f.type === 'dividende_annonce') {
    return {
      titre: `${nom} versera ${montant} F par action au titre de l’exercice ${exercice}`,
      chapo: [rendementPhrase, datesPhrase].filter(Boolean).join(' ') || annonce,
      sections: [
        { titre: 'Le dividende', texte: [annonce, rendementPhrase].filter(Boolean).join(' ') },
        ...(datesPhrase ? [{ titre: 'Les dates à retenir', texte: datesPhrase }] : []),
        {
          titre: 'Ce que cela signifie',
          texte:
            'Le rendement rapporte le dividende au cours de l’action. Il varie avec le cours : il baisse quand le cours monte, et monte quand le cours baisse.',
        },
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

function operation(f: Fait, nom: string, p: Plume): Corps {
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

function seance(f: Fait, nom: string, p: Plume): Corps {
  const d = f.donnees;
  const v = num(d.variation)!;
  const signe = v > 0 ? '+' : '−';
  const date = p.date(f.cle);
  const ratioVol = num(d.ratio_volume)!;
  const ratio = p.n(ratioVol, ratioVol % 1 ? 1 : 0);
  const record = d.record === 'haut' ? 'plus haut' : d.record === 'bas' ? 'plus bas' : null;
  const titre =
    record && Math.abs(v) < 5
      ? `${nom} touche son ${record} sur ${p.n(52)} semaines`
      : `${nom} ${v > 0 ? 'gagne' : 'perd'} ${p.pct(v)} sur un volume ${ratio} fois supérieur à sa moyenne`;
  const cloture = `Lors de la séance du ${date}, l’action ${nom} a clôturé à ${p.n(num(d.cours)!)} F (${signe}${p.pct(v)}).`;
  const seancePhrase =
    `${cloture} ${p.n(num(d.volume)!)} titres ont été échangés, contre ${p.n(num(d.volume_moyen)!)} en moyenne sur les ${p.n(num(d.seances_moyenne)!)} séances précédentes.` +
    (record ? ` Le cours atteint son ${record} sur ${p.n(52)} semaines.` : '');
  const sections: SkeletonSection[] = [{ titre: 'La séance', texte: seancePhrase }];
  const detache = num(d.dividende_detache);
  const dateDetache = str(d.date_detachement);
  if (detache != null && dateDetache) {
    sections.push({ titre: 'À noter', texte: `Le dividende de ${p.f(detache)} F par action a été détaché le ${p.date(dateDetache)}.` });
  }
  sections.push({
    titre: 'Ce que cela signifie',
    texte: 'Un volume inhabituel montre un intérêt marqué des investisseurs ce jour-là. Il ne dit pas, à lui seul, si le mouvement va se prolonger.',
  });
  return {
    titre,
    chapo: record ? `${cloture} Le cours atteint son ${record} sur ${p.n(52)} semaines.` : cloture,
    sections,
    sources: [SOURCE_COURS],
    image: { chiffre: `${signe}${p.pct(v)}`, legende: `Séance du ${date}` },
  };
}

export function rediger(f: Fait, noms: Record<string, string>): Brouillon {
  const p = new Plume();
  const nom = p.nom(noms[f.code] ?? f.code);
  const corps =
    f.type === 'operation_titres' ? operation(f, nom, p) : f.type === 'seance_hors_norme' ? seance(f, nom, p) : dividende(f, nom, p);
  return { ...corps, slug: slugDe(f), chiffres: [...new Set(p.liste)] };
}

/** Corps Markdown publié : sections, puis avertissement et sources (sans chiffre). */
export function assembler(sections: SkeletonSection[], sources: Source[]): string {
  const blocs = sections.map((s) => `## ${s.titre}\n\n${s.texte}`);
  blocs.push(`_${AVERTISSEMENT} Source : ${sources.map((s) => s.label).join(' ; ')}._`);
  return blocs.join('\n\n');
}
