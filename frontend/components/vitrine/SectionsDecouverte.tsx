/**
 * Sections 3.7 à 3.11 de la page d'accueil (PR 2) : rail « Découvrir »,
 * explorateur des outils, méthode, tuiles de séance, encart publicitaire.
 * Composant SERVEUR : textes et chiffres sont dans le HTML initial ; seuls la
 * lettre qui roule, l'explorateur, la méthode, les barres, les compteurs et le
 * tirage de l'annonce sont des composants client.
 */
import Link from 'next/link';
import { Apparition } from './mouvement/Apparition';
import { BarreQuiPousse } from './mouvement/BarreQuiPousse';
import { Compteur } from './mouvement/Compteur';
import { RoueNote } from './RoueNote';
import { ExplorateurOutils, type OutilAffiche } from './ExplorateurOutils';
import { MethodeEtapes, type EtapeMethode } from './MethodeEtapes';
import { EncartPublicite } from './EncartPublicite';
import { LienInscription } from './LienInscription';
import { fmtDateFR, fmtNumber } from '@/lib/format';
import { pctTexte } from '@/lib/vitrine/seance';
import { LIBELLE_ACCES, barresSecteurs, titreSecteurs, comptesAcces } from '@/lib/vitrine/outilsPur';
import type { DemosOutils, DonneesDecouvrir } from '@/lib/vitrine/outils';
import type { SectorVariation } from '@/lib/landing/sectors';
import type { EtatMarche } from '@/lib/landing/bisData';
import type { Slide } from '@/lib/landing/slides';

const PAS_CONSEIL = 'Pas un conseil en investissement.';
const PERF_PASSEES = 'Les performances passées ne préjugent pas des performances futures.';
const sens = (v: number) => (v > 0 ? 'v-up' : v < 0 ? 'v-down' : 'v-plat');

// ── 3.7 Rail « Découvrir Westbourse » ───────────────────────────────────

