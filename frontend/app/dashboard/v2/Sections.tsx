import Link from 'next/link';

/**
 * Les blocs serveur du tableau de bord v2 : bandes, trajectoire, portefeuille.
 *
 * Tous rendus côté serveur — aucun n'a besoin d'interactivité. Les bandes
 * défilent en CSS pur, la trajectoire est un SVG calculé au rendu, le
 * portefeuille est un tableau.
 *
 * HONNÊTETÉ. Chaque bloc gère son absence de données par un état vide explicite
 * plutôt que par un affichage vraisemblable. Un portefeuille sans position dit
 * qu'il est vide ; une trajectoire sans historique dit qu'elle manque.
 */

const nf = new Intl.NumberFormat('fr-FR');
const pct = (x: number, d = 2) => x.toFixed(d).replace('.', ',').replace('-', '−');
const signe = (x: number, d = 2) => `${x > 0 ? '+' : ''}${pct(x, d)}`;

/* ============================================================== bandes ==== */

export interface ItemBande {
  code: string;
  valeur: string;
  variation?: number | null;
}

/**
 * Bandes défilantes. Le contenu est dupliqué pour que la translation de −50 %
 * boucle sans saut.
 *
 * WCAG 2.2.2 : un défilement automatique doit pouvoir être arrêté. La pause au
 * survol et au focus vit dans la feuille de styles, et rien ne démarre sous
 * `prefers-reduced-motion` — la bande devient alors une liste qu'on parcourt à
 * la main, sans perdre un seul élément.
 */
