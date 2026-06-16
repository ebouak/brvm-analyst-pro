import { getServiceClient } from '@/lib/billing/serviceClient';

export type ContentKind = 'news' | 'communique' | 'bulletin';

export interface ContentField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'textarea';
  required?: boolean;
}

export interface KindConfig {
  table: string;
  label: string;
  dateCol: string;
  titleCol: string;
  fields: ContentField[];
}

export const CONTENT_KINDS: Record<ContentKind, KindConfig> = {
  news: {
    table: 'brvm_news', label: 'Actualités', dateCol: 'date_publication', titleCol: 'titre',
    fields: [
      { key: 'titre', label: 'Titre', type: 'text', required: true },
      { key: 'date_publication', label: 'Date', type: 'date', required: true },
      { key: 'resume', label: 'Résumé', type: 'textarea' },
      { key: 'source_url', label: 'Source (URL)', type: 'text' },
      { key: 'secteur', label: 'Secteur', type: 'text' },
    ],
  },
  communique: {
    table: 'brvm_communiques', label: 'Communiqués', dateCol: 'date_publication', titleCol: 'titre',
    fields: [
      { key: 'titre', label: 'Titre', type: 'text', required: true },
      { key: 'date_publication', label: 'Date', type: 'date', required: true },
      { key: 'emetteur', label: 'Émetteur', type: 'text' },
      { key: 'categorie', label: 'Catégorie', type: 'text' },
      { key: 'source_url', label: 'Source (URL)', type: 'text' },
      { key: 'document_url', label: 'Document (URL)', type: 'text' },
      { key: 'resume', label: 'Résumé', type: 'textarea' },
    ],
  },
  bulletin: {
    table: 'brvm_bulletins', label: 'Bulletins', dateCol: 'date_bulletin', titleCol: 'numero',
    fields: [
      { key: 'numero', label: 'Numéro', type: 'text' },
      { key: 'date_bulletin', label: 'Date', type: 'date', required: true },
      { key: 'source_url', label: 'Source (URL)', type: 'text' },
      { key: 'document_url', label: 'Document (URL)', type: 'text' },
      { key: 'resume', label: 'Résumé', type: 'textarea' },
    ],
  },
};

export interface ContentRow {
  id: string;
  title: string;
  date: string | null;
  hidden: boolean;
  source_url: string | null;
  document_url: string | null;
  /** Valeurs des champs éditables (clé→texte) pour préremplir le formulaire d'édition. */
  values: Record<string, string>;
}

export interface ContentDashboard {
  rows: ContentRow[];
  kpis: { total: number; hidden: number; lastDate: string | null };
}

/** Charge une liste de contenu (service-role, inclut les masqués) + KPIs. */
export async function loadContent(kind: ContentKind, search?: string): Promise<ContentDashboard> {
  const cfg = CONTENT_KINDS[kind];
  const db = getServiceClient();
  let q = db.from(cfg.table).select('*').order(cfg.dateCol, { ascending: false }).limit(200);
  if (search && search.trim()) q = q.ilike(cfg.titleCol, `%${search.trim()}%`);
  const { data } = await q;
  const raw = (data ?? []) as Record<string, unknown>[];
  const rows: ContentRow[] = raw.map((r) => ({
    id: r.id as string,
    title: (r[cfg.titleCol] as string) || '(sans titre)',
    date: (r[cfg.dateCol] as string) ?? null,
    hidden: Boolean(r.hidden),
    source_url: (r.source_url as string) ?? null,
    document_url: (r.document_url as string) ?? null,
    values: Object.fromEntries(cfg.fields.map((f) => [f.key, r[f.key] != null ? String(r[f.key]) : ''])),
  }));
  return {
    rows,
    kpis: { total: rows.length, hidden: rows.filter((r) => r.hidden).length, lastDate: rows[0]?.date ?? null },
  };
}