export function RailDecouvrir({ d }: { d: DonneesDecouvrir }) {
  const { note, dossier, evenement, dividendes, sgi } = d;
  const maxDiv = dividendes ? Math.max(...dividendes.barres.map((b) => b.montant)) : 0;
  const baseDiv = dividendes?.base === 'net' ? 'net' : dividendes?.base === 'brut' ? 'brut' : null;
  return (
    <section className="bande-claire v-bloc" aria-labelledby="h-decouvrir">
      <div className="v-colonne">
        <Apparition className="v-rail-tete">
          <h2 id="h-decouvrir" className="v-section">Découvrir <span className="vitrine-accent">Westbourse.</span></h2>
          <a href="#outils" className="v-lien">Toutes les fonctions ›</a>
        </Apparition>
      </div>
      <ul className="v-rail" aria-label="Fonctions de Westbourse">
        <li>
          <Link href={note ? `/societes/${note.code}` : '/societes'} className="v-carte bande-sombre">
            <span className="v-carte-sur">Notes A–F</span>
            <span className="v-carte-titre">Une lettre par action.</span>
            {note ? (
              <>
                <RoueNote lettre={note.lettre} />
                <p className="v-carte-pied">{note.code}{note.nom ? ` · ${note.nom}` : ''}, meilleure note du jour. Note indicative, {PAS_CONSEIL.toLowerCase()}</p>
              </>
            ) : <p className="v-carte-pied" style={{ marginTop: 'auto' }}>Note du jour non disponible.</p>}
          </Link>
        </li>
        <li>
          <Link href="/rapports/dossiers" className="v-carte">
            <span className="v-carte-sur">Dossier valeur</span>
            <span className="v-carte-titre">Un dossier A4 par société.</span>
            <span className="v-eventail" aria-hidden={dossier ? undefined : true}>
              <span className="v-feuille v-feuille--g" aria-hidden="true"><span style={{ height: '55%' }} /><span style={{ height: '72%' }} /><span style={{ height: '48%' }} /><span style={{ height: '86%' }} /></span>
              <span className="v-feuille v-feuille--d">
                <span className="v-feuille-mini">Séance du jour</span>
                {dossier?.variation != null
                  ? <span className={`v-feuille-cours ${sens(dossier.variation)}`} style={{ marginTop: 0 }}>{pctTexte(dossier.variation)}</span>
                  : <span className="v-feuille-mini">Variation non disponible</span>}
              </span>
              <span className="v-feuille v-feuille--c">
                <span className="v-feuille-mini">WESTBOURSE · DOSSIER VALEUR</span>
                {dossier ? (
                  <>
                    <span className="v-feuille-nom">{dossier.nom ?? dossier.code}</span>
                    <span className="v-feuille-mini">{[dossier.code, dossier.secteur, dossier.pays].filter(Boolean).join(' · ')}</span>
                    <span className="v-feuille-cours">{dossier.cours != null ? <>{fmtNumber(dossier.cours, 0)} <small>FCFA</small></> : 'Cours non disponible'}</span>
                  </>
                ) : <span className="v-feuille-nom">Dossier valeur</span>}
              </span>
            </span>
            {dossier && <p className="v-carte-pied">Exemple : la valeur la plus échangée de la séance.</p>}
          </Link>
        </li>
        <li>
          <Link href="/dashboard/reports/events" className="v-carte v-carte--nuit" style={{ color: 'rgb(var(--color-sur-nuit))' }}>
            <span className="v-carte-sur" style={{ color: 'rgb(var(--color-sur-nuit) / .72)' }}>Événements</span>
            <span className="v-carte-titre">La réaction du cours, mesurée.</span>
            {evenement ? (
              <>
                <span className="v-horizons">
                  {evenement.horizons.map((h) => (
                    <span key={h.horizon}>{h.horizon}<b>{pctTexte(h.variation)}</b></span>
                  ))}
                </span>
                <p className="v-carte-pied" style={{ color: 'rgb(var(--color-sur-nuit) / .72)' }}>{evenement.code}, après sa publication de résultats du {fmtDateFR(evenement.date)}. Variation du cours depuis la séance de publication. {PERF_PASSEES}</p>
              </>
            ) : (
              <p className="v-carte-pied" style={{ marginTop: 'auto', color: 'rgb(var(--color-sur-nuit) / .72)' }}>Chaque publication de résultats est suivie de la réaction du cours, séance par séance.</p>
            )}
          </Link>
        </li>
        <li>
          <Link href="/dividendes" className="v-carte">
            <span className="v-carte-sur">Dividendes</span>
            <span className="v-carte-titre">{dividendes?.titre ?? 'Les distributions, exercice par exercice.'}</span>
            {dividendes ? (
              <>
                <span className="v-barres-v" aria-hidden="true">
                  {dividendes.barres.map((b, i) => (
                    <div key={b.exercice}>
                      <BarreQuiPousse axe="y" delai={i * 0.08} className={`v-barre-v${i === dividendes.barres.length - 1 ? ' v-barre-v--dernier' : ''}`} style={{ height: `${maxDiv > 0 ? (b.montant / maxDiv) * 100 : 0}%` }} />
                    </div>
                  ))}
                </span>
                <span className="v-barres-leg">
                  {dividendes.barres.map((b) => <span key={b.exercice}>{b.exercice}<b>{fmtNumber(b.montant, Number.isInteger(b.montant) ? 0 : 2)}</b></span>)}
                </span>
                <p className="v-carte-pied">{dividendes.nom ?? dividendes.code}, dividende {baseDiv ? `${baseDiv} ` : ''}par action, en FCFA, tel que publié. {PERF_PASSEES}</p>
              </>
            ) : <p className="v-carte-pied" style={{ marginTop: 'auto' }}>Historique des distributions non disponible pour cette séance.</p>}
          </Link>
        </li>
        <li>
          <Link href="/comparateur-sgi" className="v-carte bande-sombre">
            <span className="v-carte-sur">Comparateur SGI</span>
            <span className="v-carte-titre">Cinq questions, la bonne SGI.</span>
            {sgi.nb > 0 ? (
              <>
                <span className="v-chiffre-carte">{sgi.nb}</span>
                <p className="v-carte-pied">SGI (sociétés de gestion et d&apos;intermédiation) agréées{sgi.nbGrilles > 0 ? `, ${sgi.nbGrilles} grilles tarifaires comparées` : ''}.</p>
                {sgi.pays.length > 0 && <span className="v-pastilles">{sgi.pays.map((p) => <span key={p}>{p}</span>)}</span>}
              </>
            ) : <p className="v-carte-pied" style={{ marginTop: 'auto' }}>Annuaire des SGI non disponible pour le moment.</p>}
          </Link>
        </li>
      </ul>
    </section>
  );
}

