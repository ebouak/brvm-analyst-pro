import { repondreSuivi } from '@/lib/acquisition/routeSuivi';

// Lien de suivi : compte (agrégé, sans donnée personnelle) puis redirige. Voir lib/acquisition/.
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return repondreSuivi(request, 'chaine');
}
