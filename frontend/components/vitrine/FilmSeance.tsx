'use client';

import { Sequence } from './mouvement/Sequence';
import { TraceCourbe } from './mouvement/TraceCourbe';
import { BarreQuiPousse } from './mouvement/BarreQuiPousse';
import { Compteur } from './mouvement/Compteur';
import { CANAUX } from '@/lib/canaux';

export interface DonneesFilm {
  dateLongue: string;
  indice: number | null;
  variation: string | null;
  variationSens: 'up' | 'down' | 'plat' | null;
  trace: string;
  variations: { code: string; variation: number; pct: string }[];
  hausses: number; stables: number; baisses: number;
  capitaux: string | null;
  transactions: number | null;
}

const SCENES = [{ duree: 3 }, { duree: 5 }, { duree: 4.4 }, { duree: 4 }, { duree: 3.6 }];

/**
 * Film de séance (spec §3.6) : 20 s en cinq scènes, en unités relatives au cadre
 * (`cqw`), sans le lecteur Remotion. Lecture seulement à l'écran, pause accessible.
 * Mouvement réduit : la scène de l'indice, navigation manuelle.
 */
export function FilmSeance({ f }: { f: DonneesFilm }) {
  const max = Math.max(...f.variations.map((v) => Math.abs(v.variation)), 0.01);
  const total = f.hausses + f.stables + f.baisses || 1;
  return (
    <Sequence scenes={SCENES} sceneCalme={2} className="v-film" label={`Film de la séance du ${f.dateLongue}`}>
      {[
        <div key="date" className="v-film-scene">
          <span className="v-film-sur">Westbourse · la séance</span>
          <span className="v-film-date">{f.dateLongue}</span>
        </div>,
        <div key="indice" className="v-film-scene v-film-scene--haut">
          <span className="v-film-sur">BRVM Composite</span>
          {f.indice != null ? <Compteur valeur={f.indice} decimales={2} className="v-film-geant v-mono" /> : <span className="v-film-geant">non disponible</span>}
          {f.variation && <span className={`v-film-var v-mono v-${f.variationSens ?? 'plat'}`}>{f.variation}</span>}
          <svg viewBox="0 0 560 184" preserveAspectRatio="none" className="v-film-courbe" aria-hidden>
            <TraceCourbe d={f.trace} className="v-indice-trait" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          </svg>
        </div>,
        <div key="var" className="v-film-scene v-film-scene--barres">
          <span className="v-film-titre">Les plus fortes <span className="vitrine-accent">variations</span></span>
          {f.variations.map((v) => (
            <span key={v.code} className="v-film-barre v-mono">
              <span>{v.code}</span>
              <span className="v-film-piste">
                <BarreQuiPousse axe="x" className={`v-film-plein v-${v.variation > 0 ? 'up' : 'down'}-fond`} style={{ width: `${(Math.abs(v.variation) / max) * 100}%` }} />
              </span>
              <span className={`v-${v.variation > 0 ? 'up' : 'down'}`}>{v.pct}</span>
            </span>
          ))}
        </div>,
        <div key="largeur" className="v-film-scene v-film-scene--barres">
          <span className="v-film-trio v-mono">
            <span><b className="v-up">{f.hausses}</b>hausses</span>
            <span><b>{f.stables}</b>stables</span>
            <span><b className="v-down">{f.baisses}</b>baisses</span>
          </span>
          <span className="v-film-jauge" aria-hidden>
            <BarreQuiPousse axe="x" className="v-up-fond" style={{ flex: f.hausses / total }} />
            <BarreQuiPousse axe="x" className="v-neutre-fond" style={{ flex: f.stables / total }} />
            <BarreQuiPousse axe="x" className="v-down-fond" style={{ flex: f.baisses / total }} />
          </span>
          {(f.capitaux || f.transactions != null) && (
            <span className="v-film-pied">
              {f.capitaux && <b className="v-mono">{f.capitaux}</b>}{f.capitaux ? ' échangés' : ''}
              {f.transactions != null ? ` · ${f.transactions.toLocaleString('fr-FR')} transactions` : ''}
            </span>
          )}
        </div>,
        <div key="appel" className="v-film-scene">
          <span className="v-film-date">Recevez-la <span className="vitrine-accent">chaque soir.</span></span>
          <span className="v-film-canaux">
            <a href={CANAUX.whatsappChaine} target="_blank" rel="noopener">WhatsApp</a>
            <a href={CANAUX.telegram} target="_blank" rel="noopener">Telegram</a>
            <a href="#v-canaux">E-mail</a>
          </span>
        </div>,
      ]}
    </Sequence>
  );
}
