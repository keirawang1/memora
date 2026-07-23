# Memora — Architecture

## Overview

Memora is a single-page React application backed by Supabase. The frontend owns UI state and orchestrates data through a thin Supabase access layer. All persistent data lives in Postgres with row-level security (RLS).

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (SPA)                      │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ App.tsx  │→ │ Components  │→ │ shadcn/ui + TW   │   │
│  └────┬─────┘  └─────────────┘  └──────────────────┘   │
│       │                                                 │
│  ┌────▼─────────────────────────────────────────────┐   │
│  │ supabase/  (boards, media, users, posts, …)    │   │
│  └────┬──────────────────────────────┬──────────────┘   │
└───────┼──────────────────────────────┼──────────────────┘
        │                              │
        ▼                              ▼
┌───────────────┐              ┌──────────────┐
│   Supabase    │              │  Jikan API   │
│ Auth+DB+Edge  │              │  (trending)  │
│ Storage       │              └──────────────┘
└───────┬───────┘              ┌──────────────┐
        │                      │ RapidAPI     │
        │ cron                 │ Movie Ratings│
        ▼                      └──────────────┘
┌──────────────────┐
│ Supabase pg_cron │ sync-catalog / refresh-recs (batched Edge Fns)
└──────────────────┘
```

## Component Hierarchy

```
App
├── AuthPage (unauthenticated)
│
└── Authenticated shell
    ├── Header
    │   ├── Logo
    │   ├── NotificationCenter
    │   └── Profile dropdown → Settings / Sign out
    │
    ├── Tabs
    │   ├── Library
    │   │   ├── LibraryPage → BoardCard grid
    │   │   └── BoardDetailPage → MediaCard grid
    │   │
    │   ├── Recommendations
    │   │   └── RecommendationsPage
    │   │       └── useDiscoveryFeed → RecommendationCard[]
    │   │
    │   └── Friends
    │       └── FriendsPage
    │           ├── Feed (posts, comments, likes)
    │           └── Manage (requests, friends list)
    │
    ├── ProfilePage (own profile)
    ├── UserProfilePage (public friend profiles)
    │
    └── Dialogs
        ├── AddMediaDialog
        ├── AddBoardDialog
        ├── MediaDetailDialog
        ├── SettingsDialog
        └── EditProfileDialog
