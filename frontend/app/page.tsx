import { libelleSignal } from '@/lib/signalLabel';
import { NB_SOCIETES_COTEES } from '@/lib/universe';
import { getMemberCount } from '@/lib/landing/memberCount';
import { LandingNav } from '@/components/landing/bis/LandingNav';
import { getLandingBisData } from '@/lib/landing/bisData';
import { computeFreshness } from '@/lib/freshness';
import { fmtDateFR, fmtFcfa, fmtNumber } from '@/lib/format';
import { SectionProvenance, SectionCanaux, SectionGratuit, SectionFinale } from '@/components/vitrine/SectionsBas';
import { BandeauFlottant } from '@/components/vitrine/BandeauFlottant';
import { chargerBrief, quotaWhatsappGratuit } from '@/lib/vitrine/canaux';
import { chargerCommunaute } from '@/lib/vitrine/communaute';
import { depuis as depuisTexte, exemplesWhatsapp, horodatageUtc, lignesBrief, lignesSeance, prixOffre } from '@/lib/vitrine/basPur';
import '@/components/vitrine/vitrine.css';
import '@/components/vitrine/mouvement/mouvement.css';
import { classesPolices } from '@/lib/vitrine/polices';
import { Ouverture, Indice, BandeauSeance, SectionMosaique, SectionFilm } from '@/components/vitrine/SectionsSeance';
import type { DonneesFilm } from '@/components/vitrine/FilmSeance';
import { casesMosaique, dateLongue, releve, sceneIndice, motsBandeau, plusFortesVariations, traceSerie, pctTexte, type ChiffresSeance } from '@/lib/vitrine/seance';
import { estEnSeance } from '@/lib/freshness';
import { RailDecouvrir, SectionOutils, SectionMethode, TuilesSeance, SectionPublicite } from '@/components/vitrine/SectionsDecouverte';
import type { EtapeMethode } from '@/components/vitrine/MethodeEtapes';
import { chargerDemosOutils, chargerDecouvrir } from '@/lib/vitrine/outils';
import { OUTILS, accesOutil, rubriqueOutil, campagnesPub } from '@/lib/vitrine/outilsPur';
import { CanauxFlottants } from '@/components/vitrine/CanauxFlottants';

/** Fait réel d'une étape de la méthode (null = la donnée manque, l'étape s'affiche sans). */
interface Fait { libelle: string; valeur: string; detail: string; href?: string; hrefLabel?: string }

/**
 * Page d'accueil « vitrine » (spec docs/superpowers/specs/2026-11-12-vitrine-accueil.md,
 * charte docs/CHARTE.md). Ordre de la maquette : ouverture, indice, bandeau, mosaïque,
 * film, découvrir, outils, méthode, tuiles, publicité, provenance, canaux, offres,
 * bloc final, puis le pied de page du site. Tout chiffre vient de Supabase.
 */
export const revalidate = 300;

export const metadata = {
  title: 'WESTBOURSE — Décidez sur la BRVM avec des données, pas des rumeurs',
  description:
    'Cours BRVM environ toutes les 15 minutes en séance, note A–F par action, fondamentaux vérifiés, simulateur et brief quotidien. Gratuit, créez votre compte en 1 minute.',
};


const STEPS = [
  { t: 'Données', d: 'Cours, volumes et publications collectés à la source.' },
  { t: 'Analyse', d: 'Fondamentaux, RSI, MACD, dividendes.' },
  { t: 'Note A–F', d: 'Un score quantitatif explicable par action.' },
  { t: 'Signal', d: 'Haussier, neutre ou baissier, avec la complétude des données qui le fondent.' },
  { t: 'Dossier d’analyse', d: 'Forces, risques et valorisation mis en mots.' },
  { t: 'Simulation', d: 'Ce que la décision aurait donné, dividendes inclus.' },
  { t: 'Décision', d: 'À vous de trancher, avec les chiffres sous les yeux.' },
];

