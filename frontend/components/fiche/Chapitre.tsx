export function Chapitre({ id, numero, titre, sousTitre }: { id: string; numero: string; titre: string; sousTitre: string }) {
  return (
    <div id={id} className="mt-16 grid scroll-mt-24 grid-cols-[48px_1fr] gap-y-1 border-t border-border-strong pt-11">
      <span className="tabular pt-2.5 text-sm text-accent-ink">{numero}</span>
      <h2 className="font-display text-3xl leading-tight text-ivory md:text-[34px]">{titre}</h2>
      <p className="col-start-2 text-sm text-faint">{sousTitre}</p>
    </div>
  );
}
