import { SectionHeader } from '@/components/ui/premium';

export const metadata = { title: 'Mentions légales' };

function GoldRule() {
  return <hr className="gold-rule" />;
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-base font-semibold text-ivory">{title}</h2>
      <div className="text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function MentionsLegalesPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

      <SectionHeader
        kicker="Informations légales"
        title="Mentions légales"
        subtitle="Document régissant les conditions d'édition et d'utilisation de la plateforme BRVM Analyst Pro."
      />

      <GoldRule />

      <LegalSection title="Éditeur">
        <p>
          BRVM Analyst Pro — Plateforme d'analyse financière BRVM/UEMOA.
          Service édité par Jean-Yves EBOUA.
        </p>
        <p className="mt-2">
          Contact :{' '}
          <a
            href="mailto:contact@brvm-analyst.pro"
            className="text-gold/80 underline underline-offset-2 hover:text-gold transition-colors"
          >
            contact@brvm-analyst.pro
          </a>
        </p>
      </LegalSection>

      <GoldRule />

      <LegalSection title="Hébergement">
        <p>
          Application hébergée sur Vercel (vercel.com). Base de données hébergée
          sur Supabase (supabase.com).
        </p>
      </LegalSection>

      <GoldRule />

      <LegalSection title="Sources de données">
        <p>
          Données de marché collectées auprès du portail BDFIN de la BRVM
          (Bourse Régionale des Valeurs Mobilières). Les signaux et indicateurs
          fournis sont à titre informatif et ne constituent pas un conseil en
          investissement personnalisé.
        </p>
      </LegalSection>

      <GoldRule />

      <LegalSection title="Avertissement réglementaire">
        <p>
          L'utilisation de cette plateforme se fait sous votre seule
          responsabilité. Les performances passées ne préjugent pas des
          performances futures.
        </p>
        <p className="mt-2">
          Conformément à la réglementation COSUMAF et UEMOA, aucune information
          diffusée sur cette plateforme ne doit être interprétée comme une
          recommandation d'achat ou de vente de valeurs mobilières.
        </p>
      </LegalSection>

    </div>
  );
}
