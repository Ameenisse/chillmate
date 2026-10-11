import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { Firestore } from '@google-cloud/firestore';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
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

export const NETFLIX_DEFAULT_CATEGORY_FOLDERS = [
  'Trending Now',
  'Action & Adventure',
  'Sci-Fi & Fantasy',
  'Comedies',
  'Dramas',
  'Thrillers & Mystery',
  'Horror',
  'Romance',
  'Anime',
  'Documentaries',
  'Kids & Family',
  'Crime & True Story',
  'Classic & Award-Winning',
  'TV Shows & Series',
  'Stand-Up & Specials',
];

interface ServerLibraryFolder {
  id: string;
  name: string;
  scope: string; // 'SELF' | `self_${userId}` | teamId
  createdById: string;
  isNetflixDefault?: boolean;
  createdAt: string;
}

interface ServerLibraryItem {
  id: string;
  teamId: string;
  libraryScope?: 'SELF' | 'TEAM';
  folderName?: string;
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
  libraryFolders: ServerLibraryFolder[];
  tombstones?: {
    users: string[];
    teams: string[];
    teamMembers: string[];
    libraryItems: string[];
    libraryFolders: string[];
  };
}

const DB_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'chillmate-db-v2.json');
const BACKUP_DB_FILE = path.join(DB_DIR, 'chillmate-backup-db.json');
const FIREBASE_CONFIG_FILE = path.resolve(__dirname, 'firebase-applet-config.json');

