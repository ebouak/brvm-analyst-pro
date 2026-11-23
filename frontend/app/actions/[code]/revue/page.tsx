import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRevue, type YearRow } from '@/lib/reports/server';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { createClient } from '@/lib/supabase/server';
import { chargerIntermediaire } from '@/lib/financials/interimServer';
import { documentsFiche } from '@/components/sousPage/SousPageNav';
import { fmtFcfa, fmtNumber, fmtDateCourte } from '@/lib/format';
import { perAffichable, distributionAffichable, evolutionResultat, dividendeCourant } from '@/lib/fiche/affichage';
import { phraseDetachement } from '@/lib/reports/detachementRevue';
import { constatSerie } from '@/lib/document/constats';
import { photoActivite } from '@/lib/document/activite';
import { planActivite, LIGNES_FACULTATIVES } from '@/lib/revue/gabarit';
import { periodePrincipale, constatPeriode, chiffreGeantPeriode, lignesComparaison, variationPct, VOCABULAIRE, avecArticle, deAvecArticle } from '@/lib/revue/periode';
import { periodeDuRapport, rapportAnterieur } from '@/lib/revue/rapportActivite';
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';
import { chargerPeriodesBancaires } from '@/lib/bank/chargerLecture';
import { lireBanque, lirePeriode } from '@/lib/bank/lecture';
import { montantLigne } from '@/lib/bank/format';
import { CompteResultatBancaire, EncoursBancaire } from '@/components/bank/LectureRevue';
import { phraseMiseAJour } from '@/lib/revue/miseAJour';
import { chargerDerniereMiseAJour } from '@/lib/revue/chargerMiseAJour';
import { nomPays } from '@/lib/crm/geo';
import { CouverturePhoto, Feuille, Panneau, ChiffreGeant, Mesures, GraphiqueBarres } from '@/components/document/Document';
import { CourbeCours } from '@/components/dossier/Graphiques';
import brvmLogos from '@/lib/brvmLogos.json';
import ImprimerRevue from './ImprimerRevue';
import '@/components/document/document.css';
import './revue.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revue de résultats' };

interface Props { params: Promise<{ code: string }> }

/**
 * Revue de résultats — quatre feuilles A4, même système de document que le Dossier.
 * Une banque dont la période est extraite (lib/bank/lecture.ts) en a cinq : le
 * compte de résultat bancaire et les encours ont chacun leur feuille.
 *
 * Elle s'ouvre sur la DERNIÈRE période publiée (trimestre, semestre ou exercice)
 * comparée à la même période de l'année précédente ; l'exercice annuel vient en
 * second. Chaque chiffre est lu en base ou calculé par une fonction pure testée
 * (`lib/revue/`) ; aucune phrase n'est rédigée par un modèle.
 */

const LOGOS = brvmLogos as Record<string, string>;

const moins = (s: string) => s.replace('-', '−'); // U+2212, comme le reste du site
const md = (n: number | null | undefined) => (n == null ? null : moins(fmtFcfa(n)));
const fcfa = (n: number | null | undefined) => (n == null ? null : moins(`${fmtNumber(Math.round(n), 0)} FCFA`));
const bpaTxt = (n: number | null | undefined) => (n == null ? null : moins(`${fmtNumber(n, 2)} FCFA`));
const pctSigne = (v: number | null) => (v == null ? null : `${v >= 0 ? '+' : '−'}${fmtNumber(Math.abs(v), 1)} %`);
const ton = (v: number | null) => (v == null ? undefined : v > 0 ? 'hausse' : v < 0 ? 'baisse' : undefined);
const EN_MOTS = new Set(["Résultat d'exploitation", 'Résultat avant impôt', 'Résultat net', 'BPA']);

function Absent() {
  return <span className="doc-absent">non disponible</span>;
}

