import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertCircle,
  Captions,
  CheckCircle2,
  Download,
  FastForward,
  Film,
  HardDrive,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Rewind,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';
import { formatDurationMs, formatFileSize, resolveYouTubeVideoId } from '../../utils/media';
import { YouTubeVideoPlayer, YouTubeVideoPlayerHandle } from './YouTubeVideoPlayer';

export const PersonalPlayerModal: React.FC = () => {
  const { personalSession, closeWatchAlone, autoDownloadLinkToLibrary } = useChillMate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<YouTubeVideoPlayerHandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [usedProxyFallback, setUsedProxyFallback] = useState(false);
  const [isDownloadingToLib, setIsDownloadingToLib] = useState(false);
  const [downloadedToLib, setDownloadedToLib] = useState(false);

  const youTubeVideoId = personalSession
    ? resolveYouTubeVideoId({
        videoUrl: personalSession.videoUrl,
        embedUrl: personalSession.embedUrl,
        posterUrl: personalSession.posterUrl,
      })
    : null;

  useEffect(() => {
    if (!personalSession) return;
    setPlaybackError(null);
    setUsedProxyFallback(false);
    setDownloadedToLib(false);
    setIsPlaying(true);

    if (youTubeVideoId) {
      setDurationMs(personalSession.durationMs || 0);
      setCurrentTimeMs(personalSession.initialPositionMs || 0);
      return;
    }

    if (!videoRef.current) return;
    const video = videoRef.current;

    let hls: Hls | null = null;
    const url = personalSession.videoUrl;

    if (url.toLowerCase().includes('.m3u8') && Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (personalSession.initialPositionMs) {
          video.currentTime = (personalSession.initialPositionMs / 1000) % 600;
        }
        video.play().catch(() => setIsPlaying(false));
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          setPlaybackError('This video source cannot be played directly.');
        }
      });
    } else {
      video.src = url;
      video.load();
      video.onloadedmetadata = () => {
        setDurationMs(
          personalSession.durationMs || Math.round((video.duration || 0) * 1000)
        );
        if (personalSession.initialPositionMs && video.duration > 10) {
          video.currentTime = Math.min(
            video.duration - 2,
            (personalSession.initialPositionMs / 1000) % video.duration
          );
        }
        video.play().catch(() => setIsPlaying(false));
      };
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [personalSession, youTubeVideoId]);

  if (!personalSession) return null;

  const togglePlay = () => {
    if (youTubeVideoId) {
      const next = !isPlaying;
      setIsPlaying(next);
      if (next) {
        ytPlayerRef.current?.play();
      } else {
        ytPlayerRef.current?.pause();
      }
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (newMs: number) => {
    setCurrentTimeMs(newMs);
    if (youTubeVideoId) {
      ytPlayerRef.current?.seekToMs(newMs);
      return;
    }
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      const ratio = durationMs > 0 ? newMs / durationMs : 0;
      video.currentTime = ratio * video.duration;
    }
  };

  const handleSkip = (deltaSec: number) => {
    const nextMs = Math.max(0, Math.min(durationMs || 7200000, currentTimeMs + deltaSec * 1000));
    handleSeek(nextMs);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none"
    >
      {/* Top Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span>Watch Alone · Direct Video Player</span>
              <span aria-hidden="true">·</span>
              <span>No Movie Hall</span>
              {personalSession.sourceType === 'DEVICE_LOCAL' ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5" />
                    Playing directly from device · No upload
                  </span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                    <Film className="w-3.5 h-3.5" />
                    Direct Video Stream
                  </span>
                </>
              )}
            </div>
            <h2 className="text-base md:text-lg font-semibold text-zinc-100 truncate mt-0.5">
              {personalSession.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {personalSession.sourceType !== 'DEVICE_LOCAL' && (
            <button
              onClick={async () => {
                if (isDownloadingToLib || downloadedToLib) return;
                setIsDownloadingToLib(true);
                await autoDownloadLinkToLibrary({
                  url: personalSession.videoUrl,
                  title: personalSession.title,
                  qualityLabel: '1080p Full HD',
                });
                setIsDownloadingToLib(false);
                setDownloadedToLib(true);
              }}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                downloadedToLib
                  ? 'bg-emerald-600/25 border border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50'
              }`}
            >
              {isDownloadingToLib ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : downloadedToLib ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>
                {isDownloadingToLib
                  ? 'Auto-Downloading Video...'
                  : downloadedToLib
                  ? 'Saved in Library'
                  : 'Auto-Download Video'}
              </span>
            </button>
          )}

          <button
            onClick={() => closeWatchAlone(currentTimeMs)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/70 text-xs font-semibold text-zinc-100 flex items-center gap-2 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Exit Player</span>
          </button>
        </div>
      </div>

      {/* Native Direct Video or YouTube Video Surface */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        {playbackError ? (
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-zinc-900/95 border border-rose-500/40 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-zinc-100">{playbackError}</p>
          </div>
        ) : youTubeVideoId ? (
          <YouTubeVideoPlayer
            ref={ytPlayerRef}
            videoId={youTubeVideoId}
            title={personalSession.title}
            isPlaying={isPlaying}
            positionMs={currentTimeMs}
            playbackSpeed={playbackRate}
            muted={muted}
            volume={volume}
            onTimeUpdate={(posMs: number, durMs: number) => {
              setCurrentTimeMs(posMs);
              if (durMs > 0) setDurationMs(durMs);
            }}
            onDurationChange={(durMs: number) => {
              if (durMs > 0) setDurationMs(durMs);
            }}
            onPlayStateChange={(playing) => setIsPlaying(playing)}
            className="w-full h-full max-h-[82vh]"
          />
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full max-h-[82vh] object-contain"
            playsInline
            onClick={togglePlay}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration > 0) {
                const scaled =
                  durationMs > 0
                    ? Math.round((v.currentTime / v.duration) * durationMs)
                    : Math.round(v.currentTime * 1000);
                setCurrentTimeMs(scaled);
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              const v = videoRef.current;
              if (
                v &&
                !usedProxyFallback &&
                personalSession.videoUrl.startsWith('http')
              ) {
                setUsedProxyFallback(true);
                v.src = `/api/video/stream?url=${encodeURIComponent(personalSession.videoUrl)}`;
                v.load();
                v.play().catch(() => {});
                return;
              }
              setPlaybackError('This video source cannot be played directly.');
            }}
          />
        )}

        {subtitlesOn && !playbackError && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-lg bg-black/80 text-zinc-100 text-sm font-medium pointer-events-none">
            [English CC] Atmospheric soundtrack playing...
          </div>
        )}
      </div>

      {/* Bottom Media3 Controls */}
      <div className="relative z-10 px-6 py-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono-tabular text-zinc-300 w-16">
            {formatDurationMs(currentTimeMs)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, durationMs || 7200000)}
            value={currentTimeMs}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
          />
          <span className="text-xs font-mono-tabular text-zinc-400 w-16 text-right">
            {formatDurationMs(durationMs || 7200000)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
            <button
              onClick={() => handleSkip(-10)}
              className="min-h-[44px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono-tabular text-zinc-200 flex items-center gap-1 transition-colors"
            >
              <Rewind className="w-4 h-4" />
              <span>-10s</span>
            </button>
            <button
              onClick={() => handleSkip(10)}
              className="min-h-[44px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono-tabular text-zinc-200 flex items-center gap-1 transition-colors"
            >
              <span>+10s</span>
              <FastForward className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  if (videoRef.current) videoRef.current.muted = next;
                  ytPlayerRef.current?.setMuted(next);
                }}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center"
              >
                {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  setMuted(v === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = v === 0;
                  }
                  ytPlayerRef.current?.setVolume(v);
                  ytPlayerRef.current?.setMuted(v === 0);
                }}
                className="w-20 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {personalSession.localFileName && (
              <span className="text-xs text-zinc-400 hidden md:inline">
                {personalSession.localFileName} · {formatFileSize(personalSession.localFileSize)}
              </span>
            )}
            <button
              onClick={() => {
                const rates = [0.75, 1, 1.25, 1.5, 2];
                const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
                setPlaybackRate(next);
                if (videoRef.current) videoRef.current.playbackRate = next;
                ytPlayerRef.current?.setPlaybackRate(next);
              }}
              className="min-h-[44px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono-tabular text-zinc-200"
            >
              {playbackRate}x
            </button>
            <button
              onClick={() => setSubtitlesOn((prev) => !prev)}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                subtitlesOn
                  ? 'bg-rose-600/20 border border-rose-500/40 text-rose-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
              }`}
            >
              <Captions className="w-4 h-4" />
              <span>CC</span>
            </button>
            <button
              onClick={toggleFullscreen}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
