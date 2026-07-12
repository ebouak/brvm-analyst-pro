import type { EmbedTheme, EmbedLang } from '@/lib/embed/params';
import { T } from '@/lib/embed/i18n';

/**
 * Origine CANONIQUE du site. `westbourse.com` redirige en 308 vers `www.` :
 * s'en servir imposerait un saut de redirection à chaque clic sur le backlink
 * (mauvais pour le SEO) et à chaque chargement de widget.
 */
export const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.westbourse.com';

/**
 * Lien retour — l'objectif SEO du widget (backlink dofollow). L'UTM permet de
 * mesurer les clics réellement issus des widgets.
 * NB : l'UTM crée une URL distincte de la canonique ; c'est sans effet tant que
 * la page d'atterrissage porte un canonical auto-référent (assuré par
 * `metadataBase` dans app/layout.tsx).
 */
export const BACKLINK = `${SITE}/?utm_source=widget&utm_medium=embed&utm_campaign=brvm-widget`;

/** Coque commune des widgets : fond selon le thème + lien retour. */
export default function EmbedFrame({
  theme,
  lang,
  children,
}: {
  theme: EmbedTheme;
  lang: EmbedLang;
  children: React.ReactNode;
}) {
  const dark = theme === 'dark';
  return (
    <div
      className={`flex flex-col gap-1 p-2 font-sans ${
        dark ? 'bg-[#030303] text-[#FCFCFC]' : 'bg-white text-[#101418]'
      }`}
    >
      {children}
      <a
        href={BACKLINK}
        target="_blank"
        rel="noopener"
        className={`self-end text-[10px] tracking-wide hover:underline ${
          dark ? 'text-[#56d7fd]' : 'text-[#0c8fae]'
        }`}
      >
        {T[lang].donnees} · WESTBOURSE
      </a>
    </div>
  );
}
