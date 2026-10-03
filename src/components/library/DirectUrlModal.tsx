import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Film,
  Link2,
  Loader2,
  Play,
  Radio,
  Sparkles,
  X,
} from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';
import {
  ASSETS,
  DEFAULT_DOWNLOAD_FORMATS,
  formatFileSize,
  resolveWebpageOrMediaUrl,
  resolveYouTubeVideoId,
  WebpageResolutionResult,
} from '../../utils/media';
import { YouTubeVideoPlayer } from '../player/YouTubeVideoPlayer';

interface DirectUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DirectUrlModal: React.FC<DirectUrlModalProps> = ({ isOpen, onClose }) => {
  const {
    startWatchAlone,
    startMovieHall,
    downloadTasks,
    autoDownloadLinkToLibrary,
  } = useChillMate();

  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [downloadingNow, setDownloadingNow] = useState(false);
  const [resolution, setResolution] = useState<WebpageResolutionResult | null>(null);
  const [selectedQualityId, setSelectedQualityId] = useState<string>('1080p');
  const [showVideoPreview, setShowVideoPreview] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadedBanner, setDownloadedBanner] = useState<string | null>(null);

  if (!isOpen) return null;

  const formats = resolution?.availableFormats?.length
    ? resolution.availableFormats
    : DEFAULT_DOWNLOAD_FORMATS;
  const selectedFormat =
    formats.find((f) => f.id === selectedQualityId) || formats[0];

  const clearAllFills = () => {
    setUrlInput('');
    setTitleInput('');
  };

  const getDirectVideoStreamUrl = (res: WebpageResolutionResult): string => {
    const fmt =
      res.availableFormats?.find((f) => f.id === selectedQualityId) ||
      res.availableFormats?.[0];
    return (
      fmt?.videoUrl ||
      res.playableVideoUrl ||
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
    );
  };

  const runUrlResolution = async (
    targetUrl?: string
  ): Promise<WebpageResolutionResult | null> => {
    const raw = (targetUrl ?? urlInput).trim();
    const customTitle = titleInput.trim();
    setDownloadedBanner(null);
    setErrorMessage(null);

    if (!raw) {
      setErrorMessage('Please enter a video link or direct stream URL.');
      return null;
    }

    setTesting(true);
    const res = await resolveWebpageOrMediaUrl(raw);
    setTesting(false);

    if (!res.valid) {
      setResolution(null);
      setErrorMessage(res.reason || 'This video source cannot be played directly.');
      return null;
    }

    const finalRes: WebpageResolutionResult = {
      ...res,
      title: customTitle || res.title,
    };

    setResolution(finalRes);
    if (finalRes.availableFormats?.length) {
      setSelectedQualityId(finalRes.availableFormats[0].id);
    }

    // Clear input fills immediately after extracting
    clearAllFills();

    return finalRes;
  };

  // Explicit Auto-Download Direct Video into Library
  const handleAutoDownloadToLibrary = async () => {
    setErrorMessage(null);
    setDownloadedBanner(null);
    const customTitle = titleInput.trim();
    const res = resolution || (await runUrlResolution());
    if (!res) return;

    // Clear input fills immediately
    clearAllFills();

    setDownloadingNow(true);
    const item = await autoDownloadLinkToLibrary({
      url: res.originalUrl,
      title: customTitle || res.title,
      qualityLabel: selectedFormat.label,
      sizeBytes: selectedFormat.sizeBytes,
      category: 'RECENTLY_ADDED',
      preResolved: res,
    });
    setDownloadingNow(false);

    // Clear extracted state after download finishes
    setResolution(null);
    setShowVideoPreview(false);

    if (item) {
      setDownloadedBanner(
        `Direct video "${item.title}" (${selectedFormat.label}) downloaded into your Team Library!`
      );
    }
  };

  // Play Direct Video Immediately WITHOUT Downloading (and without webpage iframes)
  const handlePlayAlone = async () => {
    const customTitle = titleInput.trim();
    const res = resolution || (await runUrlResolution());
    if (!res) return;
    const directVideoUrl = getDirectVideoStreamUrl(res);

    // Clear fills and extracted state after starting playback
    clearAllFills();
    setResolution(null);
    setShowVideoPreview(false);

    startWatchAlone({
      title: customTitle || res.title || 'Direct Video Stream',
      videoUrl: directVideoUrl,
      embedUrl: res.embedUrl || undefined,
      posterUrl: res.thumbnailUrl || ASSETS.posterMidnightTokyo,
      sourceType: 'DIRECT_URL',
      durationMs: 4400000,
    });
    onClose();
  };

  // Start Movie Hall Immediately with Direct Video WITHOUT Downloading
  const handleStartHall = async () => {
    const customTitle = titleInput.trim();
    const res = resolution || (await runUrlResolution());
    if (!res) return;
    const directVideoUrl = getDirectVideoStreamUrl(res);

    // Clear fills and extracted state after starting hall
    clearAllFills();
    setResolution(null);
    setShowVideoPreview(false);

    await startMovieHall({
      title: customTitle || res.title || 'Direct Video Stream',
      videoUrl: directVideoUrl,
      embedUrl: res.embedUrl || undefined,
      posterUrl: res.thumbnailUrl || ASSETS.posterMidnightTokyo,
      backdropUrl: res.thumbnailUrl || ASSETS.backdropCinema,
      sourceType: 'DIRECT_URL',
      durationMs: 4400000,
    });
    onClose();
  };

  const recentTasks = downloadTasks.slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                DIRECT VIDEO LINK — PLAY INSTANTLY OR DOWNLOAD
              </h2>
              <p className="text-xs text-zinc-400">
                Play direct video stream without downloading (no webpage iframes) or download MP4 to Library
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              clearAllFills();
              onClose();
            }}
            className="min-h-[40px] min-w-[40px] rounded-lg text-zinc-400 hover:text-zinc-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* URL Input & Direct Video Extractor */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Paste Video Link (Extracts Direct MP4 / HLS Stream — Fills Auto-Clear)
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setErrorMessage(null);
                    setDownloadedBanner(null);
                  }}
                  placeholder="https://... paste link to play direct video or download"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono-tabular text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void runUrlResolution()}
                  disabled={testing}
                  className="min-h-[42px] px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-100 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {testing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>EXTRACT VIDEO</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleAutoDownloadToLibrary()}
                  disabled={downloadingNow || testing}
                  className="min-h-[42px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/50"
                >
                  {downloadingNow ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>DOWNLOAD</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Optional Custom Title (Auto-clears after Extract / Play / Download)
            </label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Leave blank to auto-detect video title..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Extracted Direct Video Stream & Quality Selector */}
        {resolution && (
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={resolution.thumbnailUrl || ASSETS.posterMidnightTokyo}
                  alt={resolution.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-12 rounded-lg object-cover border border-zinc-700 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{resolution.title}</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
                    {resolution.platform} · Direct Video Ready ({selectedFormat.ext}) · Play without downloading or save to Library
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowVideoPreview((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 shrink-0"
              >
                <Film className="w-3.5 h-3.5 text-rose-400" />
                <span>{showVideoPreview ? 'Hide Video Preview' : 'Preview Direct Video'}</span>
              </button>
            </div>

            {/* Video Stream Preview (Supports both YouTube Video & Direct HTML5/Media3 Video) */}
            {showVideoPreview && (() => {
              const previewYtId =
                resolution.youTubeId ||
                resolveYouTubeVideoId({
                  videoUrl: getDirectVideoStreamUrl(resolution),
                  embedUrl: resolution.embedUrl,
                  originalPageUrl: resolution.originalUrl,
                  posterUrl: resolution.thumbnailUrl,
                });
              return (
                <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-black aspect-video">
                  {previewYtId ? (
                    <YouTubeVideoPlayer
                      videoId={previewYtId}
                      title={resolution.title}
                      isPlaying={true}
                      className="w-full h-full"
                    />
                  ) : (
                    <video
                      src={getDirectVideoStreamUrl(resolution)}
                      poster={resolution.thumbnailUrl || ASSETS.posterMidnightTokyo}
                      controls
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                  )}
                </div>
              );
            })()}

            {/* Direct Video Quality / Resolution Picker */}
            <div className="space-y-2 pt-1 border-t border-zinc-800/80">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Select Direct Video Stream Quality:</span>
                <span className="font-mono-tabular text-zinc-300">
                  {selectedFormat.label} · {formatFileSize(selectedFormat.sizeBytes)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {formats.map((fmt) => {
                  const active = fmt.id === selectedFormat.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setSelectedQualityId(fmt.id)}
                      className={`px-3 py-2 rounded-xl text-left border transition-colors ${
                        active
                          ? 'bg-rose-600/20 border-rose-500 text-zinc-100'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>{fmt.id}</span>
                        <span className="text-[10px] text-rose-400 font-mono-tabular">
                          {fmt.ext}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono-tabular mt-0.5">
                        {formatFileSize(fmt.sizeBytes)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Active / Recent Auto-Download Tasks Queue */}
        {recentTasks.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
            <div className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
              <span>Direct Video Auto-Download Queue</span>
              <span className="text-[11px] font-mono-tabular text-zinc-400">
                {recentTasks.filter((t) => t.status === 'COMPLETED').length}/{recentTasks.length} Saved
              </span>
            </div>
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-2.5 rounded-xl bg-zinc-950/90 border border-zinc-800/90 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="font-medium text-zinc-100 truncate">
                      {task.title}
                    </div>
                    <span
                      className={`font-mono-tabular text-[11px] shrink-0 ${
                        task.status === 'COMPLETED'
                          ? 'text-emerald-400 font-semibold'
                          : 'text-rose-400'
                      }`}
                    >
                      {task.status === 'COMPLETED'
                        ? '✓ Direct Video in Library'
                        : `${task.progressPct}% · ${task.speedText}`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${task.progressPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono-tabular">
                    <span>
                      {task.platform} · {task.qualityLabel}
                    </span>
                    <span>
                      {formatFileSize(task.downloadedBytes)} / {formatFileSize(task.totalBytes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {downloadedBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{downloadedBanner}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Primary Action Bar: Play Direct Without Downloading OR Download to Library */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => void handlePlayAlone()}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-100 flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4 fill-current text-emerald-400" />
            <span>PLAY DIRECT (NO DL)</span>
          </button>

          <button
            type="button"
            onClick={() => void handleStartHall()}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-lg shadow-rose-950/50"
          >
            <Radio className="w-4 h-4" />
            <span>START HALL (NO DL)</span>
          </button>

          <button
            type="button"
            onClick={() => void handleAutoDownloadToLibrary()}
            disabled={downloadingNow}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-950/50"
          >
            {downloadingNow ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>DOWNLOAD TO LIBRARY</span>
          </button>
        </div>
      </div>
    </div>
  );
};
