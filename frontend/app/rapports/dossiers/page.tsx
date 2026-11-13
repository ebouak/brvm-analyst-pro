import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ViewTabs from '@/components/ViewTabs';
import { REPORT_TABS } from '@/lib/reportTabs';
import { fmtDateCourte } from '@/lib/format';
import { nomPays } from '@/lib/crm/geo';
import brvmLogos from '@/lib/brvmLogos.json';
import { canAccess } from '@/lib/server/featureAccess';
import { urlFormules } from '@/lib/auth/urlsAcces';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dossiers valeur' };

const LOGOS = brvmLogos as Record<string, string>;

interface Ligne { code: string; designation: string | null; secteur: string | null; pays: string | null }

/**
 * Bibliothèque des Dossiers valeur : une entrée par société cotée.
 * La date d'édition est celle de la dernière prose rangée par le lot hebdomadaire
 * (dossier_narratifs.genere_le) ; sans édition, aucune date n'est affichée.
 */
export default async function DossiersPage(props: { searchParams: Promise<{ q?: string; secteur?: string; pays?: string }> }) {
  const sp = await props.searchParams;
  const sb = createClient();
  const gate = await canAccess('dossiers_valeur');
  const [{ data: instr }, { data: editions }] = await Promise.all([
    sb.from('brvm_instruments').select('code, designation, secteur, pays').eq('type', 'action').order('code'),
    sb.from('dossier_narratifs').select('code, genere_le'),
  ]);
  const derniere = new Map<string, string>();
  for (const e of (editions ?? []) as { code: string; genere_le: string | null }[]) {
    if (e.genere_le && (!derniere.has(e.code) || e.genere_le > derniere.get(e.code)!)) derniere.set(e.code, e.genere_le);
  }
  const toutes = (instr ?? []) as Ligne[];
  const secteurs = [...new Set(toutes.map((l) => l.secteur).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, 'fr'));
  const pays = [...new Set(toutes.map((l) => l.pays).filter((p): p is string => !!p))].sort((a, b) => nomPays(a).localeCompare(nomPays(b), 'fr'));
  const q = (sp.q ?? '').trim().toLowerCase();
  const lignes = toutes.filter((l) =>
    (!q || l.code.toLowerCase().includes(q) || (l.designation ?? '').toLowerCase().includes(q))
    && (!sp.secteur || l.secteur === sp.secteur)
    && (!sp.pays || l.pays === sp.pays));

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-6">
      <div>
        <h1 className="font-display text-2xl text-ivory">Dossiers valeur</h1>
        <p className="mt-1 text-sm text-muted">Que vaut cette société ? Un dossier de quatorze pages par valeur, mis à jour chaque semaine.</p>
        {!gate.allowed && gate.required !== 'disabled' && (
          <p className="mt-2 text-sm text-muted">
            La liste est ouverte à tous ; la lecture d&apos;un dossier est réservée au plan {gate.required === 'pro' ? 'Platinium' : 'Premium'}.{' '}
            <Link href={urlFormules('/rapports/dossiers')} className="text-accent-ink underline underline-offset-2">Voir les formules</Link>
          </p>
        )}
      </div>
      <ViewTabs tabs={REPORT_TABS} current="/rapports/dossiers" />

      <form className="flex flex-wrap items-center gap-2" action="/rapports/dossiers">
        <label className="sr-only" htmlFor="q">Rechercher une société</label>
        <input id="q" name="q" defaultValue={sp.q ?? ''} placeholder="Code ou nom" className="w-48 rounded border border-border bg-surface px-3 py-1.5 text-sm" />
        <label className="sr-only" htmlFor="secteur">Secteur</label>
        <select id="secteur" name="secteur" defaultValue={sp.secteur ?? ''} className="rounded border border-border bg-surface px-2 py-1.5 text-sm">
          <option value="">Tous les secteurs</option>
          {secteurs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="sr-only" htmlFor="pays">Pays</label>
        <select id="pays" name="pays" defaultValue={sp.pays ?? ''} className="rounded border border-border bg-surface px-2 py-1.5 text-sm">
          <option value="">Tous les pays</option>
          {pays.map((p) => <option key={p} value={p}>{nomPays(p)}</option>)}
        </select>
        <button className="rounded bg-up/90 px-3 py-1.5 text-sm font-medium text-black hover:bg-up">Filtrer</button>
        <span className="ml-auto text-xs text-muted">{lignes.length} société{lignes.length > 1 ? 's' : ''}</span>
      </form>

      {lignes.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-8 text-center text-sm text-muted">Aucune société ne correspond à ces critères.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lignes.map((l) => {
            const edition = derniere.get(l.code);
            return (
              <li key={l.code} className="flex items-start gap-3 rounded-card border border-border bg-surface p-3">
                {LOGOS[l.code]
                  ? <img src={LOGOS[l.code]} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded bg-white object-contain" />
                  : <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-sunken text-xs font-semibold text-muted">{l.code.slice(0, 2)}</span>}
                <div className="min-w-0 flex-1">
                  <Link href={`/rapports/dossier/${l.code}`} className="block truncate text-sm font-semibold text-ivory hover:text-accent-ink">
                    {l.designation ?? l.code}
                  </Link>
                  <p className="truncate text-xs text-muted">{[l.code, l.secteur, l.pays ? nomPays(l.pays) : null].filter(Boolean).join(' · ')}</p>
                  <p className="mt-1 text-xs text-muted">
                    {edition ? <>Édition du {fmtDateCourte(edition)} · <a href={`/api/dossier/${l.code}/pdf`} className="text-accent-ink underline">PDF</a></> : 'Pas encore d’édition hebdomadaire'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
