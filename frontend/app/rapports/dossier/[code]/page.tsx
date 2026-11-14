import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { secretRenduValide, EN_TETE_RENDU } from '@/lib/dossier/renduAutorise';
import { createClient as createSbAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { chargerContexteQuant } from '@/lib/diagnostic/contexteQuant';
import { buildDossier, type DossierValeur } from '@/lib/dossier/build';
import { construireNarratif, chiffresDeLecture } from '@/lib/dossier/narratif';
import { PANNEAU, TOTAL_FEUILLES, TOTAL_PANNEAUX, SOMMAIRE, renvoi } from '@/lib/dossier/structure';
import { comparerEditions, mesuresDuDossier } from '@/lib/dossier/instantane';
import { libellePublication } from '@/lib/dossier/publications';
import { dureeFr } from '@/lib/dossier/placement';
import { RESERVE_REACTION } from '@/lib/reactionPublication';
import { controlerDossier } from '@/lib/dossier/controles';
import { construireSquelette, chargerProse } from '@/lib/dossier/prose';
import { BarresAnnuelles, CourbeCours, BarreDetachement } from '@/components/dossier/Graphiques';
import { fmtFcfa, fmtNumber, fmtDateFR, fmtDateCourte } from '@/lib/format';
import { perAffichable, distributionAffichable, horsExploitation, dividendeCourant, evolutionResultat } from '@/lib/fiche/affichage';
import Link from 'next/link';
import { documentsFiche } from '@/components/sousPage/SousPageNav';
import ImprimerDossier from './ImprimerDossier';
import { CouverturePhoto, PageEssentiel, OuvertureSection, GraphiqueBarres } from '@/components/document/Document';
import { photoActivite } from '@/lib/document/activite';
import { constatCouverture, declarationEssentiel, constatIntermediaire } from '@/lib/document/constats';
import brvmLogos from '@/lib/brvmLogos.json';
import '@/components/document/document.css';
import './dossier.css';

/**
 * Dossier valeur — douze panneaux, format A4.
 *
 * PILOTÉ PAR LA DONNÉE, PAS PAR LA PROSE. Le pipeline d'export existant
 * (`/api/export/pdf`) fait rédiger l'IA puis DÉCOUPE son texte : la mise en
 * page dépend donc de ce que le modèle a bien voulu écrire, et un chiffre faux
 * traverse toute la chaîne sans rencontrer d'obstacle. Ici, chaque valeur vient
 * de `buildDossier` (lecture ou fonction pure testée) et chaque appréciation de
 * `construireNarratif` (déterministe, chiffre à l'appui).
 *
 * Aucun appel de modèle de langage n'intervient dans cette page. Le polissage
 * rédactionnel viendra plus tard, sous la même contrainte que
 * `scraper/src/hebdo/polish.ts` : tout chiffre absent de la liste blanche fait
 * rejeter la sortie.
 */

export const dynamic = 'force-dynamic';

/* Numéros de panneaux, nombre de feuilles et sommaire : lib/dossier/structure.ts.
   Une seule source, vérifiée par test contre le worker d'impression
   (video/dossiers.mjs, FEUILLES_ATTENDUES). Dix-sept feuilles : couverture (1),
   « L'essentiel » (2), lecture d'ensemble et sommaire (3), puis trois sections
   ouvertes chacune par une page d'ouverture (4, 9, 13). Contrainte de
   l'impression : chaque feuille a une hauteur FIXE de 297 mm, un contenu qui
   déborde est refusé par le worker. Ne rien ajouter à une feuille sans mesurer. */
const LOGOS = brvmLogos as Record<string, string>;

const STATUT_PILIER: Record<string, string> = {
  tenu: 'Seuil atteint',
  non_tenu: 'Seuil non atteint',
  non_mesurable: 'Non mesurable',
  non_applicable: 'Sans objet',
};
const FLECHE: Record<string, string> = { hausse: '↗', baisse: '↘', stable: '→' };

export async function generateMetadata(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  return { title: `Dossier ${params.code.toUpperCase()}` };
}

// ── Affichage des valeurs ───────────────────────────────────────────────────

/** Une valeur absente s'affiche comme absente. Jamais de zéro de complaisance. */
function Absent({ raison }: { raison?: string }) {
  return (
    <span className="dv-absent" title={raison}>
      non disponible
    </span>
  );
}

const nb = (v: number | null | undefined, d = 0) => (v == null ? null : fmtNumber(v, d));
const cfa = (v: number | null | undefined) => (v == null ? null : `${fmtFcfa(v)} FCFA`);
const pourcent = (v: number | null | undefined, d = 1) =>
  v == null ? null : `${v >= 0 ? '+' : '−'}${fmtNumber(Math.abs(v) * 100, d)} %`;
/** Sans signe : pour les grandeurs qui n'ont pas de sens négatif (payout, part). */
const part = (v: number | null | undefined, d = 1) => (v == null ? null : `${fmtNumber(v * 100, d)} %`);
/** Taux réglementaire : « 10 % », « 12,5 % » — jamais « 10,0 % ». */
const taux = (v: number) => `${fmtNumber(v * 100, Math.round(v * 1000) % 10 === 0 ? 0 : 1)} %`;
const fois = (v: number | null | undefined) => (v == null ? null : `${fmtNumber(v, 2)} ×`);

function Mesure({
  libelle,
  valeur,
  note,
  ton,
  texte,
  motif,
}: {
  libelle: string;
  valeur: string | null;
  note?: string;
  ton?: 'hausse' | 'baisse';
  /** Valeur en mots (secteur…) : police du texte, plus petite, sans césure forcée. */
  texte?: boolean;
  /** Raison affichée à la place de « non disponible » (perte, sans objet…). */
  motif?: string | null;
}) {
  const classes = [
    valeur == null ? null : ton === 'hausse' ? 'dv-hausse' : ton === 'baisse' ? 'dv-baisse' : null,
    texte ? 'dv-dd-texte' : null,
  ].filter(Boolean).join(' ');
  return (
    <div className="dv-mesure">
      <dt>{libelle}</dt>
      <dd className={classes || undefined}>
        {valeur ?? (motif ? <span className="dv-absent">{motif}</span> : <Absent />)}
      </dd>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

function Panneau({ n, titre, chapo, children }: { n: number; titre: string; chapo?: string; children: React.ReactNode }) {
  return (
    <section className="dv-panneau">
      <h2 className="dv-titre">
        <span className="dv-numero">{String(n).padStart(2, '0')}</span>
        {titre}
      </h2>
      {chapo ? <p className="dv-chapo">{chapo}</p> : null}
      {children}
    </section>
  );
}

function Feuille({ d, page, children }: { d: DossierValeur; page: number; children: React.ReactNode }) {
  return (
    <article className="dv-page" data-feuille="">
      <div className="dv-courant">
        <span>{d.identite.designation ?? d.identite.code}</span>
        <span>Dossier valeur · {d.identite.code}</span>
      </div>
      {children}
      <div className="dv-pied">
        <span>Document d&apos;information : ne constitue pas un conseil en investissement.</span>
        <span>{page} / {TOTAL_FEUILLES}</span>
      </div>
    </article>
  );
}

/* Le libellé dit le SIGNAL, pas l'état de tous les indicateurs : un signal
   d'attente avec un RSI à 81,5 (SNTS, 09/10/2026) n'a rien de « neutre ».
   La zone du RSI est donc dite à côté, comme un fait. */
const VERDICT: Record<string, string> = {
  BUY: 'Signal haussier',
  SELL: 'Signal baissier',
  HOLD: 'Signal d’attente',
};

function zoneRsi(rsi: number | null): string | null {
  if (rsi == null) return null;
  if (rsi >= 70) return `RSI ${fmtNumber(rsi, 1)} : zone de surachat (au-dessus de 70).`;
  if (rsi <= 30) return `RSI ${fmtNumber(rsi, 1)} : zone de survente (au-dessous de 30).`;
  return null;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function DossierPage(props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  /* Réservé Premium (niveau lu en base, `dossiers_valeur`). Le robot qui imprime
     les PDF du samedi n'a ni session ni abonnement : il passe par le secret
     d'impression, revérifié ici car le middleware ne fait que l'admettre. */
  const robot = secretRenduValide(process.env.DOSSIER_RENDER_SECRET, (await headers()).get(EN_TETE_RENDU));
  if (!robot) {
    const gate = await canAccess('dossiers_valeur');
    if (!gate.allowed) {
      return (
        <AccessGate
          required={gate.required === 'free' ? 'premium' : gate.required}
          feature="Les Dossiers valeur"
          hint="Un dossier de quatorze pages par société cotée, mis à jour chaque semaine : comptes, valorisation, dividende, niveaux et points de vigilance, en PDF."
        />
      );
    }
  }
  const sb = createClient();
  /* Médianes des comparables : même source que le diagnostic (dernier calcul
     Combined Alpha), lue avec le client serveur. Absentes = panneau 15 vide et
     pilier « valorisation » non mesurable, jamais une médiane inventée. */
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const medianes =
    svc && url
      ? (await chargerContexteQuant(createSbAdmin(url, svc, { auth: { persistSession: false } }), params.code.toUpperCase())).medianes
      : null;
  /* Le worker d'impression n'a pas de session : sans le client serveur, le
     signal (signals_daily, fermé à l'anonyme depuis F-04) sortirait vide en
     silence. La page elle-même reste derrière le middleware (session ou
     secret d'impression) : ce client ne sert qu'à lire. */
  const sbLecture = svc && url ? createSbAdmin(url, svc, { auth: { persistSession: false } }) : sb;
  const d = await buildDossier(sbLecture, params.code, { medianes });
  if (!d) notFound();

  const n = construireNarratif(d);
  /* Prose : squelette déterministe, remplacé par la version polie SEULEMENT si
     elle correspond au squelette vivant et repasse le garde-fou. */
  const prose = await chargerProse(sb, d.identite.code, construireSquelette(d, n));
  const [lecture, scenarios] = prose.sections;
  const { identite: id, chiffres_cles: c, ratios: r, qualite_resultat: q, dividende: div, niveaux: lv } = d;
  const nomComplet = id.designation ?? id.code;
  const per = perAffichable(r?.per ?? null, r?.bpa ?? null);
  const distribution = distributionAffichable(div.payout, c.resultat_net);
  const horsExpl = q ? horsExploitation(q.resultat_avant_impots, q.resultat_exploitation) : null;
  const dernierExercice = c.exercice != null ? Number(c.exercice) : null;
  const divCourant = div.montant != null && div.montant > 0
    ? dividendeCourant([{ montant: div.montant, exercice: div.exercice, ex_date: div.ex_date, payment_date: div.payment_date }], dernierExercice)
    : null;
  const traj = d.trajectoire;
  const evolution = traj.length >= 2 ? evolutionResultat(traj[traj.length - 1]!.resultat_net, traj[traj.length - 2]!.resultat_net) : null;
  const dette = c.dette_perimetre === 'long_terme' ? 'dette à plus d’un an' : 'dette financière';

  /* « Depuis la dernière édition » : l'édition courante (mesures vivantes) contre
     l'édition STRICTEMENT antérieure figée en base. Sans édition antérieure, ou
     table absente, ou version différente : pas d'encadré (jamais un « 0 % »). */
  let depuis: ReturnType<typeof comparerEditions> = null;
  if (c.date_cours) {
    try {
      const { data: prec } = await sbLecture
        .from('dossier_instantanes')
        .select('edition, version, mesures')
        .eq('code', id.code)
        .lt('edition', c.date_cours)
        .order('edition', { ascending: false })
        .limit(1)
        .maybeSingle();
      depuis = comparerEditions(mesuresDuDossier(d), (prec as { edition: string; version: number; mesures: unknown } | null) ?? null);
    } catch {
      depuis = null;
    }
  }
  const libellePilier = new Map(d.suivi.piliers.map((p) => [p.cle as string, p.libelle]));
  const pointsChiffres = chiffresDeLecture(n);
  const pl = d.placement;
  const bande = d.bande_per;

  /* Contrôles de cohérence : le worker d'impression lit cet attribut et REFUSE
     de ranger le PDF s'il n'est pas vide (comme pour un débordement). */
  const anomalies = controlerDossier(d);

  // Couverture et « L'essentiel » (système de document, lot 3).
  const entete = `Dossier valeur · édition du ${fmtDateCourte(d.genere_le)}`;
  const photo = photoActivite(id.code, id.secteur);
  const precedent = traj.length >= 2 ? traj[traj.length - 2]! : null;
  // Dernière publication intermédiaire (plus récente que l'exercice annuel), même lecture que le panneau 16.
  const inter = d.suivi.intermediaire;
  const varInter = (a: number | null, b: number | null) => (a != null && b != null && b > 0 ? pourcent((a - b) / b) : null);
  const separe = (v: number | null): { valeur: string | null; unite?: string } => {
    if (v == null) return { valeur: null };
    const t = fmtFcfa(v);
    const m = t.match(/^(.*?)\s(Md|M)$/);
    return m ? { valeur: m[1]!, unite: `${m[2]} FCFA` } : { valeur: t, unite: 'FCFA' };
  };

  return (
    <div className="dv doc" data-controles={JSON.stringify(anomalies)}>
      {anomalies.length > 0 && (
        <div className="dv-actions print:hidden" role="alert">
          <span>Dossier incohérent, non imprimable : {anomalies.join(' ')}</span>
        </div>
      )}
      {/* Écran seulement : retire de la feuille imprimée (display:none en print). */}
      <nav className="dv-actions dv-nav print:hidden" aria-label="Documents de la fiche">
        <Link href={`/actions/${id.code}`}>‹ Retour à la fiche {id.code}</Link>
        <span className="dv-nav-liens">
          {documentsFiche(id.code)
            .filter((d) => !d.href.startsWith('/rapports/dossier/'))
            .map((d) => (
              <Link key={d.href} href={d.href}>{d.label}</Link>
            ))}
        </span>
      </nav>
      <div className="dv-actions">
        <span>
          {TOTAL_PANNEAUX} panneaux sur {TOTAL_FEUILLES} feuilles A4 : chaque chiffre est lu en base ou calculé, aucun n&apos;est rédigé.
        </span>
        <ImprimerDossier />
      </div>

      {/* ── Feuilles 1 et 2 · Couverture photo et « L'essentiel » ──────── */}
      <CouverturePhoto
        entete={entete} societe={nomComplet} code={id.code} logo={LOGOS[id.code] ?? null} photo={photo}
        surtitre={['Dossier valeur', id.secteur, id.pays].filter(Boolean).join(' · ')}
        constat={constatIntermediaire(inter) ?? constatCouverture({ exercice: c.exercice, resultatNet: c.resultat_net, resultatNetPrecedent: precedent?.resultat_net ?? null })}
        total={TOTAL_FEUILLES}
        chiffres={[
          c.cours != null ? { libelle: 'Cours', valeur: `${fmtNumber(c.cours)} FCFA`, note: [c.date_cours ? `au ${fmtDateCourte(c.date_cours)}` : null, d.suivi.performance.var_ytd != null ? `${pourcent(d.suivi.performance.var_ytd)} depuis janvier` : null].filter(Boolean).join(' · ') } : null,
          c.capitalisation != null ? { libelle: 'Capitalisation', valeur: `${fmtFcfa(c.capitalisation)} FCFA` } : null,
          per.valeur != null ? { libelle: 'PER', valeur: fmtNumber(per.valeur, 1), note: c.exercice ? `bénéfice de l’exercice ${c.exercice}` : null } : null,
        ].filter((x): x is NonNullable<typeof x> => x != null)}
      />
      <PageEssentiel
        photo={photo} societe={nomComplet} page={2} total={TOTAL_FEUILLES}
        surtitre={`L’essentiel de l’exercice ${c.exercice ?? ''}`.trim()}
        declaration={declarationEssentiel({
          societe: nomComplet, exercice: c.exercice, ca: c.chiffre_affaires, caPrecedent: precedent?.chiffre_affaires ?? null,
          resultatNet: c.resultat_net, resultatNetPrecedent: precedent?.resultat_net ?? null,
        }) ?? 'Les comptes du dernier exercice ne sont pas disponibles.'}
        chiffres={[
          { libelle: 'Chiffre d’affaires', ...separe(c.chiffre_affaires), note: c.croissance_ca_1an != null ? `${pourcent(c.croissance_ca_1an)} sur un an` : null },
          { libelle: 'Résultat net', ...separe(c.resultat_net), note: evolution ? `${evolution} sur un an` : null },
          { libelle: 'Marge nette', valeur: c.resultat_net != null && c.chiffre_affaires ? fmtNumber((c.resultat_net / c.chiffre_affaires) * 100, 1) : null, unite: '%', note: 'résultat net rapporté au chiffre d’affaires' },
          { libelle: 'Dividende par action', valeur: divCourant ? fmtNumber(divCourant.montant, Number.isInteger(divCourant.montant) ? 0 : 2) : null, unite: 'FCFA', note: div.rendement != null ? `rendement de ${fmtNumber(div.rendement * 100, 2)}\u00a0% au cours actuel${div.exercice ? `, exercice ${div.exercice}` : ''}` : null },
        ]}
      >
        {inter && (
          <section className="doc-recent" aria-label="Dernière publication">
            <p className="doc-surtitre">Dernière publication · {inter.libelle}</p>
            <dl>
              <div><dt>Chiffre d’affaires</dt><dd>{inter.revenu != null ? `${fmtFcfa(inter.revenu)} FCFA` : 'non publié'}</dd>{varInter(inter.revenu, inter.revenuPrecedent) && <small>{varInter(inter.revenu, inter.revenuPrecedent)} sur la même période</small>}</div>
              <div><dt>Résultat net</dt><dd>{inter.resultatNet != null ? `${fmtFcfa(inter.resultatNet)} FCFA` : 'non publié'}</dd>{varInter(inter.resultatNet, inter.resultatNetPrecedent) && <small>{varInter(inter.resultatNet, inter.resultatNetPrecedent)} sur la même période</small>}</div>
            </dl>
            <p className="doc-recent-note">Comparé {/^\d/.test(inter.libellePrecedent) ? 'aux' : 'au'} {inter.libellePrecedent}. Détail au {renvoi('intermediaire')}.</p>
          </section>
        )}
      </PageEssentiel>

      {/* ── Feuille 3 · Lecture d'ensemble, depuis la dernière édition, résumé et sommaire ── */}
      <article className="dv-page" data-feuille="">
        <div className="dv-courant">
          <span>{nomComplet}</span>
          <span>Dossier valeur · {id.code}</span>
        </div>

        <section className="dv-panneau">
          <h2 className="dv-titre">{lecture!.titre}</h2>
          <p className="dv-prose">{lecture!.texte}</p>
          {(pointsChiffres.forces.length > 0 || pointsChiffres.risques.length > 0) && (
            <div className="dv-lecture-chiffres">
              {pointsChiffres.forces.length > 0 && (
                <div>
                  <h3 className="dv-sous-titre">Points d’appui</h3>
                  <ul className="dv-liste dv-liste--forces">
                    {pointsChiffres.forces.map((t) => <li key={t}><span>{t}</span></li>)}
                  </ul>
                </div>
              )}
              {pointsChiffres.risques.length > 0 && (
                <div>
                  <h3 className="dv-sous-titre">Points de vigilance</h3>
                  <ul className="dv-liste dv-liste--risques">
                    {pointsChiffres.risques.map((t) => <li key={t}><span>{t}</span></li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <p className="dv-source">
            {prose.source === 'polie'
              ? `Texte relu le ${fmtDateFR(prose.genere_le)}, établi à partir des panneaux de ce dossier. `
              : 'Texte établi à partir des panneaux de ce dossier. '}
            Il ne cite aucun chiffre : ceux qui le fondent sont lus à l’instant sur les mêmes mesures que les panneaux {PANNEAU.appuis} et {PANNEAU.vigilance}.
          </p>
        </section>

        {depuis && (
          <section className="dv-encadre dv-edition" aria-label="Depuis la dernière édition">
            <h3>Depuis la dernière édition</h3>
            <p className="dv-edition-date">Édition précédente : séance du {fmtDateFR(depuis.edition_precedente)}.</p>
            <ul>
              {depuis.variation_cours != null && (
                <li>
                  Cours : <strong className={tonDe(depuis.variation_cours) === 'hausse' ? 'dv-hausse' : tonDe(depuis.variation_cours) === 'baisse' ? 'dv-baisse' : undefined}>{pourcent(depuis.variation_cours)}</strong> depuis cette séance.
                </li>
              )}
              {depuis.publications_parues != null && (
                <li>
                  {depuis.publications_parues === 0
                    ? 'Aucune nouvelle publication en base.'
                    : `${depuis.publications_parues} nouvelle${depuis.publications_parues > 1 ? 's' : ''} publication${depuis.publications_parues > 1 ? 's' : ''} en base.`}
                </li>
              )}
              {depuis.piliers_changes.length === 0 ? (
                <li>Aucun pilier de suivi n’a changé de constat.</li>
              ) : (
                depuis.piliers_changes.map((x) => (
                  <li key={x.cle}>
                    {libellePilier.get(x.cle) ?? x.cle} : {STATUT_PILIER[x.avant] ?? x.avant} → {STATUT_PILIER[x.apres] ?? x.apres}.
                  </li>
                ))
              )}
            </ul>
          </section>
        )}

        <section className="dv-resume" aria-label="En une page">
          <h2 className="dv-sous-titre">En une page</h2>
          <div className="dv-resume-grille">
            <div className="dv-encadre">
              <h3>Activité</h3>
              <p>
                {c.chiffre_affaires != null
                  ? <><strong>{cfa(c.chiffre_affaires)}</strong> de chiffre d&apos;affaires{c.exercice ? ` en ${c.exercice}` : ''}{c.croissance_ca_1an != null ? `, ${pourcent(c.croissance_ca_1an)} sur un exercice` : ''}.</>
                  : 'Chiffre d’affaires non disponible.'}
              </p>
            </div>
            <div className="dv-encadre">
              <h3>Résultat</h3>
              <p>
                {c.resultat_net != null
                  ? <><strong>{cfa(c.resultat_net)}</strong> de résultat net{evolution ? ` (${evolution})` : ''}.</>
                  : 'Résultat net non disponible.'}
                {q?.resultat_exploitation != null ? ` Exploitation : ${cfa(q.resultat_exploitation)}.` : ''}
              </p>
            </div>
            <div className="dv-encadre">
              <h3>Bilan</h3>
              <p>
                {c.capitaux_propres != null ? <><strong>{cfa(c.capitaux_propres)}</strong> de capitaux propres</> : 'Capitaux propres non disponibles'}
                {c.dette != null ? `, ${dette} de ${cfa(c.dette)}` : ''}.
              </p>
            </div>
            <div className="dv-encadre">
              <h3>Dividende</h3>
              <p>
                {divCourant
                  ? <><strong>{fmtNumber(divCourant.montant, 2)} FCFA</strong>{divCourant.exercice != null ? ` au titre de ${divCourant.exercice}` : ''}{divCourant.ancien ? ', aucun depuis' : ''}.</>
                  : 'Aucun dividende enregistré.'}
              </p>
            </div>
          </div>
        </section>

        <nav className="dv-sommaire" aria-label="Sommaire">
          <h2 className="dv-sous-titre">Sommaire</h2>
          <ol>
            {SOMMAIRE.map(([titre, panneaux, feuille]) => (
              <li key={titre}><span>{panneaux}</span> {titre} <em>p. {feuille}</em></li>
            ))}
          </ol>
        </nav>

        <div className="dv-pied">
          <span>Document d&apos;information : ne constitue pas un conseil en investissement.</span>
          <span>3 / {TOTAL_FEUILLES}</span>
        </div>
      </article>

      {/* ── Section 1 · feuilles 4 à 8 ─────────────────────────────────── */}
      <OuvertureSection numero={1} titre="L’entreprise et ses comptes" photo={photo?.fichier ?? null} entete={entete} societe={nomComplet}
        sommaire={['L’entreprise en bref et ses chiffres clés', 'Trajectoire des résultats et valorisation', 'D’où vient le bénéfice, le dividende', 'Un million de FCFA investi, valorisation sur cinq ans']} />
      <Feuille d={d} page={5}>
        <Panneau n={PANNEAU.entreprise} titre="L'entreprise en bref">
          <dl className="dv-grille">
            <Mesure libelle="Secteur" valeur={id.secteur} texte />
            <Mesure libelle="Pays" valeur={id.pays} />
            <Mesure libelle="Actions en circulation" valeur={nb(id.actions)} />
            <Mesure
              libelle="Titres au flottant"
              valeur={nb(id.flottant)}
              note={
                id.flottant != null && id.actions != null
                  ? `Soit ${fmtNumber((id.flottant / id.actions) * 100, 1)} % du capital.`
                  : undefined
              }
            />
            <Mesure
              libelle="Notation"
              valeur={id.notation?.note ? (id.notation.communique_plus_recent ? 'À confirmer' : id.notation.note) : null}
              texte={!!id.notation?.communique_plus_recent}
              note={
                id.notation?.note
                  ? id.notation.communique_plus_recent
                    ? `Note enregistrée : ${id.notation.note} (${id.notation.agence ?? 'agence non précisée'}${
                        id.notation.date_notation ? `, ${fmtDateFR(id.notation.date_notation)}` : ''
                      }). Un communiqué de notation du ${fmtDateFR(id.notation.communique_plus_recent)} n'est pas encore intégré.`
                    : `${id.notation.agence ?? 'Agence non précisée'}${
                        id.notation.date_notation ? `, ${fmtDateFR(id.notation.date_notation)}` : ''
                      }${
                        id.notation.perspective ? `, perspective ${id.notation.perspective}` : ''
                      }. Mesure la qualité de crédit, pas la valorisation de l'action.`
                  : undefined
              }
            />
            <Mesure
              libelle="Capitalisation"
              valeur={cfa(c.capitalisation)}
              note="Cours × actions en circulation."
            />
          </dl>
        </Panneau>

        <Panneau
          n={PANNEAU.chiffresCles}
          titre={`Chiffres clés${c.exercice ? ` — exercice ${c.exercice}` : ''}`}
          chapo="Montants tels que publiés par la société, repris des états financiers en base."
        >
          <dl className="dv-grille">
            <Mesure libelle="Chiffre d'affaires" valeur={cfa(c.chiffre_affaires)} />
            <Mesure
              libelle="Résultat net"
              valeur={cfa(c.resultat_net)}
              ton={c.resultat_net == null ? undefined : c.resultat_net >= 0 ? 'hausse' : 'baisse'}
            />
            <Mesure libelle="Capitaux propres" valeur={cfa(c.capitaux_propres)} />
            <Mesure
              libelle={c.dette_perimetre === 'long_terme' ? 'Dette à plus d’un an' : 'Dette financière'}
              valeur={cfa(c.dette)}
              note={
                c.dette_perimetre === 'totale'
                  ? `À plus et à moins d’un an${c.exercice ? `, bilan ${c.exercice}` : ''}.`
                  : c.dette_perimetre === 'declaree'
                    ? 'Montant déclaré : son périmètre (court terme compris ou non) n’est pas vérifié.'
                    : undefined
              }
            />
            <Mesure
              libelle="Croissance du CA"
              valeur={pourcent(c.croissance_ca_1an)}
              ton={c.croissance_ca_1an == null ? undefined : c.croissance_ca_1an >= 0 ? 'hausse' : 'baisse'}
              note={
                c.croissance_ca_2ans != null
                  ? `Sur deux exercices : ${pourcent(c.croissance_ca_2ans)}.`
                  : 'Sur un exercice.'
              }
            />
            <Mesure
              libelle="Capitaux propres, variation"
              valeur={pourcent(c.variation_capitaux_propres_1an)}
              ton={
                c.variation_capitaux_propres_1an == null
                  ? undefined
                  : c.variation_capitaux_propres_1an >= 0
                    ? 'hausse'
                    : 'baisse'
              }
              note="Sur un exercice."
            />
          </dl>
        </Panneau>
      </Feuille>

      {/* ── Feuille 3 · Trajectoire et valorisation ────────────────────── */}
      <Feuille d={d} page={6}>
        <Panneau
          n={PANNEAU.trajectoire}
          titre="Trajectoire des résultats"
          chapo="Chiffre d'affaires et résultat net par exercice, à la même échelle : les deux sont en FCFA, la comparaison est directe."
        >
          <BarresAnnuelles points={d.trajectoire} />
        </Panneau>

        <Panneau
          n={PANNEAU.valorisation}
          titre="Valorisation"
          chapo="Ce que le marché paie aujourd'hui pour les résultats et les capitaux propres publiés."
        >
          <dl className="dv-grille">
            <Mesure libelle="Bénéfice par action" valeur={nb(r?.bpa, 2)} note="Résultat net ÷ actions en circulation." />
            <Mesure libelle="PER" valeur={fois(per.valeur)} motif={per.motif} note="Cours ÷ bénéfice par action." />
            {d.per_glissant && (
              <Mesure
                libelle="PER sur douze mois"
                valeur={fois(d.per_glissant.valeur)}
                motif={d.per_glissant.valeur == null ? 'résultat glissant nul ou négatif' : undefined}
                note={`Cours ÷ bénéfice par action des ${d.per_glissant.libelle}.`}
              />
            )}
            <Mesure libelle="Cours / capitaux propres" valeur={fois(r?.pb)} />
            <Mesure libelle="Cours / chiffre d'affaires" valeur={fois(r?.ps)} />
            <Mesure
              libelle="Rentabilité des capitaux propres"
              valeur={part(r?.roe)}
              ton={r?.roe == null ? undefined : r.roe >= 0 ? 'hausse' : 'baisse'}
            />
            <Mesure libelle="Marge nette" valeur={part(r?.margeNette)} />
            <Mesure
              libelle={c.dette_perimetre === 'long_terme' ? 'Dette à plus d’un an / capitaux propres' : 'Dette financière / capitaux propres'}
              valeur={part(r?.gearing)}
              note={c.dette_perimetre === 'declaree' ? 'Périmètre de la dette non vérifié : le taux peut être sous-estimé.' : undefined}
            />
            {d.rentabilite_actif?.mesure === 'capitaux_investis' ? (
              <Mesure
                libelle="Rentabilité des capitaux investis"
                valeur={part(d.rentabilite_actif.valeur)}
                note="Résultat net / (capitaux propres + dette) : l'actif total de l'exercice n'est pas en base."
              />
            ) : (
              <Mesure
                libelle="Rentabilité de l'actif"
                valeur={part(d.rentabilite_actif?.valeur)}
                note={c.exercice ? `Résultat net / actif total ${c.exercice}.` : undefined}
              />
            )}
          </dl>
        </Panneau>
      </Feuille>

      {/* ── Feuille 4 · Qualité du résultat et dividende ───────────────── */}
      <Feuille d={d} page={7}>
        <Panneau
          n={PANNEAU.benefice}
          titre="D'où vient le bénéfice"
          chapo="Un résultat net ne dit pas s'il est reproductible. Ce panneau sépare ce qui vient de l'exploitation de ce qui vient d'ailleurs."
        >
          {q ? (
            <>
              <dl className="dv-grille">
                <Mesure libelle="Résultat d'exploitation" valeur={cfa(q.resultat_exploitation)} />
                <Mesure libelle="Résultat avant impôts" valeur={cfa(q.resultat_avant_impots)} />
                <Mesure libelle="Marge d'exploitation" valeur={part(q.marge_exploitation)} />
                <Mesure
                  libelle="Produits hors exploitation"
                  valeur={cfa(horsExpl)}
                  ton={horsExpl == null || q.part_non_operationnelle == null ? undefined : q.part_non_operationnelle > 0.5 ? 'baisse' : 'hausse'}
                  note="Avant impôts, moins l'exploitation."
                />
              </dl>
              {q.part_non_operationnelle != null && q.part_non_operationnelle > 0.5 && horsExpl != null && (
                <div className="dv-encadre dv-encadre--reserve" style={{ marginTop: '3mm' }}>
                  <h3>À lire avec prudence</h3>
                  <p style={{ margin: 0 }}>
                    {cfa(horsExpl)} de produits hors exploitation, pour un résultat d&apos;exploitation de{' '}
                    {cfa(q.resultat_exploitation)}. Rien ne garantit leur retour l&apos;exercice suivant : le bénéfice
                    publié ne peut pas être projeté tel quel.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="dv-vide">
              Le compte de résultat détaillé n&apos;est pas en base pour cette société : l&apos;origine du bénéfice ne
              peut pas être établie.
            </p>
          )}
        </Panneau>

        <Panneau n={PANNEAU.dividende} titre="Dividende">
          {div.montant != null && div.montant > 0 ? (
            <>
              <dl className="dv-grille">
                <Mesure
                  libelle="Dernier dividende"
                  valeur={`${fmtNumber(div.montant, 2)} FCFA`}
                  note={
                    div.base_fiscale === 'net'
                      ? `Montant NET : l'impôt sur le revenu des valeurs mobilières${id.taux_irvm != null ? ` (${taux(id.taux_irvm)})` : ''} est déjà retenu à la source.`
                      : div.base_fiscale === 'brut'
                        ? `Montant BRUT, avant la retenue de l'impôt sur le revenu des valeurs mobilières${id.taux_irvm != null ? ` (${taux(id.taux_irvm)})` : ''}.`
                        : `La source « ${div.source ?? 'inconnue'} » ne précise pas si ce montant est brut ou net.`
                  }
                />
                <Mesure libelle="Exercice" valeur={div.exercice != null ? String(div.exercice) : null} />
                {/* Une date que la baisse du cours ne confirme pas n'est pas un fait :
                    le dossier SNTS l'affichait ici sans réserve, la désavouait au
                    panneau 20, et l'Ascension (14/05/2026) n'avait aucune séance. */}
                {d.suivi.ex_date_controle === 'a_verifier' && div.ex_date ? (
                  <Mesure
                    libelle="Détachement"
                    valeur="Non établi"
                    texte
                    note={`Date enregistrée : ${fmtDateFR(div.ex_date)}. Le cours ne la confirme pas (${renvoi('detachement')}).`}
                  />
                ) : (
                  <Mesure libelle="Détachement" valeur={div.ex_date ? fmtDateFR(div.ex_date) : null} />
                )}
                <Mesure libelle="Mise en paiement" valeur={div.payment_date ? fmtDateFR(div.payment_date) : null} />
                <Mesure
                  libelle="Rendement"
                  valeur={part(div.rendement, 2)}
                  note={
                    div.base_fiscale === 'net'
                      ? 'Rendement net du cours actuel.'
                      : div.base_fiscale === 'brut'
                        ? 'Rendement brut du cours actuel.'
                        : `Base fiscale inconnue : ce taux est incertain à hauteur de l'impôt retenu à la source${id.taux_irvm != null ? ` (${taux(id.taux_irvm)})` : ''}.`
                  }
                />
                <Mesure
                  libelle="Taux de distribution"
                  valeur={part(distribution.valeur)}
                  motif={distribution.motif}
                  note={
                    div.base_fiscale === 'net'
                      ? `Rapporte un dividende net à un bénéfice brut : minoré${id.taux_irvm != null ? ` d'environ ${taux(id.taux_irvm)}` : " du taux de l'impôt retenu à la source"}.`
                      : 'Part du résultat net distribuée.'
                  }
                />
              </dl>

              {div.historique.length > 0 && (
                <div className="dv-tableau-cadre" style={{ marginTop: '4mm' }}>
                  <table className="dv-tableau">
                    <caption className="dv-chapo" style={{ captionSide: 'top', textAlign: 'left' }}>
                      Historique par exercice, zéros compris : l&apos;irrégularité est une information, pas un trou.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Exercice</th>
                        <th scope="col">Dividende (FCFA)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {div.historique.map((h) => (
                        <tr key={`${h.exercice}`}>
                          <td>{h.exercice}</td>
                          <td className="dv-num">
                            {h.montant == null ? '—' : h.montant === 0 ? 'Aucun' : fmtNumber(h.montant, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="dv-vide">
              Aucun dividende strictement positif enregistré pour cette valeur : rendement et taux de distribution ne
              sont pas calculables.
            </p>
          )}
        </Panneau>
      </Feuille>

      {/* ── Feuille 8 · Placement sur cinq ans et bande de PER ─────────── */}
      <Feuille d={d} page={8}>
        <Panneau
          n={PANNEAU.placement}
          titre="Un million de FCFA investi"
          chapo={
            pl
              ? `Ce que vaudrait aujourd’hui un million de FCFA placé sur ce titre le ${fmtDateFR(pl.date_depart)}, il y a ${dureeFr(pl.duree_jours)}.`
              : 'Ce que vaudrait aujourd’hui un million de FCFA placé sur ce titre, il y a cinq ans.'
          }
        >
          {pl ? (
            <>
              <dl className="dv-grille">
                <Mesure
                  libelle="Valeur aujourd’hui"
                  valeur={cfa(pl.valeur_totale)}
                  ton={pl.rendement_total >= 0 ? 'hausse' : 'baisse'}
                  note={`${pourcent(pl.rendement_total)} avec les dividendes nets reçus.`}
                />
                <Mesure
                  libelle="Cours seul"
                  valeur={cfa(pl.valeur_cours)}
                  ton={pl.variation_cours >= 0 ? 'hausse' : 'baisse'}
                  note={`${pourcent(pl.variation_cours)} : de ${fmtNumber(pl.cours_depart, 0)} à ${fmtNumber(pl.cours_fin, 0)} FCFA.`}
                />
                <Mesure
                  libelle="Dividendes nets reçus"
                  valeur={pl.nb_dividendes > 0 ? cfa(pl.dividendes_nets) : null}
                  motif={pl.nb_dividendes === 0 ? 'aucun dividende compté' : undefined}
                  note={pl.nb_dividendes > 0 ? `${pl.nb_dividendes} versement${pl.nb_dividendes > 1 ? 's' : ''}, nets d’impôt.` : undefined}
                />
                <Mesure
                  libelle="BRVM Composite"
                  valeur={pl.variation_indice != null ? pourcent(pl.variation_indice) : null}
                  ton={tonDe(pl.variation_indice)}
                  motif={pl.variation_indice == null ? 'comparaison non disponible' : undefined}
                  note={pl.variation_indice != null ? 'Indice de cours, dividendes non inclus, sur la même période.' : undefined}
                />
              </dl>
              <div className="dv-encadre" style={{ marginTop: '3mm' }}>
                <h3>Hypothèses</h3>
                <ul>
                  <li>Entrée au cours de clôture du {fmtDateFR(pl.date_depart)} ({fmtNumber(pl.cours_depart, 0)} FCFA), sans frais de courtage, en nombre de titres fractionnaire.</li>
                  <li>Dividendes encaissés en numéraire et non réinvestis ; comptés nets d’impôt (un montant déjà net est repris tel quel, un montant brut est diminué de l’impôt{id.taux_irvm != null ? ` au taux de ${taux(id.taux_irvm)}` : ''}).</li>
                  <li>Cours ajustés des opérations sur titres.</li>
                  {pl.periode_reduite && (
                    <li>L’historique en base ne remonte pas à cinq ans : la période retenue est la plus longue disponible, soit {dureeFr(pl.duree_jours)}.</li>
                  )}
                  {pl.dividendes_exclus_base > 0 && (
                    <li>{pl.dividendes_exclus_base} dividende{pl.dividendes_exclus_base > 1 ? 's' : ''} de la période dont la base fiscale (brute ou nette) n’est pas établie {pl.dividendes_exclus_base > 1 ? 'ne sont pas comptés' : 'n’est pas compté'} : la valeur affichée peut être minorée.</li>
                  )}
                  {pl.dividendes_non_dates > 0 && (
                    <li>{pl.dividendes_non_dates} dividende{pl.dividendes_non_dates > 1 ? 's' : ''} sans date de détachement, versé{pl.dividendes_non_dates > 1 ? 's' : ''} une année de bord de la période, {pl.dividendes_non_dates > 1 ? 'ne sont pas comptés' : 'n’est pas compté'}.</li>
                  )}
                  {pl.indice_raison && <li>{pl.indice_raison}</li>}
                </ul>
              </div>
            </>
          ) : (
            <p className="dv-vide">
              Moins de six mois de cotation en base, ou historique illisible : la valeur d’un million de FCFA investi n’est pas calculée.
            </p>
          )}
        </Panneau>

        <Panneau
          n={PANNEAU.bandePer}
          titre="Valorisation sur cinq ans"
          chapo="PER à la clôture de chaque exercice bénéficiaire, et PER actuel situé dans cette fourchette."
        >
          {bande ? (
            <>
              <GraphiqueBarres
                titre="PER à la clôture de chaque exercice, puis PER actuel"
                points={[
                  ...bande.points.map((p) => ({ libelle: String(p.exercice), valeur: p.per })),
                  ...(per.valeur != null ? [{ libelle: 'Actuel', valeur: per.valeur }] : []),
                ]}
                format={(v) => `${fmtNumber(v, 1)} ×`}
                hauteur={190}
              />
              <p className="dv-prose" style={{ marginTop: '2mm' }}>
                Sur les {bande.points.length} exercices retenus, le PER de fin d’exercice a varié de <strong>{fmtNumber(bande.min, 1)} ×</strong> à{' '}
                <strong>{fmtNumber(bande.max, 1)} ×</strong>, pour une médiane de <strong>{fmtNumber(bande.mediane, 1)} ×</strong>.{' '}
                {bande.situation == null
                  ? 'Le PER actuel n’est pas calculable : il n’est pas situé dans la fourchette.'
                  : bande.situation === 'dans'
                    ? `Le PER actuel (${fmtNumber(per.valeur ?? 0, 1)} ×) se situe dans cette fourchette, à ${fmtNumber((bande.position ?? 0) * 100, 0)} % de son amplitude à partir du plus bas.`
                    : bande.situation === 'sous'
                      ? `Le PER actuel (${fmtNumber(per.valeur ?? 0, 1)} ×) est inférieur au plus bas de ces exercices.`
                      : `Le PER actuel (${fmtNumber(per.valeur ?? 0, 1)} ×) est supérieur au plus haut de ces exercices.`}
              </p>
              <p className="dv-chapo" style={{ marginBottom: 0 }}>
                Cours de la dernière séance de chaque exercice, rapporté au bénéfice par action calculé sur le nombre d’actions actuel : un changement du nombre d’actions non ajusté dans les cours fausserait les exercices anciens.
                {bande.ecartes.length > 0 &&
                  ` ${bande.ecartes.length} exercice${bande.ecartes.length > 1 ? 's' : ''} écarté${bande.ecartes.length > 1 ? 's' : ''} (${bande.ecartes.map((e) => `${e.exercice}, ${e.raison === 'perte' ? 'perte' : 'cours de fin d’exercice absent'}`).join(' ; ')}).`}
              </p>
            </>
          ) : (
            <p className="dv-vide">
              Moins de trois exercices bénéficiaires avec un cours en fin d’exercice : la bande de PER sur cinq ans n’est pas établie.
            </p>
          )}
        </Panneau>
      </Feuille>

      {/* ── Section 2 · feuilles 9 à 12 ────────────────────────────────── */}
      <OuvertureSection numero={2} titre="Le cours et sa lecture" photo={photo?.fichier ?? null} entete={entete} societe={nomComplet}
        sommaire={['La journée de détachement', 'Cours et niveaux', 'Points d’appui et de vigilance', 'Niveaux et réaction aux publications']} />
      <Feuille d={d} page={10}>
        <Panneau
          n={PANNEAU.detachement}
          titre="La journée de détachement"
          chapo="Le jour où le dividende se détache, le cours baisse mécaniquement du montant versé. Tout ce qui dépasse est un mouvement de marché, et se dit comme tel."
        >
          {d.detachement ? (
            <>
              <dl className="dv-grille">
                <Mesure
                  libelle={d.suivi.ex_date_controle === 'a_verifier' ? 'Séance de détachement enregistrée' : 'Séance de détachement'}
                  valeur={fmtDateFR(d.detachement.ex_date)}
                  note={
                    d.detachement.ex_date_officielle !== d.detachement.ex_date
                      ? `Ex-date enregistrée : ${fmtDateFR(d.detachement.ex_date_officielle)}, jour sans séance ; première séance cotée ensuite.`
                      : undefined
                  }
                />
                <Mesure libelle="Veille" valeur={`${fmtNumber(d.detachement.cours_veille)} FCFA`} />
                <Mesure libelle="Clôture du jour" valeur={`${fmtNumber(d.detachement.cours_ex)} FCFA`} />
                {/* Baisse INFÉRIEURE au dividende : « part expliquée » plafonnerait à
                    100 % et s'afficherait en vert, alors que la baisse mécanique
                    attendue n'a pas eu lieu (SNTS : −50 FCFA pour 1 750). On montre
                    alors le rapport baisse / dividende, sans couleur de verdict. */}
                {d.detachement.baisse_fcfa < d.detachement.dividende ? (
                  <Mesure
                    libelle="Baisse / dividende"
                    valeur={part(d.detachement.baisse_fcfa / d.detachement.dividende)}
                    note="Part du dividende effectivement retranchée du cours à la clôture."
                  />
                ) : (
                  <Mesure
                    libelle="Part expliquée"
                    valeur={part(d.detachement.part_expliquee)}
                    ton={
                      d.detachement.part_expliquee == null
                        ? undefined
                        : d.detachement.part_expliquee >= 0.9
                          ? 'hausse'
                          : 'baisse'
                    }
                    note="Fraction de la baisse imputable au seul détachement."
                  />
                )}
              </dl>
              {d.detachement.baisse_fcfa < d.detachement.dividende && d.detachement.recul_hors_dividende != null && (
                <div className="dv-encadre" style={{ marginTop: '3mm' }}>
                  <h3>Une baisse inférieure au dividende</h3>
                  <p style={{ margin: 0 }}>
                    {d.detachement.baisse_fcfa > 0
                      ? <>Le cours n&apos;a perdu que <strong>{fmtNumber(d.detachement.baisse_fcfa)} FCFA</strong></>
                      : <>Le cours n&apos;a pas baissé</>}{' '}
                    pour un dividende de <strong>{fmtNumber(d.detachement.dividende, 2)} FCFA</strong> : la clôture termine{' '}
                    <strong>{part(d.detachement.recul_hors_dividende, 2)}</strong> au-dessus de la référence ajustée du
                    dividende. Soit la date enregistrée n&apos;est pas la bonne, soit le marché a absorbé le détachement : les
                    données disponibles ne permettent pas de trancher.
                  </p>
                </div>
              )}
              {/* La barre suppose une baisse AU MOINS égale au dividende : dans le cas
                  inverse elle affichait « dividende détaché : 50 FCFA, baisse
                  intégralement expliquée » (SNTS), contredisant l'encadré. */}
              {d.detachement.baisse_fcfa >= d.detachement.dividende && (
                <div style={{ marginTop: '4mm' }}>
                  <BarreDetachement baisse={d.detachement.baisse_fcfa} dividende={d.detachement.dividende} />
                </div>
              )}
              {d.detachement.recul_hors_dividende != null && d.detachement.recul_hors_dividende < 0 && (
                <div className="dv-encadre dv-encadre--reserve" style={{ marginTop: '3mm' }}>
                  <h3>Au-delà du détachement</h3>
                  <p style={{ margin: 0 }}>
                    Une fois la référence ajustée du dividende, il subsiste un recul de{' '}
                    <strong>{part(Math.abs(d.detachement.recul_hors_dividende), 2)}</strong>. Ce mouvement-là n&apos;est
                    pas un ajustement technique : il vient du marché.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="dv-vide">
              Aucune date de détachement ne coïncide avec une séance cotée disponible : la décomposition ne peut pas
              être faite.
            </p>
          )}
        </Panneau>

        <Panneau
          n={PANNEAU.cours}
          titre="Cours et niveaux"
          chapo={`Clôtures réelles sur ${d.technique.serie.length} séances. Support et résistance sont les bornes du canal des 20 séances précédentes : aucun niveau n'est saisi à la main.`}
        >
          <CourbeCours serie={d.technique.serie} niveaux={lv} />
          <dl className="dv-grille" style={{ marginTop: '3mm' }}>
            <Mesure libelle="Support" valeur={lv ? `${fmtNumber(lv.support, 2)} FCFA` : null} />
            <Mesure libelle="Résistance" valeur={lv ? `${fmtNumber(lv.resistance, 2)} FCFA` : null} />
            <Mesure libelle="RSI (14)" valeur={nb(d.technique.rsi, 1)} />
            <Mesure
              libelle="MACD"
              valeur={nb(d.technique.macd_line, 2)}
              note={d.technique.macd_signal != null ? `Ligne de signal : ${fmtNumber(d.technique.macd_signal, 2)}.` : undefined}
            />
          </dl>
        </Panneau>
      </Feuille>

      {/* ── Feuille 11 · Points d'appui et de vigilance (la lecture d'ensemble est en page 3) ── */}
      <Feuille d={d} page={11}>
        <Panneau
          n={PANNEAU.appuis}
          titre="Points d'appui"
          chapo="Chaque ligne porte le chiffre qui la fonde. Une appréciation sans mesure n'en est pas une."
        >
          {n.forces.length > 0 ? (
            <ul className="dv-liste dv-liste--forces">
              {n.forces.map((a) => (
                <li key={a.texte}>
                  <span>{a.texte}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dv-vide">
              Aucun point d&apos;appui mesurable ne ressort des données disponibles. Cela ne signifie pas qu&apos;il
              n&apos;y en a pas : voir les points non établis, panneau {PANNEAU.methode}.
            </p>
          )}
        </Panneau>

        <Panneau n={PANNEAU.vigilance} titre="Points de vigilance">
          {n.risques.length > 0 ? (
            <ul className="dv-liste dv-liste--risques">
              {n.risques.map((a) => (
                <li key={a.texte}>
                  <span>{a.texte}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dv-vide">
              Aucun point de vigilance mesurable ne ressort des données disponibles. L&apos;absence de signal n&apos;est
              pas une absence de risque.
            </p>
          )}
        </Panneau>
      </Feuille>

      {/* ── Feuille 12 · Niveaux et réaction aux publications ──────────── */}
      <Feuille d={d} page={12}>
        <Panneau
          n={PANNEAU.niveaux}
          titre="Niveaux"
          chapo="Les bornes ci-dessous prolongent la géométrie du canal des 20 séances : l’amplitude est l’écart entre la résistance et le support. Ce ne sont ni des prévisions ni des cibles de cours : elles disent où le mouvement porterait s’il se prolongeait, rien de plus."
        >
          <h3 className="dv-sous-titre">{scenarios!.titre}</h3>
          <p className="dv-prose">{scenarios!.texte}</p>
          {lv ? (
            <div className="dv-tableau-cadre">
              <table className="dv-tableau dv-tableau--serre">
                <thead>
                  <tr>
                    <th scope="col">Niveau</th>
                    <th scope="col">Cours (FCFA)</th>
                    <th scope="col">Écart au dernier cours</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Borne haute + 2 amplitudes', lv.objectif2],
                    ['Borne haute + 1 amplitude', lv.objectif1],
                    ['Résistance', lv.resistance],
                    ['Dernière clôture', lv.dernier],
                    ['Support', lv.support],
                    ['Invalidation', lv.invalidation],
                  ].map(([nom, v]) => {
                    const val = v as number;
                    const ecart = lv.dernier === 0 ? null : (val - lv.dernier) / lv.dernier;
                    return (
                      <tr key={nom as string}>
                        <td>{nom as string}</td>
                        <td className="dv-num">{fmtNumber(val, 2)}</td>
                        <td className={`dv-num ${ecart == null || ecart === 0 ? '' : ecart > 0 ? 'dv-hausse' : 'dv-baisse'}`}>
                          {ecart == null ? '—' : pourcent(ecart)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dv-vide">
              Moins de 22 séances cotées disponibles : aucun canal ne peut être établi, donc aucun niveau.
            </p>
          )}
        </Panneau>

        <Panneau
          n={PANNEAU.reaction}
          titre="Comment le titre a réagi à ses publications"
          chapo="Les huit dernières publications de résultats : écart entre la variation du titre et celle du BRVM Composite sur les cinq séances qui suivent la date de publication."
        >
          {d.reactions ? (
            <>
              <div className="dv-tableau-cadre">
                <table className="dv-tableau dv-tableau--serre">
                  <thead>
                    <tr>
                      <th scope="col">Publication</th>
                      <th scope="col">Date</th>
                      <th scope="col">Écart à l’indice, 5 séances</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.reactions.lignes.map((l) => (
                      <tr key={`${l.date}${l.titre}`}>
                        <td>{libellePublication(l.periode, l.titre)}</td>
                        <td className="dv-num">{fmtDateCourte(l.date)}</td>
                        <td className={`dv-num ${l.enCours || l.ecartIndicePct == null ? 'dv-absent' : l.ecartIndicePct > 0 ? 'dv-hausse' : l.ecartIndicePct < 0 ? 'dv-baisse' : ''}`}>
                          {l.enCours ? 'en cours' : l.ecartIndicePct == null ? 'non mesurable' : `${l.ecartIndicePct >= 0 ? '+' : '−'}${fmtNumber(Math.abs(l.ecartIndicePct), 1)} pt`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="dv-prose" style={{ marginTop: '2mm' }}>
                {d.reactions.resume.mediane != null
                  ? <>Médiane des {d.reactions.resume.nMesurees} réactions mesurées : <strong>{d.reactions.resume.mediane >= 0 ? '+' : '−'}{fmtNumber(Math.abs(d.reactions.resume.mediane), 1)} pt</strong>.</>
                  : <>{d.reactions.resume.nMesurees} réaction{d.reactions.resume.nMesurees > 1 ? 's' : ''} mesurée{d.reactions.resume.nMesurees > 1 ? 's' : ''} sur ses cinq séances : il en faut au moins trois pour calculer une médiane, qui n’est donc pas donnée.</>}
                {d.reactions.resume.nNonMesurables > 0 && ' Une publication antérieure au début de l’historique de l’indice en base n’est pas mesurable.'}
              </p>
              <p className="dv-chapo" style={{ marginBottom: 0 }}>{RESERVE_REACTION}</p>
            </>
          ) : (
            <p className="dv-vide">
              Aucune publication de résultats enregistrée pour cette société, ou cours illisibles : la réaction du titre n’est pas mesurée.
            </p>
          )}
        </Panneau>
      </Feuille>

      {/* ── Section 3 · feuilles 14 à 17 ───────────────────────────────── */}
      <OuvertureSection numero={3} titre="Suivi du titre" photo={photo?.fichier ?? null} entete={entete} societe={nomComplet}
        sommaire={['Le titre en bourse', 'Dernière publication intermédiaire', 'Face aux sociétés comparables', 'Piliers et rendez-vous', 'Historique des publications, méthode et réserves']} />
      <Feuille d={d} page={14}>
        <Panneau n={PANNEAU.titre} titre="Le titre en bourse" chapo="Évolution du cours et facilité à traiter le titre, mesurées sur les séances réelles.">
          <dl className="dv-grille">
            <Mesure libelle="Sur un mois" valeur={pourcent(d.suivi.performance.var_1m)} ton={tonDe(d.suivi.performance.var_1m)} note="Vingt et une séances." />
            <Mesure libelle="Depuis le 1er janvier" valeur={pourcent(d.suivi.performance.var_ytd)} ton={tonDe(d.suivi.performance.var_ytd)} note="Base : dernière clôture de l'année précédente." />
            <Mesure
              libelle="Plage 52 semaines"
              valeur={d.suivi.performance.bas52 != null && d.suivi.performance.haut52 != null ? `${nb(d.suivi.performance.bas52)} – ${nb(d.suivi.performance.haut52)}` : null}
              note={d.suivi.performance.position_52s != null ? `Le cours se situe à ${part(d.suivi.performance.position_52s, 0)} de la plage, du plus-bas au plus-haut.` : undefined}
            />
            <Mesure
              libelle="Liquidité"
              valeur={d.suivi.liquidite?.score != null ? `${d.suivi.liquidite.score} / 100${d.suivi.liquidite.classe ? ` · ${d.suivi.liquidite.classe}` : ''}` : null}
              note={
                d.suivi.liquidite?.spread_pct != null
                  ? `Fourchette entre meilleures limites ${d.suivi.liquidite.spread_source === 'carnet' ? 'mesurée sur le carnet' : 'estimée (≈)'} : ${fmtNumber(d.suivi.liquidite.spread_pct, 2)} %.`
                  : undefined
              }
            />
            <Mesure
              libelle="Échangé par séance"
              valeur={cfa(d.suivi.liquidite?.valeur_moyenne_30j ?? null)}
              note="Moyenne sur trente jours."
            />
          </dl>
        </Panneau>

        <Panneau n={PANNEAU.intermediaire} titre="Dernière publication intermédiaire" chapo="Comparée à la même période de l’année précédente, jamais à une période d’une autre durée.">
          {d.suivi.intermediaire ? (
            <div className="dv-tableau-cadre">
              <table className="dv-tableau">
                <thead>
                  <tr>
                    <th>Poste</th>
                    <th>{d.suivi.intermediaire.libelle}</th>
                    <th>{d.suivi.intermediaire.libellePrecedent}</th>
                    <th>Variation</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['Chiffre d’affaires', d.suivi.intermediaire.revenu, d.suivi.intermediaire.revenuPrecedent],
                    ['Résultat net', d.suivi.intermediaire.resultatNet, d.suivi.intermediaire.resultatNetPrecedent],
                  ] as const).map(([poste, n0, n1]) => {
                    const v = n0 != null && n1 != null && n1 !== 0 ? (n0 - n1) / Math.abs(n1) : null;
                    return (
                      <tr key={poste}>
                        <td>{poste}</td>
                        <td className="dv-num">{cfa(n0) ?? '—'}</td>
                        <td className="dv-num">{cfa(n1) ?? '—'}</td>
                        <td className={`dv-num ${v == null ? '' : v > 0 ? 'dv-hausse' : v < 0 ? 'dv-baisse' : ''}`}>{pourcent(v) ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {d.suivi.intermediaire.glissant && (
                <p className="dv-chapo" style={{ marginTop: '2mm', marginBottom: 0 }}>
                  Sur les {d.suivi.intermediaire.glissant.libelle} : chiffre d’affaires {cfa(d.suivi.intermediaire.glissant.revenu) ?? 'non calculable'},
                  résultat net {cfa(d.suivi.intermediaire.glissant.resultatNet) ?? 'non calculable'}. Comptes intermédiaires non audités comme les comptes annuels.
                </p>
              )}
            </div>
          ) : (
            <p className="dv-vide">Aucune publication intermédiaire postérieure au dernier exercice annuel n’est en base.</p>
          )}
        </Panneau>

      </Feuille>

      {/* ── Feuille 15 · Comparables ─────────────────────────────────────── */}
      <Feuille d={d} page={15}>
        <Panneau
          n={PANNEAU.comparables}
          titre="Face aux sociétés comparables"
          chapo={d.suivi.medianes ? `Médianes du groupe : ${d.suivi.medianes.groupe}, la société elle-même exclue.` : undefined}
        >
          {d.suivi.medianes ? (
            <div className="dv-tableau-cadre">
              <table className="dv-tableau">
                <thead>
                  <tr>
                    <th>Ratio</th>
                    <th>Société</th>
                    <th>Médiane</th>
                    <th>Pairs</th>
                  </tr>
                </thead>
                <tbody>
                  {d.suivi.medianes.lignes
                    .filter((l) => ['PER', 'Cours / valeur comptable', 'ROE', 'Rendement du dividende'].includes(l.libelle))
                    .map((l) => (
                      <tr key={l.libelle}>
                        <td>{l.libelle}</td>
                        {/* La colonne « société » reprend les ratios DU DOSSIER (panneau 3) :
                            ceux du diagnostic, arrondis autrement, faisaient lire 3,21 au
                            panneau 3 et 3,22 ici pour la même valeur (SNTS). */}
                        <td className="dv-num">{fmtRatio(ratioPropre(r, l.libelle) ?? l.valeur, l.unite) ?? '—'}</td>
                        <td className="dv-num">{fmtRatio(l.mediane, l.unite) ?? '—'}</td>
                        <td className="dv-num">{l.nbPairs}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dv-vide">Aucun calcul de comparaison disponible pour cette valeur : la comparaison n’est pas faite.</p>
          )}
          <h3 className="dv-sous-titre" style={{ marginTop: '6mm' }}>Les sociétés du même secteur</h3>
          {id.secteur && (
            <p className="dv-chapo">
              Sociétés cotées du secteur « {id.secteur} », nommées une à une, avec les mêmes ratios et les mêmes unités que la médiane ci-dessus.
            </p>
          )}
          {d.suivi.comparables_nommes.length > 0 ? (
            <div className="dv-tableau-cadre">
              <table className="dv-tableau">
                <thead>
                  <tr>
                    <th scope="col">Société</th>
                    <th scope="col">PER</th>
                    <th scope="col">Cours / valeur comptable</th>
                    <th scope="col">ROE</th>
                    <th scope="col">Rendement du dividende</th>
                  </tr>
                </thead>
                <tbody>
                  {d.suivi.comparables_nommes.slice(0, 8).map((p) => {
                    const cellule = (libelle: string, unite: '%' | 'x') => {
                      const v = p.valeurs[libelle];
                      return v == null ? <span className="dv-absent">non disponible</span> : fmtRatio(v, unite);
                    };
                    return (
                      <tr key={p.code}>
                        <td>{p.designation ?? p.code} <span className="dv-absent">({p.code})</span></td>
                        <td className="dv-num">{cellule('PER', 'x')}</td>
                        <td className="dv-num">{cellule('Cours / valeur comptable', 'x')}</td>
                        <td className="dv-num">{cellule('ROE', '%')}</td>
                        <td className="dv-num">{cellule('Rendement du dividende', '%')}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td><strong>{nomComplet}</strong> <span className="dv-absent">({id.code})</span></td>
                    <td className="dv-num">{fmtRatio(ratioPropre(r, 'PER'), 'x') ?? <span className="dv-absent">non disponible</span>}</td>
                    <td className="dv-num">{fmtRatio(ratioPropre(r, 'Cours / valeur comptable'), 'x') ?? <span className="dv-absent">non disponible</span>}</td>
                    <td className="dv-num">{fmtRatio(ratioPropre(r, 'ROE'), '%') ?? <span className="dv-absent">non disponible</span>}</td>
                    <td className="dv-num">{fmtRatio(ratioPropre(r, 'Rendement du dividende'), '%') ?? <span className="dv-absent">non disponible</span>}</td>
                  </tr>
                </tbody>
              </table>
              {d.suivi.comparables_nommes.length > 8 && (
                <p className="dv-chapo" style={{ marginTop: '2mm', marginBottom: 0 }}>
                  {d.suivi.comparables_nommes.length - 8} autre{d.suivi.comparables_nommes.length - 8 > 1 ? 's' : ''} société{d.suivi.comparables_nommes.length - 8 > 1 ? 's' : ''} du secteur non affichée{d.suivi.comparables_nommes.length - 8 > 1 ? 's' : ''}, comprise{d.suivi.comparables_nommes.length - 8 > 1 ? 's' : ''} dans la médiane.
                </p>
              )}
            </div>
          ) : (
            <p className="dv-vide">
              Aucune autre société cotée du même secteur et de la même famille comptable n’a de ratios calculés : seule la médiane du groupe est donnée.
            </p>
          )}
        </Panneau>
      </Feuille>

      {/* ── Feuille 16 · Piliers et rendez-vous ─────────────────────────────
          Séparée de la 14 : les panneaux de suivi débordaient d'une A4. */}
      <Feuille d={d} page={16}>
        <Panneau
          n={PANNEAU.piliers}
          titre="Piliers de suivi"
          chapo="Six mesures et le seuil auquel on les lit. Un seuil atteint n’est pas une recommandation : c’est un repère pour suivre la valeur dans le temps."
        >
          <div className="dv-tableau-cadre">
            <table className="dv-tableau">
              <thead>
                <tr>
                  <th>Pilier</th>
                  <th>Mesure</th>
                  <th>Seuil de lecture</th>
                  <th>Constat</th>
                </tr>
              </thead>
              <tbody>
                {d.suivi.piliers.map((p) => (
                  <tr key={p.cle}>
                    <td>{p.libelle}</td>
                    <td className="dv-num">
                      {fmtPilier(p.mesure, p.unite, p.cle) ?? '—'}
                      {p.tendance ? ` ${FLECHE[p.tendance]}` : ''}
                    </td>
                    <td style={{ textAlign: 'left' }}>{p.seuil}</td>
                    <td className={p.statut === 'tenu' ? 'dv-hausse' : p.statut === 'non_tenu' ? 'dv-baisse' : 'dv-absent'}>
                      {STATUT_PILIER[p.statut]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="dv-sous-titre" style={{ marginTop: '4mm' }}>Rendez-vous connus</h3>
          {d.suivi.rendez_vous.length > 0 ? (
            <ul className="dv-liste">
              {d.suivi.rendez_vous.map((r) => (
                <li key={`${r.date}${r.libelle}`}>
                  {fmtDateFR(r.date)} — {r.libelle}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dv-vide">
              Aucun rendez-vous daté n’est annoncé en base, et aucune date n’est estimée. L’historique des publications est au {renvoi('publications')}.
            </p>
          )}
        </Panneau>
      </Feuille>
      {/* ── Feuille 17 · Historique des publications, méthode et réserves ── */}
      <Feuille d={d} page={17}>
        <Panneau
          n={PANNEAU.publications}
          titre="Historique des publications"
          chapo="Dates de publication des trois dernières années, par type de document. C’est un historique : il ne dit pas quand paraîtra la prochaine publication, et aucune date n’est estimée."
        >
          {d.historique_publications.length > 0 ? (
            <div className="dv-tableau-cadre">
              <table className="dv-tableau dv-tableau--serre">
                <thead>
                  <tr>
                    <th scope="col">Type de document</th>
                    <th scope="col">Dates, de la plus récente à la plus ancienne</th>
                  </tr>
                </thead>
                <tbody>
                  {d.historique_publications.map((h) => (
                    <tr key={h.famille.cle}>
                      <td>{h.famille.libelle}</td>
                      <td className="dv-num dv-dates">
                        {h.dates.map((x) => fmtDateCourte(x)).join(' · ')}
                        {h.total > h.dates.length ? ` · et ${h.total - h.dates.length} plus ancienne${h.total - h.dates.length > 1 ? 's' : ''}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dv-vide">Aucune publication enregistrée en base pour cette société sur les trois dernières années.</p>
          )}
        </Panneau>

        <Panneau
          n={PANNEAU.methode}
          titre="Méthode et réserves"
          chapo={`Les panneaux sont construits à partir de la base : cotations, états financiers, dividendes et signaux. Toute approximation y est nommée comme telle ; ce qui manque est déclaré ci-dessous.`}
        >
          <dl className="dv-grille">
            <Mesure
              libelle="Exercice couvert"
              valeur={c.exercice}
              note="Dernier exercice dont les états financiers sont en base."
            />
            <Mesure
              libelle="Séances analysées"
              valeur={d.technique.serie.length > 0 ? `${d.technique.serie.length}` : null}
              note="Clôtures réelles, zéros de collecte exclus."
            />
            <Mesure
              libelle="Lecture technique"
              valeur={d.technique.signal ? (VERDICT[d.technique.signal] ?? d.technique.signal) : null}
              note={
                d.technique.date_signal
                  ? `Signal du ${fmtDateFR(d.technique.date_signal)}. ${zoneRsi(d.technique.rsi) ?? ''} Mesure de tendance, pas une recommandation.`.replace('  ', ' ')
                  : "Aucun signal calculé pour cette valeur."
              }
            />
            <Mesure
              libelle="Points non établis"
              valeur={`${d.lacunes.length}`}
              note="Détaillés ci-dessous. Une mesure sans donnée est en outre marquée « non disponible » dans son panneau."
            />
          </dl>

          <div className="dv-encadre dv-encadre--reserve" style={{ marginTop: '4mm' }}>
            <h3>Ce que ce dossier ne dit pas</h3>
            {d.lacunes.length > 0 ? (
              <ul>
                {d.lacunes.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0 }}>
                Toutes les données attendues sont présentes pour cette valeur. Les limites générales de la méthode
                restent valables : la BRVM ne publie que la meilleure limite de chaque côté du carnet d&apos;ordres,
                pas sa profondeur complète, et les comptes intermédiaires ne sont pas audités comme les comptes
                annuels.
              </p>
            )}
          </div>

          <p className="dv-chapo" style={{ marginTop: '4mm', marginBottom: 0 }}>
            Établi le {fmtDateFR(d.genere_le)} à partir des données Westbourse. Document d&apos;information : il ne
            constitue ni un conseil en investissement, ni une incitation à intervenir sur le titre, et ne tient
            compte ni de votre situation ni de vos objectifs.
          </p>
        </Panneau>
      </Feuille>
    </div>
  );
}

function tonDe(v: number | null | undefined): 'hausse' | 'baisse' | undefined {
  return v == null || Math.abs(v) < 0.00005 ? undefined : v > 0 ? 'hausse' : 'baisse';
}

/** Ratio de la société tel que calculé par le dossier, à l'échelle des lignes de comparables (`%` × 100). */
function ratioPropre(r: DossierValeur['ratios'], libelle: string): number | null {
  if (!r) return null;
  const cent = (v: number | null) => (v == null ? null : v * 100);
  switch (libelle) {
    case 'PER': return r.per;
    case 'Cours / valeur comptable': return r.pb;
    case 'ROE': return cent(r.roe);
    case 'Rendement du dividende': return cent(r.rendementDiv);
    default: return null;
  }
}

/** Valeur d'une ligne de comparables : `%` déjà multiplié par 100 par medianes.ts. */
function fmtRatio(v: number | null, unite: '%' | 'x'): string | null {
  if (v == null) return null;
  return unite === '%' ? `${fmtNumber(v, 1)} %` : `${fmtNumber(v, 2)} ×`;
}

function fmtPilier(v: number | null, unite: '%' | 'x' | 'FCFA', cle: string): string | null {
  if (v == null) return null;
  if (unite === 'FCFA') return `${fmtNumber(v, 2)} FCFA`;
  if (unite === 'x') return `${fmtNumber(v, 2)} ×`;
  return cle === 'croissance' ? pourcent(v) : part(v);
}
