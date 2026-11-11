/**
 * F10 et F11 — « Ce mois-ci » : toutes les valeurs face à leur habitude du mois
 * en cours (état écrit chaque soir par le scraper), et bilan public des mois
 * passés (profil figé au début du mois, réalisé à la fin). Ne recalcule rien.
 */
import Link from 'next/link';
import { canAccess } from '@/lib/server/featureAccess';
import { lireBilans, lireEtats, type EtatValeur } from '@/lib/seasonality/server';
import { resumeBilans, PCT_MIN_MOIS } from '@/lib/seasonality/bilan';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saisonnalité : ce mois-ci' };

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pct = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1).replace('.', ',')} %`);
const ETAT: Record<string, string> = {
  au_dessus: 'au-dessus de son habitude',
  dans_la_fourchette: 'dans sa fourchette',
  en_dessous: 'en dessous de son habitude',
  trop_tot: 'trop tôt pour comparer',
  historique_insuffisant: 'historique insuffisant',
};
const VERDICT: Record<string, string> = { etabli: 'régularité établie', indicatif: 'indicative', hasard: 'non distinguable du hasard' };
const dateFr = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

type Filtre = { regularite: 'toutes' | 'indicative' | 'etablie'; etat: 'tous' | 'hors' };
function filtrer(etats: EtatValeur[], f: Filtre): EtatValeur[] {
  return etats.filter((e) =>
    (f.regularite === 'toutes' || (f.regularite === 'etablie' ? e.verdict === 'etabli' : e.verdict !== 'hasard')) &&
    (f.etat === 'tous' || e.etat === 'au_dessus' || e.etat === 'en_dessous'));
}

export default async function CeMoisCiPage({ searchParams }: { searchParams?: { regularite?: string; etat?: string } }) {
  const gate = await canAccess('saisonnalite');
  const premium = gate.allowed;
  const [etats, bilans] = await Promise.all([lireEtats().catch(() => []), lireBilans().catch(() => [])]);
  const f: Filtre = {
    regularite: searchParams?.regularite === 'etablie' ? 'etablie' : searchParams?.regularite === 'indicative' ? 'indicative' : 'toutes',
    etat: searchParams?.etat === 'hors' ? 'hors' : 'tous',
  };
  const lignes = filtrer(etats, f);
  const seance = etats[0]?.date_seance ?? null;
  const mois = etats[0] ? MOIS[etats[0].mois - 1] : null;
  const compte = (k: string) => etats.filter((e) => e.etat === k).length;
  const sansComparaison = compte('trop_tot') + compte('historique_insuffisant');
  const resume = resumeBilans(bilans);
  const lien = (p: Partial<Filtre>) => {
    const q = new URLSearchParams({ regularite: p.regularite ?? f.regularite, etat: p.etat ?? f.etat });
    return `/saisonnalite/ce-mois-ci?${q.toString()}`;
  };
  const choix = (actif: boolean) =>
    `text-xs px-2.5 py-1 rounded-md border ${actif ? 'border-info text-accent-ink bg-info/10' : 'border-border text-muted'}`;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <EnTeteCote
        titre="Ce mois-ci"
        description="Chaque valeur face à son habitude du mois en cours, à la même séance. Une habitude n’est pas une prévision."
        compte={etats.length > 0 ? { n: etats.length, libelle: 'valeurs' } : null}
        source={null}
      />

      {etats.length === 0 ? (
        <p className="mt-8 text-sm text-muted">L’état du mois n’est pas encore calculé. Il l’est chaque soir après la clôture.</p>
      ) : (
        <>
          <p className="mt-8 text-sm text-ivory">
            Séance du {dateFr(seance!)}, {etats[0]!.rang}e séance de {mois} : {compte('dans_la_fourchette')} valeurs dans leur fourchette,{' '}
            {compte('en_dessous')} en dessous, {compte('au_dessus')} au-dessus
            {sansComparaison > 0 && <>, {sansComparaison} sans comparaison possible</>}.
          </p>

          {premium ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-faint">Régularité :</span>
                <Link href={lien({ regularite: 'toutes' })} className={choix(f.regularite === 'toutes')}>toutes</Link>
                <Link href={lien({ regularite: 'indicative' })} className={choix(f.regularite === 'indicative')}>au moins indicative</Link>
                <Link href={lien({ regularite: 'etablie' })} className={choix(f.regularite === 'etablie')}>établie</Link>
                <span className="ml-2 text-xs text-faint">État :</span>
                <Link href={lien({ etat: 'tous' })} className={choix(f.etat === 'tous')}>tous</Link>
                <Link href={lien({ etat: 'hors' })} className={choix(f.etat === 'hors')}>hors de la fourchette</Link>
              </div>
              <div tabIndex={0} role="region" aria-label="Valeurs du mois, défilement horizontal"
                className="mt-4 overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead className="bg-surface text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left">Valeur</th>
                      <th scope="col" className="px-3 py-2 text-right">Depuis le début du mois</th>
                      <th scope="col" className="px-3 py-2 text-right">Fourchette habituelle</th>
                      <th scope="col" className="px-3 py-2 text-left">État</th>
                      <th scope="col" className="px-3 py-2 text-left">Saison de {mois}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((e) => (
                      <tr key={e.code} className="border-t border-border/50">
                        <td className="px-3 py-1.5">
                          <Link href={`/saisonnalite?code=${e.code}`} className="font-mono text-ivory hover:underline">{e.code}</Link>
                          {e.designation && <span className="block text-xs text-faint">{e.designation}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular text-ivory">{pct(e.rdt_en_cours)}</td>
                        <td className="px-3 py-1.5 text-right tabular text-muted">
                          {e.q25 != null && e.q75 != null ? <>{pct(e.q25)} à {pct(e.q75)} <span className="text-faint">({e.n} ans)</span></> : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-muted">{ETAT[e.etat] ?? e.etat}</td>
                        <td className={`px-3 py-1.5 ${e.verdict === 'hasard' ? 'text-faint' : 'text-muted'}`}>{VERDICT[e.verdict] ?? e.verdict}</td>
                      </tr>
                    ))}
                    {lignes.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">Aucune valeur ne répond à ces critères.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Le détail par valeur et les filtres sont réservés à Premium.{' '}
              <Link href="/account/plan" className="text-accent-ink underline underline-offset-2">Passer à Premium</Link>
            </p>
          )}
        </>
      )}

      <section aria-labelledby="bilan-h" className="mt-10 space-y-3">
        <h2 id="bilan-h" className="text-lg font-medium text-ivory">La saison a-t-elle tenu, mois après mois ?</h2>
        <p className="text-sm text-muted">
          Au début de chaque mois, le profil habituel de chaque valeur est écrit, puis n’est plus jamais modifié. À la fin du
          mois, le réalisé est comparé à ce profil selon une règle fixée à l’avance : le signe du mois doit être celui de la
          médiane habituelle ; les saisons non distinguables du hasard ne comptent pas. Un mois est « tenu » quand la majorité
          des saisons comptées a tenu. Les valeurs d’un même mois bougent ensemble : c’est le mois qui compte, pas la valeur.
        </p>
        {resume.mois.length === 0 ? (
          <p className="text-sm text-muted">Le premier profil sera écrit au prochain calcul du soir.</p>
        ) : (
          <>
            <p className="text-sm text-ivory">
              {resume.moisClos === 0
                ? 'Aucun mois n’est encore clos : le premier bilan paraîtra à la fin du mois en cours.'
                : <>Sur {resume.moisClos} mois clos, la saison a tenu {resume.moisTenus} fois
                    {resume.pourcentage != null ? <> ({Math.round(resume.pourcentage * 100)}&nbsp;%)</> : <> (pourcentage affiché à partir de {PCT_MIN_MOIS} mois)</>}.</>}
            </p>
            <ul className="space-y-1 text-sm">
              {resume.mois.map((m) => (
                <li key={`${m.annee}-${m.mois}`} className="flex flex-wrap gap-x-2 text-muted">
                  <span className="text-ivory">{MOIS[m.mois - 1]} {m.annee}</span>
                  <span>
                    {m.statut === 'en_cours' && `en cours : ${m.profils} profils écrits`}
                    {m.statut === 'tenu' && `tenu : ${m.tenues} saisons sur ${m.comptees}`}
                    {m.statut === 'non_tenu' && `non tenu : ${m.tenues} saisons sur ${m.comptees}`}
                    {m.statut === 'sans_objet' && 'aucune saison à juger (toutes non distinguables du hasard)'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <LigneSource>
        État calculé chaque soir sur la clôture BRVM, dividende compris, fourchette prise à la même séance des mêmes mois des
        15 dernières années. Ce n’est pas un conseil en investissement.{' '}
        <Link href="/saisonnalite" className="underline underline-offset-2 hover:text-muted">Saisonnalité par valeur</Link>
      </LigneSource>
    </div>
  );
}
