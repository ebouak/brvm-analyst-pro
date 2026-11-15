import Link from 'next/link';
import { requirePermission, can } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { chargerFileRelecture, type ElementFile } from '@/lib/admin/relectureServeur';
import { LIBELLES_AGREGATS, libelleValeur, uniteCorrection } from '@/lib/admin/relecture';
import RelectureActions from './RelectureActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agrégats bancaires à relire — Administration' };

/**
 * File de relecture des agrégats bancaires (migration 0245). Lecture
 * service_role ; une file illisible est déclarée, jamais affichée vide.
 * Pas de loading.tsx (règle anti-soft-404).
 */
const SUFFIXE = { fcfa: 'FCFA', usd: 'USD', pct: '%' } as const;

function Element({ e, peutDecider }: { e: ElementFile; peutDecider: boolean }) {
  const unite = uniteCorrection(e.indicateur, e.observations[0]?.devise_source ?? null);
  return (
    <PremiumPanel className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatPill tone={e.raison === 'contradiction' ? 'gold' : 'neutral'}>{e.raison === 'contradiction' ? 'Contradiction' : 'Contrôle'}</StatPill>
        <h2 className="font-display text-base text-ivory">{e.code} · {LIBELLES_AGREGATS[e.indicateur] ?? e.indicateur}</h2>
        <span className="tabular text-xs text-faint">{e.periode} au {e.date_arrete} · {e.perimetre}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{e.detail}</p>
      <ul className="mt-3 space-y-2">
        {e.observations.map((o) => (
          <li key={o.id} className="rounded-lg border border-border/60 p-2 text-xs">
            <p className="tabular text-ivory">
              {libelleValeur(o.valeur, o.unite)}{' '}
              <span className="text-faint">(imprimé « {o.texte_original ?? '—'} », {o.unite_source ?? 'unité inconnue'}{o.devise_source ? `, ${o.devise_source}` : ''}, {o.perimetre})</span>
            </p>
            <p className="text-muted">
              <a href={o.document_url} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">{o.document_libelle ?? o.document_url}</a>
              {o.page ? `, page ${o.page}` : ''}{o.libelle_exact ? ` · ${o.libelle_exact}` : ''}
            </p>
            {o.extrait && <blockquote className="mt-1 border-l border-border pl-2 text-faint">{o.extrait}</blockquote>}
            {o.controle_motif && <p className="mt-1 text-down">{o.controle_motif}</p>}
          </li>
        ))}
      </ul>
      {e.observations.length === 0 && <p className="mt-2 text-xs text-warn">Observations introuvables en base : seul le rejet est possible.</p>}
      {peutDecider && (
        <RelectureActions
          id={e.id}
          unite={SUFFIXE[unite]}
          observations={e.observations.map((o) => ({ id: o.id, libelle: `${libelleValeur(o.valeur, o.unite)} — ${o.document_libelle ?? 'document'}` }))}
        />
      )}
    </PremiumPanel>
  );
}

export default async function AgregatsRelecturePage() {
  const ctx = await requirePermission('scraping.read');
  const peutDecider = can(ctx, 'content.write');
  let file: ElementFile[] | null = null;
  try {
    file = await chargerFileRelecture();
  } catch {
    file = null;
  }
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        title="Agrégats bancaires à relire"
        subtitle="Valeurs bloquées par une contradiction entre documents ou un contrôle en échec. Rien n’est publié tant qu’elles ne sont pas tranchées ; une décision s’applique aussitôt (la sélection est rejouée pour la banque)."
      />
      <p className="text-sm text-muted">
        <Link href="/admin/controle" className="text-accent-ink hover:underline">Tour de contrôle</Link>
      </p>
      {file == null ? (
        <p className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">File de relecture illisible : rien ne peut être affirmé sur les valeurs en attente.</p>
      ) : file.length === 0 ? (
        <EmptyStatePremium title="Aucune valeur à relire" hint="Toutes les valeurs lues concordent et passent les contrôles." />
      ) : (
        <div className="space-y-4">{file.map((e) => <Element key={e.id} e={e} peutDecider={peutDecider} />)}</div>
      )}
    </div>
  );
}
