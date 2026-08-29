'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Les deux pièces interactives du tableau de bord v2.
 *
 * LA BASCULE — la même séance, pondérée de trois façons. Le nombre de valeurs
 * dit « presque à l'équilibre », les capitaux disent « massivement vendeur ».
 * Une seule barre qui se repondère fait comprendre l'écart mieux que trois
 * barres empilées à comparer de mémoire.
 *
 * LE PEIGNE — toute la cote sur un axe de variation unique, la hauteur portant
 * la grandeur choisie. Le pointeur lit la valeur la PLUS PROCHE plutôt que de
 * viser une cible : à 390 px certaines dents mesurent moins d'un pixel, et les
 * écarter reviendrait à mentir sur leur variation. Le clavier parcourt la série
 * dans l'ordre de l'axe, ce qui garantit l'accès à toutes les valeurs — y
 * compris celles que le doigt ne peut pas viser.
 *
 * Aucune valeur n'est calculée ici : tout arrive en props depuis le serveur.
 */

export interface LigneCote {
  code: string;
  nom: string | null;
  variation: number;
  valeurEchangee: number;
  transactions: number;
  volume: number;
}

export interface Ponderation {
  cle: string;
  libelle: string;
  unite: string;
  qualificatif: string;
  baisse: number;
  stable: number;
  hausse: number;
  etiqBaisse: string;
  etiqHausse: string;
}

/** L'axe couvre −8 % à +8 %, comme partout ailleurs sur la page. */
const SPAN = 8;

const nf = new Intl.NumberFormat('fr-FR');
const pct = (x: number, d = 2) => x.toFixed(d).replace('.', ',').replace('-', '−');

function montant(x: number) {
  if (x >= 1e9) return `${(x / 1e9).toFixed(2).replace('.', ',')} Md`;
  if (x >= 1e6) return `${Math.round(x / 1e6)} M`;
  if (x >= 1e3) return `${Math.round(x / 1e3)} k`;
  return String(Math.round(x));
}

/* ---------------------------------------------------------------- bascule */

