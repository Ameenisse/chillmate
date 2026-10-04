import React, { useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Crown,
  Download,
  Film,
  HardDrive,
  Link2,
  Loader2,
  Lock,
  Play,
  Radio,
  RotateCcw,
  Search,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { useChillMate } from '../context/ChillMateContext';
import {
  ASSETS,
  DEFAULT_DOWNLOAD_FORMATS,
  formatDurationMs,
  formatFileSize,
  formatHumanDuration,
  resolveWebpageOrMediaUrl,
} from '../utils/media';

interface LibraryViewProps {
  onOpenDeviceModal: () => void;
  onOpenDirectUrlModal: () => void;
  onOpenUploadModal: () => void;
}

type LibraryFilter =
  | 'ALL'
  | 'DOWNLOADED'
  | 'WATCHING_NOW'
  | 'CONTINUE_WATCHING'
  | 'RECENTLY_ADDED'
  | 'MOVIES'
  | 'VIDEOS'
  | 'WATCH_AGAIN';

export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenDeviceModal,
  onOpenDirectUrlModal,
  onOpenUploadModal,
}) => {
  const {
    libraryItems,
    activeLibraryScope,
    setActiveLibraryScope,
    selfLibraryItems,
    teamLibraryItemsByTeam,
    teams,
    selectTeam,
    canDeleteLibraryItem,
    isOwnerOfTeam,
    activeHall,
    setSelectedLibraryItem,
    startWatchAlone,
    startMovieHall,
    enterApprovedHall,
    requestToJoinHall,
    isCurrentUserHost,
    isApprovedInHall,
    downloadTasks,
    autoDownloadLinkToLibrary,
    saveLibraryItemToDeviceDisk,
    removeDownloadTask,
    deleteLibraryItem,
    lastDeletedLibraryItem,
    restoreDeletedLibraryItem,
  } = useChillMate();

  const [activeFilter, setActiveFilter] = useState<LibraryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Link Bar state (Play Direct without Download OR Auto-Download into Library)
  const [quickLinkUrl, setQuickLinkUrl] = useState('');
  const [quickQuality, setQuickQuality] = useState('1080p Full HD');
  const [autoDownloadOnPaste, setAutoDownloadOnPaste] = useState(false);
  const [isQuickDownloading, setIsQuickDownloading] = useState(false);
  const [isQuickPlaying, setIsQuickPlaying] = useState(false);

  const isSelfLibraryActive = activeLibraryScope === 'SELF';
  const activeScopedTeam = !isSelfLibraryActive
    ? teams.find((t) => t.id === activeLibraryScope)
    : undefined;
  const isCurrentTeamOwner = activeScopedTeam ? isOwnerOfTeam(activeScopedTeam.id) : false;

  const triggerQuickAutoDownload = async (targetUrl?: string) => {
    const raw = (targetUrl ?? quickLinkUrl).trim();
    if (!raw) return;
    // Clear input fill immediately
    setQuickLinkUrl('');
    const fmt =
      DEFAULT_DOWNLOAD_FORMATS.find((f) => f.label === quickQuality) ||
      DEFAULT_DOWNLOAD_FORMATS[0];
    setIsQuickDownloading(true);
    await autoDownloadLinkToLibrary({
      url: raw,
      qualityLabel: fmt.label,
      sizeBytes: fmt.sizeBytes,
      category: 'RECENTLY_ADDED',
      targetLibraryScope: activeLibraryScope,
    });
    setIsQuickDownloading(false);
  };

  const triggerQuickPlayDirectWithoutDownload = async (
    mode: 'ALONE' | 'HALL',
    targetUrl?: string
  ) => {
    const raw = (targetUrl ?? quickLinkUrl).trim();
    if (!raw) return;
    // Clear input fill immediately
    setQuickLinkUrl('');
    setIsQuickPlaying(true);
    const resolved = await resolveWebpageOrMediaUrl(raw);
    setIsQuickPlaying(false);
    if (!resolved.valid) return;

    const chosenFmt =
      resolved.availableFormats?.find((f) => f.label === quickQuality) ||
      resolved.availableFormats?.[0];
    const directStreamUrl =
      chosenFmt?.videoUrl ||
      resolved.playableVideoUrl ||
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';

    if (mode === 'ALONE') {
      startWatchAlone({
        title: resolved.title || 'Direct Video Stream',
        videoUrl: directStreamUrl,
        embedUrl: resolved.embedUrl || undefined,
        posterUrl: resolved.thumbnailUrl || ASSETS.posterMidnightTokyo,
        sourceType: 'DIRECT_URL',
        durationMs: 4400000,
      });
    } else {
      await startMovieHall({
        title: resolved.title || 'Direct Video Stream',
        videoUrl: directStreamUrl,
        embedUrl: resolved.embedUrl || undefined,
        posterUrl: resolved.thumbnailUrl || ASSETS.posterMidnightTokyo,
        backdropUrl: resolved.thumbnailUrl || ASSETS.backdropCinema,
        sourceType: 'DIRECT_URL',
        durationMs: 4400000,
      });
    }
  };

  const filteredItems = libraryItems.filter((item) => {
    const matchesQuery =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesQuery) return false;

    switch (activeFilter) {
      case 'DOWNLOADED':
        return Boolean(item.isDownloaded);
      case 'CONTINUE_WATCHING':
        return (item.progressMs || 0) > 0;
      case 'RECENTLY_ADDED':
        return item.category === 'RECENTLY_ADDED' || true;
      case 'MOVIES':
        return item.category === 'MOVIES';
      case 'VIDEOS':
        return item.category === 'VIDEOS' || item.sourceType === 'DIRECT_URL' || item.sourceType === 'WEBPAGE';
      case 'WATCH_AGAIN':
        return (item.progressMs || 0) >= item.durationMs * 0.8 || item.category === 'MOVIES';
      default:
        return true;
    }
  });

  const downloadedCount = libraryItems.filter((i) => i.isDownloaded).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
      {/* MULTI-LIBRARY SELECTOR BAR: 1 Self Library (Only user can see) + 1 Library per Team (Only team members can see; Only Team Owner can delete) */}
      <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-semibold text-zinc-200 flex items-center gap-2">
            <span>Multi-Library Spaces</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="text-zinc-400 font-normal">
              Switch between your private Self Library and each Team&apos;s shared Library
            </span>
          </div>
          <span className="text-[11px] font-mono-tabular text-zinc-400">
            {isSelfLibraryActive
              ? 'Private: Only you can see & manage'
              : isCurrentTeamOwner
              ? 'Team Owner: You can manage & delete videos'
              : 'Team Member: View & watch (Only Team Owner can delete)'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Self Library Tab */}
          <button
            type="button"
            onClick={() => setActiveLibraryScope('SELF')}
            className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
              isSelfLibraryActive
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-950/40'
                : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>My Self Library (Only Me)</span>
            <span className="font-mono-tabular text-[11px] opacity-80">
              ({selfLibraryItems.length})
            </span>
          </button>

          {/* 2. Separate Team Library Tab for each Team the user belongs to */}
          {teams.map((team) => {
            const isSelected = activeLibraryScope === team.id;
            const teamVideosCount = (teamLibraryItemsByTeam[team.id] || []).length;
            const ownerOfThisTeam = isOwnerOfTeam(team.id);

            return (
              <button
                key={team.id}
                type="button"
                onClick={() => {
                  selectTeam(team.id);
                  setActiveLibraryScope(team.id);
                }}
                className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
                  isSelected
                    ? 'bg-rose-600/20 border-rose-500 text-rose-100 shadow-lg shadow-rose-950/40'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {ownerOfThisTeam ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Users className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{team.name} Library</span>
                <span className="font-mono-tabular text-[11px] opacity-80">
                  ({teamVideosCount})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Header & Source Action Buttons (Sections 8, 9, 10, 11, 12) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              {isSelfLibraryActive
                ? 'My Self Library (Private)'
                : `${activeScopedTeam?.name || 'Team'} Video Library`}
            </h1>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span
              className={`text-xs font-semibold ${
                isSelfLibraryActive
                  ? 'text-emerald-400'
                  : isCurrentTeamOwner
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {isSelfLibraryActive
                ? 'ONLY YOU CAN SEE'
                : isCurrentTeamOwner
                ? 'TEAM OWNER (FULL MANAGE & DELETE)'
                : 'TEAM MEMBERS ONLY (OWNER MANAGES DELETES)'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isSelfLibraryActive
              ? 'Videos added here are strictly private to your account — only you can see, watch, or delete them.'
              : `Shared exclusively with ${activeScopedTeam?.name || 'Team'} members. Any member can watch or host a Hall; only the Team Owner can delete videos from this Team Library.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenDeviceModal}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-100 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>PLAY FROM DEVICE</span>
          </button>

          <button
            onClick={onOpenDirectUrlModal}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-100 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-rose-400" />
            <span>DIRECT VIDEO BY LINK</span>
          </button>

          <button
            onClick={onOpenUploadModal}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>UPLOAD VIDEO</span>
          </button>
        </div>
      </div>

      {/* DIRECT VIDEO LINK BAR: PLAY WITHOUT DOWNLOADING OR AUTO-DOWNLOAD TO LIBRARY */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3.5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-rose-400" />
            <span className="text-xs sm:text-sm font-semibold text-zinc-100">
              Direct Video by Link — Play Without Downloading or Auto-Download to Library
            </span>
          </div>

          <button
            type="button"
            onClick={() => setAutoDownloadOnPaste((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              autoDownloadOnPaste
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
            }`}
          >
            {autoDownloadOnPaste ? 'Instant Auto-Download on Paste: ON' : 'Instant Auto-Download on Paste: OFF'}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void triggerQuickAutoDownload();
          }}
          className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              value={quickLinkUrl}
              onChange={(e) => setQuickLinkUrl(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text').trim();
                if (pasted && autoDownloadOnPaste && (pasted.startsWith('http://') || pasted.startsWith('https://'))) {
                  setTimeout(() => {
                    void triggerQuickAutoDownload(pasted);
                  }, 60);
                }
              }}
              placeholder="Paste video link (MP4, HLS, Archive.org, Vimeo, YouTube) — auto-clears after play or download..."
              className="w-full min-h-[44px] pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono-tabular text-zinc-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <select
            value={quickQuality}
            onChange={(e) => setQuickQuality(e.target.value)}
            className="min-h-[44px] px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-rose-500 shrink-0"
          >
            {DEFAULT_DOWNLOAD_FORMATS.map((fmt) => (
              <option key={fmt.id} value={fmt.label}>
                {fmt.label} ({fmt.ext})
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void triggerQuickPlayDirectWithoutDownload('ALONE')}
              disabled={isQuickPlaying || isQuickDownloading || !quickLinkUrl.trim()}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-semibold text-zinc-100 flex items-center justify-center gap-1.5 transition-colors"
              title="Play direct video stream immediately without downloading (no webpage iframe)"
            >
              {isQuickPlaying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
              )}
              <span>PLAY DIRECT (NO DL)</span>
            </button>

            <button
              type="button"
              onClick={() => void triggerQuickPlayDirectWithoutDownload('HALL')}
              disabled={isQuickPlaying || isQuickDownloading || !quickLinkUrl.trim()}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-rose-950/50"
              title="Start Movie Hall directly from stream without downloading"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>START HALL (NO DL)</span>
            </button>

            <button
              type="submit"
              disabled={isQuickDownloading || isQuickPlaying || !quickLinkUrl.trim()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/50"
            >
              {isQuickDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>
                {isSelfLibraryActive ? 'SAVE TO SELF LIBRARY' : 'SAVE TO TEAM LIBRARY'}
              </span>
            </button>
          </div>
        </form>

        {/* Active & Completed Auto-Download Queue */}
        {downloadTasks.length > 0 && (
          <div className="pt-3 border-t border-zinc-800/90 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Auto-Download Queue ({downloadTasks.length})
              </span>
              <span className="text-[11px] text-zinc-400 font-mono-tabular">
                {downloadTasks.filter((t) => t.status === 'COMPLETED').length} saved in Library
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {downloadTasks.slice(0, 4).map((task) => {
                const matchedItem = task.libraryItemId
                  ? libraryItems.find((i) => i.id === task.libraryItemId)
                  : undefined;

                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800 flex items-center gap-3"
                  >
                    <img
                      src={task.posterUrl || ASSETS.posterMidnightTokyo}
                      alt={task.title}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-lg object-cover border border-zinc-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-100 truncate">
                          {task.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDownloadTask(task.id)}
                          className="text-zinc-500 hover:text-zinc-300"
                          title="Dismiss task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 ${
                            task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${task.progressPct}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="text-zinc-400 font-mono-tabular">
                          {task.qualityLabel} · {formatFileSize(task.downloadedBytes)} /{' '}
                          {formatFileSize(task.totalBytes)}
                        </span>

                        {task.status === 'COMPLETED' && matchedItem ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              In Library
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                startWatchAlone({
                                  title: matchedItem.title,
                                  videoUrl: matchedItem.videoUrl,
                                  embedUrl: matchedItem.embedUrl,
                                  posterUrl: matchedItem.posterUrl,
                                  sourceType: matchedItem.sourceType,
                                  durationMs: matchedItem.durationMs,
                                })
                              }
                              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold"
                            >
                              Play
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                startMovieHall({
                                  title: matchedItem.title,
                                  videoUrl: matchedItem.videoUrl,
                                  embedUrl: matchedItem.embedUrl,
                                  posterUrl: matchedItem.posterUrl,
                                  backdropUrl: matchedItem.backdropUrl || matchedItem.posterUrl,
                                  libraryItemId: matchedItem.id,
                                  sourceType: matchedItem.sourceType,
                                  durationMs: matchedItem.durationMs,
                                })
                              }
                              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                            >
                              Start Hall
                            </button>
                          </div>
                        ) : (
                          <span className="text-rose-400 font-mono-tabular font-semibold">
                            {task.progressPct}% · {task.speedText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Search & Section Filter Bar (Section 8) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 overflow-x-auto">
          {(
            [
              { id: 'ALL', label: 'ALL' },
              { id: 'DOWNLOADED', label: `DOWNLOADED (${downloadedCount})` },
              { id: 'WATCHING_NOW', label: 'WATCHING NOW' },
              { id: 'CONTINUE_WATCHING', label: 'CONTINUE WATCHING' },
              { id: 'RECENTLY_ADDED', label: 'RECENTLY ADDED' },
              { id: 'MOVIES', label: 'MOVIES' },
              { id: 'VIDEOS', label: 'VIDEOS' },
              { id: 'WATCH_AGAIN', label: 'WATCH AGAIN' },
            ] as { id: LibraryFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeFilter === tab.id
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search library..."
            className="w-full min-h-[40px] pl-9 pr-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* WATCHING NOW Banner when active */}
      {(activeFilter === 'ALL' || activeFilter === 'WATCHING_NOW') && activeHall && (
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                WATCHING NOW
              </span>
              <span aria-hidden="true" className="text-zinc-600">·</span>
              <span className="text-zinc-300">Hosted by {activeHall.hostName}</span>
              <span aria-hidden="true" className="text-zinc-600">·</span>
              <span className="font-mono-tabular text-zinc-400">
                {activeHall.viewerCount} watching · {formatDurationMs(activeHall.positionMs)}
              </span>
            </div>
            <h3 className="text-lg font-bold text-zinc-100">{activeHall.title}</h3>
          </div>

          <button
            onClick={() =>
              isCurrentUserHost || isApprovedInHall
                ? enterApprovedHall(activeHall.id)
                : requestToJoinHall(activeHall.id)
            }
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-2 shrink-0"
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
      )}

      {/* Undo Delete Banner when an item was just deleted */}
      {lastDeletedLibraryItem && (
        <div className="p-3.5 rounded-2xl bg-zinc-900/95 border border-rose-500/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-200">
            <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Removed <strong className="text-white">&quot;{lastDeletedLibraryItem.title}&quot;</strong> from{' '}
              {!lastDeletedLibraryItem.teamId || lastDeletedLibraryItem.libraryScope === 'SELF'
                ? 'My Self Library'
                : 'Team Library'}
              .
            </span>
          </div>
          <button
            type="button"
            onClick={restoreDeletedLibraryItem}
            className="min-h-[34px] px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-100 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
            <span>UNDO DELETE</span>
          </button>
        </div>
      )}

      {/* Library Grid or Empty State (Section 8 & 49) */}
      {filteredItems.length === 0 ? (
        <div className="p-12 rounded-3xl bg-zinc-900/50 border border-zinc-800 text-center space-y-5">
          <Film className="w-10 h-10 text-zinc-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-100">
              {isSelfLibraryActive
                ? 'Your Personal Self Library is empty.'
                : `${activeScopedTeam?.name || 'Team'} Library is empty.`}
            </h3>
            <p className="text-xs text-zinc-400">
              {isSelfLibraryActive
                ? 'Paste a link above or upload a video to save privately in your Self Library (only you can see it).'
                : `Paste a link above or upload a video to share with ${activeScopedTeam?.name || 'your team'} members.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenDeviceModal}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-100"
            >
              PLAY FROM DEVICE
            </button>
            <button
              onClick={onOpenDirectUrlModal}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-100"
            >
              AUTO-DOWNLOAD BY LINK
            </button>
            <button
              onClick={onOpenUploadModal}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
            >
              UPLOAD VIDEO
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredItems.map((item) => {
            const canDelete = canDeleteLibraryItem(item);
            const isItemSelf =
              !item.teamId || item.teamId.startsWith('self_') || item.libraryScope === 'SELF';

            return (
              <div
                key={item.id}
                className="group rounded-2xl bg-zinc-900/60 border border-zinc-800/90 hover:border-zinc-700 overflow-hidden flex flex-col transition-all"
              >
                <div
                  onClick={() => setSelectedLibraryItem(item)}
                  className="relative aspect-[3/4] bg-zinc-900 cursor-pointer overflow-hidden"
                >
                  <img
                    src={item.posterUrl || ASSETS.posterInterstellar}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />

                  {/* Top-left Library Scope indicator */}
                  <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg bg-black/75 border border-white/10 text-[10px] font-semibold text-zinc-200 flex items-center gap-1 z-10">
                    {isItemSelf ? (
                      <>
                        <Lock className="w-2.5 h-2.5 text-emerald-400" />
                        <span>Self</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-2.5 h-2.5 text-rose-400" />
                        <span className="truncate max-w-[100px]">
                          {activeScopedTeam?.name || 'Team'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Top-right Delete from Library icon button — strictly only if canDelete is true */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteLibraryItem(item.id);
                      }}
                      title="Delete from Library"
                      className="absolute top-2.5 right-2.5 min-h-[34px] min-w-[34px] rounded-xl bg-black/75 hover:bg-rose-600 text-zinc-300 hover:text-white border border-white/10 flex items-center justify-center transition-colors z-10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="absolute bottom-3 left-3 right-3 space-y-1">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">
                      {item.title}
                    </h3>
                    {/* Unboxed clean metadata (Zero-Pill Discipline) */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                      {item.isDownloaded ? (
                        <>
                          <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Downloaded
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {item.downloadQuality || '1080p HD'}
                          </span>
                        </>
                      ) : (
                        <>
                          {item.year && <span className="font-mono-tabular">{item.year}</span>}
                          {item.year && <span aria-hidden="true">·</span>}
                          <span className="font-mono-tabular">
                            {formatHumanDuration(item.durationMs)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{item.category}</span>
                        </>
                      )}
                    </div>
                    {item.isDownloaded && item.fileSizeBytes && (
                      <div className="text-[10px] text-zinc-400 font-mono-tabular">
                        {item.platformName || 'Web Link'} · {formatFileSize(item.fileSizeBytes)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 space-y-2 border-t border-zinc-800/80 bg-zinc-950/60">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        startWatchAlone({
                          title: item.title,
                          videoUrl: item.videoUrl,
                          embedUrl: item.embedUrl,
                          posterUrl: item.posterUrl,
                          sourceType: item.sourceType,
                          durationMs: item.durationMs,
                          initialPositionMs: item.progressMs || 0,
                        })
                      }
                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-200 flex items-center justify-center gap-1 transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play Alone</span>
                    </button>
                    <button
                      onClick={() =>
                        startMovieHall({
                          title: item.title,
                          videoUrl: item.videoUrl,
                          embedUrl: item.embedUrl,
                          posterUrl: item.posterUrl,
                          backdropUrl: item.backdropUrl || item.posterUrl,
                          libraryItemId: item.id,
                          sourceType: item.sourceType,
                          durationMs: item.durationMs,
                        })
                      }
                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold text-white flex items-center justify-center gap-1 transition-colors"
                    >
                      <Radio className="w-3 h-3" />
                      <span>Start Hall</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.isDownloaded && (
                      <button
                        type="button"
                        onClick={() => saveLibraryItemToDeviceDisk(item)}
                        className="flex-1 min-h-[32px] px-2.5 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-emerald-300 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>Save MP4</span>
                      </button>
                    )}
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => void deleteLibraryItem(item.id)}
                        className="flex-1 min-h-[32px] px-2.5 py-1 rounded-lg bg-zinc-900/90 hover:bg-rose-600/20 border border-zinc-800 hover:border-rose-500/40 text-[11px] font-medium text-zinc-400 hover:text-rose-300 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    ) : (
                      <div
                        className="flex-1 min-h-[32px] px-2.5 py-1 rounded-lg bg-zinc-900/40 border border-zinc-800/60 text-[10px] font-medium text-zinc-500 flex items-center justify-center gap-1"
                        title="Only the Team Owner can delete videos from this Team Library"
                      >
                        <Crown className="w-3 h-3 text-amber-500/70" />
                        <span>Owner Managed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
