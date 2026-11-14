import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ViewTabs from '@/components/ViewTabs';
import { REPORT_TABS } from '@/lib/reportTabs';
import { fmtDateCourte, fmtNumber, fmtPctSigne } from '@/lib/format';
import { libelleEvenement, TYPES_FILTRABLES } from '@/lib/evenements/libelles';
import { libellePeriode } from '@/lib/evenements/periode';
import { regrouperEvenements } from '@/lib/evenements/regroupement';
import { cleReaction, debutPeriode, FILTRES_PERIODE, lireFiltrePeriode } from '@/lib/evenements/reaction';
import { lireEvenements, reactionsCachees, seanceDuJour } from '@/lib/server/evenementsDonnees';
import { RESERVE_REACTION } from '@/lib/reactionPublication';
import ReactionCellule from '@/components/evenements/ReactionCellule';
import LogoSociete from '@/components/evenements/LogoSociete';

// Session lue pour « mes valeurs » : jamais de cache partagé sur cette page.
export const dynamic = 'force-dynamic';
const PLAFOND = 300;
export const metadata = { title: 'Événements et impact' };

/** Codes suivis par l'utilisateur connecté (listes de suivi + portefeuille), lus avec SA session (RLS). */
async function mesValeurs(supabase: ReturnType<typeof createClient>, userId: string): Promise<string[]> {
  const [{ data: wl }, { data: pos }] = await Promise.all([
    supabase.from('watchlists').select('id').eq('user_id', userId),
    supabase.from('portfolios_positions').select('code').eq('user_id', userId),
  ]);
  const ids = ((wl ?? []) as { id: string }[]).map((w) => w.id);
  let suivis: string[] = [];
  if (ids.length > 0) {
    const { data: items } = await supabase.from('watchlist_items').select('code').in('watchlist_id', ids);
    suivis = ((items ?? []) as { code: string }[]).map((i) => i.code);
  }
  return [...new Set([...suivis, ...((pos ?? []) as { code: string }[]).map((p) => p.code)])];
}

