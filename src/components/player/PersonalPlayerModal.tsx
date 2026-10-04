import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  AlertCircle,
  Captions,
  CheckCircle2,
  Coffee,
  Download,
  FastForward,
  Film,
  HardDrive,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  Rewind,
  Sparkles,
  Timer,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';
import { formatDurationMs, formatFileSize, resolveYouTubeVideoId } from '../../utils/media';
import { YouTubeVideoPlayer, YouTubeVideoPlayerHandle } from './YouTubeVideoPlayer';
import {
  enterFullscreenLandscape,
  exitFullscreenLandscape,
  isFullscreenActive,
  onFullscreenChange,
} from '../../utils/fullscreen';

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

  // Interval Break feature (Watch Alone)
  const [breakActive, setBreakActive] = useState(false);
  const [breakEndsAt, setBreakEndsAt] = useState<number | null>(null);
  const [breakTotalSec, setBreakTotalSec] = useState(180);
  const [breakRemainingSec, setBreakRemainingSec] = useState(0);
  const [breakMessage, setBreakMessage] = useState('Popcorn & Rest Break');
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [selectedBreakSec, setSelectedBreakSec] = useState(180);

  // Inactivity auto-hide for overlay controls (3 seconds)
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringControlsRef = useRef<boolean>(false);

  const showControlsInstantly = useCallback(() => {
    setAreControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  const scheduleHideControls = useCallback((delay = 3000) => {
    if (isHoveringControlsRef.current) return;
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isHoveringControlsRef.current) {
        setAreControlsVisible(false);
      }
    }, delay);
  }, []);

  const handleVideoActivity = useCallback(() => {
    showControlsInstantly();
    scheduleHideControls(3000);
  }, [showControlsInstantly, scheduleHideControls]);

  useEffect(() => {
    handleVideoActivity();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [handleVideoActivity]);

  // Sync fullscreen state
  useEffect(() => {
    setIsFullscreen(isFullscreenActive());
    return onFullscreenChange((active) => {
      setIsFullscreen(active);
    });
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (isFullscreenActive()) {
        await exitFullscreenLandscape();
        setIsFullscreen(false);
      } else {
        await enterFullscreenLandscape(containerRef.current);
        setIsFullscreen(true);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  // Interval Break countdown timer & auto-play when timer finishes
  useEffect(() => {
    if (!breakActive || !breakEndsAt) {
      setBreakRemainingSec(0);
      return;
    }
    const checkBreakTimer = () => {
      const now = Date.now();
      const diffMs = breakEndsAt - now;
      const sec = Math.max(0, Math.ceil(diffMs / 1000));
      setBreakRemainingSec(sec);
      if (diffMs <= 0) {
        // Break finished! Auto play video
        setBreakActive(false);
        setBreakEndsAt(null);
        setIsPlaying(true);
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
        ytPlayerRef.current?.play();
      }
    };
    checkBreakTimer();
    const interval = setInterval(checkBreakTimer, 500);
    return () => clearInterval(interval);
  }, [breakActive, breakEndsAt]);

  const startBreak = (sec: number, msg: string) => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    ytPlayerRef.current?.pause();
    const ends = Date.now() + sec * 1000;
    setBreakTotalSec(sec);
    setBreakEndsAt(ends);
    setBreakRemainingSec(sec);
    setBreakMessage(msg);
    setBreakActive(true);
  };

  const endBreakAndPlay = () => {
    setBreakActive(false);
    setBreakEndsAt(null);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    ytPlayerRef.current?.play();
  };

  // Native DOM listeners on player container for instant responsiveness to hover, mouse move, and tap
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onPointerActivity = () => {
      showControlsInstantly();
      scheduleHideControls(3000);
    };
    el.addEventListener('pointerenter', onPointerActivity, { passive: true });
    el.addEventListener('pointermove', onPointerActivity, { passive: true });
    el.addEventListener('pointerdown', onPointerActivity, { passive: true });
    el.addEventListener('touchstart', onPointerActivity, { passive: true });
    el.addEventListener('touchmove', onPointerActivity, { passive: true });
    el.addEventListener('mousemove', onPointerActivity, { passive: true });
    el.addEventListener('mouseenter', onPointerActivity, { passive: true });
    return () => {
      el.removeEventListener('pointerenter', onPointerActivity);
      el.removeEventListener('pointermove', onPointerActivity);
      el.removeEventListener('pointerdown', onPointerActivity);
      el.removeEventListener('touchstart', onPointerActivity);
      el.removeEventListener('touchmove', onPointerActivity);
      el.removeEventListener('mousemove', onPointerActivity);
      el.removeEventListener('mouseenter', onPointerActivity);
    };
  }, [showControlsInstantly, scheduleHideControls]);

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

  return (
    <div
      ref={containerRef}
      onMouseMove={handleVideoActivity}
      onMouseEnter={handleVideoActivity}
      onTouchStart={handleVideoActivity}
      onTouchMove={handleVideoActivity}
      onClick={handleVideoActivity}
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden ${
        !areControlsVisible ? 'cursor-none' : 'cursor-default'
      }`}
    >
      {/* 1. VIDEO ELEMENT: FITS 100% ON VIDEO PREVIEW/PLAY BOX AREA */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden bg-black z-0">
        {/* Transparent wake-up overlay */}
        {!areControlsVisible && (
          <div
            onClick={handleVideoActivity}
            onTouchStart={handleVideoActivity}
            onTouchMove={handleVideoActivity}
            onPointerDown={handleVideoActivity}
            onPointerMove={handleVideoActivity}
            onPointerEnter={handleVideoActivity}
            onMouseEnter={handleVideoActivity}
            onMouseMove={handleVideoActivity}
            className="absolute inset-0 z-20 cursor-pointer pointer-events-auto"
            title="Click, hover, or move mouse to show video controls"
          />
        )}

        {playbackError ? (
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-zinc-900/95 border border-rose-500/40 text-center space-y-3 z-20">
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
            controlsVisible={areControlsVisible}
            onToggleFullscreen={toggleFullscreen}
            onTimeUpdate={(posMs: number, durMs: number) => {
              setCurrentTimeMs(posMs);
              if (durMs > 0) setDurationMs(durMs);
            }}
            onDurationChange={(durMs: number) => {
              if (durMs > 0) setDurationMs(durMs);
            }}
            onPlayStateChange={(playing) => setIsPlaying(playing)}
            className="w-full h-full max-w-full max-h-full"
          />
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full max-w-full max-h-full object-contain"
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

        {/* Dedicated Fullscreen Toggle Button directly on video player container */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className={`absolute top-4 right-4 z-40 min-h-[42px] min-w-[42px] p-2.5 rounded-xl bg-black/75 hover:bg-black/95 text-white border border-white/20 shadow-2xl backdrop-blur-md transition-all active:scale-95 flex items-center justify-center ${
            areControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          title={isFullscreen ? 'Exit Fullscreen' : 'Expand Video to Full Screen'}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5 text-rose-400" /> : <Maximize2 className="w-5 h-5 text-white" />}
        </button>

        {subtitlesOn && !playbackError && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-lg bg-black/80 text-zinc-100 text-sm font-medium pointer-events-none z-20">
            [English CC] Atmospheric soundtrack playing...
          </div>
        )}

        {/* INTERVAL BREAK OVERLAY */}
        {breakActive && (
          <div className="absolute inset-0 z-28 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-semibold mb-3 shadow-lg shadow-amber-950/40 animate-pulse">
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>INTERVAL BREAK ACTIVE</span>
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-display font-bold text-white max-w-xl mb-2 drop-shadow-lg">
              {breakMessage}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mb-6">
              Video is paused · Automatically resumes when countdown finishes
            </p>
            <div className="relative flex flex-col items-center justify-center mb-6">
              <div className="text-6xl sm:text-8xl md:text-9xl font-mono-tabular font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-amber-200 tracking-wider drop-shadow-2xl">
                {Math.floor(breakRemainingSec / 60)
                  .toString()
                  .padStart(2, '0')}
                :
                {(breakRemainingSec % 60).toString().padStart(2, '0')}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs sm:text-sm text-amber-300/90 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Auto-play ready · Grab your snacks!</span>
              </div>
            </div>
            <div className="w-full max-w-md h-2 bg-zinc-800/80 rounded-full overflow-hidden mb-8 border border-white/10 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-400 transition-all duration-500 ease-linear"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, (breakRemainingSec / Math.max(1, breakTotalSec)) * 100)
                  )}%`,
                }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 z-30">
              <button
                type="button"
                onClick={() => {
                  const nextSec = breakRemainingSec + 60;
                  setBreakTotalSec((prev) => prev + 60);
                  setBreakEndsAt(Date.now() + nextSec * 1000);
                  setBreakRemainingSec(nextSec);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors shadow-md"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>+1 MIN</span>
              </button>
              <button
                type="button"
                onClick={endBreakAndPlay}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-rose-950/50 hover:scale-105 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>RESUME MOVIE NOW</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. TOP BAR: OVERLAY ON VIDEO */}
      <div
        onMouseEnter={() => {
          isHoveringControlsRef.current = true;
          showControlsInstantly();
        }}
        onMouseLeave={() => {
          isHoveringControlsRef.current = false;
          scheduleHideControls(3000);
        }}
        onTouchStart={() => {
          isHoveringControlsRef.current = false;
          showControlsInstantly();
          scheduleHideControls(3000);
        }}
        onClick={() => {
          isHoveringControlsRef.current = false;
          scheduleHideControls(3000);
        }}
        className={`absolute top-0 left-0 right-0 z-30 flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-b from-black/95 via-black/60 to-transparent ${
          areControlsVisible
            ? 'opacity-100 pointer-events-auto transition-opacity duration-150 ease-out'
            : 'opacity-0 pointer-events-none transition-opacity duration-300 ease-in'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300 drop-shadow">
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
            <h2 className="text-base md:text-lg font-semibold text-zinc-100 truncate mt-0.5 drop-shadow-md">
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
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md backdrop-blur-md ${
                downloadedToLib
                  ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
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
                  ? 'Auto-Downloading...'
                  : downloadedToLib
                  ? 'Saved in Library'
                  : 'Auto-Download Video'}
              </span>
            </button>
          )}

          <button
            onClick={() => closeWatchAlone(currentTimeMs)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-black/60 hover:bg-black/90 border border-white/15 text-xs font-semibold text-zinc-100 flex items-center gap-2 transition-colors backdrop-blur-md"
          >
            <X className="w-4 h-4" />
            <span>Exit Player</span>
          </button>
        </div>
      </div>

      {/* 3. BOTTOM CONTROLS: OVERLAY ON VIDEO */}
      <div
        onMouseEnter={() => {
          isHoveringControlsRef.current = true;
          showControlsInstantly();
        }}
        onMouseLeave={() => {
          isHoveringControlsRef.current = false;
          scheduleHideControls(3000);
        }}
        onTouchStart={() => {
          isHoveringControlsRef.current = false;
          showControlsInstantly();
          scheduleHideControls(3000);
        }}
        onClick={() => {
          isHoveringControlsRef.current = false;
          scheduleHideControls(3000);
        }}
        className={`absolute bottom-0 left-0 right-0 z-30 px-6 py-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent space-y-3 ${
          areControlsVisible
            ? 'opacity-100 pointer-events-auto transition-opacity duration-150 ease-out'
            : 'opacity-0 pointer-events-none transition-opacity duration-300 ease-in'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono-tabular text-zinc-200 w-16 drop-shadow">
            {formatDurationMs(currentTimeMs)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, durationMs || 7200000)}
            value={currentTimeMs}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="flex-1 h-1.5 bg-zinc-700/80 rounded-lg appearance-none cursor-pointer accent-rose-500"
          />
          <span className="text-xs font-mono-tabular text-zinc-300 w-16 text-right drop-shadow">
            {formatDurationMs(durationMs || 7200000)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors shadow-md"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
            <button
              onClick={() => handleSkip(-10)}
              className="min-h-[44px] px-3 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-xs font-mono-tabular text-zinc-200 flex items-center gap-1 transition-colors backdrop-blur-md"
            >
              <Rewind className="w-4 h-4" />
              <span>-10s</span>
            </button>
            <button
              onClick={() => handleSkip(10)}
              className="min-h-[44px] px-3 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-xs font-mono-tabular text-zinc-200 flex items-center gap-1 transition-colors backdrop-blur-md"
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
                className="min-h-[44px] min-w-[44px] rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-zinc-200 flex items-center justify-center backdrop-blur-md"
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
                className="w-20 h-1.5 bg-zinc-700/80 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {personalSession.localFileName && (
              <span className="text-xs text-zinc-300 drop-shadow hidden md:inline">
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
              className="min-h-[44px] px-3 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-xs font-mono-tabular text-zinc-200 backdrop-blur-md"
            >
              {playbackRate}x
            </button>
            <button
              onClick={() => setSubtitlesOn((prev) => !prev)}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors backdrop-blur-md ${
                subtitlesOn
                  ? 'bg-rose-600/30 border border-rose-500 text-rose-200'
                  : 'bg-black/60 hover:bg-black/80 border border-white/10 text-zinc-300'
              }`}
            >
              <Captions className="w-4 h-4" />
              <span>CC</span>
            </button>
            {/* Interval Break Button */}
            <button
              onClick={() => setShowBreakModal(true)}
              className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors backdrop-blur-md ${
                breakActive
                  ? 'bg-amber-600/30 border-amber-500 text-amber-200 animate-pulse'
                  : 'bg-black/60 hover:bg-black/80 border-white/10 text-zinc-300'
              }`}
              title="Interval Break: Pause and set countdown timer"
            >
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>{breakActive ? 'Break Active' : 'Break'}</span>
            </button>
            <button
              onClick={toggleFullscreen}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-zinc-200 flex items-center justify-center backdrop-blur-md"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* INTERVAL BREAK MODAL */}
      {showBreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Set Interval Break</h3>
                  <p className="text-xs text-zinc-400">
                    Pause movie with a countdown timer, auto-resumes when finished
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakModal(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {breakActive && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                <div className="text-xs text-amber-200">
                  <div className="font-bold">Break currently in progress</div>
                  <div className="text-[11px] text-amber-300/80 font-mono">
                    Time remaining: {Math.floor(breakRemainingSec / 60)}:{(breakRemainingSec % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    endBreakAndPlay();
                    setShowBreakModal(false);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shrink-0 shadow-md"
                >
                  Resume Now
                </button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300">Choose Break Duration:</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { label: '1 Min', sec: 60, desc: 'Quick Bio' },
                  { label: '3 Min', sec: 180, desc: 'Popcorn' },
                  { label: '5 Min', sec: 300, desc: 'Snack' },
                  { label: '10 Min', sec: 600, desc: 'Coffee' },
                  { label: '15 Min', sec: 900, desc: 'Intermission' },
                ].map((preset) => (
                  <button
                    key={preset.sec}
                    type="button"
                    onClick={() => setSelectedBreakSec(preset.sec)}
                    className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                      selectedBreakSec === preset.sec
                        ? 'bg-amber-500/25 border-amber-500 text-amber-100 ring-2 ring-amber-500/50 shadow-md'
                        : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-xs font-bold">{preset.label}</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">{preset.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Custom Duration:</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={Math.floor(selectedBreakSec / 60)}
                  onChange={(e) => {
                    const mins = Math.max(1, Math.min(120, Number(e.target.value) || 1));
                    setSelectedBreakSec(mins * 60);
                  }}
                  className="w-24 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-zinc-400">minutes</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Break Message / Reason:</label>
              <input
                type="text"
                value={breakMessage}
                onChange={(e) => setBreakMessage(e.target.value)}
                placeholder="e.g. Popcorn & Refreshment Break"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-2.5 text-xs text-zinc-300">
              <Timer className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Movie will pause automatically and show countdown. When the timer hits 00:00, playback will automatically resume!
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBreakModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  startBreak(selectedBreakSec, breakMessage);
                  setShowBreakModal(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-amber-950/40 transition-transform active:scale-95"
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>START BREAK ({Math.max(1, Math.round(selectedBreakSec / 60))} MIN)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
