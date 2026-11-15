import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

/**
 * Couche de données de /admin/agregats. indicateur_source et
 * indicateur_relecture n'ont aucune lecture publique (0245) : service_role.
 * Lève en cas d'erreur — une file illisible n'est jamais affichée vide.
 */
export interface ObservationRelecture {
  id: string;
  valeur: number | null;
  /** Unité stockée : fcfa, usd (document en dollars, ETIT) ou pct. */
  unite: string | null;
  texte_original: string | null;
  unite_source: string | null;
  devise_source: string | null;
  perimetre: string;
  page: number | null;
  extrait: string | null;
  libelle_exact: string | null;
  document_url: string;
  document_libelle: string | null;
  controle_motif: string | null;
}

export interface ElementFile {
  id: string;
  code: string;
  indicateur: string;
  periode: string;
  date_arrete: string;
  perimetre: string;
  raison: 'contradiction' | 'controle';
  detail: string;
  cree_le: string;
  observations: ObservationRelecture[];
}

export async function chargerFileRelecture(): Promise<ElementFile[]> {
  const db = getServiceClient();
  type Ligne = Omit<ElementFile, 'observations'> & { observations: string[] | null };
  const items: Ligne[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from('indicateur_relecture')
      .select('id,code,indicateur,periode,date_arrete,perimetre,raison,detail,cree_le,observations')
      .eq('statut', 'ouverte').order('code').order('date_arrete', { ascending: false }).order('id').range(de, de + 999);
    if (error) throw new Error(`indicateur_relecture : ${error.message}`);
    items.push(...((data ?? []) as Ligne[]));
    if ((data ?? []).length < 1000) break;
  }
  const idsDe = (i: Ligne) => i.observations ?? [];
  const ids = [...new Set(items.flatMap(idsDe))];
  const obs = new Map<string, ObservationRelecture>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: e2 } = await db.from('indicateur_source')
      .select('id,valeur,unite,texte_original,unite_source,devise_source,perimetre,page,extrait,libelle_exact,document_url,document_libelle,controle_motif')
      .in('id', ids.slice(i, i + 200));
    if (e2) throw new Error(`indicateur_source : ${e2.message}`);
    for (const o of data ?? []) obs.set(o.id as string, { ...(o as ObservationRelecture), valeur: o.valeur == null ? null : Number(o.valeur) });
  }
  return items.map((i) => ({
    ...i,
    observations: idsDe(i).map((id) => obs.get(id)).filter((x): x is ObservationRelecture => !!x),
  }));
}
