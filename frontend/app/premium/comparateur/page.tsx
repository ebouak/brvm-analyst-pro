import { getAssetComparison } from '@/lib/compare/server';
import AssetComparisonChart from '@/components/premium/AssetComparisonChart';
import { SectionHeader, PremiumPanel, StatPill, EmptyStatePremium } from '@/components/ui/premium';

export const revalidate = 3600;
export const metadata = { title: 'Comparateur multi-actifs' };

const pct = (v: number | null, d = 1) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`);

export default async function ComparateurPage() {
  const points = await getAssetComparison();
  const hasData = points.some((p) => p.ret != null && p.kind === 'marche');

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <SectionHeader
        kicker="Allocation · arbitrage"
        title="Comparateur multi-actifs"
        subtitle="Rendement vs risque des grandes classes d'actifs BRVM — actions, obligations, revenu dividende, sans-risque."
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />

      {!hasData ? (
        <EmptyStatePremium icon="◎" title="Données insuffisantes" hint="L'historique de l'indice BRVM-C s'étoffera séance après séance." />
      ) : (
        <>
          <PremiumPanel glow className="p-5">
            <AssetComparisonChart points={points} />
            <p className="mt-3 text-[11px] text-faint">
              Plus un point est haut, plus le rendement attendu est élevé ; plus il est à droite, plus le risque l'est.
              L'arbitrage idéal cherche le meilleur rendement pour un risque donné (vers le haut-gauche).
            </p>
          </PremiumPanel>

          <PremiumPanel className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 px-4">Classe d'actif</th>
                  <th className="text-right py-2 px-4">Rendement</th>
                  <th className="text-right py-2 px-4">Risque (vol.)</th>
                  <th className="text-right py-2 px-4">Sharpe</th>
                  <th className="text-left py-2 px-4">Lecture</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.label} className="border-b border-border/40">
                    <td className="py-2 px-4 font-medium text-white">{p.label}</td>
                    <td className={`py-2 px-4 text-right tabular ${(p.ret ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>{pct(p.ret)}</td>
                    <td className="py-2 px-4 text-right tabular text-muted">{p.vol != null ? `${(p.vol * 100).toFixed(1)}%` : '—'}</td>
                    <td className="py-2 px-4 text-right tabular text-ivory">{p.sharpe != null ? p.sharpe.toFixed(2) : '—'}</td>
                    <td className="py-2 px-4 text-xs text-faint">{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PremiumPanel>

          <p className="text-[11px] text-faint leading-relaxed border-l-2 border-border pl-3">
            Rendements actions/marché : historique BRVM-C sur 2 ans (rendements quotidiens annualisés). Obligations : YTM
            moyen des titres cotés (volatilité du revenu fixe non estimée). Revenu dividende : rendement moyen des sociétés
            distributrices. Sans-risque : 6% (obligations d'État UEMOA). Outil informatif.
          </p>
        </>
      )}
    </div>
  );
}
