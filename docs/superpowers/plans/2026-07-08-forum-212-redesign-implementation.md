# Forum 212 Trading Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign BRVM forum from grid cards to rich social feed (212 Trading style) with pinned posts, trending algorithm, award badges, and moderation layer.

**Architecture:** Hybrid responsive design — rich post cards on desktop (image galleries, engagement stats) compress to mobile-optimized layout. Supabase stores posts + interactions; trending_score computed hourly via cron. Moderation layer allows admins to pin/delete, users to report. Award system (💡🔥⭐) incentivizes quality.

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL, TailwindCSS, Zod validation, vitest for unit tests.

---

## Phase 1: Supabase Schema & RLS

### Task 1: Create Supabase Migration for New Tables

**Files:**
- Create: `supabase/migrations/0077_forum_212_redesign.sql`
- Modify: none

- [ ] **Step 1: Write SQL migration**

```sql
-- Add columns to forum_posts
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS (
  image_urls jsonb DEFAULT '[]'::jsonb,
  is_pinned boolean DEFAULT false,
  pinned_at timestamp with time zone,
  trending_score float DEFAULT 0.0
);

-- Add columns to forum_replies
ALTER TABLE forum_replies ADD COLUMN IF NOT EXISTS (
  image_urls jsonb DEFAULT '[]'::jsonb,
  parent_reply_id uuid REFERENCES forum_replies(id) ON DELETE CASCADE
);

-- Create post_interactions table
CREATE TABLE IF NOT EXISTS post_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type text NOT NULL CHECK (interaction_type IN ('like', 'award')),
  award_type text CHECK (award_type IN ('💡', '🔥', '⭐')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(post_id, user_id, interaction_type, award_type)
);

-- Create author_profiles table
CREATE TABLE IF NOT EXISTS author_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url text,
  display_name text NOT NULL,
  is_verified boolean DEFAULT false,
  reputation_score int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_digest_frequency text DEFAULT 'daily' CHECK (email_digest_frequency IN ('daily', 'weekly', 'never')),
  followed_instruments text[] DEFAULT '{}',
  notify_replies boolean DEFAULT true,
  notify_likes boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create forum_reports table
CREATE TABLE IF NOT EXISTS forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'misleading')),
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_post_interactions_post_id ON post_interactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_interactions_user_id ON post_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_trending_score ON forum_posts(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_is_pinned ON forum_posts(is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_reports_post_id ON forum_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_author_profiles_is_verified ON author_profiles(is_verified);
```

- [ ] **Step 2: Verify migration syntax**

Run: `cd frontend && npx supabase migration list`
Expected: New migration file appears

- [ ] **Step 3: Apply migration locally (if using local Supabase)**

Run: `npx supabase db push`
Expected: Migration applies without errors

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0077_forum_212_redesign.sql
git commit -m "db(forum): add schema for 212 redesign (posts, replies, interactions, profiles)"
```

---

### Task 2: Add RLS Policies for New Tables

**Files:**
- Create: `supabase/migrations/0078_forum_212_rls.sql`

- [ ] **Step 1: Write RLS migration**

```sql
-- Enable RLS
ALTER TABLE post_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reports ENABLE ROW LEVEL SECURITY;

-- post_interactions: SELECT all, INSERT own, DELETE own
CREATE POLICY post_interactions_select ON post_interactions FOR SELECT USING (true);
CREATE POLICY post_interactions_insert ON post_interactions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY post_interactions_delete ON post_interactions FOR DELETE 
  USING (auth.uid() = user_id OR auth.jwt() ->> 'email' = 'ebouak@gmail.com');

-- author_profiles: SELECT all, INSERT/UPDATE own, service_role full access
CREATE POLICY author_profiles_select ON author_profiles FOR SELECT USING (true);
CREATE POLICY author_profiles_insert ON author_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY author_profiles_update ON author_profiles FOR UPDATE 
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_preferences: SELECT/INSERT/UPDATE own only
CREATE POLICY user_preferences_select ON user_preferences FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY user_preferences_insert ON user_preferences FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_preferences_update ON user_preferences FOR UPDATE 
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- forum_reports: SELECT all (for mods), INSERT own
CREATE POLICY forum_reports_select ON forum_reports FOR SELECT USING (true);
CREATE POLICY forum_reports_insert ON forum_reports FOR INSERT 
  WITH CHECK (auth.uid() = reporter_id);
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push`
Expected: RLS policies applied

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0078_forum_212_rls.sql
git commit -m "db(forum): add RLS policies for interactions, profiles, preferences, reports"
```