// ── 3.8 Explorateur ─────────────────────────────────────────────────────

export function SectionOutils({ outils, demos }: { outils: OutilAffiche[]; demos: DemosOutils }) {
  const c = comptesAcces(outils);
  const ouverts = c.libre + c.compte;
  return (
    <section id="outils" className="bande-sombre v-bloc" aria-labelledby="h-outils">
      <div className="v-colonne">
        <Apparition className="v-tete-section">
          <p className="v-surtitre">Tout Westbourse</p>
          <h2 id="h-outils" className="v-section">{outils.length === 14 ? 'Quatorze' : fmtNumber(outils.length, 0)} outils. <span className="vitrine-accent">Un seul compte.</span></h2>
          <p className="v-accroche">Touchez un outil pour le voir tourner sur les chiffres de la séance.</p>
        </Apparition>
        <ExplorateurOutils outils={outils} demos={demos} />
        <Apparition className="v-outils-pied">
          <span className="v-etiquette">
            {ouverts} outil{ouverts > 1 ? 's' : ''} en {LIBELLE_ACCES.libre.toLowerCase()} ou avec un compte gratuit, {c.premium} réservé{c.premium > 1 ? 's' : ''} à Premium.
          </span>
          <LienInscription emplacement="outils" />
        </Apparition>
      </div>
    </section>
  );
}

// ── 3.9 Méthode ─────────────────────────────────────────────────────────

export function SectionMethode({ etapes }: { etapes: EtapeMethode[] }) {
  return (
    <section id="methode" className="bande-sombre v-bloc" aria-labelledby="h-methode">
      <div className="v-colonne">
        <Apparition className="v-tete-section">
          <p className="v-surtitre">La méthode</p>
          <h2 id="h-methode" className="v-section">De la donnée à la décision. <span className="vitrine-accent">Rien d&apos;affirmé sans mesure.</span></h2>
        </Apparition>
        <MethodeEtapes etapes={etapes} />
        <p className="v-note" style={{ marginTop: 24 }}>Chaque fait vient de la dernière séance. {PAS_CONSEIL}</p>
      </div>
    </section>
  );
}

// ── 3.10 Tuiles de séance ───────────────────────────────────────────────

function montant(v: number): { valeur: number; decimales: number; suffixe: string } {
  if (Math.abs(v) >= 1e9) return { valeur: v / 1e9, decimales: 2, suffixe: ' Md' };
  if (Math.abs(v) >= 1e6) return { valeur: v / 1e6, decimales: 1, suffixe: ' M' };
  return { valeur: v, decimales: 0, suffixe: '' };
}

