import Link from 'next/link';
import type { LandingBisData } from '@/lib/landing/bisData';
import type { Fraicheur } from '@/lib/freshness';
import { courbeSeance, largeurMarche } from '@/lib/landing/courbeSeance';
import { fmtFcfa, fmtNumber } from '@/lib/format';
import { pct, tone } from '@/lib/landing/formats';

/**
 * « La cote du soir » : le premier écran montre la séance, pas une promesse.
 *
 * Seul élément riche du haut de page, et rendu côté serveur : aucun chiffre n'y
 * est saisi, chacun vient de `getLandingBisData`, et le bas de la carte porte la
 * signature du site, la source, la séance et l'heure de la collecte. Une donnée
 * absente fait disparaître sa ligne ; sans séance, la carte le dit.
 */

const LARGEUR = 560;
const HAUTEUR = 176;
/** Environ trois mois : assez pour voir une tendance, sans écraser la dernière séance. */
const SEANCES = 60;

const heure = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).replace(' ', ' à ')
    : null;

/** Signature du site : d'où vient le chiffre, et quand il a été relevé. */
export function Source({ fraicheur, libelle = 'Source BRVM' }: { fraicheur: Fraicheur; libelle?: string }) {
  const releve = heure(fraicheur.derniereCollecte);
  return (
    <p className="source num">
      {libelle}
      {releve ? ` · relevé le ${releve} UTC` : ' · heure de collecte indisponible'}
    </p>
  );
}

export function Seance({ d, fraicheur, dateLabel }: { d: LandingBisData; fraicheur: Fraicheur; dateLabel: string | null }) {
  const c = d.brvmC;
  if (!c) {
    return (
      <aside className="cote" aria-label="Séance du jour">
        <p className="cote-titre">Séance du jour</p>
        <p className="cote-vide">La séance n&apos;est pas encore disponible. Cette carte l&apos;affichera dès la collecte, plutôt qu&apos;un cours périmé.</p>
        <Source fraicheur={fraicheur} />
      </aside>
    );
  }

  const serie = d.brvmCSerie.slice(-SEANCES);
  const courbe = courbeSeance(serie, LARGEUR, HAUTEUR);
  const largeur = largeurMarche(d.hausses, d.inchangees, d.baisses);
  const haut = d.topHausses[0] ?? null;
  const bas = d.topBaisses[0] ?? null;
  const capitaux = d.etat.valeurEchangee;

  return (
    <aside className="cote" aria-label={`Séance${dateLabel ? ` du ${dateLabel}` : ' du jour'}`}>
      <div className="cote-tete">
        <p className="cote-titre">Séance{dateLabel ? ` du ${dateLabel}` : ' du jour'}</p>
        <p className="cote-indice">BRVM Composite</p>
      </div>

      <div className="cote-chiffre">
        <b className="num">{fmtNumber(c.valeur, 2)}</b>
        {c.variation != null && <span className={`num ${tone(c.variation)}`}>{pct(c.variation)}</span>}
      </div>

      {courbe && (
        <figure className="cote-courbe">
          <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} preserveAspectRatio="none" role="img" aria-label={`BRVM Composite sur ${serie.length} séances, de ${fmtNumber(courbe.min, 2)} à ${fmtNumber(courbe.max, 2)}`}>
            <path d={courbe.aire} className="aire" />
            <path d={courbe.ligne} className="ligne" vectorEffect="non-scaling-stroke" />
          </svg>
          <figcaption className="num">
            <span>{serie.length} séances</span>
            <span>
              {fmtNumber(courbe.min, 2)} – {fmtNumber(courbe.max, 2)}
            </span>
          </figcaption>
        </figure>
      )}

      {largeur && (
        <div className="cote-largeur">
          <div className="barre" aria-hidden="true">
            <i className="h" style={{ width: `${largeur.hausses}%` }} />
            <i className="s" style={{ width: `${largeur.stables}%` }} />
            <i className="b" style={{ width: `${largeur.baisses}%` }} />
          </div>
          <p className="num">
            <span className="up">{d.hausses} hausses</span>
            <span>{d.inchangees} stables</span>
            <span className="down">{d.baisses} baisses</span>
          </p>
        </div>
      )}

      {(haut || bas || capitaux != null) && (
        <dl className="cote-faits">
          {haut && (
            <div>
              <dt>Plus forte hausse</dt>
              <dd className="num">
                <Link href={`/societes/${haut.code}`}>{haut.code}</Link> <span className={tone(haut.variation)}>{pct(haut.variation)}</span>
              </dd>
            </div>
          )}
          {bas && (
            <div>
              <dt>Plus forte baisse</dt>
              <dd className="num">
                <Link href={`/societes/${bas.code}`}>{bas.code}</Link> <span className={tone(bas.variation)}>{pct(bas.variation)}</span>
              </dd>
            </div>
          )}
          {capitaux != null && (
            <div>
              <dt>Valeur échangée</dt>
              <dd className="num">{fmtFcfa(capitaux)} FCFA</dd>
            </div>
          )}
        </dl>
      )}

      <Source fraicheur={fraicheur} />
    </aside>
  );
}
