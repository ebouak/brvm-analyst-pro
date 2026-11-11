import { CadreBloc, EtatVide } from '@/components/dashboard/blocs/Cadre';
import { Bascule, Peigne } from './Interactif';
import { SEUIL_COMPOSITE, SEUIL_PART_BAISSIERE, type LectureSeance } from '@/lib/dashboard/lectureSeance';
import './lecture.css';

/**
 * Lecture de la séance — reprise du tableau de bord v2 (supprimé le 2026-11-11).
 *
 * Deux idées qui n'existaient nulle part ailleurs sur le tableau de bord :
 * - un verdict qui affiche SA règle, seuils fixés à l'avance, et le résultat de
 *   chaque test : une pastille d'état sans sa règle n'est pas vérifiable ;
 * - la même séance pondérée de plusieurs façons (valeurs, transactions,
 *   capitaux), puis toute la cote sur un axe de variation unique.
 *
 * Toutes les phrases sont composées des chiffres calculés par
 * `lectureSeance` : rien n'est écrit en dur, rien n'est inventé.
 */

const pct = (x: number, d = 2) => x.toFixed(d).replace('.', ',').replace('-', '−');
const signe = (x: number, d = 2) => `${x > 0 ? '+' : ''}${pct(x, d)}`;

const COULEUR: Record<LectureSeance['verdict']['code'], string> = {
  a_surveiller: 'var(--v2-down)',
  contraste: 'var(--v2-accent)',
  sans_alerte: 'var(--v2-up)',
};

export default function BlocLectureSeance({
  lecture,
  dateMarche,
  miennes,
}: {
  lecture: LectureSeance | null;
  dateMarche: string | null;
  miennes: string[];
}) {
  return (
    <CadreBloc id="bloc-lecture" titre="Lecture de la séance" dateReference={dateMarche} legendeDate="Séance du">
      {!lecture ? (
        <EtatVide message="Aucune ligne de séance à lire pour l’instant." actions={[{ href: '/actions', label: 'Voir la cote' }]} />
      ) : (
        <Contenu lecture={lecture} miennes={miennes} />
      )}
    </CadreBloc>
  );
}

function Contenu({ lecture, miennes }: { lecture: LectureSeance; miennes: string[] }) {
  const { verdict, mesures, partBaissiere, capitauxEstimes, plusLourde } = lecture;
  const premiere = mesures[0];
  const derniere = mesures[mesures.length - 1];
  return (
    <div className="lecture-seance">
      <section className="v2-verdict" aria-label="Verdict de la séance et sa règle">
        <div className="v2-vleft">
          <p className="v2-vword">
            <i style={{ background: COULEUR[verdict.code] }} aria-hidden />
            {verdict.libelle}
          </p>
          <p className="v2-vlead">
            {lecture.nbBaisses} baisses contre {lecture.nbHausses} hausses.{' '}
            <em>
              {pct(partBaissiere, 1)} % des capitaux{capitauxEstimes ? ' estimés' : ''} à la baisse.
            </em>
          </p>
          {plusLourde && (
            <p className="v2-note">
              <b>{plusLourde.nom ?? plusLourde.code}</b> pèse à elle seule{' '}
              <b>{pct(plusLourde.partMontant, 1)}&nbsp;%</b> du montant de la séance et{' '}
              {plusLourde.variation < 0 ? 'cède' : plusLourde.variation > 0 ? 'gagne' : 'termine à'}{' '}
              <b>{pct(Math.abs(plusLourde.variation))}&nbsp;%</b>.
            </p>
          )}
          <p className="v2-vconseq">
            <span className="v2-lb">Règle appliquée : seuils fixés à l’avance</span>
            Composite &lt; {signe(SEUIL_COMPOSITE)} % → <b>{verdict.testComposite ? 'vrai' : 'faux'}</b>
            {verdict.compositeVar != null ? ` (${signe(verdict.compositeVar)} %)` : ' (Composite non relevé)'}
            <br />
            ET part baissière des capitaux &gt; {SEUIL_PART_BAISSIERE} % →{' '}
            <b>{verdict.testCapitaux ? 'vrai' : 'faux'}</b> ({pct(partBaissiere, 1)} %)
          </p>
        </div>

        <div>
          <Bascule mesures={mesures} />
          <p className="v2-note">
            C’est la même séance, mesurée {mesures.length} fois. La part baissière passe de{' '}
            <b>{pct(premiere.baisse, 1)}&nbsp;%</b> des valeurs à <b>{pct(derniere.baisse, 1)}&nbsp;%</b> des
            capitaux{capitauxEstimes ? ' estimés (cours × titres échangés)' : ''}.
          </p>
        </div>
      </section>

      <section className="pt-7" aria-labelledby="lecture-axe">
        <h3 id="lecture-axe" className="text-sm font-medium text-ivory">
          Toute la cote sur un seul axe
        </h3>
        <p className="mt-1 max-w-[78ch] text-xs text-muted">
          Chaque trait est une valeur : sa position donne la variation du jour, sa hauteur la grandeur choisie.
          L’axe couvre −8 % à +8 %.{miennes.length > 0 ? ' Vos positions sont mises en évidence.' : ''}
        </p>
        <div className="mt-4">
          <Peigne lignes={lecture.lignes} miennes={miennes} capitauxEstimes={lecture.capitauxEstimes} />
        </div>
      </section>
    </div>
  );
}
