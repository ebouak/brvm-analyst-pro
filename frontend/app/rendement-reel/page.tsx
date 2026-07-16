import { permanentRedirect } from 'next/navigation';

/**
 * Ancienne page « rendement réel » — fusionnée dans /rendement-vrai (vue
 * « cours seul · réel »). On redirige en 308 en préservant code + horizon,
 * pour ne casser aucun lien entrant ni la valeur SEO déjà acquise.
 */
export default function Page({
  searchParams,
}: {
  searchParams: { code?: string; annees?: string };
}) {
  const params = new URLSearchParams({ mode: 'reel' });
  if (searchParams.code) params.set('code', searchParams.code);
  if (searchParams.annees) params.set('annees', searchParams.annees);
  permanentRedirect(`/rendement-vrai?${params.toString()}`);
}
