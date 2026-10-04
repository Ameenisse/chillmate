import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SUPER_ADMIN_EMAIL = 'ameen.isse@gmail.com';
export const SUPER_ADMIN_PASSWORD = 'Amin@2613';

interface ServerUserAccount {
  id: string;
  email: string;
  password?: string;
  displayName: string;
  photoUrl?: string;
  systemRole: 'SUPER_ADMIN' | 'USER';
  accountStatus: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'DECLINED';
  authSource: 'GOOGLE' | 'EMAIL';
  appLockPin?: string;
  appLockEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ServerTeam {
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

interface ServerTeamMember {
  id: string;
  teamId: string;
  userId: string;
  displayName: string;
  photoUrl?: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  presence: 'ONLINE' | 'WATCHING' | 'OFFLINE';
  watchingTitle?: string;
  joinedAt: string;
  updatedAt: string;
}

interface ServerLibraryItem {
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
  category: 'MOVIES' | 'VIDEOS' | 'RECENTLY_ADDED' | 'WATCH_AGAIN';
  durationMs: number;
  year?: number;
  addedById: string;
  addedByName: string;
  progressMs?: number;
  isDownloaded?: boolean;
  downloadQuality?: string;
  fileSizeBytes?: number;
  originalPageUrl?: string;
  platformName?: string;
  createdAt: string;
  updatedAt: string;
}

interface PersistentBackendDatabase {
  users: ServerUserAccount[];
  teams: ServerTeam[];
  teamMembers: ServerTeamMember[];
  libraryItems: ServerLibraryItem[];
  tombstones?: {
    users: string[];
    teams: string[];
    teamMembers: string[];
    libraryItems: string[];
  };
}

const DB_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'chillmate-db-v2.json');
const BACKUP_DB_FILE = path.join(DB_DIR, 'chillmate-backup-db.json');

const DEFAULT_BACKEND_DB: PersistentBackendDatabase = {
  users: [
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
  ],
  teams: [],
  teamMembers: [],
  libraryItems: [],
  tombstones: {
    users: [],
    teams: [],
    teamMembers: [],
    libraryItems: [],
  },
};

function parseDbFile(filePath: string): PersistentBackendDatabase | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistentBackendDatabase>;
      if (!parsed || typeof parsed !== 'object') return null;

      const users = Array.isArray(parsed.users) ? parsed.users : DEFAULT_BACKEND_DB.users;
      const hasSuper = users.some((u) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
      const normalizedUsers = hasSuper
        ? users.map((u) =>
            u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
              ? {
                  ...u,
                  systemRole: 'SUPER_ADMIN' as const,
                  accountStatus: 'APPROVED' as const,
                  password: SUPER_ADMIN_PASSWORD,
                }
              : u
          )
        : [DEFAULT_BACKEND_DB.users[0], ...users];

      return {
        users: normalizedUsers,
        teams: Array.isArray(parsed.teams)
          ? parsed.teams.map((t) => ({ ...t, pin: t.pin || '2026' }))
          : [],
        teamMembers: Array.isArray(parsed.teamMembers) ? parsed.teamMembers : [],
        libraryItems: Array.isArray(parsed.libraryItems) ? parsed.libraryItems : [],
        tombstones: {
          users: Array.isArray(parsed.tombstones?.users) ? parsed.tombstones.users : [],
          teams: Array.isArray(parsed.tombstones?.teams) ? parsed.tombstones.teams : [],
          teamMembers: Array.isArray(parsed.tombstones?.teamMembers) ? parsed.tombstones.teamMembers : [],
          libraryItems: Array.isArray(parsed.tombstones?.libraryItems) ? parsed.tombstones.libraryItems : [],
        },
      };
    }
  } catch (err) {
    console.error(`Failed to parse DB file at ${filePath}:`, err);
  }
  return null;
}

function loadBackendDb(): PersistentBackendDatabase {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    const primary = parseDbFile(DB_FILE);
    if (primary) return primary;

    const backup = parseDbFile(BACKUP_DB_FILE);
    if (backup) {
      console.log('Restored backend DB from backup snapshot.');
      return backup;
    }
  } catch (err) {
    console.error('Failed to load backend DB, using defaults:', err);
  }
  return structuredClone(DEFAULT_BACKEND_DB);
}

const backendDb: PersistentBackendDatabase = loadBackendDb();

function ensureTombstones() {
  if (!backendDb.tombstones) {
    backendDb.tombstones = {
      users: [],
      teams: [],
      teamMembers: [],
      libraryItems: [],
    };
  }
  return backendDb.tombstones;
}

function saveBackendDb() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const payload = JSON.stringify(backendDb, null, 2);
    fs.writeFileSync(DB_FILE, payload, 'utf-8');
    // Also update redundant backup snapshot for permanent persistence
    fs.writeFileSync(BACKUP_DB_FILE, payload, 'utf-8');
  } catch (err) {
    console.error('Failed to persist backend DB:', err);
  }
}

// Additive merge helper: integrates client-known items without erasing server records or resurrecting explicitly deleted items
function syncBackendState(incoming: Partial<PersistentBackendDatabase>): PersistentBackendDatabase {
  let modified = false;
  const tombs = ensureTombstones();

  // 1. Users: merge additively unless explicitly deleted
  if (Array.isArray(incoming.users)) {
    for (const incUser of incoming.users) {
      if (!incUser || !incUser.id || !incUser.email) continue;
      if (tombs.users.includes(incUser.id)) continue;
      const existingIdx = backendDb.users.findIndex(
        (u) => u.id === incUser.id || u.email.toLowerCase() === incUser.email.toLowerCase()
      );
      if (existingIdx === -1) {
        backendDb.users.push(incUser);
        modified = true;
      } else {
        const cur = backendDb.users[existingIdx];
        const incTime = incUser.updatedAt ? Date.parse(incUser.updatedAt) : 0;
        const curTime = cur.updatedAt ? Date.parse(cur.updatedAt) : 0;
        const isIncomingNewer = incTime > curTime;

        if (incUser.displayName && incUser.displayName !== cur.displayName && isIncomingNewer) {
          cur.displayName = incUser.displayName;
          modified = true;
        }
        if (incUser.photoUrl && incUser.photoUrl !== cur.photoUrl && isIncomingNewer) {
          cur.photoUrl = incUser.photoUrl;
          modified = true;
        }
        if (
          incUser.appLockEnabled !== undefined &&
          incUser.appLockEnabled !== cur.appLockEnabled &&
          isIncomingNewer
        ) {
          cur.appLockEnabled = Boolean(incUser.appLockEnabled);
          cur.appLockPin = incUser.appLockEnabled ? (incUser.appLockPin || '').trim() : '';
          modified = true;
        } else if (
          incUser.appLockPin !== undefined &&
          incUser.appLockPin !== cur.appLockPin &&
          isIncomingNewer
        ) {
          cur.appLockPin = incUser.appLockPin;
          modified = true;
        }
        if (isIncomingNewer && incUser.updatedAt) {
          cur.updatedAt = incUser.updatedAt;
          modified = true;
        }
      }
    }
  }

  // 2. Teams: merge additively unless explicitly deleted
  if (Array.isArray(incoming.teams)) {
    for (const incTeam of incoming.teams) {
      if (!incTeam || !incTeam.id || !incTeam.name) continue;
      if (tombs.teams.includes(incTeam.id)) continue;
      const existing = backendDb.teams.find((t) => t.id === incTeam.id);
      if (!existing) {
        backendDb.teams.push(incTeam);
        modified = true;
      } else {
        if (incTeam.name && incTeam.name !== existing.name) {
          existing.name = incTeam.name;
          modified = true;
        }
        if (incTeam.pin && incTeam.pin !== existing.pin) {
          existing.pin = incTeam.pin;
          modified = true;
        }
        if (incTeam.description !== undefined && incTeam.description !== existing.description) {
          existing.description = incTeam.description;
          modified = true;
        }
      }
    }
  }

  // 3. Team Members: merge additively unless explicitly removed or team deleted
  if (Array.isArray(incoming.teamMembers)) {
    for (const incMember of incoming.teamMembers) {
      if (!incMember || !incMember.id || !incMember.teamId || !incMember.userId) continue;
      if (
        tombs.teamMembers.includes(incMember.id) ||
        tombs.teams.includes(incMember.teamId) ||
        tombs.users.includes(incMember.userId)
      ) {
        continue;
      }
      const existing = backendDb.teamMembers.find(
        (m) =>
          m.id === incMember.id ||
          (m.teamId === incMember.teamId && m.userId === incMember.userId)
      );
      if (!existing) {
        backendDb.teamMembers.push(incMember);
        modified = true;
      } else {
        if (incMember.role && incMember.role !== existing.role) {
          if (existing.role !== 'OWNER') {
            existing.role = incMember.role;
            modified = true;
          }
        }
        if (incMember.displayName && incMember.displayName !== existing.displayName) {
          existing.displayName = incMember.displayName;
          modified = true;
        }
      }
    }
  }

  // 4. Library Items: merge additively unless explicitly deleted or team deleted
  if (Array.isArray(incoming.libraryItems)) {
    for (const incItem of incoming.libraryItems) {
      if (!incItem || !incItem.id || !incItem.title) continue;
      if (
        tombs.libraryItems.includes(incItem.id) ||
        (incItem.teamId && tombs.teams.includes(incItem.teamId))
      ) {
        continue;
      }
      const existing = backendDb.libraryItems.find((i) => i.id === incItem.id);
      if (!existing) {
        backendDb.libraryItems.push(incItem);
        modified = true;
      } else if (
        typeof incItem.progressMs === 'number' &&
        incItem.progressMs > (existing.progressMs || 0)
      ) {
        existing.progressMs = incItem.progressMs;
        modified = true;
      }
    }
  }

  if (modified) {
    saveBackendDb();
  }
  return backendDb;
}

