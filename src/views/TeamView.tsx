import React, { useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  Film,
  KeyRound,
  Plus,
  Radio,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useChillMate } from '../context/ChillMateContext';
import { ActiveTab, Team, TeamRole } from '../types';
import { ASSETS, formatDurationMs } from '../utils/media';

interface TeamViewProps {
  onNavigateTab: (tab: ActiveTab) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({ onNavigateTab }) => {
  const {
    currentUser,
    teams,
    activeTeam,
    selectTeam,
    createTeam,
    updateTeamCredentials,
    deleteTeam,
    joinTeamByNameAndPin,
    searchTeamByNameAndPin,
    teamMembers,
    updateMemberRole,
    removeTeamMember,
    activeHall,
    libraryItems,
    isCurrentUserHost,
    isApprovedInHall,
    enterApprovedHall,
    requestToJoinHall,
  } = useChillMate();

  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditCredentialsModal, setShowEditCredentialsModal] = useState(false);
  const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Create Team fields
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamPin, setNewTeamPin] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Team Name & PIN fields (for Team Owner)
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamPin, setEditTeamPin] = useState('');
  const [editTeamDesc, setEditTeamDesc] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Search & Join Team by Name + PIN fields
  const [joinTeamNameInput, setJoinTeamNameInput] = useState('');
  const [joinPinInput, setJoinPinInput] = useState('');
  const [searchedTeamResult, setSearchedTeamResult] = useState<{
    team: Team;
    memberCount: number;
  } | null>(null);
  const [isSearchingTeam, setIsSearchingTeam] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccessBanner, setJoinSuccessBanner] = useState<string | null>(null);

  // RBAC feedback banner
  const [rbacFeedback, setRbacFeedback] = useState<string | null>(null);

  const myMembership = teamMembers.find((m) => m.userId === currentUser.id);
  const isCurrentTeamOwner =
    activeTeam.ownerId === currentUser.id || myMembership?.role === 'OWNER';
  const isCurrentTeamAdmin = myMembership?.role === 'ADMIN';

  const onlineMembers = teamMembers.filter((m) => m.presence !== 'OFFLINE');

  const handleCopyTeamPinInfo = async () => {
    await navigator.clipboard.writeText(
      `Team Name: ${activeTeam.name} | PIN: ${activeTeam.pin}`
    );
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 1800);
  };

  const openEditCredentials = () => {
    setEditTeamName(activeTeam.name);
    setEditTeamPin(activeTeam.pin);
    setEditTeamDesc(activeTeam.description || '');
    setEditError(null);
    setShowEditCredentialsModal(true);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newTeamName.trim() || !newTeamPin.trim()) return;
    const res = await createTeam(newTeamName, newTeamPin, newTeamDesc);
    if (!res.ok) {
      setCreateError(
        res.error || 'Team name is already taken. Every team must have a unique name.'
      );
      return;
    }
    setNewTeamName('');
    setNewTeamPin('');
    setNewTeamDesc('');
    setCreateError(null);
    setShowCreateModal(false);
    if (res.team) {
      setJoinSuccessBanner(`Created unique team "${res.team.name}"!`);
      setTimeout(() => setJoinSuccessBanner(null), 3500);
    }
  };

  const handleSaveTeamCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    const res = await updateTeamCredentials(
      activeTeam.id,
      editTeamName,
      editTeamPin,
      editTeamDesc
    );
    if (!res.ok) {
      setEditError(res.error || 'Unable to update team credentials.');
      return;
    }
    setEditTeamName('');
    setEditTeamPin('');
    setEditTeamDesc('');
    setShowEditCredentialsModal(false);
    setRbacFeedback(
      `Updated Team Name to "${editTeamName.trim()}" and PIN to "${editTeamPin.trim()}".`
    );
    setTimeout(() => setRbacFeedback(null), 3500);
  };

  const handleSearchTeam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setJoinError(null);
    setSearchedTeamResult(null);
    setIsSearchingTeam(true);
    const res = await searchTeamByNameAndPin(joinTeamNameInput, joinPinInput);
    setIsSearchingTeam(false);
    if (!res.ok || !res.team) {
      setJoinError(
        res.error || 'No team found matching that Team Name and PIN number.'
      );
      return;
    }
    setSearchedTeamResult({
      team: res.team,
      memberCount: res.memberCount || 1,
    });
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const res = await joinTeamByNameAndPin(joinTeamNameInput, joinPinInput);
    if (!res.ok) {
      setJoinError(
        res.error || 'No team matched that Team Name and PIN number.'
      );
      return;
    }
    setJoinTeamNameInput('');
    setJoinPinInput('');
    setSearchedTeamResult(null);
    setShowJoinModal(false);
    if (res.team) {
      setJoinSuccessBanner(`Successfully joined "${res.team.name}" with PIN!`);
      setTimeout(() => setJoinSuccessBanner(null), 3500);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-24">
      {/* Team Hero Header */}
      <div className="rounded-3xl bg-zinc-900/70 border border-zinc-800 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5 min-w-0">
          <img
            src={activeTeam.imageUrl || ASSETS.posterInterstellar}
            alt={activeTeam.name}
            referrerPolicy="no-referrer"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-white/10 shrink-0"
          />
          <div className="min-w-0 space-y-1.5">
            {activeTeam.id ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span>Private Team</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{teamMembers.length} members</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400 font-mono-tabular">
                    {onlineMembers.length} online
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Your Role:{' '}
                    <strong className="text-zinc-200">
                      {isCurrentTeamOwner ? 'OWNER' : myMembership?.role || 'MEMBER'}
                    </strong>
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 truncate">
                  {activeTeam.name}
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 truncate">
                  {activeTeam.description || 'Private team screening room and shared cinema library.'}
                </p>
              </>
            ) : (
              <>
                <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  No Team Selected
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 truncate">
                  Create or Join a Private Team
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Create a new team with a Team Name and PIN number, or join an existing team with its Name and PIN.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {activeTeam.id && (
            <button
              onClick={handleCopyTeamPinInfo}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-xs font-mono-tabular text-zinc-200 flex items-center gap-2 transition-colors"
              title="Copy Team Name & PIN Number"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>PIN: {activeTeam.pin}</span>
              {copiedCredentials ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
          )}

          {activeTeam.id && isCurrentTeamOwner && (
            <button
              type="button"
              onClick={openEditCredentials}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors"
              title="Change Team Name & PIN Anytime (Owner Only)"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Name & PIN</span>
            </button>
          )}

          <button
            onClick={() => {
              setJoinError(null);
              setSearchedTeamResult(null);
              setShowJoinModal(true);
            }}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-100 flex items-center gap-1.5 transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-rose-400" />
            <span>Search & Join by Name + PIN</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Team</span>
          </button>
        </div>
      </div>

      {joinSuccessBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between">
          <span>{joinSuccessBanner}</span>
          <button
            type="button"
            onClick={() => setJoinSuccessBanner(null)}
            className="text-emerald-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {rbacFeedback && (
        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between">
          <span>{rbacFeedback}</span>
          <button
            type="button"
            onClick={() => setRbacFeedback(null)}
            className="text-amber-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Team Switcher Tabs */}
      {teams.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTeam(t.id)}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                t.id === activeTeam.id
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {t.name} (PIN: {t.pin})
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 7 Cols: Members, Live Presence & Strict Team Permissions */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-400" />
              <span>Team Members & Permissions</span>
            </h2>
            <span className="text-xs text-zinc-400">
              {isCurrentTeamOwner
                ? 'Owner Mode: Assign ADMIN ↔ MEMBER or remove members'
                : isCurrentTeamAdmin
                ? 'Admin Mode: Can remove regular members only'
                : 'Member Mode: View-only permissions'}
            </span>
          </div>

          <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 divide-y divide-zinc-800/80 overflow-hidden">
            {teamMembers.length === 0 && (
              <div className="p-8 text-center space-y-2">
                <Users className="w-7 h-7 text-zinc-600 mx-auto" />
                <p className="text-sm font-semibold text-zinc-300">No team members yet</p>
                <p className="text-xs text-zinc-500">
                  Create a team or join an existing team with its Team Name and PIN number.
                </p>
              </div>
            )}
            {teamMembers.map((member) => {
              const isWatching = member.presence === 'WATCHING';
              const isOnline = member.presence === 'ONLINE' || isWatching;
              const isMemberOwner =
                member.role === 'OWNER' || member.userId === activeTeam.ownerId;

              // Permission Check 1: ONLY Team Owner can assign or change roles (ADMIN <-> MEMBER)
              const canChangeThisMemberRole = isCurrentTeamOwner && !isMemberOwner;

              // Permission Check 2: Removing Members:
              // - Team Owner: Can remove both ADMIN and MEMBER (never OWNER)
              // - Team Admin: Can remove regular MEMBER only (cannot remove ADMIN or OWNER)
              const canRemoveThisMember =
                !isMemberOwner &&
                (isCurrentTeamOwner ||
                  (isCurrentTeamAdmin && member.role === 'MEMBER'));

              return (
                <div
                  key={member.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-100 shrink-0">
                      {member.displayName.slice(0, 2).toUpperCase()}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                          isOnline ? 'bg-emerald-500' : 'bg-zinc-600'
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100 truncate">
                          {member.displayName}
                        </span>
                        <span aria-hidden="true" className="text-zinc-600">
                          ·
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            isMemberOwner
                              ? 'text-amber-400'
                              : member.role === 'ADMIN'
                              ? 'text-rose-400'
                              : 'text-zinc-400'
                          }`}
                        >
                          {isMemberOwner ? 'OWNER' : member.role}
                        </span>
                      </div>

                      <div className="text-xs mt-0.5">
                        {isWatching ? (
                          <span className="text-emerald-400 font-medium">
                            🟢 Watching {member.watchingTitle || activeHall?.title || 'Interstellar'}
                          </span>
                        ) : isOnline ? (
                          <span className="text-emerald-400">🟢 Online</span>
                        ) : (
                          <span className="text-zinc-500">⚫ Offline</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Strict Role & Member Removal Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isMemberOwner ? (
                      <span className="text-[11px] font-medium text-amber-400/90 flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Team Owner (Protected)</span>
                      </span>
                    ) : (
                      <>
                        {canChangeThisMemberRole ? (
                          <div className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-zinc-500" />
                            <select
                              value={member.role}
                              onChange={(e) => {
                                const res = updateMemberRole(
                                  member.userId,
                                  e.target.value as TeamRole
                                );
                                if (!res.ok && res.error) {
                                  setRbacFeedback(res.error);
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-rose-500"
                              title="Owner Only: Assign ADMIN or MEMBER role"
                            >
                              <option value="ADMIN">ADMIN</option>
                              <option value="MEMBER">MEMBER</option>
                            </select>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500 font-medium px-2">
                            {member.role}
                          </span>
                        )}

                        {canRemoveThisMember && (
                          <button
                            type="button"
                            onClick={() => {
                              const res = removeTeamMember(member.userId);
                              if (!res.ok && res.error) {
                                setRbacFeedback(res.error);
                              } else {
                                setRbacFeedback(
                                  `Removed ${member.displayName} from ${activeTeam.name}.`
                                );
                                setTimeout(() => setRbacFeedback(null), 3000);
                              }
                            }}
                            className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-rose-600 border border-zinc-800 hover:border-rose-500 text-xs font-semibold text-rose-400 hover:text-white flex items-center gap-1 transition-colors"
                            title={`Remove ${member.displayName} from team`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Currently Watching & Team Library Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-100">Currently Watching</h2>
            {activeHall && activeHall.status !== 'ENDED' ? (
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-rose-500/30 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-rose-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    LIVE HALL
                  </span>
                  <span className="font-mono-tabular text-zinc-300">
                    {formatDurationMs(activeHall.positionMs)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">{activeHall.title}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Hosted by {activeHall.hostName} · {activeHall.viewerCount} watching
                  </p>
                </div>
                <button
                  onClick={() =>
                    isCurrentUserHost || isApprovedInHall
                      ? enterApprovedHall(activeHall.id)
                      : requestToJoinHall(activeHall.id)
                  }
                  className="w-full min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <Radio className="w-4 h-4" />
                  <span>
                    {isCurrentUserHost
                      ? 'OPEN HOST HALL'
                      : isApprovedInHall
                      ? 'JOIN HALL'
                      : 'REQUEST TO JOIN'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-400">
                No active Movie Hall right now. Start a Hall from the Team Library or a local device file.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100">Team Library</h2>
              <button
                onClick={() => onNavigateTab('LIBRARY')}
                className="text-xs text-rose-400 hover:underline"
              >
                Open Full Library
              </button>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2.5">
              {libraryItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-zinc-500">
                  No videos in the Team Library yet.
                </div>
              ) : (
                libraryItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigateTab('LIBRARY')}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-900 cursor-pointer transition-colors"
                  >
                    <img
                      src={item.posterUrl || ASSETS.posterInterstellar}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-14 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-zinc-100 truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Added by {item.addedByName} · {item.category}
                      </div>
                    </div>
                    <Film className="w-4 h-4 text-zinc-500 shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Team Modal (Owner sets Team Name & PIN Number) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  Create Private Team
                </h3>
                <p className="text-xs text-zinc-400">
                  Set your Team Name and PIN number (you can change both anytime)
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Team Name (Required · Must Be Unique)
                </label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => {
                    setCreateError(null);
                    setNewTeamName(e.target.value);
                  }}
                  placeholder="e.g. Weekend Cinema Squad"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Team PIN Number (Required for Members to Join)
                </label>
                <input
                  type="text"
                  required
                  value={newTeamPin}
                  onChange={(e) => setNewTeamPin(e.target.value)}
                  placeholder="e.g. 2613 or 4820"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono-tabular text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  placeholder="Private Movie Hall & Library"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>
              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 font-medium">
                  {createError}
                </div>
              )}
              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
              >
                Create Team with PIN
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Name & PIN Modal (Team Owner Can Change Anytime) */}
      {showEditCredentialsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-amber-500/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  Change Team Name & PIN
                </h3>
                <p className="text-xs text-zinc-400">
                  Team Owner can update Team Name and PIN number anytime
                </p>
              </div>
              <button
                onClick={() => setShowEditCredentialsModal(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTeamCredentials} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Team PIN Number
                </label>
                <input
                  type="text"
                  required
                  value={editTeamPin}
                  onChange={(e) => setEditTeamPin(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono-tabular text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editTeamDesc}
                  onChange={(e) => setEditTeamDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              {editError && <p className="text-xs text-rose-400">{editError}</p>}
              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-zinc-950"
              >
                Save Team Name & PIN
              </button>

              <div className="pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditCredentialsModal(false);
                    setShowDeleteTeamModal(true);
                  }}
                  className="w-full min-h-[38px] rounded-xl bg-zinc-900 hover:bg-rose-950/60 border border-zinc-800 hover:border-rose-500/40 text-xs font-semibold text-rose-400 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Team (Permanent)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Team Permanent Confirmation Modal */}
      {showDeleteTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-rose-500/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-rose-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>Delete Team Permanently</span>
              </h3>
              <button
                onClick={() => setShowDeleteTeamModal(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">"{activeTeam.name}"</strong>?
              All members and shared library items for this team will be permanently deleted from the database. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteTeamModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const teamNameToDelete = activeTeam.name;
                  await deleteTeam(activeTeam.id);
                  setShowDeleteTeamModal(false);
                  setRbacFeedback(`Team "${teamNameToDelete}" permanently deleted from database.`);
                  setTimeout(() => setRbacFeedback(null), 3500);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Team</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Join Team by Team Name & PIN Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  Search & Join Team by Name + PIN
                </h3>
                <p className="text-xs text-zinc-400">
                  Teams are private. A team will only appear when both its exact Name and PIN match.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setSearchedTeamResult(null);
                  setJoinError(null);
                }}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSearchTeam} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  value={joinTeamNameInput}
                  onChange={(e) => {
                    setJoinTeamNameInput(e.target.value);
                    setSearchedTeamResult(null);
                    setJoinError(null);
                  }}
                  placeholder="Enter exact Team Name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Team PIN Number
                </label>
                <input
                  type="text"
                  required
                  value={joinPinInput}
                  onChange={(e) => {
                    setJoinPinInput(e.target.value);
                    setSearchedTeamResult(null);
                    setJoinError(null);
                  }}
                  placeholder="Enter exact Team PIN"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono-tabular text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              {joinError && <p className="text-xs text-rose-400">{joinError}</p>}

              {!searchedTeamResult ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="submit"
                    disabled={isSearchingTeam}
                    className="min-h-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-100 flex items-center justify-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5 text-rose-400" />
                    <span>{isSearchingTeam ? 'Searching...' : 'Search Team'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => void handleJoinTeam(e)}
                    className="min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Join Directly</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-zinc-900/90 border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-emerald-400">
                        MATCH FOUND · PIN VERIFIED
                      </div>
                      <div className="text-sm font-bold text-zinc-100 truncate mt-0.5">
                        {searchedTeamResult.team.name}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {searchedTeamResult.memberCount} member(s) ·{' '}
                        {searchedTeamResult.team.description || 'Private Team'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => void handleJoinTeam(e)}
                    className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Join "{searchedTeamResult.team.name}" Now</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
