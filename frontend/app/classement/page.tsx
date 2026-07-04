import type { Metadata } from 'next';
import Link from 'next/link';
import { PaperLeaderboard } from '@/components/PaperLeaderboard';

export const metadata: Metadata = {
  title: 'Classement paper trading BRVM — WESTBOURSE',
  description:
    'Le classement anonymisé des meilleures performances de trading fictif sur la BRVM. Entraînez-vous sans risque et mesurez-vous aux autres investisseurs.',
};

export const revalidate = 300;

/**
 * Page publique du classement paper trading : preuve sociale + acquisition.
 * Les données viennent de la RPC publique anonymisée (opt-in uniquement).
 */
export default function ClassementPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="overline mb-3 text-gold-2">Compétition · Paper trading</p>
      <h1 className="mb-3 font-display text-3xl text-ivory [letter-spacing:-0.03em] md:text-4xl">
        Qui lit le mieux le marché BRVM&nbsp;?
      </h1>
      <p className="mb-8 max-w-[60ch] text-sm leading-relaxed text-muted">
        Chaque membre peut gérer un portefeuille fictif alimenté par les cours réels de la BRVM,
        et choisir d&apos;apparaître ici sous alias. Zéro risque, vraies données, vraie discipline.
      </p>

      <PaperLeaderboard />

      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-panel border border-accent/25 bg-accent/[0.05] p-6">
        <div className="min-w-[240px] flex-1">
          <h2 className="mb-1 font-display text-xl text-ivory">Entrez dans la course</h2>
          <p className="text-[13px] leading-relaxed text-muted">
            Créez votre compte, initialisez un capital fictif et testez vos convictions
            sur les cours réels — avant d&apos;engager un seul franc.
          </p>
        </div>
        <Link
          href="/signup"
          className="landing-hero-cta inline-flex min-h-[46px] items-center rounded-full px-6 text-sm font-bold text-[#03222b] shadow-gold"
        >
          Créer mon compte gratuit
        </Link>
      </div>

      <p className="mt-6 text-[10px] leading-relaxed text-faint">
        Performances de portefeuilles fictifs (paper trading), affichées sur la base du volontariat
        et sous alias. Elles ne constituent ni des performances réelles, ni un conseil en
        investissement. Les performances passées ne préjugent pas des performances futures.
      </p>
    </div>
  );
}
