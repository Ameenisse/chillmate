import React from 'react';
import { CheckCircle2, Crown, Download, Lock, Play, Radio, Trash2, Users, X } from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';
import { ASSETS, formatFileSize, formatHumanDuration } from '../../utils/media';

export const VideoDetailModal: React.FC = () => {
  const {
    selectedLibraryItem,
    setSelectedLibraryItem,
    startWatchAlone,
    startMovieHall,
    saveLibraryItemToDeviceDisk,
    deleteLibraryItem,
    canDeleteLibraryItem,
    teams,
  } = useChillMate();

  if (!selectedLibraryItem) return null;

  const item = selectedLibraryItem;
  const canDelete = canDeleteLibraryItem(item);
  const isSelfItem =
    !item.teamId || item.teamId.startsWith('self_') || item.libraryScope === 'SELF';
  const itemTeamName = !isSelfItem
    ? teams.find((t) => t.id === item.teamId)?.name || 'Team'
    : 'My Self Library';

  const handlePlayAlone = () => {
    startWatchAlone({
      title: item.title,
      videoUrl: item.videoUrl,
      embedUrl: item.embedUrl,
      posterUrl: item.posterUrl,
      sourceType: item.sourceType,
      durationMs: item.durationMs,
      initialPositionMs: item.progressMs || 0,
    });
    setSelectedLibraryItem(null);
  };

  const handleStartHall = async () => {
    await startMovieHall({
      title: item.title,
      videoUrl: item.videoUrl,
      embedUrl: item.embedUrl,
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl || item.posterUrl,
      libraryItemId: item.id,
      sourceType: item.sourceType,
      durationMs: item.durationMs,
      initialPositionMs: 0,
    });
    setSelectedLibraryItem(null);
  };

  const handleDelete = async () => {
    await deleteLibraryItem(item.id);
    setSelectedLibraryItem(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden">
        {/* Backdrop */}
        <div className="relative h-56 sm:h-64 bg-zinc-900 overflow-hidden">
          <img
            src={item.backdropUrl || item.posterUrl || ASSETS.backdropCinema}
            alt={item.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
          <button
            onClick={() => setSelectedLibraryItem(null)}
            className="absolute top-4 right-4 min-h-[40px] min-w-[40px] rounded-xl bg-black/60 hover:bg-black/80 text-zinc-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-4 left-6 right-6 flex items-end gap-4">
            <img
              src={item.posterUrl || ASSETS.posterInterstellar}
              alt={item.title}
              referrerPolicy="no-referrer"
              className="w-20 h-28 sm:w-24 sm:h-36 rounded-xl object-cover shadow-xl border border-white/10 shrink-0"
            />
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span>{item.category}</span>
                {item.year && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{item.year}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{formatHumanDuration(item.durationMs)}</span>
                {item.isDownloaded && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Downloaded ({item.downloadQuality || '1080p HD'})
                    </span>
                  </>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 truncate mt-1">
                {item.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mt-1">
                <span className="inline-flex items-center gap-1 font-semibold text-zinc-200">
                  {isSelfItem ? (
                    <Lock className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Users className="w-3 h-3 text-rose-400" />
                  )}
                  {isSelfItem ? 'My Self Library' : `${itemTeamName} Library`}
                </span>
                <span aria-hidden="true">·</span>
                <span>Added by {item.addedByName}</span>
                <span aria-hidden="true">·</span>
                <span>Source: {item.sourceType.replace('_', ' ')}</span>
                {item.fileSizeBytes && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">{formatFileSize(item.fileSizeBytes)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details & Actions */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-zinc-300 leading-relaxed">
            {item.description || 'Ready for private playback or a synchronized Team Movie Hall.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handlePlayAlone}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-100 flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>PLAY ALONE</span>
            </button>
            <button
              onClick={handleStartHall}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-lg shadow-rose-950/50"
            >
              <Radio className="w-4 h-4" />
              <span>START MOVIE HALL</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => saveLibraryItemToDeviceDisk(item)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-semibold text-emerald-200 flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>SAVE MP4 TO DEVICE</span>
            </button>
            {canDelete ? (
              <button
                onClick={handleDelete}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-rose-600/20 border border-zinc-800 hover:border-rose-500/40 text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>DELETE FROM LIBRARY</span>
              </button>
            ) : (
              <div className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs font-medium text-zinc-400 flex items-center justify-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Only Team Owner Can Delete</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
