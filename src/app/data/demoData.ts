import type { Board, Friend, MediaItem, User } from '../types/media';
import type { FeedPost } from '../supabase/posts';
import lateNightFilms from '../../assets/landing/late_night_films.png';
import currentlyReading from '../../assets/landing/currently_reading.png';
import favoriteAnime from '../../assets/landing/favorite_anime.png';
import visualMasterpieces from '../../assets/landing/visual_masterpieces.png';
import classics from '../../assets/landing/classics.png';
import toRewatch from '../../assets/landing/to_rewatch.png';
import bestOfSciFi from '../../assets/landing/best_of_sci_fi.png';
import animations from '../../assets/landing/animations.png';
import wildRobotPost from '../../assets/demo/wild-robot.png';
import severancePost from '../../assets/demo/severance.png';

export const DEMO_USER: User = {
  id: 'demo-user',
  username: 'you',
  displayName: 'Demo User',
  email: 'demo@memora.app',
  bio: 'Exploring Memora — nothing here is saved.',
};

export const DEMO_SEARCHABLE_USERS: User[] = [
  {
    id: 'demo-user-alex',
    username: 'alexchen',
    displayName: 'Alex Chen',
    bio: 'Film + anime nights',
  },
  {
    id: 'demo-user-sam',
    username: 'samrivera',
    displayName: 'Sam Rivera',
    bio: 'Always reading something',
  },
  {
    id: 'demo-user-jordan',
    username: 'jordanlee',
    displayName: 'Jordan Lee',
    bio: 'Sci-fi forever',
  },
  {
    id: 'demo-user-morgan',
    username: 'morgank',
    displayName: 'Morgan K',
    bio: 'Art house & classics',
  },
];

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString().slice(0, 10);

export const DEMO_MEDIA: MediaItem[] = [
  {
    id: 'demo-m1',
    title: 'Moonlight',
    type: 'movie',
    genre: ['Drama'],
    status: 'completed',
    imageUrl: lateNightFilms,
    rating: 5,
    dateAdded: daysAgo(40),
    dateCompleted: daysAgo(38),
    notes: 'Quiet and devastating.',
    boardIds: ['demo-b-latenight', 'demo-b-rewatch'],
  },
  {
    id: 'demo-m2',
    title: 'Death Note',
    type: 'manga',
    genre: ['Thriller', 'Mystery'],
    status: 'in-progress',
    imageUrl: currentlyReading,
    rating: 4,
    dateAdded: daysAgo(20),
    dateStarted: daysAgo(18),
    boardIds: ['demo-b-reading'],
  },
  {
    id: 'demo-m3',
    title: 'Frieren: Beyond Journey\'s End',
    type: 'anime',
    genre: ['Fantasy', 'Adventure'],
    status: 'completed',
    imageUrl: favoriteAnime,
    rating: 5,
    dateAdded: daysAgo(60),
    dateCompleted: daysAgo(50),
    boardIds: ['demo-b-anime', 'demo-b-rewatch'],
  },
  {
    id: 'demo-m4',
    title: 'A.I. Artificial Intelligence',
    type: 'movie',
    genre: ['Sci-Fi'],
    status: 'completed',
    imageUrl: visualMasterpieces,
    rating: 4,
    dateAdded: daysAgo(25),
    dateCompleted: daysAgo(24),
    boardIds: ['demo-b-visual'],
  },
  {
    id: 'demo-m5',
    title: 'Portrait of a Lady',
    type: 'book',
    genre: ['Classics', 'Romance'],
    status: 'completed',
    imageUrl: classics,
    rating: 4,
    dateAdded: daysAgo(90),
    dateCompleted: daysAgo(70),
    boardIds: ['demo-b-classics'],
  },
  {
    id: 'demo-m6',
    title: 'Parasite',
    type: 'movie',
    genre: ['Thriller', 'Drama'],
    status: 'completed',
    imageUrl: toRewatch,
    rating: 5,
    dateAdded: daysAgo(120),
    dateCompleted: daysAgo(118),
    boardIds: ['demo-b-rewatch', 'demo-b-latenight'],
  },
  {
    id: 'demo-m7',
    title: 'Interstellar',
    type: 'movie',
    genre: ['Sci-Fi', 'Drama'],
    status: 'completed',
    imageUrl: bestOfSciFi,
    rating: 5,
    dateAdded: daysAgo(200),
    dateCompleted: daysAgo(198),
    boardIds: ['demo-b-scifi', 'demo-b-rewatch'],
  },
  {
    id: 'demo-m8',
    title: 'Spider-Man: Across the Spider-Verse',
    type: 'movie',
    genre: ['Animation', 'Action'],
    status: 'completed',
    imageUrl: animations,
    rating: 5,
    dateAdded: daysAgo(30),
    dateCompleted: daysAgo(29),
    boardIds: ['demo-b-animations', 'demo-b-visual'],
  },
];

