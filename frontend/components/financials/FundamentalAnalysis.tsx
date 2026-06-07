import { FundamentalRatios } from '@/lib/financials/types';
import {
  formatXOF,
  formatPct,
  formatRatio,
  formatGrowth,
  colorClass,
} from '@/lib/financials/formatters';

interface Props {
  ratios: FundamentalRatios;
}

function Row({
  label,
  value,
  cls,
}: {
  label: string;
  value: string;
  cls: string;
}) {
  const isUnavailable = value === 'non disponible';
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-muted">{label}</span>
      {isUnavailable ? (
        <span className="text-sm text-gray-400 italic">non disponible</span>
      ) : (
        <span className={`text-sm font-medium ${cls}`}>{value}</span>
      )}
    </div>
  );
}

function Bloc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-xs text-muted uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function FundamentalAnalysis({ ratios }: Props) {
  const payoutCls =
    ratios.payout != null && ratios.payout > 100
      ? 'text-orange-400'
      : colorClass(ratios.payout);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Bloc title="Générales">
        <Row
          label="Capitalisation boursière"
          value={formatXOF(ratios.capitalisation)}
          cls="text-white"
        />
        <Row
          label="BPA"
          value={ratios.bpa != null ? `${formatRatio(ratios.bpa)} FCFA` : 'non disponible'}
          cls={colorClass(ratios.bpa)}
        />
        <Row
          label="Rendement dividende"
          value={formatPct(ratios.rendement_dividende)}
          cls={colorClass(ratios.rendement_dividende)}
        />
      </Bloc>

      <Bloc title="Évaluation">
        <Row label="PER" value={formatRatio(ratios.per)} cls="text-white" />
        <Row label="P/Valeur comptable" value={formatRatio(ratios.pb)} cls="text-white" />
        <Row label="P/CA" value={formatRatio(ratios.ps)} cls="text-white" />
      </Bloc>

      <Bloc title="Rentabilité">
        <Row label="ROE" value={formatPct(ratios.roe)} cls={colorClass(ratios.roe)} />
        <Row
          label="Marge nette"
          value={formatPct(ratios.marge_nette)}
          cls={colorClass(ratios.marge_nette)}
        />
      </Bloc>

      <Bloc title="Effet de levier">
        <Row
          label="Dette/Capitaux propres"
          value={formatRatio(ratios.dette_sur_capitaux_propres)}
          cls={colorClass(ratios.dette_sur_capitaux_propres, { inverse: true })}
        />
        <Row
          label="Taux de distribution"
          value={formatPct(ratios.payout)}
          cls={payoutCls}
        />
      </Bloc>

      <Bloc title="Croissance">
        <Row
          label="Croissance CA"
          value={formatGrowth(ratios.croissance_ca)}
          cls={colorClass(ratios.croissance_ca)}
        />
        <Row
          label="Croissance RN"
          value={formatGrowth(ratios.croissance_rn)}
          cls={colorClass(ratios.croissance_rn)}
        />
      </Bloc>
    </div>
  );
}
