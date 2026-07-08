# Memora

A personal media library and social tracker for anime, manga, movies, TV, books, and more. Organize your collection into boards, discover new titles via personalized recommendations, and share activity with friends.

## Features

- **Library** — Boards and media cards with ratings, genres, status, notes, and custom sort orders
- **Recommendations** — Personalized anime/manga suggestions powered by your library and the [Jikan API](https://jikan.moe)
- **Friends** — Friend requests, social feed with posts/comments/likes, and public profile viewing
- **Notifications** — In-app alerts for likes, comments, and friend activity
- **Themes** — Light, dark, or custom accent/background colors
- **Auth** — Email/password sign-up and sign-in via Supabase

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS, Radix UI / shadcn components |
| Backend | Supabase (Postgres, Auth, Storage, RLS) |
| Discovery | Jikan API v4 (MyAnimeList data) |

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) (recommended) or npm
- A [Supabase](https://supabase.com) project

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd memora
pnpm install
```

### 2. Configure environment

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-or-publishable-key>
```

Find these in the Supabase dashboard under **Project Settings → API**.

### 3. Apply database migrations

Run all SQL files in `supabase/migrations/` against your Supabase project, in filename order. Options:

- **Supabase CLI:** `supabase db push` (with the project linked)
- **Dashboard:** paste each migration into the SQL editor

### 4. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server with HMR |
| `pnpm build` | Type-check and produce a production build in `dist/` |
| `pnpm preview` | Serve the production build locally |
| `pnpm lint` | Run ESLint |

## Deployment

Memora is a static SPA. Build and deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

1. Set the same `VITE_SUPABASE_*` environment variables in your hosting provider
2. Build: `pnpm build`
3. Deploy the `dist/` output

Ensure your Supabase project allows your production origin in **Authentication → URL Configuration**.

## Project Structure

```
src/
├── App.tsx                 # Root component, auth gate, state orchestration
├── app/
│   ├── components/         # Pages, dialogs, and UI primitives
│   ├── data/               # Business logic, recommendation engine, defaults
│   ├── hooks/              # Custom React hooks (e.g. discovery feed)
│   ├── services/           # External API clients (Jikan)
│   ├── supabase/           # Database, auth, and storage access layer
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Theme, accent color, image helpers
├── styles/                 # Global CSS and design tokens
└── assets/                 # Static images

supabase/
└── migrations/             # Postgres schema, RLS policies, triggers
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed system design reference.

## License

UI components from [shadcn/ui](https://ui.shadcn.com) (MIT). See [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).
