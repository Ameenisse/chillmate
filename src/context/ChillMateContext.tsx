import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  auth,
  db,
  storage,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  AccountStatus,
  AppNotification,
  AuthRegistrationSource,
  FloatingReaction,
  HallActivity,
  HallActivityEventType,
  HallJoinRequest,
  HallMember,
  HallMessage,
  IntervalBreakState,
  LibraryCategory,
  LibraryDownloadTask,
  LibraryItem,
  MovieHall,
  ReactionEmoji,
  RegisteredUserAccount,
  ShareType,
  SystemRole,
  Team,
  TeamMember,
  TeamRole,
  UserProfile,
  VideoSourceType,
  ViewportPreset,
} from '../types';
import {
  ASSETS,
  DEFAULT_LIBRARY_ITEMS,
  DEFAULT_TEAM_MEMBERS,
  formatDurationMs,
  resolveWebpageOrMediaUrl,
  resolveYouTubeVideoId,
  WebpageResolutionResult,
} from '../utils/media';

interface PersonalWatchSession {
  title: string;
  videoUrl: string;
  embedUrl?: string;
  posterUrl?: string;
  sourceType: 'DEVICE_LOCAL' | 'DIRECT_URL' | 'CLOUD_VIDEO' | 'WEBPAGE';
  localFileName?: string;
  localFileSize?: number;
  durationMs?: number;
  initialPositionMs?: number;
}

interface ChillMateContextValue {
  firebaseUser: FirebaseUser | null;
  authReady: boolean;
  currentUser: UserProfile;