function board(
  id: string,
  name: string,
  mediaIds: string[],
  coverImage: string,
  type?: string,
): Board {
  return {
    id,
    name,
    mediaIds,
    type,
    isPublic: true,
    coverImage,
    createdAt: daysAgo(100),
    description: `Demo board — ${name}`,
  };
}

const allMediaIds = DEMO_MEDIA.map((m) => m.id);

export function createDemoBoards(): Board[] {
  return [
    {
      id: 'demo-b-all',
      name: 'All',
      mediaIds: allMediaIds,
      isPublic: false,
      isSystem: true,
      createdAt: daysAgo(100),
    },
    board(
      'demo-b-latenight',
      'Late Night Films',
      ['demo-m1', 'demo-m6'],
      lateNightFilms,
      'movie',
    ),
    board('demo-b-reading', 'Currently Reading', ['demo-m2'], currentlyReading, 'manga'),
    board('demo-b-anime', 'Favorite Anime', ['demo-m3'], favoriteAnime, 'anime'),
    board(
      'demo-b-visual',
      'Visual Masterpieces',
      ['demo-m4', 'demo-m8'],
      visualMasterpieces,
      'movie',
    ),
    board('demo-b-classics', 'Classics', ['demo-m5'], classics, 'book'),
    board(
      'demo-b-rewatch',
      'To Rewatch',
      ['demo-m1', 'demo-m3', 'demo-m6', 'demo-m7'],
      toRewatch,
      'movie',
    ),
    board('demo-b-scifi', 'Best of Sci Fi', ['demo-m7'], bestOfSciFi, 'movie'),
    board('demo-b-animations', 'Animations', ['demo-m8'], animations, 'movie'),
  ];
}

export function createDemoFriends(): Friend[] {
  return [
    {
      id: 'demo-user-alex',
      user: DEMO_SEARCHABLE_USERS[0],
      status: 'accepted',
      addedAt: daysAgo(45),
    },
    {
      id: 'demo-user-sam',
      user: DEMO_SEARCHABLE_USERS[1],
      status: 'accepted',
      addedAt: daysAgo(20),
    },
    {
      id: 'demo-user-jordan',
      user: DEMO_SEARCHABLE_USERS[2],
      status: 'pending',
      direction: 'incoming',
      addedAt: daysAgo(2),
    },
  ];
}

export function createDemoFeedPosts(): FeedPost[] {
  return [
    {
      id: 'demo-post-1',
      userId: 'demo-user-alex',
      body: 'I can\'t life, my eyes got misty after watching The Wild Robot.',
      imageUrl: wildRobotPost,
      createdAt: new Date(now - 3 * 3600000).toISOString(),
      author: DEMO_SEARCHABLE_USERS[0],
      commentCount: 0,
      likeCount: 4,
      likedByMe: false,
    },
    {
      id: 'demo-post-2',
      userId: 'demo-user-sam',
      body: 'Can\'t step into an elevator the same way after Severance. What a show.',
      imageUrl: severancePost,
      createdAt: new Date(now - 28 * 3600000).toISOString(),
      author: DEMO_SEARCHABLE_USERS[1],
      commentCount: 0,
      likeCount: 2,
      likedByMe: true,
    },
  ];
}

export const DEMO_PREFERRED_GENRES = ['Drama', 'Sci-Fi', 'Fantasy', 'Thriller', 'Animation'];
export const DEMO_PREFERRED_MEDIA_TYPES = ['movie', 'anime', 'manga', 'book'];
