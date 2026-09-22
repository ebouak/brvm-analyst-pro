'use client';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';

/**
 * « Le fil conducteur » — les sept étapes de la méthode, cliquables.
 *
 * · cascade à l'apparition et ressort au survol en CSS pur (`.step` dans
 *   landing-bis.css) : zéro dépendance, `prefers-reduced-motion` respecté ;
 * · un clic sur une étape ouvre un panneau de contextualisation alimenté par
 *   un FAIT réel calculé côté serveur (`Fait`) — jamais un chiffre d'exemple.
 *   Sans donnée, le panneau le dit plutôt que d'inventer ;
 * · sémantique onglets (tablist / tab / tabpanel) : les onglets sont enfants
 *   DIRECTS du tablist — un <li> entre les deux casse la règle ARIA
 *   (aria-required-children / -parent) et retire la sémantique de liste.
 */

export interface Fait {
  /** Étiquette courte au-dessus de la valeur (« Meilleure note du jour »). */
  libelle: string;
  /** La valeur mise en avant (« B+ · SHEC »), déjà formatée. */
  valeur: string;
  /** Une phrase de contexte, dérivée de la même donnée. */
  detail: string;
  href?: string;
  hrefLabel?: string;
}

export interface Etape {
  k: string;
  t: string;
  d: string;
  bg: string;
  c: string;
  ic: ReactNode;
  fait: Fait | null;
}

export function FilConducteur({ etapes }: { etapes: Etape[] }) {
  const [sel, setSel] = useState(0);
  const id = useId();
  const go = (k: number) => setSel(((k % etapes.length) + etapes.length) % etapes.length);
  const e = etapes[sel];

  return (
    <div className="fil-wrap">
      <div className="steps" id="methode" role="tablist" aria-label="La méthode en sept étapes" onKeyDown={(ev) => { if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(sel - 1); } if (ev.key === 'ArrowRight') { ev.preventDefault(); go(sel + 1); } }}>
        {etapes.map((s, k) => (
          <button className={`step${k === sel ? ' is-sel' : ''}`} key={s.k} style={{ ['--i' as string]: k }} type="button" role="tab" id={`${id}-tab-${k}`} aria-selected={k === sel} aria-controls={`${id}-panel`} tabIndex={k === sel ? 0 : -1} onClick={() => setSel(k)}>
              <span className="ic" style={{ background: s.bg, color: s.c }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{s.ic}</svg></span>
              <span className="k">{s.k}</span><span className="t">{s.t}</span><span className="d">{s.d}</span>
          </button>
        ))}
      </div>
      <div className="fil-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${sel}`}>
        <span className="ic" style={{ background: e.bg, color: e.c }} aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{e.ic}</svg></span>
        {e.fait ? (
          <>
            <div>
              <span className="over">Étape {e.k} · {e.fait.libelle}</span>
              <b className="val">{e.fait.valeur}</b>
              <p>{e.fait.detail}</p>
            </div>
            {e.fait.href && <Link href={e.fait.href} className="btn btn-ghost btn-sm">{e.fait.hrefLabel ?? 'Voir'} →</Link>}
          </>
        ) : (
          <div>
            <span className="over">Étape {e.k} · {e.t}</span>
            <b className="val">Donnée indisponible pour le moment</b>
            <p>Cette étape s&apos;illustre avec un chiffre réel de la dernière séance ; il n&apos;est pas encore en base.</p>
          </div>
        )}
      </div>
    </div>
  );
}
