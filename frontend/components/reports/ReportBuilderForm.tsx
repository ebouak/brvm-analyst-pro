'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ALL_BLOCKS, BLOCK_LABEL, type BlockKey } from '@/lib/reports/builder';

const SUB: Record<BlockKey, string> = {
  marche: 'Indices, breadth, volume, top hausses/baisses',
  action: 'Cours, signal, valorisation, fondamentaux',
  secteur: 'Performance du jour, meilleurs/pires titres',
  portefeuille: 'Composition, P&L latent',
};

export default function ReportBuilderForm({
  instruments, sectors,
}: { instruments: { code: string; designation: string }[]; sectors: string[] }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Record<BlockKey, boolean>>({ marche: true, action: true, secteur: true, portefeuille: false });
  const [code, setCode] = useState(instruments[0]?.code ?? '');
  const [secteur, setSecteur] = useState(sectors[0] ?? '');

  const selected = ALL_BLOCKS.filter((b) => blocks[b]);
  const toggle = (b: BlockKey) => setBlocks((s) => ({ ...s, [b]: !s[b] }));

  const href = useMemo(() => {
    const p = new URLSearchParams();
    p.set('blocs', selected.join(','));
    if (blocks.action && code) p.set('code', code);
    if (blocks.secteur && secteur) p.set('secteur', secteur);
    return `/rapports/print?${p.toString()}`;
  }, [selected, blocks.action, blocks.secteur, code, secteur]);

  const selCls = 'mt-2 w-full rounded-lg border border-border bg-bg/60 px-3 py-2 text-xs text-ivory focus:border-accent/40 focus:outline-none';

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 space-y-1">
      {ALL_BLOCKS.map((b) => (
        <div key={b} className="border-b border-border/40 py-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={blocks[b]} onChange={() => toggle(b)} className="mt-0.5 accent-accent h-4 w-4" />
            <span className="flex-1">
              <span className="block text-sm font-medium text-white">{BLOCK_LABEL[b]}</span>
              <span className="block text-[11px] text-faint">{SUB[b]}</span>
            </span>
          </label>
          {b === 'action' && blocks.action && (
            <select value={code} onChange={(e) => setCode(e.target.value)} className={selCls} aria-label="Choisir une action">
              {instruments.map((i) => <option key={i.code} value={i.code}>{i.designation} ({i.code})</option>)}
            </select>
          )}
          {b === 'secteur' && blocks.secteur && (
            <select value={secteur} onChange={(e) => setSecteur(e.target.value)} className={selCls} aria-label="Choisir un secteur">
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => router.push(href)}
          className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg disabled:opacity-40">
          📄 Générer le rapport
        </button>
        <span className="text-xs text-faint">{selected.length} bloc{selected.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
