/**
 * Décryptage d'une valeur, au format du skill thesis-tracker :
 *   énoncé de thèse → tableau des piliers (seuil, mesure, tendance, statut)
 *   → ce qui soutient / ce qui fragilise → ce qui invaliderait la thèse
 *   → journal des faits récents → calendrier des catalyseurs datés.
 *
 * PUR et sans modèle de langage : chaque chiffre vient du dossier valeur
 * (lib/dossier/build.ts), déjà contrôlé, et chaque appréciation de
 * construireNarratif. La thèse est RÉFUTABLE (skill) : chaque pilier tenu
 * expose le seuil qui le ferait tomber. Aucun objectif de cours, aucune
 * « conviction », aucune position — ce n'est pas une recommandation.
 */
import type { DossierValeur } from '@/lib/dossier/build';
import type { Narratif } from '@/lib/dossier/narratif';
import type { Pilier } from '@/lib/dossier/suivi';
import { fmtFcfa, fmtNumber } from '@/lib/format';

export interface FaitRecent {
  slug: string;
  titre: string;
  type: string;
  date_fait: string;
}

export interface ArticleDecryptage {
  slug: string;
  fait: string;
  titre: string;
  chapo: string;
  corps_md: string;
  date_fait: string;
  chiffres: Record<string, unknown>;
  sources: { label: string; url: string }[];
}

export const AVERTISSEMENT = 'Information de marché, pas un conseil en investissement.';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const date = (iso: string) => {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return `${j} ${MOIS[(m ?? 1) - 1]} ${a}`;
};
const espace = (s: string) => s.replace(/[  ]/g, ' ');
const pct = (x: number, d = 1) => `${espace(fmtNumber(x * 100, d))} %`;
const fcfa = (x: number | null) => (x == null ? '—' : `${espace(fmtFcfa(x))} FCFA`);

const STATUT: Record<Pilier['statut'], string> = {
  tenu: '✅ Tenu',
  non_tenu: '❌ Non tenu',
  non_mesurable: '— Non mesurable',
  non_applicable: 'Sans objet',
};
const TENDANCE: Record<string, string> = { hausse: '↗', baisse: '↘', stable: '→' };

function mesure(p: Pilier): string {
  if (p.mesure == null) return '—';
  if (p.unite === '%') return pct(p.mesure);
  if (p.unite === 'x') return `${espace(fmtNumber(p.mesure, 1))} fois`;
  return `${espace(fmtNumber(p.mesure, p.mesure % 1 ? 2 : 0))} F`;
}

/** Pilier touché par un fait récent — le lien que le journal de thèse doit expliciter. */
const PILIER_DU_FAIT: Record<string, string> = {
  dividende_annonce: 'Dividende',
  detachement_rappel: 'Dividende',
  paiement_rappel: 'Dividende',
  operation_titres: 'Aucun : un fractionnement ne change pas la valeur',
  seance_hors_norme: 'Marché : cours et liquidité',
  decryptage: '—',
};

const cellule = (s: string) => s.replace(/\|/g, '/');