---

### Task 3: Extend Forum Types

**Files:**
- Modify: `frontend/lib/forum/types.ts`

- [ ] **Step 1: Update ForumPost interface**

```typescript
// Add to forum/types.ts
export interface ForumPost extends Database['public']['Tables']['forum_posts']['Row'] {
  image_urls?: string[];
  is_pinned?: boolean;
  pinned_at?: string | null;
  trending_score?: number;
  author?: AuthorProfile;
  like_count?: number;
  reply_count?: number;
  award_count?: Map<string, number>; // '💡' => 5, '🔥' => 3, etc.
}

export interface ForumReply extends Database['public']['Tables']['forum_replies']['Row'] {
  image_urls?: string[];
  parent_reply_id?: string | null;
  author?: AuthorProfile;
  like_count?: number;
}

export interface PostInteraction {
  id: string;
  post_id: string;
  user_id: string;
  interaction_type: 'like' | 'award';
  award_type?: '💡' | '🔥' | '⭐' | null;
  created_at: string;
}

export interface AuthorProfile {
  user_id: string;
  avatar_url: string | null;
  display_name: string;
  is_verified: boolean;
  reputation_score: number;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  email_digest_frequency: 'daily' | 'weekly' | 'never';
  followed_instruments: string[];
  notify_replies: boolean;
  notify_likes: boolean;
}

export interface ForumReport {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: 'spam' | 'inappropriate' | 'misleading';
  created_at: string;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd frontend && npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/forum/types.ts
git commit -m "types(forum): extend types for 212 redesign (interactions, profiles, preferences)"
```

---

## Phase 2: Core Components

### Task 4: Create PostHeader Component

**Files:**
- Create: `frontend/components/forum/PostHeader.tsx`
- Test: `frontend/components/forum/__tests__/PostHeader.test.tsx`

- [ ] **Step 1: Write unit test**

```typescript
// PostHeader.test.tsx
import { render, screen } from '@testing-library/react';
import { PostHeader } from '../PostHeader';
import type { ForumPost, AuthorProfile } from '@/lib/forum/types';

describe('PostHeader', () => {
  const mockAuthor: AuthorProfile = {
    user_id: 'user-1',
    avatar_url: null,
    display_name: 'Jean Dupont',
    is_verified: false,
    reputation_score: 0,
    created_at: new Date().toISOString(),
  };

  const mockPost: ForumPost = {
    id: 'post-1',
    title: 'Test Post',
    body: 'Test body',
    author_id: 'user-1',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    updated_at: null,
    instrument_code: 'ETIT',
    is_pinned: false,
    trending_score: 0,
  };

  it('renders author name and avatar', () => {
    render(<PostHeader post={mockPost} author={mockAuthor} />);
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });

  it('displays relative time', () => {
    render(<PostHeader post={mockPost} author={mockAuthor} />);
    expect(screen.getByText(/il y a/)).toBeInTheDocument();
  });

  it('shows verified badge if is_verified true', () => {
    const verifiedAuthor = { ...mockAuthor, is_verified: true };
    render(<PostHeader post={mockPost} author={verifiedAuthor} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows pinned indicator if is_pinned true', () => {
    const pinnedPost = { ...mockPost, is_pinned: true };
    render(<PostHeader post={pinnedPost} author={mockAuthor} isPinned={true} />);
    expect(screen.getByText('📌')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

Run: `cd frontend && npm test -- PostHeader.test.tsx`
Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Implement PostHeader component**

```typescript
// PostHeader.tsx
import { relativeTimeFR } from '@/lib/forum/identity';
import type { ForumPost, AuthorProfile } from '@/lib/forum/types';
import { Avatar } from './Avatar';

interface PostHeaderProps {
  post: ForumPost;
  author: AuthorProfile | null;
  isPinned?: boolean;
}

