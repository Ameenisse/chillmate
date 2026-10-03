import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useRef,
} from 'react';

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
      className = 'w-full h-full',
    },
    ref
  ) => {
    const effectivePositionMs = positionMs !== undefined ? positionMs : syncedPositionMs;
    const effectiveSpeed = playbackSpeed !== undefined ? playbackSpeed : playbackRate;
    const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const playerId = `yt_player_${rawId}`;
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const connectedRef = useRef<boolean>(false);
    const localTimeSecRef = useRef<number>(Math.floor((initialPositionMs || 0) / 1000));
    const localDurationSecRef = useRef<number>(0);
    const initialStartSec = useRef<number>(
      Math.max(0, Math.floor((initialPositionMs || 0) / 1000))
    );

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
              if (info.playerState === 1) {
                onPlayStateChange?.(true);
              } else if (info.playerState === 2) {
                onPlayStateChange?.(false);
              }
            }
          } else if (data.event === 'onStateChange' && typeof data.info === 'number') {
            if (data.info === 1) {
              onPlayStateChange?.(true);
            } else if (data.info === 2) {
              onPlayStateChange?.(false);
            }
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [onTimeUpdate, onPlayStateChange]);

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
      sendCommand('setPlaybackRate', [playbackRate]);
    }, [playbackRate, sendCommand]);

    // Sync viewer / external seek changes when syncedPositionMs diverges by >3.5s
    useEffect(() => {
      if (typeof syncedPositionMs !== 'number') return;
      const targetSec = Math.max(0, syncedPositionMs / 1000);
      if (Math.abs(localTimeSecRef.current - targetSec) > 3.5) {
        localTimeSecRef.current = targetSec;
        sendCommand('seekTo', [targetSec, true]);
      }
    }, [syncedPositionMs, isViewerSync, sendCommand]);

    const originParam =
      typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
    const embedSrc = `https://www.youtube.com/embed/${encodeURIComponent(
      videoId
    )}?autoplay=1&playsinline=1&enablejsapi=1&controls=1&rel=0&modestbranding=1&iv_load_policy=3&start=${
      initialStartSec.current
    }${originParam ? `&origin=${originParam}` : ''}`;

    return (
      <div className={`relative bg-black overflow-hidden flex items-center justify-center w-full h-full ${className}`}>
        <iframe
          id={playerId}
          ref={iframeRef}
          src={embedSrc}
          title={title}
          onLoad={() => {
            registerBridgeListeners();
            if (isPlaying) {
              sendCommand('playVideo');
            }
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="w-full h-full max-w-full max-h-full aspect-video border-0 bg-black"
        />
      </div>
    );
  }
);

YouTubeVideoPlayer.displayName = 'YouTubeVideoPlayer';
