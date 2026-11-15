import { Mesures } from '@/components/document/Document';
import CascadeBancaire from '@/components/bank/CascadeBancaire';
import { illustrationCascade } from '@/lib/bank/cascade';
import { montantLigne, ratioLigne, variationLigne } from '@/lib/bank/format';
import { deviseDe, type CleRatio, type LectureBancaire, type LigneAgregat } from '@/lib/bank/lecture';
import './bank.css';

/**
 * Feuilles bancaires de la Revue : compte de résultat (PNB → résultat net,
 * cascade, ratios d'exploitation) puis encours et solidité. Tout vient de
 * lib/bank/lecture.ts ; aucun calcul ici. Chaque libellé renvoie au document
 * source (page). Chaque montant porte l'unité de sa source (FCFA ou USD).
 */
const ton = (c: LigneAgregat['precedent']) => (c?.variation == null ? undefined : c.variation > 0 ? 'hausse' : c.variation < 0 ? 'baisse' : undefined);

function Libelle({ l }: { l: LigneAgregat }) {
  const s = l.valeur.source;
  if (!s) return <>{l.libelle}</>;
  return (
    <a href={s.document_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
      {l.libelle}{s.page ? <sup> p. {s.page}</sup> : null}
    </a>
  );
}

/** « en FCFA », « en USD », « en FCFA et en USD » : l'en-tête dit les unités présentes. */
function enUnites(lignes: LigneAgregat[]): string {
  const devises = [...new Set(lignes.filter((l) => l.unite !== 'pct').map((l) => deviseDe(l.unite)))];
  return devises.length ? `, en ${devises.join(' et en ')}` : '';
}

function Tableau({ titre, lignes, colPrec, avecCloture }: { titre: string; lignes: LigneAgregat[]; colPrec: string; avecCloture: boolean }) {
  if (lignes.length === 0) return null;
  return (
    <table className="rv-table bk-table">
      <thead>
        <tr>
          <th scope="col">{titre}{enUnites(lignes)}</th>
          <th scope="col">Publié</th>
          <th scope="col">{colPrec}</th>
          <th scope="col">Évolution</th>
          {avecCloture && <th scope="col">Dernière clôture</th>}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l) => (
          <tr key={l.cle}>
            <td><Libelle l={l} /></td>
            <td className="fort">{montantLigne(l.valeur.valeur, l.unite)}</td>
            <td>{l.precedent ? montantLigne(l.precedent.valeur, l.unite) : '—'}</td>
            <td className={ton(l.precedent)}>{variationLigne(l.precedent)}</td>
            {avecCloture && <td>{l.cloture ? montantLigne(l.cloture.valeur, l.unite) : '—'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Ratios({ lecture, cles }: { lecture: LectureBancaire; cles: CleRatio[] }) {
  const ratios = lecture.ratios.filter((r) => cles.includes(r.cle));
  if (ratios.length === 0) return null;
  // La mention (annualisation, glissement) n'est ajoutée que si la phrase ne la porte pas déjà.
  return <Mesures items={ratios.map((r) => ({ libelle: r.libelle, valeur: ratioLigne(r.valeur), note: r.mention && !r.phrase.includes(r.mention) ? `${r.phrase} (${r.mention})` : r.phrase }))} />;
}

function Sources({ lecture }: { lecture: LectureBancaire }) {
  if (lecture.sources.length === 0) return null;
  return (
    <p className="doc-note">
      Sources : {lecture.sources.map((s, i) => (
        <span key={s.document_url}>{i > 0 ? ' ; ' : ''}<a href={s.document_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{s.document_libelle ?? 'document publié'}</a></span>
      ))}. Le résultat net est celui des comptes en base, recoupé avec le document. Ratios calculés par WESTBOURSE, aucun n’est repris tel quel.
    </p>
  );
}

export function CompteResultatBancaire({ lecture }: { lecture: LectureBancaire }) {
  const cascade = illustrationCascade(lecture);
  // Feuille A4 à hauteur fixe : jusqu'à neuf lignes, puis la cascade et les ratios côte à côte.
  return (
    <>
      <Tableau titre="Compte de résultat" lignes={lecture.compteResultat} colPrec={lecture.libellePrecedent} avecCloture={false} />
      <div className={cascade ? 'bk-duo bk-duo--revue' : undefined}>
        {cascade && <CascadeBancaire illustration={cascade} compacte />}
        <Ratios lecture={lecture} cles={['coefficient_exploitation', 'cout_du_risque_relatif']} />
      </div>
      {cascade && cascade.gabarit === 'cascade' && (
        <p className="doc-note">{cascade.note} Source : {cascade.source}.</p>
      )}
      {lecture.code !== 'exercice' && (
        <p className="doc-note">Flux cumulés depuis le début de l’exercice, comparés au même cumul de {lecture.annee - 1}.</p>
      )}
    </>
  );
}

export function EncoursBancaire({ lecture }: { lecture: LectureBancaire }) {
  const interim = lecture.code !== 'exercice';
  return (
    <>
      <Tableau titre="Encours et solidité" lignes={lecture.encours} colPrec={`même date ${lecture.annee - 1}`} avecCloture={interim} />
      {lecture.encours.length === 0 && <p className="doc-note">Aucun encours publié pour cette période.</p>}
      <Ratios lecture={lecture} cles={['credits_sur_depots', 'roe']} />
      {lecture.mentionNonPublies && <p className="doc-note">{lecture.mentionNonPublies}</p>}
      {interim && <p className="doc-note">Encours à la date d’arrêté, comparés à la même date de {lecture.annee - 1}, puis à la dernière clôture annuelle.</p>}
      <Sources lecture={lecture} />
    </>
  );
}
