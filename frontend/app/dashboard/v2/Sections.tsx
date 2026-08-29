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


/* =============================================================== repli ==== */

/**
 * Section repliable. Le resume porte un digest chiffre : replier range
 * l'information, ca ne l'efface pas. Un <details> natif, donc aucun
 * JavaScript et un fonctionnement clavier gratuit.
 */
export function Repli({
  titre,
  digest,
  children,
}: {
  titre: string;
  digest: string;
  children: React.ReactNode;
}) {
  return (
    <details className="v2-fold">
      <summary>
        <i className="v2-fx" aria-hidden />
        <span className="v2-ft">{titre}</span>
        <span className="v2-fd v2-tab">{digest}</span>
      </summary>
      <div className="v2-fold-corps">{children}</div>
    </details>
  );
}

/* ============================================================== afrique === */

export interface IndiceAfricain {
  code: string;
  libelle: string | null;
  place: string | null;
  devise: string | null;
  valeur: number | null;
  variation_pct: number | null;
  ytd_pct: number | null;
  date_marche: string;
}

/**
 * Places regionales. LE PIEGE EST LA FRAICHEUR : ces releves datent souvent de
 * plusieurs semaines avant la seance BRVM affichee par le reste de la page.
 * Un tableau de bord qui melange deux dates sans le dire ment par omission.
 *
 * D'ou les barres hachurees et la date estampillee sous chaque libelle, avec
 * l'ecart en jours calcule. Les indices sont en devise locale : comparables en
 * variation, jamais en niveau.
 */
