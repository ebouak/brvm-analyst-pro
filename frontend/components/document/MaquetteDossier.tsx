/**
 * MAQUETTE du Dossier valeur dans le système de document (lot 3, étape de
 * validation). Affichée par `/rapports/dossier/[code]?style=v2`. Toutes les
 * valeurs viennent de `buildDossier` ; les titres de `lib/document/constats.ts` ;
 * la photo d'activité de `lib/document/activite.ts` (métier, jamais la société).
 */
import type { DossierValeur } from '@/lib/dossier/build';
import { fmtFcfa, fmtNumber, fmtDateCourte } from '@/lib/format';
import { perAffichable } from '@/lib/fiche/affichage';
import { constatCouverture, constatSerie, constatValorisation, declarationEssentiel } from '@/lib/document/constats';
import { photoActivite } from '@/lib/document/activite';
import {
  Document, CouverturePhoto, PageEssentiel, OuvertureSection, Feuille, Panneau, ChiffreGeant,
  BandeMesures, GraphiqueBarres, EchelleRepere,
} from './Document';
import brvmLogos from '@/lib/brvmLogos.json';
import './document.css';

const LOGOS = brvmLogos as Record<string, string>;
const TOTAL = 5;
const signe = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNumber(Math.abs(v), d)}`;
const pctFraction = (v: number | null | undefined, d = 1) => (v == null ? null : `${signe(v * 100, d)} %`);
const enMd = (v: number) => fmtNumber(v / 1e9, v >= 1e11 ? 0 : 1);
/** « 1 923 Md » → valeur « 1 923 » + unité « Md FCFA » pour les grands chiffres. */
const separe = (v: number | null): { valeur: string | null; unite?: string } => {
  if (v == null) return { valeur: null };
  const t = fmtFcfa(v);
  const m = t.match(/^(.*?)\s(Md|M)$/);
  return m ? { valeur: m[1]!, unite: `${m[2]} FCFA` } : { valeur: t, unite: 'FCFA' };
};

export default function MaquetteDossier({ d }: { d: DossierValeur }) {
  const { identite: id, chiffres_cles: c, ratios: r, suivi, dividende: div } = d;
  const nom = id.designation ?? id.code;
  const entete = `Dossier valeur · édition du ${fmtDateCourte(d.genere_le)}`;
  const photo = photoActivite(id.code, id.secteur);
  const traj = [...d.trajectoire].sort((a, b) => Number(a.exercice) - Number(b.exercice)).slice(-5);
  const prec = traj.length >= 2 ? traj[traj.length - 2]! : null;
  const per = perAffichable(r?.per ?? null, r?.bpa ?? null);
  const medianePer = suivi.medianes?.lignes.find((l) => l.libelle === 'PER')?.mediane ?? null;
  const caPts = traj.map((p) => ({ exercice: p.exercice, valeur: p.chiffre_affaires }));
  const rnPts = traj.map((p) => ({ exercice: p.exercice, valeur: p.resultat_net }));
  const croissanceCa = c.croissance_ca_1an != null ? c.croissance_ca_1an * 100 : null;
  const margeNette = c.resultat_net != null && c.chiffre_affaires ? c.resultat_net / c.chiffre_affaires : null;
  const evoRn = c.resultat_net != null && prec?.resultat_net ? ((c.resultat_net - prec.resultat_net) / Math.abs(prec.resultat_net)) * 100 : null;
  const perf = suivi.performance;

  return (
    <Document>
      <CouverturePhoto
        entete={entete} societe={nom} code={id.code} logo={LOGOS[id.code] ?? null} photo={photo}
        surtitre={['Dossier valeur', id.secteur, id.pays].filter(Boolean).join(' · ')}
        constat={constatCouverture({ exercice: c.exercice, resultatNet: c.resultat_net, resultatNetPrecedent: prec?.resultat_net ?? null })}
        total={TOTAL}
        chiffres={[
          c.cours != null ? { libelle: 'Cours', valeur: `${fmtNumber(c.cours)} FCFA`, note: [c.date_cours ? `au ${fmtDateCourte(c.date_cours)}` : null, perf.var_ytd != null ? `${pctFraction(perf.var_ytd)} depuis janvier` : null].filter(Boolean).join(' · ') } : null,
          c.capitalisation != null ? { libelle: 'Capitalisation', valeur: `${fmtFcfa(c.capitalisation)} FCFA` } : null,
          per.valeur != null ? { libelle: 'PER', valeur: fmtNumber(per.valeur, 1), note: c.exercice ? `bénéfice de l’exercice ${c.exercice}` : null } : null,
        ].filter((x): x is NonNullable<typeof x> => x != null)}
      />

      <PageEssentiel
        photo={photo} societe={nom} page={2} total={TOTAL}
        surtitre={`L’essentiel de l’exercice ${c.exercice ?? ''}`.trim()}
        declaration={declarationEssentiel({
          societe: nom, exercice: c.exercice, ca: c.chiffre_affaires, caPrecedent: prec?.chiffre_affaires ?? null,
          resultatNet: c.resultat_net, resultatNetPrecedent: prec?.resultat_net ?? null,
        }) ?? 'Les comptes du dernier exercice ne sont pas disponibles.'}
        chiffres={[
          { libelle: 'Chiffre d’affaires', ...separe(c.chiffre_affaires), note: croissanceCa != null ? `${signe(croissanceCa)} % sur un an` : null },
          { libelle: 'Résultat net', ...separe(c.resultat_net), note: evoRn != null ? `${signe(evoRn)} % sur un an` : null },
          { libelle: 'Marge nette', valeur: margeNette != null ? fmtNumber(margeNette * 100, 1) : null, unite: '%', note: 'résultat net rapporté au chiffre d’affaires' },
          { libelle: 'Dividende par action', valeur: div.montant != null ? fmtNumber(div.montant, Number.isInteger(div.montant) ? 0 : 2) : null, unite: 'FCFA', note: div.rendement != null ? `rendement de ${fmtNumber(div.rendement * 100, 2)} % au cours actuel${div.exercice ? `, exercice ${div.exercice}` : ''}` : null },
        ]}
      />

      <OuvertureSection
        numero={1} titre="Trajectoire et valorisation" photo={photo?.fichier ?? null}
        sommaire={['Chiffre d’affaires et résultat sur cinq exercices', 'Ce que le cours paie aujourd’hui', 'Le titre dans sa plage de cours']}
        entete={entete} societe={nom}
      />

      <Feuille entete={entete} societe={nom} page={4} total={TOTAL}>
        <Panneau titre={constatSerie('Chiffre d’affaires', caPts)}>
          <ChiffreGeant
            valeur={croissanceCa != null ? signe(croissanceCa) : null}
            unite="% sur un an"
            legende={c.chiffre_affaires != null && prec?.chiffre_affaires != null
              ? `${fmtFcfa(c.chiffre_affaires)} FCFA en ${c.exercice}, contre ${fmtFcfa(prec.chiffre_affaires)} FCFA en ${prec.exercice}.`
              : null}
          />
          <div className="doc-duo">
            <div>
              <h3>Chiffre d’affaires, en milliards de FCFA</h3>
              <GraphiqueBarres titre="Chiffre d’affaires par exercice" points={caPts.map((p) => ({ libelle: p.exercice, valeur: p.valeur }))} format={enMd} largeur={300} hauteur={330} />
            </div>
            <div>
              <h3>{constatSerie('Résultat net', rnPts)}</h3>
              <GraphiqueBarres titre="Résultat net par exercice" points={rnPts.map((p) => ({ libelle: p.exercice, valeur: p.valeur }))} format={enMd} largeur={300} hauteur={330} />
            </div>
          </div>
        </Panneau>
        <BandeMesures items={[
          { libelle: 'Marge nette', valeur: margeNette != null ? `${fmtNumber(margeNette * 100, 1)} %` : null, note: c.exercice ? `exercice ${c.exercice}` : null },
          { libelle: 'Croissance sur deux ans', valeur: pctFraction(c.croissance_ca_2ans), note: 'chiffre d’affaires' },
          { libelle: 'Capitaux propres', valeur: c.capitaux_propres != null ? `${fmtFcfa(c.capitaux_propres)} FCFA` : null, note: c.variation_capitaux_propres_1an != null ? `${pctFraction(c.variation_capitaux_propres_1an)} sur un an` : null },
          { libelle: 'Rentabilité des fonds propres', valeur: r?.roe != null ? `${fmtNumber(r.roe * 100, 1)} %` : null, note: 'résultat net / capitaux propres' },
        ]} />
      </Feuille>

      <Feuille entete={entete} societe={nom} page={5} total={TOTAL}>
        <Panneau titre={constatValorisation(per.valeur, medianePer)}>
          <ChiffreGeant
            valeur={per.valeur != null ? fmtNumber(per.valeur, 1) : null}
            unite="fois le bénéfice"
            legende={per.valeur != null && c.cours != null && r?.bpa != null
              ? `Cours de ${fmtNumber(c.cours)} FCFA rapporté à un bénéfice par action de ${fmtNumber(r.bpa, 1)} FCFA (exercice ${c.exercice ?? 'non précisé'}).`
              : per.motif}
          />
          {per.valeur != null && medianePer != null && (
            <EchelleRepere
              titre={`PER comparé à la médiane de ${suivi.medianes?.nbSocietes ?? ''} sociétés comparables`.replace('  ', ' ')}
              min={0} max={Math.ceil(Math.max(per.valeur, medianePer) * 1.3)}
              reperes={[{ valeur: medianePer, libelle: 'Médiane' }, { valeur: per.valeur, libelle: id.code, accent: true }]}
              format={(v) => fmtNumber(v, 1)}
            />
          )}
          {perf.bas52 != null && perf.haut52 != null && c.cours != null && (
            <EchelleRepere
              titre="Cours dans sa plage des 52 dernières semaines, en FCFA"
              min={perf.bas52} max={perf.haut52}
              reperes={[{ valeur: c.cours, libelle: 'Cours', accent: true }]}
              format={(v) => fmtNumber(v, 0)}
            />
          )}
          <p className="doc-note">
            Le PER rapporte le cours au bénéfice du dernier exercice publié. Une position par rapport à la médiane
            est un constat, pas une appréciation : elle ne dit pas si le titre est cher ou bon marché.
          </p>
        </Panneau>
        <BandeMesures items={[
          { libelle: 'Médiane des comparables', valeur: medianePer != null ? fmtNumber(medianePer, 1) : null, note: suivi.medianes?.groupe ?? null },
          { libelle: 'Cours / valeur comptable', valeur: r?.pb != null ? fmtNumber(r.pb, 2) : null },
          { libelle: 'Rendement du dividende', valeur: div.rendement != null ? `${fmtNumber(div.rendement * 100, 2)} %` : null, note: div.exercice ? `exercice ${div.exercice}` : null },
          { libelle: 'Variation sur un mois', valeur: pctFraction(perf.var_1m), note: 'cours de clôture' },
        ]} />
      </Feuille>
    </Document>
  );
}
