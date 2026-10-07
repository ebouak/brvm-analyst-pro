import Link from 'next/link';
import { fmtNumber } from '@/lib/format';

export function SeanceStrip({ asOf, nbActions, href = '/apercu/dashboard' }: { asOf: string | null; nbActions: number | null; href?: string }) {
  return (
    <div className="seance-strip">
      <span className="num" style={{ fontSize: 12, color: 'rgb(var(--color-muted))' }}>
        Séance {asOf ? <b style={{ color: 'rgb(var(--color-ivory))' }}>{asOf}</b> : '—'} {nbActions != null && <span>· {fmtNumber(nbActions)} valeurs</span>}
      </span>
      <Link href={href} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600 }}>Voir →</Link>
    </div>
  );
}
