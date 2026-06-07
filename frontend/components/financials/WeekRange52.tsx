import { formatCours } from '@/lib/financials/formatters';

interface Props {
  bas: number | null;
  haut: number | null;
  actuel: number | null;
}

export default function WeekRange52({ bas, haut, actuel }: Props) {
  const noData = bas == null || haut == null || actuel == null || bas === haut;
  const position = noData
    ? 0
    : Math.max(0, Math.min(100, ((actuel! - bas!) / (haut! - bas!)) * 100));

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted uppercase tracking-wider">Plage 52 semaines</p>
      <div className="bg-gray-700 h-2 rounded-full relative">
        {!noData && (
          <div
            className="absolute w-3 h-3 rounded-full bg-green-400 -top-0.5 -translate-x-1/2"
            style={{ left: `${position}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-muted mt-1">
        <span>Bas : {formatCours(bas)}</span>
        <span>Actuel : {formatCours(actuel)}</span>
        <span>Haut : {formatCours(haut)}</span>
      </div>
    </div>
  );
}
