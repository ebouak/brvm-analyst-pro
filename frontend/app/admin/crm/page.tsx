// frontend/app/admin/crm/page.tsx
import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';
import { chargerDossiers } from '@/lib/crm/charger';
import { estExclu, scorer, fmtJour } from '@/lib/crm/score';
import type { Niveau } from '@/lib/crm/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CRM — Administration' };

const NIVEAUX: (Niveau | 'tous')[] = ['chaud', 'tiede', 'froid', 'tous'];
const LIB: Record<Niveau | 'tous', string> = { chaud: 'Chaud', tiede: 'Tiède', froid: 'Froid', tous: 'Tous' };

export default async function Page({ searchParams }: { searchParams: { niveau?: string } }) {
  await requirePermission('crm.read');
  const filtre = (NIVEAUX as string[]).includes(searchParams.niveau ?? '') ? (searchParams.niveau as Niveau | 'tous') : 'chaud';
  const maintenant = new Date();
  const lignes = (await chargerDossiers())
    .filter((d) => !estExclu(d))
    .map((d) => ({ d, s: scorer(d, maintenant), relance: [...d.actions].filter((a) => a.type === 'relance').sort((a, b) => b.date.localeCompare(a.date))[0] }))
    .filter((x) => filtre === 'tous' || x.s.niveau === filtre)
    .sort((a, b) => b.s.score - a.s.score);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Administration" title="CRM · proches du Premium" />
      <nav className="flex gap-2 text-sm">
        {NIVEAUX.map((n) => (
          <Link key={n} href={`/admin/crm?niveau=${n}`} className={`rounded-full border px-3 py-1 ${n === filtre ? 'border-accent text-accent-ink' : 'border-border text-muted'}`}>{LIB[n]}</Link>
        ))}
      </nav>
      {lignes.length === 0 ? (
        <p className="text-sm text-muted">Aucune personne à relancer pour l&apos;instant. Signaux suivis : paiement commencé, offre consultée, connexions, portefeuille, messages, newsletter, Academy.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="py-2">Personne</th><th>Score</th><th>Raisons principales</th><th>Dernière connexion</th><th>Dernière relance</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ d, s, relance }) => (
              <tr key={d.cle} className="border-t border-border align-top">
                <td className="py-2">
                  <Link href={`/admin/crm/${encodeURIComponent(d.cle)}`} className="font-medium text-ivory hover:text-accent-ink">{d.nom ?? d.emailNorm}</Link>
                  {!d.userId && <span className="ml-2 text-xs text-faint">prospect sans compte</span>}
                </td>
                <td className="tabular">{s.score} · {LIB[s.niveau]}</td>
                <td className="text-muted">{s.raisons.slice(0, 2).map((r) => r.texte).join(' ; ') || '—'}</td>
                <td className="tabular text-muted">{d.derniereConnexion ? fmtJour(d.derniereConnexion) : '—'}</td>
                <td className="text-muted">{relance ? `${fmtJour(relance.date)} · ${relance.canal ?? ''} (${relance.statut})` : 'jamais relancé'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
