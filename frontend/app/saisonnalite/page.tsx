import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { getSaisonValeur, lireFenetres, lireMarche, prochainDetachement } from '@/lib/seasonality/server';
import { saisonLiquidite } from '@/lib/seasonality/liquidite';
import LiquiditeSaison from '@/components/seasonality/LiquiditeSaison';
import { habitudes } from '@/lib/seasonality/frise';
import FriseEvenements from '@/components/seasonality/FriseEvenements';
import FenetreEvenement from '@/components/seasonality/FenetreEvenement';
import ConfrontationMois, { phraseConfrontation } from '@/components/seasonality/ConfrontationMois';
import SeasonalityMatrix from '@/components/seasonality/SeasonalityMatrix';
import { canAccess } from '@/lib/server/featureAccess';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { LigneSource } from '@/components/marche/LigneSource';

// Garde par utilisateur (essai gratuit limité vs premium complet) : dynamique.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saisonnalité' };

export default async function SaisonnalitePage(props: { searchParams?: Promise<{ code?: string }> }) {
  const searchParams = await props.searchParams;
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
  const saison = await getSaisonValeur(code).catch(() => null);
  // Lot 3 : événements (Premium seulement, donc lus seulement hors aperçu).
  const [fenetres, prochain, marche] = preview
    ? [null, null, null]
    : await Promise.all([
        lireFenetres(code).catch(() => null),
        prochainDetachement(code).catch(() => null),
        lireMarche().catch(() => null),
      ]);
  const habitudesValeur = habitudes((saison?.faits ?? []).flatMap((f) => f.evenements));
  const designation = instruments.find((i) => i.code === code)?.designation ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <EnTeteCote
        titre="Saisonnalité"
        description="L’habitude d’un titre, mois par mois, et sa fiabilité mesurée. Une saison est une habitude du passé, pas une prévision."
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

      <p className="mt-4 text-sm">
        <Link href="/saisonnalite/ce-mois-ci" className="text-accent-ink underline underline-offset-2">
          Ce mois-ci : toutes les valeurs face à leur habitude, et le bilan public
        </Link>
      </p>

      {/* F8 : la saison du marché, résultat le plus solide, avant celle d'une valeur. */}
      {!preview && marche && marche.rendements.length > 0 && (
        <section aria-labelledby="saison-marche-h" className="mt-8">
          <h2 id="saison-marche-h" className="text-lg font-medium text-ivory">Saison du marché</h2>
          <p className="mt-1 text-sm text-muted">
            Moyenne équipondérée des actions cotées, dividende réinvesti. Une valeur suit d’abord le marché : sa propre saison
            se lit en regard de celle-ci.
          </p>
          <div className="mt-4">
            <SeasonalityMatrix returns={marche.rendements} />
          </div>
        </section>
      )}

      <section aria-labelledby="saison-titre-h" className="mt-8">
        <h2 id="saison-titre-h" className="text-lg font-medium text-ivory">
          <span className="font-mono">{code}</span>
          {designation && <span className="text-ivory/90">, {designation}</span>}
        </h2>
        {/* F1 : le mois en cours face à son habitude. En aperçu, la phrase seule. */}
        {saison?.confrontation && (
          <div className="mt-4 rounded-panel border border-border bg-surface p-4">
            {preview
              ? <p className="text-sm text-ivory">{phraseConfrontation(saison.confrontation)}</p>
              : <ConfrontationMois c={saison.confrontation} />}
          </div>
        )}
        <div className="mt-4">
          <SeasonalityMatrix
            returns={saison?.total ?? []}
            returnsPrix={saison?.source === 'table' ? saison.prix : undefined}
            anneesDifficiles={saison?.anneesDifficiles ?? []}
            detachementsParMois={saison?.detachementsParMois}
            faits={saison?.faits ?? []}
            marche={marche?.rendements}
            preview={preview}
          />
        </div>
        {!preview && (habitudesValeur.length > 0 || prochain) && (
          <div className="mt-6">
            <FriseEvenements habitudes={habitudesValeur} prochain={prochain} />
          </div>
        )}
        {!preview && fenetres && (
          <div className="mt-6">
            <FenetreEvenement code={code} f={fenetres} />
          </div>
        )}
        {!preview && marche && saison && saison.faits.length > 0 && (
          <div className="mt-6">
            <LiquiditeSaison code={code} valeur={saisonLiquidite(saison.faits)} marche={saisonLiquidite(marche.liquidite)} />
          </div>
        )}
        <LigneSource>
          Rendement médian de chaque mois calendaire, sur les cours de clôture de la BRVM (15 ans au plus), dividende
          réinvesti par défaut : en cours seul, un mois de détachement paraît plus faible qu’il ne l’est. Le mois en cours,
          inachevé, les mois sans échange, les reprises et les variations non expliquées sont exclus. La fiabilité de chaque
          mois est calculée : la plupart des régularités par valeur ne se distinguent pas du hasard et ne se sont pas
          répétées l’année suivante. Ce n’est pas un conseil en investissement.{' '}
          <Link href="/premium/outils" className="underline underline-offset-2 hover:text-muted">Tous les outils</Link>
        </LigneSource>
      </section>
    </div>
  );
}
