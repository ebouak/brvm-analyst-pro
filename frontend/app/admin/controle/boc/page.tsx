import { Suspense } from 'react';
import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { controleBoc } from '@/lib/boc/charger';
import { resumer, SEUIL_ECART, type Comparaison, type ControleValeur } from '@/lib/boc/ecarts';
import { fmtNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Écarts avec le Bulletin officiel — Administration' };

/**
 * Écarts entre les ratios du site et le Bulletin Officiel de la Cote, valeur
 * par valeur, sur la dernière séance collectée. Lecture seule : un écart se
 * vérifie sur les états financiers, il ne se corrige pas d'ici.
 * Pas de loading.tsx (règle anti-soft-404) : <Suspense> ici.
 */
export default async function Page() {
  await requirePermission('scraping.read');
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        title="Écarts avec le Bulletin officiel"
        subtitle={`PER et rendement du site recalculés au cours de référence du bulletin. Seuil de signalement : ${fmtNumber(SEUIL_ECART * 100, 0)} %.`}
      />
      <p className="text-sm text-muted">
        <Link href="/admin/controle" className="text-accent-ink hover:underline">Tour de contrôle</Link>
      </p>
      <Suspense fallback={<LoadingSkeleton />}>
        <Contenu />
      </Suspense>
    </div>
  );
}

async function Contenu() {
  let controles: ControleValeur[];
  try {
    controles = await controleBoc(getServiceClient());
  } catch {
    return <p className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Données illisibles : rien ne peut être affirmé sur les écarts.</p>;
  }
  if (!controles.length) {
    return <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Aucune cote officielle en base. Lancez le workflow « Contrôle quotidien BOC ».</p>;
  }
  const r = resumer(controles);
  // Le plus grave d'abord : écarts, puis PER manquants, puis suspendues, puis le reste.
  const rang = (c: ControleValeur) =>
    c.per.etat === 'ecart' || c.rendement.etat === 'ecart' ? 0 : c.per.etat === 'absent_site' ? 1 : c.statut === 'suspendu' ? 2 : 3;
  const tri = [...controles].sort((a, b) => rang(a) - rang(b) || a.code.localeCompare(b.code));

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-4">
        {[
          ['Séance du bulletin', r.dateSeance ?? '—'],
          ['PER en écart', String(r.ecartsPer.length)],
          ['Rendements en écart', String(r.ecartsRendement.length)],
          ['Suspendues', r.suspendues.length ? r.suspendues.join(', ') : 'aucune'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-surface p-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="tabular text-ivory">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="px-3 py-2 font-normal">Valeur</th>
              <th className="px-3 py-2 font-normal">Statut</th>
              <th className="px-3 py-2 text-right font-normal">PER site</th>
              <th className="px-3 py-2 text-right font-normal">PER BOC</th>
              <th className="px-3 py-2 text-right font-normal">Écart</th>
              <th className="px-3 py-2 text-right font-normal">Rdt site</th>
              <th className="px-3 py-2 text-right font-normal">Rdt BOC</th>
              <th className="px-3 py-2 text-right font-normal">Écart</th>
            </tr>
          </thead>
          <tbody>
            {tri.map((c) => (
              <tr key={c.code} className={`border-t border-border/60 ${rang(c) === 0 ? 'bg-down/[0.04]' : ''}`}>
                <td className="px-3 py-2">
                  <Link href={`/societes/${c.code}`} className="tabular text-ivory hover:underline">{c.code}</Link>
                </td>
                <td className="px-3 py-2 text-xs">{c.statut === 'suspendu' ? <span className="text-warn">Suspendue</span> : <span className="text-muted">Cotée</span>}</td>
                <Cellules m={c.per} decimales={2} unite="×" />
                <Cellules m={c.rendement} decimales={2} unite=" %" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cellules({ m, decimales, unite }: { m: Comparaison; decimales: number; unite: string }) {
  const v = (x: number | null) => (x == null ? '—' : `${fmtNumber(x, decimales)}${unite}`);
  const ton = m.etat === 'ecart' ? 'text-down' : m.etat === 'absent_site' ? 'text-warn' : 'text-muted';
  return (
    <>
      <td className="tabular px-3 py-2 text-right text-ivory">{v(m.site)}</td>
      <td className="tabular px-3 py-2 text-right text-ivory">{v(m.boc)}</td>
      <td className={`tabular px-3 py-2 text-right ${ton}`}>
        {m.ecart != null ? `${m.ecart > 0 ? '+' : ''}${fmtNumber(m.ecart * 100, 1)} %` : m.etat === 'absent_site' ? 'absent du site' : '—'}
      </td>
    </>
  );
}
