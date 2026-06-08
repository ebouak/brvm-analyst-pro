import { getOutilsData } from '@/lib/premium/outils';
import OutilsCharts from '@/components/premium/OutilsCharts';

export const revalidate = 3600;

export default async function OutilsPage() {
  const { actionsProchesBas, saisonnalite, reactionsEtats } = await getOutilsData();

  const nbProcheBas = actionsProchesBas.filter((a) => a.distance_pct < 5).length;
  const moisMeilleur = saisonnalite.reduce(
    (best, m) => (m.perf_moyenne > best.perf_moyenne ? m : best),
    saisonnalite[0] ?? { nom_mois: '—', perf_moyenne: 0 },
  );
  const moisPire = saisonnalite.reduce(
    (worst, m) => (m.perf_moyenne < worst.perf_moyenne ? m : worst),
    saisonnalite[0] ?? { nom_mois: '—', perf_moyenne: 0 },
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Outils Premium</h1>
        <p className="text-muted text-sm mt-1">Saisonnalité, actions proches de leurs bas, réaction aux états financiers</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Proches du plus bas</div>
          <div className="text-3xl font-bold text-down tabular">{nbProcheBas}</div>
          <div className="text-xs text-muted mt-1">actions à &lt;5% de leur plus bas 52s</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Meilleur mois historique</div>
          <div className="text-3xl font-bold text-up tabular">{moisMeilleur.nom_mois}</div>
          <div className="text-xs text-up mt-1">+{moisMeilleur.perf_moyenne.toFixed(2)}% en moyenne</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Pire mois historique</div>
          <div className="text-3xl font-bold text-warn tabular">{moisPire.nom_mois}</div>
          <div className="text-xs text-down mt-1">{moisPire.perf_moyenne.toFixed(2)}% en moyenne</div>
        </div>
      </div>

      {/* Main content */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <OutilsCharts
          actionsProchesBas={actionsProchesBas}
          saisonnalite={saisonnalite}
          reactionsEtats={reactionsEtats}
        />
      </div>
    </div>
  );
}
