export default function UpgradePage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <div className="text-center mb-10">
        <span className="inline-block px-3 py-1 rounded-full bg-warn/10 text-warn text-xs font-semibold uppercase tracking-widest mb-4">
          Premium
        </span>
        <h1 className="text-3xl font-bold text-white mb-3">Accès Premium BRVM</h1>
        <p className="text-muted text-sm leading-relaxed max-w-lg mx-auto">
          Débloquez les outils d'analyse avancée réservés aux investisseurs professionnels sur la BRVM.
        </p>
      </div>

      <div className="grid gap-4 mb-10">
        {[
          { icon: '📊', title: 'Classements multi-critères', desc: 'PBR, PER, marge nette, liquidité, performance, volatilité, rotation — 9 classements actualisés.' },
          { icon: '📅', title: 'Calendrier des dates clés', desc: 'Dates de publication des états financiers, annonces et versements de dividendes, Assemblées Générales.' },
          { icon: '🔍', title: 'Détection d\'anomalies', desc: '4 analyses visuelles : scatter dividendes, liquidité/volatilité, heatmap 20 séances, marge vs croissance.' },
        ].map((f) => (
          <div key={f.title} className="flex gap-4 p-4 bg-surface border border-border rounded-xl">
            <span className="text-2xl shrink-0">{f.icon}</span>
            <div>
              <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
              <p className="text-xs text-muted leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 text-center">
        <p className="text-sm text-muted mb-4">
          Pour souscrire, contactez-nous. Votre accès sera activé sous 24h.
        </p>
        <a
          href="mailto:ebouak@gmail.com?subject=Abonnement%20Premium%20WESTBOURSE"
          className="inline-block px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Contacter pour souscrire
        </a>
      </div>
    </div>
  );
}
