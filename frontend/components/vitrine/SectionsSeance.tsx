/**
 * Sections 3.2 à 3.6 de la page d'accueil (PR 1) : ouverture, scène de l'indice,
 * bandeau de mots, mosaïque des valeurs, film de séance. Composant SERVEUR : le
 * titre, l'accroche et le chiffre de l'indice sont dans le HTML initial ; seuls les
 * blocs animés ou interactifs sont des composants client.
 */
import Link from 'next/link';
import { TitreMots } from './mouvement/TitreMots';
import { Apparition } from './mouvement/Apparition';
import { Bandeau } from './mouvement/Bandeau';
import { BarreQuiPousse } from './mouvement/BarreQuiPousse';
import { InscriptionAccueil } from './InscriptionAccueil';
import { SceneIndice } from './SceneIndice';
import { Mosaique } from './Mosaique';
import { FilmSeance, type DonneesFilm } from './FilmSeance';
import { CANAUX } from '@/lib/canaux';
import { fmtNumber } from '@/lib/format';
import type { SceneIndice as Indice, CaseValeur } from '@/lib/vitrine/seance';

export interface DonneesOuverture {
  dateLongue: string | null;
  enSeance: boolean;
  membres: number | null;
  nbValeurs: number;
}

const IcoWhatsapp = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="v-up"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.2A8.5 8.5 0 1 1 21 11.5z" /></svg>
);
const IcoTelegram = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="v-accent"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z" /></svg>
);

export function Ouverture({ o }: { o: DonneesOuverture }) {
  return (
    <section className="bande-sombre v-ouverture-bloc">
      <div className="v-colonne v-centre">
        {o.dateLongue && (
          <p className="v-etat">
            <span className={`v-pastille ${o.enSeance ? 'v-pastille--ouverte' : ''}`} aria-hidden />
            Séance du {o.dateLongue} · {o.enSeance ? 'marché ouvert' : 'marché fermé'}
          </p>
        )}
        <TitreMots as="h1" texte="Toute la BRVM. Au chiffre près." accent="Au chiffre près." className="v-ouverture" />
        <p className="v-accroche">
          {o.nbValeurs} valeurs, notées de A à F, avec la source de chaque chiffre.
        </p>
        <InscriptionAccueil />
        <p className="v-note">
          Sans carte bancaire{o.membres != null ? ` · ${fmtNumber(o.membres, 0)} membres inscrits` : ''} · désabonnement en un clic ·{' '}
          <Link href="/login" className="v-lien-discret">continuer avec Google</Link>
        </p>
        <div className="v-canaux-ligne">
          <span>Ou suivez la séance sans compte</span>
          <a className="v-bouton-second" href={CANAUX.whatsappChaine} target="_blank" rel="noopener"><IcoWhatsapp />WhatsApp</a>
          <a className="v-bouton-second" href={CANAUX.telegram} target="_blank" rel="noopener"><IcoTelegram />Telegram</a>
        </div>
      </div>
    </section>
  );
}

export function Indice({ d, releve, hausses, stables, baisses }: { d: Indice | null; releve: string | null; hausses: number; stables: number; baisses: number }) {
  const total = hausses + stables + baisses;
  return (
    <section className="bande-sombre v-bloc">
      <div className="v-colonne">
        {d ? <SceneIndice d={d} releve={releve} /> : <p className="v-note">BRVM Composite : série non disponible.</p>}
        {total > 0 && (
          <>
            <div className="v-largeur" aria-hidden>
              <BarreQuiPousse axe="x" className="v-up-fond" style={{ flex: hausses }} />
              <BarreQuiPousse axe="x" className="v-neutre-fond" style={{ flex: stables }} />
              <BarreQuiPousse axe="x" className="v-down-fond" style={{ flex: baisses }} />
            </div>
            <p className="v-largeur-legende">
              <span className="v-up">{hausses} hausse{hausses > 1 ? 's' : ''}</span>
              <span>{stables} stable{stables > 1 ? 's' : ''}</span>
              <span className="v-down">{baisses} baisse{baisses > 1 ? 's' : ''}</span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/** Bandeau de mots (§3.4) : décoratif, `aria-hidden`, tout y est dit ailleurs. */
export function BandeauSeance({ lignes }: { lignes: [string[], string[]] }) {
  const piste = (mots: string[], k: number) =>
    mots.map((m, i) => (
      <span key={`${k}-${i}`} className={`v-mot v-mot--${(i + k) % 4}`}>
        {m}<span className="v-mot-point">●</span>
      </span>
    ));
  return (
    <div className="bande-sombre v-bandeau-mots">
      <Bandeau duree={38}>{piste(lignes[0], 0)}</Bandeau>
      <Bandeau duree={46} sens="inverse">{piste(lignes[1], 1)}</Bandeau>
    </div>
  );
}

export function SectionMosaique({ cases, releve }: { cases: CaseValeur[]; releve: string | null }) {
  return (
    <section className="bande-sombre v-bloc">
      <div className="v-colonne">
        <Apparition className="v-tete-section">
          <h2 className="v-section">{cases.length} valeurs. <span className="vitrine-accent">Une séance.</span></h2>
        </Apparition>
        <Mosaique cases={cases} />
        <p className="v-note">
          Chaque case est une action cotée, de la plus forte hausse à la plus forte baisse.{releve ? ` Source BRVM · ${releve}` : ''}
        </p>
        <Apparition className="v-incitation">
          <span className="v-carte-titre">Suivez ces {cases.length} valeurs <span className="vitrine-accent">depuis votre liste.</span></span>
          <Link href="/signup?from=mosaique" className="v-bouton">Créer mon compte gratuit</Link>
        </Apparition>
      </div>
    </section>
  );
}

export function SectionFilm({ f, dateCourte }: { f: DonneesFilm; dateCourte: string | null }) {
  return (
    <section className="bande-sombre v-bloc">
      <div className="v-colonne">
        <Apparition className="v-tete-section">
          <p className="v-surtitre">Chaque soir de séance</p>
          <h2 className="v-section">La séance, <span className="vitrine-accent">en film.</span></h2>
          <p className="v-accroche">Vingt secondes pour tout voir.</p>
        </Apparition>
        <FilmSeance f={f} />
        <p className="v-note">Film monté à partir des chiffres de la séance{dateCourte ? ` du ${dateCourte}` : ''}. Source BRVM.</p>
        <Apparition className="v-incitation">
          <span className="v-carte-titre">Le film de la séance, chaque soir, <span className="vitrine-accent">sans compte.</span></span>
          <span className="v-canaux-boutons">
            <a href={CANAUX.whatsappChaine} target="_blank" rel="noopener" className="v-bouton v-bouton--whatsapp">Suivre sur WhatsApp</a>
            <a href={CANAUX.telegram} target="_blank" rel="noopener" className="v-bouton">Suivre sur Telegram</a>
          </span>
        </Apparition>
      </div>
    </section>
  );
}
