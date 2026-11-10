import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { getMonthlyReturns } from '@/lib/seasonality/server';
import SeasonalityMatrix from '@/components/seasonality/SeasonalityMatrix';
import { canAccess } from '@/lib/server/featureAccess';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';

// Garde par utilisateur (essai gratuit limité vs premium complet) : dynamique.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saisonnalité' };

export default async function SaisonnalitePage({ searchParams }: { searchParams?: { code?: string } }) {
  // Niveau requis LU EN BASE. En cas de refus on n'affiche pas une porte fermée :
  // on bascule en APERÇU (mois en cours seulement), l'essai limité demandé.
  const gate = await canAccess('saisonnalite');
  const preview = !gate.allowed;

  const sb = createPublicClient();
  // Actions ET obligations : l'essai gratuit doit pouvoir porter sur l'un ou l'autre.
  const { data: instr } = await sb
    .from('brvm_instruments').select('code, designation, type')
    .in('type', ['action', 'obligation']).order('code');
  const instruments = (instr ?? []) as { code: string; designation: string | null; type: string }[];

  const code = (searchParams?.code ?? instruments[0]?.code ?? 'PALC').toUpperCase();
  const returns = await getMonthlyReturns(code).catch(() => []);
  const designation = instruments.find((i) => i.code === code)?.designation ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <EnTeteCote
        titre="Saisonnalité"
        description="La performance moyenne d’un titre, mois par mois, sur plusieurs années. Une lecture statistique, à croiser avec la tendance, la liquidité et le dividende."
        compte={instruments.length > 0 ? { n: instruments.length, libelle: 'titres' } : null}
        source={null}
      />

      {/* Sélecteur de titre (formulaire GET). En aperçu il est désactivé : l'essai
          gratuit porte sur un seul titre (le défaut), pour un seul mois. */}
      <form className="mt-8 flex min-w-0 flex-wrap items-end gap-3 border-t border-border-strong pt-6">
        <label htmlFor="saison-titre" className="block min-w-0">
          <span className="text-xs text-muted">Titre</span>
          <select
            id="saison-titre"
            name="code"
            defaultValue={code}
            disabled={preview}
            className="mt-1 block min-h-[44px] min-w-0 max-w-full rounded-lg border border-border bg-bg px-3 text-sm text-ivory transition-colors hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {instruments.map((i) => <option key={i.code} value={i.code}>{i.code}{i.designation ? `, ${i.designation}` : ''}</option>)}
          </select>
        </label>
        {preview ? (
          <p className="pb-3 text-xs text-muted">
            Aperçu : un titre, le mois en cours.{' '}
            <Link href="/account/plan" className="rounded text-accent-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Choisir un autre titre avec Premium</Link>
          </p>
        ) : (
          <button
            type="submit"
            className="min-h-[44px] rounded-lg bg-accent px-5 text-sm font-semibold text-bg transition active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Afficher
          </button>
        )}
      </form>

      <section aria-labelledby="saison-titre-h" className="mt-8">
        <h2 id="saison-titre-h" className="text-lg font-medium text-ivory">
          <span className="font-mono">{code}</span>
          {designation && <span className="text-ivory/90">, {designation}</span>}
        </h2>
        <div className="mt-4">
          <SeasonalityMatrix returns={returns} preview={preview} />
        </div>
        <LigneSource>
          Calcul sur l’historique réel des cours de clôture de la BRVM (15 ans au plus). Lecture statistique : un mois
          favorable par le passé ne dit rien de l’année en cours. Ce n’est pas un conseil en investissement.{' '}
          <Link href="/outils" className="underline underline-offset-2 hover:text-muted">Tous les outils</Link>
        </LigneSource>
      </section>
    </div>
  );
}
