import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import PublicShell from '@/components/public/PublicShell';
import { fmtDateFR } from '@/lib/format';

export const revalidate = 900;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://frontend-zeta-ten-22.vercel.app';
const TELEGRAM_CHANNEL_URL = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL ?? '';

export const metadata: Metadata = {
  title: 'Brief quotidien BRVM — Résumé de séance | BRVM Analyst Pro',
  description:
    'Le résumé quotidien de la séance BRVM : indices, plus fortes hausses et baisses, volumes et actualités. Gratuit, généré automatiquement depuis les données officielles.',
  alternates: { canonical: `${SITE_URL}/brief` },
};

export default async function BriefPage() {
  const supabase = createPublicClient();
  const { data: briefs } = await supabase
    .from('brief_daily')
    .select('date_marche, contenu, sent_at')
    .order('date_marche', { ascending: false })
    .limit(20);

  const list = (briefs ?? []) as Array<{ date_marche: string; contenu: string; sent_at: string | null }>;

  return (
    <PublicShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <p className="text-[11px] text-accent/70 uppercase tracking-[0.18em] mb-1">Brief quotidien</p>
          <h1 className="font-display text-2xl md:text-3xl text-white mb-2">
            Le résumé de séance BRVM, chaque jour
          </h1>
          <p className="text-muted text-sm leading-relaxed">
            Indices, hausses, baisses, volumes et actualités — généré automatiquement après chaque
            clôture depuis les données officielles.
          </p>
          {TELEGRAM_CHANNEL_URL && (
            <a
              href={TELEGRAM_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 px-5 py-2.5 rounded-lg bg-accent text-bg font-semibold hover:bg-gold-2 transition-colors active:scale-95"
            >
              Recevoir le brief sur Telegram
            </a>
          )}
        </div>

        {list.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-10 text-center">
            <p className="text-muted text-sm">
              Le premier brief sera publié après la prochaine clôture de séance.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((b) => {
              const waText = encodeURIComponent(b.contenu);
              return (
                <article key={b.date_marche} className="bg-surface border border-border rounded-xl p-5 hover:border-accent/30 transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <Link
                      href={`/brief/${b.date_marche}`}
                      className="text-sm text-accent font-medium hover:text-gold-2 transition-colors"
                    >
                      Note de conjoncture — séance du {fmtDateFR(b.date_marche)} →
                    </Link>
                    <a
                      href={`https://wa.me/?text=${waText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] px-2.5 py-1 rounded-md border border-border text-muted hover:text-white hover:border-border-strong transition-colors shrink-0"
                      aria-label={`Partager le brief du ${fmtDateFR(b.date_marche)} sur WhatsApp`}
                    >
                      Partager sur WhatsApp
                    </a>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-white/90 leading-relaxed font-sans">
                    {b.contenu}
                  </pre>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
