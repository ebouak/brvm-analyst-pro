import type { Quality } from '@/lib/fundamentals';

interface Props {
  label: string;
  value: string;
  quality?: Quality;
  positive?: boolean | null;
  /** Raison d'absence (« non calculable, perte »…) : remplace « non disponible ». */
  motif?: string | null;
  /** Formule en sous-libellé (« cours ÷ BPA »). */
  formule?: string;
}

function Libelle({ label, formule }: { label: string; formule?: string }) {
  return (
    <span className="text-muted">
      {label}
      {formule && <span className="block text-[11px] leading-tight text-faint">{formule}</span>}
    </span>
  );
}

/** Ligne ratio dans une carte de section (style Trading 212, dark finance). */
export default function RatioCard({ label, value, quality = 'ok', positive, motif, formule }: Props) {
  if (quality === 'missing') {
    return (
      <div className="flex items-center justify-between gap-3 py-2 text-sm">
        <Libelle label={label} formule={formule} />
        <span className="text-right text-muted">{motif ?? 'non disponible'}</span>
      </div>
    );
  }
  const colorCls = positive == null ? 'text-white' : positive ? 'text-up' : 'text-down';
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <Libelle label={label} formule={formule} />
      <span className={`tabular shrink-0 whitespace-nowrap ${quality === 'suspect' ? 'text-warn' : colorCls}`}>
        {value}
        {quality === 'suspect' && <span title="Donnée douteuse" className="ml-1">!</span>}
      </span>
    </div>
  );
}
