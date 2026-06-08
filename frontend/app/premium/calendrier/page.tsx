import { getDatesClés, type TypeDate } from '@/lib/premium/calendrier';

const TYPE_CONFIG: Record<TypeDate, { label: string; color: string; bg: string }> = {
  publication:        { label: 'États financiers', color: 'text-info',  bg: 'bg-info/10' },
  dividende_annonce:  { label: 'Dividende annoncé', color: 'text-up',   bg: 'bg-up/10' },
  dividende_paiement: { label: 'Paiement dividende', color: 'text-up',  bg: 'bg-up/20' },
  ag:                 { label: 'Assemblée Générale', color: 'text-warn', bg: 'bg-warn/10' },
};

export default async function CalendrierPremiumPage() {
  const dates = await getDatesClés(12);
  const today = new Date().toISOString().split('T')[0]!;
  const passees = dates.filter((d) => d.date < today);
  const avenir  = dates.filter((d) => d.date >= today);

  const renderListe = (items: typeof dates, titre: string) => (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-faint uppercase tracking-widest mb-3">{titre}</h2>
      {items.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted text-sm">
          Aucune date enregistrée.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((d, i) => {
            const cfg = TYPE_CONFIG[d.type];
            const dateObj = new Date(d.date + 'T12:00:00Z');
            return (
              <div key={i} className="flex items-start gap-4 p-3 bg-surface border border-border rounded-xl hover:border-accent/20 transition-colors">
                <div className="text-center min-w-[52px]">
                  <p className="text-xs text-faint">{dateObj.toLocaleDateString('fr-FR', { month: 'short' })}</p>
                  <p className="text-lg font-bold text-white tabular">{String(dateObj.getUTCDate()).padStart(2, '0')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    {d.code && <a href={`/actions/${d.code}`} className="font-mono text-xs font-semibold text-accent hover:text-white">{d.code}</a>}
                    <span className="text-xs text-white">{d.designation}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-muted truncate">{d.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <span className="text-[10px] font-semibold text-warn uppercase tracking-widest">Premium</span>
        <h1 className="text-2xl font-bold text-white mt-1">Dates Clés</h1>
        <p className="text-sm text-muted mt-1">Publications, dividendes et Assemblées Générales sur 12 mois.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
            <span key={type} className={`px-2 py-0.5 rounded text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
          ))}
        </div>
      </div>
      {renderListe(avenir, `À venir (${avenir.length})`)}
      {renderListe(passees, `Passées — 3 derniers mois (${passees.length})`)}
    </div>
  );
}