export function Bascule({ mesures }: { mesures: Ponderation[] }) {
  // On démarre sur la mesure la plus grossière et la séquence d'ouverture
  // amène jusqu'aux capitaux : c'est le glissement qui informe, pas l'arrivée.
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const joue = useRef(true);

  useEffect(() => {
    if (mesures.length < 2) return;
    const dernier = mesures.length - 1;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduit) {
      joue.current = false;
      setI(dernier);
      return;
    }
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) {
      setI(dernier);
      return;
    }
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting) || !joue.current) return;
        io.disconnect();
        t1 = setTimeout(() => joue.current && setI(Math.min(1, dernier)), 700);
        t2 = setTimeout(() => {
          if (!joue.current) return;
          setI(dernier);
          joue.current = false;
        }, 1750);
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mesures.length]);

  if (mesures.length === 0) return null;
  const m = mesures[Math.min(i, mesures.length - 1)];

  return (
    <div className="v2-morph" ref={ref}>
      <div className="v2-filtres" role="group" aria-label="Unité de mesure de la séance">
        {mesures.map((x, k) => (
          <button
            key={x.cle}
            type="button"
            aria-pressed={k === i}
            onClick={() => {
              joue.current = false;
              setI(k);
            }}
          >
            {x.libelle}
          </button>
        ))}
      </div>

      <div className="v2-morph-top">
        <span className="v2-mt-l">{m.unite}</span>
        <span className="v2-mt-r">{m.qualificatif}</span>
      </div>

      <div
        className="v2-morph-bar"
        role="img"
        aria-label={`${m.unite} : ${pct(m.baisse, 1)} % en baisse, ${pct(m.stable, 1)} % inchangées, ${pct(m.hausse, 1)} % en hausse.`}
      >
        <div className="v2-mb v2-sd" style={{ flex: `0 0 ${m.baisse}%` }}>
          <span>{m.etiqBaisse}</span>
        </div>
        <div className="v2-mb v2-sf" style={{ flex: `0 0 ${m.stable}%` }} />
        <div className="v2-mb v2-su" style={{ flex: `0 0 ${m.hausse}%` }}>
          <span>{m.etiqHausse}</span>
        </div>
      </div>

      {/* Les repères fantômes gardent la comparaison simultanée que trois barres
          empilées offraient : on voit où tomberait la frontière avec chacune
          des autres unités de mesure. */}
      <div className="v2-ghosts" aria-hidden>
        {mesures.map((x, k) => (
          <i key={x.cle} className={k === i ? 'v2-gh on' : 'v2-gh'} style={{ left: `${x.baisse}%` }}>
            <b>{pct(x.baisse, 1)}</b>
          </i>
        ))}
      </div>

      <div className="v2-legend">
        <span>
          <i className="v2-sw v2-sd" />
          en baisse
        </span>
        <span>
          <i className="v2-sw v2-sf" />
          inchangées
        </span>
        <span>
          <i className="v2-sw v2-su" />
          en hausse
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- peigne */

type Unite = 'valeurEchangee' | 'transactions' | 'volume';
type Filtre = 'all' | 'up' | 'down' | 'flat';

export function Peigne({
  lignes,
  miennes = [],
}: {
  lignes: LigneCote[];
  miennes?: string[];
}) {
  const aMoi = new Set(miennes);
  const [lu, setLu] = useState(0);
  const [unite, setUnite] = useState<Unite>('valeurEchangee');
  const [filtre, setFiltre] = useState<Filtre>('all');
  const combRef = useRef<HTMLDivElement>(null);

  // Positions sur l'axe, avec éventail pour les valeurs superposées : sans lui,
  // plusieurs titres à 0,00 % tombent au même pixel et un seul reste lisible.
  const xs = useMemo(() => {
    const xOf = (v: number) => ((Math.max(-SPAN, Math.min(SPAN, v)) + SPAN) / (2 * SPAN)) * 100;
    const base = lignes.map((l) => xOf(l.variation));
    const paquets = new Map<string, number[]>();
    base.forEach((x, k) => {
      const c = x.toFixed(4);
      paquets.set(c, [...(paquets.get(c) ?? []), k]);
    });
    paquets.forEach((g) => {
      if (g.length < 2) return;
      g.forEach((k, n) => {
        base[k] += (n - (g.length - 1) / 2) * 0.55;
      });
    });
    return base;
  }, [lignes]);

  /** Ordre le long de l'axe : sert au parcours clavier. */
  const ordre = useMemo(() => xs.map((_, k) => k).sort((a, b) => xs[a] - xs[b]), [xs]);

  const max = useMemo(
    () => lignes.reduce((m, l) => Math.max(m, l[unite] ?? 0), 0) || 1,
    [lignes, unite],
  );
  const totalVe = useMemo(() => lignes.reduce((s, x) => s + (x.valeurEchangee ?? 0), 0), [lignes]);

  if (lignes.length === 0) return null;

  const plusProche = (clientX: number) => {
    const r = combRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    const p = ((clientX - r.left) / r.width) * 100;
    let best = 0;
    let d = Infinity;
    xs.forEach((x, k) => {
      const e = Math.abs(x - p);
      if (e < d) {
        d = e;
        best = k;
      }
    });
    return best;
  };

  const l = lignes[Math.min(lu, lignes.length - 1)];

  return (
    <div className="v2-disp">
      <div className="v2-barres">
        <div className="v2-filtres" role="group" aria-label="Unité de hauteur des traits">
          {(
            [
              ['valeurEchangee', 'Capitaux'],
              ['transactions', 'Transactions'],
              ['volume', 'Titres'],
            ] as [Unite, string][]
          ).map(([k, lib]) => (
            <button key={k} type="button" aria-pressed={unite === k} onClick={() => setUnite(k)}>
              {lib}
            </button>
          ))}
        </div>
        <div className="v2-filtres" role="group" aria-label="Filtrer les valeurs affichées">
          {(
            [
              ['all', 'Toutes'],
              ['up', 'Hausses'],
              ['down', 'Baisses'],
              ['flat', 'Inchangées'],
            ] as [Filtre, string][]
          ).map(([k, lib]) => (
            <button key={k} type="button" aria-pressed={filtre === k} onClick={() => setFiltre(k)}>
              {lib}
            </button>
          ))}
        </div>
      </div>

      <div
        className="v2-comb"
        ref={combRef}
        tabIndex={0}
        role="application"
        aria-label={`Dispersion des ${lignes.length} valeurs de la cote. Déplacez le pointeur pour lire la valeur la plus proche, ou utilisez les flèches gauche et droite.`}
        onMouseMove={(e) => setLu(plusProche(e.clientX))}
        onTouchStart={(e) => e.touches.length === 1 && setLu(plusProche(e.touches[0].clientX))}
        onTouchMove={(e) => e.touches.length === 1 && setLu(plusProche(e.touches[0].clientX))}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const pos = ordre.indexOf(lu);
          const suiv = Math.max(
            0,
            Math.min(ordre.length - 1, (pos < 0 ? 0 : pos) + (e.key === 'ArrowRight' ? 1 : -1)),
          );
          setLu(ordre[suiv]);
        }}
      >
        <span className="v2-meridien" aria-hidden />
        {lignes.map((x, k) => {
          const dir = x.variation > 0 ? 'up' : x.variation < 0 ? 'down' : 'flat';
          const masque = filtre !== 'all' && filtre !== dir;
          // Les lignes detenues ou suivies portent un repere sous l'axe.
          const mien = aMoi.has(x.code);
          // Échelle en racine carrée : sinon SONATEL écrase tout le reste.
          // Plancher de visibilité pour que les très petites lignes existent.
          const f = Math.max(Math.sqrt((x[unite] ?? 0) / max), 0.024);
          return (
            <span
              key={`${x.code}-${k}`}
              className={`v2-dent v2-${dir}${k === lu ? ' on' : ''}${masque ? ' mute' : ''}${mien ? ' mien' : ''}`}
              style={{ left: `${xs[k]}%`, ['--f' as string]: f.toFixed(4) }}
              aria-hidden
            />
          );
        })}
      </div>

      <div className="v2-echelle" aria-hidden>
        {[-8, -6, -4, -2, 0, 2, 4, 6, 8].map((g) => (
          <span key={g} className={g === 0 ? 'v2-tick zero' : 'v2-tick'} style={{ left: `${((g + SPAN) / (2 * SPAN)) * 100}%` }}>
            <i />
            <b>{g === 0 ? '0' : `${g > 0 ? '+' : '−'}${Math.abs(g)}`}</b>
          </span>
        ))}
      </div>

      <div className="v2-lecteur" aria-live="polite">
        <div className="v2-cell v2-id">
          <div className="v2-k">Ligne lue</div>
          <div className="v2-n">{l.code}</div>
          <div className="v2-d">{l.nom ?? 'Valeur non désignée'}</div>
        </div>
        <div className="v2-cell">
          <div className="v2-k">Variation</div>
          <div className={`v2-v ${l.variation > 0 ? 'v2-up' : l.variation < 0 ? 'v2-down' : ''}`}>
            {l.variation > 0 ? '+' : ''}
            {pct(l.variation)} %
          </div>
        </div>
        <div className="v2-cell">
          <div className="v2-k">Valeur échangée</div>
          <div className="v2-v">{nf.format(Math.round(l.valeurEchangee))}</div>
        </div>
        <div className="v2-cell">
          <div className="v2-k">Transactions</div>
          <div className="v2-v">{nf.format(l.transactions)}</div>
        </div>
        <div className="v2-cell">
          <div className="v2-k">Part du montant</div>
          <div className="v2-v">
            {totalVe > 0 ? `${pct((l.valeurEchangee / totalVe) * 100)} %` : '—'}
          </div>
        </div>
      </div>

      <p className="v2-hint">
        Survolez, touchez ou tabulez le graphique pour lire une valeur. Échelle de hauteur en racine
        carrée — les grosses lignes n’écrasent pas les petites. Maximum affiché&nbsp;: {montant(max)}.
      </p>
    </div>
  );
}
