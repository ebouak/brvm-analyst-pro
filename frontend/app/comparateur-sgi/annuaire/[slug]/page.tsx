import type { Metadata } from 'next';
import { fmtDateCourte } from '@/lib/format';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ExternalLink, Building2, FileText, Globe, Mail, MapPin, Phone, Scale } from 'lucide-react';
import { CadreComparateur } from '@/components/comparateur-sgi/cadre/Cadre';
import { chargerSgi } from '@/lib/sgi-frais/chargement';
import { PAYS } from '@/lib/sgi-frais/directory';
import { drapeau, slugSgi } from '@/lib/sgi-frais/identite';
import { CONFIANCE_BADGE_CLASS, CONFIANCE_LABEL, lienDecision, type Palier, type SgiFrais } from '@/lib/sgi-frais/types';
import { baremeComplet, calculerCoutSGI, montantParOrdreParDefaut } from '@/lib/sgi-frais/calculateur';
import { SCENARIO_DEFAUT } from '@/lib/sgi-frais/scenario';
import { fmtFcfa } from '@/lib/sgi-frais/comparaison';

// Pas de `loading.tsx` au-dessus : un slug inconnu doit répondre 404, pas 200.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';
const NR = 'Non renseigné';
const FREQ: Record<string, string> = { annuel: 'par an', trimestriel: 'par trimestre', semestriel: 'par semestre' };
const POSTES: Record<string, string> = {
  courtage: 'courtage',
  droits_garde: 'droits de garde',
  tenue_compte: 'tenue de compte',
  frais_virement: 'frais de virement',
};