export function Bandes({ actions, obligations }: { actions: ItemBande[]; obligations: ItemBande[] }) {
  if (actions.length === 0 && obligations.length === 0) return null;

  const rendre = (items: ItemBande[], suffixe: string) =>
    items.map((it, k) => (
      <span className="v2-bi" key={`${it.code}-${suffixe}-${k}`}>
        <b>{it.code}</b>
        <i className="v2-tab">{it.valeur}</i>
        {it.variation != null && (
          <em className={`v2-tab ${it.variation >= 0 ? 'v2-up' : 'v2-down'}`}>
            {signe(it.variation)} %
          </em>
        )}
      </span>
    ));

  return (
    <div className="v2-bandes">
      {actions.length > 0 && (
        <div
          className="v2-bande"
          tabIndex={0}
          aria-label="Cours des valeurs de la séance. Survolez ou tabulez pour mettre en pause."
        >
          <span className="v2-bande-k">Actions</span>
          <div className="v2-bande-piste">
            <div className="v2-bande-flux">
              {rendre(actions, 'a')}
              {rendre(actions, 'b')}
            </div>
          </div>
        </div>
      )}
      {obligations.length > 0 && (
        <div
          className="v2-bande v2-obl"
          tabIndex={0}
          aria-label="Cours des lignes obligataires de la même séance. Survolez ou tabulez pour mettre en pause."
        >
          <span className="v2-bande-k">Obligations</span>
          <div className="v2-bande-piste">
            <div className="v2-bande-flux">
              {rendre(obligations, 'a')}
              {rendre(obligations, 'b')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================= trajectoire ==== */

export interface PointSerie {
  date: string;
  valeur: number;
}

/**
 * Trajectoire de deux indices, en base 100 sur la première séance.
 *
 * DES COURBES, PAS DES BOUGIES. La BRVM ne publie ni plus haut ni plus bas
 * intraséance : il n'y a pas de mèche à tracer, et en inventer une reviendrait
 * à inventer un prix. La base 100 rend les deux séries comparables — le
 * Composite évolue vers 500, le BRVM 30 vers 250 — et les niveaux réels sont
 * rappelés aux extrémités.
 */
export function Trajectoire({
  serieA,
  serieB,
  libelleA,
  libelleB,
}: {
  serieA: PointSerie[];
  serieB: PointSerie[];
  libelleA: string;
  libelleB: string;
}) {
  if (serieA.length < 3) {
    return (
      <p className="v2-hint">
        Historique insuffisant pour tracer une trajectoire — il faut au moins trois séances.
      </p>
    );
  }

  const W = 880;
  const H = 220;
  const L = 10;
  const R = 96;
  const T = 16;
  const B = 30;

  const baseA = serieA[0].valeur || 1;
  const baseB = serieB.length > 0 ? serieB[0].valeur || 1 : 1;
  const idxA = serieA.map((p) => (p.valeur / baseA) * 100);
  const idxB = serieB.map((p) => (p.valeur / baseB) * 100);
  const memeLongueur = idxB.length === idxA.length;
  const tous = memeLongueur ? [...idxA, ...idxB] : idxA;
  let lo = Math.min(...tous);
  let hi = Math.max(...tous);
  const marge = (hi - lo) * 0.16 || 1;
  lo -= marge;
  hi += marge;

  const n = serieA.length;
  const X = (i: number) => L + ((W - L - R) * i) / Math.max(1, n - 1);
  const Y = (v: number) => T + ((H - T - B) * (hi - v)) / (hi - lo);
  const chemin = (idx: number[]) =>
    `M${idx.map((v, i) => `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' L')}`;

  const dernier = serieA[n - 1];
  const avant = serieA[n - 2];
  const varDernier = avant ? ((dernier.valeur - avant.valeur) / avant.valeur) * 100 : null;
  const totalA = ((dernier.valeur - serieA[0].valeur) / serieA[0].valeur) * 100;
  const totalB =
    serieB.length > 1
      ? ((serieB[serieB.length - 1].valeur - serieB[0].valeur) / serieB[0].valeur) * 100
      : null;

  const jour = (d: string) => d.slice(8, 10).replace(/^0/, '');

  return (
    <div className="v2-traj">
      <div className="v2-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Trajectoire du ${libelleA}${memeLongueur ? ` et du ${libelleB}` : ''} sur ${n} séances, en base 100 à la première.`}
        >
          <line className="v2-pl-zero" x1={L} y1={Y(100)} x2={X(n - 1)} y2={Y(100)} />
          <text x={L} y={Y(100) - 6}>
            base 100 · {jour(serieA[0].date)}
          </text>
          {memeLongueur && <path className="v2-pl-b" d={chemin(idxB)} />}
          <path className="v2-pl-a" d={chemin(idxA)} />
          {avant && (
            <path
              className={varDernier != null && varDernier < 0 ? 'v2-pl-drop' : 'v2-pl-rise'}
              d={`M${X(n - 2).toFixed(1)} ${Y(idxA[n - 2]).toFixed(1)} L${X(n - 1).toFixed(1)} ${Y(idxA[n - 1]).toFixed(1)}`}
            />
          )}
          <circle className="v2-pl-rep" cx={X(n - 1)} cy={Y(idxA[n - 1])} r={4} />
          <text className="hi" x={X(n - 1) + 12} y={Y(idxA[n - 1]) + 4}>
            {pct(dernier.valeur)}
          </text>
          <text x={L} y={H - 10}>
            {jour(serieA[0].date)}
          </text>
          <text className="cy" x={X(n - 1) - 30} y={H - 10}>
            {jour(dernier.date)}
          </text>
        </svg>
      </div>

      <div className="v2-traj-side">
        <div className="v2-tfact">
          <div className="v2-k">{libelleA}</div>
          <div className={`v2-v ${totalA >= 0 ? 'v2-up' : 'v2-down'}`}>{signe(totalA)} %</div>
          <div className="v2-d">
            sur {n} séances — de {pct(serieA[0].valeur)} à {pct(dernier.valeur)}
          </div>
        </div>
        {totalB != null && (
          <div className="v2-tfact">
            <div className="v2-k">{libelleB}</div>
            <div className={`v2-v ${totalB >= 0 ? 'v2-up' : 'v2-down'}`}>{signe(totalB)} %</div>
            <div className="v2-d">
              de {pct(serieB[0].valeur)} à {pct(serieB[serieB.length - 1].valeur)}
            </div>
          </div>
        )}
        {varDernier != null && (
          <div className="v2-tfact">
            <div className="v2-k">Dernière séance</div>
            <div className={`v2-v ${varDernier >= 0 ? 'v2-up' : 'v2-down'}`}>
              {signe(varDernier)} %
            </div>
            <div className="v2-d">variation du {jour(dernier.date)} par rapport à la veille</div>
          </div>
        )}
        <p className="v2-hint">
          Des courbes, pas des bougies&nbsp;: la BRVM ne publie aucun plus haut ni plus bas
          intraséance.
        </p>
      </div>
    </div>
  );
}

/* ========================================================= portefeuille === */

export interface LignePortefeuille {
  code: string;
  quantite: number;
  prixEntree: number;
  cours: number | null;
  variation: number | null;
}

/**
 * Portefeuille de l'utilisateur connecté, valorisé aux clôtures de la séance.
 *
 * Les positions sont des données personnelles, lues sous la RLS du compte.
 * Aucune n'est fabriquée : sans position, le bloc affiche un état vide et un
 * lien pour en saisir une. Les lignes dont le cours manque sont valorisées à
 * leur prix de revient et signalées, plutôt qu'estimées en silence.
 */
export function Portefeuille({ lignes }: { lignes: LignePortefeuille[] }) {
  if (lignes.length === 0) {
    return (
      <div className="v2-vide">
        <p>Aucune position enregistrée sur ce compte.</p>
        <p className="v2-hint">
          La valorisation et la plus-value latente apparaîtront ici dès la première ligne saisie.{' '}
          <Link href="/portefeuille" className="v2-lien">
            Ouvrir le portefeuille
          </Link>
        </p>
      </div>
    );
  }

  const sansCours = lignes.filter((l) => l.cours == null).length;
  const totalVal = lignes.reduce((s, l) => s + l.quantite * (l.cours ?? l.prixEntree), 0);
  const totalPru = lignes.reduce((s, l) => s + l.quantite * l.prixEntree, 0);
  const pl = totalVal - totalPru;
  const plPct = totalPru > 0 ? (pl / totalPru) * 100 : 0;

  return (
    <div>
      <div className="v2-pf-tot">
        <div>
          <div className="v2-k">Valorisation</div>
          <div className="v2-v v2-tab">{nf.format(Math.round(totalVal))} FCFA</div>
        </div>
        <div>
          <div className="v2-k">Prix de revient</div>
          <div className="v2-v v2-tab">{nf.format(Math.round(totalPru))} FCFA</div>
        </div>
        <div>
          <div className="v2-k">Plus-value latente</div>
          <div className={`v2-v v2-tab ${pl >= 0 ? 'v2-up' : 'v2-down'}`}>
            {pl >= 0 ? '+' : '−'}
            {nf.format(Math.abs(Math.round(pl)))} FCFA
          </div>
        </div>
        <div>
          <div className="v2-k">Performance</div>
          <div className={`v2-v v2-tab ${pl >= 0 ? 'v2-up' : 'v2-down'}`}>{signe(plPct)} %</div>
        </div>
      </div>

      <div className="v2-pf-scroll">
        <table className="v2-pf">
          <thead>
            <tr>
              <th>Ligne</th>
              <th className="r">Qté</th>
              <th className="r">PR</th>
              <th className="r">Cours</th>
              <th className="r">Jour</th>
              <th className="r">+/− latent</th>
              <th className="r">Poids</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const val = l.quantite * (l.cours ?? l.prixEntree);
              const gain = l.cours != null ? l.quantite * (l.cours - l.prixEntree) : null;
              const poids = totalVal > 0 ? (val / totalVal) * 100 : 0;
              return (
                <tr key={l.code}>
                  <td>
                    <b>{l.code}</b>
                  </td>
                  <td className="r v2-tab">{nf.format(l.quantite)}</td>
                  <td className="r v2-tab">{nf.format(Math.round(l.prixEntree))}</td>
                  <td className="r v2-tab">
                    {l.cours != null ? (
                      nf.format(Math.round(l.cours))
                    ) : (
                      <span className="v2-nd">non coté</span>
                    )}
                  </td>
                  <td className="r v2-tab">
                    {l.variation != null ? (
                      <span className={l.variation >= 0 ? 'v2-up' : 'v2-down'}>
                        {signe(l.variation)} %
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`r v2-tab ${gain == null ? '' : gain >= 0 ? 'v2-up' : 'v2-down'}`}>
                    {gain == null
                      ? '—'
                      : `${gain >= 0 ? '+' : '−'}${nf.format(Math.abs(Math.round(gain)))}`}
                  </td>
                  <td className="r">
                    <span className="v2-pf-w">
                      <i style={{ width: `${poids.toFixed(1)}%` }} />
                    </span>
                    <span className="v2-tab v2-pf-wp">{pct(poids, 1)} %</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sansCours > 0 && (
        <p className="v2-hint">
          {sansCours} ligne{sansCours > 1 ? 's' : ''} sans cours pour cette séance
          {sansCours > 1 ? ' sont valorisées' : ' est valorisée'} à son prix de revient — aucune
          estimation n’est faite à sa place.
        </p>
      )}
    </div>
  );
}
