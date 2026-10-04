export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type PresenceStatus = 'ONLINE' | 'WATCHING' | 'OFFLINE';

export type AccountStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'DECLINED';
export type AuthRegistrationSource = 'GOOGLE' | 'EMAIL';
export type SystemRole = 'SUPER_ADMIN' | 'USER';

export interface RegisteredUserAccount {
  id: string;
  email: string;
  password?: string;
  displayName: string;
  photoUrl?: string;
  systemRole: SystemRole;
  accountStatus: AccountStatus;
  authSource: AuthRegistrationSource;
  appLockPin?: string;
  appLockEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VideoSourceType =
  | 'DEVICE_LOCAL'
  | 'DIRECT_URL'
  | 'CLOUD_VIDEO'
  | 'SCREEN_SHARE'
  | 'APP_SHARE'
  | 'WEBPAGE';

export type HallStatus = 'LIVE' | 'PAUSED' | 'ENDED';

export type ShareType = 'NONE' | 'SCREEN_SHARE' | 'APP_SHARE' | 'DEVICE_STREAM';

export type LibraryCategory = 'MOVIES' | 'VIDEOS' | 'RECENTLY_ADDED' | 'WATCH_AGAIN';

export type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

export type HallActivityEventType =
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'PLAYBACK_PLAY'
  | 'PLAYBACK_PAUSE'
  | 'PLAYBACK_SEEK'
  | 'CHAT_MESSAGE'
  | 'REACTION'
  | 'JOIN_REQUEST'
  | 'JOIN_ACCEPTED'
  | 'JOIN_DECLINED'
  | 'SCREEN_SHARE_STARTED'
  | 'SCREEN_SHARE_STOPPED'
  | 'INTERVAL_BREAK_STARTED'
  | 'INTERVAL_BREAK_ENDED'
  | 'HALL_ENDED';

export type ReactionEmoji = '❤️' | '😂' | '😮' | '🔥' | '👏' | '🥹' | '🍿' | '🎬';

export interface UserProfile {
  id: string;
  email?: string;
  displayName: string;
  photoUrl?: string;
  status: PresenceStatus;
  watchingTitle?: string;
  activeTeamId?: string;
  systemRole?: SystemRole;
  accountStatus?: AccountStatus;
  authSource?: AuthRegistrationSource;
  appLockPin?: string;
  appLockEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  pin: string;
  description?: string;
  imageUrl?: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  displayName: string;
  photoUrl?: string;
  role: TeamRole;
  presence: PresenceStatus;
  watchingTitle?: string;
  joinedAt: string;
  updatedAt: string;
}

export interface DownloadQualityOption {
  id: string;
  label: string;
  ext: 'MP4' | 'HLS' | 'WEBM' | 'M4A';
  sizeBytes: number;
  resolution: string;
  videoUrl?: string;
}

export interface LibraryDownloadTask {
  id: string;
  url: string;
  title: string;
  platform: string;
  posterUrl: string;
  qualityLabel: string;
  format: 'MP4' | 'HLS' | 'WEBM' | 'M4A';
  status: 'SNIFFING' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED';
  progressPct: number;
  speedText: string;
  downloadedBytes: number;
  totalBytes: number;
  libraryItemId?: string;
  createdAt: string;
}

export interface LibraryItem {
  id: string;
  teamId: string;
  libraryScope?: 'SELF' | 'TEAM';
  title: string;
  description?: string;
  posterUrl?: string;
  backdropUrl?: string;
  videoUrl: string;
  embedUrl?: string;
  sourceType: 'DIRECT_URL' | 'CLOUD_VIDEO' | 'DEVICE_LOCAL' | 'WEBPAGE';
  category: LibraryCategory;
  durationMs: number;
  year?: number;
  addedById: string;
  addedByName: string;
  progressMs?: number;
  localFileName?: string;
  localFileSize?: number;
  isDownloaded?: boolean;
  downloadQuality?: string;
  fileSizeBytes?: number;
  originalPageUrl?: string;
  platformName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntervalBreakState {
  isActive: boolean;
  message?: string;
  totalDurationSec: number;
  endsAt: number; // unix timestamp in ms
  startedAt: number;
  startedByName: string;
}

export interface MovieHall {
  id: string;
  teamId: string;
  hostId: string;
  hostName: string;
  libraryItemId?: string;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  videoUrl?: string;
  embedUrl?: string;
  sourceType: VideoSourceType;
  status: HallStatus;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  playbackSpeed: number;
  viewerCount: number;
  shareType: ShareType;
  hostConnected: boolean;
  localFileName?: string;
  breakState?: IntervalBreakState | null;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
}

export interface HallMember {
  id: string;
  hallId: string;
  teamId: string;
  userId: string;
  displayName: string;
  photoUrl?: string;
  role: 'HOST' | 'VIEWER';
  micEnabled: boolean;
  cameraEnabled: boolean;
  isSpeaking: boolean;
  joinedAt: string;
  updatedAt: string;
}

export interface HallJoinRequest {
  id: string;
  hallId: string;
  teamId: string;
  hostId: string;
  requesterId: string;
  requesterName: string;
  requesterPhotoUrl?: string;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HallMessage {
  id: string;
  hallId: string;
  teamId: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl?: string;
  text: string;
  createdAt: string;
}

export interface HallActivity {
  id: string;
  hallId: string;
  teamId: string;
  actorId: string;
  actorName: string;
  eventType: HallActivityEventType;
  message: string;
  reactionEmoji?: ReactionEmoji;
  createdAt: string;
}

export interface FloatingReaction {
  id: string;
  emoji: ReactionEmoji;
  senderName: string;
  xOffsetPercent: number;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  type: 'JOIN_REQUEST' | 'REQUEST_ACCEPTED' | 'REQUEST_DECLINED' | 'HALL_STARTED' | 'TEAM_INVITE';
  title: string;
  body: string;
  hallId?: string;
  teamId?: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ActiveTab = 'HOME' | 'LIBRARY' | 'TEAM' | 'PROFILE';

export type ViewportPreset = 'AUTO' | 'PHONE_PORTRAIT' | 'TABLET_PORTRAIT' | 'TABLET_LANDSCAPE';
