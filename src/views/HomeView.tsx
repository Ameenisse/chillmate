import React from 'react';
import {
  AppWindow,
  Check,
  Clock,
  Film,
  HardDrive,
  Link2,
  Play,
  Radio,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useChillMate } from '../context/ChillMateContext';
import { ActiveTab, LibraryItem } from '../types';
import { ASSETS, formatDurationMs, formatHumanDuration } from '../utils/media';

interface HomeViewProps {
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenDeviceModal: () => void;
  onOpenDirectUrlModal: () => void;
  onOpenShareAppModal: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigateTab,
  onOpenDeviceModal,
  onOpenDirectUrlModal,
  onOpenShareAppModal,
}) => {
  const {
    currentUser,
    activeHall,
    isCurrentUserHost,
    isApprovedInHall,
    libraryItems,
    setSelectedLibraryItem,
    deleteLibraryItem,
    joinRequests,
    requestToJoinHall,
    cancelJoinRequest,
    respondToJoinRequest,
    enterApprovedHall,
  } = useChillMate();

  const myJoinRequest = activeHall
    ? joinRequests.find(
        (r) => r.hallId === activeHall.id && r.requesterId === currentUser.id
      )
    : undefined;

  const pendingHostRequests = activeHall
    ? joinRequests.filter((r) => r.hallId === activeHall.id && r.status === 'PENDING')
    : [];

  const continueWatching = libraryItems.filter((i) => (i.progressMs || 0) > 0);
  const recentlyAdded = libraryItems;
  const moviesRow = libraryItems.filter((i) => i.category === 'MOVIES');
  const videosRow = libraryItems.filter((i) => i.category === 'VIDEOS' || i.category === 'RECENTLY_ADDED');

  const renderPosterRow = (title: string, items: LibraryItem[]) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight">
            {title}
          </h2>
          <button
            onClick={() => onNavigateTab('LIBRARY')}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            See All
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            const progressPct =
              item.progressMs && item.durationMs
                ? Math.min(100, Math.round((item.progressMs / item.durationMs) * 100))
                : 0;

            return (
              <div
                key={`${title}_${item.id}`}
                onClick={() => setSelectedLibraryItem(item)}
                className="group cursor-pointer rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 overflow-hidden transition-all"
              >
                <div className="relative aspect-[3/4] bg-zinc-900 overflow-hidden">
                  <img
                    src={item.posterUrl || ASSETS.posterInterstellar}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteLibraryItem(item.id);
                    }}
                    title="Delete from Library"
                    className="absolute top-2.5 right-2.5 min-h-[32px] min-w-[32px] rounded-xl bg-black/75 hover:bg-rose-600 text-zinc-300 hover:text-white border border-white/10 flex items-center justify-center transition-colors z-10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">
                      {item.title}
                    </h3>
                    {/* Zero-Pill Unboxed Metadata */}
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                      {item.year && <span className="font-mono-tabular">{item.year}</span>}
                      {item.year && <span aria-hidden="true">·</span>}
                      <span className="font-mono-tabular">
                        {formatHumanDuration(item.durationMs)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.category === 'MOVIES' ? 'Movie' : 'Video'}</span>
                    </div>

                    {progressPct > 0 && (
                      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-24">
      {/* Quick Source Actions Bar (Watch Alone / Start Hall from Device, Direct URL, Screen Share) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={onOpenDeviceModal}
          className="min-h-[54px] px-4 py-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/90 flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-100 truncate">
                Play From Device
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                Direct local playback · No upload
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={onOpenDirectUrlModal}
          className="min-h-[54px] px-4 py-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/90 flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-100 truncate">
                Direct Video by Link
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                Play direct stream without downloading · Or save MP4 to Library
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={onOpenShareAppModal}
          className="min-h-[54px] px-4 py-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/90 flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <AppWindow className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-100 truncate">
                Share Screen / App
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                MediaProjection Presentation Hall
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* SECTION 6 & 36: WATCHING NOW (Realtime Team Section) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-sm font-semibold tracking-wide text-zinc-200">
              WATCHING NOW
            </h2>
          </div>
        </div>

        {activeHall && activeHall.status !== 'ENDED' ? (
          <div className="relative rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl">
            {/* Backdrop Image with Measured Scrim */}
            <div className="relative min-h-[280px] sm:min-h-[320px] flex flex-col justify-end p-6 sm:p-8">
              <img
                src={activeHall.backdropUrl || activeHall.posterUrl || ASSETS.backdropCinema}
                alt={activeHall.title}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-55"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/70 to-black/30" />

              <div className="relative z-10 max-w-2xl space-y-3">
                {/* Unboxed Live Metadata Line */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                  <span className="text-rose-400 font-bold flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" />
                    LIVE
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Hosted by {activeHall.hostName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-mono-tabular">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    {activeHall.viewerCount} watching
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-mono-tabular text-rose-300 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDurationMs(activeHall.positionMs)}
                  </span>
                  {activeHall.sourceType === 'DEVICE_LOCAL' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-400 font-medium">
                        Playing directly from device · No upload
                      </span>
                    </>
                  )}
                </div>

                <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight uppercase">
                  {activeHall.title}
                </h1>

                <p className="text-xs sm:text-sm text-zinc-300 max-w-xl leading-relaxed">
                  Host-controlled Movie Hall. Joining connects you immediately to the live presentation at{' '}
                  <span className="font-mono-tabular font-semibold text-zinc-100">
                    {formatDurationMs(activeHall.positionMs)}
                  </span>{' '}
                  without restarting or interrupting existing viewers.
                </p>

                {/* SECTION 14 & 15: Host Approval / Request To Join Workflow */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  {isCurrentUserHost ? (
                    <button
                      onClick={() => enterApprovedHall(activeHall.id)}
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-2 transition-colors shadow-lg shadow-rose-950/60"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>OPEN HOST HALL</span>
                    </button>
                  ) : isApprovedInHall ? (
                    <button
                      onClick={() => enterApprovedHall(activeHall.id)}
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-2 transition-colors shadow-lg shadow-emerald-950/60"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>
                        JOIN CURRENT PRESENTATION ({formatDurationMs(activeHall.positionMs)})
                      </span>
                    </button>
                  ) : myJoinRequest?.status === 'PENDING' ? (
                    <div className="flex flex-wrap items-center gap-3 bg-zinc-950/90 border border-amber-500/40 px-4 py-2.5 rounded-2xl">
                      <div className="text-xs">
                        <div className="font-semibold text-amber-300">Request sent</div>
                        <div className="text-zinc-400">Waiting for host approval...</div>
                      </div>
                      <button
                        onClick={() => cancelJoinRequest(activeHall.id)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200"
                      >
                        CANCEL REQUEST
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => requestToJoinHall(activeHall.id)}
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-2 transition-colors shadow-lg shadow-rose-950/60"
                    >
                      <Radio className="w-4 h-4" />
                      <span>REQUEST TO JOIN</span>
                    </button>
                  )}
                </div>

                {/* Host Realtime Join Request Notification Banner (Section 14 & 15) */}
                {isCurrentUserHost && pendingHostRequests.length > 0 && (
                  <div className="mt-4 p-4 rounded-2xl bg-zinc-950/95 border border-amber-500/40 space-y-2.5 max-w-xl">
                    {pendingHostRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="text-xs">
                          <span className="font-semibold text-zinc-100">
                            {req.requesterName} wants to join your Movie Hall.
                          </span>
                          <p className="text-[11px] text-zinc-400">
                            Accepting connects {req.requesterName} to {formatDurationMs(activeHall.positionMs)} without restarting playback.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => respondToJoinRequest(req.id, 'DECLINED')}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300 flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>DECLINE</span>
                          </button>
                          <button
                            onClick={() => respondToJoinRequest(req.id, 'ACCEPTED')}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>ACCEPT</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* SECTION 48: HOME EMPTY STATE */
          <div className="p-10 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 text-rose-400 flex items-center justify-center mx-auto">
              <Film className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-zinc-100">
                No one is watching right now 🍿
              </h3>
              <p className="text-xs text-zinc-400">
                Choose something from your Library.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('LIBRARY')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors"
            >
              BROWSE LIBRARY
            </button>
          </div>
        )}
      </section>

      {/* Horizontal / Grid Streaming Rows (Section 6) */}
      {renderPosterRow('Continue Watching', continueWatching)}
      {renderPosterRow('Recently Added', recentlyAdded)}
      {renderPosterRow('Movies', moviesRow)}
      {renderPosterRow('Videos', videosRow)}
      {renderPosterRow('Watch Again', libraryItems.slice().reverse())}
    </div>
  );
};
