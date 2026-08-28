import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Bascule, Peigne, type LigneCote, type Ponderation } from './Interactif';
import {
  Bandes,
  Portefeuille,
  Trajectoire,
  type ItemBande,
  type LignePortefeuille,
  type PointSerie,
} from './Sections';
import './v2.css';

/**
 * Tableau de bord — seconde version, en cohabitation.
 *
 * `/dashboard` continue de tourner sans changement. Cette route propose une
 * autre hiérarchie du même marché : une strate d'état, un verdict qui affiche
 * sa règle, et la cote entière sur un axe de variation unique.
 *
 * L'idée directrice : le nombre de valeurs et le poids en capitaux racontent
 * deux séances différentes. La bascule le montre au lieu de le décrire.
 *
 * TOUTES les valeurs viennent de Supabase. Aucun chiffre n'est écrit en dur,
 * et rien n'est estimé : quand une donnée manque, la page le dit.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tableau de bord v2' };

const nf = new Intl.NumberFormat('fr-FR');
const pct = (x: number, d = 2) => x.toFixed(d).replace('.', ',').replace('-', '−');
const signe = (x: number, d = 2) => `${x > 0 ? '+' : ''}${pct(x, d)}`;

function montantCourt(x: number) {
  if (x >= 1e9) return `${(x / 1e9).toFixed(2).replace('.', ',')} Md`;
  if (x >= 1e6) return `${(x / 1e6).toFixed(1).replace('.', ',')} M`;
  if (x >= 1e3) return `${Math.round(x / 1e3)} k`;
  return String(Math.round(x));
}

interface ActionRow {
  code: string;
  designation: string | null;
  variation_pct: number | null;
  valeur_echangee: number | null;
  nb_transactions: number | null;
  volume: number | null;
}

interface IndiceRow {
  code: string;
  libelle: string | null;
  valeur: number | null;
  variation_pct: number | null;
}

async function getData() {
  const supabase = createClient();

  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate: string | null = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) {
    return {
      lastDate: null,
      lastIdxDate: null,
      actions: [] as ActionRow[],
      indices: [] as IndiceRow[],
      nbObligations: null as number | null,
    };
  }

  // Les indices ne sont pas toujours relevés à la même date que les cours.
  const { data: lastIdxRow } = await supabase
    .from('brvm_indices_daily')
    .select('date_marche')
    .not('valeur', 'is', null)
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastIdxDate: string = lastIdxRow?.[0]?.date_marche ?? lastDate;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: actions },
    { data: indices },
    { count: nbObligations },
    { data: histo },
    { data: obligations },
    { data: positions },
  ] = await Promise.all([
    supabase
      .from('brvm_actions_daily')
      .select('code, designation, variation_pct, valeur_echangee, nb_transactions, volume')
      .eq('date_marche', lastDate),
    supabase
      .from('brvm_indices_daily')
      .select('code, libelle, valeur, variation_pct')
      .eq('date_marche', lastIdxDate),
    supabase
      .from('brvm_obligations_daily')
      .select('code', { count: 'exact', head: true })
      .eq('date_marche', lastDate),
    // Historique des deux indices de marche, pour la trajectoire.
    supabase
      .from('brvm_indices_daily')
      .select('code, valeur, date_marche')
      .in('code', ['BRVMC', 'BRVM30'])
      .not('valeur', 'is', null)
      .lte('date_marche', lastIdxDate)
      .order('date_marche', { ascending: true })
      .limit(80),
    supabase
      .from('brvm_obligations_daily')
      .select('code, cours_jour')
      .eq('date_marche', lastDate)
      .not('cours_jour', 'is', null)
      .limit(14),
    // Positions du compte connecte. Donnee PERSONNELLE : lue sous la RLS,
    // jamais fabriquee. Sans session, la requete ne part meme pas.
    user
      ? supabase
          .from('portfolios_positions')
          .select('code, quantite, prix_entree')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    lastDate,
    lastIdxDate,
    actions: (actions ?? []) as ActionRow[],
    indices: (indices ?? []) as IndiceRow[],
    nbObligations: nbObligations ?? null,
    histo: (histo ?? []) as { code: string; valeur: number | null; date_marche: string }[],
    obligations: (obligations ?? []) as { code: string; cours_jour: number | null }[],
    positions: (positions ?? []) as { code: string; quantite: number; prix_entree: number }[],
  };
}

export default async function DashboardV2() {
  const { lastDate, lastIdxDate, actions, indices, nbObligations, histo, obligations, positions } =
    await getData();

  if (!lastDate || actions.length === 0) {
    return (
      <div className="dash-v2 mx-auto max-w-[1440px] px-4 py-16">
        <h1 className="font-display text-2xl text-ivory">Tableau de bord v2</h1>
        <p className="mt-3 text-sm text-muted">
          Aucune séance en base pour l’instant. Cette page n’affiche rien plutôt que d’estimer des
          valeurs.{' '}
          <Link href="/dashboard" className="text-accent underline underline-offset-4">
            Revenir au tableau de bord
          </Link>
        </p>
      </div>
    );
  }

  /* ---- agrégats de séance, tous calculés sur les lignes réelles ---------- */
  const hausses = actions.filter((a) => (a.variation_pct ?? 0) > 0);
  const baisses = actions.filter((a) => (a.variation_pct ?? 0) < 0);
  const stables = actions.filter((a) => (a.variation_pct ?? 0) === 0);
  const total = actions.length;

  const somme = (rows: ActionRow[], k: 'valeur_echangee' | 'nb_transactions') =>
    rows.reduce((s, a) => s + (a[k] ?? 0), 0);

  const veTotal = somme(actions, 'valeur_echangee');
  const ntTotal = somme(actions, 'nb_transactions');
  const titres = actions.reduce((s, a) => s + (a.volume ?? 0), 0);

  const part = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

  /* Les trois pondérations de la MÊME séance. C'est l'écart entre elles qui
     porte l'information : la cote peut être à l'équilibre en nombre et
     franchement vendeuse en capitaux. */
  const mesures: Ponderation[] = [
    {
      cle: 'valeurs',
      libelle: 'Valeurs',
      unite: 'Une valeur pèse une unité',
      qualificatif: 'le décompte brut',
      baisse: part(baisses.length, total),
      stable: part(stables.length, total),
      hausse: part(hausses.length, total),
      etiqBaisse: String(baisses.length),
      etiqHausse: String(hausses.length),
    },
    {
      cle: 'transactions',
      libelle: 'Transactions',
      unite: 'Une valeur pèse ses transactions',
      qualificatif: 'pondéré par l’activité',
      baisse: part(somme(baisses, 'nb_transactions'), ntTotal),
      stable: part(somme(stables, 'nb_transactions'), ntTotal),
      hausse: part(somme(hausses, 'nb_transactions'), ntTotal),
      etiqBaisse: nf.format(somme(baisses, 'nb_transactions')),
      etiqHausse: nf.format(somme(hausses, 'nb_transactions')),
    },
    {
      cle: 'capitaux',
      libelle: 'Capitaux',
      unite: 'Une valeur pèse ses capitaux',
      qualificatif: 'pondéré par l’argent engagé',
      baisse: part(somme(baisses, 'valeur_echangee'), veTotal),
      stable: part(somme(stables, 'valeur_echangee'), veTotal),
      hausse: part(somme(hausses, 'valeur_echangee'), veTotal),
      etiqBaisse: `${pct(part(somme(baisses, 'valeur_echangee'), veTotal), 1)} %`,
      etiqHausse: `${pct(part(somme(hausses, 'valeur_echangee'), veTotal), 1)} %`,
    },
  ];

  const partBaissiere = mesures[2].baisse;
  const composite = indices.find((i) => i.code === 'BRVMC' || /composite/i.test(i.libelle ?? ''));
  const brvm30 = indices.find((i) => i.code === 'BRVM30' || /\b30\b/.test(i.libelle ?? ''));

  /* Le verdict affiche SA RÈGLE, seuils fixés à l'avance, et le résultat de
     chaque test. Une pastille d'état sans sa règle n'est pas vérifiable. */
  const compoVar = composite?.variation_pct ?? null;
  const testCompo = compoVar != null && compoVar < -1;
  const testCapitaux = partBaissiere > 60;
  const verdict =
    testCompo && testCapitaux ? 'À surveiller' : testCompo || testCapitaux ? 'Contrasté' : 'Sans alerte';
  const couleurVerdict =
    testCompo && testCapitaux
      ? 'var(--v2-down)'
      : testCompo || testCapitaux
        ? 'var(--v2-accent)'
        : 'var(--v2-up)';

  const lignes: LigneCote[] = actions
    .filter((a) => a.variation_pct != null)
    .map((a) => ({
      code: a.code,
      nom: a.designation,
      variation: a.variation_pct as number,
      valeurEchangee: a.valeur_echangee ?? 0,
      transactions: a.nb_transactions ?? 0,
      volume: a.volume ?? 0,
    }));

  const SPAN = 8;
  const largeurBarre = (v: number) => (Math.min(Math.abs(v), SPAN) / SPAN) * 50;

  /* ---- series pour la trajectoire, dans l'ordre chronologique ----------- */
  const serie = (code: string): PointSerie[] =>
    histo
      .filter((h) => h.code === code && h.valeur != null)
      .map((h) => ({ date: h.date_marche, valeur: h.valeur as number }));
  const serieA = serie('BRVMC');
  const serieB = serie('BRVM30');

  /* ---- bandes : les plus fortes variations, puis les obligations -------- */
  const bandeActions: ItemBande[] = [...lignes]
    .sort((a, b) => Math.abs(b.variation) - Math.abs(a.variation))
    .slice(0, 16)
    .map((l) => ({
      code: l.code,
      valeur: nf.format(Math.round(l.volume > 0 ? l.valeurEchangee / l.volume : 0)),
      variation: l.variation,
    }));
  const bandeObligations: ItemBande[] = obligations
    .filter((o) => o.cours_jour != null)
    .map((o) => ({ code: o.code, valeur: nf.format(Math.round(o.cours_jour as number)) }));

  /* ---- portefeuille : positions reelles, valorisees aux clotures -------- */
  const parCode = new Map(actions.map((a) => [a.code, a]));
  const lignesPf: LignePortefeuille[] = positions
    .filter((p) => p.code !== 'LIQUIDITES' && p.quantite > 0)
    .map((p) => {
      const a = parCode.get(p.code);
      const ve = a?.valeur_echangee ?? null;
      const vol = a?.volume ?? null;
      return {
        code: p.code,
        quantite: p.quantite,
        prixEntree: p.prix_entree,
        cours: ve != null && vol != null && vol > 0 ? ve / vol : null,
        variation: a?.variation_pct ?? null,
      };
    });

  const dateFr = new Date(`${lastDate}T12:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="dash-v2 mx-auto max-w-[1440px] px-4 pb-16 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 py-5">
        <h1 className="font-display text-xl text-ivory md:text-2xl">
          Tableau de bord <span className="text-accent">v2</span>
        </h1>
        <Link
          href="/dashboard"
          className="v2-tab text-[11px] uppercase tracking-[0.16em] text-muted underline underline-offset-4 hover:text-ivory"
        >
          Version actuelle →
        </Link>
      </div>

      <Bandes actions={bandeActions} obligations={bandeObligations} />

      {/* ---- strate d'état : six colonnes d'une même grammaire ------------ */}
      <div className="v2-cadre">
        <div className="v2-cstate">
          <div className="v2-k">Séance</div>
          <div className="v2-val">Clôturée</div>
          <div className="v2-s">{dateFr}</div>
        </div>
        <div className="v2-cstate">
          <div className="v2-k">Cote</div>
          <div className="v2-val v2-tab">{total} valeurs</div>
          <div className="v2-s">
            {hausses.length} hausses · {baisses.length} baisses · {stables.length} stables
          </div>
        </div>
        <div className="v2-cstate">
          <div className="v2-k">Capitaux</div>
          <div className="v2-val v2-tab">{montantCourt(veTotal)} FCFA</div>
          <div className="v2-s">{nf.format(ntTotal)} transactions</div>
        </div>
        <div className="v2-cstate">
          <div className="v2-k">Titres échangés</div>
          <div className="v2-val v2-tab">{nf.format(titres)}</div>
          <div className="v2-s">sur l’ensemble de la cote</div>
        </div>
        <div className="v2-cstate">
          <div className="v2-k">Obligations</div>
          <div className="v2-val v2-tab">
            {nbObligations != null ? `${nf.format(nbObligations)} lignes` : '—'}
          </div>
          <div className="v2-s">
            {nbObligations != null ? 'cotées à la même séance' : 'non disponibles'}
          </div>
        </div>
        <div className="v2-cstate">
          <div className="v2-k">Indices</div>
          <div className="v2-val v2-tab">{indices.length}</div>
          <div className="v2-s">
            {lastIdxDate && lastIdxDate !== lastDate ? `relevés du ${lastIdxDate}` : 'même séance'}
          </div>
        </div>
      </div>

      {/* ---- verdict + bascule ------------------------------------------- */}
      <section className="v2-verdict" aria-labelledby="v2-t-verdict">
        <div className="v2-vleft">
          <h2 className="v2-vword" id="v2-t-verdict">
            <i style={{ background: couleurVerdict }} aria-hidden />
            {verdict}
          </h2>
          <p className="v2-vlead">
            {baisses.length} baisses contre {hausses.length} hausses.{' '}
            <em>{pct(partBaissiere, 1)} % des capitaux à la baisse.</em>
          </p>

          <div className="v2-big">
            <div
              className="v2-bignum"
              style={{ color: (compoVar ?? 0) < 0 ? 'var(--v2-down)' : 'var(--v2-up)' }}
            >
              {compoVar != null ? `${signe(compoVar)} %` : '—'}
            </div>
            <div className="v2-bigside">
              <div className="v2-l1">{composite?.libelle ?? 'BRVM Composite'}</div>
              <div className="v2-l2 v2-tab">
                {composite?.valeur != null ? pct(composite.valeur) : '—'}
              </div>
              <div className="v2-l3 v2-tab">
                {brvm30
                  ? `${brvm30.libelle ?? 'BRVM 30'} · ${brvm30.valeur != null ? pct(brvm30.valeur) : '—'} · ${brvm30.variation_pct != null ? `${signe(brvm30.variation_pct)} %` : '—'}`
                  : 'BRVM 30 non relevé'}
              </div>
            </div>
          </div>

          <p className="v2-vconseq">
            <span className="v2-lb">Règle appliquée — seuils fixés à l’avance</span>
            Composite &lt; −1,00 % → <b>{testCompo ? 'vrai' : 'faux'}</b>
            {compoVar != null ? ` (${signe(compoVar)} %)` : ''}
            <br />
            ET part baissière des capitaux &gt; 60 % → <b>{testCapitaux ? 'vrai' : 'faux'}</b> (
            {pct(partBaissiere, 1)} %)
          </p>
        </div>

        <div>
          <Bascule mesures={mesures} />
        </div>
      </section>

      {/* ---- dispersion --------------------------------------------------- */}
      <section className="pt-7" aria-labelledby="v2-t-disp">
        <h2 id="v2-t-disp" className="v2-tab text-[11px] uppercase tracking-[0.22em] text-muted">
          Toute la cote sur un seul axe
        </h2>
        <p className="mt-1 max-w-[78ch] text-[12.5px] italic text-faint">
          Chaque trait est une valeur : sa position donne la variation du jour, sa hauteur la
          grandeur choisie. L’axe couvre −8 % à +8 %.
        </p>
        <div className="mt-4">
          <Peigne lignes={lignes} />
        </div>
      </section>

      {/* ---- indices sur le même axe -------------------------------------- */}
      <section className="pt-9" aria-labelledby="v2-t-ind">
        <h2 id="v2-t-ind" className="v2-tab text-[11px] uppercase tracking-[0.22em] text-muted">
          Les indices, sur le même axe
        </h2>
        <p className="mt-1 max-w-[78ch] text-[12.5px] italic text-faint">
          Même graduation que la dispersion. Les indices bougent moins que les valeurs — les barres
          sont courtes, c’est exact.
        </p>
        <div className="mt-4">
          {indices.map((idx) => {
            const v = idx.variation_pct ?? 0;
            const w = largeurBarre(v);
            return (
              <div className="v2-irow" key={idx.code}>
                <div className="v2-ilab">
                  <div className="v2-c">{idx.code}</div>
                  <div className="v2-l">{idx.libelle ?? '—'}</div>
                </div>
                <div className="v2-iaxe">
                  <span className="v2-meridien" aria-hidden />
                  <span
                    className="v2-ibar"
                    style={{
                      [v >= 0 ? 'left' : 'right']: '50%',
                      width: `${w}%`,
                      background: v >= 0 ? 'var(--v2-up)' : 'var(--v2-down)',
                    }}
                    aria-hidden
                  />
                </div>
                <div className="v2-ival">
                  <div className="v2-p v2-tab">{idx.valeur != null ? pct(idx.valeur) : '—'}</div>
                  <div className={`v2-vv v2-tab ${v > 0 ? 'v2-up' : v < 0 ? 'v2-down' : ''}`}>
                    {idx.variation_pct != null ? `${signe(v)} %` : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- trajectoire --------------------------------------------------- */}
      <section className="pt-9" aria-labelledby="v2-t-traj">
        <h2 id="v2-t-traj" className="v2-tab text-[11px] uppercase tracking-[0.22em] text-muted">
          Trajectoire des indices
        </h2>
        <p className="mt-1 max-w-[78ch] text-[12.5px] italic text-faint">
          Clôtures ramenées en base 100 pour rendre les deux séries comparables.
        </p>
        <div className="mt-4">
          <Trajectoire serieA={serieA} serieB={serieB} libelleA="BRVM Composite" libelleB="BRVM 30" />
        </div>
      </section>

      {/* ---- portefeuille -------------------------------------------------- */}
      <section className="pt-9" aria-labelledby="v2-t-pf">
        <h2 id="v2-t-pf" className="v2-tab text-[11px] uppercase tracking-[0.22em] text-muted">
          Mon portefeuille
        </h2>
        <p className="mt-1 max-w-[78ch] text-[12.5px] italic text-faint">
          Vos positions, valorisées aux clôtures de cette séance.
        </p>
        <div className="mt-4">
          <Portefeuille lignes={lignesPf} />
        </div>
      </section>

      <p className="v2-tab mt-8 border-t border-border pt-4 text-[10.5px] leading-relaxed text-faint">
        Source — séance BRVM du {lastDate}
        {lastIdxDate && lastIdxDate !== lastDate ? `, indices relevés le ${lastIdxDate}` : ''}. Tous
        les montants sont en FCFA. Les agrégats (largeur, parts, totaux) sont calculés sur les
        lignes de cette séance ; aucune valeur n’est estimée. Cette page cohabite avec la version
        actuelle du tableau de bord, qui reste inchangée.
      </p>
    </div>
  );
}
