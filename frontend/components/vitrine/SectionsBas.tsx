/**
 * Sections 3.12 à 3.14 de la page d'accueil (PR 3) : provenance, canaux,
 * « Commencez par explorer » et offres, bloc final. Composant SERVEUR : tout le
 * texte et tous les chiffres sont dans le HTML initial ; seuls les entrées, le
 * formulaire d'abonnement et les liens mesurés sont des composants client.
 * Le pied de page reste celui du site (components/Footer, via ConditionalShell).
 */
import Link from 'next/link';
import NewsletterForm from '@/components/NewsletterForm';
import { Apparition } from './mouvement/Apparition';
import { Compteur } from './mouvement/Compteur';
import { Vague, VagueElement } from './mouvement/Vague';
import { LienInscription } from './LienInscription';
import { LienCanal, SuiviAbonnement } from './LienCanal';
import { CANAUX, lienWhatsappNumero } from '@/lib/canaux';
import { fmtDateFR, fmtNumber } from '@/lib/format';
import { NB_SOCIETES_COTEES } from '@/lib/universe';
import type { EchangeWhatsapp } from '@/lib/vitrine/basPur';

// ── 3.12 Provenance ─────────────────────────────────────────────────────

export interface DonneesProvenance {
  nbActions: number;
  exemple: { code: string; nom: string | null; cours: number } | null;
  seance: string | null;
  collecte: { heure: string; date: string } | null;
  depuis: string | null;
}

export function SectionProvenance({ p }: { p: DonneesProvenance }) {
  return (
    <section className="bande-claire v-bloc" aria-labelledby="h-provenance">
      <div className="v-colonne">
        <Apparition className="v-tete-section">
          <h2 id="h-provenance" className="v-section" style={{ maxWidth: '16ch' }}>Chaque chiffre a une source, <span className="vitrine-accent">une date, une heure.</span></h2>
        </Apparition>
        <div className="v-provenance">
          <Apparition className="v-preuve">
            <span className="v-carte-sur">La source</span>
            <span className="v-preuve-val">BRVM, publications des émetteurs</span>
            <p className="v-carte-pied">Aucun cours n&apos;est saisi à la main.{p.nbActions > 0 ? ` ${p.nbActions} sociétés suivies.` : ''}</p>
          </Apparition>
          <Apparition className="v-preuve" delai={0.08}>
            <span className="v-carte-sur">Le chiffre</span>
            {p.exemple ? (
              <>
                <span className="v-preuve-val v-mono">{p.exemple.code} {fmtNumber(p.exemple.cours, 0)} FCFA</span>
                <p className="v-carte-pied">{p.exemple.nom ? `${p.exemple.nom}, ` : ''}clôture{p.seance ? ` du ${fmtDateFR(p.seance)}` : ''}. Le même chiffre figure sur la fiche de la société.</p>
              </>
            ) : (
              <>
                <span className="v-preuve-val">Non disponible</span>
                <p className="v-carte-pied">Aucune cotation de séance en base : la page le dit au lieu d&apos;afficher un cours périmé.</p>
              </>
            )}
          </Apparition>
          <Apparition className="v-preuve" delai={0.16}>
            <span className="v-carte-sur">La collecte</span>
            {p.collecte ? (
              <>
                <span className="v-preuve-val v-mono">{p.collecte.heure}</span>
                <p className="v-carte-pied">Dernière collecte réussie le {p.collecte.date}{p.depuis ? `, ${p.depuis}` : ''}. Environ toutes les 15 minutes en séance.</p>
              </>
            ) : (
              <>
                <span className="v-preuve-val">Non disponible</span>
                <p className="v-carte-pied">L&apos;heure de la dernière collecte est inconnue : elle reste vide plutôt que supposée.</p>
              </>
            )}
          </Apparition>
          <Apparition className="v-preuve v-preuve--nuit" delai={0.24}>
            <span className="v-carte-sur">Ce qui manque</span>
            <span className="v-preuve-val">Nous l&apos;écrivons.</span>
            <p className="v-carte-pied">Une donnée absente est déclarée, jamais comblée. Le carnet d&apos;ordres du Bulletin officiel ne donne que la meilleure limite de chaque côté : nous le précisons.</p>
          </Apparition>
        </div>
        <p className="v-note" style={{ marginTop: 20 }}><Link href="/methodologie" className="v-lien">Lire la méthodologie ›</Link></p>
      </div>
    </section>
  );
}

// ── 3.13 Canaux ─────────────────────────────────────────────────────────

export interface ChiffreCommunaute { reseau: string; libelle: string; unite: string; url: string | null; abonnes: number; releve_le: string }

export interface DonneesCanaux {
  /** Derniers relevés datés par réseau (communaute_releves) ; vide = bandeau absent. */
  communaute?: ChiffreCommunaute[];
  whatsapp: EchangeWhatsapp[];
  quotaGratuit: number | null;
  telegram: { lignes: string[]; entete: string; heure: string | null };
  membres: number | null;
}

