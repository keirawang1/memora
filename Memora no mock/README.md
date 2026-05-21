# Memora - Your taste, redefined.

A comprehensive media tracking application built with React, TypeScript, and Tailwind CSS. Track movies, TV shows, anime, comics, books, and custom media types using a flexible board-based organization system.

## Features

### Media Management
- Track multiple media types: Movies, TV Shows, Anime, Comics, Books
- Support for custom media types
- Track watch status: watched, watching, want-to-watch, dropped
- Add ratings (1-5 stars)
- Add personal notes to each media item
- Custom tags and genres

### Board System
- Organize media into custom boards (collections)
- Default boards: "All" and "Watchlist"
- Create unlimited custom boards
- Set boards as public or private
- Add custom cover images to boards
- Add descriptions to boards

### Social Features
- Add friends
- View friends' activity
- Accept/reject friend requests
- View friends' recently watched content

### Personalization
- Customizable accent color
- Profile customization (avatar, display name, bio)
- Account settings

### Recommendations
- Personalized recommendations (placeholder - ready for integration)
- Trending content section (placeholder - ready for integration)

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── ui/              # Reusable UI components (shadcn/ui)
│   │   ├── AddMediaDialog.tsx
│   │   ├── AddBoardDialog.tsx
│   │   ├── BoardCard.tsx
│   │   ├── BoardDetailPage.tsx
│   │   ├── EditProfileDialog.tsx
│   │   ├── FriendsPage.tsx
│   │   ├── LibraryPage.tsx
│   │   ├── MediaCard.tsx
│   │   ├── MediaDetailDialog.tsx
│   │   ├── ProfilePage.tsx
│   │   ├── RecommendationsPage.tsx
│   │   └── SettingsDialog.tsx
│   ├── data/
│   │   ├── defaults.ts      # Default data initialization
│   │   └── mockData.ts      # Cleaned (empty exports)
│   ├── types/
│   │   └── media.ts         # TypeScript type definitions
│   └── App.tsx              # Main application component
├── styles/
│   ├── fonts.css            # Font imports
│   └── theme.css            # Theme and design tokens
└── imports/                 # Figma imported assets
```

## Key Concepts

### Default Boards
The app always maintains two default boards:
- **All**: Automatically contains all media marked as watched, watching, or dropped
- **Watchlist**: Automatically contains all media marked as want-to-watch

### Automatic Board Assignment
When adding media, the app automatically assigns it to appropriate boards based on status:
- `watched`, `watching`, `dropped` → Added to "All" board
- `want-to-watch` → Added to "Watchlist" board

### State Management
All application state is managed using React's `useState` hooks in the main `App.tsx` component. This includes:
- Media items
- Boards
- Friends
- User profile
- Accent color
- Custom genres and media types

### Statistics Calculation
User statistics are dynamically calculated from the media library using React's `useMemo` hook, ensuring they're always up-to-date.

## Data Types

### MediaItem
```typescript
interface MediaItem {
  id: string;
  title: string;
  type: MediaType;        // e.g., 'movie', 'tv', 'anime', 'comic', 'book'
  genre: Genre[];
  status: WatchStatus;    // 'watched' | 'want-to-watch' | 'watching' | 'dropped'
  imageUrl: string;
  gallery?: string[];
  rating?: number;        // 1-5
  dateAdded: string;
  dateStarted?: string;
  dateCompleted?: string;
  notes?: string;
}
```

### Board
```typescript
interface Board {
  id: string;
  name: string;
  mediaIds: string[];
  isPublic: boolean;
  coverImage?: string;
  createdAt: string;
  description?: string;
}
```

### User
```typescript
interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
}
```

## Customization

### Adding Custom Media Types
Users can add custom media types through the "Add Media" dialog. These are stored in the app state and persist during the session.

### Adding Custom Genres
Users can add custom genres through the media detail dialog when editing media. These are also stored in app state.

### Accent Color
The accent color can be customized in Settings and affects:
- App logo tint
- Profile icon background
- Add buttons
- New Board button

## Future Enhancements

The app is structured to easily add:
- Backend integration (API calls, database)
- User authentication
- Persistent storage (localStorage, backend database)
- Real recommendation algorithm
- Social features (public profiles, sharing boards)
- Import/export functionality
- Search and filtering
- Advanced statistics and analytics
- Third-party API integration (TMDB, MyAnimeList, etc.)

## Technology Stack

- **React 18.3.1** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - Component library
- **Radix UI** - Headless UI components
- **Lucide React** - Icons
- **Sonner** - Toast notifications
- **Vite** - Build tool

## Getting Started

The app initializes with empty state - no pre-populated data. Start by:
1. Adding your first media item using the "+" button
2. Creating custom boards to organize your media
3. Customizing your profile and accent color
4. Adding friends (when backend is integrated)

## Notes

- All data is currently stored in React state (session-based)
- Mock data has been removed to prepare for production use
- The app is ready for backend integration
- Recommendations and trending sections are placeholders ready for real data
- Friend activity requires backend implementation for persistence
