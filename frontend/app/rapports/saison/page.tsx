import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ViewTabs from '@/components/ViewTabs';
import { REPORT_TABS } from '@/lib/reportTabs';
import { fmtDateCourte, fmtPctSigne } from '@/lib/format';
import { libellePeriode } from '@/lib/evenements/periode';
import { regrouperEvenements } from '@/lib/evenements/regroupement';
import { cleReaction, debutPeriode } from '@/lib/evenements/reaction';
import { bilanSaison, periodeDeSaison, periodesDisponibles, titreSaison, variationsComptes, type LigneComptes } from '@/lib/evenements/saison';
import { lireEvenements, reactionsCachees, seanceDuJour, societesActives } from '@/lib/server/evenementsDonnees';
import { RESERVE_REACTION } from '@/lib/reactionPublication';
import ReactionCellule from '@/components/evenements/ReactionCellule';
import LogoSociete from '@/components/evenements/LogoSociete';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saison des résultats' };

const couleur = (v: number | null) => (v == null ? 'text-muted' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');

/** Variation lue en base, ou la raison de son absence (jamais un zéro par défaut). */
function CelluleVariation({ extrait, valeur }: { extrait: boolean; valeur: number | null }) {
  if (!extrait) return <span className="text-xs text-muted">non extrait</span>;
  if (valeur == null) return <span className="text-xs text-muted" title="Base de comparaison nulle ou négative">non calculable</span>;
  return <span className={`tabular text-sm ${couleur(valeur)}`}>{fmtPctSigne(valeur, 1)}</span>;
}

export default async function SaisonPage(props: { searchParams: Promise<{ periode?: string }> }) {
  const sp = await props.searchParams;
  const supabase = createClient();

  const seance = await seanceDuJour(supabase).catch(() => null);
  const ref = seance?.date ?? new Date().toISOString().slice(0, 10);

  const [bruts, actifs] = await Promise.all([
    lireEvenements(supabase, { type: 'resultats', depuis: debutPeriode(ref, '12m') }),
    societesActives(supabase),
  ]);
  const evts = regrouperEvenements(bruts);
  const disponibles = periodesDisponibles(evts);
  const periode = sp.periode && disponibles.includes(sp.periode) ? sp.periode : periodeDeSaison(evts, ref) ?? disponibles[0] ?? null;

  const entete = (
    <>
      <div>
        <h1 className="font-display text-2xl text-ivory">Saison des résultats</h1>
        <p className="mt-1 text-sm text-muted">Qui a publié, qui n&apos;a pas encore publié, et comment le cours a réagi.</p>
      </div>
      <ViewTabs tabs={REPORT_TABS} current="/dashboard/reports/events" />
    </>
  );

  if (!periode || actifs.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-6">
        {entete}
        <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-muted">
          Aucune publication de résultats recensée sur les douze derniers mois. Les publications sont ingérées automatiquement.
        </div>
      </div>
    );
  }

  const bilan = bilanSaison(actifs.map((a) => a.code), evts, periode);
  const nom = new Map(actifs.map((a) => [a.code, a.designation]));

  const [reactions, comptes] = await Promise.all([
    reactionsCachees(bilan.publies.map((p) => ({ code: p.code, date: p.date }))),
    periode.startsWith('A-') && bilan.publies.length > 0
      ? supabase.from('income_statements').select('code, periode, revenu_total, resultat_net')
          .eq('type_periode', 'annuel').in('code', bilan.publies.map((p) => p.code))
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const parCode = new Map<string, LigneComptes[]>();
  for (const l of (comptes.data ?? []) as (LigneComptes & { code: string })[]) {
    const a = parCode.get(l.code) ?? [];
    a.push(l);
    parCode.set(l.code, a);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-6">
      {entete}

      <section className="rounded-card border border-border bg-surface p-5">
        <h2 className="font-display text-xl leading-snug text-ivory md:text-2xl">{titreSaison(bilan)}</h2>
        <p className="mt-2 text-sm text-muted">
          {bilan.nonPublies.length > 0
            ? `${bilan.nonPublies.length} société${bilan.nonPublies.length > 1 ? 's' : ''} sans publication recensée pour cette période.`
            : 'Toutes les sociétés cotées ont une publication recensée pour cette période.'}
        </p>
        {disponibles.length > 1 && (
          <nav aria-label="Période" className="mt-3 flex flex-wrap gap-1.5">
            {disponibles.map((p) => (
              <Link
                key={p}
                href={`/rapports/saison?periode=${p}`}
                aria-current={p === periode ? 'page' : undefined}
                className={`rounded-lg border px-3 py-1 text-xs ${p === periode ? 'border-accent/30 bg-accent/10 text-accent-ink' : 'border-border text-muted hover:text-ivory'}`}
              >
                {libellePeriode(p) ?? p}
              </Link>
            ))}
          </nav>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ivory">Ont publié ({bilan.nPublies})</h2>
        <div className="relative overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-sunken/40 text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Société</th>
                <th className="px-3 py-2 text-left font-medium">Publié le</th>
                <th className="px-3 py-2 text-right font-medium">Chiffre d&apos;affaires</th>
                <th className="px-3 py-2 text-right font-medium">Résultat net</th>
                <th className="px-3 py-2 text-right font-medium">Réaction à 5 séances</th>
              </tr>
            </thead>
            <tbody>
              {bilan.publies.map((p) => {
                const v = variationsComptes(periode, parCode.get(p.code) ?? []);
                return (
                  <tr key={p.code} className="border-b border-border/40 hover:bg-sunken/40">
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/reports/events/${p.id}`} className="inline-flex items-center gap-2 hover:text-accent-ink">
                        <LogoSociete code={p.code} />
                        <span className="tabular text-ivory">{p.code}</span>
                        <span className="hidden truncate text-xs text-muted sm:inline">{nom.get(p.code) ?? ''}</span>
                      </Link>
                    </td>
                    <td className="tabular whitespace-nowrap px-3 py-2 text-muted">{fmtDateCourte(p.date)}</td>
                    <td className="px-3 py-2 text-right"><CelluleVariation extrait={v.extrait} valeur={v.chiffreAffaires} /></td>
                    <td className="px-3 py-2 text-right"><CelluleVariation extrait={v.extrait} valeur={v.resultatNet} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {reactions ? <ReactionCellule reaction={reactions[cleReaction(p.code, p.date)]} /> : <span className="text-xs text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Variation du chiffre d&apos;affaires et du résultat net : exercice comparé à l&apos;exercice précédent, quand les deux sont extraits des états
          financiers en base ; « non extrait » sinon (la base ne porte que des exercices annuels). {RESERVE_REACTION}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ivory">Pas encore de publication recensée ({bilan.nonPublies.length})</h2>
        {bilan.nonPublies.length === 0 ? (
          <p className="text-sm text-muted">Aucune : toutes les sociétés cotées ont publié.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {bilan.nonPublies.map((c) => (
              <li key={c}>
                <Link href={`/dashboard/reports/events?code=${c}&periode=tout`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1 text-sm hover:text-accent-ink">
                  <LogoSociete code={c} taille={20} />
                  <span className="tabular text-ivory">{c}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
