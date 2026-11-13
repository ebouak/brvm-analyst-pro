import type { Metadata } from 'next';
import Link from 'next/link';
import PublicShell from '@/components/public/PublicShell';
import { createPublicClient } from '@/lib/supabase/public';
import { fmtNumber } from '@/lib/format';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Opérations sur titres BRVM · fractionnements, regroupements, suspensions',
  description:
    'Fractionnements et regroupements d’actions cotées à la BRVM, leur effet sur l’historique des cours, et les cotations suspendues selon le Bulletin officiel.',
  alternates: { canonical: '/operations-titres' },
};

interface Operation { code: string; date_effet: string; type: 'fractionnement' | 'regroupement'; ratio: number; applique_le: string | null; note: string | null }

const dateFr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/**
 * Registre public des opérations sur titres (table `operations_titres`) et des
 * suspensions lues au Bulletin officiel (`boc_cote_daily`). Une opération
 * change l'unité de compte d'un titre : sans elle, un historique de cours ou
 * de dividendes se lit faux (SNTS divisée par 10 le 26/10/2026).
 * Pas de loading.tsx (règle anti-soft-404).
 */
export default async function Page() {
  const sb = createPublicClient();
  const [{ data: ops }, { data: derniere }] = await Promise.all([
    sb.from('operations_titres').select('code, date_effet, type, ratio, applique_le, note').order('date_effet', { ascending: false }),
    sb.from('boc_cote_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1),
  ]);
  const dateCote = (derniere?.[0] as { date_marche: string } | undefined)?.date_marche ?? null;
  const { data: sp } = dateCote
    ? await sb.from('boc_cote_daily').select('code, cours_reference').eq('date_marche', dateCote).eq('statut', 'suspendu')
    : { data: [] };
  const operations = (ops ?? []) as Operation[];
  const suspendues = (sp ?? []) as { code: string; cours_reference: number | null }[];
  const codes = [...new Set([...operations.map((o) => o.code), ...suspendues.map((s) => s.code)])];
  const { data: instr } = codes.length
    ? await sb.from('brvm_instruments').select('code, designation').in('code', codes)
    : { data: [] };
  const nom = new Map(((instr ?? []) as { code: string; designation: string | null }[]).map((i) => [i.code, i.designation]));

  return (
    <PublicShell>
      <header className="mb-8 border-b border-border pb-4">
        <h1 className="font-display text-3xl text-ivory md:text-4xl">Opérations sur titres</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Un fractionnement ou un regroupement change le nombre d&apos;actions et donc l&apos;unité de compte du cours,
          du bénéfice et du dividende par action. Voici celles que nous avons enregistrées, et ce qu&apos;elles changent
          dans nos historiques.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg text-ivory">Fractionnements et regroupements</h2>
        {operations.length === 0 ? (
          <p className="text-sm text-muted">Aucune opération enregistrée.</p>
        ) : (
          <ul className="space-y-3">
            {operations.map((o) => (
              <li key={`${o.code}-${o.date_effet}`} className="rounded-xl border border-border bg-surface p-4">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <Link href={`/societes/${o.code}`} className="font-mono text-sm font-medium text-ivory hover:underline">{o.code}</Link>
                  <span className="text-sm text-muted">{nom.get(o.code) ?? ''}</span>
                  <span className="tabular ml-auto text-xs text-faint">effet le {dateFr(o.date_effet)}</span>
                </p>
                <p className="mt-2 text-sm text-ivory">
                  {o.type === 'fractionnement'
                    ? `Fractionnement : ${fmtNumber(o.ratio)} actions nouvelles pour 1 ancienne.`
                    : `Regroupement : 1 action nouvelle pour ${fmtNumber(1 / o.ratio)} anciennes.`}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {o.applique_le
                    ? <>Historique ajusté le {dateFr(o.applique_le)} : les cours, le carnet d&apos;ordres et les relevés intraday antérieurs au {dateFr(o.date_effet)} sont exprimés dans la nouvelle unité ({o.type === 'fractionnement' ? `cours divisés par ${fmtNumber(o.ratio)}` : `cours multipliés par ${fmtNumber(1 / o.ratio)}`}), pour que les variations et les ratios restent comparables.</>
                    : 'Historique pas encore ajusté : les données antérieures restent dans l’ancienne unité.'}
                </p>
                {o.note && <p className="mt-1 text-xs text-faint">{o.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-display text-lg text-ivory">Cotations suspendues</h2>
        <p className="mb-3 text-xs text-faint">
          {dateCote ? <>Selon le Bulletin officiel de la cote du {dateFr(dateCote)} (mention « SP »).</> : 'Bulletin officiel non encore collecté.'}
        </p>
        {suspendues.length === 0 ? (
          <p className="text-sm text-muted">{dateCote ? 'Aucune valeur suspendue.' : '—'}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {suspendues.map((s) => (
              <li key={s.code} className="rounded-xl border border-warn/40 bg-warn/[0.06] p-3 text-sm">
                <Link href={`/societes/${s.code}`} className="font-mono font-medium text-ivory hover:underline">{s.code}</Link>{' '}
                <span className="text-muted">{nom.get(s.code) ?? ''}</span>
                <p className="mt-1 text-xs text-muted">
                  Cours figé {s.cours_reference != null ? <span className="tabular">à {fmtNumber(s.cours_reference)} FCFA</span> : ''} : aucun échange
                  possible. La valeur est retirée du scanner technique tant que dure la suspension.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PublicShell>
  );
}
