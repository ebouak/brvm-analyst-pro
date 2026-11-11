import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { RechercheSocietes } from '@/components/societes/RechercheSocietes';
import PublicShell from '@/components/public/PublicShell';
import CompaniesExplorer, { type CompanyCard } from '@/components/public/CompaniesExplorer';
import { NB_SOCIETES_COTEES } from '@/lib/universe';

export const revalidate = 900;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  // Le compte se dérive du référentiel (lib/universe.ts) : « 48 » écrit en dur
  // serait devenu faux à la prochaine admission à la cote.
  title: `Les ${NB_SOCIETES_COTEES} sociétés cotées à la BRVM : cours, notes et analyses`,
  description:
    'Annuaire complet des sociétés cotées à la Bourse Régionale des Valeurs Mobilières (BRVM) : cours en quasi temps réel, note BRVM de A à F, secteur et pays. Analyse gratuite.',
  alternates: { canonical: `${SITE_URL}/societes` },
};

async function getCompanies(): Promise<{ companies: CompanyCard[]; dateSeance: string | null }> {
  const supabase = createPublicClient();

  const [{ data: instruments }, { data: lastQuotes }, { data: signals }] = await Promise.all([
    supabase
      .from('brvm_instruments')
      .select('code, designation, secteur, pays')
      .eq('type', 'action')
      .eq('actif', true)
      .order('code'),
    supabase
      .from('brvm_actions_daily')
      .select('code, cours_jour, variation_pct, date_marche')
      .order('date_marche', { ascending: false })
      // ~48 valeurs : 200 lignes couvrent environ quatre séances. Une valeur
      // sans cotation sur cette fenêtre s'affiche « — » : c'est voulu, on ne
      // va pas chercher un cours plus ancien pour combler la case.
      .limit(200),
    // Page publique : la dernière note par valeur, par la fonction bornée
    // (F-04). La table elle-même n'est plus lisible sans session.
    supabase.rpc('signaux_publics').select('code, score_total, confiance, date_marche'),
  ]);

  // Dernière cotation / dernier signal par code (requêtes triées par date desc)
  const quoteByCode = new Map<string, { cours_jour: number | null; variation_pct: number | null; date_marche: string }>();
  for (const q of lastQuotes ?? []) {
    if (!quoteByCode.has(q.code)) quoteByCode.set(q.code, q);
  }
  const signalByCode = new Map<string, { score_total: number; confiance: number | null }>();
  for (const s of signals ?? []) {
    if (!signalByCode.has(s.code)) signalByCode.set(s.code, s);
  }

  // Requête triée par date décroissante : la première ligne porte la séance la
  // plus récente en base. Sans cotation, aucune date n'est annoncée.
  const dateSeance = (lastQuotes?.[0]?.date_marche as string | undefined) ?? null;

  const companies = (instruments ?? []).map((i) => {
    const q = quoteByCode.get(i.code);
    return {
      code: i.code as string,
      designation: i.designation as string,
      secteur: (i.secteur as string | null) ?? null,
      pays: (i.pays as string | null) ?? null,
      cours: q?.cours_jour ?? null,
      variation_pct: q?.variation_pct ?? null,
      // L'en-tête annonce la séance la plus récente : une valeur dont le dernier
      // cours est plus ancien (suspension, admission, trou de collecte) porte sa
      // propre date, sinon la page affirmerait en silence un cours du jour.
      cours_au: q && dateSeance && q.date_marche < dateSeance ? q.date_marche : null,
      score_total: signalByCode.get(i.code)?.score_total ?? null,
      confiance: signalByCode.get(i.code)?.confiance ?? null,
    };
  });

  return { companies, dateSeance };
}

/** « 2026-11-06 » → « 6 nov. 2026 » (date de séance, sans fuseau). */
function dateLongue(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default async function CompaniesIndexPage() {
  const { companies, dateSeance } = await getCompanies();

  return (
    <PublicShell>
      <header className="mb-8 max-w-3xl">
        <h1 className="font-display text-3xl font-medium tracking-tight text-ivory md:text-4xl">
          Les sociétés cotées à la BRVM
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Pour chaque société cotée à la Bourse Régionale des Valeurs Mobilières (UEMOA) : le cours en quasi
          temps réel, la note BRVM et une fiche d&apos;analyse gratuite. Les sociétés sont classées par secteur.
        </p>
        {dateSeance && (
          <p className="mt-4 text-xs text-faint">
            Derniers cours connus, séance du <time dateTime={dateSeance.slice(0, 10)}>{dateLongue(dateSeance)}</time>
          </p>
        )}
      </header>

      <RechercheSocietes />

      {companies.length === 0 ? (
        <div className="rounded-card border border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-muted">Aucune société à afficher pour l&apos;instant.</p>
        </div>
      ) : (
        <CompaniesExplorer companies={companies} />
      )}
    </PublicShell>
  );
}
