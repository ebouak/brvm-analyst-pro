'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ecarterTikTok, publierTikTok, statutPublicationTikTok } from '@/app/admin/reseaux/tiktok/actions';
import {
  LIBELLE_VISIBILITE,
  MESSAGE_MARQUE_PRIVEE,
  MESSAGE_SANS_OPTION,
  choixInitial,
  declaration,
  etiquetteCommerciale,
  validerChoix,
  type ChoixPublication,
  type CreatorInfo,
  type TypeContenu,
} from '@/lib/social/tiktokRegles';

/**
 * Écran « Publier sur TikTok », conforme aux Content Sharing Guidelines :
 * compte affiché, aperçu, titre modifiable, visibilité SANS défaut, interactions
 * décochées (grisées si le compte les a désactivées), déclaration commerciale
 * désactivée par défaut, déclaration de consentement avant le bouton, puis
 * suivi du traitement. Le serveur rejoue toutes ces règles avant d'envoyer.
 */
export default function PublierTikTok({
  cible,
  cibleId,
  type,
  media,
  titre,
  description,
  dureeS,
  info,
}: {
  cible: string;
  cibleId: string;
  type: TypeContenu;
  media: string[];
  titre: string;
  description: string;
  dureeS: number | null;
  info: CreatorInfo;
}) {
  const [c, setC] = useState<ChoixPublication>(() => choixInitial(titre, description));
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [statut, setStatut] = useState<string | null>(null);
  const router = useRouter();
  const maj = (p: Partial<ChoixPublication>) => setC((x) => ({ ...x, ...p }));

  const verdict = useMemo(() => validerChoix(c, info, type, dureeS), [c, info, type, dureeS]);
  const etiquette = etiquetteCommerciale(c, type);
  const decl = declaration(c);
  const marquePrivee = c.commercial && c.contenuDeMarque;

  // Règle 5 : suivre le traitement jusqu'à un état final (3 minutes au plus).
  useEffect(() => {
    if (!publishId) return;
    let fini = false;
    let n = 0;
    const tic = async () => {
      if (fini || n++ > 36) return;
      const s = await statutPublicationTikTok(publishId);
      if (s) setStatut(s.raison ? `${s.statut} (${s.raison})` : s.statut);
      if (s && (s.statut === 'PUBLISH_COMPLETE' || s.statut === 'FAILED')) return;
      setTimeout(tic, 5000);
    };
    tic();
    return () => {
      fini = true;
    };
  }, [publishId]);

  if (publishId) {
    return (
      <div className="space-y-2 rounded-panel border border-up/40 bg-surface p-5 text-sm">
        <p className="text-up">Publication envoyée à TikTok.</p>
        <p className="text-muted">
          Le traitement par TikTok peut prendre quelques minutes avant que la publication apparaisse sur le profil.
        </p>
        <p className="text-ivory">Statut : {statut ?? 'en attente…'}</p>
      </div>
    );
  }

  const nom = info.creator_nickname ?? info.creator_username ?? 'compte connecté';
  return (
    <div className="space-y-4 rounded-panel border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        {info.creator_avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.creator_avatar_url} alt="" width={36} height={36} className="rounded-full" />
        )}
        <p className="text-sm text-ivory">
          Publication sur le compte TikTok <b>{nom}</b>
          {info.creator_username ? <span className="text-muted"> (@{info.creator_username})</span> : null}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div>
          {type === 'video' ? (
            <video src={media[0]} controls playsInline preload="metadata" className="w-full rounded-lg border border-border" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media[0]} alt="Aperçu de la photo" className="w-full rounded-lg border border-border" />
          )}
          <p className="mt-1 text-[11px] text-faint">Aperçu du contenu publié.</p>
        </div>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-muted">Titre</span>
            <textarea
              value={c.titre}
              onChange={(e) => maj({ titre: e.target.value })}
              rows={type === 'video' ? 5 : 2}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-ivory"
            />
          </label>
          {type === 'photo' && (
            <label className="block">
              <span className="text-xs text-muted">Description</span>
              <textarea
                value={c.description}
                onChange={(e) => maj({ description: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-ivory"
              />
            </label>
          )}

          <label className="block">
            <span className="text-xs text-muted">Who can view this post</span>
            <select
              value={c.visibilite ?? ''}
              onChange={(e) => maj({ visibilite: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-ivory"
            >
              <option value="" disabled>
                — Choisir —
              </option>
              {info.privacy_level_options.map((o) => (
                <option key={o} value={o} disabled={o === 'SELF_ONLY' && marquePrivee} title={o === 'SELF_ONLY' && marquePrivee ? MESSAGE_MARQUE_PRIVEE : undefined}>
                  {LIBELLE_VISIBILITE[o] ?? o}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-1">
            <legend className="text-xs text-muted">Allow users to</legend>
            <label className={`flex items-center gap-2 ${info.comment_disabled ? 'opacity-40' : ''}`}>
              <input type="checkbox" checked={c.commentaires} disabled={info.comment_disabled} onChange={(e) => maj({ commentaires: e.target.checked })} />
              Comment
            </label>
            {type === 'video' && (
              <>
                <label className={`flex items-center gap-2 ${info.duet_disabled ? 'opacity-40' : ''}`}>
                  <input type="checkbox" checked={c.duo} disabled={info.duet_disabled} onChange={(e) => maj({ duo: e.target.checked })} />
                  Duet
                </label>
                <label className={`flex items-center gap-2 ${info.stitch_disabled ? 'opacity-40' : ''}`}>
                  <input type="checkbox" checked={c.collage} disabled={info.stitch_disabled} onChange={(e) => maj({ collage: e.target.checked })} />
                  Stitch
                </label>
              </>
            )}
          </fieldset>

          <fieldset className="space-y-1 rounded-lg border border-border p-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={c.commercial}
                onChange={(e) => maj({ commercial: e.target.checked, votreMarque: false, contenuDeMarque: false })}
              />
              Disclose post content
            </label>
            <p className="text-[11px] text-faint">Indiquez si la publication fait la promotion de vous-même, d’une marque, d’un produit ou d’un service.</p>
            {c.commercial && (
              <div className="space-y-1 pl-5">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={c.votreMarque} onChange={(e) => maj({ votreMarque: e.target.checked })} />
                  Your brand
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={c.contenuDeMarque}
                    onChange={(e) => maj({ contenuDeMarque: e.target.checked, visibilite: e.target.checked && c.visibilite === 'SELF_ONLY' ? null : c.visibilite })}
                  />
                  Branded content
                </label>
                {etiquette && <p className="text-xs text-accent">{etiquette}</p>}
                {c.contenuDeMarque && <p className="text-[11px] text-faint">{MESSAGE_MARQUE_PRIVEE}</p>}
              </div>
            )}
          </fieldset>

          <p className="text-xs text-muted">
            {decl.texte.split(/(Branded Content Policy|Music Usage Confirmation)/).map((morceau, i) => {
              const lien = decl.liens.find((l) => l.libelle === morceau);
              return lien ? (
                <a key={i} href={lien.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                  {morceau}
                </a>
              ) : (
                <span key={i}>{morceau}</span>
              );
            })}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || !verdict.ok}
              title={!verdict.ok && c.commercial && !c.votreMarque && !c.contenuDeMarque ? MESSAGE_SANS_OPTION : undefined}
              onClick={() =>
                start(async () => {
                  setMessage(null);
                  const r = await publierTikTok(cible, cibleId, c);
                  if (r.ok) setPublishId(r.publishId);
                  else setMessage(r.raison);
                })
              }
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition disabled:opacity-40"
            >
              {pending ? 'Publication…' : 'Publier sur TikTok'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await ecarterTikTok(cible, cibleId);
                  router.refresh();
                })
              }
              className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:text-ivory"
            >
              Écarter
            </button>
          </div>
          {!verdict.ok && <p className="text-xs text-faint">{verdict.raison}</p>}
          {message && (
            <p role="alert" className="text-xs text-down">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
