'use client';

import { useRef, useState } from 'react';
import UserAvatar from './UserAvatar';

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  experience_level: string | null;
  favorite_sectors: string[] | null;
}
const LEVELS = [
  { v: 'beginner', l: 'Débutant' }, { v: 'intermediate', l: 'Intermédiaire' },
  { v: 'advanced', l: 'Avancé' }, { v: 'professional', l: 'Professionnel' },
];
const SECTORS = ['Finance', 'Télécommunications', 'Énergie', 'Agro-industrie', 'Distribution', 'Industrie', 'Transport', 'Services publics'];

/** Redimensionne une image (canvas) à 400×400 max, qualité 0.85 → Blob JPEG. */
async function resize(file: File, max = 400): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.85));
}

export default function ProfileClient({ initial, email, isPremium }: { initial: Profile; email: string; isPremium: boolean }) {
  const [avatar, setAvatar] = useState(initial.avatar_url);
  const [name, setName] = useState(initial.display_name ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [location, setLocation] = useState(initial.location ?? '');
  const [level, setLevel] = useState(initial.experience_level ?? '');
  const [sectors, setSectors] = useState<string[]>(initial.favorite_sectors ?? []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg(null);
    try {
      const blob = await resize(file);
      const fd = new FormData();
      fd.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      const r = await fetch('/api/avatar', { method: 'POST', body: fd });
      const j = await r.json();
      if (r.ok) setAvatar(j.avatar_url); else setMsg(j.error ?? 'Échec upload');
    } catch { setMsg('Image illisible'); } finally { setUploading(false); }
  }

  async function save() {
    setSaving(true); setMsg(null);
    const r = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: name, bio, location, experience_level: level || null, favorite_sectors: sectors }),
    });
    setSaving(false);
    setMsg(r.ok ? '✓ Profil enregistré' : 'Échec de l’enregistrement');
  }

  const toggleSector = (s: string) => setSectors((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  const inputCls = 'w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-ivory placeholder:text-faint focus:border-accent/40 focus:outline-none';

  return (
    <div className="space-y-6">
      {/* Hero : cover + photo */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="h-24 bg-gradient-to-r from-accent/30 to-up/30" />
        <div className="flex items-end gap-4 px-5 pb-4">
          <div className="relative -mt-10">
            <UserAvatar src={avatar} name={name || email} size="xl" className="ring-4 ring-bg" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              aria-label="Changer la photo"
              className="absolute bottom-0 right-0 rounded-full bg-accent p-1.5 text-bg shadow hover:brightness-110 disabled:opacity-50">
              {uploading ? '…' : '📷'}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPhoto} />
          </div>
          <div className="pb-1">
            <p className="text-lg font-semibold text-white">{name || 'Votre nom'}</p>
            <p className="text-xs text-faint">{email} ·
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isPremium ? 'bg-gradient-to-r from-accent to-up text-bg' : 'border border-border text-faint'}`}>
                {isPremium ? 'PRO' : 'FREE'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <label className="block text-xs text-muted">Nom affiché
          <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${inputCls}`} placeholder="Prénom Nom" />
        </label>
        <label className="block text-xs text-muted">Bio <span className="text-faint">({bio.length}/160)</span>
          <textarea value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} rows={2} className={`mt-1 ${inputCls}`} placeholder="Quelques mots sur vous…" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">Ville / Pays
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={`mt-1 ${inputCls}`} placeholder="Abidjan, Côte d'Ivoire" />
          </label>
          <label className="block text-xs text-muted">Profil investisseur
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={`mt-1 ${inputCls}`}>
              <option value="">—</option>
              {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
            </select>
          </label>
        </div>
        <div>
          <p className="text-xs text-muted mb-1.5">Secteurs favoris</p>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((s) => (
              <button key={s} type="button" onClick={() => toggleSector(s)}
                className={`text-xs px-2.5 py-1 rounded-full border ${sectors.includes(s) ? 'border-accent text-accent bg-accent/10' : 'border-border text-muted'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button type="button" onClick={save} disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
          {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-up' : 'text-down'}`}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}
