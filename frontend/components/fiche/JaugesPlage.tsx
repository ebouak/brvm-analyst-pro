import type { Plage } from '@/lib/fiche/plages';
import { fmtNumber, fmtDateCourte } from '@/lib/format';

function Jauge({ titre, p, plein }: { titre: string; p: Plage | null; plein?: boolean }) {
  if (!p) return null;
  // Sans position (plage plate ou cours absent) : ni repère ni remplissage proportionnel.
  const pos = p.position != null ? Math.max(0, Math.min(1, p.position)) * 100 : null;
  const libelle = `${titre} : entre ${fmtNumber(p.bas)} et ${fmtNumber(p.haut)}${pos != null ? `, cours à ${Math.round(pos)} % de la plage` : ''}`;
  return (
    <div className="flex gap-4 rounded-card border border-border bg-surface py-[18px] pl-7 pr-5">
      <div role="img" aria-label={libelle} className="relative w-2 shrink-0 rounded bg-border">
        {plein ? (
          <div className="absolute inset-0 rounded bg-up" />
        ) : (
          pos != null && <div className="absolute inset-x-0 bottom-0 rounded bg-muted" style={{ height: `${pos}%` }} />
        )}
        {pos != null && (
          <span className="absolute -left-3 h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-ivory" style={{ bottom: `calc(${pos}% - 5px)` }} />
        )}
      </div>
      <div className="flex flex-col justify-between gap-3">
        <p className="text-xs text-faint">{titre}</p>
        <div><p className="text-xs text-faint">Haut{p.dateHaut ? ` · ${fmtDateCourte(p.dateHaut)}` : ''}</p><p className="tabular text-[17px] text-ivory">{fmtNumber(p.haut)}</p></div>
        <div><p className="text-xs text-faint">Bas{p.dateBas ? ` · ${fmtDateCourte(p.dateBas)}` : ''}</p><p className="tabular text-[17px] text-ivory">{fmtNumber(p.bas)}</p></div>
      </div>
    </div>
  );
}

export function JaugesPlage({ jour, an, deuxAns, hausseDuJour }: { jour: Plage | null; an: Plage | null; deuxAns: Plage | null; hausseDuJour: boolean }) {
  if (!jour && !an && !deuxAns) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Jauge titre="1 jour" p={jour} plein={hausseDuJour} />
      <Jauge titre="52 semaines" p={an} />
      <Jauge titre="2 ans" p={deuxAns} />
    </div>
  );
}
