'use client';

import { useState, useTransition } from 'react';
import { PremiumPanel } from '@/components/ui/premium';
import { ajouterFerieAction, supprimerFerieAction } from './actions';

export interface FerieRow {
  date: string;
  country_code: string | null;
  holiday_name: string | null;
  notes: string | null;
}

const PAYS_UEMOA = [
  { code: '', label: 'Toute la zone UEMOA (BRVM)' },
  { code: 'CI', label: 'CI · Côte d’Ivoire' },
  { code: 'SN', label: 'SN · Sénégal' },
  { code: 'BJ', label: 'BJ · Bénin' },
  { code: 'BF', label: 'BF · Burkina Faso' },
  { code: 'ML', label: 'ML · Mali' },
  { code: 'NE', label: 'NE · Niger' },
  { code: 'TG', label: 'TG · Togo' },
  { code: 'GW', label: 'GW · Guinée-Bissau' },
];

export default function CalendrierClient({
  rows,
  canEdit,
}: {
  rows: FerieRow[];
  canEdit: boolean;
}) {
  const [date, setDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [countryCode, setCountryCode] = useState('CI');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const r = await ajouterFerieAction({ date, holidayName, countryCode, notes });
      if (r.ok) {
        setDate('');
        setHolidayName('');
        setNotes('');
        setMsg({ ok: true, text: 'Jour férié enregistré.' });
      } else {
        setMsg({ ok: false, text: r.error ?? 'Échec.' });
      }
    });
  }

  function onDelete(d: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await supprimerFerieAction(d);
      setMsg(
        r.ok
          ? { ok: true, text: `Entrée ${d} supprimée.` }
          : { ok: false, text: r.error ?? 'Suppression impossible.' },
      );
    });
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <PremiumPanel className="p-5">
          <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-4">
            <label className="block space-y-1">
              <span className="text-xs text-muted">Date</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="tabular w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
              />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs text-muted">Motif / Fête</span>
              <input
                type="text"
                required
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="Ex. Fête nationale, Maouloud, Tabaski…"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Pays / Zone</span>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
              >
                {PAYS_UEMOA.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 sm:col-span-3">
              <span className="text-xs text-muted">Notes (optionnel)</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Référence communiqué BRVM…"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ivory"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg hover:opacity-90 disabled:opacity-50"
              >
                {pending ? 'Enregistrement…' : 'Ajouter un férié'}
              </button>
            </div>
          </form>
          {msg && <p className={`mt-3 text-xs ${msg.ok ? 'text-up' : 'text-down'}`}>{msg.text}</p>}
        </PremiumPanel>
      )}

      <PremiumPanel className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-faint">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Pays</th>
              <th className="px-4 py-3 font-medium">Motif</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              {canEdit && <th className="px-4 py-3 text-right font-medium">Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-4 py-6 text-center text-muted">
                  Aucun jour chômé déclaré.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.date} className="border-b border-border/40 last:border-0">
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-ivory">{r.date}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{r.country_code ?? 'UEMOA'}</td>
                  <td className="px-4 py-2.5 text-ivory">{r.holiday_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{r.notes ?? '—'}</td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onDelete(r.date)}
                        className="rounded border border-down/40 px-2.5 py-1 text-xs text-down hover:bg-down/10 disabled:opacity-40"
                      >
                        Supprimer
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </PremiumPanel>
    </div>
  );
}
