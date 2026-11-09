/** `premier` resserre l'espace au-dessus d'un chapitre qui suit directement l'en-tête de page. */
export function Chapitre({ id, numero, titre, sousTitre, premier }: { id: string; numero: string; titre: string; sousTitre: string; premier?: boolean }) {
  return (
    <div id={id} className={`${premier ? 'mt-8 pt-8' : 'mt-16 pt-11'} grid scroll-mt-24 grid-cols-[48px_1fr] gap-y-1 border-t border-border-strong`}>
      <span className="tabular pt-2.5 text-sm text-accent-ink">{numero}</span>
      <h2 className="font-display text-3xl leading-tight text-ivory md:text-[34px]">{titre}</h2>
      <p className="col-start-2 text-sm text-faint">{sousTitre}</p>
    </div>
  );
}
