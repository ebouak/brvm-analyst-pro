import { SiteHeader } from '@/components/layout/SiteHeader';

/** Compat : redirige vers SiteHeader (même props). Supprimera OutilsMenu/MenuMobile morts. */
export function LandingNav({ marchesHref = '/#marche' }: { marchesHref?: string }) {
  return <SiteHeader marchesHref={marchesHref} />;
}
