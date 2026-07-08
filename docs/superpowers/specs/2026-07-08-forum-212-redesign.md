# Forum BRVM — 212 Trading Style Redesign Spec

> **For agentic workers:** Use superpowers:writing-plans to implement this design task-by-task after user approval.

**Goal:** Redesign the BRVM forum from a grid-based card layout to a rich, immersive social feed (212 Trading style) with pinned posts, trending algorithm, image galleries, award badges, and engaged community features.

**Architecture:** Hybrid responsive design — rich post cards on desktop (40px avatars, full engagement stats, image galleries) compress to mobile-optimized layout (smaller avatars, stacked engagement). Trending algorithm ranks posts by weighted engagement + time decay. Moderation layer allows admins to pin posts, users to report content, with email digest for engagement. Award system (💡🔥⭐) incentivizes quality contributions.

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL (new tables + computed columns), TailwindCSS (dark finance tokens), React Server Components for feed rendering.

---

## 1. Data Model Changes

### New Tables

**`forum_posts` (extend existing):**
```sql
ALTER TABLE forum_posts ADD COLUMN (
  image_urls jsonb, -- array of S3 URLs, max 3 images
  is_pinned boolean DEFAULT false,
  pinned_at timestamp,
  trending_score float DEFAULT 0.0 -- computed hourly
);
```

**`forum_replies` (extend existing):**
```sql
ALTER TABLE forum_replies ADD COLUMN (
  image_urls jsonb, -- array of S3 URLs, max 3 images
  parent_reply_id uuid REFERENCES forum_replies(id) -- for nested replies
);
```

**`post_interactions` (new):**
```sql
CREATE TABLE post_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type text NOT NULL, -- 'like' | 'award'
  award_type text, -- '💡' | '🔥' | '⭐' (null if interaction_type = 'like')
  created_at timestamp DEFAULT now(),
  UNIQUE(post_id, user_id, interaction_type, award_type)
);
```

**`author_profiles` (extend existing or new):**
```sql
CREATE TABLE author_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  avatar_url text,
  display_name text,
  is_verified boolean DEFAULT false, -- admin/analyst badge
  reputation_score int DEFAULT 0, -- sum of awards received
  created_at timestamp DEFAULT now()
);
```

**`user_preferences` (new):**
```sql
CREATE TABLE user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  email_digest_frequency text DEFAULT 'daily', -- 'daily' | 'weekly' | 'never'
  followed_instruments text[], -- array of instrument codes
  notify_replies boolean DEFAULT true,
  notify_likes boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);
```

### Computed Columns

**`forum_posts.trending_score`** (updated hourly via cron):
```
trending_score = ((likes_count × 1.5) + (replies_count × 3) + (awards_count × 5)) / (hours_since_created + 1)
```

**`author_profiles.reputation_score`** (updated on award):
```
reputation_score = SUM(awards received)
```

### RLS Policies

- All users: SELECT forum_posts, forum_replies, post_interactions (except deleted)
- Authenticated users: INSERT own posts/replies
- Post author: UPDATE/DELETE own posts/replies
- Admin: UPDATE forum_posts.is_pinned, soft-delete posts (flag as spam)
- Service role (backend): Update trending_score, reputation_score

---

## 2. Components Architecture

### Page Structure
```
ForumWall (app/forum/page.tsx) — Server Component
├── SectionHeader (kicker, title, CTA)
├── PinnedSection (container)
│   └── PostCard (repeating, pinned=true variant)
├── TrendingFeed (infinite scroll or pagination)
│   └── PostCard (repeating, pinned=false)
│       ├── PostHeader
│       │   ├── Avatar (40px on desktop, 36px mobile)
│       │   ├── AuthorInfo (name, badges, reputation)
│       │   ├── Timestamp (relative: "il y a 2h")
│       │   └── PinnedIndicator (optional: "📌 Épinglé")
│       ├── PostTitle (text-lg, font-semibold)
│       ├── PostBody (rich text, line-clamp-4)
│       ├── ImageGallery (grid, max 3 images)
│       └── EngagementRow
│           ├── LikeButton (with count)
│           ├── ReplyPreview (first reply snippet)
│           ├── ShareMenu (Twitter/LinkedIn/WhatsApp)
│           └── AwardMenu (💡🔥⭐ buttons)
└── ReplyModal (or ThreadPage if clicking post)

ForumThreadPage (app/forum/[id]/page.tsx) — Server Component
├── PostCard (original post, expanded view)
├── ReplySection
│   ├── ReplyCard (repeating, nested if parent_reply_id set)
│   │   └── QuotePreview (if nested reply)
│   └── ReplyForm (textarea + image upload)
└── ReplyForm (for top-level replies to post)

ForumNewPage (app/forum/nouveau/page.tsx) — Server Component
└── NewPostForm
    ├── TitleInput
    ├── BodyTextarea
    ├── InstrumentCodeAutocomplete
    ├── ImageUploadArea (drag-drop)
    └── PreviewPane (live preview)
```