export default async function Landing() {
  const [d, membres, brief, quotaWa, communaute] = await Promise.all([getLandingBisData(), getMemberCount().catch(() => null), chargerBrief(), quotaWhatsappGratuit(), chargerCommunaute()]);
  const [demos, decouvrir] = await Promise.all([chargerDemosOutils(d), chargerDecouvrir(d)]);
  const fraicheur = computeFreshness(d.derniereCollecte, d.dateMarche, new Date());
  const dateLabel = d.dateMarche ? fmtDateFR(d.dateMarche) : null;
  const prixGratuit = prixOffre(d.plans.find((p) => p.code === 'free'));
  const prixPremium = prixOffre(d.plans.find((p) => p.code === 'premium'));
  const topH = d.topHausses[0] ?? null;

  // Un fait RÉEL par étape du fil conducteur (null = le panneau le dira, jamais un exemple).
  const age = fraicheur.ageMinutes;
  const depuis = age == null ? null : age < 60 ? `il y a ${age} min` : age < 48 * 60 ? `il y a ${Math.round(age / 60)} h` : `il y a ${Math.round(age / 1440)} j`;
  const sig = d.spotlightSignal;
  const serie = d.brvmCSerie;
  const perf = serie.length >= 2 && serie[0].v > 0 ? ((serie[serie.length - 1].v / serie[0].v) - 1) * 100 : null;
  const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
  const conf = sig?.confiance == null ? null : Math.round(Number(sig.confiance) * (Number(sig.confiance) <= 1 ? 100 : 1));
  const FAITS: (Fait | null)[] = [
    d.nbActions > 0 ? { libelle: 'Collecte de la dernière séance', valeur: `${d.nbActions} sociétés · ${d.hausses} hausses · ${d.baisses} baisses`, detail: `Cours relevés sur brvm.org${dateLabel ? ` pour la séance du ${dateLabel}` : ''}${depuis ? `, dernière collecte ${depuis}` : ''}. Environ toutes les 15 minutes en séance.`, href: '/societes', hrefLabel: 'Voir les sociétés' } : null,
    d.plusEchangee ? { libelle: 'Valeur la plus échangée', valeur: `${d.plusEchangee.code} · ${fmtFcfa(d.plusEchangee.valeur)}`, detail: 'Volumes, RSI, MACD et fondamentaux sont recalculés à chaque séance sur la fiche de chaque société.', href: `/societes/${d.plusEchangee.code}`, hrefLabel: 'Ouvrir la fiche' } : null,
    d.topNote?.grade ? { libelle: 'Meilleure note du jour', valeur: `${d.topNote.grade} · ${d.topNote.code}${d.topNote.nom ? ` · ${d.topNote.nom}` : ''}`, detail: 'Une note de A à F recalculée chaque séance à partir de signaux vérifiables (tendance, volume, RSI, liquidité) avec le poids de chacun.', href: `/societes/${d.topNote.code}`, hrefLabel: 'Voir la note' } : null,
    sig ? { libelle: `Signal du ${fmtDateFR(sig.date_marche)} · ${sig.code}`, valeur: `${libelleSignal(sig.signal)}${conf != null ? ` · complétude des données ${conf} %` : ''}`, detail: sig.signal === 'HOLD' ? 'Neutre signifie que rien n’est net : le moteur s’abstient plutôt que de forcer un signal. Ce n’est pas un conseil en investissement.' : 'Un signal n’est émis que lorsque plusieurs sous-scores concordent. Ce n’est pas un conseil en investissement.', href: '/signaux', hrefLabel: 'Tous les signaux' } : null,
    d.latestDiagnostic ? { libelle: 'Dernier diagnostic généré', valeur: `${d.latestDiagnostic.code}${d.latestDiagnostic.generated_at ? ` · ${fmtDateFR(d.latestDiagnostic.generated_at.slice(0, 10))}` : ''}`, detail: 'Forces, risques et valorisation rédigés à partir des chiffres de la plateforme, une analyse structurée, pas un conseil en investissement.', href: `/premium/diagnostic/${d.latestDiagnostic.code}`, hrefLabel: 'Lire le diagnostic' } : null,
    perf != null ? { libelle: `BRVM Composite sur ${serie.length} séances`, valeur: pct(perf), detail: 'Le simulateur rejoue une décision sur l’historique réel, dividendes inclus, pour mesurer ce qu’elle aurait donné, avant de la prendre.', href: '/simulateur', hrefLabel: 'Simuler' } : null,
    { libelle: 'La décision vous appartient', valeur: membres != null && membres > 0 ? `${fmtNumber(membres)} membres inscrits` : 'Un compte gratuit, sans carte bancaire', detail: 'Explorez les sociétés, suivez la séance et testez vos idées avec un capital fictif. Les outils avancés viennent ensuite, quand vous en aurez besoin.', href: '/signup', hrefLabel: 'Créer mon compte gratuit' },
  ];

  const etapesMethode: EtapeMethode[] = STEPS.map((s, k) => {
    const f = FAITS[k];
    return { titre: s.t, description: s.d, fait: f ? { libelle: f.libelle, valeur: f.valeur } : null };
  });
  const outils = OUTILS.map((o) => ({ ...o, acces: accesOutil(o.route), rubrique: rubriqueOutil(o.route) }));

  const cases = casesMosaique(d.coursSeed);
  const releveTxt = releve(d.derniereCollecte);
  const extremes = plusFortesVariations(cases);
  const chiffres: ChiffresSeance = {
    indice: d.brvmC?.valeur ?? null, variation: d.brvmC?.variation ?? null,
    hausses: d.hausses, stables: d.inchangees, baisses: d.baisses,
    capitaux: d.etat.valeurEchangee, titres: d.etat.titresEchanges, transactions: d.etat.transactions,
    meilleure: cases[0] && cases[0].variation > 0 ? { code: cases[0].code, variation: cases[0].variation } : null,
    pire: cases.length && cases[cases.length - 1]!.variation < 0 ? { code: cases[cases.length - 1]!.code, variation: cases[cases.length - 1]!.variation } : null,
    nbValeurs: cases.length,
  };
  const sixante = d.brvmCSerie.slice(-60).map((p) => p.v);
  const film: DonneesFilm = {
    dateLongue: d.dateMarche ? dateLongue(d.dateMarche) : 'dernière séance',
    indice: d.brvmC?.valeur ?? null,
    variation: d.brvmC?.variation != null ? `${d.brvmC.variation > 0 ? '▲' : d.brvmC.variation < 0 ? '▼' : ''} ${pctTexte(d.brvmC.variation)}`.trim() : null,
    variationSens: d.brvmC?.variation == null ? null : d.brvmC.variation > 0 ? 'up' : d.brvmC.variation < 0 ? 'down' : 'plat',
    trace: traceSerie(sixante),
    variations: extremes,
    hausses: d.hausses, stables: d.inchangees, baisses: d.baisses,
    capitaux: d.etat.valeurEchangee != null ? `${fmtFcfa(d.etat.valeurEchangee)} FCFA` : null,
    transactions: d.etat.transactions,
  };

  // §3.12 Provenance : un chiffre RÉEL du jour, sa source et son heure.
  const provenance = {
    nbActions: d.nbActions,
    exemple: topH && topH.cours != null ? { code: topH.code, nom: topH.nom, cours: topH.cours } : null,
    seance: fraicheur.derniereSeance,
    collecte: horodatageUtc(fraicheur.derniereCollecte),
    depuis: depuisTexte(fraicheur.ageMinutes),
  };

  // §3.13 Canaux : réponses du vrai code des commandes WhatsApp, lignes du brief publié
  // (repli : lignes factuelles de la séance), quota gratuit lu dans feature_flags.
  const lignesTg = brief ? lignesBrief(brief.contenu) : [];
  const telegram = lignesTg.length > 0
    ? { lignes: lignesTg, entete: `Brief de la séance du ${fmtDateFR(brief!.dateMarche)}`, heure: horodatageUtc(brief!.envoyeLe)?.heure ?? null }
    : { lignes: lignesSeance({ indice: chiffres.indice, variation: chiffres.variation, hausses: d.hausses, baisses: d.baisses, stables: d.inchangees, meilleure: chiffres.meilleure, pire: chiffres.pire, capitaux: d.etat.valeurEchangee }), entete: dateLabel ? `Séance du ${dateLabel}` : 'Dernière séance', heure: null };
  const canaux = {
    communaute,
    whatsapp: exemplesWhatsapp(d.coursSeed, d.dateMarche, d.plusEchangee?.code ?? d.coursSeed[0]?.code ?? null, d.noms),
    quotaGratuit: quotaWa,
    telegram,
    membres,
  };

  return (
    <div className={`vitrine ${classesPolices}`}>
      <LandingNav />

      {/* Refonte « vitrine » (PR 1, spec 2026-11-12) : sections 3.2 à 3.6. */}
      <Ouverture o={{ dateLongue: d.dateMarche ? dateLongue(d.dateMarche) : null, enSeance: estEnSeance(new Date()), membres, nbValeurs: d.nbActions || NB_SOCIETES_COTEES }} />
      <Indice d={sceneIndice(d.brvmC?.valeur ?? null, d.brvmC?.variation ?? null, d.brvmCSerie)} releve={releveTxt} hausses={d.hausses} stables={d.inchangees} baisses={d.baisses} />
      <BandeauSeance lignes={motsBandeau(chiffres)} />
      <SectionMosaique cases={cases} releve={releveTxt} />
      <SectionFilm f={film} dateCourte={dateLabel} />

      {/* Refonte « vitrine » (PR 2) : sections 3.7 à 3.11. */}
      <RailDecouvrir d={decouvrir} />
      <SectionOutils outils={outils} demos={demos} />
      <SectionMethode etapes={etapesMethode} />
      <TuilesSeance secteurs={d.secteurs} etat={d.etat} membres={membres} releve={releveTxt} />
      <SectionPublicite campagnes={campagnesPub(d.slides, d.bandeaux)} />

      {/* Refonte « vitrine » (PR 3) : sections 3.12 à 3.15. Le pied de page est celui
          du site (components/Footer, rendu par ConditionalShell) : pas de doublon ici. */}
      <SectionProvenance p={provenance} />
      <SectionCanaux c={canaux} />
      <SectionGratuit o={{ gratuit: prixGratuit, premium: prixPremium }} />
      <SectionFinale />
      <BandeauFlottant />
      <CanauxFlottants />
    </div>
  );
}