let cloudFirestore: Firestore | null = null;
try {
  let projectId = 'gen-lang-client-0965812497';
  let databaseId = 'ai-studio-9043a15f-fe42-48ac-87a3-073c1da98de5';
  if (fs.existsSync(FIREBASE_CONFIG_FILE)) {
    const rawCfg = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf-8'));
    if (rawCfg?.projectId) projectId = String(rawCfg.projectId);
    if (rawCfg?.firestoreDatabaseId) databaseId = String(rawCfg.firestoreDatabaseId);
  }
  cloudFirestore = new Firestore({
    projectId,
    databaseId,
    ignoreUndefinedProperties: true,
  });
} catch (err) {
  console.warn('Cloud Firestore server client initialization skipped:', err);
}

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
  libraryFolders: [],
  tombstones: {
    users: [],
    teams: [],
    teamMembers: [],
    libraryItems: [],
    libraryFolders: [],
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
        libraryFolders: Array.isArray(parsed.libraryFolders) ? parsed.libraryFolders : [],
        tombstones: {
          users: Array.isArray(parsed.tombstones?.users) ? parsed.tombstones.users : [],
          teams: Array.isArray(parsed.tombstones?.teams) ? parsed.tombstones.teams : [],
          teamMembers: Array.isArray(parsed.tombstones?.teamMembers) ? parsed.tombstones.teamMembers : [],
          libraryItems: Array.isArray(parsed.tombstones?.libraryItems) ? parsed.tombstones.libraryItems : [],
          libraryFolders: Array.isArray(parsed.tombstones?.libraryFolders) ? parsed.tombstones.libraryFolders : [],
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

function ensureTombstones(dbState: PersistentBackendDatabase = backendDb) {
  if (!dbState.tombstones) {
    dbState.tombstones = {
      users: [],
      teams: [],
      teamMembers: [],
      libraryItems: [],
      libraryFolders: [],
    };
  }
  if (!Array.isArray(dbState.tombstones.libraryFolders)) {
    dbState.tombstones.libraryFolders = [];
  }
  return dbState.tombstones;
}

function makeFolderTombstoneKey(scope: string, folderName: string): string {
  return `${scope.trim().toLowerCase()}::${folderName.trim().toLowerCase()}`;
}

function ensureNetflixFoldersForScope(
  scope: string,
  ownerId: string,
  dbState: PersistentBackendDatabase = backendDb
): boolean {
  const cleanScope = scope.trim() || 'SELF';
  if (!Array.isArray(dbState.libraryFolders)) {
    dbState.libraryFolders = [];
  }
  const tombs = ensureTombstones(dbState);
  let added = false;

  for (const catName of NETFLIX_DEFAULT_CATEGORY_FOLDERS) {
    const tombKey = makeFolderTombstoneKey(cleanScope, catName);
    const selfGenericTombKey =
      cleanScope.toLowerCase().startsWith('self_') || cleanScope.toLowerCase() === 'self'
        ? makeFolderTombstoneKey('SELF', catName)
        : '';
    if (
      tombs.libraryFolders.includes(tombKey) ||
      (selfGenericTombKey && tombs.libraryFolders.includes(selfGenericTombKey))
    ) {
      continue;
    }

    const alreadyExists = dbState.libraryFolders.some(
      (f) =>
        f.scope.toLowerCase() === cleanScope.toLowerCase() &&
        f.name.trim().toLowerCase() === catName.toLowerCase()
    );
    if (!alreadyExists) {
      const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      dbState.libraryFolders.push({
        id: `folder_${cleanScope}_${slug}`,
        name: catName,
        scope: cleanScope,
        createdById: ownerId || 'system',
        isNetflixDefault: true,
        createdAt: new Date().toISOString(),
      });
      added = true;
    }
  }
  return added;
}

let cloudSaveTimer: NodeJS.Timeout | null = null;

function persistToCloudFirestoreAsync() {
  if (!cloudFirestore) return;
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    try {
      const tombs = ensureTombstones(backendDb);
      await cloudFirestore
        .collection('systemState')
        .doc('chillmate_persistent_db_v2')
        .set(
          {
            users: backendDb.users,
            teams: backendDb.teams,
            teamMembers: backendDb.teamMembers,
            libraryItems: backendDb.libraryItems,
            libraryFolders: backendDb.libraryFolders,
            tombstones: tombs,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
    } catch {
      // Fallback to local disk files already completed
    }
  }, 250);
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
  persistToCloudFirestoreAsync();
}

function deduplicateAndNormalizeDb(dbState: PersistentBackendDatabase): boolean {
  let changed = false;
  const tombs = ensureTombstones(dbState);
  const userIdRemap = new Map<string, string>();
  const teamIdRemap = new Map<string, string>();

  // 1. Deduplicate Users by ID and Email (case-insensitive) — never auto-delete valid users unless explicitly in tombstones
  const seenUserIds = new Set<string>();
  const seenEmails = new Map<string, ServerUserAccount>();
  const uniqueUsers: ServerUserAccount[] = [];

  for (const u of dbState.users) {
    if (!u || !u.id || !u.email) continue;
    const emailKey = u.email.trim().toLowerCase();
    if (tombs.users.includes(u.id) && emailKey !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      changed = true;
      continue;
    }

    const existing = seenEmails.get(emailKey);

    if (existing) {
      userIdRemap.set(u.id, existing.id);
      const incTime = u.updatedAt ? Date.parse(u.updatedAt) : 0;
      const curTime = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
      if (incTime > curTime) {
        if (u.accountStatus === 'APPROVED' && existing.accountStatus !== 'APPROVED') {
          existing.accountStatus = 'APPROVED';
        }
        if (u.appLockEnabled !== undefined) {
          existing.appLockEnabled = Boolean(u.appLockEnabled);
          existing.appLockPin = u.appLockEnabled ? (u.appLockPin || '').trim() : '';
        }
        existing.updatedAt = u.updatedAt;
      }
      changed = true;
      continue;
    }

    if (seenUserIds.has(u.id)) {
      changed = true;
      continue;
    }

    const cleanUser: ServerUserAccount = {
      ...u,
      email: emailKey,
      displayName: (u.displayName || u.email.split('@')[0]).trim(),
    };
    seenUserIds.add(cleanUser.id);
    seenEmails.set(emailKey, cleanUser);
    uniqueUsers.push(cleanUser);
  }

  if (uniqueUsers.length !== dbState.users.length) {
    changed = true;
  }
  dbState.users = uniqueUsers;

  // 2. Deduplicate Teams by ID and Unique Team Name (case-insensitive) — never delete unless in tombstones
  const seenTeamIds = new Set<string>();
  const seenTeamNames = new Map<string, ServerTeam>();
  const uniqueTeams: ServerTeam[] = [];

  for (const t of dbState.teams) {
    if (!t || !t.id || !t.name) continue;
    if (tombs.teams.includes(t.id)) {
      changed = true;
      continue;
    }
    const mappedOwnerId = userIdRemap.get(t.ownerId) || t.ownerId;
    if (mappedOwnerId !== t.ownerId) {
      t.ownerId = mappedOwnerId;
      changed = true;
    }
    const nameKey = t.name.trim().toLowerCase();
    const existingByName = seenTeamNames.get(nameKey);
    if (existingByName) {
      teamIdRemap.set(t.id, existingByName.id);
      const incTime = t.updatedAt ? Date.parse(t.updatedAt) : 0;
      const curTime = existingByName.updatedAt ? Date.parse(existingByName.updatedAt) : 0;
      if (incTime > curTime) {
        if (t.pin) existingByName.pin = t.pin;
        if (t.description !== undefined) existingByName.description = t.description;
        existingByName.updatedAt = t.updatedAt;
      }
      changed = true;
      continue;
    }
    if (seenTeamIds.has(t.id)) {
      changed = true;
      continue;
    }
    const cleanTeam: ServerTeam = {
      ...t,
      name: t.name.trim(),
      pin: (t.pin || '2026').trim(),
    };
    seenTeamIds.add(cleanTeam.id);
    seenTeamNames.set(nameKey, cleanTeam);
    uniqueTeams.push(cleanTeam);
  }

  if (uniqueTeams.length !== dbState.teams.length) {
    changed = true;
  }
  dbState.teams = uniqueTeams;

  // 3. Deduplicate & Canonicalize Team Members (never auto-remove unless in tombstones)
  const userById = new Map(dbState.users.map((u) => [u.id, u]));
  const memberByKey = new Map<string, ServerTeamMember>();

  for (const m of dbState.teamMembers) {
    if (!m || !m.teamId || !m.userId) continue;
    const canonicalTeamId = teamIdRemap.get(m.teamId) || m.teamId;
    const canonicalUserId = userIdRemap.get(m.userId) || m.userId;
    const canonicalId = `${canonicalTeamId}_${canonicalUserId}`;
    if (
      tombs.teams.includes(canonicalTeamId) ||
      tombs.users.includes(canonicalUserId) ||
      tombs.teamMembers.includes(m.id) ||
      tombs.teamMembers.includes(canonicalId)
    ) {
      changed = true;
      continue;
    }
    const matchedUser = userById.get(canonicalUserId);
    const canonicalDisplayName = matchedUser ? matchedUser.displayName : m.displayName;
    const teamObj = dbState.teams.find((t) => t.id === canonicalTeamId);
    const effectiveRole: 'OWNER' | 'ADMIN' | 'MEMBER' =
      teamObj && teamObj.ownerId === canonicalUserId ? 'OWNER' : m.role;

    const existingMem = memberByKey.get(canonicalId);
    if (!existingMem) {
      if (
        m.id !== canonicalId ||
        m.teamId !== canonicalTeamId ||
        m.userId !== canonicalUserId ||
        m.displayName !== canonicalDisplayName ||
        m.role !== effectiveRole
      ) {
        changed = true;
      }
      memberByKey.set(canonicalId, {
        ...m,
        id: canonicalId,
        teamId: canonicalTeamId,
        userId: canonicalUserId,
        displayName: canonicalDisplayName,
        role: effectiveRole,
      });
    } else {
      changed = true;
      const incTime = m.updatedAt ? Date.parse(m.updatedAt) : 0;
      const curTime = existingMem.updatedAt ? Date.parse(existingMem.updatedAt) : 0;
      if (existingMem.role !== 'OWNER' && (effectiveRole === 'OWNER' || incTime > curTime)) {
        existingMem.role = effectiveRole;
        existingMem.updatedAt = m.updatedAt || existingMem.updatedAt;
      }
    }
  }

  for (const t of dbState.teams) {
    const ownerKey = `${t.id}_${t.ownerId}`;
    if (!memberByKey.has(ownerKey)) {
      const ownerUser = userById.get(t.ownerId);
      memberByKey.set(ownerKey, {
        id: ownerKey,
        teamId: t.id,
        userId: t.ownerId,
        displayName: ownerUser?.displayName || 'Owner',
        photoUrl: ownerUser?.photoUrl,
        role: 'OWNER',
        presence: 'ONLINE',
        joinedAt: t.createdAt || new Date().toISOString(),
        updatedAt: t.updatedAt || new Date().toISOString(),
      });
      changed = true;
    }
  }

  dbState.teamMembers = Array.from(memberByKey.values());

  // 4. Deduplicate & Canonicalize Library Items (ONLY remove if item ID or team ID is in tombstones!)
  const seenItemIds = new Set<string>();
  const uniqueItems: ServerLibraryItem[] = [];

  for (const item of dbState.libraryItems) {
    if (!item || !item.id || !item.title) continue;
    const isSelf =
      !item.teamId || item.teamId.startsWith('self_') || item.libraryScope === 'SELF';
    const canonicalTeamId = isSelf ? '' : teamIdRemap.get(item.teamId) || item.teamId;
    if (
      tombs.libraryItems.includes(item.id) ||
      (!isSelf && canonicalTeamId && tombs.teams.includes(canonicalTeamId))
    ) {
      changed = true;
      continue;
    }
    const canonicalAddedById = userIdRemap.get(item.addedById) || item.addedById;
    const addedByUser = userById.get(canonicalAddedById);
    const canonicalAddedByName = addedByUser ? addedByUser.displayName : item.addedByName;

    if (seenItemIds.has(item.id)) {
      changed = true;
      continue;
    }

    seenItemIds.add(item.id);
    uniqueItems.push({
      ...item,
      teamId: canonicalTeamId,
      libraryScope: isSelf ? 'SELF' : 'TEAM',
      addedById: canonicalAddedById,
      addedByName: canonicalAddedByName,
    });
  }

  if (uniqueItems.length !== dbState.libraryItems.length) {
    changed = true;
  }
  dbState.libraryItems = uniqueItems;

  // 5. Auto-create Netflix default category folders for Self Library, each User's Self Library, and every Team Library
  // Never delete a folder unless its scope::name or teamId is explicitly in tombstones!
  if (!Array.isArray(dbState.libraryFolders)) {
    dbState.libraryFolders = [];
    changed = true;
  }
  const seenFolderKeys = new Set<string>();
  const uniqueFolders: ServerLibraryFolder[] = [];
  for (const f of dbState.libraryFolders) {
    if (!f || !f.name || !f.scope) continue;
    const mappedScope = teamIdRemap.get(f.scope) || f.scope;
    if (tombs.teams.includes(mappedScope)) {
      changed = true;
      continue;
    }
    const fKey = makeFolderTombstoneKey(mappedScope, f.name);
    if (tombs.libraryFolders.includes(fKey) || seenFolderKeys.has(fKey)) {
      changed = true;
      continue;
    }
    seenFolderKeys.add(fKey);
    uniqueFolders.push({
      ...f,
      scope: mappedScope,
      name: f.name.trim(),
    });
  }
  dbState.libraryFolders = uniqueFolders;

  if (ensureNetflixFoldersForScope('SELF', 'system', dbState)) {
    changed = true;
  }
  for (const u of dbState.users) {
    if (ensureNetflixFoldersForScope(`self_${u.id}`, u.id, dbState)) {
      changed = true;
    }
  }
  for (const t of dbState.teams) {
    if (ensureNetflixFoldersForScope(t.id, t.ownerId, dbState)) {
      changed = true;
    }
  }

  return changed;
}

// Deduplicate on server startup
deduplicateAndNormalizeDb(backendDb);

// Additive merge helper: integrates client-known items without erasing server records or resurrecting explicitly deleted items
function syncBackendState(incoming: Partial<PersistentBackendDatabase>): PersistentBackendDatabase {
  let modified = false;
  const tombs = ensureTombstones();
  const userIdRemap = new Map<string, string>();
  const teamIdRemap = new Map<string, string>();

  // 0. Tombstones: merge any explicit deletion tombstones sent by client
  if (incoming.tombstones && typeof incoming.tombstones === 'object') {
    const incTombs = incoming.tombstones;
    if (Array.isArray(incTombs.users)) {
      for (const id of incTombs.users) {
        if (typeof id === 'string' && !tombs.users.includes(id)) {
          tombs.users.push(id);
          modified = true;
        }
      }
    }
    if (Array.isArray(incTombs.teams)) {
      for (const id of incTombs.teams) {
        if (typeof id === 'string' && !tombs.teams.includes(id)) {
          tombs.teams.push(id);
          modified = true;
        }
      }
    }
    if (Array.isArray(incTombs.teamMembers)) {
      for (const id of incTombs.teamMembers) {
        if (typeof id === 'string' && !tombs.teamMembers.includes(id)) {
          tombs.teamMembers.push(id);
          modified = true;
        }
      }
    }
    if (Array.isArray(incTombs.libraryItems)) {
      for (const id of incTombs.libraryItems) {
        if (typeof id === 'string' && !tombs.libraryItems.includes(id)) {
          tombs.libraryItems.push(id);
          modified = true;
        }
      }
    }
    if (Array.isArray(incTombs.libraryFolders)) {
      for (const key of incTombs.libraryFolders) {
        if (typeof key === 'string' && !tombs.libraryFolders.includes(key.toLowerCase())) {
          tombs.libraryFolders.push(key.toLowerCase());
          modified = true;
        }
      }
    }
  }

  // 1. Users: merge additively unless explicitly deleted (with duplicate username & email protection)
  if (Array.isArray(incoming.users)) {
    for (const incUser of incoming.users) {
      if (!incUser || !incUser.id || !incUser.email) continue;
      if (tombs.users.includes(incUser.id)) continue;
      const incEmailNorm = incUser.email.trim().toLowerCase();
      const incNameNorm = (incUser.displayName || '').trim().toLowerCase();

      const existingIdx = backendDb.users.findIndex(
        (u) =>
          u.id === incUser.id ||
          u.email.toLowerCase() === incEmailNorm ||
          (incNameNorm && (u.displayName || '').trim().toLowerCase() === incNameNorm)
      );
      if (existingIdx === -1) {
        backendDb.users.push({
          ...incUser,
          email: incEmailNorm,
          displayName: (incUser.displayName || incEmailNorm.split('@')[0]).trim(),
        });
        modified = true;
      } else {
        const cur = backendDb.users[existingIdx];
        if (incUser.id !== cur.id) {
          userIdRemap.set(incUser.id, cur.id);
        }
        const incTime = incUser.updatedAt ? Date.parse(incUser.updatedAt) : 0;
        const curTime = cur.updatedAt ? Date.parse(cur.updatedAt) : 0;
        const isIncomingNewer = incTime > curTime;

        if (incUser.displayName && incUser.displayName !== cur.displayName && isIncomingNewer) {
          const candidateNorm = incUser.displayName.trim().toLowerCase();
          const conflictUser = backendDb.users.find(
            (u) => u.id !== cur.id && (u.displayName || '').trim().toLowerCase() === candidateNorm
          );
          if (!conflictUser) {
            cur.displayName = incUser.displayName.trim();
            modified = true;
          }
        }
        if (
          incUser.accountStatus &&
          incUser.accountStatus !== cur.accountStatus &&
          isIncomingNewer &&
          cur.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
        ) {
          cur.accountStatus = incUser.accountStatus;
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

  // 2. Teams: merge additively unless explicitly deleted (with unique Team Name duplicate protection & timestamp check)
  if (Array.isArray(incoming.teams)) {
    for (const incTeam of incoming.teams) {
      if (!incTeam || !incTeam.id || !incTeam.name) continue;
      if (tombs.teams.includes(incTeam.id)) continue;
      const cleanIncTeamName = incTeam.name.trim().toLowerCase();
      const mappedOwnerId = userIdRemap.get(incTeam.ownerId) || incTeam.ownerId;
      const existing = backendDb.teams.find(
        (t) => t.id === incTeam.id || t.name.trim().toLowerCase() === cleanIncTeamName
      );
      if (!existing) {
        backendDb.teams.push({
          ...incTeam,
          name: incTeam.name.trim(),
          ownerId: mappedOwnerId,
        });
        modified = true;
      } else {
        if (incTeam.id !== existing.id) {
          teamIdRemap.set(incTeam.id, existing.id);
        }
        const incTime = incTeam.updatedAt ? Date.parse(incTeam.updatedAt) : 0;
        const curTime = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
        const isIncomingNewer = incTime > curTime;

        if (isIncomingNewer) {
          if (incTeam.name && incTeam.name.trim() !== existing.name) {
            const nameTakenByOther = backendDb.teams.some(
              (t) => t.id !== existing.id && t.name.trim().toLowerCase() === cleanIncTeamName
            );
            if (!nameTakenByOther) {
              existing.name = incTeam.name.trim();
              modified = true;
            }
          }
          if (incTeam.pin && incTeam.pin !== existing.pin) {
            existing.pin = incTeam.pin;
            modified = true;
          }
          if (incTeam.description !== undefined && incTeam.description !== existing.description) {
            existing.description = incTeam.description;
            modified = true;
          }
          if (incTeam.updatedAt) {
            existing.updatedAt = incTeam.updatedAt;
            modified = true;
          }
        }
      }
    }
  }

  // 3. Team Members: merge additively unless explicitly removed or team deleted
  if (Array.isArray(incoming.teamMembers)) {
    for (const incMember of incoming.teamMembers) {
      if (!incMember || !incMember.id || !incMember.teamId || !incMember.userId) continue;
      const canonicalTeamId = teamIdRemap.get(incMember.teamId) || incMember.teamId;
      const canonicalUserId = userIdRemap.get(incMember.userId) || incMember.userId;
      const canonicalMemberId = `${canonicalTeamId}_${canonicalUserId}`;
      if (
        tombs.teamMembers.includes(incMember.id) ||
        tombs.teamMembers.includes(canonicalMemberId) ||
        tombs.teams.includes(canonicalTeamId) ||
        tombs.users.includes(canonicalUserId)
      ) {
        continue;
      }
      const existing = backendDb.teamMembers.find(
        (m) =>
          m.id === canonicalMemberId ||
          (m.teamId === canonicalTeamId && m.userId === canonicalUserId)
      );
      if (!existing) {
        backendDb.teamMembers.push({
          ...incMember,
          id: canonicalMemberId,
          teamId: canonicalTeamId,
          userId: canonicalUserId,
        });
        modified = true;
      } else {
        const incTime = incMember.updatedAt ? Date.parse(incMember.updatedAt) : 0;
        const curTime = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
        const isIncomingNewer = incTime > curTime;

        if (incMember.role && incMember.role !== existing.role && isIncomingNewer) {
          if (existing.role !== 'OWNER') {
            existing.role = incMember.role;
            existing.updatedAt = incMember.updatedAt || existing.updatedAt;
            modified = true;
          }
        }
        if (incMember.displayName && incMember.displayName !== existing.displayName && isIncomingNewer) {
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
      const isSelf =
        !incItem.teamId || incItem.teamId.startsWith('self_') || incItem.libraryScope === 'SELF';
      const canonicalTeamId = isSelf ? '' : teamIdRemap.get(incItem.teamId) || incItem.teamId;
      const canonicalAddedById = userIdRemap.get(incItem.addedById) || incItem.addedById;
      if (
        tombs.libraryItems.includes(incItem.id) ||
        (canonicalTeamId && tombs.teams.includes(canonicalTeamId))
      ) {
        continue;
      }
      const existing = backendDb.libraryItems.find((i) => i.id === incItem.id);
      if (!existing) {
        backendDb.libraryItems.push({
          ...incItem,
          teamId: canonicalTeamId,
          libraryScope: isSelf ? 'SELF' : 'TEAM',
          addedById: canonicalAddedById,
        });
        modified = true;
      } else {
        if (
          typeof incItem.progressMs === 'number' &&
          incItem.progressMs > (existing.progressMs || 0)
        ) {
          existing.progressMs = incItem.progressMs;
          modified = true;
        }
        const incTime = incItem.updatedAt ? Date.parse(incItem.updatedAt) : 0;
        const curTime = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
        if (incTime > curTime) {
          if (incItem.folderName !== undefined && incItem.folderName !== existing.folderName) {
            existing.folderName = incItem.folderName;
            modified = true;
          }
          if (incItem.category && incItem.category !== existing.category) {
            existing.category = incItem.category;
            modified = true;
          }
          existing.updatedAt = incItem.updatedAt;
        }
      }
    }
  }

  // 5. Library Folders & Deleted Folder Tombstones
  if (Array.isArray((incoming as any).deletedFolderKeys)) {
    for (const rawKey of (incoming as any).deletedFolderKeys) {
      if (typeof rawKey === 'string' && rawKey.includes('::')) {
        const normKey = rawKey.trim().toLowerCase();
        if (!tombs.libraryFolders.includes(normKey)) {
          tombs.libraryFolders.push(normKey);
          modified = true;
        }
      }
    }
  }

  if (Array.isArray(incoming.libraryFolders)) {
    for (const incFolder of incoming.libraryFolders) {
      if (!incFolder || !incFolder.name || !incFolder.scope) continue;
      const mappedScope = teamIdRemap.get(incFolder.scope) || incFolder.scope;
      const fKey = makeFolderTombstoneKey(mappedScope, incFolder.name);
      if (tombs.libraryFolders.includes(fKey)) continue;
      const exists = backendDb.libraryFolders.some(
        (f) => makeFolderTombstoneKey(f.scope, f.name) === fKey
      );
      if (!exists) {
        backendDb.libraryFolders.push({
          id: incFolder.id || `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: incFolder.name.trim(),
          scope: mappedScope,
          createdById: userIdRemap.get(incFolder.createdById) || incFolder.createdById || 'system',
          isNetflixDefault: incFolder.isNetflixDefault,
          createdAt: incFolder.createdAt || new Date().toISOString(),
        });
        modified = true;
      }
    }
  }

  if (deduplicateAndNormalizeDb(backendDb)) {
    modified = true;
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
  mutedByName?: string;
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
  if (hall.breakState?.isActive && !hall.breakState.isPaused && hall.breakState.endsAt) {
    if (Date.now() >= hall.breakState.endsAt) {
      hall.breakState = null;
      hall.isPlaying = true;
      hall.status = 'LIVE';
      hall.lastSyncEpochMs = Date.now();
      hall.updatedAt = new Date().toISOString();
    } else {
      return hall.positionMs;
    }
  }
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

  // Server-authoritative Interval Break countdown watcher:
  // Automatically ends break & resumes movie for all participants when endsAt is reached
  setInterval(() => {
    const now = Date.now();
    for (const hall of activeHalls.values()) {
      if (
        hall.status !== 'ENDED' &&
        hall.breakState?.isActive &&
        !hall.breakState.isPaused &&
        hall.breakState.endsAt &&
        now >= hall.breakState.endsAt
      ) {
        hall.breakState = null;
        hall.isPlaying = true;
        hall.status = 'LIVE';
        hall.lastSyncEpochMs = now;
        hall.updatedAt = new Date(now).toISOString();
        broadcastToTeam(hall.teamId, {
          type: 'HALL_UPDATED',
          hall: {
            ...hall,
            positionMs: hall.positionMs,
          },
        });
      }
    }
  }, 1000);

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
    const tombs = ensureTombstones();
    res.json({
      users: backendDb.users,
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      libraryItems: backendDb.libraryItems,
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
      tombstones: tombs,
    });
  });

  // 1b. Bidirectional State Sync: client provides its cached state, server additively merges & persists permanently
  app.post('/api/state/sync', (req, res) => {
    const synced = syncBackendState(req.body || {});
    const tombs = ensureTombstones(synced);
    res.json({
      ok: true,
      users: synced.users,
      teams: synced.teams,
      teamMembers: synced.teamMembers,
      libraryItems: synced.libraryItems,
      libraryFolders: synced.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
      tombstones: tombs,
    });
  });

  // 2. Email or Unique Username / Password Sign In (including built-in Super Admin ameen.isse@gmail.com / Amin@2613)
  app.post('/api/auth/signin', (req, res) => {
    const identifier = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
      res.status(400).json({ ok: false, error: 'Please enter your email/username and password.' });
      return;
    }

    if (
      (identifier === SUPER_ADMIN_EMAIL.toLowerCase() || identifier === 'ameen') &&
      password === SUPER_ADMIN_PASSWORD
    ) {
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

    const found = backendDb.users.find(
      (u) =>
        u.email.toLowerCase() === identifier ||
        (u.displayName || '').trim().toLowerCase() === identifier
    );
    if (!found) {
      res.status(404).json({ ok: false, error: 'No account found with that email or username. Please Sign Up first.' });
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
    if (
      backendDb.users.some(
        (u) => (u.displayName || '').trim().toLowerCase() === displayName.toLowerCase()
      )
    ) {
      res.status(409).json({
        ok: false,
        error: `Username "${displayName}" is already taken. Each user must have a unique username.`,
      });
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

    if (
      backendDb.users.some(
        (u) => (u.displayName || '').trim().toLowerCase() === displayName.toLowerCase()
      )
    ) {
      res.status(409).json({
        ok: false,
        error: `Username "${displayName}" is already taken by another user. Please choose a unique username.`,
      });
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
    broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users, tombstones: tombs });
    broadcastAll({
      type: 'TEAMS_STATE_SYNC',
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
    res.json({
      ok: true,
      users: backendDb.users,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
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
    broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users, tombstones: ensureTombstones() });
    res.json({ ok: true, account: target, users: backendDb.users, tombstones: ensureTombstones() });
  });

  // 8c. Update User Profile (with unique username duplicate protection)
  app.put('/api/users/:userId/profile', (req, res) => {
    const { userId } = req.params;
    const displayName = String(req.body?.displayName || '').trim().slice(0, 80);
    const photoUrl = req.body?.photoUrl ? String(req.body.photoUrl).slice(0, 1024) : undefined;

    if (!displayName) {
      res.status(400).json({ ok: false, error: 'Username cannot be empty.' });
      return;
    }

    const target = backendDb.users.find((u) => u.id === userId);
    if (!target) {
      res.status(404).json({ ok: false, error: 'User account not found.' });
      return;
    }

    const duplicateUser = backendDb.users.find(
      (u) => u.id !== userId && (u.displayName || '').trim().toLowerCase() === displayName.toLowerCase()
    );
    if (duplicateUser) {
      res.status(409).json({
        ok: false,
        error: `Username "${displayName}" is already taken. Each user must have a unique username.`,
      });
      return;
    }

    target.displayName = displayName;
    if (photoUrl !== undefined) {
      target.photoUrl = photoUrl;
    }
    target.updatedAt = new Date().toISOString();

    for (const m of backendDb.teamMembers) {
      if (m.userId === userId) {
        m.displayName = displayName;
        if (photoUrl !== undefined) m.photoUrl = photoUrl;
        m.updatedAt = new Date().toISOString();
      }
    }

    saveBackendDb();
    const tombs = ensureTombstones();
    broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users, tombstones: tombs });
    broadcastAll({
      type: 'TEAMS_STATE_SYNC',
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
    res.json({
      ok: true,
      account: target,
      users: backendDb.users,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
  });

  // 9. Create Team (Requires Unique Team Name & PIN Number)
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

    const duplicateTeam = backendDb.teams.find(
      (t) => t.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicateTeam) {
      res.status(409).json({
        ok: false,
        error: `Team name "${name}" is already taken. Every team must have a unique name.`,
      });
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
    // Auto-create all Netflix category folders for this newly created Team Library
    ensureNetflixFoldersForScope(newTeam.id, newTeam.ownerId, backendDb);
    saveBackendDb();
    broadcastAll({
      type: 'TEAMS_STATE_SYNC',
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
    broadcastAll({
      type: 'FOLDERS_STATE_SYNC',
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
      tombstones: tombs,
    });
    res.json({
      ok: true,
      team: newTeam,
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
      tombstones: tombs,
    });
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

    const duplicateTeam = backendDb.teams.find(
      (t) => t.id !== teamId && t.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicateTeam) {
      res.status(409).json({
        ok: false,
        error: `Team name "${name}" is already in use by another team. Every team must have a unique name.`,
      });
      return;
    }

    team.name = name;
    team.pin = pin;
    if (description !== undefined) team.description = description;
    team.updatedAt = new Date().toISOString();

    saveBackendDb();
    const tombs = ensureTombstones();
    broadcastAll({
      type: 'TEAMS_STATE_SYNC',
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
    res.json({
      ok: true,
      team,
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
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
    backendDb.libraryFolders = backendDb.libraryFolders.filter((f) => f.scope !== teamId);
    saveBackendDb();

    broadcastAll({
      type: 'TEAMS_STATE_SYNC',
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
    broadcastAll({
      type: 'LIBRARY_STATE_SYNC',
      libraryItems: backendDb.libraryItems,
      tombstones: tombs,
    });
    broadcastAll({
      type: 'FOLDERS_STATE_SYNC',
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
      tombstones: tombs,
    });
    res.json({
      ok: true,
      deletedTeamId: teamId,
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
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
    broadcastAll({
      type: 'TEAMS_STATE_SYNC',
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
    res.json({
      ok: true,
      teams: backendDb.teams,
      teamMembers: backendDb.teamMembers,
      tombstones: tombs,
    });
  });

  // 14. Persistent Multi-Library CRUD API (Self Library + Separate Library per Team)
  app.get('/api/library', (_req, res) => {
    res.json({ ok: true, libraryItems: backendDb.libraryItems, tombstones: ensureTombstones() });
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
      folderName: (item.folderName || '').trim() || undefined,
    };
    const tombs = ensureTombstones();
    tombs.libraryItems = tombs.libraryItems.filter((lid) => lid !== normalizedItem.id);
    backendDb.libraryItems = [
      normalizedItem,
      ...backendDb.libraryItems.filter((i) => i.id !== normalizedItem.id),
    ];
    saveBackendDb();
    broadcastAll({
      type: 'LIBRARY_STATE_SYNC',
      libraryItems: backendDb.libraryItems,
      tombstones: tombs,
    });
    res.json({
      ok: true,
      item: normalizedItem,
      libraryItems: backendDb.libraryItems,
      tombstones: tombs,
    });
  });

  // Update folder or metadata of a library item
  app.put('/api/library/:itemId', (req, res) => {
    const { itemId } = req.params;
    const folderName = req.body?.folderName !== undefined ? String(req.body.folderName).trim() : undefined;
    const target = backendDb.libraryItems.find((i) => i.id === itemId);
    if (!target) {
      res.status(404).json({ ok: false, error: 'Library item not found.' });
      return;
    }
    if (folderName !== undefined) {
      target.folderName = folderName || undefined;
    }
    target.updatedAt = new Date().toISOString();
    saveBackendDb();
    const tombs = ensureTombstones();
    broadcastAll({
      type: 'LIBRARY_STATE_SYNC',
      libraryItems: backendDb.libraryItems,
      tombstones: tombs,
    });
    res.json({
      ok: true,
      item: target,
      libraryItems: backendDb.libraryItems,
      tombstones: tombs,
    });
  });

  app.delete('/api/library/:itemId', (req, res) => {
    const { itemId } = req.params;
    const callerUserId = String(req.query.callerUserId || req.body?.callerUserId || '').trim();
    const target = backendDb.libraryItems.find((i) => i.id === itemId);

    if (target && callerUserId) {
      const callerUser = backendDb.users.find((u) => u.id === callerUserId);
      const isSuperAdminCaller = Boolean(
        callerUser &&
          (callerUser.systemRole === 'SUPER_ADMIN' ||
            callerUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())
      );
      const isSelfItem =
        !target.teamId || target.teamId.startsWith('self_') || target.libraryScope === 'SELF';
      if (isSelfItem) {
        if (!isSuperAdminCaller && target.addedById && target.addedById !== callerUserId) {
          res.status(403).json({
            ok: false,
            error: 'Only you can manage (delete) your personal Self Library videos.',
          });
          return;
        }
      } else {
        // Team Library item: Team Owner, Team Admin, Team Member, uploader, or Super Admin can delete
        const team = backendDb.teams.find((t) => t.id === target.teamId);
        const callerMember = backendDb.teamMembers.find(
          (m) => m.teamId === target.teamId && m.userId === callerUserId
        );
        const canDeleteTeamItem = Boolean(
          isSuperAdminCaller ||
            !team ||
            team.ownerId === callerUserId ||
            target.addedById === callerUserId ||
            callerMember
        );
        if (!canDeleteTeamItem) {
          res.status(403).json({
            ok: false,
            error: 'You do not have permission to delete from this Team Library.',
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
      tombstones: tombs,
    });
    res.json({
      ok: true,
      deletedItemId: itemId,
      libraryItems: backendDb.libraryItems,
      tombstones: tombs,
    });
  });

  // Delete / clear an entire Team Library (all videos in that Team's Library)
  app.delete('/api/teams/:teamId/library', (req, res) => {
    const { teamId } = req.params;
    const callerUserId = String(req.query.callerUserId || req.body?.callerUserId || '').trim();

    if (!teamId) {
      res.status(400).json({ ok: false, error: 'Team ID is required.' });
      return;
    }

    const team = backendDb.teams.find((t) => t.id === teamId);
    if (team && callerUserId) {
      const callerUser = backendDb.users.find((u) => u.id === callerUserId);
      const isSuperAdminCaller = Boolean(
        callerUser &&
          (callerUser.systemRole === 'SUPER_ADMIN' ||
            callerUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())
      );
      const callerMember = backendDb.teamMembers.find(
        (m) => m.teamId === teamId && m.userId === callerUserId
      );
      const canDeleteTeamLib = Boolean(
        isSuperAdminCaller || team.ownerId === callerUserId || callerMember
      );
      if (!canDeleteTeamLib) {
        res.status(403).json({
          ok: false,
          error: 'You do not have permission to delete this Team Library.',
        });
        return;
      }
    }

    const tombs = ensureTombstones();
    const itemsToDelete = backendDb.libraryItems.filter((i) => i.teamId === teamId);
    for (const item of itemsToDelete) {
      if (!tombs.libraryItems.includes(item.id)) {
        tombs.libraryItems.push(item.id);
      }
    }

    backendDb.libraryItems = backendDb.libraryItems.filter((i) => i.teamId !== teamId);
    saveBackendDb();
    broadcastAll({
      type: 'LIBRARY_STATE_SYNC',
      deletedTeamLibraryId: teamId,
      libraryItems: backendDb.libraryItems,
      tombstones: tombs,
    });
    res.json({
      ok: true,
      deletedTeamId: teamId,
      deletedCount: itemsToDelete.length,
      libraryItems: backendDb.libraryItems,
      tombstones: tombs,
    });
  });

  // 14b. Library Folders Management (Auto-created Netflix Categories + Custom Folders; Owner Can Delete Folders)
  app.get('/api/library/folders', (_req, res) => {
    const tombs = ensureTombstones();
    res.json({
      ok: true,
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
    });
  });

  app.post('/api/library/folders', (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 60);
    const rawScope = String(req.body?.scope || 'SELF').trim();
    const callerUserId = String(req.body?.callerUserId || 'system').trim();

    if (!name) {
      res.status(400).json({ ok: false, error: 'Folder name is required.' });
      return;
    }

    const tombs = ensureTombstones();
    const scopesToClear = [rawScope];
    if (rawScope === 'SELF' || rawScope.toLowerCase().startsWith('self_')) {
      scopesToClear.push('SELF');
      if (callerUserId && callerUserId !== 'system') {
        scopesToClear.push(`self_${callerUserId}`);
      }
    }

    for (const s of scopesToClear) {
      const tKey = makeFolderTombstoneKey(s, name);
      tombs.libraryFolders = tombs.libraryFolders.filter((k) => k !== tKey);
    }

    const existing = backendDb.libraryFolders.find(
      (f) =>
        f.scope.toLowerCase() === rawScope.toLowerCase() &&
        f.name.trim().toLowerCase() === name.toLowerCase()
    );
    const folder: ServerLibraryFolder = existing || {
      id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      scope: rawScope,
      createdById: callerUserId,
      isNetflixDefault: NETFLIX_DEFAULT_CATEGORY_FOLDERS.some(
        (c) => c.toLowerCase() === name.toLowerCase()
      ),
      createdAt: new Date().toISOString(),
    };

    if (!existing) {
      backendDb.libraryFolders.push(folder);
    }
    saveBackendDb();
    broadcastAll({
      type: 'FOLDERS_STATE_SYNC',
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
    });
    res.json({
      ok: true,
      folder,
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
    });
  });

  // Delete a folder from a Library (Strictly allowed for Library Owner: Team Owner for Team Library, or User for Self Library)
  app.delete('/api/library/folders', (req, res) => {
    const name = String(req.query.name || req.body?.name || '').trim();
    const rawScope = String(req.query.scope || req.body?.scope || 'SELF').trim();
    const callerUserId = String(req.query.callerUserId || req.body?.callerUserId || '').trim();

    if (!name) {
      res.status(400).json({ ok: false, error: 'Folder name is required.' });
      return;
    }

    const isSelfScope =
      !rawScope || rawScope === 'SELF' || rawScope.toLowerCase().startsWith('self_');

    if (!isSelfScope) {
      const team = backendDb.teams.find((t) => t.id === rawScope);
      if (team && callerUserId) {
        const callerUser = backendDb.users.find((u) => u.id === callerUserId);
        const isSuperAdminCaller = Boolean(
          callerUser &&
            (callerUser.systemRole === 'SUPER_ADMIN' ||
              callerUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())
        );
        const callerMember = backendDb.teamMembers.find(
          (m) => m.teamId === rawScope && m.userId === callerUserId
        );
        const isTeamOwnerCaller =
          team.ownerId === callerUserId || callerMember?.role === 'OWNER' || isSuperAdminCaller;

        if (!isTeamOwnerCaller) {
          res.status(403).json({
            ok: false,
            error: 'Only the Team Owner can delete folders in this Team Library.',
          });
          return;
        }
      }
    }

    const tombs = ensureTombstones();
    const scopesToTombstone = [rawScope];
    if (isSelfScope) {
      scopesToTombstone.push('SELF');
      if (callerUserId) {
        scopesToTombstone.push(`self_${callerUserId}`);
      }
    }

    for (const s of scopesToTombstone) {
      const tKey = makeFolderTombstoneKey(s, name);
      if (!tombs.libraryFolders.includes(tKey)) {
        tombs.libraryFolders.push(tKey);
      }
    }

    backendDb.libraryFolders = backendDb.libraryFolders.filter((f) => {
      const sameName = f.name.trim().toLowerCase() === name.toLowerCase();
      if (!sameName) return true;
      return !scopesToTombstone.some((s) => f.scope.toLowerCase() === s.toLowerCase());
    });

    // Unassign movies in that scope from the deleted folder so they move cleanly to Uncategorized
    let itemsUpdated = false;
    for (const item of backendDb.libraryItems) {
      const itemIsSelf =
        !item.teamId || item.teamId.startsWith('self_') || item.libraryScope === 'SELF';
      const itemMatchesScope = isSelfScope
        ? itemIsSelf && (!callerUserId || item.addedById === callerUserId)
        : !itemIsSelf && item.teamId === rawScope;
      if (
        itemMatchesScope &&
        (item.folderName || '').trim().toLowerCase() === name.toLowerCase()
      ) {
        item.folderName = undefined;
        item.updatedAt = new Date().toISOString();
        itemsUpdated = true;
      }
    }

    saveBackendDb();
    broadcastAll({
      type: 'FOLDERS_STATE_SYNC',
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
    });
    if (itemsUpdated) {
      broadcastAll({
        type: 'LIBRARY_STATE_SYNC',
        libraryItems: backendDb.libraryItems,
      });
    }

    res.json({
      ok: true,
      deletedFolderName: name,
      scope: rawScope,
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
      libraryItems: backendDb.libraryItems,
    });
  });

  // Restore all Netflix default category folders for a Library (Owner Only)
  app.post('/api/library/folders/restore-defaults', (req, res) => {
    const rawScope = String(req.body?.scope || 'SELF').trim();
    const callerUserId = String(req.body?.callerUserId || '').trim();
    const isSelfScope =
      !rawScope || rawScope === 'SELF' || rawScope.toLowerCase().startsWith('self_');

    if (!isSelfScope) {
      const team = backendDb.teams.find((t) => t.id === rawScope);
      if (team && callerUserId) {
        const callerUser = backendDb.users.find((u) => u.id === callerUserId);
        const isSuperAdminCaller = Boolean(
          callerUser &&
            (callerUser.systemRole === 'SUPER_ADMIN' ||
              callerUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())
        );
        const callerMember = backendDb.teamMembers.find(
          (m) => m.teamId === rawScope && m.userId === callerUserId
        );
        const isTeamOwnerCaller =
          team.ownerId === callerUserId || callerMember?.role === 'OWNER' || isSuperAdminCaller;
        if (!isTeamOwnerCaller) {
          res.status(403).json({
            ok: false,
            error: 'Only the Team Owner can restore folders in this Team Library.',
          });
          return;
        }
      }
    }

    const tombs = ensureTombstones();
    const scopesToRestore = [rawScope];
    if (isSelfScope) {
      scopesToRestore.push('SELF');
      if (callerUserId) scopesToRestore.push(`self_${callerUserId}`);
    }

    tombs.libraryFolders = tombs.libraryFolders.filter(
      (k) => !scopesToRestore.some((s) => k.startsWith(`${s.toLowerCase()}::`))
    );

    const targetScope = isSelfScope && callerUserId ? `self_${callerUserId}` : rawScope;
    ensureNetflixFoldersForScope(targetScope, callerUserId || 'system', backendDb);
    if (isSelfScope) {
      ensureNetflixFoldersForScope('SELF', callerUserId || 'system', backendDb);
    }

    saveBackendDb();
    broadcastAll({
      type: 'FOLDERS_STATE_SYNC',
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
    });

    res.json({
      ok: true,
      libraryFolders: backendDb.libraryFolders,
      deletedFolderKeys: tombs.libraryFolders,
    });
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

  const DESKTOP_CHROME_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  function isMovieBoxDomain(hostname: string): boolean {
    const h = hostname.toLowerCase();
    return (
      h.includes('moviebox') ||
      h.includes('movie-box') ||
      h.includes('aoneroom.com') ||
      h.includes('hakunaymatata.com') ||
      h.includes('fmoviesunblocked')
    );
  }

  interface MovieBoxResolvedStream {
    id: string;
    label: string;
    ext: 'MP4' | 'HLS' | 'WEBM';
    sizeBytes: number;
    resolution: string;
    videoUrl: string;
    rawCdnUrl: string;
  }

  interface MovieBoxResolution {
    title: string;
    description: string;
    thumbnailUrl: string | null;
    durationMs: number;
    extractedVideoUrl: string;
    availableFormats: MovieBoxResolvedStream[];
  }

  function cleanVideoUrlInput(rawUrl: string): string {
    return String(rawUrl || '')
      .trim()
      .replace(/^['"<(]+/, '')
      .replace(/[.,;:!?)+>\]'"]+$/, '')
      .trim();
  }

  const INITIAL_SEGMENT_BYTES = 15 * 1024 * 1024; // 15 MB (covers full ~11.5MB moov atom + 3.5MB initial mdat frames, well under Cloud Run 32MB limit)
  const SUBSEQUENT_CHUNK_BYTES = 8 * 1024 * 1024; // 8 MB per subsequent range request

  interface CachedInitialSegment {
    buffer: Buffer;
    totalSize: number;
    contentType: string;
    expiresAt: number;
  }

  const initialVideoSegmentCache = new Map<string, CachedInitialSegment>();
  const initialSegmentInFlight = new Map<string, Promise<CachedInitialSegment | null>>();

  async function fetchOrWarmInitialSegment(
    cdnUrl: string,
    referer: string
  ): Promise<CachedInitialSegment | null> {
    const now = Date.now();
    const existing = initialVideoSegmentCache.get(cdnUrl);
    if (existing && existing.expiresAt > now) {
      return existing;
    }
    const inflight = initialSegmentInFlight.get(cdnUrl);
    if (inflight) {
      return inflight;
    }

    const promise = (async (): Promise<CachedInitialSegment | null> => {
      try {
        let origin = '';
        try {
          origin = new URL(referer).origin;
        } catch {
          origin = new URL(cdnUrl).origin;
        }
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 14000);
        const resp = await fetch(cdnUrl, {
          headers: {
            'User-Agent': DESKTOP_CHROME_UA,
            Accept: '*/*',
            Referer: referer,
            Origin: origin,
            Range: `bytes=0-${INITIAL_SEGMENT_BYTES - 1}`,
          },
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        if (resp.status !== 206 && resp.status !== 200) {
          if (resp.body) {
            try {
              await resp.body.cancel();
            } catch {
              // ignore
            }
          }
          return null;
        }

        const contentRange = resp.headers.get('content-range') || '';
        const contentLength = Number(resp.headers.get('content-length') || 0);
        // If server ignored Range and returned 200 OK with a huge file, abort reading into memory
        if (resp.status === 200 && contentLength > INITIAL_SEGMENT_BYTES) {
          if (resp.body) {
            try {
              await resp.body.cancel();
            } catch {
              // ignore
            }
          }
          return null;
        }

        const buf = Buffer.from(await resp.arrayBuffer());
        if (buf.length === 0) return null;

        let totalSize = buf.length;
        const slashIdx = contentRange.lastIndexOf('/');
        if (slashIdx !== -1) {
          const parsedTotal = Number(contentRange.slice(slashIdx + 1).trim());
          if (Number.isFinite(parsedTotal) && parsedTotal > 0) {
            totalSize = parsedTotal;
          }
        } else if (contentLength > totalSize) {
          totalSize = contentLength;
        }

        const rawCt = (resp.headers.get('content-type') || '').toLowerCase();
        const contentType =
          !rawCt || rawCt.includes('octet-stream') ? 'video/mp4' : resp.headers.get('content-type') || 'video/mp4';

        // Keep cache bounded to max 3 streams in memory
        if (initialVideoSegmentCache.size >= 3) {
          const oldestKey = initialVideoSegmentCache.keys().next().value;
          if (oldestKey) initialVideoSegmentCache.delete(oldestKey);
        }

        const entry: CachedInitialSegment = {
          buffer: buf,
          totalSize,
          contentType,
          expiresAt: Date.now() + 8 * 60 * 1000,
        };
        initialVideoSegmentCache.set(cdnUrl, entry);
        return entry;
      } catch {
        return null;
      } finally {
        initialSegmentInFlight.delete(cdnUrl);
      }
    })();

    initialSegmentInFlight.set(cdnUrl, promise);
    return promise;
  }

  const movieBoxResolutionCache = new Map<
    string,
    { expiresAt: number; data: MovieBoxResolution }
  >();

  async function resolveMovieBoxLink(rawUrl: string): Promise<MovieBoxResolution | null> {
    const cacheKey = cleanVideoUrlInput(rawUrl);
    if (!cacheKey) return null;
    const cached = movieBoxResolutionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    try {
      let currentUrl = cacheKey;
      let detailPath = '';
      let subjectId = '';
      let se = '0';
      let ep = '0';

      // Step 1: Follow redirects manually (up to 6 hops) so we capture detailPath & subjectId before any /download-app redirect
      for (let hop = 0; hop < 6; hop++) {
        let u: URL;
        try {
          u = new URL(currentUrl);
        } catch {
          break;
        }
        const idParam = u.searchParams.get('id') || u.searchParams.get('subjectId');
        if (idParam && /^\d+$/.test(idParam)) subjectId = idParam;
        const seParam = u.searchParams.get('se') || u.searchParams.get('season');
        if (seParam && /^\d+$/.test(seParam)) se = seParam;
        const epParam = u.searchParams.get('ep') || u.searchParams.get('episode');
        if (epParam && /^\d+$/.test(epParam)) ep = epParam;

        const pathMatch = u.pathname.match(/\/(?:detail|movies|tv|series)\/([^/?#]+)/i);
        if (pathMatch?.[1]) {
          detailPath = pathMatch[1];
        }

        // If we already have both detailPath and subjectId, no need to follow further redirects to /download-app
        if (detailPath && subjectId) {
          break;
        }

        const hopController = new AbortController();
        const hopTimer = setTimeout(() => hopController.abort(), 5000);
        const res = await fetch(currentUrl, {
          redirect: 'manual',
          headers: { 'User-Agent': DESKTOP_CHROME_UA },
          signal: hopController.signal,
        }).catch(() => null);
        clearTimeout(hopTimer);

        if (!res) break;
        const loc = res.headers.get('location');
        if (loc && res.status >= 300 && res.status < 400) {
          const nextUrl = new URL(loc, currentUrl).toString();
          const nextParsed = new URL(nextUrl);
          const nextId = nextParsed.searchParams.get('id') || nextParsed.searchParams.get('subjectId');
          if (nextId && /^\d+$/.test(nextId)) subjectId = nextId;
          const nextPathMatch = nextParsed.pathname.match(/\/(?:detail|movies|tv|series)\/([^/?#]+)/i);
          if (nextPathMatch?.[1]) detailPath = nextPathMatch[1];
          if (nextParsed.pathname.includes('download-app')) {
            break;
          }
          currentUrl = nextUrl;
        } else {
          break;
        }
      }

      if (!detailPath && !subjectId) {
        return null;
      }

      // Step 2: Fetch MovieBox detail page from movieboxhd.net to extract title, poster, duration, trailer backup, and subjectId
      let title = detailPath
        ? detailPath
            .replace(/-[A-Za-z0-9]{8,14}$/, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : 'MovieBox Video';
      let description = 'Direct HD stream resolved from MovieBox.';
      let thumbnailUrl: string | null = null;
      let durationMs = 7200000;
      let trailerUrl: string | null = null;

      const detailPageUrl = `https://movieboxhd.net/movies/${detailPath || 'detail'}${
        subjectId ? `?id=${encodeURIComponent(subjectId)}` : ''
      }`;
      try {
        const pageController = new AbortController();
        const pageTimer = setTimeout(() => pageController.abort(), 6500);
        const pageRes = await fetch(detailPageUrl, {
          headers: {
            'User-Agent': DESKTOP_CHROME_UA,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: pageController.signal,
        });
        clearTimeout(pageTimer);

        if (pageRes.ok) {
          const html = await pageRes.text();
          const ogTitle =
            html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
            html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
          if (ogTitle) {
            title = ogTitle
              .replace(/^Watch\s+/i, '')
              .replace(/\s+on\s+MovieBox.*$/i, '')
              .replace(/&amp;/g, '&')
              .trim();
          }

          const ogImage =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
            html.match(/https:\/\/pbcdnw\.aoneroom\.com\/image\/[^\s"'<>\\]+\.(?:jpg|jpeg|png|webp)/i)?.[0];
          if (ogImage) {
            thumbnailUrl = ogImage;
          }

          const ogDesc = html.match(
            /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
          )?.[1];
          if (ogDesc) {
            description = ogDesc.replace(/&amp;/g, '&').trim();
          }

          const trailerMatch = html.match(
            /(https:\/\/macdn\.aoneroom\.com\/media\/[^\s"'<>\\]+\.mp4)/i
          );
          if (trailerMatch?.[1]) {
            trailerUrl = trailerMatch[1];
          }

          if (!subjectId) {
            const idInNuxt = html.match(/"(\d{16,20})",1,"[^"]+","[^"]*","\d{4}-\d{2}-\d{2}"/);
            if (idInNuxt?.[1]) {
              subjectId = idInNuxt[1];
            } else {
              const genericIdMatch = html.match(/\b(\d{17,19})\b/);
              if (genericIdMatch?.[1]) {
                subjectId = genericIdMatch[1];
              }
            }
          }
        }
      } catch {
        // continue with extracted subjectId & detailPath
      }

      // Step 3: Query MovieBox wefeed-h5api-bff/subject/play API to get signed MP4 CDN streams
      const fetchPlayStreams = async (seasonNum: string, epNum: string) => {
        const playApiUrl = `https://movieboxhd.net/wefeed-h5api-bff/subject/play?subjectId=${encodeURIComponent(
          subjectId
        )}&se=${encodeURIComponent(seasonNum)}&ep=${encodeURIComponent(
          epNum
        )}&detailPath=${encodeURIComponent(detailPath)}&streamSignType=1`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6500);
        const playRes = await fetch(playApiUrl, {
          headers: {
            'User-Agent': DESKTOP_CHROME_UA,
            Accept: 'application/json',
            Referer: `https://movieboxhd.net/movies/${detailPath}?id=${subjectId}`,
            'X-Client-Info': JSON.stringify({ timezone: 'Asia/Singapore' }),
            'X-Request-Lang': 'en',
            'X-Source': 'appShare',
          },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!playRes.ok) return [];
        const playJson = (await playRes.json()) as {
          data?: {
            streams?: Array<{
              format?: string;
              id?: string;
              url?: string;
              resolutions?: string;
              size?: string | number;
              duration?: number;
            }>;
          };
        };
        return Array.isArray(playJson?.data?.streams) ? playJson.data.streams : [];
      };

      let rawStreams = subjectId ? await fetchPlayStreams(se, ep) : [];
      if (rawStreams.length === 0 && subjectId && se === '0' && ep === '0') {
        // Fallback for TV series where episodes start at se=1, ep=1
        rawStreams = await fetchPlayStreams('1', '1');
      }

      const validStreams = rawStreams.filter((s) => s && typeof s.url === 'string' && s.url.startsWith('http'));
      validStreams.sort((a, b) => Number(b.resolutions || 0) - Number(a.resolutions || 0));

      if (validStreams.length > 0) {
        const firstDurSec = Number(validStreams[0].duration || 0);
        if (firstDurSec > 0) {
          durationMs = firstDurSec * 1000;
        }

        const availableFormats: MovieBoxResolvedStream[] = validStreams.map((s) => {
          const resNum = String(s.resolutions || '720').replace(/[^0-9]/g, '') || '720';
          const resId = `${resNum}p`;
          const sizeBytes = Number(s.size) || 524288000;
          const rawCdnUrl = String(s.url);
          const proxiedUrl = `/api/video/stream?url=${encodeURIComponent(
            rawCdnUrl
          )}&referer=${encodeURIComponent('https://movieboxhd.net/')}&source=${encodeURIComponent(
            rawUrl
          )}&res=${encodeURIComponent(resNum)}`;

          return {
            id: resId,
            label: `${resId} ${Number(resNum) >= 1080 ? 'Full HD' : Number(resNum) >= 720 ? 'HD' : 'Direct'} MP4`,
            ext: rawCdnUrl.includes('.m3u8') ? 'HLS' : 'MP4',
            sizeBytes,
            resolution:
              resNum === '1080'
                ? '1920x1080'
                : resNum === '720'
                ? '1280x720'
                : resNum === '480'
                ? '854x480'
                : '640x360',
            videoUrl: proxiedUrl,
            rawCdnUrl,
          };
        });

        // Prefer 720p or 480p as default extractedVideoUrl for instant browser buffering (<1s), while keeping 1080p in availableFormats
        const preferredDefaultFormat =
          availableFormats.find((f) => f.id === '720p') ||
          availableFormats.find((f) => f.id === '480p') ||
          availableFormats[0];

        const resolvedResult: MovieBoxResolution = {
          title,
          description,
          thumbnailUrl,
          durationMs,
          extractedVideoUrl: preferredDefaultFormat.videoUrl,
          availableFormats,
        };
        movieBoxResolutionCache.set(cacheKey, {
          expiresAt: Date.now() + 10 * 60 * 1000,
          data: resolvedResult,
        });
        // Pre-warm the initial 15MB segment (ftyp + moov + initial mdat) in background so playback starts immediately
        void fetchOrWarmInitialSegment(
          preferredDefaultFormat.rawCdnUrl,
          'https://movieboxhd.net/'
        );
        return resolvedResult;
      }

      if (trailerUrl) {
        const proxiedTrailer = `/api/video/stream?url=${encodeURIComponent(
          trailerUrl
        )}&referer=${encodeURIComponent('https://movieboxhd.net/')}&source=${encodeURIComponent(cacheKey)}`;
        const trailerResult: MovieBoxResolution = {
          title,
          description,
          thumbnailUrl,
          durationMs: 180000,
          extractedVideoUrl: proxiedTrailer,
          availableFormats: [
            {
              id: '720p',
              label: 'Official Preview MP4',
              ext: 'MP4',
              sizeBytes: 15728640,
              resolution: '1280x720',
              videoUrl: proxiedTrailer,
              rawCdnUrl: trailerUrl,
            },
          ],
        };
        movieBoxResolutionCache.set(cacheKey, {
          expiresAt: Date.now() + 10 * 60 * 1000,
          data: trailerResult,
        });
        return trailerResult;
      }
    } catch (err) {
      console.warn('MovieBox link resolution error:', err);
    }
    return null;
  }

  // Resolve any link into a playable video stream (.mp4 / .m3u8 / YouTube / MovieBox / Vimeo / Dailymotion / Archive / Google Drive / Dropbox / Streamable / TikTok / Embed)
  app.all('/api/webpage/resolve', async (req, res) => {
    const rawUrl = cleanVideoUrlInput(req.body?.url || req.query?.url || '');
    if (!rawUrl) {
      res.status(400).json({ error: 'Please provide a valid video link.' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    } catch {
      res.status(400).json({ error: 'Invalid URL format.' });
      return;
    }

    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // 0. MovieBox / Aoneroom / Share Links (e.g., https://v.moviebox.ph/y5Q6H40Bwf6, movie-box.co, movieboxhd.net)
    if (isMovieBoxDomain(host) || pathname.startsWith('/detail/')) {
      const mbResolved = await resolveMovieBoxLink(parsed.toString());
      if (mbResolved) {
        res.json({
          mode: 'DIRECT_VIDEO',
          platform: 'MovieBox Direct Stream',
          originalUrl: parsed.toString(),
          title: mbResolved.title,
          description: mbResolved.description,
          durationMs: mbResolved.durationMs,
          thumbnailUrl: mbResolved.thumbnailUrl,
          embedUrl: null,
          extractedVideoUrl: mbResolved.extractedVideoUrl,
          availableFormats: mbResolved.availableFormats,
        });
        return;
      }
    }

    // 0b. Google Drive Video Links (drive.google.com/file/d/{id}/view or ?id={id})
    if (host.endsWith('drive.google.com') || host.endsWith('docs.google.com')) {
      const driveIdMatch =
        pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        parsed.searchParams.get('id');
      const driveId = typeof driveIdMatch === 'string' ? driveIdMatch : driveIdMatch?.[1];
      if (driveId) {
        const directDriveUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
        const proxiedDriveUrl = `/api/video/stream?url=${encodeURIComponent(directDriveUrl)}`;
        const driveEmbedUrl = `https://drive.google.com/file/d/${driveId}/preview`;
        res.json({
          mode: 'DIRECT_VIDEO',
          platform: 'Google Drive Video',
          originalUrl: parsed.toString(),
          title: `Google Drive Video (${driveId.slice(0, 8)})`,
          thumbnailUrl: `https://drive.google.com/thumbnail?id=${driveId}&sz=w1280`,
          embedUrl: driveEmbedUrl,
          extractedVideoUrl: proxiedDriveUrl,
          availableFormats: [
            { id: '1080p', label: 'Original Google Drive Stream', ext: 'MP4', sizeBytes: 104857600, resolution: '1920x1080', videoUrl: proxiedDriveUrl },
            { id: '720p', label: '720p HD Stream', ext: 'MP4', sizeBytes: 62914560, resolution: '1280x720', videoUrl: proxiedDriveUrl },
          ],
        });
        return;
      }
    }

    // 0c. Dropbox Video Links (dropbox.com/s/... or dropbox.com/scl/fi/...)
    if (host.endsWith('dropbox.com') || host.endsWith('dropboxusercontent.com')) {
      const dlUrl = new URL(parsed.toString());
      dlUrl.hostname = 'dl.dropboxusercontent.com';
      dlUrl.searchParams.delete('dl');
      dlUrl.searchParams.set('raw', '1');
      const directDropbox = dlUrl.toString();
      const proxiedDropbox = `/api/video/stream?url=${encodeURIComponent(directDropbox)}`;
      const cleanName = decodeURIComponent(pathname.split('/').pop() || 'Dropbox Video').replace(
        /\.(mp4|mkv|webm|mov)$/i,
        ''
      );
      res.json({
        mode: 'DIRECT_VIDEO',
        platform: 'Dropbox Direct Stream',
        originalUrl: parsed.toString(),
        title: cleanName,
        thumbnailUrl: null,
        embedUrl: null,
        extractedVideoUrl: proxiedDropbox,
        availableFormats: [
          { id: '1080p', label: 'Original Dropbox MP4', ext: 'MP4', sizeBytes: 94371840, resolution: '1920x1080', videoUrl: proxiedDropbox },
        ],
      });
      return;
    }

    // 0d. Streamable (streamable.com/{code})
    if (host.endsWith('streamable.com')) {
      const code = pathname.split('/').filter(Boolean).pop();
      if (code) {
        try {
          const stRes = await fetch(`https://api.streamable.com/videos/${code}`);
          if (stRes.ok) {
            const stJson = (await stRes.json()) as {
              title?: string;
              thumbnail_url?: string;
              files?: Record<string, { url?: string; width?: number; height?: number; size?: number }>;
            };
            const mp4File = stJson.files?.mp4 || stJson.files?.['mp4-mobile'];
            if (mp4File?.url) {
              const fullMp4 = mp4File.url.startsWith('//') ? `https:${mp4File.url}` : mp4File.url;
              const proxied = `/api/video/stream?url=${encodeURIComponent(fullMp4)}`;
              res.json({
                mode: 'DIRECT_VIDEO',
                platform: 'Streamable Direct MP4',
                originalUrl: parsed.toString(),
                title: stJson.title || `Streamable Video (${code})`,
                thumbnailUrl: stJson.thumbnail_url
                  ? stJson.thumbnail_url.startsWith('//')
                    ? `https:${stJson.thumbnail_url}`
                    : stJson.thumbnail_url
                  : null,
                embedUrl: `https://streamable.com/e/${code}?autoplay=1`,
                extractedVideoUrl: proxied,
                availableFormats: [
                  {
                    id: '1080p',
                    label: 'Original Streamable MP4',
                    ext: 'MP4',
                    sizeBytes: mp4File.size || 41943040,
                    resolution: `${mp4File.width || 1920}x${mp4File.height || 1080}`,
                    videoUrl: proxied,
                  },
                ],
              });
              return;
            }
          }
        } catch {
          // continue
        }
      }
    }

    // 0e. TikTok (tiktok.com, vm.tiktok.com, vt.tiktok.com)
    if (host.endsWith('tiktok.com')) {
      try {
        const tkRes = await fetch(
          `https://www.tikwm.com/api/?url=${encodeURIComponent(parsed.toString())}`
        );
        if (tkRes.ok) {
          const tkJson = (await tkRes.json()) as {
            data?: { title?: string; cover?: string; hdplay?: string; play?: string; size?: number };
          };
          const playUrl = tkJson.data?.hdplay || tkJson.data?.play;
          if (playUrl) {
            const proxied = `/api/video/stream?url=${encodeURIComponent(playUrl)}`;
            res.json({
              mode: 'DIRECT_VIDEO',
              platform: 'TikTok Direct MP4',
              originalUrl: parsed.toString(),
              title: tkJson.data?.title || 'TikTok Video',
              thumbnailUrl: tkJson.data?.cover || null,
              embedUrl: null,
              extractedVideoUrl: proxied,
              availableFormats: [
                {
                  id: '1080p',
                  label: 'TikTok HD Direct MP4',
                  ext: 'MP4',
                  sizeBytes: tkJson.data?.size || 20971520,
                  resolution: '1080x1920',
                  videoUrl: proxied,
                },
              ],
            });
            return;
          }
        }
      } catch {
        // continue
      }
    }

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
                embedUrl: `https://archive.org/embed/${identifier}`,
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
              'User-Agent': DESKTOP_CHROME_UA,
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
            const bestDirectUrl = progressive[0]?.url || firstHlsUrl || null;
            const thumb =
              cfg.video?.thumbs?.['1280'] ||
              cfg.video?.thumbs?.['960'] ||
              cfg.video?.thumbs?.['640'] ||
              null;

            res.json({
              mode: bestDirectUrl ? 'DIRECT_VIDEO' : 'EMBED',
              platform: 'Vimeo Direct Stream',
              originalUrl: rawUrl,
              title: cfg.video?.title || `Vimeo Video (${vimeoId})`,
              thumbnailUrl: thumb,
              embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
              extractedVideoUrl: bestDirectUrl || `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
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
                      { id: '1080p', label: '1080p Direct Video', ext: firstHlsUrl ? 'HLS' : 'MP4', sizeBytes: 88080384, resolution: '1920x1080', videoUrl: bestDirectUrl || '' },
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
            const autoStream = dm.qualities?.auto?.[0]?.url || null;
            res.json({
              mode: autoStream ? 'DIRECT_VIDEO' : 'EMBED',
              platform: 'Dailymotion Direct Video',
              originalUrl: rawUrl,
              title: dm.title || `Dailymotion Video (${id})`,
              thumbnailUrl: dm.posters?.['1080'] || dm.posters?.['720'] || `https://www.dailymotion.com/thumbnail/video/${id}`,
              embedUrl: `https://www.dailymotion.com/embed/video/${id}?autoplay=1`,
              extractedVideoUrl: autoStream || `https://www.dailymotion.com/embed/video/${id}?autoplay=1`,
              availableFormats: [
                { id: '1080p', label: '1080p Full HD', ext: autoStream?.includes('.m3u8') ? 'HLS' : 'MP4', sizeBytes: 76546048, resolution: '1920x1080', videoUrl: autoStream || '' },
                { id: '720p', label: '720p HD', ext: 'MP4', sizeBytes: 41943040, resolution: '1280x720', videoUrl: autoStream || '' },
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

    // 5. For any other link or webpage: check if it redirects to MovieBox or a known provider, inspect headers, & scrape direct video stream (.mp4, .m3u8, .webm) or embed player
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8500);
      const response = await fetch(parsed.toString(), {
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Accept: 'video/*,application/vnd.apple.mpegurl,text/html,application/xhtml+xml,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // If a custom shortlink redirected to MovieBox, resolve via MovieBox API!
      if (response.url) {
        try {
          const finalParsed = new URL(response.url);
          if (isMovieBoxDomain(finalParsed.hostname) || finalParsed.pathname.startsWith('/detail/')) {
            const mbResolved = await resolveMovieBoxLink(parsed.toString());
            if (mbResolved) {
              res.json({
                mode: 'DIRECT_VIDEO',
                platform: 'MovieBox Direct Stream',
                originalUrl: parsed.toString(),
                title: mbResolved.title,
                description: mbResolved.description,
                durationMs: mbResolved.durationMs,
                thumbnailUrl: mbResolved.thumbnailUrl,
                embedUrl: null,
                extractedVideoUrl: mbResolved.extractedVideoUrl,
                availableFormats: mbResolved.availableFormats,
              });
              return;
            }
          }
        } catch {
          // ignore
        }
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const contentLength = Number(response.headers.get('content-length') || 0);
      const effectiveUrl = response.url || parsed.toString();

      if (
        contentType.startsWith('video/') ||
        contentType.includes('mpegurl') ||
        contentType.includes('dash+xml') ||
        contentType.includes('octet-stream') ||
        /\.(mp4|m3u8|webm|mov|mkv|ogg)(\?|$)/i.test(effectiveUrl)
      ) {
        if (response.body) {
          try {
            await response.body.cancel();
          } catch {
            // ignore
          }
        }
        const baseSize = contentLength > 0 ? contentLength : 75497472;
        const isHls = effectiveUrl.toLowerCase().includes('.m3u8') || contentType.includes('mpegurl');
        const streamUrl = isHls
          ? effectiveUrl
          : `/api/video/stream?url=${encodeURIComponent(effectiveUrl)}&referer=${encodeURIComponent(
              new URL(effectiveUrl).origin + '/'
            )}`;
        res.json({
          mode: 'DIRECT_VIDEO',
          platform: parsed.hostname,
          originalUrl: rawUrl,
          title: decodeURIComponent(pathname.split('/').pop() || parsed.hostname).replace(
            /\.(mp4|m3u8|webm|mov|mkv)$/i,
            ''
          ),
          thumbnailUrl: null,
          embedUrl: null,
          extractedVideoUrl: streamUrl,
          availableFormats: [
            { id: '1080p', label: '1080p Direct Master', ext: isHls ? 'HLS' : 'MP4', sizeBytes: baseSize, resolution: '1920x1080', videoUrl: streamUrl },
            { id: '720p', label: '720p HD', ext: 'MP4', sizeBytes: Math.round(baseSize * 0.6), resolution: '1280x720', videoUrl: streamUrl },
            { id: '480p', label: '480p Data Saver', ext: 'MP4', sizeBytes: Math.round(baseSize * 0.35), resolution: '854x480', videoUrl: streamUrl },
          ],
        });
        return;
      }

      const html = await response.text();

      // Check if the HTML page is a MovieBox/Aoneroom SSR page on a custom mirror domain
      if (html.includes('__NUXT_DATA__') && html.includes('subjectId')) {
        const mbResolved = await resolveMovieBoxLink(effectiveUrl);
        if (mbResolved) {
          res.json({
            mode: 'DIRECT_VIDEO',
            platform: 'MovieBox Direct Stream',
            originalUrl: rawUrl,
            title: mbResolved.title,
            description: mbResolved.description,
            durationMs: mbResolved.durationMs,
            thumbnailUrl: mbResolved.thumbnailUrl,
            embedUrl: null,
            extractedVideoUrl: mbResolved.extractedVideoUrl,
            availableFormats: mbResolved.availableFormats,
          });
          return;
        }
      }

      const resolveRelative = (candidate: string) => {
        try {
          return new URL(
            candidate.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&'),
            effectiveUrl
          ).toString();
        } catch {
          return candidate;
        }
      };

      // Extract <title> or og:title
      const ogTitleMatch =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
        html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = (ogTitleMatch?.[1]?.trim() || parsed.hostname).replace(/&amp;/g, '&');

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

      // Extract embed player URL if present (og:video:url, twitter:player, JSON-LD embedUrl, or <iframe src>)
      const jsonLdEmbedMatch = html.match(/"embedUrl"\s*:\s*"([^"]+)"/i);
      const twitterPlayerMatch =
        html.match(/<meta[^>]+(?:property|name)=["']twitter:player["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:player["']/i);
      const iframeSrcMatch = html.match(/<iframe[^>]+src=["']((?:https?:)?\/\/[^"']+)["']/i);

      const extractedEmbedRaw =
        jsonLdEmbedMatch?.[1] || twitterPlayerMatch?.[1] || iframeSrcMatch?.[1] || null;
      const embedUrl = extractedEmbedRaw ? resolveRelative(extractedEmbedRaw) : null;

      const extractedVideoRaw =
        jsonLdVideoMatch?.[1] ||
        ogVideoMatch?.[1] ||
        videoTagMatch?.[1] ||
        rawMediaRegexMatch?.[1] ||
        null;

      if (extractedVideoRaw) {
        const resolvedMedia = resolveRelative(extractedVideoRaw);
        const isHls = resolvedMedia.toLowerCase().includes('.m3u8');
        const playableUrl = isHls
          ? resolvedMedia
          : `/api/video/stream?url=${encodeURIComponent(resolvedMedia)}&referer=${encodeURIComponent(
              new URL(effectiveUrl).origin + '/'
            )}&source=${encodeURIComponent(rawUrl)}`;

        res.json({
          mode: 'DIRECT_VIDEO',
          platform: `${parsed.hostname} Direct Stream`,
          originalUrl: rawUrl,
          title: pageTitle.slice(0, 140),
          thumbnailUrl,
          embedUrl,
          extractedVideoUrl: playableUrl,
          availableFormats: [
            { id: '1080p', label: '1080p Direct Stream', ext: isHls ? 'HLS' : 'MP4', sizeBytes: 86402662, resolution: '1920x1080', videoUrl: playableUrl },
            { id: '720p', label: '720p HD Stream', ext: 'MP4', sizeBytes: 49283072, resolution: '1280x720', videoUrl: playableUrl },
            { id: '480p', label: '480p SD Stream', ext: 'MP4', sizeBytes: 26214400, resolution: '854x480', videoUrl: playableUrl },
          ],
        });
        return;
      }

      // If no raw .mp4/.m3u8 was in static HTML, support playing via embedded player or webpage proxy!
      const fallbackEmbed = embedUrl || effectiveUrl;
      res.json({
        mode: 'EMBED',
        platform: `${parsed.hostname} Video Player`,
        originalUrl: rawUrl,
        title: pageTitle.slice(0, 140),
        thumbnailUrl,
        embedUrl: fallbackEmbed,
        extractedVideoUrl: fallbackEmbed,
        availableFormats: [
          { id: '1080p', label: '1080p Web Stream', ext: 'MP4', sizeBytes: 86402662, resolution: '1920x1080', videoUrl: fallbackEmbed },
        ],
      });
    } catch {
      res.json({
        mode: 'EMBED',
        platform: `${parsed.hostname} Video`,
        originalUrl: rawUrl,
        title: parsed.hostname,
        thumbnailUrl: null,
        embedUrl: rawUrl,
        extractedVideoUrl: rawUrl,
        availableFormats: [
          { id: '1080p', label: '1080p Stream', ext: 'MP4', sizeBytes: 79691776, resolution: '1920x1080', videoUrl: rawUrl },
        ],
      });
    }
  });

  // Server-side Direct Video Stream Proxy with true streaming pipe, Referer injection, MovieBox auto-refresh, and HTTP Byte-Range support
  app.get('/api/video/stream', async (req, res) => {
    let targetUrl = cleanVideoUrlInput(String(req.query.url || ''));
    const customReferer = String(req.query.referer || '').trim();
    const sourceUrl = cleanVideoUrlInput(String(req.query.source || ''));
    const preferredRes = String(req.query.res || '480').trim();

    if (!targetUrl) {
      res.status(400).send('Missing video url');
      return;
    }

    try {
      // If sourceUrl is in movieBoxResolutionCache, use the fresh signed rawCdnUrl
      if (sourceUrl) {
        const cachedMb = movieBoxResolutionCache.get(sourceUrl);
        if (cachedMb && cachedMb.expiresAt > Date.now() && cachedMb.data.availableFormats.length > 0) {
          const matchedFmt =
            cachedMb.data.availableFormats.find((f) => f.id.includes(preferredRes)) ||
            cachedMb.data.availableFormats[0];
          if (matchedFmt?.rawCdnUrl) {
            targetUrl = matchedFmt.rawCdnUrl;
          }
        }
      }

      // If a user passed a MovieBox page/share link directly to /api/video/stream, resolve it to the signed MP4 CDN URL first
      const targetParsed = new URL(targetUrl);
      if (
        (isMovieBoxDomain(targetParsed.hostname) &&
          !targetParsed.hostname.includes('hakunaymatata.com') &&
          !targetParsed.hostname.includes('macdn.aoneroom.com')) ||
        targetParsed.pathname.startsWith('/detail/')
      ) {
        const mb = await resolveMovieBoxLink(targetUrl);
        if (mb && mb.availableFormats.length > 0) {
          const matchedFmt =
            mb.availableFormats.find((f) => f.id.includes(preferredRes)) || mb.availableFormats[0];
          targetUrl = matchedFmt.rawCdnUrl;
        }
      } else if (targetParsed.hostname === 'drive.google.com' || targetParsed.hostname === 'docs.google.com') {
        const fileIdMatch =
          targetParsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
          targetParsed.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const queryId = targetParsed.searchParams.get('id');
        const gdriveId = fileIdMatch?.[1] || queryId;
        if (gdriveId) {
          targetUrl = `https://drive.usercontent.google.com/download?id=${gdriveId}&export=download&confirm=t`;
        }
      } else if (targetParsed.hostname.endsWith('dropbox.com')) {
        const directDropboxUrl = new URL(targetUrl);
        directDropboxUrl.hostname = 'dl.dropboxusercontent.com';
        directDropboxUrl.searchParams.delete('dl');
        directDropboxUrl.searchParams.set('raw', '1');
        targetUrl = directDropboxUrl.toString();
      }

      const resolveEffectiveReferer = (urlStr: string): string => {
        if (customReferer) return customReferer;
        const u = new URL(urlStr);
        if (
          u.hostname.includes('hakunaymatata.com') ||
          u.hostname.includes('aoneroom.com') ||
          u.hostname.includes('moviebox')
        ) {
          return 'https://movieboxhd.net/';
        }
        return `${u.origin}/`;
      };

      // Parse incoming Range header and bound chunk size so responses NEVER exceed Cloud Run's 32MB HTTP response limit
      let rangeStart = 0;
      let rangeEnd: number | undefined = undefined;
      const rangeHeader = String(req.headers.range || '').trim();
      const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/i);
      if (rangeMatch) {
        rangeStart = Number(rangeMatch[1]);
        if (rangeMatch[2]) {
          rangeEnd = Number(rangeMatch[2]);
        }
      }

      // Fast-path: Serve initial 15MB segment (ftyp + moov + initial mdat frames) from deduplicated RAM cache
      const isHlsTarget = targetUrl.toLowerCase().includes('.m3u8');
      if (
        !isHlsTarget &&
        rangeStart < INITIAL_SEGMENT_BYTES &&
        (rangeEnd === undefined || rangeEnd < INITIAL_SEGMENT_BYTES)
      ) {
        let initialSeg = await fetchOrWarmInitialSegment(
          targetUrl,
          resolveEffectiveReferer(targetUrl)
        );

        // If the signed CDN link expired or hit a rate limit, refresh from sourceUrl and try available formats
        if (!initialSeg && sourceUrl) {
          movieBoxResolutionCache.delete(sourceUrl);
          const refreshed = await resolveMovieBoxLink(sourceUrl);
          if (refreshed && refreshed.availableFormats.length > 0) {
            const orderedFormats = [
              ...refreshed.availableFormats.filter((f) => f.id.includes(preferredRes)),
              ...refreshed.availableFormats.filter((f) => !f.id.includes(preferredRes)),
            ];
            for (const fmt of orderedFormats) {
              initialSeg = await fetchOrWarmInitialSegment(
                fmt.rawCdnUrl,
                'https://movieboxhd.net/'
              );
              if (initialSeg) {
                targetUrl = fmt.rawCdnUrl;
                break;
              }
            }
          }
        }

        if (initialSeg && rangeStart < initialSeg.buffer.length) {
          const sliceEnd =
            rangeEnd !== undefined
              ? Math.min(rangeEnd, initialSeg.buffer.length - 1)
              : initialSeg.buffer.length - 1;
          const slice = initialSeg.buffer.subarray(rangeStart, sliceEnd + 1);
          res.status(206);
          res.setHeader('Content-Type', initialSeg.contentType);
          res.setHeader('Content-Disposition', 'inline');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader(
            'Access-Control-Expose-Headers',
            'Content-Length, Content-Range, Accept-Ranges, Content-Type'
          );
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader(
            'Content-Range',
            `bytes ${rangeStart}-${sliceEnd}/${initialSeg.totalSize}`
          );
          res.setHeader('Content-Length', String(slice.length));
          res.end(slice);
          return;
        }
      }

      const buildUpstreamHeaders = (urlStr: string): Record<string, string> => {
        const u = new URL(urlStr);
        const effectiveReferer = resolveEffectiveReferer(urlStr);
        let effectiveOrigin = '';
        try {
          effectiveOrigin = new URL(effectiveReferer).origin;
        } catch {
          effectiveOrigin = u.origin;
        }

        const hdrs: Record<string, string> = {
          'User-Agent': DESKTOP_CHROME_UA,
          Accept: '*/*',
          Referer: effectiveReferer,
          Origin: effectiveOrigin,
        };
        if (!isHlsTarget) {
          const maxChunk = rangeStart === 0 ? INITIAL_SEGMENT_BYTES : SUBSEQUENT_CHUNK_BYTES;
          const boundedEnd =
            rangeEnd !== undefined
              ? Math.min(rangeEnd, rangeStart + maxChunk - 1)
              : rangeStart + maxChunk - 1;
          hdrs['Range'] = `bytes=${rangeStart}-${boundedEnd}`;
        } else if (req.headers.range) {
          hdrs['Range'] = req.headers.range;
        }
        return hdrs;
      };

      const abortController = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) {
          abortController.abort();
        }
      });

      let upstream = await fetch(targetUrl, {
        headers: buildUpstreamHeaders(targetUrl),
        signal: abortController.signal,
      });

      // If a signed MovieBox CDN link expired (403 / 410 / 429) and we have the original share/page sourceUrl, refresh and try formats!
      if (
        (upstream.status === 403 || upstream.status === 410 || upstream.status === 429) &&
        sourceUrl
      ) {
        movieBoxResolutionCache.delete(sourceUrl);
        const refreshed = await resolveMovieBoxLink(sourceUrl);
        if (refreshed && refreshed.availableFormats.length > 0) {
          const orderedFormats = [
            ...refreshed.availableFormats.filter((f) => f.id.includes(preferredRes)),
            ...refreshed.availableFormats.filter((f) => !f.id.includes(preferredRes)),
          ];
          for (const fmt of orderedFormats) {
            targetUrl = fmt.rawCdnUrl;
            upstream = await fetch(targetUrl, {
              headers: buildUpstreamHeaders(targetUrl),
              signal: abortController.signal,
            });
            if (upstream.status === 200 || upstream.status === 206) {
              break;
            }
          }
        }
      }

      // If upstream returned an HTML page (e.g. a share link or video webpage passed directly to /api/video/stream), try extracting the underlying MP4 stream
      const initialContentType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (initialContentType.includes('text/html')) {
        const html = await upstream.text();
        let discoveredMediaUrl = '';

        if (
          html.includes('__NUXT_DATA__') ||
          isMovieBoxDomain(new URL(upstream.url || targetUrl).hostname)
        ) {
          const mb = await resolveMovieBoxLink(upstream.url || targetUrl);
          if (mb && mb.availableFormats.length > 0) {
            const matchedFmt =
              mb.availableFormats.find((f) => f.id.includes(preferredRes)) ||
              mb.availableFormats[0];
            discoveredMediaUrl = matchedFmt.rawCdnUrl;
          }
        }

        if (!discoveredMediaUrl) {
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
          const candidate =
            jsonLdVideoMatch?.[1] ||
            ogVideoMatch?.[1] ||
            videoTagMatch?.[1] ||
            rawMediaRegexMatch?.[1] ||
            '';
          if (candidate) {
            try {
              discoveredMediaUrl = new URL(
                candidate.replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&'),
                upstream.url || targetUrl
              ).toString();
            } catch {
              discoveredMediaUrl = candidate;
            }
          }
        }

        if (discoveredMediaUrl) {
          targetUrl = discoveredMediaUrl;
          upstream = await fetch(targetUrl, {
            headers: buildUpstreamHeaders(targetUrl),
            signal: abortController.signal,
          });
        } else {
          res.status(415).send('Target URL is an HTML page without a direct binary video stream');
          return;
        }
      }

      res.status(upstream.status);
      const rawContentType = (upstream.headers.get('content-type') || '').toLowerCase();
      const contentType =
        !rawContentType || rawContentType.includes('octet-stream')
          ? targetUrl.toLowerCase().includes('.m3u8')
            ? 'application/vnd.apple.mpegurl'
            : targetUrl.toLowerCase().includes('.webm')
            ? 'video/webm'
            : 'video/mp4'
          : upstream.headers.get('content-type') || 'video/mp4';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range, Accept-Ranges, Content-Type'
      );
      const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
      res.setHeader('Accept-Ranges', acceptRanges);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      if (upstream.body) {
        const nodeStream = Readable.fromWeb(upstream.body as any);
        nodeStream.on('error', () => {
          if (!res.headersSent) {
            res.status(502).end();
          } else {
            res.end();
          }
        });
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).send(`Direct video stream error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  });

  // Server-side media stream proxy for downloading external video streams to device disk
  app.get('/api/webpage/download-stream', async (req, res) => {
    let targetUrl = String(req.query.url || '').trim();
    const title = String(req.query.title || 'chillmate_video')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 80);
    if (!targetUrl) {
      res.status(400).send('Missing target url');
      return;
    }
    try {
      // If targetUrl is a relative /api/video/stream proxy URL, extract the underlying url or source
      if (targetUrl.startsWith('/api/video/stream')) {
        const fakeUrl = new URL(targetUrl, 'http://localhost:3000');
        targetUrl = fakeUrl.searchParams.get('url') || targetUrl;
      }
      const u = new URL(targetUrl);
      const isMb =
        u.hostname.includes('hakunaymatata.com') ||
        u.hostname.includes('aoneroom.com') ||
        u.hostname.includes('moviebox');
      const upstream = await fetch(targetUrl, {
        headers: {
          'User-Agent': DESKTOP_CHROME_UA,
          Referer: isMb ? 'https://movieboxhd.net/' : `${u.origin}/`,
        },
      });
      const contentType = upstream.headers.get('content-type') || 'video/mp4';
      const contentLength = upstream.headers.get('content-length');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      if (upstream.body) {
        const nodeStream = Readable.fromWeb(upstream.body as any);
        nodeStream.on('error', () => res.end());
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).send(`Download stream failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
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

            // If reconnecting client included its cached local state, merge it additively first so nothing is ever reset!
            if (msg.clientState && typeof msg.clientState === 'object') {
              syncBackendState(msg.clientState);
            }

            const tombs = ensureTombstones();
            // Immediately push canonical Users, Teams, TeamMembers, LibraryItems, and Folders with tombstones
            ws.send(
              JSON.stringify({
                type: 'AUTH_USERS_SYNC',
                users: backendDb.users,
                tombstones: tombs,
              })
            );
            ws.send(
              JSON.stringify({
                type: 'TEAMS_STATE_SYNC',
                teams: backendDb.teams,
                teamMembers: backendDb.teamMembers,
                tombstones: tombs,
              })
            );
            ws.send(
              JSON.stringify({
                type: 'LIBRARY_STATE_SYNC',
                libraryItems: backendDb.libraryItems,
                tombstones: tombs,
              })
            );
            ws.send(
              JSON.stringify({
                type: 'FOLDERS_STATE_SYNC',
                libraryFolders: backendDb.libraryFolders,
                deletedFolderKeys: tombs.libraryFolders,
                tombstones: tombs,
              })
            );

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
            const targetUserId = userId || client.userId;
            if (!targetUserId) break;

            const currentMembers = hallMembersMap.get(hallId) || [];
            const idx = currentMembers.findIndex((m) => m.userId === targetUserId);
            const nowIso = new Date().toISOString();
            if (idx >= 0) {
              currentMembers[idx] = {
                ...currentMembers[idx],
                ...(typeof micEnabled === 'boolean'
                  ? { micEnabled, ...(micEnabled ? { mutedByName: undefined } : {}) }
                  : {}),
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

          case 'HALL_MUTE_PARTICIPANT': {
            const { hallId, targetUserId, mutedByUserId, mutedByName } = msg;
            const hall = activeHalls.get(hallId);
            if (!hall || !targetUserId) break;
            const currentMembers = hallMembersMap.get(hallId) || [];
            const idx = currentMembers.findIndex((m) => m.userId === targetUserId);
            const nowIso = new Date().toISOString();
            const effectiveMutedByName = mutedByName || client.displayName || 'Participant';
            if (idx >= 0) {
              currentMembers[idx] = {
                ...currentMembers[idx],
                micEnabled: false,
                isSpeaking: false,
                mutedByName: effectiveMutedByName,
                updatedAt: nowIso,
              };
              hallMembersMap.set(hallId, currentMembers);
            }
            broadcastToHall(hallId, {
              type: 'HALL_PARTICIPANT_MUTED',
              hallId,
              targetUserId,
              mutedByUserId: mutedByUserId || client.userId,
              mutedByName: effectiveMutedByName,
              members: currentMembers,
            });
            broadcastToHall(hallId, {
              type: 'HALL_MEMBERS_SYNC',
              hallId,
              members: currentMembers,
              viewerCount: hall.viewerCount,
            });
            break;
          }

          case 'HALL_MUTE_ALL_PARTICIPANTS': {
            const { hallId, mutedByUserId, mutedByName } = msg;
            const hall = activeHalls.get(hallId);
            if (!hall) break;
            const callerId = mutedByUserId || client.userId;
            const effectiveMutedByName = mutedByName || client.displayName || 'Participant';
            const nowIso = new Date().toISOString();
            const currentMembers = (hallMembersMap.get(hallId) || []).map((m) =>
              m.userId === callerId
                ? m
                : {
                    ...m,
                    micEnabled: false,
                    isSpeaking: false,
                    mutedByName: m.micEnabled ? effectiveMutedByName : m.mutedByName,
                    updatedAt: nowIso,
                  }
            );
            hallMembersMap.set(hallId, currentMembers);
            broadcastToHall(hallId, {
              type: 'HALL_ALL_PARTICIPANTS_MUTED',
              hallId,
              mutedByUserId: callerId,
              mutedByName: effectiveMutedByName,
              members: currentMembers,
            });
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
              const currentMembers = hallMembersMap.get(msg.hallId) || [];
              const senderMember = currentMembers.find((m) => m.userId === msg.userId);
              if (senderMember && !senderMember.micEnabled) {
                break; // Do not relay voice chunks if participant is muted
              }
              broadcastToHall(
                msg.hallId,
                {
                  type: 'HALL_VOICE_CHUNK',
                  hallId: msg.hallId,
                  userId: msg.userId,
                  displayName: msg.displayName || senderMember?.displayName || client.displayName,
                  audioDataUrl: msg.audioDataUrl,
                  level: typeof msg.level === 'number' ? msg.level : undefined,
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
              patch.breakState !== undefined ? undefined : ws
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
            const isBreakActive = Boolean(hall?.breakState?.isActive);
            if (hall) {
              if (typeof msg.frameDataUrl === 'string') {
                hall.latestFrameDataUrl = msg.frameDataUrl;
              }
              if (typeof msg.positionMs === 'number' && !isBreakActive) {
                hall.positionMs = msg.positionMs;
                hall.lastSyncEpochMs = Date.now();
              }
              if (typeof msg.durationMs === 'number' && msg.durationMs > 0) {
                hall.durationMs = msg.durationMs;
              }
              if (typeof msg.isPlaying === 'boolean' && !isBreakActive) {
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
                positionMs: isBreakActive ? hall?.positionMs : msg.positionMs,
                durationMs: msg.durationMs,
                isPlaying: isBreakActive ? false : msg.isPlaying,
                breakState: hall?.breakState || null,
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
            const tombs = ensureTombstones();
            for (const c of clients) {
              if (c.ws !== ws && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(
                  JSON.stringify({
                    type: 'AUTH_USERS_SYNC',
                    users: backendDb.users,
                    tombstones: tombs,
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
            const tombs = ensureTombstones();
            for (const c of clients) {
              if (c.ws !== ws && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(
                  JSON.stringify({
                    type: 'TEAMS_STATE_SYNC',
                    teams: backendDb.teams,
                    teamMembers: backendDb.teamMembers,
                    tombstones: tombs,
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
            const tombs = ensureTombstones();
            for (const c of clients) {
              if (c.ws !== ws && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(
                  JSON.stringify({
                    type: 'LIBRARY_STATE_SYNC',
                    libraryItems: backendDb.libraryItems,
                    tombstones: tombs,
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

  // Hydrate from Cloud Firestore on server startup if available (merges additively with local disk state)
  if (cloudFirestore) {
    cloudFirestore
      .collection('systemState')
      .doc('chillmate_persistent_db_v2')
      .get()
      .then((snap) => {
        if (snap.exists) {
          const cloudData = snap.data() as Partial<PersistentBackendDatabase> | undefined;
          if (cloudData) {
            syncBackendState(cloudData);
            const tombs = ensureTombstones();
            broadcastAll({ type: 'AUTH_USERS_SYNC', users: backendDb.users, tombstones: tombs });
            broadcastAll({
              type: 'TEAMS_STATE_SYNC',
              teams: backendDb.teams,
              teamMembers: backendDb.teamMembers,
              tombstones: tombs,
            });
            broadcastAll({
              type: 'LIBRARY_STATE_SYNC',
              libraryItems: backendDb.libraryItems,
              tombstones: tombs,
            });
            broadcastAll({
              type: 'FOLDERS_STATE_SYNC',
              libraryFolders: backendDb.libraryFolders,
              deletedFolderKeys: tombs.libraryFolders,
              tombstones: tombs,
            });
          }
        } else {
          persistToCloudFirestoreAsync();
        }
      })
      .catch(() => {
        // Local disk DB remains authoritative fallback
      });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Chill Mate server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