### Component Files

**`components/forum/PostCard.tsx`:**
- Props: `post: ForumPost`, `author: AuthorProfile`, `liked: boolean`, `awards: Award[]`, `replyCount: number`, `isPinned: boolean`
- Desktop: Rich card with all engagement stats visible
- Mobile: Compact, same info but smaller text/spacing
- Hover state: `border-info/40` + `bg-elevated/40`

**`components/forum/ImageGallery.tsx`:**
- Props: `images: string[]` (max 3 URLs)
- Display: Responsive grid (`grid-cols-3` desktop, `grid-cols-2` mobile)
- Lightbox on click (modal with prev/next navigation)

**`components/forum/AwardMenu.tsx`:**
- Props: `postId: string`, `onAward: (type) => void`
- Button group (💡🔥⭐) with tooltips
- On click: Send award to backend, trigger celebration animation

**`components/forum/EngagementRow.tsx`:**
- Props: `postId`, `likeCount`, `replyCount`, `shareUrl`, `awards`
- Row: [👍 count] [💬 count] [🔗 Share] [Awards menu]
- All interactive (client-side state for immediate feedback)

**`components/forum/ShareMenu.tsx`:**
- Props: `postId`, `title`, `excerpt`
- Dropdown: Twitter | LinkedIn | WhatsApp | Copy link
- Pre-fills social posts with excerpt + link

**`components/forum/NewPostForm.tsx`:**
- Form with validation (title required, body > 20 chars)
- Image upload: Client-side validation (max 5MB per image, max 3 total)
- Upload to S3 before POST /api/forum/create
- Preview pane shows how post will render

**`components/forum/ReplyForm.tsx`:**
- Textarea + image upload (same as NewPostForm)
- Optional: Quote parent reply if nested

---

## 3. API Endpoints

**`POST /api/forum/create`:**
- Input: `{ title, body, instrument_code?, image_urls[] }`
- Auth: User must be logged in
- Validation: title ≤ 200 chars, body ≤ 5000 chars, max 3 images
- Output: Created `ForumPost` object
- Error: 400 (validation), 401 (auth)

**`POST /api/forum/[id]/reply`:**
- Input: `{ body, image_urls[], parent_reply_id? }`
- Auth: User must be logged in
- Output: Created `ForumReply` object
- Increments `forum_posts.replies_count`

**`POST /api/forum/[id]/like`:**
- Input: (none, POST body empty)
- Auth: User must be logged in
- Idempotent: INSERT or IGNORE into `post_interactions`
- Output: `{ liked: true, like_count: number }`

**`POST /api/forum/[id]/award`:**
- Input: `{ award_type: '💡' | '🔥' | '⭐' }`
- Auth: User must be logged in
- Idempotent: INSERT or IGNORE into `post_interactions`
- Output: `{ awarded: true, award_count: number }`
- Side effect: Increment `author_profiles.reputation_score`

**`POST /api/forum/[id]/share`:**
- Input: (none, used for tracking/logging)
- Output: `{ share_count: number }`
- Used for analytics (not blocking)

**`DELETE /api/forum/[id]`:**
- Auth: Post author or admin
- Soft delete: UPDATE `forum_posts SET deleted_at = now()`
- Returns: `{ deleted: true }`

**`POST /api/forum/[id]/report`:**
- Input: `{ reason: 'spam' | 'inappropriate' | 'misleading' }`
- Auth: Any user
- Creates record in `forum_reports` table
- Output: `{ reported: true }`

**`GET /api/admin/forum/reports`:**
- Auth: Admin only (RBAC check)
- Output: List of reported posts with counts + user flagging history
- Sorting: By report count (DESC)

**`POST /api/admin/forum/[id]/pin`:**
- Input: `{ is_pinned: boolean }`
- Auth: Admin only
- Output: `{ pinned: boolean, pinned_at: timestamp }`

**`GET /api/forum/trending`:**
- Query: `?limit=20&offset=0`
- Output: Posts sorted by `trending_score DESC`
- Computed hourly (cached)

**`GET /api/forum/feed`:**
- Query: `?instrument_code=ETIT&limit=20`
- Output: Posts filtered by instrument, sorted by `created_at DESC` (if no filter) or `trending_score DESC`

---

## 4. Trending Algorithm

**Calculation (hourly cron job):**
```typescript
const trendingScore = 
  (likesCount * 1.5) +
  (repliesCount * 3) +
  (awardsCount * 5)
  / (hoursSinceCreated + 1);
```

**Rationale:**
- Likes = basic engagement (weight 1.5)
- Replies = deep engagement (weight 3, higher value)
- Awards = quality signal (weight 5, highest value)
- Time decay: `/hours_old + 1` prevents old posts from dominating
- New posts: Even 1 like will push to top, but decay quickly without sustained engagement