const IcoWhatsapp = () => <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.2A8.5 8.5 0 1 1 21 11.5z" /></svg>;
const IcoTelegram = () => <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z" /></svg>;
const IcoMail = () => <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>;

export function SectionCanaux({ c }: { c: DonneesCanaux }) {
  const telegramCourt = CANAUX.telegram.replace(/^https?:\/\//, '');
  return (
    <section id="canaux" className="bande-sombre v-bloc" aria-labelledby="h-canaux">
      <div className="v-colonne">
        <Apparition className="v-tete-section">
          <p className="v-surtitre">Restez au courant</p>
          <h2 id="h-canaux" className="v-section" style={{ maxWidth: '14ch' }}>La BRVM vient à vous. <span className="vitrine-accent">Choisissez le canal.</span></h2>
        </Apparition>
        <div className="v-canaux">
          <Apparition className="v-canal">
            <span className="v-canal-nom v-up"><IcoWhatsapp />WhatsApp</span>
            <span className="v-carte-titre">Posez la question, <span className="vitrine-accent">le cours répond.</span></span>
            <p className="v-carte-pied">La Chaîne publie la vidéo de séance chaque soir. Personne ne voit votre numéro.</p>
            {c.whatsapp.length > 0 ? (
              <Vague className="v-fil" as="ul">
                {c.whatsapp.flatMap((e) => [
                  <VagueElement key={`q-${e.question}`} as="li" className="v-bulle v-bulle--moi">{e.question}</VagueElement>,
                  <VagueElement key={`r-${e.question}`} as="li" className="v-bulle v-mono">{e.reponse.join('\n')}</VagueElement>,
                ])}
              </Vague>
            ) : <p className="v-note" style={{ marginTop: 'auto' }}>Exemple non disponible : aucune séance en base.</p>}
            {c.whatsapp.length > 0 && <p className="v-note">Réponses produites par le service à partir des chiffres de la dernière séance. Source BRVM.</p>}
            <LienCanal href={CANAUX.whatsappChaine} canal="whatsapp" emplacement="canaux" className="v-bouton v-bouton--whatsapp">Suivre la Chaîne</LienCanal>
            <p className="v-note v-canal-pied">
              Ou écrivez <LienCanal href={lienWhatsappNumero('AIDE')} canal="whatsapp-numero" emplacement="canaux" className="v-lien-discret">AIDE au {CANAUX.whatsappNumero}</LienCanal>
              {' '}· COURS, DIV et PALMARES sans compte{c.quotaGratuit != null ? ` · ${c.quotaGratuit} question${c.quotaGratuit > 1 ? 's' : ''} par jour à l'assistant avec un compte gratuit lié` : ''}
            </p>
          </Apparition>

          <Apparition className="v-canal" delai={0.08}>
            <span className="v-canal-nom v-accent"><IcoTelegram />Telegram</span>
            <span className="v-carte-titre">Le point de clôture <span className="vitrine-accent">arrive tout seul.</span></span>
            <p className="v-carte-pied">Le résumé de chaque séance, publié sur le canal public.</p>
            {c.telegram.lignes.length > 0 ? (
              <div className="v-fil-bloc">
                <p className="v-fil-tete"><span>{c.telegram.entete}</span>{c.telegram.heure && <span className="v-mono">{c.telegram.heure}</span>}</p>
                <Vague as="ul" className="v-fil">
                  {c.telegram.lignes.map((l) => <VagueElement key={l} as="li" className="v-bulle">{l}</VagueElement>)}
                </Vague>
              </div>
            ) : <p className="v-note" style={{ marginTop: 'auto' }}>Brief non disponible pour le moment.</p>}
            <LienCanal href={CANAUX.telegram} canal="telegram" emplacement="canaux" className="v-bouton">Ouvrir le canal</LienCanal>
            <p className="v-note v-canal-pied">{telegramCourt} · sans compte Westbourse</p>
          </Apparition>

          <Apparition className="v-canal bande-claire" delai={0.16}>
            <span className="v-canal-nom v-accent"><IcoMail />E-mail</span>
            <span className="v-carte-titre">Le brief du soir. <span className="vitrine-accent">Cinq lignes, à 18 h.</span></span>
            <p className="v-carte-pied">La séance résumée chaque jour de cotation.</p>
            {c.membres != null && c.membres > 0 && (
              <span className="v-canal-membres"><span className="v-chiffre-carte"><Compteur valeur={c.membres} decimales={0} /></span><span>membres inscrits</span></span>
            )}
            <div className="v-canal-form">
              <p className="v-etiquette" style={{ margin: 0 }}>Votre adresse e-mail</p>
              <SuiviAbonnement canal="email" emplacement="canaux"><NewsletterForm source="vitrine-canaux" compact /></SuiviAbonnement>
            </div>
            <p className="v-note v-canal-pied">Inscription confirmée par e-mail · désabonnement en un clic</p>
          </Apparition>
        </div>
        {c.communaute && c.communaute.length > 0 && (
          <Apparition className="v-communaute">
            <p className="v-etiquette" style={{ margin: 0 }}>La communauté</p>
            <ul className="v-communaute-liste">
              {c.communaute.map((x) => {
                const contenu = (
                  <>
                    <span className="v-communaute-chiffre v-mono">{fmtNumber(x.abonnes, 0)}</span>
                    <span className="v-communaute-libelle">{x.unite} {x.libelle}</span>
                    <span className="v-note">relevé le {x.releve_le.split('-').reverse().join('/')}</span>
                  </>
                );
                return (
                  <li key={x.reseau}>
                    {x.url ? <a href={x.url} target="_blank" rel="noopener" className="v-communaute-item">{contenu}</a> : <span className="v-communaute-item">{contenu}</span>}
                  </li>
                );
              })}
            </ul>
          </Apparition>
        )}
      </div>
    </section>
  );
}

// ── 3.14 Bas de page ────────────────────────────────────────────────────

export interface DonneesOffres {
  gratuit: { mensuel: string } | null;
  premium: { mensuel: string; annuel: string | null } | null;
}

const COCHES = [
  `Explorer les ${NB_SOCIETES_COTEES} sociétés cotées et leurs fiches`,
  'Consulter les fondamentaux et les dividendes',
  'Suivre la séance et les indices',
  'Créer votre watchlist et votre portefeuille',
  'Recevoir le brief du soir par e-mail',
];

const Coche = () => <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

export function SectionGratuit({ o }: { o: DonneesOffres }) {
  return (
    <section id="premium" className="bande-claire v-bloc v-bloc--serre" aria-labelledby="h-gratuit">
      <div className="v-colonne v-gratuit">
        <div className="v-gratuit-texte">
          <Apparition>
            <h2 id="h-gratuit" className="v-section v-section--moyen">Commencez par explorer. <span className="vitrine-accent v-accent">Gratuitement.</span></h2>
          </Apparition>
          <ul className="v-coches v-coches--grand">
            {COCHES.map((t, i) => (
              <Apparition key={t} as="li" delai={0.12 * i}><Coche />{t}</Apparition>
            ))}
          </ul>
          <LienInscription emplacement="gratuit" className="v-bouton v-bouton--grand" />
          <span className="v-note">Sans carte bancaire · Sans engagement</span>
        </div>
        <div className="v-offres">
          <p className="v-etiquette" style={{ margin: 0 }}>Pour aller plus loin, quand vous serez prêt.</p>
          <Apparition className="v-offre">
            <span className="v-offre-nom">GRATUIT</span>
            <span className="v-offre-prix">{o.gratuit?.mensuel ?? 'Tarif non disponible'}</span>
            <p className="v-carte-pied">Veille de marché, cours et états financiers officiels, watchlist et portefeuille.</p>
          </Apparition>
          <Apparition className="v-offre v-offre--nuit bande-sombre" delai={0.08}>
            <span className="v-offre-nom v-accent">PREMIUM</span>
            {o.premium ? (
              <span className="v-offre-prix">{o.premium.mensuel} <small>par mois</small></span>
            ) : <span className="v-offre-prix">Tarif non disponible</span>}
            <p className="v-carte-pied">
              {o.premium?.annuel ? `Ou ${o.premium.annuel} par an. ` : ''}Signaux quotidiens, notation A–F détaillée, dossiers d&apos;analyse, filtres avancés, alertes Telegram. Pas un conseil en investissement.
            </p>
            <Link href="/pricing" className="v-lien">Voir les offres ›</Link>
          </Apparition>
        </div>
      </div>
    </section>
  );
}

const PILIERS: [string, string][] = [['Données', 'fiables et datées'], ['Analyse', 'indépendante'], ['Outils', 'simples'], ['Décision', 'la vôtre']];

export function SectionFinale() {
  return (
    <section className="bande-claire v-final-bloc" aria-labelledby="h-final">
      <div className="v-colonne">
        <Apparition>
          <div className="v-final bande-sombre" data-bloc-final="">
            <div className="v-final-texte">
              <h2 id="h-final" className="v-section v-section--petit">Votre première analyse peut commencer <span className="vitrine-accent">maintenant.</span></h2>
              <p className="v-carte-pied" style={{ maxWidth: '40ch', fontSize: 16 }}>Explorez gratuitement la BRVM, découvrez les sociétés cotées et entraînez-vous avant d&apos;aller plus loin.</p>
              <span className="v-canaux-boutons">
                <LienInscription emplacement="final" />
                <Link href="/societes" className="v-bouton-second v-bouton-second--grand">Explorer les sociétés</Link>
              </span>
              <span className="v-note">Gratuit · Sans carte bancaire · À votre rythme · Ceci n&apos;est pas un conseil en investissement.</span>
            </div>
            <ul className="v-piliers">
              {PILIERS.map(([a, b]) => <li key={a}><b>{a}</b><span>{b}</span></li>)}
            </ul>
          </div>
        </Apparition>
      </div>
    </section>
  );
}