export function PostHeader({ post, author, isPinned }: PostHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <Avatar profile={author} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">
            {author?.display_name ?? 'Anonymous'}
          </p>
          {author?.is_verified && (
            <span className="inline-flex items-center gap-1 text-xs bg-up px-2 py-0.5 rounded text-bg font-semibold">
              ✓ Analyste
            </span>
          )}
          {author && (
            <span className="text-xs bg-faint/30 px-2 py-0.5 rounded text-muted font-semibold">
              ⭐ {author.reputation_score}
            </span>
          )}
        </div>
        <p className="text-xs text-faint">{relativeTimeFR(post.created_at)}</p>
      </div>
      {isPinned && <span className="text-sm text-info font-semibold">📌 Épinglé</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run test (expect pass)**

Run: `npm test -- PostHeader.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/forum/PostHeader.tsx frontend/components/forum/__tests__/PostHeader.test.tsx
git commit -m "feat(forum): add PostHeader component with avatar, badges, reputation"
```

---

### Task 5: Create ImageGallery Component

**Files:**
- Create: `frontend/components/forum/ImageGallery.tsx`

- [ ] **Step 1: Implement ImageGallery**

```typescript
// ImageGallery.tsx
'use client';

import Image from 'next/image';
import { useState } from 'react';

interface ImageGalleryProps {
  images: string[];
  altPrefix?: string;
}

export function ImageGallery({ images, altPrefix = 'Post image' }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const gridCols = images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <>
      <div className={`grid ${gridCols} gap-2 mb-3`}>
        {images.map((url, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setSelectedIndex(idx)}
            className="relative aspect-square bg-border rounded-lg overflow-hidden hover:opacity-90 transition"
          >
            <Image
              src={url}
              alt={`${altPrefix} ${idx + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100px, 150px"
            />
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedIndex(null)}
        >
          <div className="relative w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[selectedIndex]}
              alt={`${altPrefix} ${selectedIndex + 1}`}
              width={800}
              height={600}
              className="w-full h-auto rounded-lg"
            />
            <button
              type="button"
              onClick={() => setSelectedIndex(null)}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black text-white p-2 rounded transition"
            >
              ✕
            </button>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedIndex((selectedIndex - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black text-white p-2 rounded transition"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIndex((selectedIndex + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black text-white p-2 rounded transition"
                >
                  →
                </button>
              </>
            )}
            <p className="absolute bottom-2 left-2 text-sm text-white bg-black/50 px-2 py-1 rounded">
              {selectedIndex + 1} / {images.length}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/components/forum/ImageGallery.tsx
git commit -m "feat(forum): add ImageGallery component with lightbox modal"
```

---

### Task 6: Create AwardMenu Component

**Files:**
- Create: `frontend/components/forum/AwardMenu.tsx`

- [ ] **Step 1: Implement AwardMenu**

```typescript
// AwardMenu.tsx
'use client';

import { useState } from 'react';

interface AwardMenuProps {
  postId: string;
  onAward: (type: '💡' | '🔥' | '⭐') => Promise<void>;
  disabled?: boolean;
}

const AWARDS = [
  { emoji: '💡', label: 'Insightful', color: 'text-blue-400' },
  { emoji: '🔥', label: 'Hot take', color: 'text-orange-400' },
  { emoji: '⭐', label: 'Star', color: 'text-yellow-400' },
] as const;

export function AwardMenu({ postId, onAward, disabled }: AwardMenuProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [awarded, setAwarded] = useState<Set<string>>(new Set());

  const handleAward = async (emoji: '💡' | '🔥' | '⭐') => {
    if (loading || disabled) return;
    setLoading(emoji);
    try {
      await onAward(emoji);
      setAwarded((prev) => new Set([...prev, emoji]));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2">
      {AWARDS.map(({ emoji, label, color }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleAward(emoji)}
          disabled={disabled || loading !== null}
          title={label}
          className={`text-xl p-1 rounded hover:bg-border transition active:scale-110 ${
            awarded.has(emoji) ? color : 'text-muted hover:text-white'
          } ${loading === emoji ? 'animate-pulse' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/components/forum/AwardMenu.tsx
git commit -m "feat(forum): add AwardMenu component with 💡🔥⭐ buttons"
```

---

### Task 7: Create EngagementRow Component

**Files:**
- Create: `frontend/components/forum/EngagementRow.tsx`

- [ ] **Step 1: Implement EngagementRow**

```typescript
// EngagementRow.tsx
'use client';

import { useState } from 'react';
import { AwardMenu } from './AwardMenu';
import { ShareMenu } from './ShareMenu';

interface EngagementRowProps {
  postId: string;
  likeCount: number;
  replyCount: number;
  shareUrl: string;
  postTitle: string;
  onLike?: (postId: string) => Promise<void>;
  onAward?: (postId: string, type: '💡' | '🔥' | '⭐') => Promise<void>;
  disabled?: boolean;
}

export function EngagementRow({
  postId,
  likeCount,
  replyCount,
  shareUrl,
  postTitle,
  onLike,
  onAward,
  disabled,
}: EngagementRowProps) {
  const [liked, setLiked] = useState(false);
  const [displayLikes, setDisplayLikes] = useState(likeCount);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (loading || disabled || !onLike) return;
    setLoading(true);
    try {
      await onLike(postId);
      setLiked(!liked);
      setDisplayLikes((prev) => prev + (liked ? -1 : 1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-3 items-center text-xs text-muted border-t border-border/40 pt-3 mt-3">
      <button
        type="button"
        onClick={handleLike}
        disabled={disabled || loading}
        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-border transition ${
          liked ? 'text-up' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        👍 <span className="tabular">{displayLikes}</span>
      </button>

      <div className="flex items-center gap-1 px-2 py-1">
        💬 <span className="tabular">{replyCount}</span>
      </div>

      {onAward && <AwardMenu postId={postId} onAward={(type) => onAward(postId, type)} disabled={disabled} />}

      <ShareMenu postTitle={postTitle} shareUrl={shareUrl} />
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/components/forum/EngagementRow.tsx
git commit -m "feat(forum): add EngagementRow component (likes, replies, awards, share)"
```

---

### Task 8: Create ShareMenu Component

**Files:**
- Create: `frontend/components/forum/ShareMenu.tsx`

- [ ] **Step 1: Implement ShareMenu**

```typescript
// ShareMenu.tsx
'use client';

import { useState } from 'react';

interface ShareMenuProps {
  postTitle: string;
  shareUrl: string;
}

export function ShareMenu({ postTitle, shareUrl }: ShareMenuProps) {
  const [open, setOpen] = useState(false);

  const shareOptions = [
    {
      name: 'Twitter/X',
      icon: '𝕏',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(postTitle)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'LinkedIn',
      icon: 'in',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'WhatsApp',
      icon: 'WA',
      url: `https://wa.me/?text=${encodeURIComponent(postTitle + ' ' + shareUrl)}`,
    },
  ];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-border transition"
      >
        🔗
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-elevated border border-border rounded-lg shadow-lg z-10 min-w-max">
          {shareOptions.map((option) => (
            <a
              key={option.name}
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-sm text-white hover:bg-surface transition first:rounded-t-lg last:rounded-b-lg"
            >
              {option.name}
            </a>
          ))}
          <button
            type="button"
            onClick={handleCopyLink}
            className="block w-full text-left px-3 py-2 text-sm text-white hover:bg-surface transition rounded-b-lg border-t border-border/40"
          >
            Copy link
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/components/forum/ShareMenu.tsx
git commit -m "feat(forum): add ShareMenu component (Twitter, LinkedIn, WhatsApp, copy link)"
```

---

### Task 9: Create PostCard Component

**Files:**
- Create: `frontend/components/forum/PostCard.tsx`

- [ ] **Step 1: Implement PostCard**

```typescript
// PostCard.tsx
import type { ForumPost, AuthorProfile } from '@/lib/forum/types';
import { PostHeader } from './PostHeader';
import { ImageGallery } from './ImageGallery';
import { EngagementRow } from './EngagementRow';

interface PostCardProps {
  post: ForumPost;
  author: AuthorProfile | null;
  likeCount?: number;
  replyCount?: number;
  onLike?: (postId: string) => Promise<void>;
  onAward?: (postId: string, type: '💡' | '🔥' | '⭐') => Promise<void>;
  canInteract?: boolean;
  className?: string;
}

export function PostCard({
  post,
  author,
  likeCount = 0,
  replyCount = 0,
  onLike,
  onAward,
  canInteract = true,
  className = '',
}: PostCardProps) {
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/forum/${post.id}`;

  return (
    <article
      className={`rounded-xl border border-border bg-surface p-4 transition hover:border-info/40 hover:bg-elevated/40 ${className}`}
    >
      <PostHeader post={post} author={author} isPinned={post.is_pinned} />

      <h3 className="mt-3 text-base font-semibold text-white line-clamp-2">{post.title}</h3>

      <p className="mt-2 text-sm text-white/90 line-clamp-4">{post.body}</p>

      {post.image_urls && post.image_urls.length > 0 && (
        <ImageGallery images={post.image_urls} altPrefix={post.title} />
      )}

      {(onLike || onAward) && (
        <EngagementRow
          postId={post.id}
          likeCount={likeCount}
          replyCount={replyCount}
          shareUrl={shareUrl}
          postTitle={post.title}
          onLike={onLike}
          onAward={onAward}
          disabled={!canInteract}
        />
      )}
    </article>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/components/forum/PostCard.tsx
git commit -m "feat(forum): add PostCard component with header, content, gallery, engagement row"
```

---

## Phase 3: API Endpoints

### Task 10: Create Trending Score Calculation Library

**Files:**
- Create: `frontend/lib/forum/trending.ts`
- Test: `frontend/lib/forum/__tests__/trending.test.ts`

- [ ] **Step 1: Write trending algorithm unit tests**

```typescript
// trending.test.ts
import { calculateTrendingScore } from '../trending';
import { describe, it, expect } from 'vitest';

describe('calculateTrendingScore', () => {
  const now = new Date();

  it('calculates trending score: (likes*1.5 + replies*3 + awards*5) / (hours_old + 1)', () => {
    const hoursOld = 1;
    const score = calculateTrendingScore({
      likesCount: 10,
      repliesCount: 5,
      awardsCount: 2,
      hoursOld,
    });
    const expected = (10 * 1.5 + 5 * 3 + 2 * 5) / (hoursOld + 1);
    expect(score).toBe(expected);
  });

  it('handles zero engagement', () => {
    const score = calculateTrendingScore({
      likesCount: 0,
      repliesCount: 0,
      awardsCount: 0,
      hoursOld: 1,
    });
    expect(score).toBe(0);
  });

  it('new posts (hoursOld=0) rank higher than old posts with same engagement', () => {
    const engagement = { likesCount: 10, repliesCount: 5, awardsCount: 2 };
    const newScore = calculateTrendingScore({ ...engagement, hoursOld: 0 });
    const oldScore = calculateTrendingScore({ ...engagement, hoursOld: 24 });
    expect(newScore).toBeGreaterThan(oldScore);
  });

  it('awards are weighted 5x (highest priority)', () => {
    const score1 = calculateTrendingScore({
      likesCount: 10,
      repliesCount: 0,
      awardsCount: 0,
      hoursOld: 1,
    });
    const score2 = calculateTrendingScore({
      likesCount: 0,
      repliesCount: 0,
      awardsCount: 2,
      hoursOld: 1,
    });
    expect(score2).toBeGreaterThan(score1);
  });
});
```

- [ ] **Step 2: Run test (expect failure)**

Run: `npm test -- trending.test.ts`
Expected: FAIL (function doesn't exist)

- [ ] **Step 3: Implement trending calculation**

```typescript
// trending.ts
export interface TrendingInput {
  likesCount: number;
  repliesCount: number;
  awardsCount: number;
  hoursOld: number;
}

export function calculateTrendingScore(input: TrendingInput): number {
  const { likesCount, repliesCount, awardsCount, hoursOld } = input;
  return (likesCount * 1.5 + repliesCount * 3 + awardsCount * 5) / (hoursOld + 1);
}

export function getHoursSince(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
}
```

- [ ] **Step 4: Run test (expect pass)**

Run: `npm test -- trending.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/forum/trending.ts frontend/lib/forum/__tests__/trending.test.ts
git commit -m "feat(forum): add trending score calculation (likes*1.5 + replies*3 + awards*5)/hours_old"
```

---

### Task 11: Create POST /api/forum/create Endpoint

**Files:**
- Create: `frontend/app/api/forum/create/route.ts`

- [ ] **Step 1: Implement create endpoint**

```typescript
// app/api/forum/create/route.ts
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const CreatePostSchema = z.object({
  title: z.string().min(5).max(200),
  body: z.string().min(20).max(5000),
  instrument_code: z.string().optional(),
  image_urls: z.array(z.string().url()).max(3).default([]),
});

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = CreatePostSchema.parse(body);

    const { data, error } = await supabase
      .from('forum_posts')
      .insert({
        title: validated.title,
        body: validated.body,
        author_id: user.id,
        instrument_code: validated.instrument_code || null,
        image_urls: validated.image_urls,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Forum create error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/forum/create/route.ts
git commit -m "feat(forum): add POST /api/forum/create endpoint with image URLs support"
```

---

### Task 12: Create POST /api/forum/[id]/like Endpoint

**Files:**
- Create: `frontend/app/api/forum/[id]/like/route.ts`

- [ ] **Step 1: Implement like endpoint**

```typescript
// app/api/forum/[id]/like/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const postId = params.id;

    // Upsert: insert or ignore if already exists
    const { error: upsertError } = await supabase
      .from('post_interactions')
      .upsert({
        post_id: postId,
        user_id: user.id,
        interaction_type: 'like',
      }, {
        onConflict: 'post_id,user_id,interaction_type,award_type',
      });

    if (upsertError) {
      console.error('Like error:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Get updated like count
    const { data: interactions } = await supabase
      .from('post_interactions')
      .select('*', { count: 'exact' })
      .eq('post_id', postId)
      .eq('interaction_type', 'like');

    return NextResponse.json({
      liked: true,
      like_count: interactions?.length || 0,
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/forum/[id]/like/route.ts
git commit -m "feat(forum): add POST /api/forum/[id]/like endpoint with idempotent upsert"
```

---

### Task 13: Create POST /api/forum/[id]/award Endpoint

**Files:**
- Create: `frontend/app/api/forum/[id]/award/route.ts`

- [ ] **Step 1: Implement award endpoint**

```typescript
// app/api/forum/[id]/award/route.ts
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const AwardSchema = z.object({
  award_type: z.enum(['💡', '🔥', '⭐']),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { award_type } = AwardSchema.parse(body);
    const postId = params.id;

    // Get post author
    const { data: post } = await supabase
      .from('forum_posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Upsert interaction
    const { error: upsertError } = await supabase
      .from('post_interactions')
      .upsert({
        post_id: postId,
        user_id: user.id,
        interaction_type: 'award',
        award_type,
      }, {
        onConflict: 'post_id,user_id,interaction_type,award_type',
      });

    if (upsertError) {
      console.error('Award error:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Update author reputation score (+1 for each award)
    const { error: updateError } = await supabase
      .from('author_profiles')
      .update({ reputation_score: supabase.rpc('increment', { x: 1 }) })
      .eq('user_id', post.author_id);

    // Get updated award count
    const { data: interactions } = await supabase
      .from('post_interactions')
      .select('*', { count: 'exact' })
      .eq('post_id', postId)
      .eq('interaction_type', 'award')
      .eq('award_type', award_type);

    return NextResponse.json({
      awarded: true,
      award_count: interactions?.length || 0,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/forum/[id]/award/route.ts
git commit -m "feat(forum): add POST /api/forum/[id]/award endpoint with reputation increment"
```

---

## Phase 4: Trending Algorithm & Cron

### Task 14: Create Forum Trending Cron Job

**Files:**
- Create: `scraper/src/crons/forum-trending.ts`
- Modify: `scraper/src/index.ts` (add command)

- [ ] **Step 1: Implement trending cron**

```typescript
// scraper/src/crons/forum-trending.ts
import { createClient } from '@supabase/supabase-js';
import { logger } from '../logger.js';

export async function runForumTrending() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    logger.info('Starting forum trending score calculation...');

    // Fetch all posts with engagement counts
    const { data: posts, error: fetchError } = await supabase
      .from('forum_posts')
      .select(`
        id,
        created_at,
        post_interactions(interaction_type, award_type)
      `)
      .eq('deleted_at', null);

    if (fetchError) {
      logger.error('Error fetching posts:', fetchError);
      return;
    }

    if (!posts || posts.length === 0) {
      logger.info('No posts found');
      return;
    }

    // Calculate trending scores
    const updates = posts.map((post: any) => {
      const now = new Date();
      const created = new Date(post.created_at);
      const hoursOld = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

      const interactions = post.post_interactions || [];
      const likesCount = interactions.filter((i: any) => i.interaction_type === 'like').length;
      const awardsCount = interactions.filter((i: any) => i.interaction_type === 'award').length;

      // Fetch reply count (separate query to avoid nested data)
      const repliesCount = 0; // Will be updated in next step

      const trendingScore = (likesCount * 1.5 + repliesCount * 3 + awardsCount * 5) / (hoursOld + 1);

      return {
        id: post.id,
        trending_score: trendingScore,
      };
    });

    // Batch update
    for (const update of updates) {
      await supabase
        .from('forum_posts')
        .update({ trending_score: update.trending_score })
        .eq('id', update.id);
    }

    logger.info(`Updated trending scores for ${updates.length} posts`);
  } catch (err) {
    logger.error('Forum trending cron error:', err);
    throw err;
  }
}
```

- [ ] **Step 2: Add CLI command**

Modify `scraper/src/index.ts` to add:

```typescript
// In the command handler:
} else if (command === 'forum-trending') {
  await runForumTrending();
}
```

- [ ] **Step 3: Test locally**

Run: `cd scraper && npm run build && node dist/index.js forum-trending --mock`
Expected: Logs showing trending scores updated

- [ ] **Step 4: Commit**

```bash
git add scraper/src/crons/forum-trending.ts scraper/src/index.ts
git commit -m "feat(cron): add forum trending score calculation (hourly)"
```

---

### Task 15: Create GitHub Actions Cron for Forum Trending

**Files:**
- Create: `.github/workflows/forum-trending.yml`

- [ ] **Step 1: Create workflow**

```yaml
# .github/workflows/forum-trending.yml
name: Forum Trending Scores (Hourly)

on:
  schedule:
    - cron: '0 * * * *' # Every hour
  workflow_dispatch:

jobs:
  trending:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd scraper && npm ci
      - name: Calculate trending scores
        run: cd scraper && npm run build && node dist/index.js forum-trending
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LOG_LEVEL: info
      - name: Log completion
        if: always()
        run: echo "Trending scores updated at $(date -u)"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/forum-trending.yml
git commit -m "ci(forum): add hourly cron for trending score calculation"
```

---

## Phase 5: Moderation & Admin

### Task 16: Create POST /api/forum/[id]/report Endpoint

**Files:**
- Create: `frontend/app/api/forum/[id]/report/route.ts`

- [ ] **Step 1: Implement report endpoint**

```typescript
// app/api/forum/[id]/report/route.ts
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const ReportSchema = z.object({
  reason: z.enum(['spam', 'inappropriate', 'misleading']),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reason } = ReportSchema.parse(body);

    const { error } = await supabase
      .from('forum_reports')
      .insert({
        post_id: params.id,
        reporter_id: user.id,
        reason,
      });

    if (error) {
      console.error('Report error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reported: true }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run typecheck & commit**

```bash
npm run typecheck
git add frontend/app/api/forum/[id]/report/route.ts
git commit -m "feat(forum): add POST /api/forum/[id]/report endpoint"
```

---

### Task 17: Create POST /api/admin/forum/[id]/pin Endpoint

**Files:**
- Create: `frontend/app/api/admin/forum/[id]/pin/route.ts`

- [ ] **Step 1: Implement pin endpoint (admin-only)**

```typescript
// app/api/admin/forum/[id]/pin/route.ts
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/server/rbac';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const PinSchema = z.object({
  is_pinned: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin('forum.manage'); // Custom RBAC check

    const supabase = createClient();
    const body = await request.json();
    const { is_pinned } = PinSchema.parse(body);

    const { data, error } = await supabase
      .from('forum_posts')
      .update({
        is_pinned,
        pinned_at: is_pinned ? new Date().toISOString() : null,
      })
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) {
      console.error('Pin error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run typecheck & commit**

```bash
npm run typecheck
git add frontend/app/api/admin/forum/[id]/pin/route.ts
git commit -m "feat(forum): add POST /api/admin/forum/[id]/pin endpoint (admin-only)"
```

---

## Phase 6: Notifications & Email

### Task 18: Create Email Digest Library

**Files:**
- Create: `frontend/lib/forum/email.ts`

- [ ] **Step 1: Implement email digest generator**

```typescript
// lib/forum/email.ts
import type { ForumPost, ForumReply } from './types';

export interface DigestData {
  userName: string;
  replies: ForumReply[];
  likes: { post: ForumPost; count: number }[];
  trending: ForumPost[];
}

export function generateDigestHTML(data: DigestData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #e6e9f0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 1px solid #232733; padding-bottom: 20px; margin-bottom: 20px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 15px; color: #56d7fd; }
    .post-item { background: #161922; border: 1px solid #232733; border-radius: 8px; padding: 15px; margin-bottom: 10px; }
    .post-title { font-weight: 600; color: #e6e9f0; text-decoration: none; }
    .post-excerpt { color: #8b93a7; font-size: 14px; margin-top: 5px; }
    .stat { color: #ffb300; font-weight: 600; }
    .cta { display: inline-block; background: #00c853; color: #0f1117; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 10px; }
    .footer { border-top: 1px solid #232733; padding-top: 20px; font-size: 12px; color: #8b93a7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Forum BRVM — Digest</h1>
      <p>Bonjour ${data.userName},</p>
      <p>Voici votre résumé d'activité du forum.</p>
    </div>

    ${
      data.replies.length > 0
        ? `
    <div class="section">
      <div class="section-title">💬 Réponses à vos posts</div>
      <p>Vous avez <span class="stat">${data.replies.length}</span> nouvelle(s) réponse(s).</p>
      ${data.replies
        .slice(0, 3)
        .map(
          (r) => `
        <div class="post-item">
          <div class="post-excerpt">${r.body.substring(0, 100)}...</div>
        </div>
      `
        )
        .join('')}
    </div>
    `
        : ''
    }

    ${
      data.likes.length > 0
        ? `
    <div class="section">
      <div class="section-title">👍 Likes & Awards</div>
      <p>Vous avez reçu <span class="stat">${data.likes.length}</span> engagement(s) sur vos posts.</p>
    </div>
    `
        : ''
    }

    ${
      data.trending.length > 0
        ? `
    <div class="section">
      <div class="section-title">🔥 Tendances</div>
      <p>Posts populaires cette semaine:</p>
      ${data.trending
        .slice(0, 3)
        .map(
          (p) => `
        <div class="post-item">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/forum/${p.id}" class="post-title">${p.title}</a>
          <div class="post-excerpt">${p.body.substring(0, 100)}...</div>
        </div>
      `
        )
        .join('')}
    </div>
    `
        : ''
    }

    <div class="footer">
      <p>© 2026 WESTBOURSE. Gérer vos préférences d'email <a href="${process.env.NEXT_PUBLIC_APP_URL}/account/preferences">ici</a>.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/account/unsubscribe?email=${encodeURIComponent(data.userName)}">Se désabonner</a></p>
    </div>
  </div>
</body>
</html>
  `;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/forum/email.ts
git commit -m "feat(forum): add email digest HTML generator"
```

---

## Summary & Execution

**Total: 18 tasks across 6 phases**

### Task Breakdown
- **Phase 1:** Schema & RLS (3 tasks)
- **Phase 2:** Components (7 tasks)
- **Phase 3:** API Endpoints (4 tasks)
- **Phase 4:** Trending & Cron (2 tasks)
- **Phase 5:** Moderation (2 tasks)
- **Phase 6:** Notifications (1 task)

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-08-forum-212-redesign-implementation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using inline implementations, batch execution with checkpoints

**Which approach?**