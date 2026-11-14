import brvmLogos from '@/lib/brvmLogos.json';

const LOGOS = brvmLogos as Record<string, string>;

/** Logo d'une société cotée, ou ses deux premières lettres quand aucun logo n'est connu. */
export default function LogoSociete({ code, taille = 28 }: { code: string; taille?: number }) {
  const src = LOGOS[code];
  const style = { width: taille, height: taille };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={taille} height={taille} style={style} className="shrink-0 rounded bg-white object-contain" />
  ) : (
    <span aria-hidden style={style} className="flex shrink-0 items-center justify-center rounded bg-sunken text-[10px] font-semibold text-muted">
      {code.slice(0, 2)}
    </span>
  );
}
