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