export function composerDecryptage(
  d: DossierValeur,
  n: Narratif,
  faits: FaitRecent[],
  nom: string,
  aujourdhui: string,
): ArticleDecryptage {
  const code = d.identite.code;
  const c = d.chiffres_cles;
  const piliers = d.suivi.piliers;
  const mesurables = piliers.filter((p) => p.statut === 'tenu' || p.statut === 'non_tenu');
  const tenus = piliers.filter((p) => p.statut === 'tenu');
  const nonTenus = piliers.filter((p) => p.statut === 'non_tenu');
  // « PER », « ROE » restent en capitales : on ne baisse que l'initiale d'un mot ordinaire.
  const bas = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

  const enonce =
    mesurables.length === 0
      ? `Aucun pilier de la thèse n’est mesurable avec les comptes en base : ce décryptage s’en tient aux faits disponibles.`
      : `Sur ${mesurables.length} piliers mesurables, ${tenus.length} ${tenus.length > 1 ? 'sont tenus' : 'est tenu'}` +
        (tenus.length ? ` (${tenus.map((p) => bas(p.libelle)).join(', ')})` : '') +
        (nonTenus.length ? ` ; ${nonTenus.map((p) => bas(p.libelle)).join(', ')} ${nonTenus.length > 1 ? 'ne le sont pas' : 'ne l’est pas'}.` : '.');

  const sections: string[] = [];

  sections.push(`## La thèse en une phrase\n\n${enonce} Ce décryptage confronte cette lecture à ses risques et à son calendrier ; il ne conclut ni à l’achat ni à la vente.`);

  sections.push(
    [
      '## Tableau de bord de la thèse',
      '',
      '| Pilier | Seuil suivi | Mesure | Tendance | Statut |',
      '|---|---|---|---|---|',
      ...piliers.map(
        (p) =>
          `| ${cellule(p.libelle)} | ${cellule(p.seuil)} | ${mesure(p)} | ${p.tendance ? TENDANCE[p.tendance] : '—'} | ${STATUT[p.statut]} |`,
      ),
    ].join('\n'),
  );

  const liste = (xs: { texte: string }[], vide: string) => (xs.length ? xs.map((x) => `- ${x.texte}`).join('\n') : vide);
  sections.push(`## Ce qui soutient la thèse\n\n${liste(n.forces, 'Aucun point fort mesurable dans les comptes en base.')}`);
  sections.push(`## Ce qui la fragilise\n\n${liste(n.risques, 'Aucun point de vigilance mesurable dans les comptes en base.')}`);

  // Réfutable (skill) : ce qui ferait tomber chaque pilier aujourd'hui tenu.
  sections.push(
    `## Ce qui invaliderait la thèse\n\n` +
      (tenus.length
        ? tenus.map((p) => `- **${p.libelle}** : le pilier tombe si ce seuil n’est plus respecté — ${bas(p.seuil)}`).join('\n')
        : 'Aucun pilier n’étant tenu, la thèse ne repose aujourd’hui sur aucun appui mesuré.'),
  );

  sections.push(
    faits.length
      ? [
          '## Journal des faits récents',
          '',
          '| Date | Fait | Pilier concerné |',
          '|---|---|---|',
          ...faits.map((f) => `| ${date(f.date_fait)} | [${cellule(f.titre)}](/actualites/${f.slug}) | ${PILIER_DU_FAIT[f.type] ?? '—'} |`),
        ].join('\n')
      : '## Journal des faits récents\n\nAucun article publié sur cette valeur à ce jour.',
  );

  const rdv = d.suivi.rendez_vous;
  sections.push(
    rdv.length
      ? ['## Calendrier des catalyseurs', '', '| Date | Événement |', '|---|---|', ...rdv.map((r) => `| ${date(r.date)} | ${cellule(r.libelle)} |`)].join('\n')
      : '## Calendrier des catalyseurs\n\nAucun rendez-vous daté en base à ce jour (détachement, paiement, publication).',
  );

  if (d.trajectoire.length) {
    sections.push(
      [
        '## Trajectoire des comptes',
        '',
        '| Exercice | Chiffre d’affaires | Résultat net |',
        '|---|---|---|',
        ...d.trajectoire.map((t) => `| ${t.exercice} | ${fcfa(t.chiffre_affaires)} | ${fcfa(t.resultat_net)} |`),
      ].join('\n'),
    );
  }

  const divs = d.dividende.historique.filter((h) => h.exercice != null && h.montant != null).slice(-5);
  if (divs.length) {
    sections.push(
      `## Dividendes\n\n` +
        divs.map((h) => `- Exercice ${h.exercice} : ${espace(fmtNumber(h.montant!, h.montant! % 1 ? 2 : 0))} F`).join('\n') +
        (d.dividende.rendement != null ? `\n\nRendement au cours actuel : ${pct(d.dividende.rendement, 2)}.` : ''),
    );
  }

  const med = d.suivi.medianes;
  if (med && med.lignes.length) {
    // Ici les pourcentages sont déjà exprimés en % (29,6 et non 0,296).
    const val = (x: number | null, u: '%' | 'x') => (x == null ? '—' : u === '%' ? `${espace(fmtNumber(x, 1))} %` : `${espace(fmtNumber(x, 1))} fois`);
    sections.push(
      [
        `## Face à ses comparables (${med.groupe}, ${med.nbSocietes} sociétés)`,
        '',
        'Ces valeurs viennent du calcul comparatif des sociétés cotées, mis à jour périodiquement : elles peuvent différer légèrement des chiffres du jour donnés plus haut.',
        '',
        `| Indicateur | ${nom} | Médiane | Lecture |`,
        '|---|---|---|---|',
        ...med.lignes.map(
          (l) => `| ${cellule(l.libelle)} | ${val(l.valeur, l.unite)} | ${val(l.mediane, l.unite)} | ${l.lecture === 'favorable' ? 'Favorable' : l.lecture === 'defavorable' ? 'Défavorable' : l.lecture === 'neutre' ? 'Neutre' : '—'} |`,
        ),
      ].join('\n'),
    );
  }

  const liq = d.suivi.liquidite;
  if (liq?.classe) {
    sections.push(
      `## Liquidité\n\nClasse ${liq.classe}${liq.score != null ? `, score de ${liq.score} sur 100` : ''}` +
        (liq.spread_pct != null ? `, fourchette de ${espace(fmtNumber(liq.spread_pct, 2))} %${liq.spread_source === 'roll' ? ' (estimée)' : ''}` : '') +
        '.',
    );
  }

  sections.push(`_${AVERTISSEMENT} Source : comptes publiés, BRVM, calculs WESTBOURSE (dossier valeur)._`);

  const jour = aujourdhui.slice(0, 10);
  const titre =
    mesurables.length > 0
      ? `Décryptage — ${nom} : ${tenus.length} pilier${tenus.length > 1 ? 's' : ''} de thèse tenu${tenus.length > 1 ? 's' : ''} sur ${mesurables.length}`
      : `Décryptage — ${nom} : ce que disent les comptes`;
  const chapo =
    `${nom} cote ${c.cours != null ? `${espace(fmtNumber(c.cours, 0))} F` : '—'}${c.date_cours ? ` au ${date(c.date_cours)}` : ''}` +
    `${c.capitalisation != null ? `, pour une capitalisation de ${fcfa(c.capitalisation)}` : ''}. ` +
    (mesurables.length
      ? `Sur ${mesurables.length} piliers mesurables de sa thèse, ${tenus.length} ${tenus.length > 1 ? 'sont tenus' : 'est tenu'} ; ${n.risques.length} point${n.risques.length > 1 ? 's' : ''} de vigilance.`
      : 'Ses comptes ne permettent de mesurer aucun pilier de thèse.');

  return {
    slug: `decryptage-${code.toLowerCase()}-${jour}`,
    fait: `decryptage|${code}|${jour}`,
    titre,
    chapo,
    corps_md: sections.join('\n\n'),
    date_fait: c.date_cours ?? jour,
    chiffres: {
      image: { chiffre: mesurables.length ? `${tenus.length}/${mesurables.length}` : '—', legende: 'piliers de thèse tenus' },
      serie: d.technique.serie.filter((s) => s.cours != null).map((s) => [s.date, s.cours]),
      piliers: piliers.map((p) => ({ cle: p.cle, statut: p.statut })),
      liens: faits.slice(0, 3).map((f) => ({ slug: f.slug, titre: f.titre })),
    },
    sources: [
      { label: 'BRVM — rapports des sociétés cotées', url: 'https://www.brvm.org/fr/rapports-societes-cotees' },
      { label: 'WESTBOURSE — dossier valeur', url: `https://www.westbourse.com/rapports/dossier/${code}` },
    ],
  };
}
