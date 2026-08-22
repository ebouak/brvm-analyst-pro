import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

/**
 * Dernier rapport de Diagnostic IA réellement généré, pour l'exemple de la
 * landing.
 *
 * Pourquoi service-role : `diagnostic_reports` est protégé par RLS et la clé
 * anon de la landing n'y voit AUCUNE ligne (vérifié en curl). La section
 * affichait donc son état vide en permanence pour tout visiteur public.
 *
 * Ce n'est pas une donnée personnelle : un rapport porte sur une société
 * cotée, pas sur un utilisateur. On n'expose que le code de l'instrument, la
 * date et le texte d'analyse — jamais l'identifiant du demandeur.
 *
 * Renvoie `null` plutôt que de lever : la landing publique ne doit jamais
 * tomber parce qu'une variable d'environnement manque.
 */
export interface LatestDiagnostic {
  code: string;
  generated_at: string | null;
  markdown_content: string | null;
}

export async function getLatestDiagnostic(): Promise<LatestDiagnostic | null> {
  try {
    const { data, error } = await getServiceClient()
      .from('diagnostic_reports')
      .select('code, generated_at, markdown_content')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as LatestDiagnostic;
  } catch {
    return null;
  }
}
