/**
 * Article de résultats d'une BANQUE (spec agrégats bancaires §5) : il porte
 * sur les agrégats sourcés de la lecture bancaire (bank/pure/lecture.ts, copie
 * du module unique du frontend). Tout nombre écrit passe par Plume ; aucune
 * phrase de la lecture n'est recopiée (ses nombres ne sont pas dans la liste
 * blanche). Aucun verdict, aucune causalité.
 *
 * Unités (avenant du 2026-11-15) : chaque montant est écrit dans la devise de
 * sa source (USD pour ETIT), sans conversion.
 *
 * Le type `resultats` n'est pas automatique (types.ts) : l'article part en
 * `a_valider` et n'est publié qu'après relecture humaine dans /admin/articles.
 */
import type { LectureBancaire, LigneAgregat } from '../bank/pure/lecture.js';
import { avecArticle, deviseDe } from '../bank/pure/lecture.js';
import type { Corps, Outils, Source } from './redaction.js';
import type { Fait } from './types.js';

const sens = (v: number) => (v >= 0 ? 'hausse' : 'baisse');

export function resultatsBanque(f: Fait, o: Outils): Corps {
  const { p, nom } = o;
  const l = f.donnees.lecture as LectureBancaire;
  const art = p.nom(avecArticle(l.annee, l.code));
  const devise = (x: LigneAgregat) => deviseDe(x.unite) as 'FCFA' | 'USD';
  const montant = (x: LigneAgregat, v: number) => (x.unite === 'pct' ? `${p.n(v, 2)} %` : p.montant(v, devise(x)));
  const evolution = (x: LigneAgregat) => {
    const c = x.precedent;
    if (!c || c.variation == null) return '';
    const unite = c.uniteVariation === 'pts' ? ` point${Math.abs(c.variation) >= 2 ? 's' : ''}` : ' %';
    return `, en ${sens(c.variation)} de ${p.n(Math.abs(c.variation), 1)}${unite} sur ${p.nom(c.libelle)} (${montant(x, c.valeur)})`;
  };
  // Libellés passés par p.nom : « Ratio CET1 », « Tier 1 » portent un chiffre qui est de la donnée.
  const puce = (x: LigneAgregat) => `- **${p.nom(x.libelle)}** : ${montant(x, x.valeur.valeur)}${evolution(x)}.`;

  const c = l.constat;
  const lignePnb = l.compteResultat.find((x) => x.cle === 'pnb');
  const debut = c.pnb && lignePnb
    ? c.pnb.variation != null
      ? `PNB en ${sens(c.pnb.variation)} de ${p.n(Math.abs(c.pnb.variation), 1)} % sur ${art}`
      : `PNB de ${montant(lignePnb, c.pnb.valeur)} sur ${art}`
    : `Comptes bancaires : ${art}`;
  const s = c.second;
  const suite = s
    ? s.cle === 'coefficient_exploitation'
      ? `, coefficient d’exploitation à ${p.n(s.valeur * 100, 1)} %`
      : `, ${s.cle === 'cout_du_risque' ? 'coût du risque' : 'résultat net'} en ${sens(s.variation)} de ${p.n(Math.abs(s.variation), 1)} %`
    : '';
  const titre = `${nom} : ${debut}${suite}`;

  const rn = l.compteResultat.find((x) => x.cle === 'resultat_net');
  const chapo = `${nom} publie ses comptes ${art}${rn ? ` : résultat net de ${montant(rn, rn.valeur.valeur)}${evolution(rn)}` : ''}.`;

  const sections = [
    { titre: 'Compte de résultat', texte: l.compteResultat.map(puce).join('\n') },
    ...(l.encours.length ? [{ titre: 'Encours et solidité', texte: l.encours.map(puce).join('\n') }] : []),
    ...(l.ratios.length ? [{
      titre: 'Ratios calculés par WESTBOURSE',
      texte: l.ratios.map((r) => `- **${p.nom(r.libelle)}** : ${p.n(r.valeur * 100, 1)} %${r.mention ? ` (${p.nom(r.mention)})` : ''}.`).join('\n'),
    }] : []),
    ...(l.mentionNonPublies ? [{ titre: 'Ce que le document ne publie pas', texte: p.nom(l.mentionNonPublies) }] : []),
  ];
  const sources: Source[] = l.sources.map((x) => ({ label: x.document_libelle ?? 'Document publié', url: x.document_url }));
  const image = c.pnb && lignePnb
    ? { chiffre: c.pnb.variation != null ? `${c.pnb.variation >= 0 ? '+' : '−'}${p.n(Math.abs(c.pnb.variation), 1)} %` : montant(lignePnb, c.pnb.valeur), legende: `${nom} · PNB ${p.nom(l.libelle)}` }
    : { chiffre: p.nom(String(l.annee)), legende: `${nom} · comptes ${p.nom(l.libelle)}` };
  return { titre, chapo, sections, sources, image };
}
