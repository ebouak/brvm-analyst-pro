'use client';

import { useEffect, useState } from 'react';
import type { Stance, ThesisStatus } from '@/lib/theses/status';

interface TheseRow {
  stance: Stance; these: string; objectif: number | null; horizon: string | null;
  cours_reference: number | null; updated_at: string;
}
interface Check { status: ThesisStatus; perfPct: number | null; raisons: string[] }

const STANCE_LABEL: Record<Stance, string> = { achat: 'Achat', conserver: 'Conserver', vente: 'Vente' };
const STATUS_UI: Record<ThesisStatus, { label: string; cls: string }> = {
  intacte: { label: '✓ Thèse intacte', cls: 'text-up border-up/30 bg-up/5' },
  'a-revoir': { label: '⚠ À revoir', cls: 'text-warn border-warn/30 bg-warn/5' },
  'objectif-atteint': { label: '🎯 Objectif atteint', cls: 'text-info border-info/30 bg-info/5' },
};

export default function ThesisPanel({ code, coursActuel }: { code: string; coursActuel: number | null }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const [these, setThese] = useState<TheseRow | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Champs du formulaire
  const [stance, setStance] = useState<Stance>('achat');
  const [texte, setTexte] = useState('');
  const [objectif, setObjectif] = useState('');
  const [horizon, setHorizon] = useState('moyen');

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/theses?code=${code}`, { cache: 'no-store' });
    if (r.status === 401) { setAuthed(false); setLoading(false); return; }
    const j = await r.json();
    if (j.these) {
      setThese(j.these); setCheck(j.check ?? null);
      setStance(j.these.stance); setTexte(j.these.these);
      setObjectif(j.these.objectif != null ? String(j.these.objectif) : '');
      setHorizon(j.these.horizon ?? 'moyen');
    } else { setThese(null); setCheck(null); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [code]);

  async function save() {
    if (!texte.trim()) return;
    setSaving(true);
    await fetch('/api/theses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code, stance, these: texte,
        objectif: objectif ? Number(objectif) : null,
        horizon, cours_reference: these?.cours_reference ?? coursActuel,
      }),
    });
    setSaving(false); setEditing(false); await load();
  }
  async function remove() {
    await fetch(`/api/theses?code=${code}`, { method: 'DELETE' });
    setThese(null); setCheck(null); setEditing(false);
  }

  if (loading) return <div className="h-24 bg-elevated rounded-xl animate-pulse" />;
  if (!authed) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 text-sm text-muted">
        Connectez-vous pour rédiger et suivre votre thèse d&apos;investissement sur {code}.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Ma thèse d&apos;investissement</h3>
        {these && check && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_UI[check.status].cls}`}>
            {STATUS_UI[check.status].label}
          </span>
        )}
      </div>

      {!these && !editing && (
        <button type="button" onClick={() => setEditing(true)}
          className="text-xs px-3 py-1.5 rounded-lg border border-info/30 bg-info/[0.06] text-info hover:bg-info/10">
          + Rédiger ma thèse
        </button>
      )}

      {these && !editing && (
        <>
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <span>Conviction : <b className="text-white">{STANCE_LABEL[these.stance]}</b></span>
            {these.objectif != null && <span>Objectif : <b className="text-white">{these.objectif.toLocaleString('fr-FR')} FCFA</b></span>}
            {these.horizon && <span>Horizon : <b className="text-white">{these.horizon}</b></span>}
            {check?.perfPct != null && (
              <span>Depuis rédaction : <b className={check.perfPct >= 0 ? 'text-up' : 'text-down'}>{check.perfPct >= 0 ? '+' : ''}{check.perfPct.toFixed(1)}%</b></span>
            )}
          </div>
          <p className="text-sm text-ivory/90 whitespace-pre-wrap leading-relaxed">{these.these}</p>
          {check && check.raisons.length > 0 && (
            <ul className="text-[11px] text-warn list-disc pl-4 space-y-0.5">
              {check.raisons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-info hover:underline">Modifier</button>
            <button type="button" onClick={remove} className="text-xs text-down hover:underline">Supprimer</button>
          </div>
        </>
      )}

      {editing && (
        <div className="space-y-2">
          <div className="flex gap-1">
            {(['achat', 'conserver', 'vente'] as Stance[]).map((s) => (
              <button key={s} type="button" onClick={() => setStance(s)}
                className={`text-xs px-2.5 py-1 rounded-md border ${stance === s ? 'border-info text-info bg-info/10' : 'border-border text-muted'}`}>
                {STANCE_LABEL[s]}
              </button>
            ))}
          </div>
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={2000} rows={4}
            placeholder="Pourquoi cette conviction ? (fondamentaux, catalyseurs, risques…)"
            className="w-full text-sm bg-bg/40 border border-border rounded-lg p-2 text-ivory placeholder:text-faint" />
          <div className="flex gap-2">
            <input value={objectif} onChange={(e) => setObjectif(e.target.value)} inputMode="numeric"
              placeholder="Objectif cours (FCFA)" className="flex-1 text-sm bg-bg/40 border border-border rounded-lg p-2 text-ivory placeholder:text-faint" />
            <select value={horizon} onChange={(e) => setHorizon(e.target.value)}
              className="text-sm bg-bg/40 border border-border rounded-lg p-2 text-ivory">
              <option value="court">Court terme</option>
              <option value="moyen">Moyen terme</option>
              <option value="long">Long terme</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving || !texte.trim()}
              className="text-xs px-3 py-1.5 rounded-lg bg-info/15 text-info disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" onClick={() => { setEditing(false); if (!these) setTexte(''); }} className="text-xs text-muted hover:text-white px-2">Annuler</button>
          </div>
          <p className="text-[10px] text-faint">Donnée privée, visible de vous seul. Exportable et supprimable depuis votre compte (RGPD).</p>
        </div>
      )}
    </div>
  );
}