export function Afrique({ indices, dateSeance }: { indices: IndiceAfricain[]; dateSeance: string }) {
  if (indices.length === 0) {
    return <p className="v2-hint">Aucun relevé régional dans la base pour l’instant.</p>;
  }

  const SPAN = 8;
  const largeur = (v: number) => (Math.min(Math.abs(v), SPAN) / SPAN) * 50;
  const jours = (d: string) =>
    Math.round((Date.parse(`${dateSeance}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86400000);
  const maxYtd = Math.max(...indices.map((i) => Math.abs(i.ytd_pct ?? 0)), 1);

  return (
    <div>
      <p className="v2-hint" style={{ marginBottom: 14 }}>
        Même graduation que le reste de la page, de −8&nbsp;% à +8&nbsp;%. Les barres hachurées ne
        viennent pas de la séance du {dateSeance}.
      </p>

      {indices.map((i) => {
        const v = i.variation_pct ?? 0;
        const ecart = jours(i.date_marche);
        return (
          <div className="v2-irow" key={i.code}>
            <div className="v2-ilab">
              <div className="v2-c">{i.code}</div>
              <div className="v2-l">
                {i.libelle ?? '—'}
                {i.place ? ` · ${i.place}` : ''}
              </div>
              <span className="v2-stamp">
                {i.date_marche} · {ecart > 0 ? `${ecart} jours plus tôt` : 'même séance'}
              </span>
            </div>
            <div className="v2-iaxe">
              <span className="v2-meridien" aria-hidden />
              <span
                className="v2-abar"
                style={{
                  [v >= 0 ? 'left' : 'right']: '50%',
                  width: `${largeur(v)}%`,
                  ['--c' as string]: v >= 0 ? 'var(--v2-up)' : 'var(--v2-down)',
                }}
                aria-hidden
              />
            </div>
            <div className="v2-ival">
              <div className="v2-p v2-tab">
                {i.valeur != null ? nf.format(i.valeur) : '—'} <small>{i.devise ?? ''}</small>
              </div>
              <div className={`v2-vv v2-tab ${v > 0 ? 'v2-up' : v < 0 ? 'v2-down' : ''}`}>
                {i.variation_pct != null ? `${signe(v)} %` : '—'}
              </div>
            </div>
          </div>
        );
      })}

      {indices.some((i) => i.ytd_pct != null) && (
        <>
          <div className="v2-grp">
            <span>Depuis le 1ᵉʳ janvier — relevé régional</span>
            <hr />
          </div>
          {indices
            .filter((i) => i.ytd_pct != null)
            .sort((a, b) => (b.ytd_pct ?? 0) - (a.ytd_pct ?? 0))
            .map((i) => (
              <div className="v2-irow" key={`ytd-${i.code}`}>
                <div className="v2-ilab">
                  <div className="v2-c">{i.code}</div>
                  <div className="v2-l">{i.place ?? ''}</div>
                </div>
                <div className="v2-iaxe">
                  <span className="v2-ytrack">
                    <i style={{ width: `${(Math.abs(i.ytd_pct ?? 0) / maxYtd) * 100}%` }} />
                  </span>
                </div>
                <div className="v2-ival">
                  <div className="v2-p v2-tab">{signe(i.ytd_pct ?? 0, 1)} %</div>
                </div>
              </div>
            ))}
        </>
      )}

      <p className="v2-hint">
        Ces indices sont libellés en devise locale&nbsp;: leurs niveaux ne sont pas comparables
        entre eux, seules les variations le sont. Le cumul annuel est celui du relevé régional, pas
        d’aujourd’hui.
      </p>
    </div>
  );
}

/* =============================================================== motifs === */

/**
 * L'ecran vide. Afficher « 0 detecte » se lit comme une panne. On montre
 * plutot CE QUI A ETE CHERCHE et pourquoi cela n'a rien donne.
 *
 * La BRVM cote en fixing - une seule fixation de prix par seance - donc les
 * motifs qui reposent sur le chemin parcouru PENDANT la seance n'ont
 * structurellement rien a observer.
 */
export function Motifs({ nbValeurs }: { nbValeurs: number }) {
  const regles: readonly (readonly [string, string, boolean])[] = [
    ['Momentum', 'Tendance marquée sur plusieurs clôtures consécutives. Applicable en fixing.', true],
    ['Volume anormal', 'Pic d’échanges rapporté à la moyenne des séances précédentes. Applicable en fixing.', true],
    ['Mouvement de prix', 'Variation significative sur une séance. Applicable en fixing.', true],
    ['Volatilité intraséance', 'Non calculable : exige un plus haut et un plus bas que la BRVM ne publie pas. La règle n’est pas évaluée, elle est hors de portée.', false],
  ];

  return (
    <div className="v2-scan">
      <div className="v2-scan-left">
        <p className="v2-scan-null">
          Aucun motif.
          <em>Les {nbValeurs} valeurs ont été passées au crible, aucune n’a déclenché de règle.</em>
        </p>
        <p className="v2-scan-p">
          Ce n’est ni une panne ni une surprise. La BRVM cote en <b>fixing</b>&nbsp;: une seule
          fixation de prix par séance. Les motifs qui reposent sur le chemin parcouru{' '}
          <b>pendant</b> la séance — accélération, retournement, volatilité intrajournalière — n’ont
          structurellement rien à observer ici. Seuls les motifs calculables sur des clôtures
          successives peuvent se déclencher.
        </p>
      </div>
      <div>
        <div className="v2-drawer-h">
          <h3>Ce qui a été cherché</h3>
          <span className="v2-tab">{regles.length} règles</span>
        </div>
        {regles.map(([nom, desc, applicable]) => (
          <div className="v2-det" key={nom}>
            <div className="v2-dn" style={applicable ? undefined : { color: 'var(--v2-ink-3)' }}>
              {nom}
            </div>
            <div className="v2-dd">{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================= le reste === */

/** Les autres écrans du produit. Chaque route existe sous frontend/app/. */
export function LeReste() {
  const items: readonly (readonly [string, string, string])[] = [
    ['Signaux', 'Score d’opportunité, sous-scores et niveau de confiance, par valeur.', '/signaux'],
    ['Marché obligataire', 'Rendement à l’échéance, duration, courbe des taux régionale.', '/obligations'],
    ['Actualités & événements', 'Communiqués, dividendes et assemblées rattachés aux valeurs.', '/actualites'],
    ['Rapports', 'Note de séance, étude d’événement, comparatif sectoriel, export.', '/dashboard/reports'],
    ['Portefeuille', 'Positions, PRU, plus-value latente, composition.', '/portefeuille'],
    ['Alertes', 'Seuils personnalisés, notifications e-mail et Telegram.', '/parametres/alertes'],
  ];

  return (
    <div className="v2-reste">
      {items.map(([titre, desc, href]) => (
        <div className="v2-reste-item" key={href}>
          <h4>{titre}</h4>
          <p>{desc}</p>
          <Link href={href} className="v2-lien">
            Ouvrir →
          </Link>
        </div>
      ))}
    </div>
  );
}


/* ========================================================== obligations === */

export interface LigneObligation {
  code: string;
  designation: string | null;
  emetteur: string | null;
  taux_pct: number | null;
  maturite: string | null;
  cours_jour: number | null;
}

export interface IndicateurMacro {
  key: string;
  label: string | null;
  value: number | null;
  unit: string | null;
  as_of: string | null;
}

/**
 * Detail obligataire et politique monetaire.
 *
 * LES ECHEANCES PASSEES SONT AFFICHEES TELLES QUELLES. Plusieurs lignes de la
 * cote portent une maturite anterieure a la seance : elles figurent ainsi dans
 * la source. Les corriger en silence serait pire que les montrer - on les
 * attenue, et une note l'explique.
 */
export function DetailObligataire({
  obligations,
  total,
  macro,
  dateSeance,
}: {
  obligations: LigneObligation[];
  total: number | null;
  macro: IndicateurMacro[];
  dateSeance: string;
}) {
  const echues = obligations.filter((o) => o.maturite != null && o.maturite < dateSeance).length;

  return (
    <div className="v2-drawer">
      <div>
        <div className="v2-drawer-h">
          <h3>Marché obligataire</h3>
          <span className="v2-tab">
            {obligations.length} lignes{total != null ? ` sur ${total}` : ''} · séance du {dateSeance}
          </span>
        </div>

        {obligations.length === 0 ? (
          <p className="v2-hint">Aucune ligne obligataire cotée à cette séance.</p>
        ) : (
          <>
            <div className="v2-pf-scroll">
              <table className="v2-pf">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Désignation</th>
                    <th className="r">Taux</th>
                    <th className="r">Échéance</th>
                    <th className="r">Cours</th>
                  </tr>
                </thead>
                <tbody>
                  {obligations.map((o) => {
                    const c = o.maturite != null && o.maturite < dateSeance ? 'v2-echue' : '';
                    return (
                      <tr key={o.code}>
                        <td className={c}>
                          <b>{o.code}</b>
                        </td>
                        <td className={`v2-nm ${c}`}>{o.designation ?? o.emetteur ?? '—'}</td>
                        <td className={`r ${c}`}>{o.taux_pct != null ? `${pct(o.taux_pct)} %` : '—'}</td>
                        <td className={`r ${c}`}>{o.maturite?.slice(0, 4) ?? '—'}</td>
                        <td className={`r ${c}`}>
                          {o.cours_jour != null ? nf.format(Math.round(o.cours_jour)) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {echues > 0 && (
              <p className="v2-hint">
                {echues} ligne{echues > 1 ? 's portent' : ' porte'} une échéance déjà passée&nbsp;:
                elle{echues > 1 ? 's figurent' : ' figure'} ainsi dans la source et{' '}
                {echues > 1 ? 'sont affichées' : 'est affichée'} telle{echues > 1 ? 's' : ''} quelle
                {echues > 1 ? 's' : ''}. Les corriger en silence serait pire que les montrer.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <div className="v2-drawer-h">
          <h3>Politique monétaire</h3>
          <span className="v2-tab">UEMOA</span>
        </div>
        {macro.length === 0 ? (
          <p className="v2-hint">Aucun indicateur macro en base.</p>
        ) : (
          macro.map((m) => (
            <div className="v2-mline" key={m.key}>
              <span className="v2-ml">
                {m.label ?? m.key}
                {m.as_of && <em>depuis le {m.as_of}</em>}
              </span>
              <span className="v2-mv v2-tab">
                {m.value != null ? nf.format(m.value) : '—'} {m.unit ?? ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ====================================================== signaux & suivi === */

export interface LigneSignal {
  code: string;
  signal: string | null;
  score_total: number | null;
  confiance: number | null;
}

/**
 * Signaux du jour et valeurs suivies.
 *
 * Les signaux sont calcules par le scoring du produit : ils sont REELS. La
 * repartition BUY / HOLD / SELL est comptee sur l'ensemble de la seance.
 *
 * Un zero de SELL n'est PAS un avis d'achat : le modele neutralise en HOLD des
 * que l'historique ou la liquidite ne permettent pas un calcul fiable. La note
 * le dit, sinon le chiffre serait lu a l'envers.
 *
 * Les valeurs suivies sont une donnee PERSONNELLE, lue sous la RLS du compte.
 * Sans liste, on affiche un etat vide - jamais un exemple deguise.
 */
export function SignauxEtSuivi({
  signaux,
  suivies,
  variations,
}: {
  signaux: LigneSignal[];
  suivies: string[];
  variations: Map<string, number>;
}) {
  const compte = (s: string) => signaux.filter((x) => (x.signal ?? '').toUpperCase() === s).length;
  const buy = compte('BUY');
  const hold = compte('HOLD');
  const sell = compte('SELL');
  const tete = [...signaux]
    .sort((a, b) => (b.score_total ?? 0) - (a.score_total ?? 0))
    .slice(0, 5);

  return (
    <div className="v2-drawer">
      <div>
        <div className="v2-drawer-h">
          <h3>Signaux du jour</h3>
          <span className="v2-tab">{signaux.length} valeurs</span>
        </div>

        {signaux.length === 0 ? (
          <p className="v2-hint">Aucun signal calculé pour cette séance.</p>
        ) : (
          <>
            <div className="v2-sgtot">
              <span className="v2-sg">
                <b className="v2-up">{buy}</b> BUY
              </span>
              <span className="v2-sg">
                <b>{hold}</b> HOLD
              </span>
              <span className="v2-sg">
                <b className={sell > 0 ? 'v2-down' : undefined}>{sell}</b> SELL
              </span>
            </div>
            {tete.map((s) => {
              const sig = (s.signal ?? 'HOLD').toUpperCase();
              return (
                <div className="v2-sgrow" key={s.code}>
                  <span className="v2-sgc">{s.code}</span>
                  <span
                    className={`v2-sgb ${sig === 'BUY' ? 'v2-b-up' : sig === 'SELL' ? 'v2-b-down' : 'v2-b-flat'}`}
                  >
                    {sig}
                  </span>
                  <span className="v2-sgs v2-tab">
                    {s.score_total != null ? pct(s.score_total) : '—'}
                  </span>
                  <span className="v2-sgx v2-tab">
                    conf. {s.confiance != null ? pct(s.confiance) : '—'}
                  </span>
                </div>
              );
            })}
            {sell === 0 && (
              <p className="v2-hint">
                Aucun SELL ce jour&nbsp;: le modèle neutralise en HOLD dès que l’historique ou la
                liquidité ne permettent pas un calcul fiable. Un zéro affiché ici est un refus de
                trancher, pas un avis d’achat.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <div className="v2-drawer-h">
          <h3>Valeurs suivies</h3>
          <span className="v2-tab">{suivies.length}</span>
        </div>
        {suivies.length === 0 ? (
          <div className="v2-vide">
            <p>Aucune valeur en liste de suivi.</p>
            <p className="v2-hint">
              <Link href="/parametres/alertes" className="v2-lien">
                Créer une liste et des seuils
              </Link>
            </p>
          </div>
        ) : (
          suivies.map((code) => {
            const v = variations.get(code);
            return (
              <div className="v2-sgrow" key={code}>
                <span className="v2-sgc">{code}</span>
                <span className="v2-sgx">
                  {v == null ? 'non cotée à cette séance' : 'variation du jour'}
                </span>
                <span
                  className={`v2-sgs v2-tab ${v == null ? '' : v >= 0 ? 'v2-up' : 'v2-down'}`}
                >
                  {v == null ? '—' : `${signe(v)} %`}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
