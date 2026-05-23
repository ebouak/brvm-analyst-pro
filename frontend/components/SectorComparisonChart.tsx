'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';

export interface SectorBar { code: string; perf: number | null }

export default function SectorComparisonChart({ data }: { data: SectorBar[] }) {
  const rows = data.filter((d) => d.perf != null);
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">Performance par titre (%)</h3>
      <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 30)}>
        <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#232733" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#8b93a7', fontSize: 10 }} />
          <YAxis type="category" dataKey="code" tick={{ fill: '#8b93a7', fontSize: 10 }} width={56} />
          <Tooltip contentStyle={{ background: '#161922', border: '1px solid #232733', fontSize: 12 }} />
          <ReferenceLine x={0} stroke="#8b93a7" />
          <Bar dataKey="perf" name="Perf %">
            {rows.map((d, i) => <Cell key={i} fill={(d.perf ?? 0) >= 0 ? '#00c853' : '#f44336'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
