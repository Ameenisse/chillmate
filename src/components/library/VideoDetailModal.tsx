import React, { useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Download,
  Folder,
  FolderPlus,
  Lock,
  Play,
  Radio,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';
import {
  ASSETS,
  formatFileSize,
  formatHumanDuration,
  resolveYouTubeVideoId,
} from '../../utils/media';
import { YouTubeVideoPlayer } from '../player/YouTubeVideoPlayer';

export const VideoDetailModal: React.FC = () => {
  const {
    selectedLibraryItem,
    setSelectedLibraryItem,
    startWatchAlone,
    startMovieHall,
    saveLibraryItemToDeviceDisk,
    deleteLibraryItem,
    canDeleteLibraryItem,
    getFoldersForScope,
    moveLibraryItemToFolder,
    teams,
  } = useChillMate();

  const [newFolderName, setNewFolderName] = useState('');

  if (!selectedLibraryItem) return null;

  const item = selectedLibraryItem;
  const ytVideoId = resolveYouTubeVideoId({
    videoUrl: item.videoUrl,
    embedUrl: item.embedUrl,
    originalPageUrl: item.originalPageUrl,
    posterUrl: item.posterUrl,
  });
  const canDelete = canDeleteLibraryItem(item);
  const isSelfItem =
    !item.teamId || item.teamId.startsWith('self_') || item.libraryScope === 'SELF';
  const itemScope = isSelfItem ? 'SELF' : item.teamId;
  const availableFolders = getFoldersForScope(itemScope);
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
      <div className="w-full max-w-2xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Live Inline Video Player Preview */}
        <div className="relative aspect-video bg-black overflow-hidden">
          {ytVideoId ? (
            <YouTubeVideoPlayer
              videoId={ytVideoId}
              title={item.title}
              isPlaying={true}
              className="w-full h-full"
            />
          ) : (
            <video
              key={item.videoUrl}
              src={item.videoUrl}
              poster={item.backdropUrl || item.posterUrl || ASSETS.backdropCinema}
              controls
              autoPlay
              preload="auto"
              playsInline
              onError={(e) => {
                const v = e.currentTarget;
                if (!v.src.includes('/api/video/stream') && item.videoUrl.startsWith('http')) {
                  v.src = `/api/video/stream?url=${encodeURIComponent(item.videoUrl)}`;
                  v.load();
                } else if (v.src.includes('res=1080')) {
                  v.src = item.videoUrl.replace('res=1080', 'res=480');
                  v.load();
                }
              }}
              className="w-full h-full object-contain bg-black"
            />
          )}
          <button
            onClick={() => setSelectedLibraryItem(null)}
            className="absolute top-3 right-3 z-20 min-h-[38px] min-w-[38px] rounded-xl bg-black/75 hover:bg-black/95 border border-white/15 text-zinc-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title & Metadata Header */}
        <div className="px-6 pt-4 pb-1 flex items-center gap-4 border-b border-zinc-800/80">
          <img
            src={item.posterUrl || ASSETS.posterInterstellar}
            alt={item.title}
            referrerPolicy="no-referrer"
            className="w-14 h-20 rounded-xl object-cover shadow-lg border border-white/10 shrink-0"
          />
          <div className="min-w-0 flex-1">
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
            <h2 className="text-lg sm:text-xl font-bold text-zinc-100 truncate mt-0.5">
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

        {/* Details & Actions */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-zinc-300 leading-relaxed">
            {item.description || 'Ready for private playback or a synchronized Team Movie Hall.'}
          </p>

          {/* Movie Folder Assignment */}
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>Movie Folder:</span>
                <span className="text-amber-300">
                  {item.folderName || 'Uncategorized (No Folder)'}
                </span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={item.folderName || ''}
                onChange={(e) => {
                  void moveLibraryItemToFolder(item.id, e.target.value || undefined);
                }}
                className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-amber-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Uncategorized (No Folder)</option>
                {availableFolders.map((folder) => (
                  <option key={folder} value={folder}>
                    📁 {folder}
                  </option>
                ))}
              </select>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newFolderName.trim()) return;
                  void moveLibraryItemToFolder(item.id, newFolderName.trim());
                  setNewFolderName('');
                }}
                className="flex items-center gap-1.5 flex-1"
              >
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Move to new folder..."
                  maxLength={60}
                  className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-zinc-950 flex items-center gap-1 shrink-0 transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Move</span>
                </button>
              </form>
            </div>
          </div>

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