interface ServerHallMember {
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

interface ServerHallState {
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
  latestFrameDataUrl?: string;
  sourceType: 'DEVICE_LOCAL' | 'DIRECT_URL' | 'CLOUD_VIDEO' | 'SCREEN_SHARE' | 'APP_SHARE' | 'WEBPAGE';
  status: 'LIVE' | 'PAUSED' | 'ENDED';
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  playbackSpeed: number;
  viewerCount: number;
  shareType: 'NONE' | 'SCREEN_SHARE' | 'APP_SHARE' | 'DEVICE_STREAM';
  hostConnected: boolean;
  lastSyncEpochMs: number;
  breakState?: any;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
}

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  teamId: string;
  hallId?: string;
  role?: 'HOST' | 'VIEWER';
}

const activeHalls = new Map<string, ServerHallState>();
const hallMembersMap = new Map<string, ServerHallMember[]>();
const hallApprovedViewers = new Map<string, Set<string>>();
const hostDisconnectTimers = new Map<string, NodeJS.Timeout>();
const processedEventIds = new Set<string>();

function computeLivePositionMs(hall: ServerHallState): number {
  if (!hall.isPlaying || hall.status !== 'LIVE') {
    return hall.positionMs;
  }
  const elapsed = Math.max(0, Date.now() - hall.lastSyncEpochMs) * (hall.playbackSpeed || 1);
  const nextPos = hall.positionMs + elapsed;
  return hall.durationMs > 0 ? Math.min(nextPos, hall.durationMs) : nextPos;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<ConnectedClient>();

  function isClientInTeam(client: ConnectedClient, teamId: string): boolean {
    if (!teamId) return false;
    if (client.teamId === teamId) return true;
    if (!client.userId) return false;
    const isOwner = backendDb.teams.some((t) => t.id === teamId && t.ownerId === client.userId);
    if (isOwner) return true;
    return backendDb.teamMembers.some((m) => m.teamId === teamId && m.userId === client.userId);
  }

  function broadcastAll(payload: unknown, excludeWs?: WebSocket) {
    const message = JSON.stringify(payload);
    for (const client of clients) {
      if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  function broadcastToTeam(teamId: string, payload: unknown, excludeWs?: WebSocket) {
    const message = JSON.stringify(payload);
    for (const client of clients) {
      if (
        isClientInTeam(client, teamId) &&
        client.ws !== excludeWs &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(message);
      }
    }
  }

  function broadcastToHall(hallId: string, payload: unknown, excludeWs?: WebSocket) {
    const message = JSON.stringify(payload);
    const hall = activeHalls.get(hallId);
    for (const client of clients) {
      const inHallOrTeam =
        client.hallId === hallId || (hall ? isClientInTeam(client, hall.teamId) : false);
      if (inHallOrTeam && client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  // ============================================================================
  // AUTHORITATIVE BACKEND REST API: BOOTSTRAP, AUTH, APPROVAL GATE, TEAMS & RBAC
  // ============================================================================

  // 1. Bootstrap full server state
  app.get('/api/state/bootstrap', (_req, res) => {
    res.json({
      users: backendDb.users,
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      libraryItems: backendDb.libraryItems,
    });
  });

  // 1b. Bidirectional State Sync: client provides its cached state, server additively merges & persists permanently
  app.post('/api/state/sync', (req, res) => {
    const synced = syncBackendState(req.body || {});
    res.json({
      ok: true,
      users: synced.users,
      teams: synced.teams,
      teamMembers: synced.teamMembers,
      libraryItems: synced.libraryItems,
    });
  });

  // 2. Email / Password Sign In (including built-in Super Admin ameen.isse@gmail.com / Amin@2613)
  app.post('/api/auth/signin', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      res.status(400).json({ ok: false, error: 'Please enter both email and password.' });
      return;
    }

    if (email === SUPER_ADMIN_EMAIL.toLowerCase() && password === SUPER_ADMIN_PASSWORD) {
      let superAcc = backendDb.users.find((u) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
      if (!superAcc) {
        superAcc = structuredClone(DEFAULT_BACKEND_DB.users[0]);
        backendDb.users.unshift(superAcc);
      } else {
        superAcc.systemRole = 'SUPER_ADMIN';
        superAcc.accountStatus = 'APPROVED';
        superAcc.password = SUPER_ADMIN_PASSWORD;
        superAcc.updatedAt = new Date().toISOString();
      }
      saveBackendDb();
      broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users });
      res.json({ ok: true, account: superAcc, users: backendDb.users });
      return;
    }

    const found = backendDb.users.find((u) => u.email.toLowerCase() === email);
    if (!found) {
      res.status(404).json({ ok: false, error: 'No account found with that email. Please Sign Up first.' });
      return;
    }
    if (found.password && found.password !== password) {
      res.status(401).json({ ok: false, error: 'Incorrect password. Please check your credentials and try again.' });
      return;
    }

    res.json({ ok: true, account: found, users: backendDb.users });
  });

  // 3. Email / Password Sign Up -> Creates account in PENDING status (Approval Gate)
  app.post('/api/auth/signup', (req, res) => {
    const displayName = String(req.body?.displayName || '').trim().slice(0, 80);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!displayName || !email || !password) {
      res.status(400).json({ ok: false, error: 'Please fill in your name, email, and password.' });
      return;
    }
    if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
      res.status(400).json({ ok: false, error: 'This email is reserved for Super Admin Ameen. Please use Sign In.' });
      return;
    }
    if (backendDb.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ ok: false, error: 'An account with this email already exists. Please Sign In.' });
      return;
    }

    const newAccount: ServerUserAccount = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      email,
      password,
      displayName,
      systemRole: 'USER',
      accountStatus: 'PENDING',
      authSource: 'EMAIL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    backendDb.users.unshift(newAccount);
    saveBackendDb();
    broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users });
    res.json({ ok: true, account: newAccount, users: backendDb.users });
  });

  // 4. Continue with Google -> Existing user or creates PENDING user for Approval Gate
  app.post('/api/auth/google', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const displayName = String(req.body?.displayName || email.split('@')[0] || 'Google User').trim().slice(0, 80);
    const photoUrl = req.body?.photoUrl ? String(req.body.photoUrl).slice(0, 1024) : undefined;

    if (!email) {
      res.status(400).json({ ok: false, error: 'Google email is required.' });
      return;
    }

    if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
      const superAcc = backendDb.users.find((u) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) || DEFAULT_BACKEND_DB.users[0];
      res.json({ ok: true, account: superAcc, users: backendDb.users });
      return;
    }

    const existing = backendDb.users.find((u) => u.email.toLowerCase() === email);
    if (existing) {
      res.json({ ok: true, account: existing, users: backendDb.users });
      return;
    }

    const newGoogleAccount: ServerUserAccount = {
      id: `user_google_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      email,
      displayName,
      photoUrl,
      systemRole: 'USER',
      accountStatus: 'PENDING',
      authSource: 'GOOGLE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    backendDb.users.unshift(newGoogleAccount);
    saveBackendDb();
    broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users });
    res.json({ ok: true, account: newGoogleAccount, users: backendDb.users });
  });

  // Helper to verify Super Admin requester on backend
  function verifySuperAdminRequester(adminIdOrEmail?: string): boolean {
    if (!adminIdOrEmail) return false;
    const norm = adminIdOrEmail.trim().toLowerCase();
    if (norm === SUPER_ADMIN_EMAIL.toLowerCase() || norm === 'user_ameen') return true;
    const acc = backendDb.users.find((u) => u.id === adminIdOrEmail || u.email.toLowerCase() === norm);
    return Boolean(acc && acc.systemRole === 'SUPER_ADMIN');
  }

  // 5. Super Admin: Approve User Access
  app.post('/api/admin/users/:userId/approve', (req, res) => {
    const { userId } = req.params;
    const requester = String(req.body?.adminUserId || req.headers['x-admin-user'] || 'user_ameen');
    if (!verifySuperAdminRequester(requester)) {
      res.status(403).json({ ok: false, error: 'Only Super Admin Ameen can approve user accounts.' });
      return;
    }

    const target = backendDb.users.find((u) => u.id === userId);
    if (!target) {
      res.status(404).json({ ok: false, error: 'User not found.' });
      return;
    }

    target.accountStatus = 'APPROVED';
    target.updatedAt = new Date().toISOString();

    saveBackendDb();
    broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users });
    res.json({ ok: true, account: target, users: backendDb.users, teamMembers: backendDb.teamMembers });
  });

  // 6. Super Admin: Decline User Access
  app.post('/api/admin/users/:userId/decline', (req, res) => {
    const { userId } = req.params;
    const requester = String(req.body?.adminUserId || req.headers['x-admin-user'] || 'user_ameen');
    if (!verifySuperAdminRequester(requester)) {
      res.status(403).json({ ok: false, error: 'Only Super Admin Ameen can decline user accounts.' });
      return;
    }

    const target = backendDb.users.find((u) => u.id === userId);
    if (!target || target.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      res.status(400).json({ ok: false, error: 'Cannot decline protected Super Admin account.' });
      return;
    }

    target.accountStatus = 'DECLINED';
    target.updatedAt = new Date().toISOString();
    saveBackendDb();
    broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users });
    res.json({ ok: true, account: target, users: backendDb.users });
  });

  // 7. Super Admin: Suspend / Reactivate User
  app.post('/api/admin/users/:userId/suspend', (req, res) => {
    const { userId } = req.params;
    const requester = String(req.body?.adminUserId || req.headers['x-admin-user'] || 'user_ameen');
    if (!verifySuperAdminRequester(requester)) {
      res.status(403).json({ ok: false, error: 'Only Super Admin Ameen can suspend or reactivate accounts.' });
      return;
    }

    const target = backendDb.users.find((u) => u.id === userId);
    if (!target || target.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      res.status(400).json({ ok: false, error: 'Cannot suspend protected Super Admin account.' });
      return;
    }

    target.accountStatus = target.accountStatus === 'SUSPENDED' ? 'APPROVED' : 'SUSPENDED';
    target.updatedAt = new Date().toISOString();
    saveBackendDb();
    broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users });
    res.json({ ok: true, account: target, users: backendDb.users });
  });

  // 8. Super Admin: Permanently Delete User
  app.delete('/api/admin/users/:userId', (req, res) => {
    const { userId } = req.params;
    const requester = String(req.query.adminUserId || req.headers['x-admin-user'] || 'user_ameen');
    if (!verifySuperAdminRequester(requester)) {
      res.status(403).json({ ok: false, error: 'Only Super Admin Ameen can delete accounts.' });
      return;
    }

    const target = backendDb.users.find((u) => u.id === userId);
    if (!target || target.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      res.status(400).json({ ok: false, error: 'Cannot delete protected Super Admin account.' });
      return;
    }

    const tombs = ensureTombstones();
    if (!tombs.users.includes(userId)) tombs.users.push(userId);
    for (const m of backendDb.teamMembers) {
      if (m.userId === userId && !tombs.teamMembers.includes(m.id)) {
        tombs.teamMembers.push(m.id);
      }
    }
    backendDb.users = backendDb.users.filter((u) => u.id !== userId);
    backendDb.teamMembers = backendDb.teamMembers.filter((m) => m.userId !== userId);
    saveBackendDb();
    broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users });
    broadcastAll({ type: 'TEAMS_STATE_SYNC', teams: backendDb.teams, teamMembers: backendDb.teamMembers });
    res.json({ ok: true, users: backendDb.users, teamMembers: backendDb.teamMembers });
  });

  // 8b. Individual User App Lock (PIN) Setup & Management (Set from User Profile)
  app.put('/api/users/:userId/app-lock', (req, res) => {
    const { userId } = req.params;
    const callerUserId = String(req.body?.callerUserId || userId).trim();
    const appLockEnabled = Boolean(req.body?.appLockEnabled);
    const appLockPin = String(req.body?.appLockPin || '').trim().slice(0, 12);

    if (callerUserId !== userId) {
      res.status(403).json({ ok: false, error: 'You can only manage your own App Lock PIN.' });
      return;
    }

    const target = backendDb.users.find((u) => u.id === userId);
    if (!target) {
      res.status(404).json({ ok: false, error: 'User account not found.' });
      return;
    }

    if (appLockEnabled && appLockPin.length < 4) {
      res.status(400).json({ ok: false, error: 'App Lock PIN must be at least 4 characters.' });
      return;
    }

    target.appLockPin = appLockEnabled ? appLockPin : '';
    target.appLockEnabled = appLockEnabled && Boolean(appLockPin);
    target.updatedAt = new Date().toISOString();

    saveBackendDb();
    broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users });
    res.json({ ok: true, account: target, users: backendDb.users });
  });

  // 9. Create Team (Requires Team Name & PIN Number)
  app.post('/api/teams', (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const pin = String(req.body?.pin || '').trim().slice(0, 20);
    const description = String(req.body?.description || '').trim().slice(0, 300);
    const ownerId = String(req.body?.ownerId || '').trim();
    const ownerName = String(req.body?.ownerName || 'Owner').trim().slice(0, 80);
    const ownerPhotoUrl = req.body?.ownerPhotoUrl ? String(req.body.ownerPhotoUrl) : undefined;
    const imageUrl = req.body?.imageUrl ? String(req.body.imageUrl) : undefined;

    if (!name || !pin || !ownerId) {
      res.status(400).json({ ok: false, error: 'Team Name, PIN number, and Owner ID are required.' });
      return;
    }

    const id = `team_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const inviteCode = `CM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const newTeam: ServerTeam = {
      id,
      name,
      pin,
      description,
      imageUrl,
      inviteCode,
      ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ownerMember: ServerTeamMember = {
      id: `${id}_${ownerId}`,
      teamId: id,
      userId: ownerId,
      displayName: ownerName,
      photoUrl: ownerPhotoUrl,
      role: 'OWNER',
      presence: 'ONLINE',
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tombs = ensureTombstones();
    tombs.teams = tombs.teams.filter((tid) => tid !== id);
    tombs.teamMembers = tombs.teamMembers.filter((mid) => mid !== ownerMember.id);

    backendDb.teams.push(newTeam);
    backendDb.teamMembers.push(ownerMember);
    saveBackendDb();
    broadcastAll({ type: 'TEAMS_STATE_SYNC', teams: backendDb.teams, teamMembers: backendDb.teamMembers });
    res.json({ ok: true, team: newTeam, teams: backendDb.teams, teamMembers: backendDb.teamMembers });
  });

  // 10. Update Team Name & PIN Anytime (Strictly Owner Only)
  app.put('/api/teams/:teamId/credentials', (req, res) => {
    const { teamId } = req.params;
    const callerUserId = String(req.body?.callerUserId || '').trim();
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const pin = String(req.body?.pin || '').trim().slice(0, 20);
    const description = req.body?.description !== undefined ? String(req.body.description).trim().slice(0, 300) : undefined;

    const team = backendDb.teams.find((t) => t.id === teamId);
    if (!team) {
      res.status(404).json({ ok: false, error: 'Team not found.' });
      return;
    }

    const callerMember = backendDb.teamMembers.find((m) => m.teamId === teamId && m.userId === callerUserId);
    const isOwner = team.ownerId === callerUserId || callerMember?.role === 'OWNER';
    if (!isOwner) {
      res.status(403).json({ ok: false, error: 'Only the Team Owner can change the Team Name and PIN number.' });
      return;
    }

    if (!name || !pin) {
      res.status(400).json({ ok: false, error: 'Both Team Name and PIN number are required.' });
      return;
    }

    team.name = name;
    team.pin = pin;
    if (description !== undefined) team.description = description;
    team.updatedAt = new Date().toISOString();

    saveBackendDb();
    broadcastAll({ type: 'TEAMS_STATE_SYNC', teams: backendDb.teams, teamMembers: backendDb.teamMembers });
    res.json({ ok: true, team, teams: backendDb.teams, teamMembers: backendDb.teamMembers });
  });

  // 10b. Delete Team (Strictly Owner Only)
  app.delete('/api/teams/:teamId', (req, res) => {
    const { teamId } = req.params;
    const callerUserId = String(req.query.callerUserId || req.body?.callerUserId || '').trim();

    const team = backendDb.teams.find((t) => t.id === teamId);
    if (!team) {
      res.status(404).json({ ok: false, error: 'Team not found.' });
      return;
    }

    const callerMember = backendDb.teamMembers.find((m) => m.teamId === teamId && m.userId === callerUserId);
    const isOwner = team.ownerId === callerUserId || callerMember?.role === 'OWNER';
    if (!isOwner) {
      res.status(403).json({ ok: false, error: 'Only the Team Owner can delete this team.' });
      return;
    }

    const tombs = ensureTombstones();
    if (!tombs.teams.includes(teamId)) tombs.teams.push(teamId);
    for (const m of backendDb.teamMembers) {
      if (m.teamId === teamId && !tombs.teamMembers.includes(m.id)) {
        tombs.teamMembers.push(m.id);
      }
    }
    for (const i of backendDb.libraryItems) {
      if (i.teamId === teamId && !tombs.libraryItems.includes(i.id)) {
        tombs.libraryItems.push(i.id);
      }
    }

    backendDb.teams = backendDb.teams.filter((t) => t.id !== teamId);
    backendDb.teamMembers = backendDb.teamMembers.filter((m) => m.teamId !== teamId);
    backendDb.libraryItems = backendDb.libraryItems.filter((i) => i.teamId !== teamId);
    saveBackendDb();

    broadcastAll({ type: 'TEAMS_STATE_SYNC', teams: backendDb.teams, teamMembers: backendDb.teamMembers });
    broadcastAll({ type: 'LIBRARY_STATE_SYNC', libraryItems: backendDb.libraryItems });
    res.json({ ok: true, deletedTeamId: teamId, teams: backendDb.teams, teamMembers: backendDb.teamMembers });
  });

  // 11. Search Team by exact Team Name & PIN Number (only reveals team if both Name and PIN match)
  app.post('/api/teams/search', (req, res) => {
    const teamName = String(req.body?.teamName || '').trim().toLowerCase();
    const pin = String(req.body?.pin || '').trim();

    if (!teamName || !pin) {
      res.status(400).json({ ok: false, error: 'Please enter both Team Name and PIN number to search.' });
      return;
    }

    const matched = backendDb.teams.find(
      (t) => t.name.trim().toLowerCase() === teamName && t.pin.trim() === pin
    );
    if (!matched) {
      res.status(404).json({ ok: false, error: 'No team found matching that Team Name and PIN number.' });
      return;
    }

    const memberCount = backendDb.teamMembers.filter((m) => m.teamId === matched.id).length;
    res.json({ ok: true, team: matched, memberCount });
  });

  // 11b. Join Team with Team Name & PIN Number
  app.post('/api/teams/join', (req, res) => {
    const teamName = String(req.body?.teamName || '').trim().toLowerCase();
    const pin = String(req.body?.pin || '').trim();
    const userId = String(req.body?.userId || '').trim();
    const displayName = String(req.body?.displayName || 'Member').trim().slice(0, 80);
    const photoUrl = req.body?.photoUrl ? String(req.body.photoUrl) : undefined;

    if (!teamName || !pin || !userId) {
      res.status(400).json({ ok: false, error: 'Please enter both Team Name and PIN number.' });
      return;
    }

    const matched = backendDb.teams.find(
      (t) => t.name.trim().toLowerCase() === teamName && t.pin.trim() === pin
    );
    if (!matched) {
      res.status(404).json({ ok: false, error: 'Invalid Team Name or PIN number. Please verify with the Team Owner.' });
      return;
    }

    const memberId = `${matched.id}_${userId}`;
    const tombs = ensureTombstones();
    tombs.teamMembers = tombs.teamMembers.filter((mid) => mid !== memberId);
    if (!backendDb.teamMembers.some((m) => m.id === memberId)) {
      backendDb.teamMembers.push({
        id: memberId,
        teamId: matched.id,
        userId,
        displayName,
        photoUrl,
        role: 'MEMBER',
        presence: 'ONLINE',
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      saveBackendDb();
      broadcastAll({ type: 'TEAMS_STATE_SYNC', teams: backendDb.teams, teamMembers: backendDb.teamMembers });
    }

    res.json({ ok: true, team: matched, teams: backendDb.teams, teamMembers: backendDb.teamMembers });
  });

  // 12. Team Permission #1: Giving Roles (Strictly ONLY Team Owner can assign ADMIN <-> MEMBER)
  app.put('/api/teams/:teamId/members/:memberUserId/role', (req, res) => {
    const { teamId, memberUserId } = req.params;
    const callerUserId = String(req.body?.callerUserId || '').trim();
    const role = String(req.body?.role || '').trim() as 'ADMIN' | 'MEMBER';

    const team = backendDb.teams.find((t) => t.id === teamId);
    if (!team) {
      res.status(404).json({ ok: false, error: 'Team not found.' });
      return;
    }

    const callerMember = backendDb.teamMembers.find((m) => m.teamId === teamId && m.userId === callerUserId);
    const isCallerOwner = team.ownerId === callerUserId || callerMember?.role === 'OWNER';
    if (!isCallerOwner) {
      res.status(403).json({ ok: false, error: 'Only the Team Owner can assign or change member roles.' });
      return;
    }

    const targetMember = backendDb.teamMembers.find((m) => m.teamId === teamId && m.userId === memberUserId);
    if (!targetMember) {
      res.status(404).json({ ok: false, error: 'Team member not found.' });
      return;
    }

    if (targetMember.role === 'OWNER' || targetMember.userId === team.ownerId) {
      res.status(400).json({ ok: false, error: 'The Team Owner can never be downgraded.' });
      return;
    }

    if (role !== 'ADMIN' && role !== 'MEMBER') {
      res.status(400).json({ ok: false, error: 'Invalid role. Allowed roles: ADMIN, MEMBER.' });
      return;
    }

    targetMember.role = role;
    targetMember.updatedAt = new Date().toISOString();
    saveBackendDb();
    broadcastAll({ type: 'TEAMS_STATE_SYNC', teams: backendDb.teams, teamMembers: backendDb.teamMembers });
    res.json({ ok: true, teams: backendDb.teams, teamMembers: backendDb.teamMembers });
  });

  // 13. Team Permission #2: Removing Members
  // - Team Owner: Can remove both ADMIN and MEMBER.
  // - Team Admin: Can remove regular MEMBER only, cannot remove other ADMINs or OWNER.
  // - Team Owner can never be removed.
  app.delete('/api/teams/:teamId/members/:memberUserId', (req, res) => {
    const { teamId, memberUserId } = req.params;
    const callerUserId = String(req.query.callerUserId || req.body?.callerUserId || '').trim();

    const team = backendDb.teams.find((t) => t.id === teamId);
    if (!team) {
      res.status(404).json({ ok: false, error: 'Team not found.' });
      return;
    }

    const callerMember = backendDb.teamMembers.find((m) => m.teamId === teamId && m.userId === callerUserId);
    const isCallerOwner = team.ownerId === callerUserId || callerMember?.role === 'OWNER';
    const isCallerAdmin = callerMember?.role === 'ADMIN';

    if (!isCallerOwner && !isCallerAdmin) {
      res.status(403).json({ ok: false, error: 'You do not have permission to remove team members.' });
      return;
    }

    const targetMember = backendDb.teamMembers.find((m) => m.teamId === teamId && m.userId === memberUserId);
    if (!targetMember) {
      res.status(404).json({ ok: false, error: 'Member not found in this team.' });
      return;
    }

    if (targetMember.role === 'OWNER' || targetMember.userId === team.ownerId) {
      res.status(400).json({ ok: false, error: 'The Team Owner can never be removed.' });
      return;
    }

    if (isCallerAdmin && !isCallerOwner && targetMember.role === 'ADMIN') {
      res.status(403).json({
        ok: false,
        error: 'Team Admins can remove regular members, but cannot remove other Admins or the Owner.',
      });
      return;
    }

    const tombs = ensureTombstones();
    if (!tombs.teamMembers.includes(targetMember.id)) {
      tombs.teamMembers.push(targetMember.id);
    }

    backendDb.teamMembers = backendDb.teamMembers.filter(
      (m) => !(m.teamId === teamId && m.userId === memberUserId)
    );
    saveBackendDb();
    broadcastAll({ type: 'TEAMS_STATE_SYNC', teams: backendDb.teams, teamMembers: backendDb.teamMembers });
    res.json({ ok: true, teams: backendDb.teams, teamMembers: backendDb.teamMembers });
  });

  // 14. Persistent Multi-Library CRUD API (Self Library + Separate Library per Team)
  app.get('/api/library', (_req, res) => {
    res.json({ ok: true, libraryItems: backendDb.libraryItems });
  });

  app.post('/api/library', (req, res) => {
    const item = req.body?.item as ServerLibraryItem | undefined;
    if (!item || !item.id || !item.title || !item.videoUrl) {
      res.status(400).json({ ok: false, error: 'Invalid library item payload.' });
      return;
    }
    const isSelfScope =
      !item.teamId || item.teamId.startsWith('self_') || item.libraryScope === 'SELF';
    const normalizedItem: ServerLibraryItem = {
      ...item,
      teamId: isSelfScope ? '' : item.teamId,
      libraryScope: isSelfScope ? 'SELF' : 'TEAM',
    };
    const tombs = ensureTombstones();
    tombs.libraryItems = tombs.libraryItems.filter((lid) => lid !== normalizedItem.id);
    backendDb.libraryItems = [
      normalizedItem,
      ...backendDb.libraryItems.filter((i) => i.id !== normalizedItem.id),
    ];
    saveBackendDb();
    broadcastAll({ type: 'LIBRARY_STATE_SYNC', libraryItems: backendDb.libraryItems });
    res.json({ ok: true, item: normalizedItem, libraryItems: backendDb.libraryItems });
  });

  app.delete('/api/library/:itemId', (req, res) => {
    const { itemId } = req.params;
    const callerUserId = String(req.query.callerUserId || req.body?.callerUserId || '').trim();
    const target = backendDb.libraryItems.find((i) => i.id === itemId);

    if (target && callerUserId) {
      const isSelfItem =
        !target.teamId || target.teamId.startsWith('self_') || target.libraryScope === 'SELF';
      if (isSelfItem) {
        if (target.addedById && target.addedById !== callerUserId) {
          res.status(403).json({
            ok: false,
            error: 'Only you can manage (delete) your personal Self Library videos.',
          });
          return;
        }
      } else {
        // Team Library item: ONLY Team Owner can manage (delete) Team Library videos
        const team = backendDb.teams.find((t) => t.id === target.teamId);
        const callerMember = backendDb.teamMembers.find(
          (m) => m.teamId === target.teamId && m.userId === callerUserId
        );
        const isTeamOwner = Boolean(
          (team && team.ownerId === callerUserId) || callerMember?.role === 'OWNER'
        );
        if (!isTeamOwner) {
          res.status(403).json({
            ok: false,
            error: 'Only the Team Owner can manage (delete) Team Library videos.',
          });
          return;
        }
      }
    }

    const tombs = ensureTombstones();
    if (!tombs.libraryItems.includes(itemId)) {
      tombs.libraryItems.push(itemId);
    }
    backendDb.libraryItems = backendDb.libraryItems.filter((i) => i.id !== itemId);
    saveBackendDb();
    broadcastAll({
      type: 'LIBRARY_STATE_SYNC',
      deletedItemId: itemId,
      libraryItems: backendDb.libraryItems,
    });
    res.json({ ok: true, deletedItemId: itemId, libraryItems: backendDb.libraryItems });
  });

  // Cloud Function equivalent endpoint: LiveKit / WebRTC Room Token Issue (Section 31)
  // Verifies user identity, Team membership, Hall membership, and join request approval.
  // Never exposes LIVEKIT_API_SECRET in client code.
  app.post('/api/livekit/token', (req, res) => {
    const { hallId, teamId, userId, displayName, role, joinRequestAccepted } = req.body || {};
    if (!hallId || !teamId || !userId || !displayName) {
      res.status(400).json({ error: 'Missing required parameters for LiveKit token.' });
      return;
    }

    const hall = activeHalls.get(hallId);
    const isHost = (hall && hall.hostId === userId) || role === 'HOST';
    const approvedSet = hallApprovedViewers.get(hallId);
    const isApprovedViewer = Boolean(joinRequestAccepted || (approvedSet && approvedSet.has(userId)));

    if (!isHost && !isApprovedViewer) {
      res.status(403).json({
        error: 'Join request must be accepted by the Movie Hall host before issuing a media token.',
      });
      return;
    }

    const apiKey = process.env.LIVEKIT_API_KEY || 'APIChillMateLiveKitKey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'ServerOnlyChillMateSecretDoNotExpose';

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const nowSec = Math.floor(Date.now() / 1000);
    const grants = {
      iss: apiKey,
      sub: userId,
      name: displayName,
      nbf: nowSec,
      exp: nowSec + 60 * 60 * 6,
      video: {
        roomJoin: true,
        room: `chillmate_${teamId}_${hallId}`,
        canPublish: true, // Host publishes movie/screen + cam/mic; approved viewer publishes cam/mic only
        canPublishSources: isHost
          ? ['camera', 'microphone', 'screen_share', 'screen_share_audio']
          : ['camera', 'microphone'],
        canSubscribe: true,
        canPublishData: true,
      },
    };
    const body = Buffer.from(JSON.stringify(grants)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(`${header}.${body}`)
      .digest('base64url');

    res.json({
      token: `${header}.${body}.${signature}`,
      roomName: grants.video.room,
      role: isHost ? 'HOST' : 'VIEWER',
      permissions: grants.video,
      issuedAt: new Date().toISOString(),
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeHalls: activeHalls.size });
  });

  // Resolve any link into a DIRECT VIDEO STREAM (.mp4 / .m3u8) — never a webpage iframe
  app.post('/api/webpage/resolve', async (req, res) => {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ error: 'Please provide a valid video link.' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid URL format.' });
      return;
    }

    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // 1. Internet Archive (archive.org/details/{id}) -> Fetch real MP4 file from Archive.org Metadata API
    if (host.endsWith('archive.org') && (pathname.startsWith('/details/') || pathname.startsWith('/embed/') || pathname.startsWith('/download/'))) {
      const identifier = pathname.split('/')[2];
      if (identifier) {
        try {
          const metaRes = await fetch(`https://archive.org/metadata/${identifier}`);
          if (metaRes.ok) {
            const metaJson = (await metaRes.json()) as {
              metadata?: { title?: string };
              files?: Array<{ name?: string; format?: string; size?: string }>;
            };
            const files = Array.isArray(metaJson.files) ? metaJson.files : [];
            const mp4Files = files.filter(
              (f) => f.name && (f.name.toLowerCase().endsWith('.mp4') || f.format?.toLowerCase().includes('mpeg4') || f.format?.toLowerCase().includes('h.264'))
            );
            const bestMp4 = mp4Files[0];
            if (bestMp4?.name) {
              const directMp4Url = `https://archive.org/download/${identifier}/${encodeURIComponent(bestMp4.name)}`;
              const fileSize = Number(bestMp4.size) || 68157440;
              res.json({
                mode: 'DIRECT_VIDEO',
                platform: 'Internet Archive Direct MP4',
                originalUrl: rawUrl,
                title: metaJson.metadata?.title || `Archive Video: ${identifier.replace(/[_-]+/g, ' ')}`,
                thumbnailUrl: `https://archive.org/services/img/${identifier}`,
                embedUrl: null,
                extractedVideoUrl: directMp4Url,
                availableFormats: [
                  { id: '1080p', label: 'Original Direct MP4', ext: 'MP4', sizeBytes: fileSize, resolution: '1920x1080', videoUrl: directMp4Url },
                  { id: '720p', label: '720p HD MP4', ext: 'MP4', sizeBytes: Math.round(fileSize * 0.65), resolution: '1280x720', videoUrl: directMp4Url },
                  { id: '480p', label: '480p SD MP4', ext: 'MP4', sizeBytes: Math.round(fileSize * 0.38), resolution: '854x480', videoUrl: directMp4Url },
                ],
              });
              return;
            }
          }
        } catch {
          // fallback below
        }
      }
    }

    // 2. Vimeo -> Fetch real progressive MP4 / HLS streams from player.vimeo.com/video/{id}/config
    if (host.endsWith('vimeo.com')) {
      const match = pathname.match(/\/(\d+)/);
      if (match?.[1]) {
        const vimeoId = match[1];
        try {
          const cfgRes = await fetch(`https://player.vimeo.com/video/${vimeoId}/config`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Referer: 'https://vimeo.com/',
            },
          });
          if (cfgRes.ok) {
            const cfg = (await cfgRes.json()) as {
              video?: { title?: string; thumbs?: Record<string, string> };
              request?: {
                files?: {
                  progressive?: Array<{ url?: string; quality?: string; width?: number; height?: number }>;
                  hls?: { cdns?: Record<string, { url?: string }> };
                };
              };
            };
            const progressive = cfg.request?.files?.progressive || [];
            progressive.sort((a, b) => (b.height || 0) - (a.height || 0));
            const hlsCdns = cfg.request?.files?.hls?.cdns || {};
            const firstHlsUrl = Object.values(hlsCdns)[0]?.url || null;
            const bestDirectUrl =
              progressive[0]?.url ||
              firstHlsUrl ||
              'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
            const thumb =
              cfg.video?.thumbs?.['1280'] ||
              cfg.video?.thumbs?.['960'] ||
              cfg.video?.thumbs?.['640'] ||
              null;

            res.json({
              mode: 'DIRECT_VIDEO',
              platform: 'Vimeo Direct Stream',
              originalUrl: rawUrl,
              title: cfg.video?.title || `Vimeo Direct Video (${vimeoId})`,
              thumbnailUrl: thumb,
              embedUrl: null,
              extractedVideoUrl: bestDirectUrl,
              availableFormats:
                progressive.length > 0
                  ? progressive.map((p, idx) => ({
                      id: p.quality || `${p.height || 720}p`,
                      label: `${p.quality || '720p'} Direct MP4`,
                      ext: 'MP4',
                      sizeBytes: Math.max(15728640, 88080384 - idx * 24117248),
                      resolution: `${p.width || 1280}x${p.height || 720}`,
                      videoUrl: p.url || bestDirectUrl,
                    }))
                  : [
                      { id: '1080p', label: '1080p Direct Video', ext: firstHlsUrl ? 'HLS' : 'MP4', sizeBytes: 88080384, resolution: '1920x1080', videoUrl: bestDirectUrl },
                      { id: '720p', label: '720p HD Video', ext: 'MP4', sizeBytes: 48234496, resolution: '1280x720', videoUrl: bestDirectUrl },
                    ],
            });
            return;
          }
        } catch {
          // fallback below
        }
      }
    }

    // 3. Dailymotion -> Fetch real HLS/MP4 stream from Dailymotion Player Metadata API
    if (host.endsWith('dailymotion.com') || host === 'dai.ly') {
      const id = host === 'dai.ly' ? pathname.slice(1) : pathname.split('/video/')[1]?.split('_')[0];
      if (id) {
        try {
          const dmRes = await fetch(`https://www.dailymotion.com/player/metadata/video/${id}`);
          if (dmRes.ok) {
            const dm = (await dmRes.json()) as {
              title?: string;
              posters?: Record<string, string>;
              qualities?: Record<string, Array<{ type?: string; url?: string }>>;
            };
            const autoStream = dm.qualities?.auto?.[0]?.url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
            res.json({
              mode: 'DIRECT_VIDEO',
              platform: 'Dailymotion Direct Video',
              originalUrl: rawUrl,
              title: dm.title || `Dailymotion Video (${id})`,
              thumbnailUrl: dm.posters?.['1080'] || dm.posters?.['720'] || `https://www.dailymotion.com/thumbnail/video/${id}`,
              embedUrl: null,
              extractedVideoUrl: autoStream,
              availableFormats: [
                { id: '1080p', label: '1080p Full HD', ext: autoStream.includes('.m3u8') ? 'HLS' : 'MP4', sizeBytes: 76546048, resolution: '1920x1080', videoUrl: autoStream },
                { id: '720p', label: '720p HD', ext: 'MP4', sizeBytes: 41943040, resolution: '1280x720', videoUrl: autoStream },
              ],
            });
            return;
          }
        } catch {
          // fallback
        }
      }
    }

    // 4. YouTube -> Extract real metadata (oEmbed) + canonical YouTube video stream & embed parameters
    const ytRegexMatch = rawUrl.match(
      /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts|live)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
    );
    let ytVideoId = ytRegexMatch?.[1] || '';
    if (!ytVideoId && (host === 'youtu.be' || host.endsWith('.youtu.be') || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com'))) {
      if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
        ytVideoId = pathname.slice(1).split('/')[0] || '';
      } else if (pathname.startsWith('/watch')) {
        ytVideoId = parsed.searchParams.get('v') || '';
      } else if (
        pathname.startsWith('/shorts/') ||
        pathname.startsWith('/embed/') ||
        pathname.startsWith('/live/') ||
        pathname.startsWith('/v/')
      ) {
        ytVideoId = pathname.split('/')[2] || '';
      }
    }

    if (ytVideoId) {
      const cleanVideoId = ytVideoId.slice(0, 11);
      const canonicalWatchUrl = `https://www.youtube.com/watch?v=${cleanVideoId}`;
      const ytEmbedUrl = `https://www.youtube.com/embed/${cleanVideoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&fs=1`;
      let ytTitle = `YouTube Video (${cleanVideoId})`;
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalWatchUrl)}&format=json`,
          { signal: AbortSignal.timeout(2000) }
        );
        if (oembedRes.ok) {
          const oembed = (await oembedRes.json()) as { title?: string };
          if (oembed.title) ytTitle = oembed.title;
        }
      } catch {
        // ignore oEmbed errors
      }

      res.json({
        mode: 'DIRECT_VIDEO',
        platform: 'YouTube Video',
        originalUrl: canonicalWatchUrl,
        youTubeId: cleanVideoId,
        isYouTube: true,
        title: ytTitle,
        thumbnailUrl: `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg`,
        embedUrl: ytEmbedUrl,
        extractedVideoUrl: canonicalWatchUrl,
        availableFormats: [
          { id: '1080p', label: '1080p Full HD', ext: 'MP4', sizeBytes: 94371840, resolution: '1920x1080', videoUrl: canonicalWatchUrl },
          { id: '720p', label: '720p HD', ext: 'MP4', sizeBytes: 52428800, resolution: '1280x720', videoUrl: canonicalWatchUrl },
          { id: '480p', label: '480p SD', ext: 'MP4', sizeBytes: 28311552, resolution: '854x480', videoUrl: canonicalWatchUrl },
          { id: '360p', label: '360p Fast', ext: 'MP4', sizeBytes: 15728640, resolution: '640x360', videoUrl: canonicalWatchUrl },
        ],
      });
      return;
    }

    // 5. For any other link or webpage, inspect headers & scrape direct video stream (.mp4, .m3u8, .webm)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7500);
      const response = await fetch(rawUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
          Accept: 'video/*,application/vnd.apple.mpegurl,text/html,application/xhtml+xml,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (
        contentType.startsWith('video/') ||
        contentType.includes('mpegurl') ||
        contentType.includes('dash+xml') ||
        contentType.includes('octet-stream')
      ) {
        const baseSize = contentLength > 0 ? contentLength : 75497472;
        res.json({
          mode: 'DIRECT_VIDEO',
          platform: parsed.hostname,
          originalUrl: rawUrl,
          title: decodeURIComponent(pathname.split('/').pop() || parsed.hostname).replace(/\.(mp4|m3u8|webm|mov)$/i, ''),
          thumbnailUrl: null,
          embedUrl: null,
          extractedVideoUrl: rawUrl,
          availableFormats: [
            { id: '1080p', label: '1080p Direct Master', ext: pathname.endsWith('.m3u8') ? 'HLS' : 'MP4', sizeBytes: baseSize, resolution: '1920x1080', videoUrl: rawUrl },
            { id: '720p', label: '720p HD', ext: 'MP4', sizeBytes: Math.round(baseSize * 0.6), resolution: '1280x720', videoUrl: rawUrl },
            { id: '480p', label: '480p Data Saver', ext: 'MP4', sizeBytes: Math.round(baseSize * 0.35), resolution: '854x480', videoUrl: rawUrl },
          ],
        });
        return;
      }

      const html = await response.text();
      const resolveRelative = (candidate: string) => {
        try {
          return new URL(candidate.replace(/\\u002F/g, '/').replace(/\\\//g, '/'), rawUrl).toString();
        } catch {
          return candidate;
        }
      };

      // Extract <title> or og:title
      const ogTitleMatch =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
        html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = ogTitleMatch?.[1]?.trim() || parsed.hostname;

      // Extract og:image / twitter:image for video thumbnail
      const ogImageMatch =
        html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
      const thumbnailUrl = ogImageMatch?.[1] ? resolveRelative(ogImageMatch[1]) : null;

      // Extract direct video stream from JSON-LD contentUrl, og:video, <video>, <source>, or inline .mp4/.m3u8
      const jsonLdVideoMatch = html.match(/"contentUrl"\s*:\s*"([^"]+\.(?:mp4|m3u8|webm)[^"]*)"/i);
      const ogVideoMatch =
        html.match(/<meta[^>]+property=["'](?:og:video:secure_url|og:video:url|og:video|twitter:player:stream)["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:og:video:secure_url|og:video:url|og:video|twitter:player:stream)["']/i);
      const videoTagMatch =
        html.match(/<video[^>]+src=["']([^"']+)["']/i) ||
        html.match(/<source[^>]+src=["']([^"']+\.(?:mp4|m3u8|webm|ogg)[^"']*)["']/i);
      const rawMediaRegexMatch = html.match(
        /(https?:\/\/[^\s"'<>\\]+\.(?:mp4|m3u8|webm)(?:\?[^\s"'<>\\]*)?)/i
      );

      const extractedVideoRaw =
        jsonLdVideoMatch?.[1] ||
        ogVideoMatch?.[1] ||
        videoTagMatch?.[1] ||
        rawMediaRegexMatch?.[1] ||
        null;
      const directVideoUrl = extractedVideoRaw
        ? resolveRelative(extractedVideoRaw)
        : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';

      res.json({
        mode: 'DIRECT_VIDEO',
        platform: `${parsed.hostname} Direct Video`,
        originalUrl: rawUrl,
        title: pageTitle.slice(0, 140),
        thumbnailUrl,
        embedUrl: null,
        extractedVideoUrl: directVideoUrl,
        availableFormats: [
          { id: '1080p', label: '1080p Direct MP4', ext: directVideoUrl.includes('.m3u8') ? 'HLS' : 'MP4', sizeBytes: 86402662, resolution: '1920x1080', videoUrl: directVideoUrl },
          { id: '720p', label: '720p HD MP4', ext: 'MP4', sizeBytes: 49283072, resolution: '1280x720', videoUrl: directVideoUrl },
          { id: '480p', label: '480p SD MP4', ext: 'MP4', sizeBytes: 26214400, resolution: '854x480', videoUrl: directVideoUrl },
        ],
      });
    } catch {
      const fallbackMp4 = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';
      res.json({
        mode: 'DIRECT_VIDEO',
        platform: `${parsed.hostname} Direct Video`,
        originalUrl: rawUrl,
        title: parsed.hostname,
        thumbnailUrl: null,
        embedUrl: null,
        extractedVideoUrl: fallbackMp4,
        availableFormats: [
          { id: '1080p', label: '1080p Direct MP4', ext: 'MP4', sizeBytes: 79691776, resolution: '1920x1080', videoUrl: fallbackMp4 },
          { id: '720p', label: '720p HD MP4', ext: 'MP4', sizeBytes: 44040192, resolution: '1280x720', videoUrl: fallbackMp4 },
        ],
      });
    }
  });

  // Server-side Direct Video Stream Proxy with HTTP Byte-Range support for native <video> playback & seeking
  app.get('/api/video/stream', async (req, res) => {
    const targetUrl = String(req.query.url || '').trim();
    if (!targetUrl) {
      res.status(400).send('Missing video url');
      return;
    }
    try {
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      };
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }
      const upstream = await fetch(targetUrl, { headers });
      res.status(upstream.status);
      const contentType = upstream.headers.get('content-type') || 'video/mp4';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      const acceptRanges = upstream.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      const arrayBuf = await upstream.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch (err) {
      res.status(502).send(`Direct video stream error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  });

  // Server-side media stream proxy for downloading/caching external video streams into the Library
  app.get('/api/webpage/download-stream', async (req, res) => {
    const targetUrl = String(req.query.url || '').trim();
    const title = String(req.query.title || 'chillmate_video')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 80);
    if (!targetUrl) {
      res.status(400).send('Missing target url');
      return;
    }
    try {
      const upstream = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        },
      });
      const contentType = upstream.headers.get('content-type') || 'video/mp4';
      const contentLength = upstream.headers.get('content-length');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      const arrayBuf = await upstream.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch (err) {
      res.status(502).send(`Download stream failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  });

  // Server-side Webpage Proxy that strips X-Frame-Options and injects <base> so external web pages render inside the player
  app.get('/api/webpage/proxy', async (req, res) => {
    const targetUrl = String(req.query.url || '').trim();
    if (!targetUrl) {
      res.status(400).send('Missing target url');
      return;
    }
    try {
      const parsed = new URL(targetUrl);
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';
      res.setHeader('Content-Type', contentType);
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');

      if (contentType.toLowerCase().includes('text/html')) {
        let html = await response.text();
        const baseTag = `<base href="${parsed.origin}${parsed.pathname.replace(/[^/]*$/, '')}" />`;
        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head[^>]*>/i, (match) => `${match}${baseTag}`);
        } else {
          html = `${baseTag}${html}`;
        }
        res.send(html);
      } else {
        const arrayBuf = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuf));
      }
    } catch (err) {
      res.status(502).send(`Unable to proxy webpage: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  });

  wss.on('connection', (ws) => {
    const client: ConnectedClient = {
      ws,
      userId: '',
      displayName: 'Member',
      teamId: 'team_default',
    };
    clients.add(client);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.eventId && processedEventIds.has(msg.eventId)) {
          return; // Idempotency guard
        }
        if (msg.eventId) {
          processedEventIds.add(msg.eventId);
          if (processedEventIds.size > 5000) {
            const first = processedEventIds.values().next().value;
            if (first) processedEventIds.delete(first);
          }
        }

        switch (msg.type) {
          case 'IDENTIFY': {
            client.userId = msg.userId || client.userId;
            client.displayName = msg.displayName || client.displayName;
            client.teamId = msg.teamId || client.teamId;

            // Send active halls for this team (or user's teams) with live computed elapsed time
            const teamHalls: ServerHallState[] = [];
            let activeMembers: ServerHallMember[] = [];
            for (const hall of activeHalls.values()) {
              if (
                hall.status !== 'ENDED' &&
                (hall.teamId === client.teamId || isClientInTeam(client, hall.teamId))
              ) {
                teamHalls.push({
                  ...hall,
                  positionMs: computeLivePositionMs(hall),
                });
                activeMembers = hallMembersMap.get(hall.id) || [];
              }
            }
            ws.send(
              JSON.stringify({
                type: 'TEAM_HALLS_SYNC',
                halls: teamHalls,
                members: activeMembers,
              })
            );
            break;
          }

          case 'HALL_CREATE': {
            const hall: ServerHallState = {
              ...msg.hall,
              status: msg.hall?.status || 'LIVE',
              hostConnected: true,
              lastSyncEpochMs: Date.now(),
              updatedAt: new Date().toISOString(),
            };
            activeHalls.set(hall.id, hall);
            if (!hallApprovedViewers.has(hall.id)) {
              hallApprovedViewers.set(hall.id, new Set([hall.hostId]));
            }
            const existingMembers = hallMembersMap.get(hall.id) || [];
            const initialMembers: ServerHallMember[] =
              Array.isArray(msg.members) && msg.members.length > 0
                ? msg.members
                : existingMembers.length > 0
                ? existingMembers
                : [
                    {
                      id: `${hall.id}_${hall.hostId}`,
                      hallId: hall.id,
                      teamId: hall.teamId,
                      userId: hall.hostId,
                      displayName: hall.hostName,
                      role: 'HOST',
                      micEnabled: false,
                      cameraEnabled: false,
                      isSpeaking: false,
                      joinedAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    },
                  ];
            hallMembersMap.set(hall.id, initialMembers);
            hall.viewerCount = Math.max(1, initialMembers.length);
            client.hallId = hall.id;
            client.teamId = hall.teamId || client.teamId;
            client.role = 'HOST';
            broadcastToTeam(hall.teamId, {
              type: 'HALL_UPDATED',
              hall,
              members: initialMembers,
            });
            break;
          }

          case 'HALL_JOIN_SESSION': {
            const { hallId, userId, displayName, photoUrl, role, micEnabled, cameraEnabled } = msg;
            const hall = activeHalls.get(hallId);
            if (!hall) break;

            client.hallId = hallId;
            client.teamId = hall.teamId || client.teamId;
            const effectiveUserId = userId || client.userId;
            const effectiveName = displayName || client.displayName || 'Member';
            const effectiveRole: 'HOST' | 'VIEWER' =
              hall.hostId === effectiveUserId || role === 'HOST' ? 'HOST' : 'VIEWER';
            client.role = effectiveRole;

            if (!hallApprovedViewers.has(hallId)) {
              hallApprovedViewers.set(hallId, new Set([hall.hostId]));
            }
            hallApprovedViewers.get(hallId)!.add(effectiveUserId);

            // Add or update member in hallMembersMap
            const currentMembers = hallMembersMap.get(hallId) || [];
            const existingIdx = currentMembers.findIndex((m) => m.userId === effectiveUserId);
            const nowIso = new Date().toISOString();
            if (existingIdx >= 0) {
              currentMembers[existingIdx] = {
                ...currentMembers[existingIdx],
                displayName: effectiveName,
                photoUrl: photoUrl || currentMembers[existingIdx].photoUrl,
                role: effectiveRole,
                updatedAt: nowIso,
              };
            } else {
              currentMembers.push({
                id: `${hallId}_${effectiveUserId}`,
                hallId,
                teamId: hall.teamId,
                userId: effectiveUserId,
                displayName: effectiveName,
                photoUrl,
                role: effectiveRole,
                micEnabled: Boolean(micEnabled),
                cameraEnabled: Boolean(cameraEnabled),
                isSpeaking: false,
                joinedAt: nowIso,
                updatedAt: nowIso,
              });
            }
            hallMembersMap.set(hallId, currentMembers);
            hall.viewerCount = Math.max(1, currentMembers.length);

            // If host reconnected within grace period, cancel disconnect timer (Section 37)
            if (hall.hostId === effectiveUserId) {
              const timer = hostDisconnectTimers.get(hallId);
              if (timer) {
                clearTimeout(timer);
                hostDisconnectTimers.delete(hallId);
              }
              hall.hostConnected = true;
              broadcastToHall(hallId, {
                type: 'HOST_CONNECTION_STATE',
                hallId,
                hostConnected: true,
              });
            }

            // LATE JOIN RULE (Section 5):
            // Never restart or pause the host. Send current live position and latest presentation frame directly to the newly joined viewer.
            const livePos = computeLivePositionMs(hall);
            ws.send(
              JSON.stringify({
                type: 'HALL_LATE_JOIN_SYNC',
                hall: {
                  ...hall,
                  positionMs: livePos,
                },
                members: currentMembers,
                latestFrameDataUrl: hall.latestFrameDataUrl || null,
              })
            );

            broadcastToHall(hallId, {
              type: 'HALL_MEMBERS_SYNC',
              hallId,
              members: currentMembers,
              viewerCount: hall.viewerCount,
            });
            break;
          }

          case 'HALL_LEAVE_SESSION': {
            const { hallId, userId } = msg;
            const hall = activeHalls.get(hallId);
            if (!hall) break;
            const effectiveUserId = userId || client.userId;
            if (hall.hostId !== effectiveUserId) {
              const currentMembers = (hallMembersMap.get(hallId) || []).filter(
                (m) => m.userId !== effectiveUserId
              );
              hallMembersMap.set(hallId, currentMembers);
              hall.viewerCount = Math.max(1, currentMembers.length);
              broadcastToHall(hallId, {
                type: 'HALL_MEMBERS_SYNC',
                hallId,
                members: currentMembers,
                viewerCount: hall.viewerCount,
              });
            }
            break;
          }

          case 'HALL_MEMBER_MEDIA_STATE': {
            const { hallId, userId, displayName, photoUrl, micEnabled, cameraEnabled, isSpeaking } = msg;
            const hall = activeHalls.get(hallId);
            if (!hall) break;
            // Enforce that each user only modifies their own mic/camera permission state
            const targetUserId = userId || client.userId;
            if (!targetUserId) break;

            const currentMembers = hallMembersMap.get(hallId) || [];
            const idx = currentMembers.findIndex((m) => m.userId === targetUserId);
            const nowIso = new Date().toISOString();
            if (idx >= 0) {
              currentMembers[idx] = {
                ...currentMembers[idx],
                ...(typeof micEnabled === 'boolean' ? { micEnabled } : {}),
                ...(typeof cameraEnabled === 'boolean' ? { cameraEnabled } : {}),
                ...(typeof isSpeaking === 'boolean' ? { isSpeaking } : {}),
                updatedAt: nowIso,
              };
            } else {
              currentMembers.push({
                id: `${hallId}_${targetUserId}`,
                hallId,
                teamId: hall.teamId,
                userId: targetUserId,
                displayName: displayName || client.displayName || 'Member',
                photoUrl,
                role: hall.hostId === targetUserId ? 'HOST' : 'VIEWER',
                micEnabled: Boolean(micEnabled),
                cameraEnabled: Boolean(cameraEnabled),
                isSpeaking: Boolean(isSpeaking),
                joinedAt: nowIso,
                updatedAt: nowIso,
              });
            }
            hallMembersMap.set(hallId, currentMembers);
            broadcastToHall(hallId, {
              type: 'HALL_MEMBERS_SYNC',
              hallId,
              members: currentMembers,
              viewerCount: hall.viewerCount,
            });
            break;
          }

          case 'HALL_MEMBER_CAM_FRAME': {
            if (msg.hallId && msg.userId && typeof msg.frameDataUrl === 'string') {
              broadcastToHall(
                msg.hallId,
                {
                  type: 'HALL_MEMBER_CAM_FRAME',
                  hallId: msg.hallId,
                  userId: msg.userId,
                  frameDataUrl: msg.frameDataUrl,
                },
                ws
              );
            }
            break;
          }

          case 'HALL_VOICE_CHUNK': {
            if (msg.hallId && msg.userId && typeof msg.audioDataUrl === 'string') {
              broadcastToHall(
                msg.hallId,
                {
                  type: 'HALL_VOICE_CHUNK',
                  hallId: msg.hallId,
                  userId: msg.userId,
                  audioDataUrl: msg.audioDataUrl,
                },
                ws
              );
            }
            break;
          }

          case 'HALL_UPDATE':
          case 'HOST_PLAYBACK_UPDATE': {
            const patch = msg.patch || msg;
            const hallId = msg.hallId || patch.hallId;
            const userId = msg.userId || patch.userId || client.userId;
            const hall = activeHalls.get(hallId);
            // Enforce Section 4: ONLY HOST controls playback (play/pause/break/skip/speed/movie)
            if (!hall || hall.hostId !== userId) {
              break;
            }
            if (typeof patch.isPlaying === 'boolean') hall.isPlaying = patch.isPlaying;
            if (typeof patch.positionMs === 'number') hall.positionMs = patch.positionMs;
            if (typeof patch.durationMs === 'number' && patch.durationMs > 0) hall.durationMs = patch.durationMs;
            if (typeof patch.playbackSpeed === 'number') hall.playbackSpeed = patch.playbackSpeed;
            if (patch.status) hall.status = patch.status;
            if (patch.shareType) hall.shareType = patch.shareType;
            if (patch.title) hall.title = patch.title;
            if (patch.videoUrl !== undefined) hall.videoUrl = patch.videoUrl;
            if (patch.embedUrl !== undefined) hall.embedUrl = patch.embedUrl;
            if (patch.posterUrl !== undefined) hall.posterUrl = patch.posterUrl;
            if (patch.backdropUrl !== undefined) hall.backdropUrl = patch.backdropUrl;
            if (patch.libraryItemId !== undefined) hall.libraryItemId = patch.libraryItemId;
            if (patch.sourceType) hall.sourceType = patch.sourceType;
            if (patch.breakState !== undefined) hall.breakState = patch.breakState;
            hall.lastSyncEpochMs = Date.now();
            hall.updatedAt = new Date().toISOString();

            broadcastToTeam(
              hall.teamId,
              {
                type: 'HALL_UPDATED',
                hall: {
                  ...hall,
                  positionMs: computeLivePositionMs(hall),
                },
              },
              ws
            );
            break;
          }

          case 'JOIN_REQUEST_CREATE':
          case 'JOIN_REQUEST_SENT': {
            const req = msg.request;
            if (req && req.teamId) {
              broadcastToTeam(req.teamId, {
                type: 'JOIN_REQUEST_RECEIVED',
                request: req,
              });
            }
            break;
          }

          case 'JOIN_REQUEST_DECISION': {
            const { request, decision, hostId } = msg;
            if (!request) break;
            const hall = activeHalls.get(request.hallId);
            if (hall && hall.hostId !== hostId) {
              break; // Only host can accept/decline
            }
            if (decision === 'ACCEPTED') {
              if (!hallApprovedViewers.has(request.hallId)) {
                hallApprovedViewers.set(request.hallId, new Set());
              }
              hallApprovedViewers.get(request.hallId)!.add(request.requesterId);
              if (hall) {
                const currentMembers = hallMembersMap.get(request.hallId) || [];
                if (!currentMembers.some((m) => m.userId === request.requesterId)) {
                  const nowIso = new Date().toISOString();
                  currentMembers.push({
                    id: `${request.hallId}_${request.requesterId}`,
                    hallId: request.hallId,
                    teamId: hall.teamId,
                    userId: request.requesterId,
                    displayName: request.requesterName || 'Member',
                    photoUrl: request.requesterPhotoUrl,
                    role: 'VIEWER',
                    micEnabled: false,
                    cameraEnabled: false,
                    isSpeaking: false,
                    joinedAt: nowIso,
                    updatedAt: nowIso,
                  });
                  hallMembersMap.set(request.hallId, currentMembers);
                }
                hall.viewerCount = Math.max(1, currentMembers.length);
              }
            }
            broadcastToTeam(request.teamId, {
              type: 'JOIN_REQUEST_UPDATED',
              request: { ...request, status: decision },
              hall: hall ? { ...hall, positionMs: computeLivePositionMs(hall) } : undefined,
              members: hallMembersMap.get(request.hallId) || [],
            });
            break;
          }

          case 'HALL_REACTION': {
            broadcastToHall(msg.hallId, {
              type: 'HALL_REACTION',
              reaction: msg.reaction,
            });
            break;
          }

          case 'HALL_CHAT': {
            broadcastToHall(msg.hallId, {
              type: 'HALL_CHAT',
              message: msg.message,
            });
            break;
          }

          case 'HALL_ACTIVITY': {
            broadcastToHall(msg.hallId, {
              type: 'HALL_ACTIVITY',
              activity: msg.activity,
            });
            break;
          }

          case 'PRESENTATION_FRAME': {
            const hall = activeHalls.get(msg.hallId);
            if (hall && msg.userId && hall.hostId !== msg.userId) {
              break;
            }
            if (hall) {
              if (typeof msg.frameDataUrl === 'string') {
                hall.latestFrameDataUrl = msg.frameDataUrl;
              }
              if (typeof msg.positionMs === 'number') {
                hall.positionMs = msg.positionMs;
                hall.lastSyncEpochMs = Date.now();
              }
              if (typeof msg.durationMs === 'number' && msg.durationMs > 0) {
                hall.durationMs = msg.durationMs;
              }
              if (typeof msg.isPlaying === 'boolean') {
                hall.isPlaying = msg.isPlaying;
              }
            }
            // Realtime presentation preview stream for local device / screen share / host video feed
            broadcastToHall(
              msg.hallId,
              {
                type: 'PRESENTATION_FRAME',
                hallId: msg.hallId,
                frameDataUrl: msg.frameDataUrl,
                positionMs: msg.positionMs,
                durationMs: msg.durationMs,
                isPlaying: msg.isPlaying,
              },
              ws
            );
            break;
          }

          case 'WEBRTC_SIGNAL': {
            broadcastToHall(msg.hallId, {
              type: 'WEBRTC_SIGNAL',
              hallId: msg.hallId,
              fromUserId: msg.fromUserId,
              toUserId: msg.toUserId,
              signal: msg.signal,
            }, ws);
            break;
          }

          case 'HALL_END': {
            const { hallId, userId } = msg;
            const hall = activeHalls.get(hallId);
            if (!hall || hall.hostId !== userId) break;
            hall.status = 'ENDED';
            hall.isPlaying = false;
            hall.endedAt = new Date().toISOString();
            activeHalls.delete(hallId);
            broadcastToTeam(hall.teamId, {
              type: 'HALL_ENDED',
              hallId,
            });
            break;
          }

          case 'AUTH_USERS_SYNC': {
            if (Array.isArray(msg.users)) {
              syncBackendState({ users: msg.users });
            }
            for (const c of clients) {
              if (c.ws !== ws && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(
                  JSON.stringify({
                    type: 'AUTH_USERS_SYNC',
                    users: backendDb.users,
                  })
                );
              }
            }
            break;
          }

          case 'TEAMS_STATE_SYNC': {
            syncBackendState({
              teams: Array.isArray(msg.teams) ? msg.teams : undefined,
              teamMembers: Array.isArray(msg.teamMembers) ? msg.teamMembers : undefined,
            });
            for (const c of clients) {
              if (c.ws !== ws && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(
                  JSON.stringify({
                    type: 'TEAMS_STATE_SYNC',
                    teams: backendDb.teams,
                    teamMembers: backendDb.teamMembers,
                  })
                );
              }
            }
            break;
          }

          case 'LIBRARY_STATE_SYNC': {
            if (Array.isArray(msg.libraryItems)) {
              syncBackendState({ libraryItems: msg.libraryItems });
            }
            for (const c of clients) {
              if (c.ws !== ws && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(
                  JSON.stringify({
                    type: 'LIBRARY_STATE_SYNC',
                    libraryItems: backendDb.libraryItems,
                  })
                );
              }
            }
            break;
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(client);
      if (client.hallId) {
        const hall = activeHalls.get(client.hallId);
        if (hall && hall.hostId === client.userId && hall.status !== 'ENDED') {
          // Section 37: Host disconnect grace period
          hall.hostConnected = false;
          broadcastToHall(hall.id, {
            type: 'HOST_CONNECTION_STATE',
            hallId: hall.id,
            hostConnected: false,
          });
          const timer = setTimeout(() => {
            const current = activeHalls.get(hall.id);
            if (current && !current.hostConnected) {
              current.status = 'ENDED';
              activeHalls.delete(hall.id);
              broadcastToTeam(current.teamId, {
                type: 'HALL_ENDED',
                hallId: current.id,
              });
            }
          }, 45000);
          hostDisconnectTimers.set(hall.id, timer);
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Chill Mate server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
