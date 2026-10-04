import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useRef,
  useState,
} from 'react';
import { ExternalLink, Maximize2, Minimize2, RefreshCw, Shield } from 'lucide-react';
import { parseYouTubeVideoId } from '../../utils/media';
import {
  enterFullscreenLandscape,
  exitFullscreenLandscape,
  isFullscreenActive,
  onFullscreenChange,
} from '../../utils/fullscreen';

export interface YouTubeVideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seekToMs: (ms: number) => void;
  setVolume: (volume0to1: number) => void;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
}

interface YouTubeVideoPlayerProps {
  videoId: string;
  title?: string;
  isPlaying?: boolean;
  initialPositionMs?: number;
  syncedPositionMs?: number;
  positionMs?: number;
  isViewerSync?: boolean;
  volume?: number;
  muted?: boolean;
  playbackRate?: number;
  playbackSpeed?: number;
  onTimeUpdate?: (currentTimeMs: number, durationMs: number) => void;
  onDurationChange?: (durationMs: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  onToggleFullscreen?: () => void;
  controlsVisible?: boolean;
  className?: string;
}

export const YouTubeVideoPlayer = forwardRef<
  YouTubeVideoPlayerHandle,
  YouTubeVideoPlayerProps
>(
  (
    {
      videoId,
      title = 'YouTube Video Player',
      isPlaying = true,
      initialPositionMs = 0,
      syncedPositionMs,
      positionMs,
      isViewerSync = false,
      volume = 1,
      muted = false,
      playbackRate = 1,
      playbackSpeed,
      onTimeUpdate,
      onDurationChange,
      onPlayStateChange,
      onToggleFullscreen,
      controlsVisible,
      className = 'w-full h-full',
    },
    ref
  ) => {
    const effectivePositionMs = positionMs !== undefined ? positionMs : syncedPositionMs;
    const effectiveSpeed = playbackSpeed !== undefined ? playbackSpeed : playbackRate;
    const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const playerId = `yt_player_${rawId}`;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const connectedRef = useRef<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const localTimeSecRef = useRef<number>(Math.floor((initialPositionMs || 0) / 1000));
    const localDurationSecRef = useRef<number>(0);
    const initialStartSec = useRef<number>(
      Math.max(0, Math.floor((initialPositionMs || 0) / 1000))
    );

    // Sync fullscreen state
    useEffect(() => {
      setIsFullscreen(isFullscreenActive());
      return onFullscreenChange((active) => {
        setIsFullscreen(active);
      });
    }, []);

    const handleToggleFullscreen = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onToggleFullscreen) {
        onToggleFullscreen();
        return;
      }
      if (isFullscreenActive()) {
        await exitFullscreenLandscape();
        setIsFullscreen(false);
      } else if (containerRef.current) {
        await enterFullscreenLandscape(containerRef.current);
        setIsFullscreen(true);
      }
    };

    // Reset initial start time only when videoId changes
    useEffect(() => {
      initialStartSec.current = Math.max(
        0,
        Math.floor((initialPositionMs || 0) / 1000)
      );
      connectedRef.current = false;
    }, [videoId]);