export default async function EventsListPage(
  props: {
    searchParams: Promise<{ type?: string; code?: string; periode?: string; mes?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = createClient();
  const type = searchParams.type && (TYPES_FILTRABLES as readonly string[]).includes(searchParams.type) ? searchParams.type : undefined;
  const periode = lireFiltrePeriode(searchParams.periode);
  const code = searchParams.code?.trim().toUpperCase() || undefined;

  const { data: { user } } = await supabase.auth.getUser();
  const mes = !!user && searchParams.mes === '1';
  const codesSuivis = mes && user ? await mesValeurs(supabase, user.id) : undefined;

  const seance = await seanceDuJour(supabase).catch(() => null);
  const ref = seance?.date ?? new Date().toISOString().slice(0, 10);

  const bruts = await lireEvenements(supabase, { type, code, codes: codesSuivis, depuis: debutPeriode(ref, periode) });
  const tous = regrouperEvenements(bruts);
  // Les plus récents d'abord ; le plafond borne la lecture des cours (un appel groupé, mais pas sans limite).
  const events = tous.slice(0, PLAFOND);

  // UN appel groupé pour toute la page, mis en cache une heure.
  const reactions = await reactionsCachees(events.filter((e) => e.code).map((e) => ({ code: e.code as string, date: e.date })));
  const duJour = seance ? events.filter((e) => e.date === seance.date) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-6">
      <div>
        <h1 className="font-display text-2xl text-ivory">Événements et impact</h1>
        <p className="mt-1 text-sm text-muted">
          Qu&apos;est-ce qui vient de sortir, et comment le cours a-t-il réagi ? Les publications des sociétés cotées,
          avec l&apos;écart du titre à l&apos;indice sur les 5 séances qui suivent.
        </p>
      </div>
      <ViewTabs tabs={REPORT_TABS} current="/dashboard/reports/events" />

      {seance && (
        <section aria-label="Séance du jour" className="rounded-card border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-ivory">Séance du {fmtDateCourte(seance.date)}</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {seance.indices.map((i) => (
              <div key={i.code}>
                <dt className="text-xs text-muted">{i.libelle}</dt>
                <dd className="tabular text-sm text-ivory">
                  {i.valeur != null ? fmtNumber(i.valeur, 2) : '—'}
                  {i.variationPct != null && (
                    <span className={`ml-2 ${i.variationPct > 0 ? 'text-up' : i.variationPct < 0 ? 'text-down' : 'text-muted'}`}>{fmtPctSigne(i.variationPct, 2)}</span>
                  )}
                </dd>
              </div>
            ))}
            {seance.souffle.total > 0 && (
              <div>
                <dt className="text-xs text-muted">Hausses et baisses</dt>
                <dd className="tabular text-sm text-ivory">
                  <span className="text-up">{seance.souffle.hausses}</span> hausse{seance.souffle.hausses > 1 ? 's' : ''}
                  {' · '}
                  <span className="text-down">{seance.souffle.baisses}</span> baisse{seance.souffle.baisses > 1 ? 's' : ''}
                  {seance.souffle.stables > 0 && <> · {seance.souffle.stables} inchangée{seance.souffle.stables > 1 ? 's' : ''}</>}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted">Publications du jour</dt>
              <dd className="tabular text-sm text-ivory">{duJour.length}</dd>
            </div>
          </dl>
          {duJour.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              {duJour.slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  {e.code && <LogoSociete code={e.code} taille={20} />}
                  <Link href={`/dashboard/reports/events/${e.id}`} className="truncate text-muted hover:text-accent-ink">
                    {e.code ? `${e.code} · ` : ''}{e.titre}
                  </Link>
                </li>
              ))}
              {duJour.length > 4 && <li className="text-xs text-muted">et {duJour.length - 4} autre{duJour.length - 4 > 1 ? 's' : ''} dans la liste ci-dessous</li>}
            </ul>
          )}
        </section>
      )}

      <form className="flex flex-wrap items-center gap-2" action="/dashboard/reports/events">
        <label className="sr-only" htmlFor="filtre-type">Type d&apos;événement</label>
        <select id="filtre-type" name="type" defaultValue={type ?? ''} className="rounded border border-border bg-surface px-2 py-1.5 text-sm">
          <option value="">Tous les types</option>
          {TYPES_FILTRABLES.map((t) => <option key={t} value={t}>{libelleEvenement(t)}</option>)}
        </select>
        <label className="sr-only" htmlFor="filtre-periode">Période</label>
        <select id="filtre-periode" name="periode" defaultValue={periode} className="rounded border border-border bg-surface px-2 py-1.5 text-sm">
          {FILTRES_PERIODE.map((p) => <option key={p.id} value={p.id}>{p.libelle}</option>)}
        </select>
        <label className="sr-only" htmlFor="filtre-code">Code de la valeur</label>
        <input id="filtre-code" name="code" defaultValue={searchParams.code ?? ''} placeholder="Code titre" className="w-32 rounded border border-border bg-surface px-3 py-1.5 text-sm" />
        {user && (
          <label className="inline-flex items-center gap-1.5 text-sm text-muted">
            <input type="checkbox" name="mes" value="1" defaultChecked={mes} className="accent-accent" />
            Mes valeurs
          </label>
        )}
        <button className="rounded bg-up/90 px-3 py-1.5 text-sm font-medium text-black hover:bg-up">Filtrer</button>
        <span className="ml-auto text-xs text-muted">{tous.length} événement{tous.length > 1 ? 's' : ''}{tous.length > events.length && ` (${events.length} plus récents affichés)`}</span>
      </form>

      <p className="text-sm text-muted">
        <Link href="/rapports/saison" className="text-accent-ink underline underline-offset-2">Saison des résultats</Link>
        {' '}: qui a publié, qui n&apos;a pas encore publié, pour la période en cours.
      </p>

      {mes && codesSuivis && codesSuivis.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-muted">
          Vous ne suivez encore aucune valeur : ajoutez-en à une liste de suivi ou à votre portefeuille pour filtrer ici.
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-muted">
          Aucun événement de marché pour ces critères. Les publications sont ingérées automatiquement.
        </div>
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-sunken/40 text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Société</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Publication</th>
                  <th className="px-3 py-2 text-right font-medium">Réaction à 5 séances</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-border/40 align-top hover:bg-sunken/40">
                    <td className="tabular whitespace-nowrap px-3 py-2 text-muted">{fmtDateCourte(e.date)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {e.code ? (
                        <span className="inline-flex items-center gap-2"><LogoSociete code={e.code} /><span className="tabular text-ivory">{e.code}</span></span>
                      ) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {libelleEvenement(e.type)}
                      {libellePeriode(e.periode) && <span className="block text-muted">{libellePeriode(e.periode)}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/reports/events/${e.id}`} className="hover:text-accent-ink">{e.titre}</Link>
                      {e.pieces.length > 1 && (
                        <p className="mt-0.5 text-xs text-muted">{e.pieces.length} documents publiés pour cette période</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {e.code && reactions ? <ReactionCellule reaction={reactions[cleReaction(e.code, e.date)]} /> : <span className="text-xs text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            Réaction = rendement du titre moins celui du BRVM Composite sur les 5 séances cotées qui suivent la date de publication.
            « en cours » : la fenêtre n&apos;est pas close ; « — » : non mesurable. {RESERVE_REACTION}
            {reactions === null && ' Les cours n’ont pas pu être lus : aucune réaction n’est affichée.'}
          </p>
        </>
      )}
    </div>
  );
}
