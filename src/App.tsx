import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './app/components/ui/tabs';
import { LibraryPage } from './app/components/LibraryPage';
import { BoardDetailPage } from './app/components/BoardDetailPage';
import { FriendsPage } from './app/components/FriendsPage';
import { RecommendationsPage } from './app/components/RecommendationsPage';
import { AddMediaDialog } from './app/components/AddMediaDialog';
import { AddBoardDialog } from './app/components/AddBoardDialog';
import { MediaDetailDialog } from './app/components/MediaDetailDialog';
import { ProfilePage } from './app/components/ProfilePage';
import { UserProfilePage } from './app/components/UserProfilePage';
import { UserAvatar } from './app/components/UserAvatar';
import { NotificationCenter } from './app/components/NotificationCenter';
import { SettingsDialog } from './app/components/SettingsDialog';
import { Button } from './app/components/ui/button';
import { DEFAULT_ACCENT_COLOR, getDefaultBoards, createDefaultUser } from './app/data/defaults';
import {
  filterBoardsForDisplay,
  getBoardMediaItems,
  isAllBoard,
  sortBoardsWithAllFirst,
  syncBoardMembershipsLocally,
} from './app/data/allBoard';
import { mergeCustomOrder } from './app/data/sortOrder';
import type { MediaItem, Friend, Board, User } from './app/types/media';
import { Library, User as UserIcon, Users, Sparkles, Settings, LogOut } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './app/components/ui/dropdown-menu';
import logoImage from './assets/logo.png';
import { supabase } from './app/supabase/client';
import { createBoard, fetchLibrary, updateBoard, deleteBoard, updateBoardMediaOrder } from './app/supabase/boards';
import {
  createMedia,
  deleteMedia,
  fetchMediaById,
  updateMedia,
  type CreateMediaInput,
} from './app/supabase/media';
import {
  acceptFriendRequest,
  fetchFriends,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
} from './app/supabase/friends';
import {
  ensureUserProfile,
  getUserProfile,
  getUserTagPreferences,
  deleteUserAccount,
  getUserThemePreferences,
  updateUserEmail,
  updateUserTheme,
  updateUserGenres,
  updateUserMediaTypes,
  updateUserProfile,
  updateUserShowAllBoard,
  updateUsername,
  updateUserBoardSort,
  updateUserMediaSort,
  getUserOnboardingState,
  saveOnboardingGenres,
  completeOnboarding,
} from './app/supabase/users';
import type { SortMode } from './app/types/sort';
import { AuthPage } from './app/components/AuthPage';
import { OnboardingGenrePage } from './app/components/OnboardingGenrePage';
import { OnboardingTour } from './app/components/OnboardingTour';
import {
  applyAppTheme,
  createDefaultThemeSettings,
  type AppThemeSettings,
} from './app/utils/appTheme';
import {
  APP_ROUTES,
  getBoardIdFromPath,
  getTabFromPath,
  getUserIdFromPath,
  isKnownAppPath,
  isOnboardingPath,
  isProfilePath,
  isPublicAuthPath,
  isResetPasswordPath,
  isSignInFlowPath,
  tabToRoute,
  type AppTab,
} from './app/utils/appRoutes';
import {
  clearAuthParamsFromUrl,
  isPasswordRecoveryUrl,
} from './app/utils/authRecovery';
import {
  hasAuthCallbackParams,
  isSignupConfirmCallback,
  settleAuthCallbackSession,
} from './app/utils/authCallback';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [boards, setBoards] = useState<Board[]>(getDefaultBoards());
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [addBoardDialogOpen, setAddBoardDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [themeSettings, setThemeSettings] = useState<AppThemeSettings>(
    createDefaultThemeSettings(),
  );
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [user, setUser] = useState(createDefaultUser());
  
  // Custom genres and media types
  const [customGenres, setCustomGenres] = useState<string[]>([]);
  const [customMediaTypes, setCustomMediaTypes] = useState<string[]>([]);
  const [showAllBoard, setShowAllBoard] = useState(true);
  const [boardSortMode, setBoardSortMode] = useState<SortMode>('alphabetical');
  const [boardCustomOrder, setBoardCustomOrder] = useState<string[]>([]);
  const [mediaSortMode, setMediaSortMode] = useState<SortMode>('alphabetical');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [notificationRefreshKey, setNotificationRefreshKey] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);
  const authedUserIdRef = useRef<string | null>(null);
  const libraryLoadingRef = useRef(false);

  const boardIdFromUrl = getBoardIdFromPath(location.pathname);
  const viewingUserId = getUserIdFromPath(location.pathname);
  const showProfile = isProfilePath(location.pathname);
  const activeTab: AppTab = getTabFromPath(location.pathname) ?? 'library';

  const selectedBoard = useMemo(() => {
    if (!boardIdFromUrl) return null;
    return boards.find((board) => board.id === boardIdFromUrl) ?? null;
  }, [boardIdFromUrl, boards]);

  const resetAuthState = () => {
    authedUserIdRef.current = null;
    libraryLoadingRef.current = false;
    setIsAuthenticated(false);
    setLibraryLoaded(false);
    setBoards(getDefaultBoards());
    setMediaItems([]);
    setFriends([]);
    setCustomGenres([]);
    setCustomMediaTypes([]);
    setShowAllBoard(true);
    setBoardSortMode('alphabetical');
    setBoardCustomOrder([]);
    setMediaSortMode('alphabetical');
    const defaultTheme = createDefaultThemeSettings();
    setThemeSettings(defaultTheme);
    setAccentColor(applyAppTheme(defaultTheme));
    setUser(createDefaultUser());
    setOnboardingCompleted(true);
    setPreferredGenres([]);
    setOnboardingLoaded(false);
    setShowOnboardingTour(false);
  };

  const beginPasswordRecovery = (clearUrl = false) => {
    resetAuthState();
    setPasswordRecoveryPending(true);
    if (clearUrl) {
      clearAuthParamsFromUrl();
    }
    if (!isResetPasswordPath(location.pathname)) {
      navigate(APP_ROUTES.resetPassword, { replace: true });
    }
  };

  useEffect(() => {
    if (authChecking || passwordRecoveryPending) return;
    if (isAuthenticated) return;
    // Don't strip Supabase confirm/recovery tokens via client navigation.
    if (hasAuthCallbackParams()) return;
    if (location.pathname === APP_ROUTES.resetPassword) {
      navigate(APP_ROUTES.signIn, { replace: true });
      return;
    }
    if (isPublicAuthPath(location.pathname)) return;
    navigate(APP_ROUTES.signIn, { replace: true });
  }, [authChecking, isAuthenticated, passwordRecoveryPending, location.pathname, navigate]);

  useEffect(() => {
    if (passwordRecoveryPending) return;
    if (!isAuthenticated || !onboardingLoaded) return;
    if (!onboardingCompleted) {
      if (preferredGenres.length === 0) {
        if (!isOnboardingPath(location.pathname)) {
          navigate(APP_ROUTES.onboarding, { replace: true });
        }
        return;
      }
      if (isOnboardingPath(location.pathname)) {
        navigate(APP_ROUTES.library, { replace: true });
      }
      return;
    }
    if (location.pathname === '/') {
      navigate(APP_ROUTES.library, { replace: true });
      return;
    }
    if (isSignInFlowPath(location.pathname) || isOnboardingPath(location.pathname)) {
      navigate(APP_ROUTES.library, { replace: true });
      return;
    }
    if (!isKnownAppPath(location.pathname)) {
      navigate(APP_ROUTES.library, { replace: true });
    }
  }, [
    isAuthenticated,
    onboardingLoaded,
    onboardingCompleted,
    preferredGenres.length,
    location.pathname,
    navigate,
    passwordRecoveryPending,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !boardIdFromUrl || !libraryLoaded) return;
    if (!boards.some((board) => board.id === boardIdFromUrl)) {
      navigate(APP_ROUTES.library, { replace: true });
    }
  }, [isAuthenticated, boardIdFromUrl, boards, libraryLoaded, navigate]);

  const loadUserTagPreferences = async (userId: string) => {
    try {
      const prefs = await getUserTagPreferences(userId);
      setCustomGenres(prefs.genres);
      setCustomMediaTypes(prefs.mediaTypes);
      setShowAllBoard(prefs.showAllBoard);
      setBoardSortMode(prefs.librarySort.boardSortMode);
      setBoardCustomOrder(prefs.librarySort.boardCustomOrder);
      setMediaSortMode(prefs.librarySort.mediaSortMode);
    } catch {
      setCustomGenres([]);
      setCustomMediaTypes([]);
      setShowAllBoard(true);
      setBoardSortMode('alphabetical');
      setBoardCustomOrder([]);
      setMediaSortMode('alphabetical');
    }
  };

  const persistBoardCustomOrder = async (order: string[]) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    await updateUserBoardSort(authUser.id, boardSortMode, order);
  };

  const loadLibraryForUser = async () => {
    if (libraryLoadingRef.current) return;
    libraryLoadingRef.current = true;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      libraryLoadingRef.current = false;
      return;
    }

    const secondaryLoads = Promise.all([
      getUserThemePreferences(user.id)
        .then((theme) => {
          setThemeSettings(theme);
          setAccentColor(applyAppTheme(theme));
        })
        .catch(() => {
          // Keep current theme if load fails
        }),
      loadUserTagPreferences(user.id).catch(() => {
        setCustomGenres([]);
        setCustomMediaTypes([]);
        setShowAllBoard(true);
      }),
      getUserOnboardingState(user.id)
        .then((onboarding) => {
          setOnboardingCompleted(onboarding.completed);
          setPreferredGenres(onboarding.preferredGenres);
          if (!onboarding.completed && onboarding.preferredGenres.length > 0) {
            setShowOnboardingTour(true);
          }
        })
        .catch(() => {
          setOnboardingCompleted(true);
          setPreferredGenres([]);
        })
        .finally(() => setOnboardingLoaded(true)),
      fetchFriends(user.id)
        .then(setFriends)
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Failed to load friends';
          toast.error(message);
          setFriends([]);
        }),
    ]);

    try {
      const { media, boards, mediaError } = await fetchLibrary(user.id);
      setMediaItems(media);
      setBoards(boards);
      if (mediaError) {
        toast.error(mediaError.message || 'Failed to load media');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load library';
      toast.error(message);
    } finally {
      setLibraryLoaded(true);
      libraryLoadingRef.current = false;
    }

    await secondaryLoads;
  };

  const handleAuthSuccess = (
    userId: string,
    username: string,
    displayName: string,
    email: string,
    _accessToken: string,
    avatar?: string,
    bio?: string,
    isNewSignup?: boolean,
  ) => {
    const alreadyAuthed = authedUserIdRef.current === userId;
    authedUserIdRef.current = userId;
    setUser({
      id: userId,
      username,
      displayName,
      email,
      avatar,
      bio: bio ?? '',
    });
    setIsAuthenticated(true);
    if (isNewSignup) {
      setOnboardingCompleted(false);
      setPreferredGenres([]);
      setOnboardingLoaded(false);
      setShowOnboardingTour(false);
    }
    if (!alreadyAuthed || !libraryLoaded) {
      void loadLibraryForUser();
    }
    if (isNewSignup) {
      navigate(APP_ROUTES.onboarding, { replace: true });
    } else if (!alreadyAuthed && !isKnownAppPath(location.pathname)) {
      navigate(APP_ROUTES.library, { replace: true });
    }
  };

  const handleOnboardingGenresContinue = async (genres: string[]) => {
    try {
      await saveOnboardingGenres(user.id, genres);
      setPreferredGenres(genres);
      setShowOnboardingTour(true);
      navigate(APP_ROUTES.library, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save preferences';
      toast.error(message);
      throw error;
    }
  };

  const handleOnboardingTourComplete = async () => {
    try {
      await completeOnboarding(user.id);
      setOnboardingCompleted(true);
      setShowOnboardingTour(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete onboarding';
      toast.error(message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setPasswordRecoveryPending(false);
    resetAuthState();
    navigate(APP_ROUTES.signIn, { replace: true });
    toast.info('Signed out');
  };

  const handlePasswordResetComplete = async () => {
    setPasswordRecoveryPending(false);
    resetAuthState();
    navigate(APP_ROUTES.signIn, { replace: true });
  };

  useEffect(() => {
    let mounted = true;
    let applyingSession = false;

    const applySession = async (
      session: {
        user: { id: string; email?: string | null };
        access_token: string;
      },
      isNewSignup = false,
    ) => {
      if (!mounted || applyingSession) return;
      if (authedUserIdRef.current === session.user.id) return;
      applyingSession = true;
      try {
        const profile =
          (await getUserProfile(session.user.id)) ??
          (await ensureUserProfile(
            session.user.id,
            session.user.email ?? '',
          ));

        handleAuthSuccess(
          session.user.id,
          profile.username,
          profile.displayName,
          profile.email,
          session.access_token,
          profile.avatar,
          profile.bio,
          isNewSignup,
        );
      } catch (error) {
        if (mounted) {
          setIsAuthenticated(false);
          const message =
            error instanceof Error ? error.message : 'Failed to load profile';
          toast.error(message);
        }
      } finally {
        applyingSession = false;
      }
    };

    const restoreSession = async () => {
      if (isPasswordRecoveryUrl()) {
        beginPasswordRecovery();
        const { data: { session } } = await supabase.auth.getSession();
        if (session && mounted) {
          clearAuthParamsFromUrl();
        }
        if (mounted) setAuthChecking(false);
        return;
      }

      try {
        const { session, isSignupConfirm } = await settleAuthCallbackSession();
        if (session?.user && mounted) {
          await applySession(session, isSignupConfirm);
        }
      } catch (error) {
        console.error('Error restoring auth session:', error);
      }

      if (mounted) setAuthChecking(false);
    };

    void restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'PASSWORD_RECOVERY') {
          beginPasswordRecovery(true);
          return;
        }

        if (event === 'SIGNED_OUT') {
          setPasswordRecoveryPending(false);
          resetAuthState();
          navigate(APP_ROUTES.signIn, { replace: true });
          return;
        }

        // Email confirmation can deliver the session via SIGNED_IN after mount.
        if (event === 'SIGNED_IN' && session?.user && !isPasswordRecoveryUrl()) {
          await applySession(session, isSignupConfirmCallback());
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleAddMedia = async (
    newMedia: Omit<MediaItem, 'id' | 'dateAdded'> & { id?: string },
    boardIds?: string[],
  ) => {
    try {
      const input: CreateMediaInput = {
        title: newMedia.title,
        type: newMedia.type,
        genre: newMedia.genre,
        status: newMedia.status,
        imageUrl: newMedia.imageUrl,
        gallery: newMedia.gallery,
        rating: newMedia.rating,
        dateStarted: newMedia.dateStarted,
        dateCompleted: newMedia.dateCompleted,
        notes: newMedia.notes,
        link: newMedia.link,
        boardIds: boardIds ?? [],
      };
      const created = await createMedia(input);
      const nextMedia = [...mediaItems, created];
      setMediaItems(nextMedia);
      setBoards((prev) =>
        syncBoardMembershipsLocally(prev, nextMedia, created.id, {
          boardIds: created.boardIds ?? [],
        }),
      );

      toast.success('Media added to your library!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add media';
      toast.error(message);
      throw error;
    }
  };

  const handleAddBoard = async (input: Parameters<typeof createBoard>[0]) => {
    try {
      const newBoard = await createBoard(input);
      setBoards((prev) =>
        sortBoardsWithAllFirst([...prev.filter((b) => b.id !== newBoard.id), newBoard]),
      );
      const nextCustomOrder = mergeCustomOrder(boardCustomOrder, [newBoard.id]);
      if (nextCustomOrder.length !== boardCustomOrder.length) {
        setBoardCustomOrder(nextCustomOrder);
        try {
          await persistBoardCustomOrder(nextCustomOrder);
        } catch {
          // Board list still works if custom order save fails
        }
      }
      toast.success('Board created successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create board';
      toast.error(message);
      throw error;
    }
  };

  const handleBoardClick = (board: Board) => {
    navigate(APP_ROUTES.libraryBoard(board.id));
  };

  const handleBackToLibrary = () => {
    navigate(APP_ROUTES.library);
  };

  const handleMediaClick = async (media: MediaItem) => {
    setSelectedMedia(media);
    setDetailDialogOpen(true);
    try {
      const full = await fetchMediaById(media.id);
      if (full) {
        setSelectedMedia(full);
        setMediaItems((prev) =>
          prev.map((item) => (item.id === media.id ? { ...item, gallery: full.gallery } : item)),
        );
      }
    } catch {
      // Detail still opens without gallery
    }
  };

  const handleUpdateNotes = async (mediaId: string, notes: string) => {
    try {
      const updated = await updateMedia(mediaId, { notes });
      setMediaItems((prev) =>
        prev.map((item) => (item.id === mediaId ? updated : item)),
      );
      setSelectedMedia((prev) => (prev?.id === mediaId ? updated : prev));
      toast.success('Notes updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update notes';
      toast.error(message);
    }
  };

  const handleUpdateMedia = async (
    mediaId: string,
    updates: Partial<MediaItem>,
    boardIds?: string[],
  ) => {
    try {
      const updated = await updateMedia(mediaId, {
        title: updates.title,
        type: updates.type,
        genre: updates.genre,
        status: updates.status,
        imageUrl: updates.imageUrl,
        gallery: updates.gallery,
        rating: updates.rating,
        dateStarted: updates.dateStarted,
        dateCompleted: updates.dateCompleted,
        notes: updates.notes,
        link: updates.link,
        boardIds,
      });
      const nextMedia = mediaItems.map((item) =>
        item.id === mediaId
          ? {
              ...item,
              ...updated,
              gallery: updated.gallery ?? item.gallery,
            }
          : item,
      );
      setMediaItems(nextMedia);
      setSelectedMedia((prev) =>
        prev?.id === mediaId
          ? { ...prev, ...updated, gallery: updated.gallery ?? prev.gallery }
          : prev,
      );
      if (boardIds !== undefined) {
        setBoards((prev) =>
          syncBoardMembershipsLocally(prev, nextMedia, mediaId, {
            boardIds: updated.boardIds ?? boardIds,
          }),
        );
      }

      toast.success('Media updated successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update media';
      toast.error(message);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await deleteMedia(mediaId);
      const nextMedia = mediaItems.filter((item) => item.id !== mediaId);
      setMediaItems(nextMedia);
      setBoards((prev) =>
        syncBoardMembershipsLocally(prev, nextMedia, mediaId, { remove: true }),
      );
      setSelectedMedia(null);
      setDetailDialogOpen(false);
      toast.success('Media removed from your library');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete media';
      toast.error(message);
    }
  };

  const handleUpdateBoard = async (
    boardId: string,
    updates: Partial<Board> & { coverImageDataUrl?: string },
  ) => {
    try {
      const { coverImageDataUrl, ...boardUpdates } = updates;
      const updated = await updateBoard(boardId, {
        ...boardUpdates,
        coverImageDataUrl,
      });
      setBoards((prev) => prev.map((board) => (board.id === boardId ? updated : board)));
      toast.success('Board settings updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update board';
      toast.error(message);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await deleteBoard(boardId);
      setBoards((prev) => prev.filter((board) => board.id !== boardId));
      if (boardIdFromUrl === boardId) {
        navigate(APP_ROUTES.library);
      }
      toast.success('Board deleted successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete board';
      toast.error(message);
    }
  };


  const handleCreateBoard = () => {
    setAddBoardDialogOpen(true);
  };

  const handleAddFriend = async (targetUser: User) => {
    if (targetUser.id === user.id) {
      toast.error("You can't add yourself");
      return;
    }
    const existing = friends.find((f) => f.user.id === targetUser.id);
    if (existing?.status === 'accepted') {
      toast.error('Already friends');
      return;
    }
    if (existing?.status === 'pending' && existing.direction === 'outgoing') {
      toast.error('Friend request already sent');
      return;
    }
    if (existing?.status === 'pending' && existing.direction === 'incoming') {
      toast.error('They already sent you a request — accept it below');
      return;
    }

    try {
      await sendFriendRequest(targetUser.id);
      setFriends(await fetchFriends(user.id));
      setNotificationRefreshKey((k) => k + 1);
      toast.success(`Friend request sent to @${targetUser.username}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send friend request';
      toast.error(message);
    }
  };

  const handleAcceptFriend = async (requesterId: string) => {
    try {
      await acceptFriendRequest(requesterId);
      setFriends(await fetchFriends(user.id));
      setNotificationRefreshKey((k) => k + 1);
      toast.success('Friend request accepted!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept friend request';
      toast.error(message);
    }
  };

  const handleRejectFriend = async (requesterId: string) => {
    try {
      await rejectFriendRequest(requesterId);
      setFriends(await fetchFriends(user.id));
      toast.info('Friend request rejected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject friend request';
      toast.error(message);
    }
  };

  const handleUnfriend = async (friendUserId: string) => {
    try {
      await removeFriend(friendUserId);
      setFriends(await fetchFriends(user.id));
      toast.success('Friend removed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove friend';
      toast.error(message);
    }
  };

  const handleSaveCustomGenres = async (genres: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in');
      await updateUserGenres(user.id, genres);
      setCustomGenres(genres);
      toast.success('Custom genres saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save genres';
      toast.error(message);
      throw error;
    }
  };

  const handleSaveLibrarySettings = async (data: { showAllBoard: boolean }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in');
      await updateUserShowAllBoard(user.id, data.showAllBoard);
      setShowAllBoard(data.showAllBoard);
      if (!data.showAllBoard && selectedBoard && isAllBoard(selectedBoard)) {
        navigate(APP_ROUTES.library);
      }
      toast.success('Library settings saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update setting';
      toast.error(message);
      throw error;
    }
  };

  const handleSaveCustomMediaTypes = async (mediaTypes: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in');
      await updateUserMediaTypes(user.id, mediaTypes);
      setCustomMediaTypes(mediaTypes);
      toast.success('Custom media types saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save media types';
      toast.error(message);
      throw error;
    }
  };

  const handleThemePreview = (settings: AppThemeSettings) => {
    setThemeSettings(settings);
    setAccentColor(applyAppTheme(settings));
  };

  const handleSaveTheme = async (settings: AppThemeSettings) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('You must be signed in');
      const saved = await updateUserTheme(authUser.id, settings);
      setThemeSettings(saved);
      setAccentColor(applyAppTheme(saved));
      toast.success('Theme saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save theme';
      toast.error(message);
      throw error;
    }
  };

  const handleViewUserProfile = (userId: string) => {
    if (userId === user.id) {
      navigate(APP_ROUTES.profile);
      return;
    }
    navigate(APP_ROUTES.user(userId));
  };

  const handleGoToLibrary = () => {
    navigate(APP_ROUTES.library);
  };

  const handleViewOwnProfile = () => {
    navigate(APP_ROUTES.profile);
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'library' || tab === 'recommendations' || tab === 'friends') {
      navigate(tabToRoute(tab));
    }
  };

  const handleBackFromProfile = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(APP_ROUTES.library);
  };

  const handleBackFromUserProfile = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(APP_ROUTES.friends);
  };

  const handleUpdateProfile = async (data: { displayName: string; bio: string; avatar?: string }) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('You must be signed in');
      const profile = await updateUserProfile(authUser.id, data);
      setUser({
        ...user,
        displayName: profile.displayName,
        bio: profile.bio ?? data.bio.trim(),
        avatar: profile.avatar,
      });
      toast.success('Profile updated successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(message);
      throw error;
    }
  };

  const handleBoardSortModeChange = async (mode: SortMode) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    setBoardSortMode(mode);
    try {
      await updateUserBoardSort(authUser.id, mode);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save sort preference';
      toast.error(message);
    }
  };

  const handleBoardCustomOrderChange = async (order: string[]) => {
    setBoardCustomOrder(order);
    try {
      await persistBoardCustomOrder(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save board order';
      toast.error(message);
    }
  };

  const handleMediaSortModeChange = async (mode: SortMode) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    setMediaSortMode(mode);
    try {
      await updateUserMediaSort(authUser.id, mode);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save sort preference';
      toast.error(message);
    }
  };

  const handleBoardMediaOrderChange = async (boardId: string, mediaIds: string[]) => {
    try {
      const updated = await updateBoardMediaOrder(boardId, mediaIds);
      setBoards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, mediaIds: updated.mediaIds } : b)),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save media order';
      toast.error(message);
      throw error;
    }
  };

  const handleSaveAccountSettings = async (data: {
    username: string;
    email: string;
    avatar?: string;
  }) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('You must be signed in');

      let nextUsername = user.username;
      let nextEmail = user.email ?? data.email;
      let nextAvatar = user.avatar;

      if (data.username !== user.username) {
        const profile = await updateUsername(authUser.id, data.username);
        nextUsername = profile.username;
      }

      if (data.email.trim() !== (user.email ?? '').trim()) {
        nextEmail = await updateUserEmail(authUser.id, data.email);
      }

      const profile = await updateUserProfile(authUser.id, {
        displayName: user.displayName,
        bio: user.bio ?? '',
        avatar: data.avatar,
      });
      nextAvatar = profile.avatar;

      setUser({
        ...user,
        username: nextUsername,
        email: nextEmail,
        avatar: nextAvatar,
      });
      toast.success('Account saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save account';
      toast.error(message);
      throw error;
    }
  };

  const handleChangePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const handleDeleteAccount = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('You must be signed in');
      await deleteUserAccount(authUser.id);
      await handleSignOut();
      toast.success('Account deleted');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      toast.error(message);
      throw error;
    }
  };



  const visibleBoards = useMemo(
    () => filterBoardsForDisplay(boards, showAllBoard),
    [boards, showAllBoard],
  );


  if (authChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Toaster position="top-center" richColors />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (passwordRecoveryPending) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <AuthPage
          initialMode="reset"
          onAuthSuccess={handleAuthSuccess}
          onPasswordResetComplete={handlePasswordResetComplete}
        />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      </>
    );
  }

  if (
    isAuthenticated &&
    !onboardingLoaded &&
    !passwordRecoveryPending
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Toaster position="top-center" richColors />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (
    onboardingLoaded &&
    !onboardingCompleted &&
    preferredGenres.length === 0
  ) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <OnboardingGenrePage
          accentColor={accentColor}
          onContinue={handleOnboardingGenresContinue}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      
      <div className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <button
              type="button"
              onClick={handleGoToLibrary}
              className="flex items-center gap-2 rounded-lg hover:opacity-90 transition-opacity text-left"
              aria-label="Go to library"
            >
              <div className="w-20 h-20 rounded-lg flex items-center justify-center">
                <img src={logoImage} alt="Memora" className="w-20 h-20" />
              </div>
              <div>
                <h2 className="tracking-tight">Memora</h2>
                <p className="text-xs text-muted-foreground">Your taste, redefined.</p>
              </div>
            </button>
            
            <div className="flex items-center gap-3">
              <NotificationCenter
                accentColor={accentColor}
                refreshKey={notificationRefreshKey}
                onOpenFriends={() => navigate(APP_ROUTES.friends)}
                onViewUserProfile={handleViewUserProfile}
              />
              <div className="hidden sm:block">
                <div className="text-sm">{user.displayName}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Account menu"
                  >
                    <UserAvatar
                      displayName={user.displayName}
                      avatar={user.avatar}
                      size="sm"
                      accentColor={accentColor}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleViewOwnProfile}>
                    <UserIcon className="w-4 h-4 mr-2" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSettingsDialogOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {viewingUserId ? (
          <UserProfilePage
            userId={viewingUserId}
            onBack={handleBackFromUserProfile}
            accentColor={accentColor}
          />
        ) : showProfile ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={handleBackFromProfile}>
                ← Back
              </Button>
              <h1>Profile</h1>
            </div>
            <ProfilePage
              user={user}
              mediaItems={mediaItems}
              accentColor={accentColor}
              onUpdateProfile={handleUpdateProfile}
            />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="library" className="flex items-center gap-2">
                <Library className="w-4 h-4" />
                <span className="hidden sm:inline">Library</span>
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Recommendations</span>
              </TabsTrigger>
              <TabsTrigger value="friends" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Friends</span>
              </TabsTrigger>
            </TabsList>

          <TabsContent value="library" className="mt-6">
            {boardIdFromUrl && !selectedBoard ? (
              <p className="text-muted-foreground">Loading board...</p>
            ) : selectedBoard ? (
              <BoardDetailPage
                board={selectedBoard}
                mediaItems={getBoardMediaItems(selectedBoard, mediaItems)}
                onBack={handleBackToLibrary}
                onMediaClick={handleMediaClick}
                onUpdateBoard={handleUpdateBoard}
                onDeleteBoard={handleDeleteBoard}
                customMediaTypes={customMediaTypes}
                customGenres={customGenres}
                mediaSortMode={mediaSortMode}
                onMediaSortModeChange={handleMediaSortModeChange}
                onBoardMediaOrderChange={handleBoardMediaOrderChange}
              />
            ) : (
              <LibraryPage
                boards={visibleBoards}
                mediaItems={mediaItems}
                boardsLoading={!libraryLoaded}
                onBoardClick={handleBoardClick}
                onCreateBoard={handleCreateBoard}
                accentColor={accentColor}
                customMediaTypes={customMediaTypes}
                boardSortMode={boardSortMode}
                boardCustomOrder={boardCustomOrder}
                onBoardSortModeChange={handleBoardSortModeChange}
                onBoardCustomOrderChange={handleBoardCustomOrderChange}
              />
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="mt-6">
            <RecommendationsPage
              mediaItems={mediaItems}
              userId={user.id}
              boards={boards}
              preferredGenres={preferredGenres}
              customMediaTypes={customMediaTypes}
              onAddMedia={handleAddMedia}
            />
          </TabsContent>

          <TabsContent value="friends" className="mt-6">
            <FriendsPage
              friends={friends}
              currentUser={user}
              accentColor={accentColor}
              onAddFriend={handleAddFriend}
              onAcceptFriend={handleAcceptFriend}
              onRejectFriend={handleRejectFriend}
              onUnfriend={handleUnfriend}
              onViewUserProfile={handleViewUserProfile}
            />
          </TabsContent>
          </Tabs>
        )}
      </div>

      <AddMediaDialog
        onAdd={handleAddMedia}
        boards={boards}
        currentBoardId={boardIdFromUrl ?? undefined}
        customGenres={customGenres}
        customMediaTypes={customMediaTypes}
      />

      <AddBoardDialog
        open={addBoardDialogOpen}
        onOpenChange={setAddBoardDialogOpen}
        onAdd={handleAddBoard}
        customMediaTypes={customMediaTypes}
      />

      <MediaDetailDialog
        media={selectedMedia}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        boards={boards}
        onUpdateNotes={handleUpdateNotes}
        onUpdateMedia={handleUpdateMedia}
        onDelete={handleDeleteMedia}
        customGenres={customGenres}
        customMediaTypes={customMediaTypes}
      />

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        accentColor={accentColor}
        themeSettings={themeSettings}
        onThemePreview={handleThemePreview}
        onSaveTheme={handleSaveTheme}
        email={user.email}
        username={user.username}
        avatar={user.avatar}
        displayName={user.displayName}
        onSaveAccountSettings={handleSaveAccountSettings}
        onChangePassword={handleChangePassword}
        onDeleteAccount={handleDeleteAccount}
        customGenres={customGenres}
        customMediaTypes={customMediaTypes}
        onSaveCustomGenres={handleSaveCustomGenres}
        onSaveCustomMediaTypes={handleSaveCustomMediaTypes}
        showAllBoard={showAllBoard}
        onSaveLibrarySettings={handleSaveLibrarySettings}
      />

      {showOnboardingTour && (
        <OnboardingTour onComplete={() => void handleOnboardingTourComplete()} />
      )}
    </div>
  );
}

export default App;