```

## Authentication

1. `AuthPage` handles email/password sign-up and sign-in via `supabase.auth`.
2. On success, `ensureUserProfile()` creates or loads the `public.users` row.
3. `App.tsx` restores sessions on mount via `getSession()` and listens to `onAuthStateChange`.
4. All data loading is gated behind `isAuthenticated`; sign-out resets local state.

## State Management

State is centralized in `App.tsx` and synchronized with Supabase on mutations.

### Client state (React)

| State | Purpose |
|-------|---------|
| `mediaItems`, `boards` | User library |
| `friends` | Friend graph |
| `user`, `themeSettings`, `accentColor` | Profile and theming |
| `customGenres`, `customMediaTypes` | User-defined tags |
| `boardSortMode`, `mediaSortMode`, `boardCustomOrder` | Library sort preferences |
| `selectedBoard`, `selectedMedia`, dialog flags | UI navigation |

### Persistence pattern

```
User action → handler in App.tsx → supabase/*.ts function → Postgres
                                 → update local React state
                                 → toast on error
```

Handlers call Supabase modules directly (no global store). `useMemo` derives stats from `mediaItems`. The discovery feed uses `useDiscoveryFeed` with session-scoped caching in `discoveryCache.ts`.

## Data Layer (`src/app/supabase/`)

| Module | Responsibility |
|--------|----------------|
| `client.ts` | Supabase JS client singleton |
| `users.ts` | Profiles, tag prefs, theme, username, account deletion |
| `media.ts` | CRUD for media items, public board reads |
| `boards.ts` | CRUD for boards, media ordering |
| `recommendations.ts` | Read cached For You + invoke refresh Edge Function |
| `allBoardSync.ts` | Keeps the system "All" board in sync |
| `friends.ts` | Friend requests via RPC functions |
| `posts.ts` | Social feed: posts, comments, likes |
| `notifications.ts` | Fetch and mark notifications read |
| `storage.ts` | Avatar, board cover, and post image uploads |

## Database Schema

Core tables (created before migrations; extended by `supabase/migrations/`):

### `users`

Extends Supabase Auth. Key columns: `username`, `display_name`, `email`, `avatar`/`avatar_url`, `bio`, `accent_color`, `theme_mode`, `background_color`, `genres[]`, `media_types[]`, `show_all_board`, `board_sort_mode`, `board_custom_order[]`, `media_sort_mode`, `friends[]`, `requests[]`.

### `media`

Per-user media items. Key columns: `media_id`, `user_id`, `title`, `type`, `status`, `rating`, `cover`, `genres[]`, `gallery[]`, `board_ids[]`, `notes`, `link`, `date_started`, `date_completed`, `created_at`, `updated_at`.

### Recommendation tables

| Table | Purpose |
|-------|---------|
| `media_catalog` | Global titles from Jikan / Movie Ratings + `embedding vector(768)` |
| `user_recommendations` | Cached For You picks (JSONB) per user |
| `recommendation_jobs` | Sync/embed/refresh job status |

### `boards`

User collections. Key columns: `board_id`, `user_id`, `name`, `description`, `type`, `is_public`, `is_system`, `cover_image`, `media[]` (ordered UUID array), `created_at`, `updated_at`.

### Social tables

| Table | Purpose |
|-------|---------|
| `posts` | Friend-feed posts (text + optional image) |
| `post_comments` | Comments on posts |
| `post_likes` | Like records |
| `notifications` | In-app notification inbox |

### Storage buckets

| Bucket | Path pattern | Access |
|--------|-------------|--------|
| `avatars` | `{user_id}/{filename}` | Public read, owner write |
| `boards` | `{user_id}/covers/{uuid}` | Public read, owner write |
| `post` | `{user_id}/{filename}` | Public read, owner write |

## Security Model

All tables use RLS. Key policies:

- **Own data** — Users can CRUD their own media, boards, and profile.
- **Public boards** — Authenticated users can read media on another user's public boards.
- **Friend graph** — Friend requests and acceptance go through `SECURITY DEFINER` RPCs (`send_friend_request`, `accept_friend_request`, `reject_friend_request`, `remove_friend`).
- **Social feed** — Posts/comments/likes visible when the author is self or an accepted friend (`can_view_user_post`).
- **Notifications** — Users can only read/update their own notifications; creation is trigger/RPC-driven.
- **Account deletion** — `delete_own_account()` RPC cleans up user data and removes the user from friends/requests arrays.

## Recommendations

Server pipeline (catalog + embeddings + LLM) with client UI over a DB cache.

```
Jikan + TMDB
  → media_catalog (+ local MiniLM embeddings / pgvector)
  → preference vector from media.rating > 4
  → match_media_catalog → ~50–100 candidates
  → type-diverse top 5 + template reasons
  → user_recommendations (24h TTL)
  → RecommendationsPage / useDiscoveryFeed
```

- **For You** — Reads `user_recommendations`; refresh calls Edge Function `refresh-recommendations`.
- **Trending** — Still client-side Jikan seasons / popular print.
- **Jobs** — Supabase `pg_cron` (free) invokes batched Edge Functions `sync-catalog` / `refresh-recs`. Optional local full sync via `services/recommendations`.
- **Add to library** — Persists `link` from catalog external URL.

## Key User Flows

### Add media

1. User opens `AddMediaDialog`.
2. `createMedia()` inserts into `media` and updates `board_ids`.
3. `syncAllBoardMedia()` updates the system "All" board.
4. Local `mediaItems` and `boards` state refresh.

### Board organization

- Every user has a system **All** board (`is_system = true`).
- Media can belong to multiple boards via `board_ids` on media and `media[]` on boards.
- Users can hide the All board via `show_all_board` preference.

### Friend request

1. User searches by username → `send_friend_request` RPC.
2. Target user's `requests[]` updated; notification created.
3. Accept → both `friends[]` arrays updated; notification created.

### Social post

1. User composes post in `FriendsPage` feed tab.
2. Optional image uploaded to `post` bucket.
3. `createPost()` inserts row; friends see it via RLS.
4. Likes/comments trigger DB notifications.

## Styling

- **Tailwind CSS v3** with utility classes throughout components.
- **Design tokens** in `src/styles/theme.css`, `globals.css`, `default_theme.css`.
- **Dynamic theming** via `appTheme.ts` — applies light/dark/custom background and accent color as CSS variables on `:root`.
- **Accent color** propagated to buttons, avatars, and interactive elements via `accentColor.ts`.

## Type System

Defined in `src/app/types/`:

- `media.ts` — `MediaItem`, `Board`, `User`, `Friend`, `UserStats`
- `discovery.ts` — `DiscoveryItem`, `DiscoverySeed`
- `sort.ts` — `SortMode`, `LibrarySortPreferences`

## File Organization

```
src/app/
├── components/
│   ├── ui/              # shadcn primitives (button, dialog, tabs, …)
│   ├── shared/          # Cross-page components
│   └── [Page|Dialog].tsx
├── data/
│   ├── defaults.ts      # Factory functions for initial state
│   ├── allBoard.ts      # All-board helpers
│   ├── sortOrder.ts     # Sort logic
│   ├── analytics.ts     # Stats and status normalization
│   ├── recommendationEngine.ts
│   ├── discoveryCache.ts
│   ├── malGenres.ts     # MAL ↔ Memora genre mapping
│   └── mediaOptions.ts
├── hooks/
│   └── useDiscoveryFeed.ts
├── services/
│   └── jikan.ts
├── supabase/            # Data access layer (see above)
├── types/
└── utils/
    ├── appTheme.ts
    ├── accentColor.ts
    └── resizeImage.ts
```

## Extension Points

| Change | Where to start |
|--------|---------------|
| New media field | `types/media.ts`, `supabase/media.ts`, migration, `AddMediaDialog` |
| New notification type | Migration (check constraint + trigger), `notifications.ts` |
| New social feature | Migration, `posts.ts`, `FriendsPage` |
| Alternative auth provider | `AuthPage.tsx`, Supabase Auth config |
| Server-side recommendations | New Edge Function; replace `recommendationEngine.ts` calls |

## Performance Notes

- Jikan requests are rate-limited client-side (400 ms gap, retry on 429/503).
- Discovery results cached in `sessionStorage` per user/section.
- Board and media lists use `useMemo` for filtering and sorting.
- Image uploads are resized client-side before upload (`resizeImage.ts`).

## Scaling Considerations

Current architecture suits a small-to-medium user base. For growth:

- **State** — Extract to React Context or Zustand to reduce prop drilling in `App.tsx`.
- **Server state** — Adopt TanStack Query for caching, optimistic updates, and background refresh.
- **Recommendations** — Move to a Supabase Edge Function or background job to avoid client-side rate limits.
- **Realtime** — Supabase Realtime subscriptions for feed and notifications.
