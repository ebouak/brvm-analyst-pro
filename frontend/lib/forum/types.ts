// frontend/lib/forum/types.ts
export type TopicCategory = 'instrument' | 'evenement' | 'general';

export interface ForumTopic {
  id: string;
  author_id: string | null;
  title: string;
  body: string;
  instrument_code: string | null;
  event_id: string | null;
  hidden: boolean;
  created_at: string;
  last_activity_at: string;
}

export interface ForumPost {
  id: string;
  topic_id: string;
  author_id: string | null;
  body: string;
  hidden: boolean;
  created_at: string;
  edited_at: string | null;
}

/** Profil minimal pour l'affichage de l'auteur. */
export interface AuthorProfile {
  id: string;
  display_name: string | null;
}
