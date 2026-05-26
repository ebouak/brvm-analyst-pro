export const metadata = { title: 'Mentions légales' };

export default function MentionsLegalesPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Mentions légales</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Éditeur</h2>
        <p className="text-sm text-muted">
          BRVM Analyst Pro — Plateforme d'analyse financière BRVM/UEMOA.
          Service édité par Jean-Yves EBOUA. Contact :{' '}
          <a href="mailto:contact@brvm-analyst.pro" className="text-up underline">
            contact@brvm-analyst.pro
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Hébergement</h2>
        <p className="text-sm text-muted">
          Application hébergée sur Vercel (vercel.com). Base de données hébergée
          sur Supabase (supabase.com).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Sources de données</h2>
        <p className="text-sm text-muted">
          Données de marché collectées auprès du portail BDFIN de la BRVM
          (Bourse Régionale des Valeurs Mobilières). Les signaux et indicateurs
          fournis sont à titre informatif et ne constituent pas un conseil en
          investissement personnalisé.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Avertissement</h2>
        <p className="text-sm text-muted">
          L'utilisation de cette plateforme se fait sous votre seule
          responsabilité. Les performances passées ne préjugent pas des
          performances futures. Conformément à la réglementation COSUMAF et
          UEMOA, aucune information ne doit être interprétée comme une
          recommandation d'achat ou de vente.
        </p>
      </section>
    </div>
  );
}
