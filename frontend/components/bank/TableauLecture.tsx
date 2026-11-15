import { montantLigne, ratioLigne } from '@/lib/bank/format';
import type { LectureBancaire, LigneAgregat } from '@/lib/bank/lecture';

/**
 * Bloc bancaire de la fiche et de la carte bancaire : mêmes agrégats, mêmes
 * ratios, même vocabulaire que la Revue (lib/bank/lecture.ts). Chaque montant
 * porte l'unité de sa source (FCFA ou USD) ; chaque libellé renvoie au
 * document publié.
 */
function Ligne({ l }: { l: LigneAgregat }) {
  const s = l.valeur.source;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-xs text-muted">
        {s ? (
          <a href={s.document_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {l.libelle}{s.page ? ` (p. ${s.page})` : ''}
          </a>
        ) : l.libelle}
      </span>
      <span className="tabular text-sm font-medium text-ivory">{montantLigne(l.valeur.valeur, l.unite)}</span>
    </div>
  );
}

export default function TableauLecture({ lecture }: { lecture: LectureBancaire }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-xs text-muted">Compte de résultat bancaire ({lecture.libelle})</h3>
        {lecture.compteResultat.map((l) => <Ligne key={l.cle} l={l} />)}
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-xs text-muted">Encours et solidité</h3>
        {lecture.encours.map((l) => <Ligne key={l.cle} l={l} />)}
        {lecture.ratios.map((r) => (
          <div key={r.cle} className="border-b border-border/40 py-1.5 last:border-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted">{r.libelle}</span>
              <span className="tabular text-sm font-medium text-ivory">{ratioLigne(r.valeur)}</span>
            </div>
            <p className="text-[11px] text-faint">{r.phrase}{r.mention ? ` (${r.mention})` : ''}</p>
          </div>
        ))}
      </div>
      {lecture.mentionNonPublies && <p className="text-[11px] text-faint md:col-span-2">{lecture.mentionNonPublies}</p>}
    </div>
  );
}
