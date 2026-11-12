/**
 * MAQUETTE du Dossier valeur dans le système de document (lot 3, étape de
 * validation). Affichée par `/rapports/dossier/[code]?style=v2` : couverture,
 * ouverture de section et deux pages intérieures. Toutes les valeurs viennent de
 * `buildDossier` ; les titres viennent de `lib/document/constats.ts`.
 */
import type { DossierValeur } from '@/lib/dossier/build';
import { fmtFcfa, fmtNumber, fmtDateCourte } from '@/lib/format';
import { perAffichable } from '@/lib/fiche/affichage';
import { constatCouverture, constatSerie, constatValorisation } from '@/lib/document/constats';
import { Document, Couverture, OuvertureSection, Feuille, Panneau, ChiffreGeant, Mesures, GraphiqueBarres } from './Document';
import brvmLogos from '@/lib/brvmLogos.json';
import './document.css';

const LOGOS = brvmLogos as Record<string, string>;
const TOTAL = 4;
const signe = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNumber(Math.abs(v), d)}`;
const pctFraction = (v: number | null | undefined, d = 1) => (v == null ? null : `${signe(v * 100, d)} %`);
const md = (v: number) => (v >= 1e9 ? `${fmtNumber(v / 1e9, 0)}` : fmtFcfa(v));

export default function MaquetteDossier({ d }: { d: DossierValeur }) {
  const { identite: id, chiffres_cles: c, ratios: r, suivi } = d;
  const nom = id.designation ?? id.code;
  const entete = `Dossier valeur · édition du ${fmtDateCourte(d.genere_le)}`;
  const traj = [...d.trajectoire].sort((a, b) => Number(a.exercice) - Number(b.exercice)).slice(-5);
  const rnPrec = traj.length >= 2 ? traj[traj.length - 2]!.resultat_net : null;
  const per = perAffichable(r?.per ?? null, r?.bpa ?? null);
  const medianePer = suivi.medianes?.lignes.find((l) => l.libelle === 'PER')?.mediane ?? null;

  const caPts = traj.map((p) => ({ exercice: p.exercice, valeur: p.chiffre_affaires }));
  const rnPts = traj.map((p) => ({ exercice: p.exercice, valeur: p.resultat_net }));
  const dernierCa = traj[traj.length - 1];
  const precCa = traj[traj.length - 2];
  const croissanceCa = c.croissance_ca_1an != null ? c.croissance_ca_1an * 100 : null;
  const margeNette = c.resultat_net != null && c.chiffre_affaires ? c.resultat_net / c.chiffre_affaires : null;

  return (
    <Document>
      <Couverture
        entete={entete}
        societe={nom}
        code={id.code}
        logo={LOGOS[id.code] ?? null}
        surtitre={['Dossier valeur', id.secteur, id.pays].filter(Boolean).join(' · ')}
        constat={constatCouverture({ exercice: c.exercice, resultatNet: c.resultat_net, resultatNetPrecedent: rnPrec })}
        total={TOTAL}
        chiffres={[
          c.cours != null ? { libelle: 'Cours', valeur: `${fmtNumber(c.cours)} FCFA`, note: [c.date_cours ? `au ${fmtDateCourte(c.date_cours)}` : null, suivi.performance.var_ytd != null ? `${pctFraction(suivi.performance.var_ytd)} depuis janvier` : null].filter(Boolean).join(' · ') } : null,
          c.capitalisation != null ? { libelle: 'Capitalisation', valeur: `${fmtFcfa(c.capitalisation)} FCFA` } : null,
          per.valeur != null ? { libelle: 'PER', valeur: fmtNumber(per.valeur, 1), note: c.exercice ? `bénéfice de l’exercice ${c.exercice}` : null } : null,
        ].filter((x): x is NonNullable<typeof x> => x != null)}
      />

      <OuvertureSection
        numero={1}
        titre="Trajectoire et valorisation"
        sommaire={['Chiffre d’affaires et résultat sur cinq exercices', 'Ce que le cours paie aujourd’hui', 'Comparaison aux sociétés du secteur']}
        entete={entete}
        societe={nom}
      />

      <Feuille entete={entete} societe={nom} page={3} total={TOTAL}>
        <Panneau titre={constatSerie('Chiffre d’affaires', caPts)}>
          <ChiffreGeant
            valeur={croissanceCa != null ? signe(croissanceCa) : null}
            unite="% sur un an"
            legende={dernierCa?.chiffre_affaires != null && precCa?.chiffre_affaires != null
              ? `${fmtFcfa(dernierCa.chiffre_affaires)} FCFA en ${dernierCa.exercice}, contre ${fmtFcfa(precCa.chiffre_affaires)} FCFA en ${precCa.exercice}.`
              : null}
          />
          <GraphiqueBarres
            titre="Chiffre d’affaires par exercice, en milliards de FCFA"
            points={caPts.map((p) => ({ libelle: p.exercice, valeur: p.valeur }))}
            format={md}
          />
          <p className="doc-note">Chiffre d’affaires par exercice, en milliards de FCFA. Source : états financiers publiés.</p>
          <Mesures items={[
            { libelle: 'Résultat net', valeur: c.resultat_net != null ? `${fmtFcfa(c.resultat_net)} FCFA` : null, note: constatSerie('Résultat net', rnPts).replace(/^Résultat net : /, '') },
            { libelle: 'Marge nette', valeur: margeNette != null ? `${fmtNumber(margeNette * 100, 1)} %` : null, note: c.exercice ? `exercice ${c.exercice}` : null },
            { libelle: 'Croissance sur deux ans', valeur: pctFraction(c.croissance_ca_2ans), note: 'chiffre d’affaires' },
            { libelle: 'Capitaux propres', valeur: c.capitaux_propres != null ? `${fmtFcfa(c.capitaux_propres)} FCFA` : null, note: c.variation_capitaux_propres_1an != null ? `${pctFraction(c.variation_capitaux_propres_1an)} sur un an` : null },
          ]} />
        </Panneau>
      </Feuille>

      <Feuille entete={entete} societe={nom} page={4} total={TOTAL}>
        <Panneau titre={constatValorisation(per.valeur, medianePer)}>
          <ChiffreGeant
            valeur={per.valeur != null ? fmtNumber(per.valeur, 1) : null}
            unite="fois le bénéfice"
            legende={per.valeur != null && c.cours != null && r?.bpa != null
              ? `Cours de ${fmtNumber(c.cours)} FCFA rapporté à un bénéfice par action de ${fmtNumber(r.bpa, 1)} FCFA (exercice ${c.exercice ?? 'non précisé'}).`
              : per.motif}
          />
          <Mesures items={[
            { libelle: 'Médiane des comparables', valeur: medianePer != null ? fmtNumber(medianePer, 1) : null, note: suivi.medianes ? `${suivi.medianes.nbSocietes} sociétés, ${suivi.medianes.groupe}` : null },
            { libelle: 'Cours / valeur comptable', valeur: r?.pb != null ? fmtNumber(r.pb, 2) : null },
            { libelle: 'Rendement du dividende', valeur: d.dividende.rendement != null ? `${fmtNumber(d.dividende.rendement * 100, 2)} %` : null, note: d.dividende.exercice ? `exercice ${d.dividende.exercice}` : null },
            { libelle: 'Position sur 52 semaines', valeur: suivi.performance.position_52s != null ? `${fmtNumber(suivi.performance.position_52s * 100, 0)} %` : null, note: '0 % au plus bas, 100 % au plus haut' },
          ]} />
          <p className="doc-note">
            Le PER rapporte le cours au bénéfice du dernier exercice publié. Une position par rapport à la médiane
            des comparables est un constat, pas une appréciation : elle ne dit pas si le titre est cher ou bon marché.
          </p>
        </Panneau>
      </Feuille>
    </Document>
  );
}