**Update frequency:** Cron job runs hourly (or every 30 min if more real-time desired)

**Storage:** Computed score cached in `forum_posts.trending_score` column

---

## 5. Moderation Layer

**Admin actions:**
1. **Pin post** — Float to top for 7 days (or manually unpin)
2. **Delete post** — Soft delete (set `deleted_at`, hide from feed)
3. **Ban user** — Prevent posting for 48h (or longer)
4. **View reports** — `/admin/forum/reports` dashboard

**User reporting:**
- Click "Report" button on any post
- Dropdown: `spam` | `inappropriate` | `misleading`
- Record stored in `forum_reports` table
- Reported post hidden from feed, visible to mods in dashboard

**Auto-moderation rules:**
- 3 deleted posts in 30 days → flag user for review
- 5 community flags → auto-hide post pending mod review
- Spam keywords detected → queue for mod (not auto-delete)

**Mod dashboard (`/admin/forum`):**
- List reported posts (by reason count, desc)
- Show user flagging history (serial reporters)
- Quick actions: Approve/Delete/Ban user/Unpin

---

## 6. Notifications & Email Digest

**In-app notifications:**
- Real-time for: reply to your post, like, award, post pinned
- Bell icon in top nav (unread count badge)
- Click → shows last 10 notifications (scrollable)
- Click notification → jump to post/reply

**Email digest:**
- Frequency: Daily / Weekly (user preference)
- Trigger: Send if user has activity AND hasn't been active in last 1 hour
- Content:
  - "X new replies to your posts"
  - "Y likes/awards on your posts"
  - "Z trending posts in your followed instruments"
- Privacy: Post excerpts only, no full content, no tracking pixels
- Unsubscribe: Link in email footer + reply "stop"

**User preferences:**
- `email_digest_frequency` — 'daily' | 'weekly' | 'never'
- `followed_instruments` — array of codes (ETIT, PALM, etc.)
- `notify_replies` — true/false
- `notify_likes` — true/false (default: false to reduce noise)

---

## 7. Mobile Responsiveness

**Breakpoints:**
- Mobile (`max-w-640px`): 1 column, compact spacing, 36px avatars, 2-column image grid
- Tablet (`640px-1024px`): 1 column, normal spacing, 40px avatars
- Desktop (`>1024px`): 1 column full-width, rich cards, 40px avatars, 3-column image grid

**Touch interactions:**
- Award buttons: Tap → menu appears (not hover)
- Share menu: Tap → dropdown (not hover)
- Post card: Tap → open thread (not just click title)
- Image: Long-press → share image option

---

## 8. Empty States

**No posts yet:**
```
[🗨️ icon]
Aucune discussion

Lancez la première discussion de la communauté.
[Nouveau sujet button]
```

**No results (filtered by instrument):**
```
[🗨️ icon]
Aucun sujet sur [CODE]

Soyez le premier à discuter de [CODE].
[Nouveau sujet button]
```

**No trending posts (first day):**
```
[⏳ icon]
Pas encore de tendances

Les posts populaires apparaîtront ici au fur et à mesure de l'engagement.
```

---

## 9. Testing Strategy

**Unit tests:**
- Trending score calculation (edge cases: new posts, old posts, zero engagement)
- Award badge logic (validation, duplicate prevention)
- Reputation score increment

**Integration tests:**
- Create post → appears in feed
- Like post → count increments immediately (client-side optimistic update)
- Award post → reputation score updates
- Report post → hidden from feed, appears in mod dashboard
- Email digest → correct recipients + correct content

**E2E tests (Playwright, if available):**
- User creates post with 3 images → renders in feed
- User clicks share → pre-filled social post opens
- Admin pins post → post floats to top
- Trending algorithm → new posts with high engagement surface first

---

## 10. Future Enhancements (Backlog)

- Rich text editor (Markdown or WYSIWYG)
- @ mentions + notifications
- Post scheduling (write now, publish later)
- Automated content warnings (flagged keywords)
- Community badges (weekly contributors, etc.)
- Analytics dashboard (trending posts, engagement heatmap)
- Export forum data (user archive)

---

## Acceptance Criteria

- ✅ Forum list shows pinned posts first, then trending posts
- ✅ Each post displays author, title, body, up to 3 images, engagement stats, award buttons
- ✅ Trending algorithm ranks by (likes × 1.5 + replies × 3 + awards × 5) / hours_old
- ✅ Users can like, award (💡🔥⭐), reply, share to social media
- ✅ Admins can pin/unpin posts, view reports, ban users
- ✅ Email digest sent daily/weekly based on user preference
- ✅ Mobile responsive (avatars, spacing, image grid adapt)
- ✅ All empty states handled gracefully
- ✅ RLS policies restrict data access properly
- ✅ Performance: Forum page loads < 1.5s, trending_score computed hourly