export function TuilesSeance({ secteurs, etat, membres, releve }: { secteurs: SectorVariation[]; etat: EtatMarche; membres: number | null; releve: string | null }) {
  const barres = barresSecteurs(secteurs);
  const titre = titreSecteurs(barres);
  const cap = etat.valeurEchangee != null ? montant(etat.valeurEchangee) : null;
  return (
    <section className="bande-sombre v-bloc" aria-label="La séance en trois tuiles">
      <div className="v-colonne v-tuiles">
        <Apparition className="v-tuile">
          <span className="v-carte-sur">Secteurs</span>
          {titre ? (
            <>
              <span className="v-carte-titre">{titre}</span>
              <div className="v-secteurs">
                {barres.map((b) => (
                  <div key={b.secteur} className="v-secteur">
                    <span title={b.secteur}>{b.secteur}</span>
                    <span className="v-demi v-demi--g" aria-hidden="true">{b.variation < 0 && <BarreQuiPousse axe="x" origine="fin" className="v-down-fond" style={{ width: `${b.part * 100}%` }} />}</span>
                    <span className="v-demi" aria-hidden="true">{b.variation > 0 && <BarreQuiPousse axe="x" className="v-up-fond" style={{ width: `${b.part * 100}%` }} />}</span>
                    <span className={sens(b.variation)}>{pctTexte(b.variation)}</span>
                  </div>
                ))}
              </div>
              <p className="v-note" style={{ marginTop: 'auto' }}>Variation pondérée par la capitalisation.{releve ? ` Source BRVM · ${releve}` : ''}</p>
            </>
          ) : <p className="v-carte-pied">Variations sectorielles non disponibles.</p>}
        </Apparition>

        <Apparition className="v-tuile" delai={0.08}>
          <span className="v-carte-sur">Échanges</span>
          {cap ? (
            <>
              <span className="v-chiffre-carte" style={{ marginTop: 8, fontSize: 'clamp(48px, 6vw, 80px)' }}><Compteur valeur={cap.valeur} decimales={cap.decimales} suffixe={cap.suffixe} /></span>
              <p className="v-carte-pied">
                FCFA échangés{etat.valeurVsVeille != null ? <>, <span className={sens(etat.valeurVsVeille)}>{pctTexte(etat.valeurVsVeille, 1)}</span> par rapport à la veille</> : ''}.
              </p>
            </>
          ) : <p className="v-carte-pied">Capitaux échangés non disponibles.</p>}
          <div className="v-echanges">
            <div><b>{etat.titresEchanges != null ? <Compteur valeur={etat.titresEchanges} decimales={0} /> : '—'}</b><span>titres{etat.titresEchanges == null ? ', non disponible' : ''}</span></div>
            <div><b>{etat.transactions != null ? <Compteur valeur={etat.transactions} decimales={0} /> : '—'}</b><span>transactions{etat.transactions == null ? ', non disponible' : ''}</span></div>
          </div>
          {releve && <p className="v-note">Source BRVM · {releve}</p>}
        </Apparition>

        <Apparition className="v-tuile v-tuile--nuit" delai={0.16}>
          <span className="v-carte-sur" style={{ color: 'rgb(var(--color-sur-nuit) / .72)' }}>La communauté</span>
          {membres != null && membres > 0 ? (
            <>
              <span className="v-chiffre-carte" style={{ marginTop: 8 }}><Compteur valeur={membres} decimales={0} /></span>
              <span className="v-carte-titre" style={{ fontSize: 20 }}>membres suivent déjà la BRVM <span className="vitrine-accent" style={{ color: 'rgb(var(--color-sur-nuit) / .72)' }}>ici.</span></span>
            </>
          ) : <span className="v-carte-titre" style={{ fontSize: 20 }}>Suivez la BRVM <span className="vitrine-accent" style={{ color: 'rgb(var(--color-sur-nuit) / .72)' }}>avec nous.</span></span>}
          <LienInscription emplacement="communaute" libelle="Les rejoindre gratuitement" style={{ marginTop: 'auto' }} />
        </Apparition>
      </div>
    </section>
  );
}

// ── 3.11 Encart publicitaire ────────────────────────────────────────────

export function SectionPublicite({ campagnes }: { campagnes: Slide[] }) {
  if (campagnes.length === 0) return null;
  return (
    <section className="bande-sombre" aria-label="Publicité" style={{ paddingBottom: 'clamp(72px, 8vw, 120px)' }}>
      <div className="v-colonne">
        <EncartPublicite campagnes={campagnes} />
      </div>
    </section>
  );
}