    const sendCommand = useCallback(
      (func: string, args: unknown[] = []) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        win.postMessage(
          JSON.stringify({
            event: 'command',
            func,
            args,
            id: playerId,
            channel: 'widget',
          }),
          '*'
        );
      },
      [playerId]
    );

    const registerBridgeListeners = useCallback(() => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage(
        JSON.stringify({
          event: 'listening',
          id: playerId,
          channel: 'widget',
        }),
        '*'
      );
      win.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'addEventListener',
          args: ['onStateChange'],
          id: playerId,
          channel: 'widget',
        }),
        '*'
      );
    }, [playerId]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => sendCommand('playVideo'),
        pause: () => sendCommand('pauseVideo'),
        seekToMs: (ms: number) => {
          const sec = Math.max(0, ms / 1000);
          localTimeSecRef.current = sec;
          sendCommand('seekTo', [sec, true]);
        },
        setVolume: (vol0to1: number) => {
          sendCommand('setVolume', [Math.round(Math.max(0, Math.min(1, vol0to1)) * 100)]);
        },
        setMuted: (m: boolean) => {
          sendCommand(m ? 'mute' : 'unMute');
        },
        setPlaybackRate: (rate: number) => {
          sendCommand('setPlaybackRate', [rate]);
        },
      }),
      [sendCommand]
    );

    // Keep handshake alive until YouTube iframe starts emitting infoDelivery
    useEffect(() => {
      const interval = window.setInterval(() => {
        registerBridgeListeners();
      }, 1200);
      return () => clearInterval(interval);
    }, [registerBridgeListeners, videoId]);

    // Listen for postMessage telemetry from the YouTube iframe
    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
          return;
        }
        if (typeof event.data !== 'string') return;
        try {
          const data = JSON.parse(event.data) as {
            event?: string;
            info?: {
              currentTime?: number;
              duration?: number;
              playerState?: number;
            } | number;
          };

          if (data.event === 'infoDelivery' && data.info && typeof data.info === 'object') {
            connectedRef.current = true;
            const info = data.info;
            if (typeof info.duration === 'number' && info.duration > 0) {
              localDurationSecRef.current = info.duration;
              onDurationChange?.(Math.round(info.duration * 1000));
            }
            if (typeof info.currentTime === 'number' && info.currentTime >= 0) {
              localTimeSecRef.current = info.currentTime;
              const curMs = Math.round(info.currentTime * 1000);
              const durMs = Math.round((localDurationSecRef.current || 0) * 1000);
              onTimeUpdate?.(curMs, durMs);
            }
            if (typeof info.playerState === 'number') {
              if (isViewerSync) {
                if (info.playerState === 2 && isPlaying) {
                  sendCommand('playVideo');
                } else if (info.playerState === 1 && !isPlaying) {
                  sendCommand('pauseVideo');
                }
              } else {
                if (info.playerState === 1) {
                  onPlayStateChange?.(true);
                } else if (info.playerState === 2) {
                  onPlayStateChange?.(false);
                }
              }
            }
          } else if (data.event === 'onStateChange' && typeof data.info === 'number') {
            if (isViewerSync) {
              if (data.info === 2 && isPlaying) {
                sendCommand('playVideo');
              } else if (data.info === 1 && !isPlaying) {
                sendCommand('pauseVideo');
              }
            } else {
              if (data.info === 1) {
                onPlayStateChange?.(true);
              } else if (data.info === 2) {
                onPlayStateChange?.(false);
              }
            }
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [onTimeUpdate, onDurationChange, onPlayStateChange, isViewerSync, isPlaying, sendCommand]);

    // Sync play / pause state prop
    useEffect(() => {
      if (isPlaying) {
        sendCommand('playVideo');
      } else {
        sendCommand('pauseVideo');
      }
    }, [isPlaying, sendCommand]);

    // Sync volume & mute props
    useEffect(() => {
      sendCommand('setVolume', [Math.round(Math.max(0, Math.min(1, volume)) * 100)]);
      sendCommand(muted || volume === 0 ? 'mute' : 'unMute');
    }, [volume, muted, sendCommand]);

    // Sync playback rate prop
    useEffect(() => {
      sendCommand('setPlaybackRate', [effectiveSpeed]);
    }, [effectiveSpeed, sendCommand]);

    // Sync viewer / external seek changes when effectivePositionMs diverges by >2.2s
    useEffect(() => {
      if (typeof effectivePositionMs !== 'number') return;
      const targetSec = Math.max(0, effectivePositionMs / 1000);
      if (Math.abs(localTimeSecRef.current - targetSec) > 2.2) {
        localTimeSecRef.current = targetSec;
        sendCommand('seekTo', [targetSec, true]);
      }
    }, [effectivePositionMs, isViewerSync, sendCommand]);

    const cleanVideoId = parseYouTubeVideoId(videoId) || videoId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 11);
    const [usePrivacyDomain, setUsePrivacyDomain] = useState<boolean>(false);
    const [internalControlsVisible, setInternalControlsVisible] = useState<boolean>(true);
    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

    const triggerInternalActivity = useCallback(() => {
      setInternalControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setInternalControlsVisible(false);
      }, 3000);
    }, []);

    useEffect(() => {
      triggerInternalActivity();
      return () => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      };
    }, [triggerInternalActivity]);

    const showButtons = controlsVisible !== undefined ? controlsVisible : internalControlsVisible;
    const host = usePrivacyDomain ? 'www.youtube-nocookie.com' : 'www.youtube.com';

    const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
    const referrer = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';

    const embedSrc = `https://${host}/embed/${encodeURIComponent(
      cleanVideoId
    )}?autoplay=1&playsinline=1&enablejsapi=1&controls=${isViewerSync ? 0 : 1}&disablekb=${
      isViewerSync ? 1 : 0
    }&rel=0&modestbranding=1&iv_load_policy=3&fs=1&origin=${origin}&widget_referrer=${referrer}&start=${
      initialStartSec.current
    }${muted ? '&mute=1' : ''}`;

    return (
      <div
        ref={containerRef}
        onMouseMove={triggerInternalActivity}
        onMouseEnter={triggerInternalActivity}
        onTouchStart={triggerInternalActivity}
        className={`relative bg-black overflow-hidden flex items-center justify-center w-full h-full min-w-0 min-h-0 group ${className}`}
      >
        <div className="w-full h-full max-w-full max-h-full aspect-video flex items-center justify-center relative min-w-0 min-h-0">
          <iframe
            id={playerId}
            ref={iframeRef}
            src={embedSrc}
            title={title}
            onLoad={() => {
              registerBridgeListeners();
              if (typeof effectivePositionMs === 'number' && effectivePositionMs > 1000) {
                sendCommand('seekTo', [Math.floor(effectivePositionMs / 1000), true]);
              }
              if (isPlaying) {
                sendCommand('playVideo');
              } else {
                sendCommand('pauseVideo');
              }
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0 bg-black aspect-video"
          />
          {isViewerSync && (
            <div
              onClick={triggerInternalActivity}
              onMouseMove={triggerInternalActivity}
              onTouchStart={triggerInternalActivity}
              className="absolute inset-0 z-10 cursor-default"
              title="Playback is controlled live by the Hall Host"
            />
          )}
        </div>

        {/* Dedicated Fullscreen Toggle Button on the video player container */}
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className={`absolute top-3 right-3 z-30 min-h-[38px] min-w-[38px] p-2 rounded-xl bg-black/75 hover:bg-black/95 text-white border border-white/20 shadow-xl backdrop-blur-md transition-all active:scale-95 flex items-center justify-center ${
            showButtons ? 'opacity-90 hover:opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          title={isFullscreen ? 'Exit Fullscreen' : 'Expand Video to Full Screen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-rose-400" /> : <Maximize2 className="w-4 h-4 text-white" />}
        </button>

        {/* Top Controls Overlay: External YouTube Link & Privacy Domain Toggle */}
        <div
          className={`absolute top-3 left-3 z-30 flex items-center gap-1.5 transition-opacity duration-200 ${
            showButtons ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(cleanVideoId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[34px] px-2.5 py-1 rounded-xl bg-black/70 hover:bg-black/90 text-zinc-300 hover:text-white border border-white/15 text-[11px] font-medium shadow-lg backdrop-blur-md transition-all flex items-center gap-1.5"
            title="Open video on YouTube in a new tab"
          >
            <ExternalLink className="w-3 h-3 text-red-500" />
            <span>YouTube</span>
          </a>

          <button
            type="button"
            onClick={() => setUsePrivacyDomain((prev) => !prev)}
            className="min-h-[34px] px-2 py-1 rounded-xl bg-black/70 hover:bg-black/90 text-zinc-300 hover:text-white border border-white/15 text-[10px] font-medium shadow-lg backdrop-blur-md transition-all flex items-center gap-1"
            title={usePrivacyDomain ? 'Switch to Standard Embed (youtube.com)' : 'Switch to Privacy-Enhanced (youtube-nocookie.com)'}
          >
            <Shield className={`w-3 h-3 ${usePrivacyDomain ? 'text-emerald-400' : 'text-zinc-400'}`} />
            <span>{usePrivacyDomain ? 'NoCookie' : 'Standard'}</span>
          </button>
        </div>
      </div>
    );
  }
);

YouTubeVideoPlayer.displayName = 'YouTubeVideoPlayer';

