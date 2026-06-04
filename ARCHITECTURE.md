# Memora - Architecture Documentation

## Application Architecture

Memora follows a straightforward React component architecture with centralized state management in the root App component.

## Component Hierarchy

```
App (Root)
├── Header
│   ├── Logo
│   └── Profile Dropdown Menu
│       ├── View Profile
│       └── Settings
│
├── Main Content (Tabs)
│   ├── Library Tab
│   │   ├── LibraryPage
│   │   │   └── BoardCard[] (grid of boards)
│   │   └── BoardDetailPage (when board selected)
│   │       └── MediaCard[] (media in selected board)
│   │
│   ├── Recommendations Tab
│   │   └── RecommendationsPage
│   │       ├── Recommended For You (empty state)
│   │       └── Trending Now (empty state)
│   │
│   └── Friends Tab
│       └── FriendsPage
│           ├── Add Friend Form
│           ├── Friend Requests
│           ├── Friends List
│           └── Friend Activity
│
└── Dialogs (overlays)
    ├── AddMediaDialog
    ├── AddBoardDialog
    ├── MediaDetailDialog
    ├── EditProfileDialog
    └── SettingsDialog
```

## State Management

### Centralized State (App.tsx)

All application state lives in the main App component:

```typescript
// Core data
mediaItems: MediaItem[]          // All user's media
boards: Board[]                  // All user's boards
friends: Friend[]                // User's friends

// User data
user: User                       // Current user profile
userStats: UserStats            // Calculated stats
accentColor: string             // Theme accent color

// Custom types
customGenres: string[]          // User-added genres
customMediaTypes: string[]      // User-added media types

// UI state
activeTab: string               // Current active tab
selectedBoard: Board | null     // Currently viewing board
selectedMedia: MediaItem | null // Currently viewing media
showProfile: boolean            // Profile page visibility
[dialog]Open: boolean           // Various dialog states
```

### State Updates

All state updates flow through handler functions in App.tsx:

- `handleAddMedia()` - Add new media item
- `handleAddBoard()` - Create new board
- `handleUpdateMedia()` - Update existing media
- `handleDeleteMedia()` - Remove media
- `handleUpdateBoard()` - Update board settings
- `handleDeleteBoard()` - Delete a board
- `handleAddFriend()` - Send friend request
- `handleAcceptFriend()` - Accept friend request
- `handleUpdateProfile()` - Update user profile
- etc.

### Props Flow

State and handlers are passed down as props:

```
App → Page Components → Sub-components
```

## Key Components

### Pages

**LibraryPage** - Displays board grid, handles board creation

- Props: boards, mediaItems, onBoardClick, onCreateBoard, accentColor
- Shows all boards as cards
- "New Board" button triggers AddBoardDialog

**BoardDetailPage** - Shows media items in a board

- Props: board, mediaItems, onBack, onMediaClick, onUpdateBoard, onDeleteBoard
- Displays media as cards
- Board settings (edit/delete)
- Back navigation to library

**RecommendationsPage** - Recommendation sections

- Props: recommendations, onMediaClick, boards, onAddMedia
- Empty state ready for recommendation algorithm
- Placeholder for trending content

**FriendsPage** - Social features

- Props: friends, friendActivity, handlers
- Add friend form
- Friend requests list
- Friends list with activity

**ProfilePage** - User profile view

- Props: user, stats, mediaItems, onUpdateProfile
- Profile info display
- Statistics
- Media grid

### Dialogs

**AddMediaDialog** - Form to add new media

- Floating action button trigger
- Full media form (title, type, genre, status, etc.)
- Board selection
- Custom genre/type creation

**AddBoardDialog** - Form to create board

- Board name
- Description
- Privacy setting
- Cover image

**MediaDetailDialog** - Detailed media view

- Full media info
- Editable notes
- Rating
- Tags/genres
- Delete option

**SettingsDialog** - App settings

- Accent color picker
- Account settings
- Username change

**EditProfileDialog** - Profile editor

- Display name
- Bio
- Avatar upload

### UI Components

Located in `components/ui/`:

- Reusable components from shadcn/ui
- Button, Card, Dialog, Input, etc.
- Fully typed and styled

## Data Flow Patterns

### Adding Media

1. User clicks floating "+" button
2. AddMediaDialog opens
3. User fills form and selects boards
4. `handleAddMedia()` called
5. Media added to state
6. Automatically added to default boards based on status
7. Selected boards updated
8. Toast notification shown

### Board Organization

1. Media status determines default board:
   - watched/watching/dropped → "All" board
   - want-to-watch → "Watchlist" board
2. User can manually add to custom boards
3. Board.mediaIds[] stores references to media

### Statistics Calculation

```typescript
useMemo(() => {
  // Dynamically calculate from mediaItems
  // Count by type, status
  // Always up-to-date
}, [mediaItems]);
```

## Styling System

### Tailwind CSS v4

- Utility-first CSS framework
- Custom theme in `src/styles/theme.css`
- Design tokens for colors, spacing, typography

### Design Tokens

```css
/* From theme.css */
--color-background
--color-foreground
--color-primary
--color-secondary
/* etc. */
```

### Accent Color

Dynamic accent color applied via inline styles:

- Logo container
- Profile icon background
- Add buttons
- New Board button

## Type System

### Core Types (types/media.ts)

**MediaType** - String (extensible for custom types)

**WatchStatus** - Union type

- 'completed' | 'not-started' | 'in-progress' | 'dropped'

**Genre** - String (extensible for custom genres)

**MediaItem** - Primary content type
**Board** - Collection type
**User** - User profile type
**Friend** - Social connection type
**UserStats** - Statistics type

All fully typed for TypeScript safety.

## File Organization

```
src/app/
├── components/
│   ├── ui/           # Reusable UI primitives
│   ├── [Page].tsx    # Page-level components
│   └── [Dialog].tsx  # Dialog components
├── data/
│   ├── defaults.ts   # Default data factory functions
│   └── mockData.ts   # Empty exports (cleaned)
├── types/
│   └── media.ts      # TypeScript type definitions
└── App.tsx           # Root component with state
```

## Extension Points

### Adding New Features

**New Media Type:**

1. User adds via AddMediaDialog
2. Stored in `customMediaTypes` state
3. Available in dropdowns
4. Stats automatically calculated

**New Board:**

1. User creates via AddBoardDialog
2. Added to `boards` state
3. Can assign media to it
4. Public/private setting

**Backend Integration:**
Replace state management with:

- API calls in handlers
- Server-side persistence
- Real-time updates
- Authentication

**Recommendation Algorithm:**
Update RecommendationsPage to:

- Fetch recommendations from API
- Display actual content
- Connect "Add" buttons to library

## Performance Considerations

**useMemo for Stats**

- Recalculates only when mediaItems changes
- Prevents unnecessary re-renders

**Component Splitting**

- Pages and dialogs as separate components
- Easier code splitting
- Lazy loading potential

**Prop Drilling**
Current approach uses prop drilling (acceptable for app size).
For scaling, consider:

- Context API
- State management library (Zustand, Redux)
- React Query for server state

## Future Architecture Considerations

### Backend Integration

```
Current: React State
Future: React → API → Database
```

### State Management

```
Current: useState in App.tsx
Future: Context API or Zustand
```

### Data Persistence

```
Current: Session only
Future: localStorage + backend
```

### Authentication

```
Current: Single user
Future: Multi-user with auth
```
