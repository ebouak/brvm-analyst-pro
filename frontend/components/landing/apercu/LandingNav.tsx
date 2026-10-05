import { SiteHeader } from '@/components/layout/SiteHeader';
export function LandingNav({ marchesHref = '/#marche' }: { marchesHref?: string }) {
  return <SiteHeader marchesHref={marchesHref} />;
}
