'use client';

import { useCallback, useEffect, useState } from 'react';

type Row = {
  rank: number;
  alias: string;
  pnl_pct: number;
  positions_total: number;
  positions_closed: number;
  win_rate: number | null;
  since: string;
};

type Me = { optin: boolean; alias: string | null; rank: number | null } | null;

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Classement paper trading anonymisé (opt-in). Deux modes :
 * - `withControls` (page paper trading, connecté) : toggle de participation + alias.
 * - lecture seule (page publique /classement).
 */
export function PaperLeaderboard({ withControls = false }: { withControls?: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<Me>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/paper-trading/leaderboard');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRows(json.rows ?? []);
      setMe(json.me ?? null);
      if (json.me?.alias) setAliasInput(json.me.alias);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (optin: boolean) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/paper-trading/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optin, alias: aliasInput }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Échec');
      setMsg({
        kind: 'ok',
        text: optin ? 'Vous participez au classement.' : 'Vous avez quitté le classement.',
      });
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-panel border border-border bg-surface/40 p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="overline mb-1 text-gold-2">Classement</p>
          <h2 className="font-display text-xl text-ivory">Meilleures performances papier</h2>
          <p className="mt-1 max-w-[52ch] text-xs leading-relaxed text-muted">
            Perfs de trading fictif (capital papier), anonymisées et sur la base du volontariat.
            Aucune performance réelle — à but pédagogique.
          </p>
        </div>
        {me?.optin && me.rank != null && (
          <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 font-mono text-[11px] font-bold text-accent">
            Votre rang : #{me.rank}
          </span>
        )}
      </div>

      {rows === null ? (
        <div className="animate-pulse space-y-2" aria-hidden>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-elevated/50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-sunken/30 p-8 text-center">
          <p className="text-sm text-muted">
            Personne au classement pour l&apos;instant — soyez le premier à y entrer.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-mono text-[10px] uppercase tracking-wider text-faint">#</th>
                <th className="py-2 pr-3 font-mono text-[10px] uppercase tracking-wider text-faint">Investisseur</th>
                <th className="py-2 pr-3 text-right font-mono text-[10px] uppercase tracking-wider text-faint">Perf</th>
                <th className="hidden py-2 pr-3 text-right font-mono text-[10px] uppercase tracking-wider text-faint sm:table-cell">Trades clos</th>
                <th className="hidden py-2 text-right font-mono text-[10px] uppercase tracking-wider text-faint sm:table-cell">Réussite</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.rank}-${r.alias}`} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted">
                    {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-ivory">{r.alias}</td>
                  <td className={`tabular py-2.5 pr-3 text-right font-bold ${r.pnl_pct >= 0 ? 'text-up' : 'text-down'}`}>
                    {r.pnl_pct >= 0 ? '+' : ''}{r.pnl_pct.toFixed(2)} %
                  </td>
                  <td className="tabular hidden py-2.5 pr-3 text-right text-muted sm:table-cell">{r.positions_closed}</td>
                  <td className="tabular hidden py-2.5 text-right text-muted sm:table-cell">
                    {r.win_rate != null ? `${r.win_rate} %` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {withControls && me && (
        <div className="mt-5 border-t border-border pt-4">
          {me.optin ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted">
                Vous apparaissez comme <b className="text-ivory">{me.alias || 'alias auto'}</b>.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(false)}
                className="rounded-full border border-border px-4 py-2 text-xs text-muted transition-colors hover:border-down/40 hover:text-down disabled:opacity-50"
              >
                Quitter le classement
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="lb-alias" className="mb-1 block text-xs text-muted">
                  Alias public (optionnel — sinon un alias neutre est généré)
                </label>
                <input
                  id="lb-alias"
                  type="text"
                  maxLength={24}
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="Ex. : AigleDAbidjan"
                  className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-ivory placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(true)}
                className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian shadow-gold-sm transition hover:bg-gold-2 disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : 'Rejoindre le classement'}
              </button>
              <p className="w-full text-[10px] leading-relaxed text-faint">
                Participation volontaire et réversible. Seuls votre alias et vos métriques de jeu
                (perf %, nombre de trades) sont publics — jamais votre identité ni votre capital.
              </p>
            </div>
          )}
          {msg && (
            <p role="status" className={`mt-2 text-xs ${msg.kind === 'ok' ? 'text-up' : 'text-down'}`}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