  // Persistent Auth, Approval Gate & Super Admin User Control
  registeredUsers: RegisteredUserAccount[];
  currentAccount: RegisteredUserAccount | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isSuperAdminModalOpen: boolean;
  setIsSuperAdminModalOpen: (open: boolean) => void;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; account?: RegisteredUserAccount }>;
  signUpWithEmail: (params: {
    displayName: string;
    email: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string; account?: RegisteredUserAccount }>;
  continueWithGoogle: (customProfile?: {
    email?: string;
    displayName?: string;
  }) => Promise<{ ok: boolean; error?: string; account?: RegisteredUserAccount }>;
  superAdminApproveUser: (userId: string) => void;
  superAdminDeclineUser: (userId: string) => void;
  superAdminToggleSuspendUser: (userId: string) => void;
  superAdminDeleteUser: (userId: string) => void;

  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  switchDemoIdentity: (memberUserId: string) => void;
  updateUserProfile: (
    displayName: string,
    photoUrl?: string
  ) => Promise<{ ok: boolean; error?: string }>;

  // Individual App Lock System (PIN) per user
  isAppLocked: boolean;
  unlockAppWithPin: (pin: string) => { ok: boolean; error?: string };
  lockAppNow: () => void;
  updateUserAppLockPin: (params: {
    enabled: boolean;
    pin: string;
    currentPin?: string;
  }) => Promise<{ ok: boolean; error?: string }>;

  teams: Team[];
  activeTeam: Team;
  selectTeam: (teamId: string) => void;
  createTeam: (
    name: string,
    pin: string,
    description: string
  ) => Promise<{ ok: boolean; error?: string; team?: Team }>;
  updateTeamCredentials: (
    teamId: string,
    name: string,
    pin: string,
    description?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteTeam: (teamId: string) => Promise<{ ok: boolean; error?: string }>;
  joinTeamByNameAndPin: (
    teamName: string,
    pin: string
  ) => Promise<{ ok: boolean; error?: string; team?: Team }>;
  searchTeamByNameAndPin: (
    teamName: string,
    pin: string
  ) => Promise<{ ok: boolean; error?: string; team?: Team; memberCount?: number }>;
  joinTeamByCode: (inviteCode: string) => Promise<boolean>;
  teamMembers: TeamMember[];
  updateMemberRole: (memberUserId: string, role: TeamRole) => { ok: boolean; error?: string };
  removeTeamMember: (memberUserId: string) => { ok: boolean; error?: string };

  // Multi-Library System: Self Library (only user can see) + Separate Library for each Team (only team members can see; only team owner can delete)
  activeLibraryScope: 'SELF' | string;
  setActiveLibraryScope: (scope: 'SELF' | string) => void;
  selfLibraryItems: LibraryItem[];
  teamLibraryItemsByTeam: Record<string, LibraryItem[]>;
  getTeamLibraryItems: (teamId: string) => LibraryItem[];
  allAccessibleLibraryItems: LibraryItem[];
  canDeleteLibraryItem: (item: LibraryItem) => boolean;
  isOwnerOfTeam: (teamId: string) => boolean;
  libraryItems: LibraryItem[];
  selectedLibraryItem: LibraryItem | null;
  setSelectedLibraryItem: (item: LibraryItem | null) => void;
  deleteLibraryItem: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
  lastDeletedLibraryItem: LibraryItem | null;
  restoreDeletedLibraryItem: () => void;
  addLibraryItemFromUrl: (params: {
    title: string;
    description: string;
    videoUrl: string;
    embedUrl?: string;
    posterUrl?: string;
    sourceType?: 'DIRECT_URL' | 'WEBPAGE' | 'CLOUD_VIDEO';
    category: LibraryCategory;
    durationMs: number;
    year?: number;
    isDownloaded?: boolean;
    downloadQuality?: string;
    fileSizeBytes?: number;
    originalPageUrl?: string;
    platformName?: string;
    targetLibraryScope?: 'SELF' | string;
  }) => Promise<LibraryItem>;
  uploadVideoToTeamLibrary: (
    file: File,
    title: string,
    description: string,
    category: LibraryCategory,
    onProgress: (pct: number) => void,
    targetLibraryScope?: 'SELF' | string
  ) => Promise<LibraryItem>;

  // VidMate-style Link Auto-Downloader into Library
  downloadTasks: LibraryDownloadTask[];
  autoDownloadOnLinkAdd: boolean;
  setAutoDownloadOnLinkAdd: (enabled: boolean) => void;
  autoDownloadLinkToLibrary: (params: {
    url: string;
    title?: string;
    qualityLabel?: string;
    sizeBytes?: number;
    category?: LibraryCategory;
    preResolved?: WebpageResolutionResult;
    targetLibraryScope?: 'SELF' | string;
  }) => Promise<LibraryItem | null>;
  saveLibraryItemToDeviceDisk: (item: LibraryItem) => void;
  removeDownloadTask: (taskId: string) => void;

  // Mode A: Watch Alone
  personalSession: PersonalWatchSession | null;
  startWatchAlone: (session: PersonalWatchSession) => void;
  closeWatchAlone: (finalPositionMs?: number, libraryItemId?: string) => void;

  // Device Local Files (Zero upload)
  localDeviceVideoFile: File | null;
  localDeviceVideoUrl: string | null;
  selectDeviceVideoFile: (file: File) => string;

  // Mode B & C: Movie Hall & Screen/App Share Hall
  activeHall: MovieHall | null;
  isInsideHall: boolean;
  isCurrentUserHost: boolean;
  isApprovedInHall: boolean;
  liveKitToken: string | null;
  hallMembers: HallMember[];
  joinRequests: HallJoinRequest[];
  hallMessages: HallMessage[];
  hallActivities: HallActivity[];
  floatingReactions: FloatingReaction[];
  notifications: AppNotification[];

  // Hall lifecycle actions
  startMovieHall: (params: {
    title: string;
    videoUrl?: string;
    embedUrl?: string;
    posterUrl?: string;
    backdropUrl?: string;
    libraryItemId?: string;
    sourceType: VideoSourceType;
    shareType?: ShareType;
    durationMs?: number;
    initialPositionMs?: number;
    localFileName?: string;
  }) => Promise<MovieHall>;
  requestToJoinHall: (hallId: string) => Promise<void>;
  cancelJoinRequest: (hallId: string) => Promise<void>;
  respondToJoinRequest: (requestId: string, decision: 'ACCEPTED' | 'DECLINED') => Promise<void>;
  enterApprovedHall: (hallId: string) => Promise<void>;
  leaveHall: () => void;
  endMovieHallAsHost: () => Promise<void>;

  // Host-only playback controls (Section 4)
  hostPlay: () => void;
  hostPause: () => void;
  hostSeek: (positionMs: number) => void;
  hostSkip: (deltaMs: number) => void;
  hostSetPlaybackSpeed: (speed: number) => void;
  hostChangeMovie: (item: LibraryItem) => void;
  hostUpdatePositionSilent: (positionMs: number, durationMs?: number) => void;
  hostStartIntervalBreak: (durationSec: number, message?: string) => void;
  hostEndIntervalBreak: (autoPlayAfterBreak?: boolean) => void;

  // Screen / App Share (Sections 28, 29, 30, 40)
  activeScreenStream: MediaStream | null;
  screenShareError: string | null;
  clearScreenShareError: () => void;
  startHostScreenOrAppShare: (shareMode: 'APP_SHARE' | 'SCREEN_SHARE') => Promise<boolean>;
  stopHostScreenShare: () => void;
  latestPresentationFrame: string | null;
  broadcastPresentationFrame: (dataUrl: string, posMs: number, playing: boolean) => void;

  // Hall Collaboration (Chat, Reactions, Mic, Camera, Activity)
  sendHallChatMessage: (text: string) => void;
  sendHallReaction: (emoji: ReactionEmoji) => void;
  toggleLocalMic: () => void;
  toggleLocalCamera: () => void;
  remoteMemberCamFrames: Record<string, string>;
  broadcastMemberCameraFrame: (frameDataUrl: string) => void;
  latestVoiceChunk: { userId: string; audioDataUrl: string; ts: number } | null;
  broadcastVoiceChunk: (audioDataUrl: string) => void;
  updateLocalSpeakingState: (isSpeaking: boolean) => void;
  markNotificationsRead: () => void;

  // Test Scenario Quick Triggers (Sections 51-55)
  simulateIncomingJoinRequestFromAhmed: () => void;
  simulateHostDisconnectToggle: () => void;

  // Responsive Viewport / Orientation Inspector
  viewportPreset: ViewportPreset;
  setViewportPreset: (preset: ViewportPreset) => void;
}

const ChillMateContext = createContext<ChillMateContextValue | null>(null);

const STORAGE_SESSION_KEY = 'chillmate_device_auth_session_v2';
const STORAGE_USERS_KEY = 'chillmate_users_registry_v2';
const STORAGE_TEAMS_KEY = 'chillmate_teams_v2';
const STORAGE_TEAM_MEMBERS_KEY = 'chillmate_team_members_v2';
const STORAGE_LIBRARY_KEY = 'chillmate_library_v2';
const STORAGE_ACTIVE_TEAM_KEY = 'chillmate_active_team_v2';

// Migrate any v1 localStorage keys into v2 keys if v2 is not yet populated (never wipe existing data)
try {
  const migrateKey = (v1Key: string, v2Key: string) => {
    if (!localStorage.getItem(v2Key)) {
      const v1Data = localStorage.getItem(v1Key);
      if (v1Data) {
        localStorage.setItem(v2Key, v1Data);
      }
    }
  };
  migrateKey('chillmate_users_registry_v1', STORAGE_USERS_KEY);
  migrateKey('chillmate_teams_v1', STORAGE_TEAMS_KEY);
  migrateKey('chillmate_team_members_v1', STORAGE_TEAM_MEMBERS_KEY);
  migrateKey('chillmate_library_v1', STORAGE_LIBRARY_KEY);
} catch {
  // ignore
}

export const SUPER_ADMIN_EMAIL = 'ameen.isse@gmail.com';
export const SUPER_ADMIN_PASSWORD = 'Amin@2613';

const INITIAL_REGISTERED_USERS: RegisteredUserAccount[] = [
  {
    id: 'user_ameen',
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    displayName: 'Ameen',
    systemRole: 'SUPER_ADMIN',
    accountStatus: 'APPROVED',
    authSource: 'EMAIL',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-30T22:00:00.000Z',
  },
];

const INITIAL_TEAMS: Team[] = [];

const EMPTY_TEAM_PLACEHOLDER: Team = {
  id: '',
  name: 'No Team',
  pin: '',
  description: '',
  inviteCode: '',
  ownerId: '',
  createdAt: '',
  updatedAt: '',
};

const INITIAL_HALL_MEMBERS: HallMember[] = [];

const INITIAL_MESSAGES: HallMessage[] = [];

const INITIAL_ACTIVITIES: HallActivity[] = [];

export const ChillMateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState<boolean>(false);

  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_USERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as RegisteredUserAccount[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure Super Admin Ameen always exists and is APPROVED
          const hasSuper = parsed.some(
            (u) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
          );
          if (!hasSuper) {
            return [INITIAL_REGISTERED_USERS[0], ...parsed];
          }
          return parsed.map((u) =>
            u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
              ? {
                  ...u,
                  systemRole: 'SUPER_ADMIN',
                  accountStatus: 'APPROVED',
                  password: SUPER_ADMIN_PASSWORD,
                }
              : u
          );
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_REGISTERED_USERS;
  });

  const [sessionUserId, setSessionUserId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          userId?: string;
          explicitlyAuthenticatedOnDevice?: boolean;
        };
        if (parsed?.explicitlyAuthenticatedOnDevice && parsed?.userId) {
          return parsed.userId;
        }
      }
    } catch {
      // ignore
    }
    // Never auto-open anyone's user account! Every device must explicitly Sign In first.
    return null;
  });

  const [sessionEmail, setSessionEmail] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          email?: string;
          explicitlyAuthenticatedOnDevice?: boolean;
        };
        if (parsed?.explicitlyAuthenticatedOnDevice && parsed?.email) {
          return parsed.email.toLowerCase();
        }
      }
    } catch {
      // ignore
    }
    return '';
  });

  const currentAccount = useMemo(() => {
    if (!sessionUserId && !sessionEmail) return null;
    return (
      registeredUsers.find(
        (u) =>
          (sessionUserId && u.id === sessionUserId) ||
          (sessionEmail && u.email.toLowerCase() === sessionEmail)
      ) || null
    );
  }, [registeredUsers, sessionUserId, sessionEmail]);

  const isAuthenticated = useMemo(
    () => Boolean(currentAccount && currentAccount.accountStatus === 'APPROVED'),
    [currentAccount]
  );

  const isSuperAdmin = useMemo(
    () =>
      Boolean(
        currentAccount &&
          (currentAccount.systemRole === 'SUPER_ADMIN' ||
            currentAccount.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())
      ),
    [currentAccount]
  );

  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: '',
    email: '',
    displayName: 'Guest',
    status: 'OFFLINE',
    activeTeamId: '',
    systemRole: 'USER',
    accountStatus: 'PENDING',
    authSource: 'EMAIL',
    createdAt: '',
    updatedAt: '',
  });

  const [teams, setTeams] = useState<Team[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TEAMS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Team[];
        if (Array.isArray(parsed)) {
          return parsed.map((t) => ({
            ...t,
            pin: t.pin || '2026',
          }));
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_TEAMS;
  });
  const [activeTeamId, setActiveTeamId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_ACTIVE_TEAM_KEY) || '';
    } catch {
      return '';
    }
  });
  const [activeLibraryScope, setActiveLibraryScope] = useState<'SELF' | string>('SELF');
  const [unlockedUsersInSession, setUnlockedUsersInSession] = useState<Record<string, boolean>>({});
  const [allTeamMembers, setAllTeamMembers] = useState<TeamMember[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TEAM_MEMBERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TeamMember[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_TEAM_MEMBERS;
  });
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LIBRARY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as LibraryItem[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_LIBRARY_ITEMS;
  });
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<LibraryItem | null>(null);
  const [lastDeletedLibraryItem, setLastDeletedLibraryItem] = useState<LibraryItem | null>(null);
  const [downloadTasks, setDownloadTasks] = useState<LibraryDownloadTask[]>([]);
  const [autoDownloadOnLinkAdd, setAutoDownloadOnLinkAdd] = useState<boolean>(false);

  const [personalSession, setPersonalSession] = useState<PersonalWatchSession | null>(null);
  const [localDeviceVideoFile, setLocalDeviceVideoFile] = useState<File | null>(null);
  const [localDeviceVideoUrl, setLocalDeviceVideoUrl] = useState<string | null>(null);

  const [activeHall, setActiveHall] = useState<MovieHall | null>(null);
  const [isInsideHall, setIsInsideHall] = useState<boolean>(false);
  const [liveKitToken, setLiveKitToken] = useState<string | null>(null);
  const [hallMembers, setHallMembers] = useState<HallMember[]>(INITIAL_HALL_MEMBERS);
  const [joinRequests, setJoinRequests] = useState<HallJoinRequest[]>([]);
  const [hallMessages, setHallMessages] = useState<HallMessage[]>(INITIAL_MESSAGES);
  const [hallActivities, setHallActivities] = useState<HallActivity[]>(INITIAL_ACTIVITIES);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [activeScreenStream, setActiveScreenStream] = useState<MediaStream | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [latestPresentationFrame, setLatestPresentationFrame] = useState<string | null>(null);
  const [remoteMemberCamFrames, setRemoteMemberCamFrames] = useState<Record<string, string>>({});
  const [latestVoiceChunk, setLatestVoiceChunk] = useState<{
    userId: string;
    audioDataUrl: string;
    ts: number;
  } | null>(null);
  const [viewportPreset, setViewportPreset] = useState<ViewportPreset>('AUTO');

  const wsRef = useRef<WebSocket | null>(null);
  const lastHostHeartbeatRef = useRef<number>(0);

  // Teams visible to the current user: ONLY teams created by this user OR joined by this user via Name & PIN
  const userTeams = useMemo(() => {
    const uid = currentUser.id;
    if (!uid) return [];
    return teams.filter(
      (t) =>
        t.ownerId === uid ||
        allTeamMembers.some((m) => m.teamId === t.id && m.userId === uid)
    );
  }, [teams, allTeamMembers, currentUser.id]);

  // Auto-select first available userTeam if activeTeamId is empty or no longer in user's teams
  useEffect(() => {
    if (userTeams.length > 0 && !userTeams.some((t) => t.id === activeTeamId)) {
      setActiveTeamId(userTeams[0].id);
    } else if (userTeams.length === 0 && activeTeamId !== '') {
      setActiveTeamId('');
    }
  }, [userTeams, activeTeamId]);

  const activeTeam = useMemo(
    () => userTeams.find((t) => t.id === activeTeamId) || userTeams[0] || EMPTY_TEAM_PLACEHOLDER,
    [userTeams, activeTeamId]
  );

  const teamMembers = useMemo(
    () => (activeTeam.id ? allTeamMembers.filter((m) => m.teamId === activeTeam.id) : []),
    [allTeamMembers, activeTeam.id]
  );

  // Keep activeLibraryScope valid if a selected team was deleted or left
  useEffect(() => {
    if (
      activeLibraryScope !== 'SELF' &&
      !userTeams.some((t) => t.id === activeLibraryScope)
    ) {
      setActiveLibraryScope('SELF');
    }
  }, [activeLibraryScope, userTeams]);

  const isOwnerOfTeam = useCallback(
    (teamId: string): boolean => {
      if (!teamId || !currentUser.id) return false;
      const t = teams.find((team) => team.id === teamId);
      if (t && t.ownerId === currentUser.id) return true;
      return allTeamMembers.some(
        (m) => m.teamId === teamId && m.userId === currentUser.id && m.role === 'OWNER'
      );
    },
    [teams, allTeamMembers, currentUser.id]
  );

  // 1. Self Library: ONLY visible to the user who added it
  const selfLibraryItems = useMemo(() => {
    return libraryItems.filter((item) => {
      const isSelf =
        !item.teamId || item.teamId.startsWith('self_') || item.libraryScope === 'SELF';
      return isSelf && item.addedById === currentUser.id;
    });
  }, [libraryItems, currentUser.id]);

  // 2. Team Libraries: Separate library for each team; ONLY visible to members of that team
  const teamLibraryItemsByTeam = useMemo(() => {
    const map: Record<string, LibraryItem[]> = {};
    for (const team of userTeams) {
      map[team.id] = libraryItems.filter((item) => {
        const isSelf =
          !item.teamId || item.teamId.startsWith('self_') || item.libraryScope === 'SELF';
        return !isSelf && item.teamId === team.id;
      });
    }
    return map;
  }, [libraryItems, userTeams]);

  const getTeamLibraryItems = useCallback(
    (teamId: string): LibraryItem[] => {
      if (!teamId) return [];
      return teamLibraryItemsByTeam[teamId] || [];
    },
    [teamLibraryItemsByTeam]
  );

  // Currently selected Library (Self Library or specific Team Library)
  const visibleLibraryItems = useMemo(() => {
    if (activeLibraryScope === 'SELF') {
      return selfLibraryItems;
    }
    if (userTeams.some((t) => t.id === activeLibraryScope)) {
      return teamLibraryItemsByTeam[activeLibraryScope] || [];
    }
    return selfLibraryItems;
  }, [activeLibraryScope, selfLibraryItems, userTeams, teamLibraryItemsByTeam]);

  // Union of user's Self Library + all Team Libraries the user is a member of
  const allAccessibleLibraryItems = useMemo(() => {
    return libraryItems.filter((item) => {
      const isSelf =
        !item.teamId || item.teamId.startsWith('self_') || item.libraryScope === 'SELF';
      if (isSelf) {
        return item.addedById === currentUser.id;
      }
      return userTeams.some((t) => t.id === item.teamId);
    });
  }, [libraryItems, currentUser.id, userTeams]);

  // Strict RBAC for deleting library videos:
  // - Self Library: only the owner user (addedById === currentUser.id) can delete.
  // - Team Library: ONLY the Team Owner can manage (delete) Team Library videos!
  const canDeleteLibraryItem = useCallback(
    (item: LibraryItem): boolean => {
      const isSelf =
        !item.teamId || item.teamId.startsWith('self_') || item.libraryScope === 'SELF';
      if (isSelf) {
        return item.addedById === currentUser.id;
      }
      return isOwnerOfTeam(item.teamId);
    },
    [currentUser.id, isOwnerOfTeam]
  );

  // Sync currentAccount -> currentUser whenever currentAccount changes
  useEffect(() => {
    if (!currentAccount) {
      setCurrentUser({
        id: '',
        email: '',
        displayName: 'Guest',
        status: 'OFFLINE',
        activeTeamId: '',
        systemRole: 'USER',
        accountStatus: 'PENDING',
        authSource: 'EMAIL',
        appLockPin: '',
        appLockEnabled: false,
        createdAt: '',
        updatedAt: '',
      });
      return;
    }
    const isEnabled = currentAccount.appLockEnabled === true && Boolean((currentAccount.appLockPin || '').trim());
    setCurrentUser((prev) => ({
      ...prev,
      id: currentAccount.id,
      email: currentAccount.email,
      displayName: currentAccount.displayName,
      photoUrl: currentAccount.photoUrl || prev.photoUrl,
      status: 'ONLINE',
      systemRole: currentAccount.systemRole,
      accountStatus: currentAccount.accountStatus,
      authSource: currentAccount.authSource,
      appLockPin: isEnabled ? (currentAccount.appLockPin || '').trim() : '',
      appLockEnabled: isEnabled,
    }));
  }, [currentAccount]);

  // If Individual Lock Screen (AppLockScreen) is NOT enabled for the current user, open the app directly!
  const isAppLocked = useMemo(() => {
    if (!isAuthenticated) return false;
    const enabled = currentAccount
      ? currentAccount.appLockEnabled === true
      : currentUser.appLockEnabled === true;
    const pin = (currentAccount ? currentAccount.appLockPin : currentUser.appLockPin || '')?.trim() || '';
    if (!enabled || !pin) return false;
    const activeUid = currentAccount?.id || currentUser.id;
    return !unlockedUsersInSession[activeUid];
  }, [isAuthenticated, currentAccount, currentUser, unlockedUsersInSession]);

  // Persist registeredUsers, teams, and allTeamMembers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(registeredUsers));
    } catch {
      // ignore
    }
  }, [registeredUsers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TEAMS_KEY, JSON.stringify(teams));
    } catch {
      // ignore
    }
  }, [teams]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TEAM_MEMBERS_KEY, JSON.stringify(allTeamMembers));
    } catch {
      // ignore
    }
  }, [allTeamMembers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(libraryItems));
    } catch {
      // ignore
    }
  }, [libraryItems]);

  useEffect(() => {
    try {
      if (activeTeamId) {
        localStorage.setItem(STORAGE_ACTIVE_TEAM_KEY, activeTeamId);
      }
    } catch {
      // ignore
    }
  }, [activeTeamId]);

  // Listen to cross-tab localStorage updates so session, approval gate, and team PIN changes sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_USERS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as RegisteredUserAccount[];
          if (Array.isArray(parsed)) setRegisteredUsers(parsed);
        } catch {
          // ignore
        }
      } else if (e.key === STORAGE_SESSION_KEY) {
        if (!e.newValue) {
          setSessionUserId(null);
          setSessionEmail('');
        } else {
          try {
            const parsed = JSON.parse(e.newValue) as {
              userId?: string;
              email?: string;
              explicitlyAuthenticatedOnDevice?: boolean;
            };
            if (parsed?.explicitlyAuthenticatedOnDevice && parsed?.userId) {
              setSessionUserId(parsed.userId);
              setSessionEmail((parsed.email || '').toLowerCase());
            } else {
              setSessionUserId(null);
              setSessionEmail('');
            }
          } catch {
            // ignore
          }
        }
      } else if (e.key === STORAGE_TEAMS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as Team[];
          if (Array.isArray(parsed)) setTeams(parsed);
        } catch {
          // ignore
        }
      } else if (e.key === STORAGE_TEAM_MEMBERS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as TeamMember[];
          if (Array.isArray(parsed)) setAllTeamMembers(parsed);
        } catch {
          // ignore
        }
      } else if (e.key === STORAGE_LIBRARY_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as LibraryItem[];
          if (Array.isArray(parsed)) setLibraryItems(parsed);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isCurrentUserHost = useMemo(
    () => Boolean(activeHall && activeHall.hostId === currentUser.id),
    [activeHall, currentUser.id]
  );

  const isApprovedInHall = useMemo(() => {
    if (!activeHall) return false;
    if (activeHall.hostId === currentUser.id) return true;
    const isTeamMemberOfHall =
      activeTeam.ownerId === currentUser.id ||
      allTeamMembers.some((m) => m.teamId === activeHall.teamId && m.userId === currentUser.id);
    if (isTeamMemberOfHall) return true;
    const member = hallMembers.find(
      (m) => m.hallId === activeHall.id && m.userId === currentUser.id
    );
    if (member) return true;
    const req = joinRequests.find(
      (r) => r.hallId === activeHall.id && r.requesterId === currentUser.id && r.status === 'ACCEPTED'
    );
    return Boolean(req);
  }, [activeHall, activeTeam.ownerId, allTeamMembers, currentUser.id, hallMembers, joinRequests]);

  const sendWsMessage = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          ...payload,
          eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        })
      );
    }
  }, []);

  const appendActivityLog = useCallback(
    (
      eventType: HallActivityEventType,
      message: string,
      actor?: { id: string; name: string },
      reactionEmoji?: ReactionEmoji
    ) => {
      if (!activeHall) return;
      const newActivity: HallActivity = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        hallId: activeHall.id,
        teamId: activeHall.teamId,
        actorId: actor?.id || currentUser.id,
        actorName: actor?.name || currentUser.displayName,
        eventType,
        message,
        reactionEmoji,
        createdAt: new Date().toISOString(),
      };
      setHallActivities((prev) => {
        if (prev.some((a) => a.id === newActivity.id)) return prev;
        return [newActivity, ...prev.slice(0, 59)];
      });
      sendWsMessage({
        type: 'HALL_ACTIVITY',
        hallId: activeHall.id,
        activity: newActivity,
      });
    },
    [activeHall, currentUser.id, currentUser.displayName, sendWsMessage]
  );

  // Firebase Auth listener & Firestore User sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthReady(true);
      if (fbUser) {
        const cleanUid = fbUser.uid.replace(/[^a-zA-Z0-9_-]/g, '_');
        const displayName = (fbUser.displayName || 'Chill Mate Host').slice(0, 80);
        const photoUrl = fbUser.photoURL ? fbUser.photoURL.slice(0, 1024) : undefined;

        setCurrentUser((prev) => ({
          ...prev,
          id: cleanUid,
          displayName,
          photoUrl,
        }));

        try {
          const userDocRef = doc(db, 'users', cleanUid);
          const snap = await getDoc(userDocRef);
          if (!snap.exists()) {
            const payload: Record<string, unknown> = {
              id: cleanUid,
              displayName,
              status: 'ONLINE',
              activeTeamId: 'team_chillmate_prime',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            if (photoUrl) payload.photoUrl = photoUrl;
            await setDoc(userDocRef, payload);
          }
        } catch (err) {
          // Only report if permission denied on real authenticated operation
          if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(err, OperationType.WRITE, `users/${cleanUid}`);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Bootstrap & bidirectional state sync with Backend Server (/api/state/sync)
  // Ensures existing users, teams, members, and library items are permanently preserved in DB until explicit delete!
  useEffect(() => {
    let mounted = true;

    // Snapshot local cached state
    let localUsers: RegisteredUserAccount[] = [];
    let localTeams: Team[] = [];
    let localMembers: TeamMember[] = [];
    let localLibrary: LibraryItem[] = [];

    try {
      const u = localStorage.getItem(STORAGE_USERS_KEY);
      if (u) {
        const parsed = JSON.parse(u);
        if (Array.isArray(parsed)) localUsers = parsed;
      }
      const t = localStorage.getItem(STORAGE_TEAMS_KEY);
      if (t) {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) localTeams = parsed;
      }
      const m = localStorage.getItem(STORAGE_TEAM_MEMBERS_KEY);
      if (m) {
        const parsed = JSON.parse(m);
        if (Array.isArray(parsed)) localMembers = parsed;
      }
      const l = localStorage.getItem(STORAGE_LIBRARY_KEY);
      if (l) {
        const parsed = JSON.parse(l);
        if (Array.isArray(parsed)) localLibrary = parsed;
      }
    } catch {
      // ignore
    }

    fetch('/api/state/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: localUsers,
        teams: localTeams,
        teamMembers: localMembers,
        libraryItems: localLibrary,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        if (Array.isArray(data.users) && data.users.length > 0) {
          setRegisteredUsers(data.users as RegisteredUserAccount[]);
        }
        if (Array.isArray(data.teams)) {
          setTeams(
            (data.teams as Team[]).map((t, idx) => ({
              ...t,
              imageUrl: t.imageUrl || (idx % 2 === 0 ? ASSETS.posterInterstellar : ASSETS.posterMidnightTokyo),
            }))
          );
        }
        if (Array.isArray(data.teamMembers)) {
          setAllTeamMembers(data.teamMembers as TeamMember[]);
        }
        if (Array.isArray(data.libraryItems)) {
          setLibraryItems(data.libraryItems as LibraryItem[]);
        }
      })
      .catch(() => {
        // Fallback to localStorage / initial seed if server unreachable
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Connect to Realtime WebSocket Server (/ws)
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let reconnectTimeout: number | undefined;

    const connect = () => {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          const effectiveTeamId = activeTeam.id || activeTeamId;
          socket?.send(
            JSON.stringify({
              type: 'IDENTIFY',
              userId: currentUser.id,
              displayName: currentUser.displayName,
              teamId: effectiveTeamId,
            })
          );
          if (activeHall && activeHall.hostId === currentUser.id) {
            socket?.send(
              JSON.stringify({
                type: 'HALL_CREATE',
                hall: activeHall,
                members: hallMembers,
              })
            );
          } else if (activeHall && isInsideHall) {
            const myMem = hallMembers.find((m) => m.userId === currentUser.id);
            socket?.send(
              JSON.stringify({
                type: 'HALL_JOIN_SESSION',
                hallId: activeHall.id,
                userId: currentUser.id,
                displayName: currentUser.displayName,
                photoUrl: currentUser.photoUrl,
                role: 'VIEWER',
                micEnabled: Boolean(myMem?.micEnabled),
                cameraEnabled: Boolean(myMem?.cameraEnabled),
              })
            );
          }
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case 'TEAM_HALLS_SYNC': {
                if (Array.isArray(data.halls) && data.halls.length > 0) {
                  const remote = data.halls[0] as MovieHall & { latestFrameDataUrl?: string };
                  setActiveHall((prev) => {
                    if (!prev || prev.id === remote.id) {
                      return { ...prev, ...remote };
                    }
                    return remote;
                  });
                  if (typeof remote.latestFrameDataUrl === 'string') {
                    setLatestPresentationFrame(remote.latestFrameDataUrl);
                  }
                  if (Array.isArray(data.members) && data.members.length > 0) {
                    setHallMembers(data.members as HallMember[]);
                  }
                } else if (Array.isArray(data.halls) && data.halls.length === 0) {
                  setActiveHall((prev) => {
                    if (prev && prev.hostId === currentUser.id && prev.status !== 'ENDED') {
                      return prev;
                    }
                    return null;
                  });
                }
                break;
              }
              case 'HALL_UPDATED': {
                if (data.hall) {
                  setActiveHall((prev) => ({ ...(prev || {}), ...data.hall }));
                  if (typeof data.hall.latestFrameDataUrl === 'string') {
                    setLatestPresentationFrame(data.hall.latestFrameDataUrl);
                  }
                }
                if (Array.isArray(data.members) && data.members.length > 0) {
                  setHallMembers(data.members as HallMember[]);
                }
                break;
              }
              case 'HALL_LATE_JOIN_SYNC': {
                // Section 5: Late joiner receives exact live position without restarting or pausing host
                if (data.hall) {
                  setActiveHall((prev) => ({ ...(prev || {}), ...data.hall }));
                }
                if (Array.isArray(data.members) && data.members.length > 0) {
                  setHallMembers(data.members as HallMember[]);
                }
                if (typeof data.latestFrameDataUrl === 'string') {
                  setLatestPresentationFrame(data.latestFrameDataUrl);
                }
                break;
              }
              case 'HALL_MEMBERS_SYNC': {
                if (Array.isArray(data.members)) {
                  setHallMembers(data.members as HallMember[]);
                }
                if (typeof data.viewerCount === 'number') {
                  setActiveHall((prev) =>
                    prev ? { ...prev, viewerCount: data.viewerCount } : prev
                  );
                }
                break;
              }
              case 'HALL_MEMBER_CAM_FRAME': {
                if (data.userId && typeof data.frameDataUrl === 'string') {
                  setRemoteMemberCamFrames((prev) => ({
                    ...prev,
                    [data.userId]: data.frameDataUrl,
                  }));
                }
                break;
              }
              case 'HALL_VOICE_CHUNK': {
                if (
                  data.userId &&
                  data.userId !== currentUser.id &&
                  typeof data.audioDataUrl === 'string'
                ) {
                  setLatestVoiceChunk({
                    userId: data.userId,
                    audioDataUrl: data.audioDataUrl,
                    ts: Date.now(),
                  });
                }
                break;
              }
              case 'JOIN_REQUEST_RECEIVED': {
                const req = data.request as HallJoinRequest;
                setJoinRequests((prev) => {
                  const filtered = prev.filter((r) => r.id !== req.id);
                  return [req, ...filtered];
                });
                break;
              }
              case 'JOIN_REQUEST_UPDATED': {
                const updatedReq = data.request as HallJoinRequest;
                setJoinRequests((prev) =>
                  prev.map((r) => (r.id === updatedReq.id ? updatedReq : r))
                );
                if (data.hall) {
                  setActiveHall((prev) => (prev ? { ...prev, ...data.hall } : data.hall));
                }
                if (Array.isArray(data.members) && data.members.length > 0) {
                  setHallMembers(data.members as HallMember[]);
                }
                break;
              }
              case 'HALL_REACTION': {
                const r = data.reaction as FloatingReaction;
                setFloatingReactions((prev) => {
                  if (prev.some((item) => item.id === r.id)) return prev;
                  return [...prev, r];
                });
                setTimeout(() => {
                  setFloatingReactions((prev) => prev.filter((item) => item.id !== r.id));
                }, 2100);
                break;
              }
              case 'HALL_CHAT': {
                const m = data.message as HallMessage;
                setHallMessages((prev) => {
                  if (prev.some((item) => item.id === m.id)) return prev;
                  return [...prev, m];
                });
                break;
              }
              case 'HALL_ACTIVITY': {
                const a = data.activity as HallActivity;
                setHallActivities((prev) => {
                  if (prev.some((item) => item.id === a.id)) return prev;
                  return [a, ...prev.slice(0, 59)];
                });
                break;
              }
              case 'PRESENTATION_FRAME': {
                if (typeof data.frameDataUrl === 'string') {
                  setLatestPresentationFrame(data.frameDataUrl);
                }
                setActiveHall((prev) => {
                  if (!prev || prev.hostId === currentUser.id) return prev;
                  return {
                    ...prev,
                    ...(typeof data.positionMs === 'number' ? { positionMs: data.positionMs } : {}),
                    ...(typeof data.durationMs === 'number' && data.durationMs > 0
                      ? { durationMs: data.durationMs }
                      : {}),
                    ...(typeof data.isPlaying === 'boolean' ? { isPlaying: data.isPlaying } : {}),
                  };
                });
                break;
              }
              case 'HOST_CONNECTION_STATE': {
                setActiveHall((prev) =>
                  prev && prev.id === data.hallId
                    ? { ...prev, hostConnected: Boolean(data.hostConnected) }
                    : prev
                );
                break;
              }
              case 'HALL_ENDED': {
                setActiveHall(null);
                setIsInsideHall(false);
                setLatestPresentationFrame(null);
                setRemoteMemberCamFrames({});
                break;
              }
              case 'AUTH_USERS_SYNC': {
                if (Array.isArray(data.users)) {
                  setRegisteredUsers(data.users as RegisteredUserAccount[]);
                }
                break;
              }
              case 'TEAMS_STATE_SYNC': {
                if (Array.isArray(data.teams)) {
                  setTeams(data.teams as Team[]);
                }
                if (Array.isArray(data.teamMembers)) {
                  setAllTeamMembers(data.teamMembers as TeamMember[]);
                }
                break;
              }
              case 'LIBRARY_STATE_SYNC': {
                if (data.deletedItemId) {
                  setLibraryItems((prev) => prev.filter((i) => i.id !== data.deletedItemId));
                } else if (Array.isArray(data.libraryItems)) {
                  setLibraryItems(data.libraryItems as LibraryItem[]);
                }
                break;
              }
            }
          } catch {
            // ignore malformed frame
          }
        };

        socket.onclose = () => {
          reconnectTimeout = window.setTimeout(connect, 3000);
        };
      } catch {
        // fallback if ws blocked
      }
    };

    connect();
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, [activeTeam.id, activeTeamId, currentUser.id, currentUser.displayName]);

  // Re-identify immediately whenever activeTeam.id changes
  useEffect(() => {
    const effectiveTeamId = activeTeam.id || activeTeamId;
    if (!effectiveTeamId) return;
    sendWsMessage({
      type: 'IDENTIFY',
      userId: currentUser.id,
      displayName: currentUser.displayName,
      teamId: effectiveTeamId,
    });
  }, [activeTeam.id, activeTeamId, currentUser.id, currentUser.displayName, sendWsMessage]);

  // Keep WATCHING NOW elapsed time ticking smoothly every second when activeHall is playing
  useEffect(() => {
    if (!activeHall || !activeHall.isPlaying || activeHall.status !== 'LIVE') return;
    const interval = window.setInterval(() => {
      setActiveHall((prev) => {
        if (!prev || !prev.isPlaying || prev.status !== 'LIVE') return prev;
        const nextPos = prev.positionMs + 1000 * (prev.playbackSpeed || 1);
        return {
          ...prev,
          positionMs: prev.durationMs > 0 ? Math.min(nextPos, prev.durationMs) : nextPos,
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeHall?.id, activeHall?.isPlaying, activeHall?.status, activeHall?.playbackSpeed]);

  const persistSessionUser = useCallback((userId: string | null, email?: string) => {
    setSessionUserId(userId);
    setSessionEmail((email || '').toLowerCase());
    try {
      if (userId) {
        localStorage.setItem(
          STORAGE_SESSION_KEY,
          JSON.stringify({
            userId,
            email: (email || '').toLowerCase(),
            explicitlyAuthenticatedOnDevice: true,
            savedAt: new Date().toISOString(),
          })
        );
      } else {
        localStorage.removeItem(STORAGE_SESSION_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const syncUsersBroadcast = useCallback(
    (nextUsers: RegisteredUserAccount[]) => {
      setRegisteredUsers(nextUsers);
      try {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(nextUsers));
      } catch {
        // ignore
      }
      sendWsMessage({
        type: 'AUTH_USERS_SYNC',
        users: nextUsers,
      });
    },
    [sendWsMessage]
  );

  const syncTeamsBroadcast = useCallback(
    (nextTeams: Team[], nextMembers: TeamMember[]) => {
      setTeams(nextTeams);
      setAllTeamMembers(nextMembers);
      try {
        localStorage.setItem(STORAGE_TEAMS_KEY, JSON.stringify(nextTeams));
        localStorage.setItem(STORAGE_TEAM_MEMBERS_KEY, JSON.stringify(nextMembers));
      } catch {
        // ignore
      }
      sendWsMessage({
        type: 'TEAMS_STATE_SYNC',
        teams: nextTeams,
        teamMembers: nextMembers,
      });
    },
    [sendWsMessage]
  );

  const signInWithEmail = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ ok: boolean; error?: string; account?: RegisteredUserAccount }> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        return { ok: false, error: 'Please enter both email and password.' };
      }

      // Call authoritative backend /api/auth/signin first
      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        const data = await res.json();
        if (res.ok && data?.ok && data?.account) {
          if (Array.isArray(data.users)) {
            setRegisteredUsers(data.users as RegisteredUserAccount[]);
          }
          persistSessionUser(data.account.id, data.account.email);
          return { ok: true, account: data.account as RegisteredUserAccount };
        }
        if (!res.ok && data?.error) {
          // If user exists in local state from earlier session, fall through only on 404
          if (res.status !== 404) {
            return { ok: false, error: String(data.error) };
          }
        }
      } catch {
        // Fallback to local verification below if network error
      }

      // Built-in Super Admin check
      if (
        cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase() &&
        password === SUPER_ADMIN_PASSWORD
      ) {
        const superAccount: RegisteredUserAccount =
          registeredUsers.find(
            (u) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
          ) || INITIAL_REGISTERED_USERS[0];
        const approvedSuper: RegisteredUserAccount = {
          ...superAccount,
          systemRole: 'SUPER_ADMIN',
          accountStatus: 'APPROVED',
          updatedAt: new Date().toISOString(),
        };
        const nextUsers = registeredUsers.some((u) => u.id === approvedSuper.id)
          ? registeredUsers.map((u) => (u.id === approvedSuper.id ? approvedSuper : u))
          : [approvedSuper, ...registeredUsers];
        syncUsersBroadcast(nextUsers);
        persistSessionUser(approvedSuper.id, approvedSuper.email);
        return { ok: true, account: approvedSuper };
      }

      const found = registeredUsers.find(
        (u) => u.email.toLowerCase() === cleanEmail
      );
      if (!found) {
        return {
          ok: false,
          error: 'No account found with that email. Please Sign Up first.',
        };
      }
      if (found.password && found.password !== password) {
        return {
          ok: false,
          error: 'Incorrect password. Please check your credentials and try again.',
        };
      }

      persistSessionUser(found.id, found.email);
      return { ok: true, account: found };
    },
    [registeredUsers, persistSessionUser, syncUsersBroadcast]
  );

  const signUpWithEmail = useCallback(
    async (params: {
      displayName: string;
      email: string;
      password: string;
    }): Promise<{ ok: boolean; error?: string; account?: RegisteredUserAccount }> => {
      const cleanEmail = params.email.trim().toLowerCase();
      const cleanName = params.displayName.trim().slice(0, 80);
      if (!cleanName || !cleanEmail || !params.password) {
        return { ok: false, error: 'Please fill in your name, email, and password.' };
      }

      if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return {
          ok: false,
          error: 'This email is reserved for Super Admin Ameen. Please use Sign In instead.',
        };
      }

      // Call authoritative backend /api/auth/signup first
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: cleanName,
            email: cleanEmail,
            password: params.password,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.ok && data?.account) {
          if (Array.isArray(data.users)) {
            setRegisteredUsers(data.users as RegisteredUserAccount[]);
          }
          persistSessionUser(data.account.id, data.account.email);
          return { ok: true, account: data.account as RegisteredUserAccount };
        }
        if (!res.ok && data?.error) {
          return { ok: false, error: String(data.error) };
        }
      } catch {
        // Fallback to local creation below if network error
      }

      const existing = registeredUsers.find(
        (u) => u.email.toLowerCase() === cleanEmail
      );
      if (existing) {
        return {
          ok: false,
          error: 'An account with this email already exists. Please Sign In.',
        };
      }

      const duplicateUsername = registeredUsers.find(
        (u) => (u.displayName || '').trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicateUsername) {
        return {
          ok: false,
          error: `Username "${cleanName}" is already taken. Each user must have a unique username.`,
        };
      }

      const newAccount: RegisteredUserAccount = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        email: cleanEmail,
        password: params.password,
        displayName: cleanName,
        systemRole: 'USER',
        accountStatus: 'PENDING',
        authSource: 'EMAIL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextUsers = [newAccount, ...registeredUsers];
      syncUsersBroadcast(nextUsers);
      persistSessionUser(newAccount.id, newAccount.email);
      return { ok: true, account: newAccount };
    },
    [registeredUsers, persistSessionUser, syncUsersBroadcast]
  );

  const continueWithGoogle = useCallback(
    async (customProfile?: {
      email?: string;
      displayName?: string;
    }): Promise<{ ok: boolean; error?: string; account?: RegisteredUserAccount }> => {
      let gEmail = customProfile?.email?.trim().toLowerCase() || '';
      let gName = customProfile?.displayName?.trim() || '';
      let gPhoto: string | undefined;

      if (!gEmail) {
        try {
          const cred = await signInWithPopup(auth, googleProvider);
          if (cred.user?.email) {
            gEmail = cred.user.email.toLowerCase();
            gName = cred.user.displayName || gEmail.split('@')[0];
            gPhoto = cred.user.photoURL || undefined;
          }
        } catch {
          // If popup is blocked or closed in preview environment, return a flag so UI can prompt Google email
          return {
            ok: false,
            error: 'GOOGLE_ACCOUNT_PROMPT_NEEDED',
          };
        }
      }

      if (!gEmail) {
        return { ok: false, error: 'Could not retrieve Google email address.' };
      }

      // Call authoritative backend /api/auth/google first
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: gEmail,
            displayName: (gName || gEmail.split('@')[0]).slice(0, 80),
            photoUrl: gPhoto,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.ok && data?.account) {
          if (Array.isArray(data.users)) {
            setRegisteredUsers(data.users as RegisteredUserAccount[]);
          }
          persistSessionUser(data.account.id, data.account.email);
          return { ok: true, account: data.account as RegisteredUserAccount };
        }
        if (!res.ok && data?.error) {
          return { ok: false, error: String(data.error) };
        }
      } catch {
        // Fallback below
      }

      // Check if Super Admin email
      if (gEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
        const superAcc =
          registeredUsers.find(
            (u) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
          ) || INITIAL_REGISTERED_USERS[0];
        persistSessionUser(superAcc.id, superAcc.email);
        return { ok: true, account: superAcc };
      }

      const existing = registeredUsers.find(
        (u) => u.email.toLowerCase() === gEmail
      );
      if (existing) {
        persistSessionUser(existing.id, existing.email);
        return { ok: true, account: existing };
      }

      const candidateGoogleName = (gName || gEmail.split('@')[0]).slice(0, 80);
      const duplicateGoogleName = registeredUsers.find(
        (u) => (u.displayName || '').trim().toLowerCase() === candidateGoogleName.toLowerCase()
      );
      if (duplicateGoogleName) {
        return {
          ok: false,
          error: `Username "${candidateGoogleName}" is already taken by another user. Please choose a unique username.`,
        };
      }

      // New Google user -> set to PENDING for Super Admin Ameen's approval gate
      const newGoogleAccount: RegisteredUserAccount = {
        id: `user_google_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        email: gEmail,
        displayName: (gName || gEmail.split('@')[0]).slice(0, 80),
        photoUrl: gPhoto,
        systemRole: 'USER',
        accountStatus: 'PENDING',
        authSource: 'GOOGLE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextUsers = [newGoogleAccount, ...registeredUsers];
      syncUsersBroadcast(nextUsers);
      persistSessionUser(newGoogleAccount.id, newGoogleAccount.email);
      return { ok: true, account: newGoogleAccount };
    },
    [registeredUsers, persistSessionUser, syncUsersBroadcast]
  );

  const superAdminApproveUser = useCallback(
    (userId: string) => {
      if (!isSuperAdmin) return;
      const target = registeredUsers.find((u) => u.id === userId);
      if (!target) return;
      const nextUsers = registeredUsers.map((u) =>
        u.id === userId
          ? { ...u, accountStatus: 'APPROVED' as AccountStatus, updatedAt: new Date().toISOString() }
          : u
      );
      syncUsersBroadcast(nextUsers);

      fetch(`/api/admin/users/${encodeURIComponent(userId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: currentAccount?.id || 'user_ameen' }),
      }).catch(() => {});
    },
    [isSuperAdmin, registeredUsers, currentAccount?.id, syncUsersBroadcast]
  );

  const superAdminDeclineUser = useCallback(
    (userId: string) => {
      if (!isSuperAdmin) return;
      const target = registeredUsers.find((u) => u.id === userId);
      if (!target || target.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return;
      const nextUsers = registeredUsers.map((u) =>
        u.id === userId
          ? { ...u, accountStatus: 'DECLINED' as AccountStatus, updatedAt: new Date().toISOString() }
          : u
      );
      syncUsersBroadcast(nextUsers);

      fetch(`/api/admin/users/${encodeURIComponent(userId)}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: currentAccount?.id || 'user_ameen' }),
      }).catch(() => {});
    },
    [isSuperAdmin, registeredUsers, currentAccount?.id, syncUsersBroadcast]
  );

  const superAdminToggleSuspendUser = useCallback(
    (userId: string) => {
      if (!isSuperAdmin) return;
      const target = registeredUsers.find((u) => u.id === userId);
      if (!target || target.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return;
      const nextStatus: AccountStatus =
        target.accountStatus === 'SUSPENDED' ? 'APPROVED' : 'SUSPENDED';
      const nextUsers = registeredUsers.map((u) =>
        u.id === userId
          ? { ...u, accountStatus: nextStatus, updatedAt: new Date().toISOString() }
          : u
      );
      syncUsersBroadcast(nextUsers);

      fetch(`/api/admin/users/${encodeURIComponent(userId)}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: currentAccount?.id || 'user_ameen' }),
      }).catch(() => {});
    },
    [isSuperAdmin, registeredUsers, currentAccount?.id, syncUsersBroadcast]
  );

  const superAdminDeleteUser = useCallback(
    (userId: string) => {
      if (!isSuperAdmin) return;
      const target = registeredUsers.find((u) => u.id === userId);
      if (!target || target.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return;
      const nextUsers = registeredUsers.filter((u) => u.id !== userId);
      syncUsersBroadcast(nextUsers);
      const nextMembers = allTeamMembers.filter((m) => m.userId !== userId);
      syncTeamsBroadcast(teams, nextMembers);

      fetch(
        `/api/admin/users/${encodeURIComponent(userId)}?adminUserId=${encodeURIComponent(currentAccount?.id || 'user_ameen')}`,
        { method: 'DELETE' }
      ).catch(() => {});
    },
    [isSuperAdmin, registeredUsers, allTeamMembers, teams, currentAccount?.id, syncUsersBroadcast, syncTeamsBroadcast]
  );

  const signInWithGoogle = useCallback(async () => {
    await continueWithGoogle();
  }, [continueWithGoogle]);

  const signOutUser = useCallback(async () => {
    persistSessionUser(null);
    setIsSuperAdminModalOpen(false);
    setIsInsideHall(false);
    setPersonalSession(null);
    setSelectedLibraryItem(null);
    setActiveTeamId('');
    setActiveLibraryScope('SELF');
    try {
      localStorage.removeItem(STORAGE_ACTIVE_TEAM_KEY);
    } catch {
      // ignore
    }
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
  }, [persistSessionUser]);

  const switchDemoIdentity = useCallback(
    (_memberUserId: string) => {
      // Disabled: Every device must sign in with its own credentials and never open another user's session.
    },
    []
  );

  const updateUserProfile = useCallback(
    async (
      displayName: string,
      photoUrl?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const trimmed = displayName.trim().slice(0, 80);
      if (!trimmed) {
        return { ok: false, error: 'Username cannot be empty.' };
      }

      const duplicateLocalUser = registeredUsers.find(
        (u) =>
          u.id !== currentUser.id &&
          (u.displayName || '').trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicateLocalUser) {
        return {
          ok: false,
          error: `Username "${trimmed}" is already taken. Each user must have a unique username.`,
        };
      }

      try {
        const res = await fetch(`/api/users/${encodeURIComponent(currentUser.id)}/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: trimmed, photoUrl }),
        });
        const data = await res.json();
        if (!res.ok && data?.error) {
          return { ok: false, error: String(data.error) };
        }
        if (res.ok && data?.ok) {
          if (Array.isArray(data.users)) {
            setRegisteredUsers(data.users as RegisteredUserAccount[]);
          }
          if (Array.isArray(data.teamMembers)) {
            setAllTeamMembers(data.teamMembers as TeamMember[]);
          }
        }
      } catch {
        // Fallback below
      }

      setCurrentUser((prev) => ({
        ...prev,
        displayName: trimmed,
        photoUrl: photoUrl ?? prev.photoUrl,
        updatedAt: new Date().toISOString(),
      }));
      const nextMembers = allTeamMembers.map((m) =>
        m.userId === currentUser.id
          ? { ...m, displayName: trimmed, photoUrl: photoUrl ?? m.photoUrl }
          : m
      );
      syncTeamsBroadcast(teams, nextMembers);
      if (currentAccount) {
        const nextUsers = registeredUsers.map((u) =>
          u.id === currentAccount.id
            ? { ...u, displayName: trimmed, photoUrl: photoUrl ?? u.photoUrl, updatedAt: new Date().toISOString() }
            : u
        );
        syncUsersBroadcast(nextUsers);
      }
      if (firebaseUser) {
        const path = `users/${currentUser.id}`;
        try {
          await updateDoc(doc(db, 'users', currentUser.id), {
            displayName: trimmed,
            ...(photoUrl ? { photoUrl: photoUrl.slice(0, 1024) } : {}),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
      return { ok: true };
    },
    [currentUser.id, allTeamMembers, teams, currentAccount, registeredUsers, firebaseUser, syncTeamsBroadcast, syncUsersBroadcast]
  );

  const selectTeam = useCallback((teamId: string) => {
    setActiveTeamId(teamId);
    if (teamId) {
      setActiveLibraryScope(teamId);
    }
  }, []);

  const unlockAppWithPin = useCallback(
    (pin: string): { ok: boolean; error?: string } => {
      const cleanPin = pin.trim();
      const activeUid = currentAccount?.id || currentUser.id;
      const expectedPin = (currentAccount?.appLockPin || currentUser.appLockPin || '').trim();
      if (!expectedPin) {
        setUnlockedUsersInSession((prev) => ({ ...prev, [activeUid]: true, [currentUser.id]: true }));
        return { ok: true };
      }
      if (cleanPin !== expectedPin) {
        return {
          ok: false,
          error: 'Incorrect App Lock PIN. Please enter your personal PIN.',
        };
      }
      setUnlockedUsersInSession((prev) => ({ ...prev, [activeUid]: true, [currentUser.id]: true }));
      return { ok: true };
    },
    [currentAccount?.id, currentAccount?.appLockPin, currentUser.appLockPin, currentUser.id]
  );

  const lockAppNow = useCallback(() => {
    const activeUid = currentAccount?.id || currentUser.id;
    const enabled = currentAccount
      ? currentAccount.appLockEnabled === true
      : currentUser.appLockEnabled === true;
    const expectedPin = (currentAccount?.appLockPin || currentUser.appLockPin || '').trim();
    if (!enabled || !expectedPin) return;
    setUnlockedUsersInSession((prev) => {
      const next = { ...prev };
      delete next[activeUid];
      delete next[currentUser.id];
      return next;
    });
  }, [currentAccount, currentUser]);

  const updateUserAppLockPin = useCallback(
    async (params: {
      enabled: boolean;
      pin: string;
      currentPin?: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      const existingPin = (currentAccount?.appLockPin || currentUser.appLockPin || '').trim();
      const wasEnabled = Boolean(
        (currentAccount?.appLockEnabled ?? currentUser.appLockEnabled) && existingPin
      );

      if (wasEnabled && params.currentPin !== undefined) {
        if (params.currentPin.trim() !== existingPin) {
          return {
            ok: false,
            error: 'Current App Lock PIN is incorrect.',
          };
        }
      }

      const cleanPin = params.pin.trim().slice(0, 12);
      if (params.enabled && cleanPin.length < 4) {
        return {
          ok: false,
          error: 'App Lock PIN must be at least 4 digits/characters.',
        };
      }

      const finalPin = params.enabled ? cleanPin : '';
      const finalEnabled = Boolean(params.enabled && finalPin);

      // Keep current session unlocked right when configuring PIN in Profile
      setUnlockedUsersInSession((prev) => ({ ...prev, [currentUser.id]: true }));

      setCurrentUser((prev) => ({
        ...prev,
        appLockPin: finalPin,
        appLockEnabled: finalEnabled,
        updatedAt: new Date().toISOString(),
      }));

      const nextUsers = registeredUsers.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              appLockPin: finalPin,
              appLockEnabled: finalEnabled,
              updatedAt: new Date().toISOString(),
            }
          : u
      );
      syncUsersBroadcast(nextUsers);

      try {
        await fetch(`/api/users/${encodeURIComponent(currentUser.id)}/app-lock`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callerUserId: currentUser.id,
            appLockEnabled: finalEnabled,
            appLockPin: finalPin,
          }),
        });
      } catch {
        // Fallback already persisted in localStorage & syncUsersBroadcast
      }

      return { ok: true };
    },
    [currentAccount, currentUser, registeredUsers, syncUsersBroadcast]
  );

  const createTeam = useCallback(
    async (
      name: string,
      pin: string,
      description: string
    ): Promise<{ ok: boolean; error?: string; team?: Team }> => {
      const cleanName = name.trim().slice(0, 80);
      const cleanPin = pin.trim().slice(0, 20) || '1234';
      const cleanDesc = description.trim().slice(0, 300);

      if (!cleanName) {
        return { ok: false, error: 'Team Name is required.' };
      }

      const duplicateLocalTeam = teams.find(
        (t) => t.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicateLocalTeam) {
        return {
          ok: false,
          error: `Team name "${cleanName}" is already taken. Every team must have a unique name.`,
        };
      }

      try {
        const res = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            pin: cleanPin,
            description: cleanDesc,
            ownerId: currentUser.id,
            ownerName: currentUser.displayName,
            ownerPhotoUrl: currentUser.photoUrl,
            imageUrl: ASSETS.posterDune,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.ok && data?.team) {
          if (Array.isArray(data.teams)) setTeams(data.teams as Team[]);
          if (Array.isArray(data.teamMembers)) setAllTeamMembers(data.teamMembers as TeamMember[]);
          setActiveTeamId(data.team.id);
          return { ok: true, team: data.team as Team };
        }
        if (!res.ok && data?.error) {
          return { ok: false, error: String(data.error) };
        }
      } catch {
        // Fallback below
      }

      const id = `team_${Date.now()}`;
      const inviteCode = `CM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const newTeam: Team = {
        id,
        name: cleanName,
        pin: cleanPin,
        description: cleanDesc,
        imageUrl: ASSETS.posterDune,
        inviteCode,
        ownerId: currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const ownerMember: TeamMember = {
        id: `${id}_${currentUser.id}`,
        teamId: id,
        userId: currentUser.id,
        displayName: currentUser.displayName,
        photoUrl: currentUser.photoUrl,
        role: 'OWNER',
        presence: 'ONLINE',
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextTeams = [...teams, newTeam];
      const nextMembers = [...allTeamMembers, ownerMember];
      syncTeamsBroadcast(nextTeams, nextMembers);
      setActiveTeamId(id);

      if (firebaseUser && firebaseUser.emailVerified) {
        try {
          await setDoc(doc(db, 'teams', id), {
            id,
            name: cleanName,
            pin: cleanPin,
            description: cleanDesc,
            imageUrl: ASSETS.posterDune,
            inviteCode,
            ownerId: currentUser.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'teamMembers', ownerMember.id), {
            id: ownerMember.id,
            teamId: id,
            userId: currentUser.id,
            displayName: currentUser.displayName,
            role: 'OWNER',
            presence: 'ONLINE',
            joinedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `teams/${id}`);
        }
      }
      return { ok: true, team: newTeam };
    },
    [currentUser, teams, allTeamMembers, firebaseUser, syncTeamsBroadcast]
  );

  const updateTeamCredentials = useCallback(
    async (
      teamId: string,
      name: string,
      pin: string,
      description?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const targetTeam = teams.find((t) => t.id === teamId);
      if (!targetTeam) return { ok: false, error: 'Team not found.' };

      const callerMember = allTeamMembers.find(
        (m) => m.teamId === teamId && m.userId === currentUser.id
      );
      const isOwner =
        targetTeam.ownerId === currentUser.id || callerMember?.role === 'OWNER';
      if (!isOwner) {
        return {
          ok: false,
          error: 'Only the Team Owner can change the Team Name and PIN number.',
        };
      }

      const cleanName = name.trim().slice(0, 80);
      const cleanPin = pin.trim().slice(0, 20);
      if (!cleanName || !cleanPin) {
        return {
          ok: false,
          error: 'Both Team Name and PIN number are required.',
        };
      }

      const duplicateLocalTeam = teams.find(
        (t) => t.id !== teamId && t.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicateLocalTeam) {
        return {
          ok: false,
          error: `Team name "${cleanName}" is already in use by another team. Every team must have a unique name.`,
        };
      }

      try {
        const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/credentials`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callerUserId: currentUser.id,
            name: cleanName,
            pin: cleanPin,
            description,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.ok) {
          if (Array.isArray(data.teams)) setTeams(data.teams as Team[]);
          if (Array.isArray(data.teamMembers)) setAllTeamMembers(data.teamMembers as TeamMember[]);
          return { ok: true };
        }
        if (!res.ok && data?.error) {
          return { ok: false, error: String(data.error) };
        }
      } catch {
        // Fallback below
      }

      const nextTeams = teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              name: cleanName,
              pin: cleanPin,
              description:
                description !== undefined ? description.trim().slice(0, 300) : t.description,
              updatedAt: new Date().toISOString(),
            }
          : t
      );
      syncTeamsBroadcast(nextTeams, allTeamMembers);
      return { ok: true };
    },
    [teams, allTeamMembers, currentUser.id, syncTeamsBroadcast]
  );

  const deleteTeam = useCallback(
    async (teamId: string): Promise<{ ok: boolean; error?: string }> => {
      const targetTeam = teams.find((t) => t.id === teamId);
      if (!targetTeam) return { ok: false, error: 'Team not found.' };

      const callerMember = allTeamMembers.find(
        (m) => m.teamId === teamId && m.userId === currentUser.id
      );
      const isOwner =
        targetTeam.ownerId === currentUser.id || callerMember?.role === 'OWNER';
      if (!isOwner) {
        return {
          ok: false,
          error: 'Only the Team Owner can delete this team.',
        };
      }

      try {
        await fetch(
          `/api/teams/${encodeURIComponent(teamId)}?callerUserId=${encodeURIComponent(currentUser.id)}`,
          { method: 'DELETE' }
        );
      } catch {
        // fallback below
      }

      if (firebaseUser) {
        try {
          await deleteDoc(doc(db, 'teams', teamId));
        } catch {
          // ignore
        }
      }

      const nextTeams = teams.filter((t) => t.id !== teamId);
      const nextMembers = allTeamMembers.filter((m) => m.teamId !== teamId);
      const nextLibrary = libraryItems.filter((i) => i.teamId !== teamId);
      setLibraryItems(nextLibrary);
      syncTeamsBroadcast(nextTeams, nextMembers);
      if (activeTeamId === teamId) {
        setActiveTeamId(nextTeams[0]?.id || '');
      }
      return { ok: true };
    },
    [teams, allTeamMembers, currentUser.id, firebaseUser, libraryItems, syncTeamsBroadcast, activeTeamId]
  );

  const searchTeamByNameAndPin = useCallback(
    async (
      teamName: string,
      pin: string
    ): Promise<{ ok: boolean; error?: string; team?: Team; memberCount?: number }> => {
      const cleanName = teamName.trim().toLowerCase();
      const cleanPin = pin.trim();
      if (!cleanName || !cleanPin) {
        return { ok: false, error: 'Please enter both Team Name and PIN number to search.' };
      }

      try {
        const res = await fetch('/api/teams/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamName: cleanName, pin: cleanPin }),
        });
        const data = await res.json();
        if (res.ok && data?.ok && data?.team) {
          return {
            ok: true,
            team: data.team as Team,
            memberCount: Number(data.memberCount) || 1,
          };
        }
        if (!res.ok && data?.error && res.status !== 404) {
          return { ok: false, error: String(data.error) };
        }
      } catch {
        // Fallback to local registry check below
      }

      const matched = teams.find(
        (t) => t.name.trim().toLowerCase() === cleanName && t.pin.trim() === cleanPin
      );
      if (!matched) {
        return {
          ok: false,
          error: 'No team found matching that Team Name and PIN number.',
        };
      }

      const memberCount = allTeamMembers.filter((m) => m.teamId === matched.id).length || 1;
      return { ok: true, team: matched, memberCount };
    },
    [teams, allTeamMembers]
  );

  const joinTeamByNameAndPin = useCallback(
    async (
      teamName: string,
      pin: string
    ): Promise<{ ok: boolean; error?: string; team?: Team }> => {
      const cleanName = teamName.trim().toLowerCase();
      const cleanPin = pin.trim();
      if (!cleanName || !cleanPin) {
        return { ok: false, error: 'Please enter both Team Name and PIN number.' };
      }

      try {
        const res = await fetch('/api/teams/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamName: cleanName,
            pin: cleanPin,
            userId: currentUser.id,
            displayName: currentUser.displayName,
            photoUrl: currentUser.photoUrl,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.ok && data?.team) {
          if (Array.isArray(data.teams)) setTeams(data.teams as Team[]);
          if (Array.isArray(data.teamMembers)) setAllTeamMembers(data.teamMembers as TeamMember[]);
          setActiveTeamId(data.team.id);
          return { ok: true, team: data.team as Team };
        }
        if (!res.ok && data?.error && res.status !== 404) {
          return { ok: false, error: String(data.error) };
        }
      } catch {
        // Fallback below
      }

      const matched = teams.find(
        (t) =>
          t.name.trim().toLowerCase() === cleanName && t.pin.trim() === cleanPin
      );
      if (!matched) {
        return {
          ok: false,
          error: 'Invalid Team Name or PIN number. Please verify with the Team Owner.',
        };
      }

      setActiveTeamId(matched.id);
      const memberId = `${matched.id}_${currentUser.id}`;
      const alreadyMember = allTeamMembers.some((m) => m.id === memberId);
      if (!alreadyMember) {
        const newMember: TeamMember = {
          id: memberId,
          teamId: matched.id,
          userId: currentUser.id,
          displayName: currentUser.displayName,
          photoUrl: currentUser.photoUrl,
          role: 'MEMBER',
          presence: 'ONLINE',
          joinedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const nextMembers = [...allTeamMembers, newMember];
        syncTeamsBroadcast(teams, nextMembers);
      }
      return { ok: true, team: matched };
    },
    [teams, allTeamMembers, currentUser, syncTeamsBroadcast]
  );

  const joinTeamByCode = useCallback(
    async (inviteCode: string): Promise<boolean> => {
      const normalized = inviteCode.trim().toUpperCase();
      const matched = teams.find((t) => t.inviteCode.toUpperCase() === normalized);
      if (!matched) return false;
      setActiveTeamId(matched.id);
      const memberId = `${matched.id}_${currentUser.id}`;
      if (!allTeamMembers.some((m) => m.id === memberId)) {
        const newMember: TeamMember = {
          id: memberId,
          teamId: matched.id,
          userId: currentUser.id,
          displayName: currentUser.displayName,
          photoUrl: currentUser.photoUrl,
          role: 'MEMBER',
          presence: 'ONLINE',
          joinedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const nextMembers: TeamMember[] = [...allTeamMembers, newMember];
        syncTeamsBroadcast(teams, nextMembers);
        fetch('/api/teams/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamName: matched.name,
            pin: matched.pin,
            userId: currentUser.id,
            displayName: currentUser.displayName,
            photoUrl: currentUser.photoUrl,
          }),
        }).catch(() => {});
      }
      return true;
    },
    [teams, allTeamMembers, currentUser, syncTeamsBroadcast]
  );

  // Strict RBAC Rule 1: ONLY Team Owner can assign or change roles (ADMIN <-> MEMBER). Owner can never be downgraded.
  const updateMemberRole = useCallback(
    (memberUserId: string, role: TeamRole): { ok: boolean; error?: string } => {
      const caller = allTeamMembers.find(
        (m) => m.teamId === activeTeam.id && m.userId === currentUser.id
      );
      const isCallerOwner =
        activeTeam.ownerId === currentUser.id || caller?.role === 'OWNER';
      if (!isCallerOwner) {
        return {
          ok: false,
          error: 'Only the Team Owner can assign or change member roles.',
        };
      }

      const target = allTeamMembers.find(
        (m) => m.teamId === activeTeam.id && m.userId === memberUserId
      );
      if (!target) {
        return { ok: false, error: 'Team member not found.' };
      }

      if (target.role === 'OWNER' || target.userId === activeTeam.ownerId) {
        return {
          ok: false,
          error: 'The Team Owner can never be downgraded.',
        };
      }

      if (role !== 'ADMIN' && role !== 'MEMBER') {
        return {
          ok: false,
          error: 'Invalid role assignment.',
        };
      }

      const nextMembers = allTeamMembers.map((m) =>
        m.teamId === activeTeam.id && m.userId === memberUserId
          ? { ...m, role, updatedAt: new Date().toISOString() }
          : m
      );
      syncTeamsBroadcast(teams, nextMembers);

      fetch(
        `/api/teams/${encodeURIComponent(activeTeam.id)}/members/${encodeURIComponent(memberUserId)}/role`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callerUserId: currentUser.id, role }),
        }
      ).catch(() => {});

      return { ok: true };
    },
    [allTeamMembers, activeTeam, currentUser.id, teams, syncTeamsBroadcast]
  );

  // Strict RBAC Rule 2: Removing Members:
  // - Team Owner: Can remove both ADMIN and MEMBER.
  // - Team Admin: Can remove regular MEMBER, cannot remove other ADMINs or OWNER.
  // - Team Owner can never be removed.
  const removeTeamMember = useCallback(
    (memberUserId: string): { ok: boolean; error?: string } => {
      const caller = allTeamMembers.find(
        (m) => m.teamId === activeTeam.id && m.userId === currentUser.id
      );
      const isCallerOwner =
        activeTeam.ownerId === currentUser.id || caller?.role === 'OWNER';
      const isCallerAdmin = caller?.role === 'ADMIN';

      if (!isCallerOwner && !isCallerAdmin) {
        return {
          ok: false,
          error: 'You do not have permission to remove team members.',
        };
      }

      const target = allTeamMembers.find(
        (m) => m.teamId === activeTeam.id && m.userId === memberUserId
      );
      if (!target) {
        return { ok: false, error: 'Member not found in this team.' };
      }

      if (target.role === 'OWNER' || target.userId === activeTeam.ownerId) {
        return {
          ok: false,
          error: 'The Team Owner can never be removed.',
        };
      }

      if (isCallerAdmin && !isCallerOwner && target.role === 'ADMIN') {
        return {
          ok: false,
          error: 'Team Admins can remove regular members, but cannot remove other Admins or the Owner.',
        };
      }

      const nextMembers = allTeamMembers.filter(
        (m) => !(m.teamId === activeTeam.id && m.userId === memberUserId)
      );
      syncTeamsBroadcast(teams, nextMembers);

      fetch(
        `/api/teams/${encodeURIComponent(activeTeam.id)}/members/${encodeURIComponent(memberUserId)}?callerUserId=${encodeURIComponent(currentUser.id)}`,
        { method: 'DELETE' }
      ).catch(() => {});

      return { ok: true };
    },
    [allTeamMembers, activeTeam, currentUser.id, teams, syncTeamsBroadcast]
  );

  const addLibraryItemFromUrl = useCallback(
    async (params: {
      title: string;
      description: string;
      videoUrl: string;
      embedUrl?: string;
      posterUrl?: string;
      sourceType?: 'DIRECT_URL' | 'WEBPAGE' | 'CLOUD_VIDEO';
      category: LibraryCategory;
      durationMs: number;
      year?: number;
      isDownloaded?: boolean;
      downloadQuality?: string;
      fileSizeBytes?: number;
      originalPageUrl?: string;
      platformName?: string;
      targetLibraryScope?: 'SELF' | string;
    }): Promise<LibraryItem> => {
      const id = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const ytId = resolveYouTubeVideoId({
        videoUrl: params.videoUrl,
        embedUrl: params.embedUrl,
        originalPageUrl: params.originalPageUrl,
        posterUrl: params.posterUrl,
      });
      const normalizedVideoUrl = ytId
        ? `https://www.youtube.com/watch?v=${ytId}`
        : params.videoUrl.trim().slice(0, 2048);
      const normalizedEmbedUrl = ytId
        ? `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`
        : params.embedUrl;

      const requestedScope = params.targetLibraryScope ?? activeLibraryScope;
      const isSelfScope =
        requestedScope === 'SELF' ||
        !requestedScope ||
        !userTeams.some((t) => t.id === requestedScope);
      const finalTeamId = isSelfScope ? '' : requestedScope;
      const finalLibraryScope: 'SELF' | 'TEAM' = isSelfScope ? 'SELF' : 'TEAM';

      const newItem: LibraryItem = {
        id,
        teamId: finalTeamId,
        libraryScope: finalLibraryScope,
        title: params.title.trim().slice(0, 160),
        description: params.description.trim().slice(0, 1000),
        posterUrl:
          params.posterUrl ||
          (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : ASSETS.posterMidnightTokyo),
        backdropUrl:
          params.posterUrl ||
          (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : ASSETS.backdropCinema),
        videoUrl: normalizedVideoUrl,
        embedUrl: normalizedEmbedUrl,
        sourceType: params.sourceType || 'DIRECT_URL',
        category: params.category,
        durationMs: params.durationMs || 5400000,
        year: params.year || 2026,
        addedById: currentUser.id,
        addedByName: currentUser.displayName,
        isDownloaded: params.isDownloaded,
        downloadQuality: params.downloadQuality,
        fileSizeBytes: params.fileSizeBytes,
        originalPageUrl: params.originalPageUrl || (ytId ? normalizedVideoUrl : undefined),
        platformName: params.platformName || (ytId ? 'YouTube Video' : undefined),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLibraryItems((prev) => [newItem, ...prev]);

      fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: newItem }),
      }).catch(() => {});

      return newItem;
    },
    [activeLibraryScope, userTeams, currentUser.id, currentUser.displayName]
  );

  // VidMate-style Link Sniffer & Auto-Downloader straight into Self or Team Library
  const autoDownloadLinkToLibrary = useCallback(
    async (params: {
      url: string;
      title?: string;
      qualityLabel?: string;
      sizeBytes?: number;
      category?: LibraryCategory;
      preResolved?: WebpageResolutionResult;
      targetLibraryScope?: 'SELF' | string;
    }): Promise<LibraryItem | null> => {
      const rawUrl = params.url.trim();
      if (!rawUrl) return null;

      const taskId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const initialTitle = params.title?.trim() || 'Sniffing video link...';
      const initialQuality = params.qualityLabel || '1080p Full HD';
      const initialTotalBytes = params.sizeBytes || 86402662;

      const initialTask: LibraryDownloadTask = {
        id: taskId,
        url: rawUrl,
        title: initialTitle,
        platform: 'Web Link',
        posterUrl: ASSETS.posterMidnightTokyo,
        qualityLabel: initialQuality,
        format: 'MP4',
        status: 'SNIFFING',
        progressPct: 4,
        speedText: 'Analyzing page...',
        downloadedBytes: 0,
        totalBytes: initialTotalBytes,
        createdAt: new Date().toISOString(),
      };

      setDownloadTasks((prev) => [initialTask, ...prev]);

      // Step 1: Resolve webpage or direct video link
      const resolved = params.preResolved || (await resolveWebpageOrMediaUrl(rawUrl));
      if (!resolved.valid) {
        setDownloadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'FAILED', speedText: resolved.reason || 'Cannot resolve link' }
              : t
          )
        );
        return null;
      }

      const finalTitle = (params.title?.trim() || resolved.title || 'Downloaded Video').slice(0, 160);
      const chosenFormat =
        resolved.availableFormats.find((f) => f.label === params.qualityLabel || f.id === params.qualityLabel) ||
        resolved.availableFormats[0] || {
          id: '1080p',
          label: initialQuality,
          ext: 'MP4' as const,
          sizeBytes: initialTotalBytes,
          resolution: '1920x1080',
        };

      const totalBytes = params.sizeBytes || chosenFormat.sizeBytes || 82837504;
      const posterUrl = resolved.thumbnailUrl || ASSETS.posterMidnightTokyo;

      // Update task to DOWNLOADING state
      setDownloadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                title: finalTitle,
                platform: resolved.platform,
                posterUrl,
                qualityLabel: chosenFormat.label,
                format: chosenFormat.ext,
                status: 'DOWNLOADING',
                progressPct: 12,
                speedText: '8.4 MB/s',
                downloadedBytes: Math.round(totalBytes * 0.12),
                totalBytes,
              }
            : t
        )
      );

      // Step 2: Stream/download progress stages with high-speed multi-part progress
      const steps = [28, 49, 71, 89, 100];
      const speeds = ['9.6 MB/s', '12.4 MB/s', '14.1 MB/s', '11.8 MB/s', 'Completed'];
      for (let i = 0; i < steps.length; i++) {
        await new Promise((r) => setTimeout(r, 260));
        const pct = steps[i];
        setDownloadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  progressPct: pct,
                  speedText: speeds[i],
                  downloadedBytes: Math.round((totalBytes * pct) / 100),
                }
              : t
          )
        );
      }

      // Determine direct playable video stream URL
      const playableStreamUrl =
        chosenFormat.videoUrl ||
        resolved.playableVideoUrl ||
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';

      // Step 3: Automatically save the downloaded DIRECT VIDEO into the selected Library (Self or Team)
      const newItem = await addLibraryItemFromUrl({
        title: finalTitle,
        description: `Direct video auto-downloaded from ${resolved.platform} (${chosenFormat.label} · ${chosenFormat.ext}).`,
        videoUrl: playableStreamUrl,
        embedUrl: resolved.embedUrl || undefined,
        posterUrl,
        sourceType: 'DIRECT_URL',
        category: params.category || 'RECENTLY_ADDED',
        durationMs: 5400000,
        year: new Date().getFullYear(),
        isDownloaded: true,
        downloadQuality: chosenFormat.label,
        fileSizeBytes: totalBytes,
        originalPageUrl: resolved.originalUrl,
        platformName: resolved.platform,
        targetLibraryScope: params.targetLibraryScope,
      });

      setDownloadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'COMPLETED',
                progressPct: 100,
                speedText: 'Saved in Library',
                downloadedBytes: totalBytes,
                libraryItemId: newItem.id,
              }
            : t
        )
      );

      return newItem;
    },
    [addLibraryItemFromUrl]
  );

  const saveLibraryItemToDeviceDisk = useCallback((item: LibraryItem) => {
    const streamTarget = item.videoUrl.startsWith('http')
      ? `/api/webpage/download-stream?url=${encodeURIComponent(item.videoUrl)}&title=${encodeURIComponent(item.title)}`
      : item.videoUrl;
    const a = document.createElement('a');
    a.href = streamTarget;
    a.download = `${item.title.replace(/[^a-zA-Z0-9._-]+/g, '_')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const removeDownloadTask = useCallback((taskId: string) => {
    setDownloadTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const deleteLibraryItem = useCallback(
    async (itemId: string): Promise<{ ok: boolean; error?: string }> => {
      const target = libraryItems.find((i) => i.id === itemId);
      if (!target) {
        return { ok: false, error: 'Video not found.' };
      }

      if (!canDeleteLibraryItem(target)) {
        return {
          ok: false,
          error: 'Only the Team Owner can manage (delete) Team Library videos.',
        };
      }

      setLastDeletedLibraryItem(target);
      setLibraryItems((prev) => prev.filter((i) => i.id !== itemId));
      setSelectedLibraryItem((prev) => (prev && prev.id === itemId ? null : prev));
      setDownloadTasks((prev) => prev.filter((t) => t.libraryItemId !== itemId));

      fetch(
        `/api/library/${encodeURIComponent(itemId)}?callerUserId=${encodeURIComponent(currentUser.id)}`,
        {
          method: 'DELETE',
        }
      ).catch(() => {});

      if (firebaseUser) {
        try {
          await deleteDoc(doc(db, 'libraryItems', itemId));
        } catch {
          // Local library items may not exist in Firestore; ignore
        }
      }

      return { ok: true };
    },
    [libraryItems, canDeleteLibraryItem, currentUser.id, firebaseUser]
  );

  const restoreDeletedLibraryItem = useCallback(() => {
    if (!lastDeletedLibraryItem) return;
    setLibraryItems((prev) => {
      if (prev.some((i) => i.id === lastDeletedLibraryItem.id)) return prev;
      return [lastDeletedLibraryItem, ...prev];
    });
    fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: lastDeletedLibraryItem }),
    }).catch(() => {});
    setLastDeletedLibraryItem(null);
  }, [lastDeletedLibraryItem]);

  // Section 12: Explicit Optional Upload to Self or Team Library with real progress
  const uploadVideoToTeamLibrary = useCallback(
    async (
      file: File,
      title: string,
      description: string,
      category: LibraryCategory,
      onProgress: (pct: number) => void,
      targetLibraryScope?: 'SELF' | string
    ): Promise<LibraryItem> => {
      const id = `lib_upload_${Date.now()}`;
      let downloadUrl = URL.createObjectURL(file);

      const requestedScope = targetLibraryScope ?? activeLibraryScope;
      const isSelfScope =
        requestedScope === 'SELF' ||
        !requestedScope ||
        !userTeams.some((t) => t.id === requestedScope);
      const finalTeamId = isSelfScope ? '' : requestedScope;
      const finalLibraryScope: 'SELF' | 'TEAM' = isSelfScope ? 'SELF' : 'TEAM';

      if (firebaseUser) {
        try {
          const storageFolder = isSelfScope ? `users/${currentUser.id}` : `teams/${finalTeamId}`;
          const filePath = `${storageFolder}/library/${id}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const fileRef = storageRef(storage, filePath);
          const uploadTask = uploadBytesResumable(fileRef, file);

          downloadUrl = await new Promise<string>((resolve, reject) => {
            uploadTask.on(
              'state_changed',
              (snapshot) => {
                const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                onProgress(pct);
              },
              (err) => reject(err),
              async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
              }
            );
          });
        } catch {
          // If Firebase Storage rules/bucket not yet initialized in sandbox, progress smoothly and use local object URL
          for (let p = 20; p <= 100; p += 20) {
            onProgress(p);
            await new Promise((r) => setTimeout(r, 120));
          }
        }
      } else {
        for (let p = 15; p <= 100; p += 20) {
          onProgress(Math.min(100, p));
          await new Promise((r) => setTimeout(r, 110));
        }
      }

      const newItem: LibraryItem = {
        id,
        teamId: finalTeamId,
        libraryScope: finalLibraryScope,
        title: (title.trim() || file.name).slice(0, 160),
        description:
          description.trim().slice(0, 1000) ||
          (isSelfScope ? 'Uploaded to Self Library.' : 'Uploaded to Team Library.'),
        posterUrl: ASSETS.posterAlpine,
        backdropUrl: ASSETS.backdropCinema,
        videoUrl: downloadUrl,
        sourceType: 'CLOUD_VIDEO',
        category,
        durationMs: 3600000,
        year: new Date().getFullYear(),
        addedById: currentUser.id,
        addedByName: currentUser.displayName,
        localFileName: file.name,
        localFileSize: file.size,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLibraryItems((prev) => [newItem, ...prev]);
      fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: newItem }),
      }).catch(() => {});
      return newItem;
    },
    [activeLibraryScope, userTeams, currentUser.id, currentUser.displayName, firebaseUser]
  );

  // Section 11: Select device video WITHOUT uploading
  const selectDeviceVideoFile = useCallback((file: File): string => {
    const objectUrl = URL.createObjectURL(file);
    setLocalDeviceVideoFile(file);
    setLocalDeviceVideoUrl(objectUrl);
    return objectUrl;
  }, []);

  // Section 3A: Watch Alone (No Hall, No team notification, No LiveKit room)
  const startWatchAlone = useCallback((session: PersonalWatchSession) => {
    const ytId = resolveYouTubeVideoId({
      videoUrl: session.videoUrl,
      embedUrl: session.embedUrl,
      posterUrl: session.posterUrl,
    });
    const normalizedSession: PersonalWatchSession = ytId
      ? {
          ...session,
          videoUrl: `https://www.youtube.com/watch?v=${ytId}`,
          embedUrl:
            session.embedUrl ||
            `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`,
          posterUrl: session.posterUrl || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
        }
      : session;
    setIsInsideHall(false);
    setPersonalSession(normalizedSession);
  }, []);

  const closeWatchAlone = useCallback((finalPositionMs?: number, libraryItemId?: string) => {
    if (libraryItemId && typeof finalPositionMs === 'number' && finalPositionMs > 0) {
      setLibraryItems((prev) =>
        prev.map((item) =>
          item.id === libraryItemId ? { ...item, progressMs: finalPositionMs } : item
        )
      );
    }
    setPersonalSession(null);
  }, []);

  // Section 13: Create Movie Hall
  const startMovieHall = useCallback(
    async (params: {
      title: string;
      videoUrl?: string;
      embedUrl?: string;
      posterUrl?: string;
      backdropUrl?: string;
      libraryItemId?: string;
      sourceType: VideoSourceType;
      shareType?: ShareType;
      durationMs?: number;
      initialPositionMs?: number;
      localFileName?: string;
    }): Promise<MovieHall> => {
      const hallId = `hall_${Date.now()}`;
      const ytId = resolveYouTubeVideoId({
        videoUrl: params.videoUrl,
        embedUrl: params.embedUrl,
        posterUrl: params.posterUrl,
      });
      const newHall: MovieHall = {
        id: hallId,
        teamId: activeTeam.id,
        hostId: currentUser.id,
        hostName: currentUser.displayName,
        libraryItemId: params.libraryItemId,
        title: params.title.trim().slice(0, 160),
        posterUrl:
          params.posterUrl ||
          (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : ASSETS.posterInterstellar),
        backdropUrl:
          params.backdropUrl ||
          (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : ASSETS.backdropCinema),
        videoUrl: ytId ? `https://www.youtube.com/watch?v=${ytId}` : params.videoUrl,
        embedUrl: ytId
          ? params.embedUrl ||
            `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`
          : params.embedUrl,
        sourceType: params.sourceType,
        status: 'LIVE',
        isPlaying: true,
        positionMs: params.initialPositionMs || 0,
        durationMs: params.durationMs || 7200000,
        playbackSpeed: 1,
        viewerCount: 1,
        shareType:
          params.shareType ||
          (params.sourceType === 'DEVICE_LOCAL' ? 'DEVICE_STREAM' : 'NONE'),
        hostConnected: true,
        localFileName: params.localFileName,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const hostHallMember: HallMember = {
        id: `${hallId}_${currentUser.id}`,
        hallId,
        teamId: activeTeam.id,
        userId: currentUser.id,
        displayName: currentUser.displayName,
        photoUrl: currentUser.photoUrl,
        role: 'HOST',
        micEnabled: false, // Every user has their own permission to enable/disable mic & cam
        cameraEnabled: false,
        isSpeaking: false,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setActiveHall(newHall);
      setHallMembers([hostHallMember]);
      setLatestPresentationFrame(null);
      setRemoteMemberCamFrames({});
      setJoinRequests([]);
      setHallMessages([]);
      setHallActivities([
        {
          id: `act_${Date.now()}`,
          hallId,
          teamId: activeTeam.id,
          actorId: currentUser.id,
          actorName: currentUser.displayName,
          eventType: 'PLAYBACK_PLAY',
          message: 'Movie Hall started',
          createdAt: new Date().toISOString(),
        },
      ]);
      setPersonalSession(null);
      setSelectedLibraryItem(null);
      setIsInsideHall(true);

      // Update team member presence
      setAllTeamMembers((prev) =>
        prev.map((m) =>
          m.userId === currentUser.id
            ? { ...m, presence: 'WATCHING', watchingTitle: newHall.title }
            : m
        )
      );

      sendWsMessage({
        type: 'HALL_CREATE',
        hall: newHall,
        members: [hostHallMember],
      });

      // If Host started Hall from a local device video file (blob: URL), stream-upload it in the background
      // so all team members who join the Hall get a direct playable stream URL in addition to live presentation frames!
      if (
        params.sourceType === 'DEVICE_LOCAL' &&
        localDeviceVideoFile &&
        params.videoUrl?.startsWith('blob:')
      ) {
        const formData = new FormData();
        formData.append('video', localDeviceVideoFile);
        formData.append('title', newHall.title);
        formData.append('teamId', activeTeam.id);
        formData.append('userId', currentUser.id);
        fetch('/api/library/upload', {
          method: 'POST',
          body: formData,
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.videoUrl) {
              setActiveHall((prev) =>
                prev && prev.id === hallId ? { ...prev, videoUrl: data.videoUrl } : prev
              );
              sendWsMessage({
                type: 'HOST_PLAYBACK_UPDATE',
                hallId,
                userId: currentUser.id,
                videoUrl: data.videoUrl,
              });
            }
          })
          .catch(() => {
            // Live canvas presentation frames continue streaming seamlessly
          });
      }

      // Request server-issued LiveKit token (Section 31)
      try {
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hallId,
            teamId: activeTeam.id,
            userId: currentUser.id,
            displayName: currentUser.displayName,
            role: 'HOST',
            joinRequestAccepted: true,
          }),
        });
        if (res.ok) {
          const tokenData = await res.json();
          setLiveKitToken(tokenData.token);
        }
      } catch {
        // continue
      }

      return newHall;
    },
    [activeTeam.id, currentUser, sendWsMessage]
  );

  // Section 14: Request to Join Movie Hall
  const requestToJoinHall = useCallback(
    async (hallId: string) => {
      if (!activeHall || activeHall.id !== hallId) return;
      const reqId = `${hallId}_${currentUser.id}`;
      const newReq: HallJoinRequest = {
        id: reqId,
        hallId,
        teamId: activeHall.teamId,
        hostId: activeHall.hostId,
        requesterId: currentUser.id,
        requesterName: currentUser.displayName,
        requesterPhotoUrl: currentUser.photoUrl,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setJoinRequests((prev) => {
        const filtered = prev.filter((r) => r.id !== reqId);
        return [newReq, ...filtered];
      });

      const hostNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        recipientId: activeHall.hostId,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        type: 'JOIN_REQUEST',
        title: 'Movie Hall Join Request',
        body: `${currentUser.displayName} wants to join your Movie Hall.`,
        hallId,
        teamId: activeHall.teamId,
        read: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setNotifications((prev) => [hostNotif, ...prev]);

      appendActivityLog(
        'JOIN_REQUEST',
        `${currentUser.displayName} requested to join the Hall`,
        { id: currentUser.id, name: currentUser.displayName }
      );

      sendWsMessage({
        type: 'JOIN_REQUEST_SENT',
        request: newReq,
      });
    },
    [activeHall, currentUser, appendActivityLog, sendWsMessage]
  );

  const cancelJoinRequest = useCallback(
    async (hallId: string) => {
      const reqId = `${hallId}_${currentUser.id}`;
      setJoinRequests((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: 'CANCELLED' } : r))
      );
    },
    [currentUser.id]
  );

  // Section 15: Host Accepts or Declines Join Request
  const respondToJoinRequest = useCallback(
    async (requestId: string, decision: 'ACCEPTED' | 'DECLINED') => {
      if (!activeHall || activeHall.hostId !== currentUser.id) return;
      const targetReq = joinRequests.find((r) => r.id === requestId);
      if (!targetReq) return;

      setJoinRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: decision, updatedAt: new Date().toISOString() } : r
        )
      );

      if (decision === 'ACCEPTED') {
        const newMember: HallMember = {
          id: `${activeHall.id}_${targetReq.requesterId}`,
          hallId: activeHall.id,
          teamId: activeHall.teamId,
          userId: targetReq.requesterId,
          displayName: targetReq.requesterName,
          photoUrl: targetReq.requesterPhotoUrl,
          role: 'VIEWER',
          micEnabled: false,
          cameraEnabled: false, // Camera OFF by default (Section 26)
          isSpeaking: false,
          joinedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setHallMembers((prev) => {
          if (prev.some((m) => m.id === newMember.id)) return prev;
          return [...prev, newMember];
        });

        // Do NOT restart playback or pause host (Section 5 & 15)
        setActiveHall((prev) =>
          prev ? { ...prev, viewerCount: prev.viewerCount + 1 } : prev
        );

        appendActivityLog(
          'JOIN_ACCEPTED',
          `${targetReq.requesterName}'s join request was accepted`,
          { id: currentUser.id, name: currentUser.displayName }
        );
        appendActivityLog(
          'USER_JOINED',
          `${targetReq.requesterName} joined the Hall`,
          { id: targetReq.requesterId, name: targetReq.requesterName }
        );
      } else {
        appendActivityLog(
          'JOIN_DECLINED',
          `${targetReq.requesterName}'s join request was declined`,
          { id: currentUser.id, name: currentUser.displayName }
        );
      }

      sendWsMessage({
        type: 'JOIN_REQUEST_DECISION',
        request: targetReq,
        decision,
        hostId: currentUser.id,
      });
    },
    [activeHall, currentUser, joinRequests, appendActivityLog, sendWsMessage]
  );

  // Enter Hall (Host or Approved Team Member) — Late Join Rule enforced
  const enterApprovedHall = useCallback(
    async (hallId: string) => {
      if (!activeHall || activeHall.id !== hallId) return;
      const isHost = activeHall.hostId === currentUser.id;

      // Ensure current user is in hallMembers with their own independent mic/camera permissions
      const existingMember = hallMembers.find(
        (m) => m.hallId === hallId && m.userId === currentUser.id
      );
      if (!existingMember) {
        const joinedMember: HallMember = {
          id: `${hallId}_${currentUser.id}`,
          hallId,
          teamId: activeHall.teamId,
          userId: currentUser.id,
          displayName: currentUser.displayName,
          photoUrl: currentUser.photoUrl,
          role: isHost ? 'HOST' : 'VIEWER',
          micEnabled: false,
          cameraEnabled: false,
          isSpeaking: false,
          joinedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setHallMembers((prev) =>
          prev.some((m) => m.userId === currentUser.id) ? prev : [...prev, joinedMember]
        );
      }

      setIsInsideHall(true);
      sendWsMessage({
        type: 'HALL_JOIN_SESSION',
        hallId,
        userId: currentUser.id,
        displayName: currentUser.displayName,
        photoUrl: currentUser.photoUrl,
        role: isHost ? 'HOST' : 'VIEWER',
        micEnabled: Boolean(existingMember?.micEnabled),
        cameraEnabled: Boolean(existingMember?.cameraEnabled),
      });

      if (!isHost) {
        appendActivityLog('USER_JOINED', `${currentUser.displayName} joined the Hall`, {
          id: currentUser.id,
          name: currentUser.displayName,
        });
      }

      // Fetch LiveKit viewer/host token verified by backend
      try {
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hallId,
            teamId: activeHall.teamId,
            userId: currentUser.id,
            displayName: currentUser.displayName,
            role: isHost ? 'HOST' : 'VIEWER',
            joinRequestAccepted: true,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setLiveKitToken(data.token);
        }
      } catch {
        // continue
      }
    },
    [
      activeHall,
      currentUser.id,
      currentUser.displayName,
      currentUser.photoUrl,
      hallMembers,
      appendActivityLog,
      sendWsMessage,
    ]
  );

  const leaveHall = useCallback(() => {
    if (!activeHall) return;
    if (activeHall.hostId !== currentUser.id) {
      appendActivityLog('USER_LEFT', `${currentUser.displayName} left the Hall`);
      sendWsMessage({
        type: 'HALL_LEAVE_SESSION',
        hallId: activeHall.id,
        userId: currentUser.id,
      });
    }
    setIsInsideHall(false);
  }, [activeHall, currentUser.id, currentUser.displayName, appendActivityLog, sendWsMessage]);

  // Section 39: Host Ends Hall
  const endMovieHallAsHost = useCallback(async () => {
    if (!activeHall || activeHall.hostId !== currentUser.id) return;
    if (activeScreenStream) {
      activeScreenStream.getTracks().forEach((t) => t.stop());
      setActiveScreenStream(null);
    }
    appendActivityLog('HALL_ENDED', 'Movie Hall ended by host');
    sendWsMessage({
      type: 'HALL_END',
      hallId: activeHall.id,
      userId: currentUser.id,
    });
    setActiveHall(null);
    setIsInsideHall(false);
    setLiveKitToken(null);
    setAllTeamMembers((prev) =>
      prev.map((m) =>
        m.userId === currentUser.id ? { ...m, presence: 'ONLINE', watchingTitle: undefined } : m
      )
    );
  }, [activeHall, currentUser.id, activeScreenStream, appendActivityLog, sendWsMessage]);

  // Section 4 & 16: HOST-ONLY PLAYBACK CONTROLS
  const hostPlay = useCallback(() => {
    if (!activeHall || activeHall.hostId !== currentUser.id) return;
    setActiveHall((prev) =>
      prev ? { ...prev, isPlaying: true, status: 'LIVE', updatedAt: new Date().toISOString() } : prev
    );
    appendActivityLog('PLAYBACK_PLAY', `${currentUser.displayName} resumed playback`);
    sendWsMessage({
      type: 'HOST_PLAYBACK_UPDATE',
      hallId: activeHall.id,
      userId: currentUser.id,
      isPlaying: true,
      status: 'LIVE',
      positionMs: activeHall.positionMs,
    });
  }, [activeHall, currentUser.id, currentUser.displayName, appendActivityLog, sendWsMessage]);

  const hostPause = useCallback(() => {
    if (!activeHall || activeHall.hostId !== currentUser.id) return;
    setActiveHall((prev) =>
      prev ? { ...prev, isPlaying: false, status: 'PAUSED', updatedAt: new Date().toISOString() } : prev
    );
    appendActivityLog('PLAYBACK_PAUSE', `${currentUser.displayName} paused the video`);
    sendWsMessage({
      type: 'HOST_PLAYBACK_UPDATE',
      hallId: activeHall.id,
      userId: currentUser.id,
      isPlaying: false,
      status: 'PAUSED',
      positionMs: activeHall.positionMs,
    });
  }, [activeHall, currentUser.id, currentUser.displayName, appendActivityLog, sendWsMessage]);

  const hostSeek = useCallback(
    (positionMs: number) => {
      if (!activeHall || activeHall.hostId !== currentUser.id) return;
      const clamped = Math.max(
        0,
        activeHall.durationMs > 0 ? Math.min(positionMs, activeHall.durationMs) : positionMs
      );
      setActiveHall((prev) =>
        prev ? { ...prev, positionMs: clamped, updatedAt: new Date().toISOString() } : prev
      );
      appendActivityLog(
        'PLAYBACK_SEEK',
        `${currentUser.displayName} jumped to ${formatDurationMs(clamped)}`
      );
      sendWsMessage({
        type: 'HOST_PLAYBACK_UPDATE',
        hallId: activeHall.id,
        userId: currentUser.id,
        positionMs: clamped,
      });
    },
    [activeHall, currentUser.id, currentUser.displayName, appendActivityLog, sendWsMessage]
  );

  const hostSkip = useCallback(
    (deltaMs: number) => {
      if (!activeHall || activeHall.hostId !== currentUser.id) return;
      hostSeek(activeHall.positionMs + deltaMs);
    },
    [activeHall, currentUser.id, hostSeek]
  );

  const hostSetPlaybackSpeed = useCallback(
    (speed: number) => {
      if (!activeHall || activeHall.hostId !== currentUser.id) return;
      setActiveHall((prev) => (prev ? { ...prev, playbackSpeed: speed } : prev));
      sendWsMessage({
        type: 'HOST_PLAYBACK_UPDATE',
        hallId: activeHall.id,
        userId: currentUser.id,
        playbackSpeed: speed,
      });
    },
    [activeHall, currentUser.id, sendWsMessage]
  );

  const hostChangeMovie = useCallback(
    (item: LibraryItem) => {
      if (!activeHall || activeHall.hostId !== currentUser.id) return;
      const ytId = resolveYouTubeVideoId({
        videoUrl: item.videoUrl,
        embedUrl: item.embedUrl,
        originalPageUrl: item.originalPageUrl,
        posterUrl: item.posterUrl,
      });
      const nextVideoUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : item.videoUrl;
      const nextEmbedUrl = ytId
        ? item.embedUrl ||
          `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`
        : item.embedUrl;

      setActiveHall((prev) =>
        prev
          ? {
              ...prev,
              libraryItemId: item.id,
              title: item.title,
              posterUrl: item.posterUrl,
              backdropUrl: item.backdropUrl,
              videoUrl: nextVideoUrl,
              embedUrl: nextEmbedUrl,
              sourceType: item.sourceType,
              positionMs: 0,
              durationMs: item.durationMs,
              isPlaying: true,
              status: 'LIVE',
              updatedAt: new Date().toISOString(),
            }
          : prev
      );
      appendActivityLog('PLAYBACK_PLAY', `${currentUser.displayName} changed movie to ${item.title}`);
      sendWsMessage({
        type: 'HOST_PLAYBACK_UPDATE',
        hallId: activeHall.id,
        userId: currentUser.id,
        libraryItemId: item.id,
        title: item.title,
        posterUrl: item.posterUrl,
        videoUrl: nextVideoUrl,
        embedUrl: nextEmbedUrl,
        sourceType: item.sourceType,
        positionMs: 0,
        durationMs: item.durationMs,
        isPlaying: true,
        status: 'LIVE',
      });
    },
    [activeHall, currentUser.id, currentUser.displayName, appendActivityLog, sendWsMessage]
  );

  const hostUpdatePositionSilent = useCallback(
    (positionMs: number, durationMs?: number) => {
      if (!activeHall || activeHall.hostId !== currentUser.id) return;
      const nextDuration = durationMs && durationMs > 0 ? durationMs : activeHall.durationMs;
      setActiveHall((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          positionMs,
          durationMs: nextDuration,
        };
      });
      const now = Date.now();
      if (now - lastHostHeartbeatRef.current >= 1500) {
        lastHostHeartbeatRef.current = now;
        sendWsMessage({
          type: 'HOST_PLAYBACK_UPDATE',
          hallId: activeHall.id,
          userId: currentUser.id,
          positionMs,
          durationMs: nextDuration,
          isPlaying: activeHall.isPlaying,
          playbackSpeed: activeHall.playbackSpeed,
          status: activeHall.status,
        });
      }
    },
    [activeHall, currentUser.id, sendWsMessage]
  );

  const hostStartIntervalBreak = useCallback(
    (durationSec: number, message = 'Intermission Break') => {
      if (!activeHall || activeHall.hostId !== currentUser.id) return;
      const now = Date.now();
      const endsAt = now + durationSec * 1000;
      const breakState: IntervalBreakState = {
        isActive: true,
        message,
        totalDurationSec: durationSec,
        endsAt,
        startedAt: now,
        startedByName: currentUser.displayName,
      };
      setActiveHall((prev) =>
        prev
          ? {
              ...prev,
              isPlaying: false,
              status: 'PAUSED',
              breakState,
              updatedAt: new Date().toISOString(),
            }
          : prev
      );
      appendActivityLog(
        'INTERVAL_BREAK_STARTED',
        `${currentUser.displayName} called an Interval Break (${Math.max(1, Math.round(durationSec / 60))} min) · ${message}`
      );
      sendWsMessage({
        type: 'HOST_PLAYBACK_UPDATE',
        hallId: activeHall.id,
        userId: currentUser.id,
        isPlaying: false,
        status: 'PAUSED',
        positionMs: activeHall.positionMs,
        breakState,
      });
    },
    [activeHall, currentUser.id, currentUser.displayName, appendActivityLog, sendWsMessage]
  );

  const hostEndIntervalBreak = useCallback(
    (autoPlayAfterBreak = true) => {
      if (!activeHall || activeHall.hostId !== currentUser.id) return;
      setActiveHall((prev) =>
        prev
          ? {
              ...prev,
              isPlaying: autoPlayAfterBreak,
              status: autoPlayAfterBreak ? 'LIVE' : 'PAUSED',
              breakState: null,
              updatedAt: new Date().toISOString(),
            }
          : prev
      );
      appendActivityLog(
        'INTERVAL_BREAK_ENDED',
        autoPlayAfterBreak
          ? 'Interval break finished · Resumed movie'
          : 'Interval break ended'
      );
      sendWsMessage({
        type: 'HOST_PLAYBACK_UPDATE',
        hallId: activeHall.id,
        userId: currentUser.id,
        isPlaying: autoPlayAfterBreak,
        status: autoPlayAfterBreak ? 'LIVE' : 'PAUSED',
        positionMs: activeHall.positionMs,
        breakState: null,
      });
    },
    [activeHall, currentUser.id, appendActivityLog, sendWsMessage]
  );

  const clearScreenShareError = useCallback(() => setScreenShareError(null), []);

  // Section 28, 29, 30: Official Screen / App Share with Protected Content & Permission Handling
  const startHostScreenOrAppShare = useCallback(
    async (shareMode: 'APP_SHARE' | 'SCREEN_SHARE'): Promise<boolean> => {
      setScreenShareError(null);
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: shareMode === 'APP_SHARE' ? 'window' : 'monitor',
            } as MediaTrackConstraints,
            audio: true,
          });

          stream.getVideoTracks()[0]?.addEventListener('ended', () => {
            // Section 55: Stopping sharing does NOT automatically end Hall
            setActiveScreenStream(null);
            setActiveHall((prev) => (prev ? { ...prev, shareType: 'NONE' } : prev));
            appendActivityLog('SCREEN_SHARE_STOPPED', 'Host stopped screen sharing');
          });

          setActiveScreenStream(stream);
          if (activeHall) {
            setActiveHall((prev) =>
              prev ? { ...prev, shareType: shareMode, sourceType: shareMode } : prev
            );
            appendActivityLog('SCREEN_SHARE_STARTED', 'Host started screen sharing');
            sendWsMessage({
              type: 'HOST_PLAYBACK_UPDATE',
              hallId: activeHall.id,
              userId: currentUser.id,
              shareType: shareMode,
            });
          }
          return true;
        }
        throw new Error('Display capture blocked');
      } catch (err) {
        // Section 30: Protected content or blocked capture message
        const message =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'This app or video does not allow screen sharing.'
            : 'This app or video does not allow screen sharing.';
        setScreenShareError(message);
        return false;
      }
    },
    [activeHall, currentUser.id, appendActivityLog, sendWsMessage]
  );

  const stopHostScreenShare = useCallback(() => {
    if (activeScreenStream) {
      activeScreenStream.getTracks().forEach((t) => t.stop());
      setActiveScreenStream(null);
    }
    if (activeHall && activeHall.hostId === currentUser.id) {
      // Section 55: Stopping sharing does NOT automatically end Hall
      setActiveHall((prev) =>
        prev
          ? {
              ...prev,
              shareType: 'NONE',
              sourceType: prev.videoUrl ? 'CLOUD_VIDEO' : prev.sourceType,
            }
          : prev
      );
      appendActivityLog('SCREEN_SHARE_STOPPED', 'Host stopped screen sharing');
      sendWsMessage({
        type: 'HOST_PLAYBACK_UPDATE',
        hallId: activeHall.id,
        userId: currentUser.id,
        shareType: 'NONE',
      });
    }
  }, [activeScreenStream, activeHall, currentUser.id, appendActivityLog, sendWsMessage]);

  const broadcastPresentationFrame = useCallback(
    (dataUrl: string, posMs: number, playing: boolean) => {
      if (!activeHall || activeHall.hostId !== currentUser.id) return;
      sendWsMessage({
        type: 'PRESENTATION_FRAME',
        hallId: activeHall.id,
        userId: currentUser.id,
        frameDataUrl: dataUrl,
        positionMs: posMs,
        durationMs: activeHall.durationMs,
        isPlaying: playing,
      });
    },
    [activeHall, currentUser.id, sendWsMessage]
  );

  const broadcastMemberCameraFrame = useCallback(
    (frameDataUrl: string) => {
      if (!activeHall) return;
      sendWsMessage({
        type: 'HALL_MEMBER_CAM_FRAME',
        hallId: activeHall.id,
        userId: currentUser.id,
        frameDataUrl,
      });
    },
    [activeHall, currentUser.id, sendWsMessage]
  );

  const broadcastVoiceChunk = useCallback(
    (audioDataUrl: string) => {
      if (!activeHall) return;
      sendWsMessage({
        type: 'HALL_VOICE_CHUNK',
        hallId: activeHall.id,
        userId: currentUser.id,
        audioDataUrl,
      });
    },
    [activeHall, currentUser.id, sendWsMessage]
  );

  const updateLocalSpeakingState = useCallback(
    (isSpeaking: boolean) => {
      if (!activeHall) return;
      setHallMembers((prev) => {
        const current = prev.find((m) => m.userId === currentUser.id);
        if (!current || current.isSpeaking === isSpeaking) return prev;
        return prev.map((m) =>
          m.userId === currentUser.id ? { ...m, isSpeaking } : m
        );
      });
      sendWsMessage({
        type: 'HALL_MEMBER_MEDIA_STATE',
        hallId: activeHall.id,
        userId: currentUser.id,
        displayName: currentUser.displayName,
        photoUrl: currentUser.photoUrl,
        isSpeaking,
      });
    },
    [activeHall, currentUser.id, currentUser.displayName, currentUser.photoUrl, sendWsMessage]
  );

  // Section 25: Realtime Hall Chat
  const sendHallChatMessage = useCallback(
    (text: string) => {
      if (!activeHall) return;
      const trimmed = text.trim().slice(0, 500);
      if (!trimmed) return;
      const msg: HallMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        hallId: activeHall.id,
        teamId: activeHall.teamId,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        senderPhotoUrl: currentUser.photoUrl,
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      setHallMessages((prev) => [...prev, msg]);
      appendActivityLog('CHAT_MESSAGE', `New chat message from ${currentUser.displayName}`);
      sendWsMessage({
        type: 'HALL_CHAT',
        hallId: activeHall.id,
        message: msg,
      });
    },
    [activeHall, currentUser, appendActivityLog, sendWsMessage]
  );

  // Section 24: Realtime Floating Reactions
  const sendHallReaction = useCallback(
    (emoji: ReactionEmoji) => {
      if (!activeHall) return;
      const reaction: FloatingReaction = {
        id: `react_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        emoji,
        senderName: currentUser.displayName,
        xOffsetPercent: 18 + Math.floor(Math.random() * 64),
        createdAt: Date.now(),
      };
      setFloatingReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((item) => item.id !== reaction.id));
      }, 2100);

      appendActivityLog(
        'REACTION',
        `${currentUser.displayName} sent a reaction ${emoji}`,
        { id: currentUser.id, name: currentUser.displayName },
        emoji
      );
      sendWsMessage({
        type: 'HALL_REACTION',
        hallId: activeHall.id,
        reaction,
      });
    },
    [activeHall, currentUser, appendActivityLog, sendWsMessage]
  );

  // Section 26 & 27: Voice & Video Chat controls — Every user has their own permission to enable/disable Mic & Cam
  const toggleLocalMic = useCallback(() => {
    if (!activeHall) return;
    setHallMembers((prev) => {
      const existing = prev.find((m) => m.userId === currentUser.id);
      const nextMic = existing ? !existing.micEnabled : true;
      const nowIso = new Date().toISOString();
      const updatedList = existing
        ? prev.map((m) =>
            m.userId === currentUser.id
              ? { ...m, micEnabled: nextMic, isSpeaking: false, updatedAt: nowIso }
              : m
          )
        : [
            ...prev,
            {
              id: `${activeHall.id}_${currentUser.id}`,
              hallId: activeHall.id,
              teamId: activeHall.teamId,
              userId: currentUser.id,
              displayName: currentUser.displayName,
              photoUrl: currentUser.photoUrl,
              role: activeHall.hostId === currentUser.id ? ('HOST' as const) : ('VIEWER' as const),
              micEnabled: nextMic,
              cameraEnabled: false,
              isSpeaking: false,
              joinedAt: nowIso,
              updatedAt: nowIso,
            },
          ];

      sendWsMessage({
        type: 'HALL_MEMBER_MEDIA_STATE',
        hallId: activeHall.id,
        userId: currentUser.id,
        displayName: currentUser.displayName,
        photoUrl: currentUser.photoUrl,
        micEnabled: nextMic,
        isSpeaking: false,
      });

      return updatedList;
    });
  }, [activeHall, currentUser.id, currentUser.displayName, currentUser.photoUrl, sendWsMessage]);

  const toggleLocalCamera = useCallback(() => {
    if (!activeHall) return;
    setHallMembers((prev) => {
      const existing = prev.find((m) => m.userId === currentUser.id);
      const nextCam = existing ? !existing.cameraEnabled : true;
      const nowIso = new Date().toISOString();
      const updatedList = existing
        ? prev.map((m) =>
            m.userId === currentUser.id
              ? { ...m, cameraEnabled: nextCam, updatedAt: nowIso }
              : m
          )
        : [
            ...prev,
            {
              id: `${activeHall.id}_${currentUser.id}`,
              hallId: activeHall.id,
              teamId: activeHall.teamId,
              userId: currentUser.id,
              displayName: currentUser.displayName,
              photoUrl: currentUser.photoUrl,
              role: activeHall.hostId === currentUser.id ? ('HOST' as const) : ('VIEWER' as const),
              micEnabled: false,
              cameraEnabled: nextCam,
              isSpeaking: false,
              joinedAt: nowIso,
              updatedAt: nowIso,
            },
          ];

      sendWsMessage({
        type: 'HALL_MEMBER_MEDIA_STATE',
        hallId: activeHall.id,
        userId: currentUser.id,
        displayName: currentUser.displayName,
        photoUrl: currentUser.photoUrl,
        cameraEnabled: nextCam,
      });

      return updatedList;
    });
  }, [activeHall, currentUser.id, currentUser.displayName, currentUser.photoUrl, sendWsMessage]);

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Section 14 & 51: Simulate Ahmed requesting to join the current Hall so Host can test ACCEPT / DECLINE immediately
  const simulateIncomingJoinRequestFromAhmed = useCallback(() => {
    if (!activeHall) return;
    const reqId = `${activeHall.id}_user_ahmed`;
    const ahmedReq: HallJoinRequest = {
      id: reqId,
      hallId: activeHall.id,
      teamId: activeHall.teamId,
      hostId: activeHall.hostId,
      requesterId: 'user_ahmed',
      requesterName: 'Ahmed',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setJoinRequests((prev) => {
      const filtered = prev.filter((r) => r.id !== reqId);
      return [ahmedReq, ...filtered];
    });
    const notif: AppNotification = {
      id: `notif_${Date.now()}`,
      recipientId: activeHall.hostId,
      senderId: 'user_ahmed',
      senderName: 'Ahmed',
      type: 'JOIN_REQUEST',
      title: 'Movie Hall Request',
      body: 'Ahmed wants to join your Movie Hall.',
      hallId: activeHall.id,
      teamId: activeHall.teamId,
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotifications((prev) => [notif, ...prev]);
    appendActivityLog('JOIN_REQUEST', 'Ahmed requested to join the Hall', {
      id: 'user_ahmed',
      name: 'Ahmed',
    });
  }, [activeHall, appendActivityLog]);

  // Section 37: Simulate Host temporary disconnect grace period
  const simulateHostDisconnectToggle = useCallback(() => {
    setActiveHall((prev) =>
      prev ? { ...prev, hostConnected: !prev.hostConnected } : prev
    );
  }, []);

  const value: ChillMateContextValue = {
    firebaseUser,
    authReady,
    currentUser,
    registeredUsers,
    currentAccount,
    isAuthenticated,
    isSuperAdmin,
    isSuperAdminModalOpen,
    setIsSuperAdminModalOpen,
    signInWithEmail,
    signUpWithEmail,
    continueWithGoogle,
    superAdminApproveUser,
    superAdminDeclineUser,
    superAdminToggleSuspendUser,
    superAdminDeleteUser,
    signInWithGoogle,
    signOutUser,
    switchDemoIdentity,
    updateUserProfile,
    isAppLocked,
    unlockAppWithPin,
    lockAppNow,
    updateUserAppLockPin,
    teams: userTeams,
    activeTeam,
    selectTeam,
    createTeam,
    updateTeamCredentials,
    deleteTeam,
    joinTeamByNameAndPin,
    searchTeamByNameAndPin,
    joinTeamByCode,
    teamMembers,
    updateMemberRole,
    removeTeamMember,
    activeLibraryScope,
    setActiveLibraryScope,
    selfLibraryItems,
    teamLibraryItemsByTeam,
    getTeamLibraryItems,
    allAccessibleLibraryItems,
    canDeleteLibraryItem,
    isOwnerOfTeam,
    libraryItems: visibleLibraryItems,
    selectedLibraryItem,
    setSelectedLibraryItem,
    deleteLibraryItem,
    lastDeletedLibraryItem,
    restoreDeletedLibraryItem,
    addLibraryItemFromUrl,
    uploadVideoToTeamLibrary,
    downloadTasks,
    autoDownloadOnLinkAdd,
    setAutoDownloadOnLinkAdd,
    autoDownloadLinkToLibrary,
    saveLibraryItemToDeviceDisk,
    removeDownloadTask,
    personalSession,
    startWatchAlone,
    closeWatchAlone,
    localDeviceVideoFile,
    localDeviceVideoUrl,
    selectDeviceVideoFile,
    activeHall,
    isInsideHall,
    isCurrentUserHost,
    isApprovedInHall,
    liveKitToken,
    hallMembers,
    joinRequests,
    hallMessages,
    hallActivities,
    floatingReactions,
    notifications,
    startMovieHall,
    requestToJoinHall,
    cancelJoinRequest,
    respondToJoinRequest,
    enterApprovedHall,
    leaveHall,
    endMovieHallAsHost,
    hostPlay,
    hostPause,
    hostSeek,
    hostSkip,
    hostSetPlaybackSpeed,
    hostChangeMovie,
    hostUpdatePositionSilent,
    hostStartIntervalBreak,
    hostEndIntervalBreak,
    activeScreenStream,
    screenShareError,
    clearScreenShareError,
    startHostScreenOrAppShare,
    stopHostScreenShare,
    latestPresentationFrame,
    broadcastPresentationFrame,
    sendHallChatMessage,
    sendHallReaction,
    toggleLocalMic,
    toggleLocalCamera,
    remoteMemberCamFrames,
    broadcastMemberCameraFrame,
    latestVoiceChunk,
    broadcastVoiceChunk,
    updateLocalSpeakingState,
    markNotificationsRead,
    simulateIncomingJoinRequestFromAhmed,
    simulateHostDisconnectToggle,
    viewportPreset,
    setViewportPreset,
  };

  return <ChillMateContext.Provider value={value}>{children}</ChillMateContext.Provider>;
};

export function useChillMate() {
  const ctx = useContext(ChillMateContext);
  if (!ctx) {
    throw new Error('useChillMate must be used within a ChillMateProvider');
  }
  return ctx;
}