const pct = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} %`;
const fourchette = (min: number | null, max: number | null) =>
  min == null && max == null ? null : min != null && max != null && min !== max ? `${pct(min)} à ${pct(max)}` : pct((max ?? min)!);
/** Lien d’appel : un indicatif « (226) » ou « +226 » devient international. */
const lienTel = (t: string) => `tel:${/^[(+]/.test(t) ? '+' : ''}${t.replace(/\D/g, '')}`;
const dateFr = (d?: string | null) => (d ? fmtDateCourte(d) : null);

async function trouver(slug: string) {
  const { directory, frais, stats } = await chargerSgi();
  const sgi = directory.find((s) => slugSgi(s) === slug);
  if (!sgi) return null;
  return { sgi, frais: frais.find((f) => f.sgiNom === sgi.nom) ?? null, stats };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await trouver(params.slug);
  if (!r) return { title: 'SGI introuvable' };
  const { sgi, frais } = r;
  const courtage = frais ? fourchette(frais.courtagePctMin, frais.courtagePctMax) : null;
  const pays = PAYS[sgi.pays]?.nom ?? '';
  return {
    title: `${sgi.nom} — frais, barème et coordonnées (SGI BRVM)`,
    description: `${sgi.nom}, SGI agréée${pays ? ` (${pays})` : ''} : ${
      courtage ? `courtage ${courtage}, ` : ''
    }droits de garde, tenue de compte, barème officiel et coordonnées.`,
    alternates: { canonical: `${SITE_URL}/comparateur-sgi/annuaire/${slugSgi(sgi)}` },
  };
}

/* ── Briques ────────────────────────────────────────────────────────────── */

function Panneau({ titre, children, id }: { titre: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="rounded-panel border border-border bg-surface p-5 md:p-6">
      <h2 id={id} className="mb-4 font-display text-lg text-ivory">
        {titre}
      </h2>
      {children}
    </section>
  );
}

function Ligne({ libelle, valeur, aide }: { libelle: string; valeur: string | null; aide?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-2.5 last:border-0">
      <dt className="text-[13px] text-muted">
        {libelle}
        {aide && <span className="block text-[11px] text-faint">{aide}</span>}
      </dt>
      <dd className={`tabular text-right text-sm ${valeur ? 'text-ivory' : 'text-faint'}`}>{valeur ?? NR}</dd>
    </div>
  );
}

/** Barème par tranche : le taux d'une tranche s'applique au montant entier. */
function TablePaliers({ paliers, base }: { paliers: Palier[]; base: string }) {
  return (
    <table className="mt-1 w-full text-sm">
      <caption className="sr-only">Taux par tranche de {base}</caption>
      <thead>
        <tr className="text-[11px] text-faint">
          <th scope="col" className="pb-1.5 text-left font-medium">
            Tranche ({base})
          </th>
          <th scope="col" className="pb-1.5 text-right font-medium">
            Taux
          </th>
        </tr>
      </thead>
      <tbody>
        {paliers.map((p, i) => {
          const avant = paliers[i - 1]?.jusqua ?? null;
          const lib =
            p.jusqua == null
              ? `Au-delà de ${fmtFcfa(avant ?? 0)}`
              : avant == null
                ? `Jusqu’à ${fmtFcfa(p.jusqua)}`
                : `De ${fmtFcfa(avant)} à ${fmtFcfa(p.jusqua)}`;
          return (
            <tr key={i} className="border-t border-border/50">
              <td className="tabular py-2 text-muted">{lib}</td>
              <td className="tabular py-2 text-right text-ivory">{pct(p.pct)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Conditions({ f }: { f: SgiFrais }) {
  const garde = f.gardePaliers?.length ? null : fourchette(f.droitsGardePctMin, f.droitsGardePctMax);
  const freqGarde = FREQ[f.droitsGardeFrequence ?? 'annuel'];
  return (
    <>
      <h3 className="text-[13px] font-semibold text-ivory">Courtage</h3>
      {f.courtagePaliers?.length ? (
        <TablePaliers paliers={f.courtagePaliers} base="montant de l’ordre" />
      ) : (
        <dl>
          <Ligne libelle="Taux sur chaque ordre" valeur={fourchette(f.courtagePctMin, f.courtagePctMax)} aide="Le comparateur retient le taux maximal" />
        </dl>
      )}
      <dl>
        <Ligne libelle="Minimum de perception" valeur={f.minimumPerception != null ? `${fmtFcfa(f.minimumPerception)} par ordre` : null} />
      </dl>

      <h3 className="mt-5 text-[13px] font-semibold text-ivory">Droits de garde</h3>
      {f.gardePaliers?.length ? (
        <TablePaliers paliers={f.gardePaliers} base={`valeur du portefeuille, ${freqGarde}`} />
      ) : (
        <dl>
          <Ligne libelle={`Taux ${freqGarde}`} valeur={garde} aide="Sur la valeur du portefeuille" />
        </dl>
      )}
      <dl>
        <Ligne libelle="Minimum" valeur={f.droitsGardeMinimum != null ? `${fmtFcfa(f.droitsGardeMinimum)} ${freqGarde}` : null} />
      </dl>

      <h3 className="mt-5 text-[13px] font-semibold text-ivory">Compte</h3>
      <dl>
        <Ligne
          libelle="Tenue de compte"
          valeur={
            f.tenueCompteMontant == null
              ? null
              : f.tenueCompteMontant === 0
                ? 'Aucune au barème'
                : `${fmtFcfa(f.tenueCompteMontant)} ${FREQ[f.tenueCompteFrequence ?? 'annuel']}`
          }
        />
        <Ligne libelle="Frais de virement" valeur={f.fraisVirement != null ? fmtFcfa(f.fraisVirement) : null} />
        <Ligne libelle="Dépôt minimum relevé" valeur={f.depotMinimum ? fmtFcfa(f.depotMinimum) : null} aide="À confirmer auprès de la SGI" />
        <Ligne libelle="Gestion sous mandat" valeur={fourchette(f.gestionSousMandatPctMin, f.gestionSousMandatPctMax)} aide="Par an, sur les actifs gérés" />
      </dl>
    </>
  );
}

function CoutEstime({ f, slug }: { f: SgiFrais; slug: string }) {
  const s = SCENARIO_DEFAUT;
  const ordre = montantParOrdreParDefaut(s.montant, s.nbAchats);
  const r = calculerCoutSGI(f, { montant: s.montant, montantParOrdre: ordre, nbOrdres: s.nbAchats + s.nbVentes, dureeAns: s.dureeAns });
  const complet = baremeComplet(r);
  const manquants = r.champsManquants.map((c) => POSTES[c] ?? c);
  return (
    <>
      <p className="mb-3 text-[13px] leading-relaxed text-muted">
        Pour {fmtFcfa(s.montant)} investis sur un an, avec {s.nbAchats} achats et {s.nbVentes} ventes de {fmtFcfa(ordre)} chacun.
      </p>
      <dl>
        <Ligne libelle="Courtage" valeur={fmtFcfa(r.coutCourtage)} />
        <Ligne libelle="Frais BRVM et DC/BR (0,3 %)" valeur={fmtFcfa(r.coutReglementaire)} />
        <Ligne libelle="Droits de garde" valeur={fmtFcfa(r.coutGarde)} />
        <Ligne libelle="Tenue de compte" valeur={fmtFcfa(r.coutTenue)} />
        {r.coutVirement > 0 && <Ligne libelle="Virements" valeur={fmtFcfa(r.coutVirement)} />}
      </dl>
      <div className="mt-3 flex items-baseline justify-between gap-4 rounded-xl bg-nuit px-4 py-3 text-sur-nuit">
        <span className="text-[13px]">Coût total estimé (HT)</span>
        <span className="tabular font-display text-xl font-bold">{fmtFcfa(r.total)}</span>
      </div>
      {manquants.length > 0 && (
        <p className={`mt-2 text-[12px] leading-relaxed ${complet ? 'text-faint' : 'text-warn'}`}>
          {complet ? 'Non chiffré, faute de donnée' : 'Barème incomplet, coût sous-estimé'} : {manquants.join(', ')}.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/comparateur-sgi/comparer?sgi=${slug}`}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-bg transition-transform hover:brightness-110 active:scale-95"
        >
          <Scale size={15} aria-hidden /> Comparer avec d’autres SGI
        </Link>
        <Link
          href="/comparateur-sgi/simuler"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ivory transition-colors hover:border-accent/40 hover:text-accent"
        >
          Changer de scénario <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default async function FicheSgiPage({ params }: { params: { slug: string } }) {
  const r = await trouver(params.slug);
  if (!r) notFound();
  const { sgi, frais, stats } = r;
  const slug = slugSgi(sgi);
  const pays = PAYS[sgi.pays];
  const pdf = lienDecision(frais);
  const bourseEnLigne = frais?.notes?.toLowerCase().includes('bourse en ligne') ?? false;
  const telephones = sgi.telephone?.split('/').map((t) => t.trim()).filter(Boolean) ?? [];

  return (
    <CadreComparateur
      nbSgi={stats.sgi}
      entete={{
        titre: sgi.nom,
        sousTitre: `Société de gestion et d’intermédiation agréée${pays ? `, siège : ${pays.nom}` : ''}. Barème, coût estimé et coordonnées officielles.`,
        icone: Building2,
        filAriane: true,
      }}
    >
      <Link href="/comparateur-sgi/annuaire" className="mb-5 inline-flex min-h-[36px] items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent-ink">
        <ArrowLeft size={15} aria-hidden /> Retour à l’annuaire
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          {frais ? (
            <>
              <Panneau titre="Conditions tarifaires" id="titre-conditions">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CONFIANCE_BADGE_CLASS[frais.confiance]}`}>
                    {CONFIANCE_LABEL[frais.confiance]}
                  </span>
                  {bourseEnLigne && (
                    <span className="inline-block rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">Bourse en ligne au barème</span>
                  )}
                </div>
                <Conditions f={frais} />
                <p className="mt-4 text-[11px] leading-relaxed text-faint">Montants hors taxes, tels que publiés au barème de la SGI.</p>
              </Panneau>
              {frais.notes && (
                <Panneau titre="Autres frais au barème" id="titre-notes">
                  <p className="text-[13.5px] leading-relaxed text-muted">{frais.notes}</p>
                  <p className="mt-3 text-[11px] text-faint">Résumé du barème, lu dans la source citée ci-contre.</p>
                </Panneau>
              )}
            </>
          ) : (
            <Panneau titre="Conditions tarifaires" id="titre-conditions">
              <p className="text-sm leading-relaxed text-muted">
                Aucun barème de cette SGI n’est encore référencé. Nous n’affichons pas de frais estimés sans source : demandez sa grille tarifaire homologuée avant
                d’ouvrir un compte.
              </p>
            </Panneau>
          )}
        </div>

        <aside className="space-y-6">
          {frais && (
            <Panneau titre="Coût estimé" id="titre-cout">
              <CoutEstime f={frais} slug={slug} />
            </Panneau>
          )}

          <Panneau titre="Identité" id="titre-identite">
            <dl>
              <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-2.5">
                <dt className="text-[13px] text-muted">Pays du siège</dt>
                <dd className="flex items-center gap-2 text-sm text-ivory">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={drapeau(sgi.pays)} alt="" width={18} height={12} className="h-3 w-[18px] rounded-[2px]" />
                  {pays?.nom ?? NR}
                </dd>
              </div>
              <Ligne libelle="Type" valeur={sgi.type === 'Non déterminé' ? null : sgi.type} />
              <Ligne libelle="Groupe" valeur={sgi.groupe && sgi.groupe !== NR ? sgi.groupe : null} />
            </dl>
          </Panneau>

          <Panneau titre="Coordonnées" id="titre-coordonnees">
            <ul className="space-y-3 text-[13.5px]">
              <li className="flex gap-2.5">
                <MapPin size={16} aria-hidden className="mt-0.5 flex-none text-faint" />
                <span className={sgi.adresse ? 'text-ivory' : 'text-faint'}>{sgi.adresse ?? 'Adresse non publiée dans l’annuaire de la BRVM'}</span>
              </li>
              {telephones.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Phone size={16} aria-hidden className="mt-0.5 flex-none text-faint" />
                  <a href={lienTel(t)} className="tabular text-ivory transition-colors hover:text-accent">
                    {t}
                  </a>
                </li>
              ))}
              {sgi.email && (
                <li className="flex gap-2.5">
                  <Mail size={16} aria-hidden className="mt-0.5 flex-none text-faint" />
                  <a href={`mailto:${sgi.email}`} className="break-all text-ivory transition-colors hover:text-accent">
                    {sgi.email}
                  </a>
                </li>
              )}
              {sgi.siteWeb && (
                <li className="flex gap-2.5">
                  <Globe size={16} aria-hidden className="mt-0.5 flex-none text-faint" />
                  <a href={sgi.siteWeb} target="_blank" rel="nofollow noopener noreferrer" className="break-all text-accent hover:underline">
                    {sgi.siteWeb.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} <ExternalLink size={12} aria-hidden className="inline" />
                  </a>
                </li>
              )}
            </ul>
          </Panneau>

          <Panneau titre="Sources officielles" id="titre-sources">
            <ul className="space-y-3 text-[13.5px]">
              {pdf && (
                <li className="flex gap-2.5">
                  <FileText size={16} aria-hidden className="mt-0.5 flex-none text-up" />
                  <a href={pdf} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Décision d’homologation des tarifs (PDF, brvm.org) <ExternalLink size={12} aria-hidden className="inline" />
                  </a>
                </li>
              )}
              {frais?.sourceLabel && (
                <li className="flex gap-2.5 text-muted">
                  <FileText size={16} aria-hidden className="mt-0.5 flex-none text-faint" />
                  {frais.sourceLabel}
                </li>
              )}
              {sgi.ficheBRVM && (
                <li className="flex gap-2.5">
                  <Building2 size={16} aria-hidden className="mt-0.5 flex-none text-faint" />
                  <a href={sgi.ficheBRVM} target="_blank" rel="nofollow noopener noreferrer" className="text-accent hover:underline">
                    Fiche de l’intervenant sur brvm.org <ExternalLink size={12} aria-hidden className="inline" />
                  </a>
                </li>
              )}
            </ul>
            <dl className="mt-4 border-t border-border pt-2">
              <Ligne libelle="Barème vérifié le" valeur={dateFr(frais?.verifieLe)} />
              <Ligne libelle="Fiche vérifiée le" valeur={dateFr(sgi.verifieLe)} />
            </dl>
          </Panneau>
        </aside>
      </div>
    </CadreComparateur>
  );
}