export default async function RevuePage(props: Props) {
  const params = await props.params;
  const code = decodeURIComponent(params.code).toUpperCase();
  const d = await getRevue(code).catch(() => null);
  if (!d) notFound();
  // Après le 404 : un code inconnu doit rester une 404, pas un écran d'offre en 200.
  const gate = await canAccess('revues_resultats');
  if (!gate.allowed) {
    return (
      <AccessGate
        required={gate.required === 'free' ? 'premium' : gate.required}
        feature="Les Revues de résultats"
        hint="Les derniers comptes de chaque société lus pour vous : activité, résultat, dividende et ratios, comparés à la même période de l'année précédente."
      />
    );
  }

  const sb = createClient();
  const { latest, prev, profil } = d;
  const banque = FAMILLE_PAR_CODE[d.code] === 'banque';
  const [inter, evtResultats, periodesBanque] = await Promise.all([
    chargerIntermediaire(sb, d.code, d.years.map((y) => ({ year: Number(y.periode), revenue: y.revenu, net_income: y.resultatNet }))),
    chargerDerniereMiseAJour(sb, d.code),
    banque ? chargerPeriodesBancaires(sb, d.code) : Promise.resolve([]),
  ]);
  const principale = periodePrincipale(d.years.map((y) => ({ periode: y.periode, revenu: y.revenu, resultatNet: y.resultatNet })), inter);
  const voc = banque ? VOCABULAIRE.banque : VOCABULAIRE.general;
  const visee = principale ? lirePeriode(principale.periode) : null;
  const lectureBrute = banque && visee ? lireBanque(periodesBanque, visee) : null;
  // Période non encore extraite : ancien affichage, vocabulaire bancaire.
  const lecture = lectureBrute?.extrait ? lectureBrute : null;
  const lPnb = lecture?.compteResultat.find((l) => l.cle === 'pnb') ?? null;
  const lRn = lecture?.compteResultat.find((l) => l.cle === 'resultat_net') ?? null;
  const TOTAL = lecture ? 5 : 4;
  const p = (n: number) => (lecture && n >= 3 ? n + 1 : n); // numéro de feuille
  const miseAJour = phraseMiseAJour(evtResultats);

  const nom = d.designation;
  const photo = photoActivite(d.code, d.secteur || null);
  const entete = `Revue de résultats · ${fmtDateCourte(d.generatedAt)}`;

  // Ratios et dividende (mêmes règles que la fiche et le Dossier).
  const divCourant = dividendeCourant(
    [...d.dividends].filter((x) => x.exercice > 0).reverse().map((x) => ({ montant: x.montant, exercice: x.exercice, ex_date: null, payment_date: null })),
    latest ? Number(latest.periode) : null,
  );
  const rendementDiv = divCourant && d.price?.cours ? (divCourant.montant / d.price.cours) * 100 : null;
  const payoutCalc = divCourant && latest?.bpa && latest.bpa > 0 && divCourant.exercice === Number(latest.periode)
    ? (divCourant.montant / latest.bpa) * 100 : null;
  const distribution = distributionAffichable(payoutCalc, latest?.resultatNet ?? null);
  const per = perAffichable(d.ratios.per, latest?.bpa ?? (latest?.resultatNet != null && latest.resultatNet <= 0 ? latest.resultatNet : null));

  // Exercice annuel : tableau détaillé.
  const ligne = (libelle: string, fn: (y: YearRow) => number | null) => ({
    libelle, cur: latest ? fn(latest) : null, prv: prev ? fn(prev) : null,
  });
  const lignesAnnuel = [
    ligne(voc.revenu, (y) => y.revenu),
    ligne("Résultat d'exploitation", (y) => y.resultatExploitation),
    ligne('Résultat avant impôt', (y) => y.resultatAvantImpot),
    ligne('Résultat net', (y) => y.resultatNet),
    ligne('Capitaux propres', (y) => y.capitauxPropres),
    ligne('Total actif', (y) => y.totalActif),
    ligne('BPA', (y) => y.bpa),
  ];
  const anciens = [...d.years].reverse(); // du plus ancien au plus récent
  const titreAnnuel = (() => {
    const c = constatSerie('Résultat net', anciens.map((y) => ({ exercice: y.periode, valeur: y.resultatNet })));
    return c === 'Résultat net' ? (latest ? `Exercice ${latest.periode}` : 'Exercice annuel') : c;
  })();
  const comptesEnRetard = !!latest && Number(latest.periode) < new Date(d.generatedAt).getFullYear() - 2;

  // Rapport d'activité antérieur aux comptes : il passe en fin de document.
  const hl = d.highlights && (d.highlights.synthese || d.highlights.items.length > 0) ? d.highlights : null;
  // Période du rapport lue dans son libellé source (« 1er semestre 2025 »,
  // « Exercice 2024 »), comparée à la période que la Revue présente EN PREMIER.
  // Avant : seul « exercice AAAA » était lu, comparé au seul annuel — un rapport
  // du 1er semestre 2025 passait pour actuel dans une revue du 1er semestre 2026.
  const periodeHl = hl ? periodeDuRapport(hl.source_libelle) : null;
  const periodeRevue = principale?.periode ?? latest?.periode ?? null;
  const libelleRevue = principale?.libelle ?? (latest ? `exercice ${latest.periode}` : null);
  const hlAncien = rapportAnterieur(periodeHl, periodeRevue);
  const plan = hl ? planActivite(hl.synthese, hl.items) : null;
  const activite = hl && plan && (
    <div className="rv-activite">
      <h3 style={{ margin: '8mm 0 0', fontSize: '11pt' }}>
        {hlAncien && periodeHl ? `Activité : dernier rapport disponible (${periodeHl.libelle})` : 'Activité : ce qui se passe dans l’entreprise'}
      </h3>
      {hlAncien && periodeHl && libelleRevue && (
        <p className="doc-note">Ce rapport porte sur {avecArticle(periodeHl.libelle)}, antérieur aux comptes {deAvecArticle(libelleRevue)} présentés dans cette revue : aucun rapport d’activité plus récent n’est disponible.</p>
      )}
      {plan.synthese && <p>{plan.synthese}</p>}
      <ul>
        {plan.items.map((it, i) => (
          <li key={i}><b>{it.titre}</b>{it.titre && it.detail ? ' : ' : ''}{it.detail}</li>
        ))}
      </ul>
      {plan.omis > 0 && <p className="doc-note">Extrait : le rapport d’activité complet est disponible à la source.</p>}
      {hl.source_libelle && (
        <p className="doc-note">
          Source : {hl.source_url
            ? <a href={hl.source_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{hl.source_libelle}</a>
            : hl.source_libelle} (document publié à la BRVM).
        </p>
      )}
    </div>
  );

  const geant = principale ? chiffreGeantPeriode(principale, voc) : null;

  return (
    <div className="doc">
      <nav className="doc-actions rv-actions" aria-label="Documents de la fiche">
        <Link href={`/actions/${d.code}`}>‹ Retour à la fiche {d.code}</Link>
        <span className="rv-liens">
          {documentsFiche(d.code).filter((x) => !x.href.endsWith('/revue')).map((x) => <Link key={x.href} href={x.href}>{x.label}</Link>)}
        </span>
        <ImprimerRevue />
      </nav>

      {/* ── Feuille 1 · Couverture ───────────────────────────────────────── */}
      <CouverturePhoto
        entete={entete} societe={nom} code={d.code} logo={LOGOS[d.code] ?? null} photo={photo}
        surtitre={['Revue de résultats', d.secteur, d.pays ? nomPays(d.pays) : null].filter(Boolean).join(' · ')}
        constat={lecture ? lecture.titre : principale ? constatPeriode(principale, voc) : 'Aucun compte publié n’est disponible pour cette valeur.'}
        total={TOTAL}
        chiffres={[
          lecture
            ? lPnb ? { libelle: 'Produit net bancaire', valeur: montantLigne(lPnb.valeur.valeur, lPnb.unite), note: lecture.libelle } : null
            : principale?.revenu != null ? { libelle: voc.revenu, valeur: `${md(principale.revenu)} FCFA`, note: principale.libelle } : null,
          lecture
            ? lRn ? { libelle: 'Résultat net', valeur: montantLigne(lRn.valeur.valeur, lRn.unite), note: lecture.libelle } : null
            : principale?.resultatNet != null ? { libelle: 'Résultat net', valeur: `${md(principale.resultatNet)} FCFA`, note: principale.libelle } : null,
          d.price?.cours != null ? { libelle: 'Cours', valeur: fcfa(d.price.cours)!, note: d.price.date ? `au ${fmtDateCourte(d.price.date)}` : null } : null,
        ].filter((x): x is NonNullable<typeof x> => x != null)}
      />

      {/* ── Feuille 2 · Dernière période publiée ─────────────────────────── */}
      <Feuille entete={entete} societe={nom} page={2} total={TOTAL}>
        {lecture ? (
          <Panneau titre={lecture.titre}>
            <CompteResultatBancaire lecture={lecture} />
            {miseAJour && <p className="rv-maj">{miseAJour}</p>}
          </Panneau>
        ) : principale && geant ? (
          <>
            <Panneau titre={geant.titre}>
              <ChiffreGeant valeur={geant.valeur} unite={geant.unite} legende={geant.legende} />
              <table className="rv-table">
                <thead>
                  <tr>
                    <th scope="col">En FCFA</th>
                    <th scope="col">{principale.libelle}</th>
                    <th scope="col">{principale.libellePrecedent ?? 'Période précédente'}</th>
                    <th scope="col">Évolution</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesComparaison(principale, voc).map((l) => (
                    <tr key={l.libelle}>
                      <td>{l.libelle}</td>
                      <td className="fort">{md(l.courant) ?? '—'}</td>
                      <td>{md(l.precedent) ?? '—'}</td>
                      <td className={ton(l.evolution)}>{pctSigne(l.evolution) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {principale.type === 'intermediaire' && (
                <p className="doc-note">Chiffres cumulés depuis le début de l’exercice, comparés au même cumul de l’année précédente.</p>
              )}
              {!principale.comparable && principale.motif && <p className="rv-alerte">{principale.motif}</p>}
              {principale.glissant && (
                <Mesures items={[
                  { libelle: `${voc.revenu}, ${principale.glissant.libelle}`, valeur: md(principale.glissant.revenu) ? `${md(principale.glissant.revenu)} FCFA` : null },
                  { libelle: `Résultat net, ${principale.glissant.libelle}`, valeur: md(principale.glissant.resultatNet) ? `${md(principale.glissant.resultatNet)} FCFA` : null },
                ]} />
              )}
              {miseAJour && <p className="rv-maj">{miseAJour}</p>}
              <p className="doc-note">Source : états financiers publiés (extraction WESTBOURSE). Aucune période n’est annualisée ni estimée.</p>
            </Panneau>
          </>
        ) : (
          <p className="rv-vide">Aucun compte publié n’est disponible en base pour cette valeur : la revue ne peut pas être établie.</p>
        )}
      </Feuille>

      {/* ── Feuille 3 (banque extraite) · Encours et solidité ────────────── */}
      {lecture && (
        <Feuille entete={entete} societe={nom} page={3} total={TOTAL}>
          <Panneau titre={`Encours et solidité, ${lecture.libelle}`}>
            <EncoursBancaire lecture={lecture} />
          </Panneau>
        </Feuille>
      )}

      {/* ── Feuille · Exercice annuel ─────────────────────────────────────── */}
      <Feuille entete={entete} societe={nom} page={p(3)} total={TOTAL}>
        {latest ? (
          <Panneau titre={titreAnnuel}>
            <table className="rv-table">
              <thead>
                <tr>
                  <th scope="col">Exercice annuel, en FCFA</th>
                  <th scope="col">{latest.periode}</th>
                  <th scope="col">{prev?.periode ?? 'Précédent'}</th>
                  <th scope="col">Évolution</th>
                </tr>
              </thead>
              <tbody>
                {lignesAnnuel.filter((r) => !(hl && !hlAncien && LIGNES_FACULTATIVES.has(r.libelle))).map((r) => {
                  const bpa = r.libelle === 'BPA';
                  const evo = EN_MOTS.has(r.libelle) ? evolutionResultat(r.cur, r.prv) : pctSigne(variationPct(r.cur, r.prv));
                  return (
                    <tr key={r.libelle}>
                      <td>{r.libelle}</td>
                      <td className="fort">{(bpa ? bpaTxt(r.cur) : md(r.cur)) ?? '—'}</td>
                      <td>{(bpa ? bpaTxt(r.prv) : md(r.prv)) ?? '—'}</td>
                      <td>{evo ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {comptesEnRetard && (
              <p className="rv-alerte">
                Derniers comptes disponibles : exercice {latest.periode}. Aucun compte plus récent ne figure dans les publications officielles
                de la société ; le PER rapporte donc le cours du jour à un bénéfice de {latest.periode}.
              </p>
            )}
            {d.years.length >= 2 && (
              <div className="doc-duo">
                <div>
                  <h3>{voc.revenu}</h3>
                  <GraphiqueBarres
                    titre={`${voc.revenu} par exercice`} largeur={300} hauteur={200}
                    points={anciens.map((y) => ({ libelle: y.periode, valeur: y.revenu }))}
                    format={(v) => fmtFcfa(v)}
                  />
                </div>
                <div>
                  <h3>Résultat net</h3>
                  <GraphiqueBarres
                    titre="Résultat net par exercice" largeur={300} hauteur={200}
                    points={anciens.map((y) => ({ libelle: y.periode, valeur: y.resultatNet }))}
                    format={(v) => fmtFcfa(v)}
                  />
                </div>
              </div>
            )}
            <p className="doc-note">
              {Math.min(d.years.length, 5)} derniers exercices annuels{profil.cyclique ? ' · activité cyclique : lire la tendance sur plusieurs exercices plutôt que sur un seul' : ''}.
              Une barre « n.d. » signale un exercice absent ou non positif. Source : états financiers publiés.
            </p>
            {!hlAncien && activite}
          </Panneau>
        ) : (
          <p className="rv-vide">Aucun exercice annuel disponible en base pour cette valeur.</p>
        )}
      </Feuille>

      {/* ── Feuille 4 · Dividende, cours et passage au Dossier ───────────── */}
      <Feuille entete={entete} societe={nom} page={p(4)} total={TOTAL}>
        <Panneau titre={rendementDiv != null && divCourant ? `Dividende de ${fcfa(divCourant.montant)} par action, rendement de ${fmtNumber(rendementDiv, 2)} %` : 'Dividende et cours'}>
          <Mesures items={[
            { libelle: 'Cours', valeur: fcfa(d.price?.cours), note: d.price?.date ? `au ${fmtDateCourte(d.price.date)}` : null },
            { libelle: 'Capitalisation', valeur: d.price?.mcap != null ? `${md(d.price.mcap)} FCFA` : null },
            { libelle: 'PER', valeur: per.valeur != null ? `${fmtNumber(per.valeur, 1)} ×` : null, note: per.valeur == null ? per.motif : latest?.bpa != null ? `BPA ${bpaTxt(latest.bpa)}` : null },
            { libelle: 'Taux de distribution', valeur: distribution.valeur != null ? `${fmtNumber(distribution.valeur, 0)} %` : null, note: distribution.valeur == null ? distribution.motif : null },
          ]} />
          <p style={{ margin: '6mm 0 0', maxWidth: '70ch' }}>
            {divCourant
              ? `Dernier versement connu : ${fcfa(divCourant.montant)} par action, au titre de l’exercice ${divCourant.exercice}${divCourant.ancien ? `, soit plus d’un exercice avant le dernier exercice publié (${latest?.periode}) : ce dividende n’est pas un point d’appui pour l’avenir` : ''}. Rendement au cours actuel : ${rendementDiv != null ? `${fmtNumber(rendementDiv, 2)} %` : '—'}.`
              : 'Aucun dividende récent enregistré pour cette valeur.'}
            {d.detachement ? ` ${phraseDetachement(d.detachement)}` : ''}
          </p>
          {d.priceSeries.length >= 2 ? (
            <div style={{ marginTop: '6mm' }}>
              <CourbeCours serie={d.priceSeries.map((p) => ({ date: p.date, cours: p.cours, volume: null }))} niveaux={null} />
              <p className="doc-note">Cours de clôture sur la période disponible. Source : brvm.org (via WESTBOURSE).</p>
            </div>
          ) : (
            <p className="rv-vide">Moins de deux clôtures connues : la courbe ne peut pas être tracée.</p>
          )}
          {hlAncien && activite}
        </Panneau>

        <aside className="rv-dossier" aria-label="Aller plus loin">
          <h3>Le Dossier valeur prolonge cette revue</h3>
          <p>
            Cette revue lit les derniers comptes de {nom}. Le Dossier valeur les situe : valorisation, dividende, niveaux de cours et points
            de vigilance, en un document A4 mis à jour chaque semaine. Il est réservé aux abonnés Premium.
          </p>
          <Link href={`/rapports/dossier/${d.code}`}>Ouvrir le Dossier valeur de {d.code}</Link>
        </aside>
      </Feuille>
    </div>
  );
}
