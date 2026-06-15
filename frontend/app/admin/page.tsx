import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/server/admin';
import { SectionHeader, PremiumPanel, MetricCard } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administration' };

/** Client service-role (lecture seule ici) — bypasse la RLS pour les comptages globaux.
 *  Jamais exposé au client : utilisé uniquement dans ce composant serveur. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

const DASH = '—';

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return DASH;
  return new Intl.NumberFormat('fr-FR').format(n);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return DASH;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return DASH;
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_LABEL: Record<string, string> = {
  success: 'Succès',
  partial: 'Partiel',
  failed: 'Échec',
  mock: 'Mock',
};

type Kpis = {
  totalUsers: number | null;
  premiumUsers: number | null;
  newsletter: number | null;
  derniereSeance: string | null;
  societesSuivies: number | null;
  lastRun: { status: string; started_at: string | null; source: string | null } | null;
};

async function loadKpis(): Promise<Kpis> {
  const db = getAdminClient();

  const safeCount = async (fn: () => Promise<number | null>): Promise<number | null> => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };

  const [
    totalUsers,
    premiumUsers,
    newsletter,
    lastSeance,
    lastRun,
  ] = await Promise.all([
    safeCount(async () => {
      const { count, error } = await db
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    }),
    safeCount(async () => {
      const { count, error } = await db
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_premium', true);
      if (error) throw error;
      return count ?? 0;
    }),
    safeCount(async () => {
      const { count, error } = await db
        .from('newsletter_subscribers')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    }),
    (async () => {
      try {
        const { data, error } = await db
          .from('brvm_actions_daily')
          .select('date_marche')
          .order('date_marche', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return (data?.date_marche as string | undefined) ?? null;
      } catch {
        return null;
      }
    })(),
    (async () => {
      try {
        const { data, error } = await db
          .from('scrape_runs')
          .select('status, started_at, source')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return (data as Kpis['lastRun']) ?? null;
      } catch {
        return null;
      }
    })(),
  ]);

  // Sociétés suivies = nombre de codes distincts sur la dernière séance.
  let societesSuivies: number | null = null;
  if (lastSeance) {
    societesSuivies = await safeCount(async () => {
      const { count, error } = await db
        .from('brvm_actions_daily')
        .select('*', { count: 'exact', head: true })
        .eq('date_marche', lastSeance);
      if (error) throw error;
      return count ?? 0;
    });
  }

  return {
    totalUsers,
    premiumUsers,
    newsletter,
    derniereSeance: lastSeance,
    societesSuivies,
    lastRun,
  };
}

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');

  const kpis = await loadKpis();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Vue d'ensemble"
        subtitle="Indicateurs de la plateforme (lecture seule). Comptes utilisateurs, abonnés et fraîcheur des données de marché."
      />

      <div className="gold-rule" />

      {/* KPIs */}
      <section aria-labelledby="kpis-heading" className="space-y-3">
        <h2 id="kpis-heading" className="overline text-faint">
          Indicateurs
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <MetricCard label="Utilisateurs" value={fmtInt(kpis.totalUsers)} accent="sapphire" />
          <MetricCard label="Comptes premium" value={fmtInt(kpis.premiumUsers)} accent="gold" />
          <MetricCard label="Abonnés newsletter" value={fmtInt(kpis.newsletter)} accent="neutral" />
          <MetricCard label="Dernière séance" value={fmtDate(kpis.derniereSeance)} accent="neutral" />
          <MetricCard label="Sociétés suivies" value={fmtInt(kpis.societesSuivies)} accent="emerald" />
          {kpis.lastRun && (
            <MetricCard
              label="Dernier scrape"
              value={STATUS_LABEL[kpis.lastRun.status] ?? kpis.lastRun.status}
              unit={kpis.lastRun.started_at ? fmtDate(kpis.lastRun.started_at) : undefined}
              accent={kpis.lastRun.status === 'failed' ? 'neutral' : 'emerald'}
            />
          )}
        </div>
      </section>

      {/* Liens rapides vers les sous-pages d'administration */}
      <section aria-labelledby="links-heading" className="space-y-3">
        <h2 id="links-heading" className="overline text-faint">
          Accès rapides
        </h2>
        <PremiumPanel className="p-2">
          <nav aria-label="Pages d'administration">
            <ul className="divide-y divide-border/60">
              {[
                {
                  href: '/admin/cles-api',
                  title: 'Clés API',
                  desc: 'Configurer les fournisseurs IA (DeepSeek, Mistral, Grok).',
                },
                {
                  href: '/admin/import-fondamentaux',
                  title: 'Import fondamentaux',
                  desc: 'Lancer l’extraction des états financiers depuis les publications.',
                },
              ].map(({ href, title, desc }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center justify-between gap-4 rounded-card px-4 py-3.5 transition-colors hover:bg-surface/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium text-ivory">{title}</span>
                      <span className="block text-xs text-muted">{desc}</span>
                    </span>
                    <span aria-hidden className="text-faint">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </PremiumPanel>
      </section>
    </div>
  );
}
