import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Activity,
  AlertTriangle,
  AppWindow,
  Bluetooth,
  Camera,
  CameraOff,
  Captions,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coffee,
  ExternalLink,
  FastForward,
  Film,
  FlipHorizontal,
  Globe,
  HardDrive,
  Headphones,
  Hourglass,
  Loader2,
  LogOut,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  Minus,
  Move,
  Pause,
  Play,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Rewind,
  RotateCcw,
  RotateCw,
  Send,
  Smartphone,
  Sparkles,
  Speaker,
  Timer,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { useChillMate } from '../context/ChillMateContext';
import { ReactionEmoji } from '../types';
import { ASSETS, formatDurationMs, resolveYouTubeVideoId } from '../utils/media';
import { AppSharePrivacyModal } from '../components/hall/AppSharePrivacyModal';
import {
  YouTubeVideoPlayer,
  YouTubeVideoPlayerHandle,
} from '../components/player/YouTubeVideoPlayer';
import {
  enterFullscreenLandscape,
  exitFullscreenLandscape,
  isFullscreenActive,
  onFullscreenChange,
} from '../utils/fullscreen';

const REACTION_EMOJIS: ReactionEmoji[] = ['❤️', '😂', '😮', '🔥', '👏', '🥹', '🍿', '🎬'];

type SidePanelMode = 'SPLIT' | 'CAMERAS' | 'CHAT' | 'ACTIVITY' | 'PEOPLE';

/**
 * Creates a high-fidelity dynamic simulated camera stream
 * Used when physical camera hardware is unavailable or blocked in iframe/sandbox environments.
 */
function createSimulatedCamStream(displayName: string, onStop?: () => void): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  let animId: number;
  let frame = 0;

  function draw() {
    if (!ctx) return;
    frame++;
    const t = frame * 0.04;

    // Dark studio gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 640, 480);
    bgGrad.addColorStop(0, '#0c0a09');
    bgGrad.addColorStop(0.5, '#18181b');
    bgGrad.addColorStop(1, '#09090b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 640, 480);

    // Subtle framing guides
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, 560, 400);

    // Corner targeting reticles
    const reticleLen = 20;
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(40, 40 + reticleLen);
    ctx.lineTo(40, 40);
    ctx.lineTo(40 + reticleLen, 40);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(600 - reticleLen, 40);
    ctx.lineTo(600, 40);
    ctx.lineTo(600, 40 + reticleLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(40, 440 - reticleLen);
    ctx.lineTo(40, 440);
    ctx.lineTo(40 + reticleLen, 440);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(600 - reticleLen, 440);
    ctx.lineTo(600, 440);
    ctx.lineTo(600, 440 - reticleLen);
    ctx.stroke();

    // Central avatar with subtle live breathing motion
    const breath = Math.sin(t * 1.5) * 4;
    const centerY = 220 + breath;

    // Outer glow
    const glow = ctx.createRadialGradient(320, centerY, 30, 320, centerY, 100);
    glow.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
    glow.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(320, centerY, 100, 0, Math.PI * 2);
    ctx.fill();

    // Circle avatar
    ctx.fillStyle = '#1c1917';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(320, centerY, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Initials
    ctx.fillStyle = '#fafafa';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((displayName || 'You').slice(0, 2).toUpperCase(), 320, centerY);

    // Camera header badge
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(60, 65, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DEVICE CAMERA · LIVE', 76, 70);

    // Live clock
    const d = new Date();
    const timeStr = d.toLocaleTimeString() + '.' + String(Math.floor(d.getMilliseconds() / 100));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, 580, 70);

    // Simulated speech wave bars at bottom
    ctx.fillStyle = 'rgba(244, 63, 94, 0.75)';
    for (let i = 0; i < 20; i++) {
      const h = Math.abs(Math.sin(t * 3 + i * 0.4)) * 18 + 4;
      ctx.fillRect(230 + i * 9, 410 - h, 6, h);
    }

    animId = requestAnimationFrame(draw);
  }

  draw();

  const stream = canvas.captureStream(30);
  const track = stream.getVideoTracks()[0];
  if (track) {
    const origStop = track.stop.bind(track);
    track.stop = () => {
      cancelAnimationFrame(animId);
      origStop();
      if (onStop) onStop();
    };
  }

  return stream;
}

export const HallView: React.FC = () => {
  const {
    currentUser,
    activeHall,
    isCurrentUserHost,
    libraryItems,
    hallMembers,
    joinRequests,
    hallMessages,
    hallActivities,
    floatingReactions,
    hostPlay,
    hostPause,
    hostSeek,
    hostSkip,
    hostSetPlaybackSpeed,
    hostChangeMovie,
    hostUpdatePositionSilent,
    hostStartIntervalBreak,
    hostAdjustIntervalBreak,
    hostTogglePauseIntervalBreak,
    hostResetIntervalBreak,
    hostEndIntervalBreak,
    leaveHall,
    endMovieHallAsHost,
    respondToJoinRequest,
    sendHallChatMessage,
    sendHallReaction,
    toggleLocalMic,
    toggleLocalCamera,
    muteHallParticipant,
    muteAllOtherParticipants,
    remoteMemberCamFrames,
    broadcastMemberCameraFrame,
    latestVoiceChunk,
    broadcastVoiceChunk,
    updateLocalSpeakingState,
    activeScreenStream,
    stopHostScreenShare,
    latestPresentationFrame,
    broadcastPresentationFrame,
    viewportPreset,
  } = useChillMate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<YouTubeVideoPlayerHandle | null>(null);
  const hallContainerRef = useRef<HTMLDivElement | null>(null);
  const localCamVideoRef = useRef<HTMLVideoElement | null>(null);
  const [usedProxyStream, setUsedProxyStream] = useState<boolean>(false);
  const [useEmbedFallback, setUseEmbedFallback] = useState<boolean>(false);
  const [viewerVideoReady, setViewerVideoReady] = useState<boolean>(false);
  const [localMicStream, setLocalMicStream] = useState<MediaStream | null>(null);
  const [localMicLevel, setLocalMicLevel] = useState<number>(0);
  const localMicLevelRef = useRef<number>(0);
  const [voiceOverDucking, setVoiceOverDucking] = useState<boolean>(true);
  const [micSelfMonitor, setMicSelfMonitor] = useState<boolean>(false);
  const [locallyMutedParticipantIds, setLocallyMutedParticipantIds] = useState<string[]>([]);
  const [remoteSpeakerLevels, setRemoteSpeakerLevels] = useState<Record<string, number>>({});

  const toggleLocalMuteForParticipant = useCallback((targetUserId: string) => {
    setLocallyMutedParticipantIds((prev) =>
      prev.includes(targetUserId)
        ? prev.filter((id) => id !== targetUserId)
        : [...prev, targetUserId]
    );
  }, []);

  // Side Panel state for Landscape / Fullscreen (Sections 18 & 19)
  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>('SPLIT');
  const [sidePanelMinimized, setSidePanelMinimized] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [forceLandscapeLayout, setForceLandscapeLayout] = useState<boolean>(true);

  // Adjustable & Maximizable Sidebar state (More space for video)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('chillmate_hall_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 140 && parsed <= 560) return parsed;
      }
    } catch {}
    return 175; // Default Width: 175px
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);
  const isResizingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(175);

  // Camera Participants Collapsed toggle
  const [camerasCollapsed, setCamerasCollapsed] = useState<boolean>(false);

  // Inactivity auto-hide for all overlay control buttons & remote buttons in video preview area (3 seconds)
  const videoAreaRef = useRef<HTMLDivElement | null>(null);
  const [areControlsVisible, setAreControlsVisible] = useState<boolean>(true);
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

  const handleVideoAreaActivity = useCallback(() => {
    showControlsInstantly();
    scheduleHideControls(3000);
  }, [showControlsInstantly, scheduleHideControls]);

  useEffect(() => {
    handleVideoAreaActivity();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [handleVideoAreaActivity]);

  // Sync native fullscreen state
  useEffect(() => {
    setIsFullscreen(isFullscreenActive());
    return onFullscreenChange((active) => {
      setIsFullscreen(active);
    });
  }, []);

  // Direct DOM listeners on video presentation area for instant responsiveness to hover, mouse move, and tap
  useEffect(() => {
    const el = videoAreaRef.current;
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

  // Mobile portrait bottom sheet & Tablet portrait split height (Sections 20 & 21)
  const [mobileBottomSheetOpen, setMobileBottomSheetOpen] = useState<boolean>(false);
  const [tabletVideoHeightPct, setTabletVideoHeightPct] = useState<number>(52);

  // Local viewer/host audio & track preferences (Section 16, 17, 27)
  const [movieVolume, setMovieVolume] = useState<number>(0.9);
  const [movieMuted, setMovieMuted] = useState<boolean>(false);
  const [voiceVolume, setVoiceVolume] = useState<number>(0.8);
  const [audioOutputRoute, setAudioOutputRoute] = useState<'SPEAKER' | 'BLUETOOTH' | 'HEADPHONES'>('SPEAKER');
  const [subtitleTrack, setSubtitleTrack] = useState<'OFF' | 'EN' | 'AR'>('OFF');
  const [audioTrack, setAudioTrack] = useState<'SURROUND_5_1' | 'STEREO'>('SURROUND_5_1');

  // Modals inside Hall
  const [showEndHallConfirm, setShowEndHallConfirm] = useState<boolean>(false);
  const [showChangeMovieMenu, setShowChangeMovieMenu] = useState<boolean>(false);
  const [showSharePrivacyModal, setShowSharePrivacyModal] = useState<boolean>(false);
  const [showIntervalBreakModal, setShowIntervalBreakModal] = useState<boolean>(false);
  const [selectedBreakSec, setSelectedBreakSec] = useState<number>(180); // Default 3 mins
  const [breakMessage, setBreakMessage] = useState<string>('Popcorn & Rest Break 🍿');
  const [breakRemainingSec, setBreakRemainingSec] = useState<number>(0);
  const [isBreakCinemaOverlayMinimized, setIsBreakCinemaOverlayMinimized] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');

  // Device Camera states (Section 26: Camera View in Chat Box & Live Device Feed)
  const [localCamStream, setLocalCamStream] = useState<MediaStream | null>(null);
  const [camFacingMode, setCamFacingMode] = useState<'user' | 'environment'>('user');
  const [isCameraMirrored, setIsCameraMirrored] = useState<boolean>(true);
  const [isUsingSimulatedCam, setIsUsingSimulatedCam] = useState<boolean>(false);
  const [camPermissionStatus, setCamPermissionStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied'
  >('idle');
  const chatCamVideoRef = useRef<HTMLVideoElement | null>(null);
  const simCleanupRef = useRef<(() => void) | null>(null);

  const requestDeviceCameraPermission = useCallback(async () => {
    setCamPermissionStatus('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: camFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      if (simCleanupRef.current) {
        simCleanupRef.current();
        simCleanupRef.current = null;
      }
      setIsUsingSimulatedCam(false);
      setLocalCamStream(stream);
      setCamPermissionStatus('granted');
      return true;
    } catch (err) {
      console.warn('Device camera permission denied or unavailable:', err);
      setCamPermissionStatus('denied');
      return false;
    }
  }, [camFacingMode]);

  const setChatCamVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      chatCamVideoRef.current = el;
      if (el && localCamStream && el.srcObject !== localCamStream) {
        el.srcObject = localCamStream;
        el.play().catch(() => {});
      }
    },
    [localCamStream]
  );

  useEffect(() => {
    if (showChangeMovieMenu || showSharePrivacyModal || showEndHallConfirm || showIntervalBreakModal) {
      setAreControlsVisible(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [showChangeMovieMenu, showSharePrivacyModal, showEndHallConfirm, showIntervalBreakModal]);

  // Interval Break countdown timer & auto-play when timer finishes
  useEffect(() => {
    if (!activeHall?.breakState?.isActive) {
      setBreakRemainingSec(0);
      setIsBreakCinemaOverlayMinimized(false);
      return;
    }

    const checkTimer = () => {
      const bState = activeHall.breakState;
      if (!bState || !bState.isActive) {
        setBreakRemainingSec(0);
        return;
      }
      if (bState.isPaused) {
        setBreakRemainingSec(Math.max(0, bState.remainingSecWhenPaused ?? bState.totalDurationSec));
        return;
      }
      const now = Date.now();
      const diffMs = (bState.endsAt || now) - now;
      const sec = Math.max(0, Math.ceil(diffMs / 1000));
      setBreakRemainingSec(sec);
      if (diffMs <= 0) {
        // Break timer reached 0: automatically resume / play movie!
        if (isCurrentUserHost) {
          hostEndIntervalBreak(true);
        }
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 350);
    return () => clearInterval(interval);
  }, [
    activeHall?.breakState?.isActive,
    activeHall?.breakState?.isPaused,
    activeHall?.breakState?.remainingSecWhenPaused,
    activeHall?.breakState?.endsAt,
    activeHall?.breakState?.totalDurationSec,
    isCurrentUserHost,
    hostEndIntervalBreak,
  ]);

  const myHallMember = hallMembers.find((m) => m.userId === currentUser.id);
  const pendingRequests = joinRequests.filter((r) => r.status === 'PENDING');

  const activeHallLibraryItem = activeHall?.libraryItemId
    ? libraryItems.find((i) => i.id === activeHall.libraryItemId)
    : undefined;

  const youTubeVideoId =
    activeHall && !activeScreenStream
      ? resolveYouTubeVideoId({
          videoUrl: activeHall.videoUrl,
          embedUrl: activeHall.embedUrl,
          originalPageUrl: activeHallLibraryItem?.originalPageUrl,
          posterUrl: activeHall.posterUrl || activeHallLibraryItem?.posterUrl,
        })
      : null;

  // Attach MediaStream or videoUrl to <video> element and enforce Late-Join sync without restarting!
  useEffect(() => {
    if (!activeHall || youTubeVideoId || !videoRef.current) return;
    const video = videoRef.current;

    if (activeScreenStream) {
      video.srcObject = activeScreenStream;
      video.play().catch(() => {});
      return;
    } else {
      video.srcObject = null;
    }

    const streamUrl =
      activeHall.videoUrl ||
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';

    let hls: Hls | null = null;
    setUsedProxyStream(false);
    setUseEmbedFallback(
      Boolean(
        activeHall.embedUrl &&
          activeHall.videoUrl === activeHall.embedUrl &&
          !activeHall.videoUrl.startsWith('/api/video/stream')
      )
    );

    if (streamUrl.toLowerCase().includes('.m3u8') && Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
    } else if (video.getAttribute('src') !== streamUrl) {
      setViewerVideoReady(false);
      video.src = streamUrl;
      video.load();
    }

    const syncInitialPosition = () => {
      if (video.duration > 5) {
        const targetSec = ((activeHall.positionMs || 0) / 1000) % video.duration;
        if (Math.abs(video.currentTime - targetSec) > 2.5) {
          video.currentTime = targetSec;
        }
      }
      if (activeHall.isPlaying) {
        video.play().catch(() => {
          video.muted = true;
          setMovieMuted(true);
          video.play().catch(() => {});
        });
      } else {
        video.pause();
      }
    };

    if (video.readyState >= 1) {
      syncInitialPosition();
    } else {
      video.onloadedmetadata = syncInitialPosition;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [activeHall?.id, activeHall?.videoUrl, activeScreenStream, youTubeVideoId]);

  // Sync play/pause & speed changes from Host to Viewer without restarting
  useEffect(() => {
    if (!activeHall || youTubeVideoId) return;
    const video = videoRef.current;
    if (!video || activeScreenStream) return;

    video.playbackRate = activeHall.playbackSpeed || 1;

    if (activeHall.isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!activeHall.isPlaying && !video.paused) {
      video.pause();
    }
  }, [activeHall?.isPlaying, activeHall?.playbackSpeed, activeScreenStream, youTubeVideoId]);

  // Live position sync for Viewers whenever Host seeks, skips (-10s/+10s), or sends heartbeat
  useEffect(() => {
    if (!activeHall || isCurrentUserHost || youTubeVideoId || activeScreenStream) return;
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;

    const targetSec = Math.max(
      0,
      Math.min(video.duration, (activeHall.positionMs || 0) / 1000)
    );
    if (Math.abs(video.currentTime - targetSec) > 2.0) {
      video.currentTime = targetSec;
    }
  }, [activeHall?.positionMs, isCurrentUserHost, youTubeVideoId, activeScreenStream]);

  // Host live video presentation frame broadcaster (streams live video feed from Host's player to all joined team members)
  useEffect(() => {
    if (!activeHall || !isCurrentUserHost || youTubeVideoId) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    const interval = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !ctx || v.readyState < 2) return;
      try {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const curMs = Math.round((v.currentTime || 0) * 1000);
        broadcastPresentationFrame(frameDataUrl, curMs, !v.paused);
      } catch {
        // Cross-origin video without CORS headers will still sync via direct videoUrl & positionMs heartbeat
      }
    }, 260);

    return () => clearInterval(interval);
  }, [activeHall?.id, isCurrentUserHost, youTubeVideoId, broadcastPresentationFrame]);

  // Synchronize localCamStream to all mounted video elements (chat box camera and sidebar grid)
  useEffect(() => {
    if (localCamStream) {
      if (chatCamVideoRef.current && chatCamVideoRef.current.srcObject !== localCamStream) {
        chatCamVideoRef.current.srcObject = localCamStream;
        chatCamVideoRef.current.play().catch(() => {});
      }
      if (localCamVideoRef.current && localCamVideoRef.current.srcObject !== localCamStream) {
        localCamVideoRef.current.srcObject = localCamStream;
        localCamVideoRef.current.play().catch(() => {});
      }
    }
  }, [localCamStream]);

  // Broadcast live camera frames from user's device to all other Hall members when cameraEnabled is true
  useEffect(() => {
    if (!myHallMember?.cameraEnabled || !localCamStream) return;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    const interval = window.setInterval(() => {
      const camVideo = chatCamVideoRef.current || localCamVideoRef.current;
      if (!camVideo || !ctx || camVideo.readyState < 2) return;
      try {
        ctx.drawImage(camVideo, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
        broadcastMemberCameraFrame(dataUrl);
      } catch {
        // ignore
      }
    }, 220);

    return () => clearInterval(interval);
  }, [myHallMember?.cameraEnabled, localCamStream, broadcastMemberCameraFrame]);

  // Live Device Microphone capture, voice level detection, and live audio streaming when user enables their Mic
  useEffect(() => {
    let active = true;
    let audioCtx: AudioContext | null = null;
    let levelInterval: number | null = null;
    let recorderInterval: number | null = null;
    let activeStream: MediaStream | null = null;

    const createSimulatedVoiceWavDataUrl = (freqHz = 210): string => {
      const sampleRate = 8000;
      const numSamples = 2000; // 250ms slice
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);
      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + numSamples * 2, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, numSamples * 2, true);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.sin((Math.PI * i) / numSamples);
        const sample =
          Math.sin(2 * Math.PI * freqHz * t) * 0.14 * env +
          Math.sin(2 * Math.PI * (freqHz * 1.5) * t) * 0.06 * env;
        view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
      }
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return 'data:audio/wav;base64,' + window.btoa(binary);
    };

    const startSimulatedVoiceOverStream = () => {
      let tick = 0;
      levelInterval = window.setInterval(() => {
        if (!active) return;
        tick++;
        const simLevel = Math.round(32 + Math.abs(Math.sin(tick * 0.55)) * 48);
        localMicLevelRef.current = simLevel;
        setLocalMicLevel(simLevel);
        updateLocalSpeakingState(simLevel > 15);
      }, 200);

      recorderInterval = window.setInterval(() => {
        if (!active) return;
        const wavUrl = createSimulatedVoiceWavDataUrl(195 + (tick % 4) * 18);
        broadcastVoiceChunk(wavUrl, localMicLevelRef.current || 50);
      }, 650);
    };

    if (myHallMember?.micEnabled) {
      if (!navigator.mediaDevices?.getUserMedia) {
        startSimulatedVoiceOverStream();
      } else {
        navigator.mediaDevices
          .getUserMedia({
            audio: {
              echoCancellation: !micSelfMonitor,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          })
          .then((stream) => {
            if (!active) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            activeStream = stream;
            setLocalMicStream(stream);

            try {
              const AudioContextClass =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
              audioCtx = new AudioContextClass();
              const source = audioCtx.createMediaStreamSource(stream);
              const analyser = audioCtx.createAnalyser();
              analyser.fftSize = 256;
              source.connect(analyser);
              if (micSelfMonitor) {
                const monitorGain = audioCtx.createGain();
                monitorGain.gain.value = Math.max(0, Math.min(1, voiceVolume * 0.5));
                source.connect(monitorGain);
                monitorGain.connect(audioCtx.destination);
              }
              const dataArray = new Uint8Array(analyser.frequencyBinCount);

              levelInterval = window.setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                const normalized = Math.min(100, Math.round((avg / 85) * 100));
                localMicLevelRef.current = normalized;
                setLocalMicLevel(normalized);
                updateLocalSpeakingState(normalized > 10);
              }, 160);
            } catch {
              // fallback if AudioContext restricted
            }

            // Stream short live voice audio chunks over WebSocket when MediaRecorder is available
            if (typeof MediaRecorder !== 'undefined') {
              const recordSlice = () => {
                if (!active || !activeStream || !activeStream.active) return;
                try {
                  const recorder = new MediaRecorder(activeStream);
                  const chunks: BlobPart[] = [];
                  recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) chunks.push(e.data);
                  };
                  recorder.onstop = () => {
                    if (!active || chunks.length === 0) return;
                    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      if (typeof reader.result === 'string') {
                        broadcastVoiceChunk(reader.result, localMicLevelRef.current);
                      }
                    };
                    reader.readAsDataURL(blob);
                  };
                  recorder.start();
                  setTimeout(() => {
                    if (recorder.state === 'recording') {
                      recorder.stop();
                    }
                  }, 420);
                } catch {
                  // ignore if codec unsupported
                }
              };
              recorderInterval = window.setInterval(recordSlice, 460);
            }
          })
          .catch((err) => {
            console.warn('Device microphone access denied or unavailable, enabling fallback voice-over feed:', err);
            if (!active) return;
            startSimulatedVoiceOverStream();
          });
      }
    } else {
      if (localMicStream) {
        localMicStream.getTracks().forEach((t) => t.stop());
        setLocalMicStream(null);
      }
      localMicLevelRef.current = 0;
      setLocalMicLevel(0);
    }

    return () => {
      active = false;
      if (levelInterval) clearInterval(levelInterval);
      if (recorderInterval) clearInterval(recorderInterval);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [myHallMember?.micEnabled, micSelfMonitor, broadcastVoiceChunk, updateLocalSpeakingState]);

  // Play incoming live voice audio chunks from other Hall members (unless muted by Hall or locally muted)
  useEffect(() => {
    if (!latestVoiceChunk || !latestVoiceChunk.audioDataUrl || voiceVolume <= 0) return;
    if (locallyMutedParticipantIds.includes(latestVoiceChunk.userId)) return;
    const senderMember = hallMembers.find((m) => m.userId === latestVoiceChunk.userId);
    if (senderMember && !senderMember.micEnabled) return;

    if (typeof latestVoiceChunk.level === 'number') {
      setRemoteSpeakerLevels((prev) => ({
        ...prev,
        [latestVoiceChunk.userId]: latestVoiceChunk.level!,
      }));
    }

    try {
      const audio = new Audio(latestVoiceChunk.audioDataUrl);
      audio.volume = Math.max(0, Math.min(1, voiceVolume));
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }, [latestVoiceChunk, voiceVolume, locallyMutedParticipantIds, hallMembers]);

  // Voice-Over Auto-Ducking: Automatically lowers movie volume while any unmuted participant is speaking on Mic
  const anyUnmutedSpeakerActive = hallMembers.some(
    (m) =>
      m.micEnabled &&
      (m.isSpeaking || (m.userId === currentUser.id && localMicLevel > 12)) &&
      !locallyMutedParticipantIds.includes(m.userId)
  );

  useEffect(() => {
    const effectiveVol = movieMuted
      ? 0
      : voiceOverDucking && anyUnmutedSpeakerActive
      ? Math.max(0.08, movieVolume * 0.28)
      : movieVolume;
    if (videoRef.current) {
      videoRef.current.volume = effectiveVol;
      videoRef.current.muted = movieMuted;
    }
    ytPlayerRef.current?.setVolume(effectiveVol);
    ytPlayerRef.current?.setMuted(movieMuted);
  }, [movieVolume, movieMuted, voiceOverDucking, anyUnmutedSpeakerActive]);

  // Sync device camera preview when participant enables camera
  useEffect(() => {
    let active = true;

    if (myHallMember?.cameraEnabled) {
      if (simCleanupRef.current) {
        simCleanupRef.current();
        simCleanupRef.current = null;
      }
      setCamPermissionStatus('requesting');

      navigator.mediaDevices
        ?.getUserMedia({
          video: {
            facingMode: camFacingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        })
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          setIsUsingSimulatedCam(false);
          setLocalCamStream(stream);
          setCamPermissionStatus('granted');
        })
        .catch((err) => {
          console.warn('Device camera access denied or restricted:', err);
          if (!active) return;
          setCamPermissionStatus('denied');
          setIsUsingSimulatedCam(true);
          const simStream = createSimulatedCamStream(currentUser.displayName, () => {});
          setLocalCamStream(simStream);
          simCleanupRef.current = () => {
            simStream.getTracks().forEach((t) => t.stop());
          };
        });
    } else {
      if (simCleanupRef.current) {
        simCleanupRef.current();
        simCleanupRef.current = null;
      }
      if (localCamStream) {
        localCamStream.getTracks().forEach((t) => t.stop());
        setLocalCamStream(null);
      }
      setCamPermissionStatus('idle');
      setIsUsingSimulatedCam(false);
    }

    return () => {
      active = false;
      if (simCleanupRef.current) {
        simCleanupRef.current();
        simCleanupRef.current = null;
      }
    };
  }, [myHallMember?.cameraEnabled, camFacingMode, currentUser.displayName]);

  // Sidebar drag-resizing listeners (Mouse + Touch)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = startXRef.current - e.clientX;
      const nextWidth = Math.max(140, Math.min(560, startWidthRef.current + deltaX));
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizingSidebar(false);
        try {
          localStorage.setItem('chillmate_hall_sidebar_width', String(sidebarWidth));
        } catch {}
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizingRef.current || !e.touches[0]) return;
      const deltaX = startXRef.current - e.touches[0].clientX;
      const nextWidth = Math.max(140, Math.min(560, startWidthRef.current + deltaX));
      setSidebarWidth(nextWidth);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [sidebarWidth]);

  const handleStartResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizingSidebar(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX;
    startWidthRef.current = sidebarWidth;
  };

  if (!activeHall) return null;

  const handleToggleFullscreen = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetElement = videoAreaRef.current || hallContainerRef.current;
    if (!targetElement) return;

    try {
      if (isFullscreenActive()) {
        await exitFullscreenLandscape();
        setIsFullscreen(false);
      } else {
        await enterFullscreenLandscape(targetElement);
        setIsFullscreen(true);
        setForceLandscapeLayout(true);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
      setForceLandscapeLayout(true);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendHallChatMessage(chatInput);
    setChatInput('');
  };

  const isPhonePortrait = viewportPreset === 'PHONE_PORTRAIT';
  const isTabletPortrait = viewportPreset === 'TABLET_PORTRAIT';
  const useSideBySideLandscape =
    !isPhonePortrait && !isTabletPortrait && (forceLandscapeLayout || isFullscreen || viewportPreset === 'TABLET_LANDSCAPE');

  // Render the shared Collaboration Content (SPLIT, CAMERAS, CHAT, ACTIVITY, PEOPLE)
  const renderCollaborationBody = () => (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#111115]">
      {/* Mode Selector Tabs (Section 18: SPLIT | CAMERAS | CHAT | ACTIVITY | PEOPLE) */}
      <div className="flex items-center justify-between gap-1 px-2.5 py-1.5 border-b border-zinc-800/90 bg-zinc-950/70 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0">
          {(
            [
              { id: 'SPLIT', label: 'SPLIT' },
              { id: 'CAMERAS', label: 'CAMERAS' },
              { id: 'CHAT', label: 'CHAT' },
              { id: 'ACTIVITY', label: 'ACTIVITY' },
              { id: 'PEOPLE', label: `PEOPLE (${hallMembers.length})` },
            ] as { id: SidePanelMode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSidePanelMode(tab.id)}
              className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                sidePanelMode === tab.id
                  ? 'bg-rose-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {tab.label}
              {tab.id === 'PEOPLE' && isCurrentUserHost && pendingRequests.length > 0 && (
                <span className="ml-1 px-1 rounded-full bg-amber-400 text-zinc-950 text-[9px] font-bold">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Width Toggle & Minimize Buttons */}
        {useSideBySideLandscape && (
          <div className="flex items-center gap-1 shrink-0">
            {/* Quick Adjust Width / Maximize Sidebar */}
            <button
              onClick={() => {
                if (sidebarWidth >= 320) {
                  setSidebarWidth(175);
                } else {
                  setSidebarWidth(380);
                }
              }}
              className="p-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
              title={
                sidebarWidth >= 320
                  ? 'Default Sidebar (175px) · Maximum space for video'
                  : 'Expand Sidebar (380px) · Wider chat'
              }
            >
              {sidebarWidth >= 320 ? (
                <Minimize2 className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            {/* Minimize to 0px button */}
            <button
              onClick={() => setSidePanelMinimized(true)}
              className="px-1.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-semibold text-zinc-300 hover:text-white flex items-center gap-0.5 transition-colors"
              title="Hide sidebar to give 100% space to video"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">HIDE</span>
            </button>
          </div>
        )}
      </div>

      {/* LIVE MICROPHONE VOICE-OVER & PARTICIPANT MUTE CONTROL STRIP (Always accessible in Sidebar) */}
      <div className="px-2.5 py-2 bg-zinc-950/90 border-b border-zinc-800/90 shrink-0 space-y-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={toggleLocalMic}
            className={`flex-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
              myHallMember?.micEnabled
                ? 'bg-emerald-600/25 border-emerald-500 text-emerald-200 shadow-sm shadow-emerald-950/50'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
            }`}
            title={
              myHallMember?.micEnabled
                ? 'Stop Live Microphone Voice-Over'
                : 'Enable Live Microphone Voice-Over Feed'
            }
          >
            {myHallMember?.micEnabled ? (
              <>
                <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">Voice-Over ON ({localMicLevel}%)</span>
              </>
            ) : (
              <>
                <MicOff className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">Enable Mic Voice-Over</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setVoiceOverDucking((prev) => !prev)}
            className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-colors shrink-0 ${
              voiceOverDucking
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Voice-Over Auto-Ducking: Automatically lowers movie volume when someone speaks into the microphone"
          >
            Ducking {voiceOverDucking ? 'ON' : 'OFF'}
          </button>

          {hallMembers.some((m) => m.userId !== currentUser.id && m.micEnabled) && (
            <button
              type="button"
              onClick={muteAllOtherParticipants}
              className="px-2 py-1.5 rounded-lg bg-rose-600/25 hover:bg-rose-600/40 border border-rose-500/50 text-[10px] font-bold text-rose-200 flex items-center gap-1 shrink-0 transition-colors"
              title="Mute all disturbing participants in the Hall immediately"
            >
              <MicOff className="w-3 h-3 text-rose-400" />
              <span>Mute All</span>
            </button>
          )}
        </div>

        {/* Live Microphone Audio Feed Visualizer Bar when Local Mic or Remote Participant Mic is Active */}
        {(myHallMember?.micEnabled ||
          hallMembers.some((m) => m.userId !== currentUser.id && m.micEnabled)) && (
          <div className="space-y-1 pt-0.5">
            {myHallMember?.micEnabled && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-emerald-300 font-semibold flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Mic Feed:
                </span>
                <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-150"
                    style={{ width: `${Math.max(8, localMicLevel)}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMicSelfMonitor((prev) => !prev)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                    micSelfMonitor
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                  title="Hear your own live microphone voice-over feed locally"
                >
                  {micSelfMonitor ? 'Hear Self: ON' : 'Hear Self'}
                </button>
              </div>
            )}

            {/* Active Remote Microphones list with instant Mute buttons for disturbing participants */}
            {hallMembers
              .filter((m) => m.userId !== currentUser.id && m.micEnabled)
              .map((speaker) => {
                const isLocallyMuted = locallyMutedParticipantIds.includes(speaker.userId);
                const level = remoteSpeakerLevels[speaker.userId] ?? (speaker.isSpeaking ? 65 : 18);
                return (
                  <div
                    key={speaker.userId}
                    className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[10px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Mic
                        className={`w-3 h-3 shrink-0 ${
                          isLocallyMuted
                            ? 'text-zinc-500'
                            : speaker.isSpeaking
                            ? 'text-emerald-400 animate-bounce'
                            : 'text-emerald-400'
                        }`}
                      />
                      <span className="font-semibold text-zinc-200 truncate">
                        {speaker.displayName}
                      </span>
                      {!isLocallyMuted && (
                        <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full bg-emerald-400 transition-all duration-150"
                            style={{ width: `${Math.min(100, Math.max(15, level))}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleLocalMuteForParticipant(speaker.userId)}
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold transition-colors ${
                          isLocallyMuted
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300'
                        }`}
                        title={
                          isLocallyMuted
                            ? `Unmute ${speaker.displayName} for me`
                            : `Mute ${speaker.displayName} locally for me`
                        }
                      >
                        {isLocallyMuted ? 'Unmute Me' : 'Mute Local'}
                      </button>
                      <button
                        type="button"
                        onClick={() => muteHallParticipant(speaker.userId)}
                        className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-[9px] font-bold text-white flex items-center gap-0.5 transition-colors"
                        title={`Mute ${speaker.displayName}'s microphone in the Hall if disturbing`}
                      >
                        <MicOff className="w-2.5 h-2.5" />
                        <span>Mute Mic</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {myHallMember && !myHallMember.micEnabled && myHallMember.mutedByName && (
          <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[10px] text-rose-200">
            <span>Muted by {myHallMember.mutedByName}</span>
            <button
              type="button"
              onClick={toggleLocalMic}
              className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              Re-enable Mic
            </button>
          </div>
        )}
      </div>

      {/* Synchronized Break Timer Status Card inside Collaboration Sidebar (Visible to all participants) */}
      {activeHall.breakState?.isActive && (
        <div className="p-2.5 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border-b border-amber-500/40 shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
              <span className="text-[11px] font-bold text-amber-200 truncate">
                {activeHall.breakState.message || 'Interval Break'}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-zinc-950/90 border border-amber-500/40 text-xs font-mono-tabular font-extrabold text-amber-300 shrink-0">
              {Math.floor(breakRemainingSec / 60)
                .toString()
                .padStart(2, '0')}
              :
              {(breakRemainingSec % 60).toString().padStart(2, '0')}
              {activeHall.breakState.isPaused ? ' (PAUSED)' : ''}
            </span>
          </div>
          {isCurrentUserHost ? (
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => hostAdjustIntervalBreak(-30)}
                  className="px-1.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-mono font-semibold text-zinc-200"
                  title="Subtract 30 seconds"
                >
                  -30s
                </button>
                <button
                  type="button"
                  onClick={() => hostAdjustIntervalBreak(60)}
                  className="px-1.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-mono font-semibold text-zinc-200"
                  title="Add 1 minute"
                >
                  +1m
                </button>
                <button
                  type="button"
                  onClick={hostTogglePauseIntervalBreak}
                  className="px-1.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-amber-300"
                  title={activeHall.breakState.isPaused ? 'Resume Timer' : 'Pause Timer'}
                >
                  {activeHall.breakState.isPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => hostEndIntervalBreak(true)}
                className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-[10px] font-bold text-white flex items-center gap-1"
                title="End Break & Resume Movie"
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>End</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[10px] text-amber-200/80">
              <span>Started by {activeHall.breakState.startedByName}</span>
              <span>{activeHall.breakState.isPaused ? 'Timer paused by host' : 'Auto-resumes at 00:00'}</span>
            </div>
          )}
        </div>
      )}

      {/* Host Pending Join Requests Alert inside Panel (Sections 14 & 15) */}
      {isCurrentUserHost && pendingRequests.length > 0 && (
        <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 space-y-2 shrink-0">
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between gap-2 text-xs bg-zinc-950/90 p-2.5 rounded-xl border border-amber-500/30"
            >
              <div className="min-w-0">
                <p className="font-semibold text-zinc-100 truncate">
                  {req.requesterName} wants to join your Movie Hall.
                </p>
                <p className="text-[11px] text-zinc-400">
                  Joins at live point {formatDurationMs(activeHall.positionMs)} (No restart)
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => respondToJoinRequest(req.id, 'DECLINED')}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-300"
                >
                  DECLINE
                </button>
                <button
                  onClick={() => respondToJoinRequest(req.id, 'ACCEPTED')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold text-white flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>ACCEPT</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CAMERAS FULL GALLERY VIEW (When CAMERAS tab is selected) */}
      {sidePanelMode === 'CAMERAS' && (
        <div className="flex-1 flex flex-col min-h-0 p-2 sm:p-2.5 gap-2 overflow-y-auto">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
            <span className="font-semibold text-zinc-300">
              Camera Grid ({hallMembers.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleLocalCamera}
                className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${
                  myHallMember?.cameraEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-300 hover:text-white'
                }`}
              >
                {myHallMember?.cameraEnabled ? (
                  <>
                    <Camera className="w-3 h-3 text-emerald-400" />
                    <span>My Cam On</span>
                  </>
                ) : (
                  <>
                    <CameraOff className="w-3 h-3 text-zinc-400" />
                    <span>My Cam Off</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 flex-1 min-h-0 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-zinc-700">
            {hallMembers.map((member) => {
              const isMe = member.userId === currentUser.id;
              return (
                <div
                  key={member.id}
                  className={`relative rounded-xl bg-zinc-900 border overflow-hidden flex flex-col items-center justify-center p-2 aspect-[4/3] w-full transition-colors ${
                    member.isSpeaking
                      ? 'border-emerald-500/80 shadow-xs shadow-emerald-500/20 ring-1 ring-emerald-500/50'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {isMe && member.cameraEnabled && localCamStream ? (
                    <video
                      ref={(el) => {
                        localCamVideoRef.current = el;
                        if (el && localCamStream && el.srcObject !== localCamStream) {
                          el.srcObject = localCamStream;
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      muted
                      playsInline
                      className={`absolute inset-0 w-full h-full object-cover ${
                        isCameraMirrored ? 'scale-x-[-1]' : ''
                      }`}
                    />
                  ) : !isMe && member.cameraEnabled && remoteMemberCamFrames[member.userId] ? (
                    <img
                      src={remoteMemberCamFrames[member.userId]}
                      alt={`${member.displayName} live camera`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : member.cameraEnabled ? (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex flex-col items-center justify-center gap-1">
                      <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-sm font-bold text-rose-200 shadow-inner">
                        {member.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[9px] text-emerald-400 font-medium animate-pulse">
                        Connecting live cam...
                      </span>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-semibold text-zinc-200">
                      {member.displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[10px] bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-white/5">
                    <span className="text-zinc-100 font-medium truncate max-w-[105px]">
                      {member.displayName} {member.role === 'HOST' ? '(Host)' : ''}{' '}
                      {isMe ? '(You)' : ''}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isMe ? (
                        <>
                          <button
                            type="button"
                            onClick={toggleLocalMic}
                            className="p-0.5 rounded hover:bg-zinc-700"
                            title={member.micEnabled ? 'Disable My Mic' : 'Enable My Mic'}
                          >
                            {member.micEnabled ? (
                              <Mic className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <MicOff className="w-3 h-3 text-zinc-500" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={toggleLocalCamera}
                            className="p-0.5 rounded hover:bg-zinc-700"
                            title={member.cameraEnabled ? 'Disable My Camera' : 'Enable My Camera'}
                          >
                            {member.cameraEnabled ? (
                              <Camera className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <CameraOff className="w-3 h-3 text-zinc-500" />
                            )}
                          </button>
                        </>
                      ) : (
                        <>
                          {member.micEnabled ? (
                            <button
                              type="button"
                              onClick={() => muteHallParticipant(member.userId)}
                              className="px-1.5 py-0.5 rounded bg-rose-600/90 hover:bg-rose-500 text-white text-[9px] font-bold flex items-center gap-0.5"
                              title={`Mute ${member.displayName} if disturbing`}
                            >
                              <MicOff className="w-2.5 h-2.5" />
                              <span>Mute</span>
                            </button>
                          ) : (
                            <MicOff className="w-3 h-3 text-zinc-500" />
                          )}
                          {member.cameraEnabled ? (
                            <Camera className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <CameraOff className="w-3 h-3 text-zinc-500" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5 mt-auto shrink-0">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span>VOICE VOLUME (Separate from Movie)</span>
              <span className="font-mono-tabular">{Math.round(voiceVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={voiceVolume}
              onChange={(e) => setVoiceVolume(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>
      )}

      {/* CHAT BOX (Shown in SPLIT and CHAT modes · 1-Column Responsive Box Grid aspect-[4/3]) */}
      {(sidePanelMode === 'SPLIT' || sidePanelMode === 'CHAT') && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* CAMERA VIEW IN CHAT BOX: 1-Column responsive box grid (aspect-[4/3]) */}
          <div className="border-b border-zinc-800/90 bg-zinc-950/60 p-2 sm:p-2.5 flex flex-col gap-2 shrink-0">
            {/* Camera View Header inside Chat Box */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-rose-400" />
                  <span>Live Cameras</span>
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300">
                  {hallMembers.filter((m) => m.cameraEnabled).length} Active
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Quick Toggle Device Camera Button */}
                <button
                  type="button"
                  onClick={() => {
                    toggleLocalCamera();
                    if (!myHallMember?.cameraEnabled) {
                      setCamerasCollapsed(false);
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                    myHallMember?.cameraEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                  }`}
                  title={myHallMember?.cameraEnabled ? 'Turn Camera Off' : 'Turn Device Camera On'}
                >
                  {myHallMember?.cameraEnabled ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Cam On</span>
                    </>
                  ) : (
                    <>
                      <CameraOff className="w-3 h-3 text-zinc-400" />
                      <span>Cam Off</span>
                    </>
                  )}
                </button>

                {/* Switch Voice Route */}
                <button
                  type="button"
                  onClick={() => {
                    const routes: ('SPEAKER' | 'BLUETOOTH' | 'HEADPHONES')[] = [
                      'SPEAKER',
                      'BLUETOOTH',
                      'HEADPHONES',
                    ];
                    setAudioOutputRoute(
                      routes[(routes.indexOf(audioOutputRoute) + 1) % routes.length]
                    );
                  }}
                  className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                  title="Switch Voice Audio Output (Speaker / Bluetooth / Headphones)"
                >
                  {audioOutputRoute === 'BLUETOOTH' ? (
                    <Bluetooth className="w-3 h-3 text-sky-400" />
                  ) : audioOutputRoute === 'HEADPHONES' ? (
                    <Headphones className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Speaker className="w-3 h-3 text-rose-400" />
                  )}
                </button>

                {/* Collapse / Expand Camera View inside Chat Box */}
                <button
                  type="button"
                  onClick={() => setCamerasCollapsed((prev) => !prev)}
                  className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
                  title={camerasCollapsed ? 'Expand camera view in chat' : 'Collapse camera view for larger chat'}
                >
                  {camerasCollapsed ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Expanded Camera View in Chat Box: 1-Column Responsive Box Grid (aspect-[4/3]) */}
            {!camerasCollapsed && (
              <div className="grid grid-cols-1 gap-2.5 max-h-[260px] overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-zinc-700">
                {hallMembers.map((member) => {
                  const isMe = member.userId === currentUser.id;
                  return (
                    <div
                      key={member.id}
                      className={`relative rounded-xl bg-zinc-900 border overflow-hidden flex flex-col items-center justify-center p-2 aspect-[4/3] w-full transition-colors ${
                        member.isSpeaking
                          ? 'border-emerald-500/80 shadow-xs shadow-emerald-500/20 ring-1 ring-emerald-500/50'
                          : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {isMe && member.cameraEnabled && localCamStream ? (
                        <video
                          ref={setChatCamVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className={`absolute inset-0 w-full h-full object-cover ${
                            isCameraMirrored ? 'scale-x-[-1]' : ''
                          }`}
                        />
                      ) : !isMe && member.cameraEnabled && remoteMemberCamFrames[member.userId] ? (
                        <img
                          src={remoteMemberCamFrames[member.userId]}
                          alt={`${member.displayName} live camera`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : member.cameraEnabled ? (
                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex flex-col items-center justify-center gap-1">
                          <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-sm font-bold text-rose-200 shadow-inner">
                            {member.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[9px] text-emerald-400 font-medium animate-pulse">
                            Connecting live cam...
                          </span>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-semibold text-zinc-200">
                          {member.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Mirror, Rotate, and Mic Controls on Local Camera */}
                      {isMe && member.cameraEnabled && (
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/75 backdrop-blur-xs p-0.5 rounded-lg border border-white/10 z-10">
                          <button
                            type="button"
                            onClick={() =>
                              setCamFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
                            }
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
                            title="Flip Front / Back Camera"
                          >
                            <RotateCw className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCameraMirrored((prev) => !prev)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white"
                            title="Mirror Camera"
                          >
                            <FlipHorizontal className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[10px] bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-white/5">
                        <span className="text-zinc-100 font-medium truncate max-w-[105px]">
                          {member.displayName} {member.role === 'HOST' ? '(Host)' : ''}{' '}
                          {isMe ? '(You)' : ''}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isMe ? (
                            <>
                              <button
                                type="button"
                                onClick={toggleLocalMic}
                                className="p-0.5 rounded hover:bg-zinc-700"
                                title={member.micEnabled ? 'Disable My Mic' : 'Enable My Mic'}
                              >
                                {member.micEnabled ? (
                                  <Mic className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <MicOff className="w-3 h-3 text-zinc-500" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={toggleLocalCamera}
                                className="p-0.5 rounded hover:bg-zinc-700"
                                title={member.cameraEnabled ? 'Disable My Camera' : 'Enable My Camera'}
                              >
                                {member.cameraEnabled ? (
                                  <Camera className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <CameraOff className="w-3 h-3 text-zinc-500" />
                                )}
                              </button>
                            </>
                          ) : (
                            <>
                              {member.micEnabled ? (
                                <button
                                  type="button"
                                  onClick={() => muteHallParticipant(member.userId)}
                                  className="px-1.5 py-0.5 rounded bg-rose-600/90 hover:bg-rose-500 text-white text-[9px] font-bold flex items-center gap-0.5"
                                  title={`Mute ${member.displayName} if disturbing`}
                                >
                                  <MicOff className="w-2.5 h-2.5" />
                                  <span>Mute</span>
                                </button>
                              ) : (
                                <MicOff className="w-3 h-3 text-zinc-500" />
                              )}
                              {member.cameraEnabled ? (
                                <Camera className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <CameraOff className="w-3 h-3 text-zinc-500" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CHAT MESSAGES SCROLL AREA */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {hallMessages.map((msg) => {
              const isOwn = msg.senderId === currentUser.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-0.5">
                    <span className="font-medium text-zinc-300">{msg.senderName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                      isOwn
                        ? 'bg-rose-600 text-white rounded-br-xs'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {/* Compact latest activity preview inside SPLIT mode */}
            {sidePanelMode === 'SPLIT' && hallActivities.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/60 space-y-1">
                <div className="text-[10px] font-semibold text-zinc-500 flex items-center justify-between">
                  <span># HALL ACTIVITY</span>
                  <button
                    onClick={() => setSidePanelMode('ACTIVITY')}
                    className="text-rose-400 hover:underline"
                  >
                    Full Log
                  </button>
                </div>
                {hallActivities.slice(0, 3).map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between text-[11px] text-zinc-400 py-0.5"
                  >
                    <span className="truncate">{act.message}</span>
                    <span className="font-mono-tabular text-[10px] text-zinc-500 shrink-0 ml-2">
                      {new Date(act.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Input & Quick Reaction Bar */}
          <div className="p-2.5 border-t border-zinc-800 bg-zinc-950/90 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-1">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendHallReaction(emoji)}
                  className="flex-1 min-h-[36px] rounded-xl bg-zinc-900 hover:bg-zinc-800 text-base flex items-center justify-center transition-transform active:scale-90"
                  title={`Send ${emoji} reaction`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message the Hall..."
                className="flex-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                className="min-h-[40px] min-w-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* # HALL ACTIVITY MODE (Section 23, 32, 54) */}
      {sidePanelMode === 'ACTIVITY' && (
        <div className="flex-1 flex flex-col min-h-0 p-3 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-semibold text-zinc-100"># HALL ACTIVITY</h3>
            </div>
            <span className="text-[11px] text-zinc-500">Realtime Events</span>
          </div>

          {hallActivities.map((act) => (
            <div
              key={act.id}
              className="flex items-start justify-between gap-2.5 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/70 text-xs"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-zinc-200 font-medium leading-snug">{act.message}</p>
                  <p className="text-[10px] font-mono-tabular text-zinc-500 mt-0.5">
                    {act.eventType}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono-tabular text-zinc-500 shrink-0">
                {new Date(act.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* PEOPLE / JOIN REQUESTS MODE (Section 14 & 15) */}
      {sidePanelMode === 'PEOPLE' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3">
            <div className="text-xs font-semibold text-zinc-200">Local Audio Mixer</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>MOVIE VOLUME</span>
                <span className="font-mono-tabular">{Math.round(movieVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={movieMuted ? 0 : movieVolume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMovieVolume(v);
                  setMovieMuted(v === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = v === 0;
                  }
                  ytPlayerRef.current?.setVolume(v);
                  ytPlayerRef.current?.setMuted(v === 0);
                }}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>VOICE VOLUME</span>
                <span className="font-mono-tabular">{Math.round(voiceVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={voiceVolume}
                onChange={(e) => setVoiceVolume(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-300">
                Approved in Hall ({hallMembers.length})
              </span>
              {hallMembers.some((m) => m.userId !== currentUser.id && m.micEnabled) && (
                <button
                  type="button"
                  onClick={muteAllOtherParticipants}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[10px] font-bold text-white flex items-center gap-1 shadow-xs transition-colors"
                  title="Mute all disturbing participants in the Hall"
                >
                  <MicOff className="w-3 h-3" />
                  <span>Mute All Disturbing</span>
                </button>
              )}
            </div>

            {hallMembers.map((m) => {
              const isMe = m.userId === currentUser.id;
              const isLocallyMuted = locallyMutedParticipantIds.includes(m.userId);
              const liveLevel = isMe
                ? localMicLevel
                : remoteSpeakerLevels[m.userId] ?? (m.isSpeaking ? 65 : 0);
              return (
                <div
                  key={m.id}
                  className={`flex flex-col gap-2 p-2.5 rounded-xl border text-xs transition-colors ${
                    m.micEnabled && (m.isSpeaking || liveLevel > 12)
                      ? 'bg-emerald-950/25 border-emerald-500/50'
                      : 'bg-zinc-900/70 border-zinc-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-semibold text-zinc-200 shrink-0">
                        {m.displayName.slice(0, 2).toUpperCase()}
                        {m.micEnabled && (
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-zinc-950 ${
                              m.isSpeaking || liveLevel > 12
                                ? 'bg-emerald-400 animate-ping'
                                : 'bg-emerald-500'
                            }`}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-100 truncate">
                          {m.displayName} {isMe ? '(You)' : ''}{' '}
                          <span className="text-[11px] font-normal text-zinc-400">
                            · {m.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
                          <span
                            className={
                              m.micEnabled ? 'text-emerald-400 font-medium' : 'text-zinc-500'
                            }
                          >
                            {m.micEnabled
                              ? m.isSpeaking || liveLevel > 12
                                ? 'Speaking Live 🎙️'
                                : 'Mic On (Live Feed)'
                              : m.mutedByName
                              ? `Muted by ${m.mutedByName}`
                              : 'Mic Muted'}
                          </span>
                          <span>·</span>
                          <span>{m.cameraEnabled ? 'Cam On' : 'Cam Off'}</span>
                          {!isMe && isLocallyMuted && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                              Muted Locally
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isMe ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={toggleLocalMic}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                            m.micEnabled
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
                          }`}
                          title={m.micEnabled ? 'Disable My Mic Voice-Over' : 'Enable My Mic Voice-Over'}
                        >
                          {m.micEnabled ? (
                            <>
                              <Mic className="w-3.5 h-3.5" />
                              <span>Mic On</span>
                            </>
                          ) : (
                            <>
                              <MicOff className="w-3.5 h-3.5" />
                              <span>Mic Off</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={toggleLocalCamera}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            m.cameraEnabled
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                          title={m.cameraEnabled ? 'Disable My Camera' : 'Enable My Camera'}
                        >
                          {m.cameraEnabled ? (
                            <Camera className="w-3.5 h-3.5" />
                          ) : (
                            <CameraOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleLocalMuteForParticipant(m.userId)}
                          className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors ${
                            isLocallyMuted
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                          }`}
                          title={
                            isLocallyMuted
                              ? `Unmute ${m.displayName} on your speaker`
                              : `Mute ${m.displayName} locally on your speaker`
                          }
                        >
                          {isLocallyMuted ? 'Unmute Local' : 'Mute Local'}
                        </button>

                        {m.micEnabled ? (
                          <button
                            type="button"
                            onClick={() => muteHallParticipant(m.userId)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                            title={`Mute ${m.displayName} in the Hall if disturbing`}
                          >
                            <MicOff className="w-3 h-3" />
                            <span>Mute Mic</span>
                          </button>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] flex items-center gap-1">
                            <MicOff className="w-3 h-3" />
                            <span>Muted</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Live Audio Feed Level Bar for any participant with Mic Enabled */}
                  {m.micEnabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-emerald-400 w-16 shrink-0">
                        Live Feed
                      </span>
                      <div className="flex-1 h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150"
                          style={{ width: `${Math.min(100, Math.max(10, liveLevel))}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono-tabular text-zinc-400 w-8 text-right">
                        {liveLevel}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={hallContainerRef}
      className="fixed inset-0 z-40 bg-[#09090b] flex flex-col select-none overflow-hidden"
    >
      {/* SECTION 40: Persistent Foreground Service Notification Bar when Host Shares Another App/Screen */}
      {activeHall.shareType !== 'NONE' && (
        <div className="bg-rose-950/90 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
            <span className="font-semibold text-zinc-100 truncate">
              Chill Mate · Movie Hall Live · Sharing with {activeHall.viewerCount} viewers
            </span>
            {activeHall.sourceType === 'DEVICE_LOCAL' && (
              <span className="text-emerald-300 font-medium hidden sm:inline">
                (Playing directly from device · No upload)
              </span>
            )}
          </div>
          {isCurrentUserHost && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSidePanelMinimized(false)}
                className="px-2.5 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-100"
              >
                RETURN
              </button>
              <button
                onClick={stopHostScreenShare}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold text-white"
              >
                STOP
              </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION 37: Host Disconnect Grace Period Banner */}
      {!activeHall.hostConnected && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-xs text-amber-200 shrink-0 z-30">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="font-semibold">
              Host connection lost · Reconnecting... (Grace period active · Hall preserved)
            </span>
          </div>
        </div>
      )}

      {/* MAIN ADAPTIVE HALL BODY */}
      <div
        className={`flex-1 flex ${
          useSideBySideLandscape ? 'flex-row' : 'flex-col'
        } min-h-0 overflow-hidden relative`}
      >
        {/* LEFT / TOP: MOVIE PRESENTATION SURFACE (Play video fits 100% of video preview area, controls & remote overlay on video) */}
        <div
          ref={videoAreaRef}
          onMouseMove={handleVideoAreaActivity}
          onMouseEnter={handleVideoAreaActivity}
          onPointerEnter={handleVideoAreaActivity}
          onPointerMove={handleVideoAreaActivity}
          onPointerDown={handleVideoAreaActivity}
          onTouchStart={handleVideoAreaActivity}
          onTouchMove={handleVideoAreaActivity}
          onClick={handleVideoAreaActivity}
          style={
            isTabletPortrait
              ? { height: `${tabletVideoHeightPct}%` }
              : undefined
          }
          className={`${
            useSideBySideLandscape
              ? 'flex-1 h-full min-w-0 min-h-0'
              : isTabletPortrait
              ? 'w-full shrink-0'
              : 'w-full aspect-video sm:flex-1 min-w-0 min-h-0'
          } relative bg-black flex items-center justify-center overflow-hidden ${
            !areControlsVisible ? 'cursor-none' : 'cursor-default'
          }`}
        >
          {/* Transparent Hover & Tap Capture Overlay: ensures instant reappearance on hover, mouse move, or tap anywhere across video */}
          {!areControlsVisible && (
            <div
              onMouseEnter={handleVideoAreaActivity}
              onMouseMove={handleVideoAreaActivity}
              onPointerEnter={handleVideoAreaActivity}
              onPointerMove={handleVideoAreaActivity}
              onPointerDown={handleVideoAreaActivity}
              onTouchStart={handleVideoAreaActivity}
              onTouchMove={handleVideoAreaActivity}
              onClick={handleVideoAreaActivity}
              className="absolute inset-0 z-20 cursor-pointer pointer-events-auto"
              title="Click or move mouse to show video controls and remote buttons"
            />
          )}

          {/* VIDEO ELEMENT: FITS EXACTLY ON VIDEO PREVIEW/PLAY BOX AREA */}
          <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden bg-black z-0">
            {youTubeVideoId ? (
              <YouTubeVideoPlayer
                ref={ytPlayerRef}
                videoId={youTubeVideoId}
                title={activeHall.title}
                isPlaying={activeHall.isPlaying}
                positionMs={activeHall.positionMs}
                isViewerSync={!isCurrentUserHost}
                playbackSpeed={activeHall.playbackSpeed || 1}
                muted={movieMuted}
                volume={movieVolume}
                controlsVisible={areControlsVisible}
                onToggleFullscreen={handleToggleFullscreen}
                onTimeUpdate={(posMs: number, durMs: number) => {
                  if (isCurrentUserHost) {
                    hostUpdatePositionSilent(posMs, durMs > 0 ? durMs : undefined);
                  }
                }}
                onDurationChange={(durMs: number) => {
                  if (isCurrentUserHost && durMs > 0) {
                    hostUpdatePositionSilent(activeHall.positionMs, durMs);
                  }
                }}
                onPlayStateChange={(playing) => {
                  if (!isCurrentUserHost) return;
                  if (playing && !activeHall.isPlaying) {
                    hostPlay();
                  } else if (!playing && activeHall.isPlaying) {
                    hostPause();
                  }
                }}
                className="w-full h-full max-w-full max-h-full"
              />
            ) : useEmbedFallback ? (
              <iframe
                src={activeHall.embedUrl || activeHall.videoUrl}
                title={activeHall.title}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                className="w-full h-full max-w-full max-h-full border-0 bg-black"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  poster={activeHall.backdropUrl || activeHall.posterUrl}
                  preload="auto"
                  autoPlay={activeHall.isPlaying}
                  className="w-full h-full max-w-full max-h-full object-contain bg-black"
                  playsInline
                  onLoadedMetadata={() => setViewerVideoReady(true)}
                  onLoadedData={() => setViewerVideoReady(true)}
                  onCanPlay={() => setViewerVideoReady(true)}
                  onPlaying={() => setViewerVideoReady(true)}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.currentTime > 0 && !viewerVideoReady) {
                      setViewerVideoReady(true);
                    }
                    if (!isCurrentUserHost) return;
                    if (v.duration > 0) {
                      hostUpdatePositionSilent(
                        Math.round(v.currentTime * 1000),
                        Math.round(v.duration * 1000)
                      );
                    }
                  }}
                  onError={() => {
                    setViewerVideoReady(false);
                    const v = videoRef.current;
                    if (v && !usedProxyStream && activeHall.videoUrl) {
                      setUsedProxyStream(true);
                      if (activeHall.videoUrl.startsWith('http')) {
                        v.src = `/api/video/stream?url=${encodeURIComponent(activeHall.videoUrl)}`;
                        v.load();
                        if (activeHall.isPlaying) {
                          v.play().catch(() => {});
                        }
                        return;
                      }
                      if (activeHall.videoUrl.startsWith('/api/video/stream')) {
                        const fallbackUrl = activeHall.videoUrl.includes('res=1080')
                          ? activeHall.videoUrl.replace('res=1080', 'res=480')
                          : `${activeHall.videoUrl}&retry=1`;
                        v.src = fallbackUrl;
                        v.load();
                        if (activeHall.isPlaying) {
                          v.play().catch(() => {});
                        }
                        return;
                      }
                    }
                    if (activeHall.embedUrl) {
                      setUseEmbedFallback(true);
                    }
                  }}
                />
                {!viewerVideoReady && !latestPresentationFrame && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/45 pointer-events-none gap-2.5">
                    <Loader2 className="w-10 h-10 text-rose-500 animate-spin drop-shadow-lg" />
                    <span className="text-xs font-semibold text-zinc-200 px-3 py-1 rounded-full bg-black/75 border border-white/10 backdrop-blur-md">
                      Loading Movie Hall Stream...
                    </span>
                  </div>
                )}
                {!isCurrentUserHost &&
                  latestPresentationFrame &&
                  (activeHall.shareType === 'SCREEN_SHARE' ||
                    activeHall.shareType === 'APP_SHARE' ||
                    activeHall.videoUrl?.startsWith('blob:') ||
                    !viewerVideoReady) && (
                    <img
                      src={latestPresentationFrame}
                      alt={activeHall.title}
                      className="absolute inset-0 w-full h-full max-w-full max-h-full object-contain pointer-events-none select-none z-10"
                    />
                  )}
              </>
            )}

            {/* Dedicated Fullscreen Toggle Button directly on video player container */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className={`absolute top-4 right-4 z-40 min-h-[42px] min-w-[42px] p-2.5 rounded-xl bg-black/75 hover:bg-black/95 text-white border border-white/20 shadow-2xl backdrop-blur-md transition-all active:scale-95 flex items-center justify-center ${
                areControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Expand Video to Full Screen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-rose-400" /> : <Maximize2 className="w-5 h-5 text-white" />}
            </button>

            {subtitleTrack !== 'OFF' && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-lg bg-black/80 text-zinc-100 text-xs sm:text-sm font-medium pointer-events-none z-20">
                {subtitleTrack === 'EN'
                  ? '[English CC] "Do not go gentle into that good night..."'
                  : '[العربية] "لا تدخل في ذلك الليل الطويل بهدوء..."'}
              </div>
            )}

            {/* LIVE VOICE-OVER & ACTIVE MICROPHONE FEED PILL ON VIDEO STAGE (Allows any Hall viewer to immediately mute a disturbing participant) */}
            {hallMembers.some((m) => m.micEnabled) && (
              <div className="absolute top-16 left-4 z-35 flex flex-col gap-1.5 max-w-[280px] sm:max-w-xs pointer-events-auto">
                {hallMembers
                  .filter((m) => m.micEnabled)
                  .map((speaker) => {
                    const isMe = speaker.userId === currentUser.id;
                    const isLocallyMuted = locallyMutedParticipantIds.includes(speaker.userId);
                    const lvl = isMe
                      ? localMicLevel
                      : remoteSpeakerLevels[speaker.userId] ?? (speaker.isSpeaking ? 65 : 22);
                    return (
                      <div
                        key={speaker.userId}
                        className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-2xl bg-zinc-950/90 border border-emerald-500/50 shadow-xl backdrop-blur-md text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                          </span>
                          <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-semibold text-zinc-100 truncate">
                            {speaker.displayName} {isMe ? '(You)' : ''}
                          </span>
                          <div className="w-10 h-1.5 bg-zinc-800 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full bg-emerald-400 transition-all duration-150"
                              style={{ width: `${Math.min(100, Math.max(15, lvl))}%` }}
                            />
                          </div>
                        </div>

                        {isMe ? (
                          <button
                            type="button"
                            onClick={toggleLocalMic}
                            className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold text-zinc-200 shrink-0"
                            title="Turn Off My Voice-Over Mic"
                          >
                            Stop Mic
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleLocalMuteForParticipant(speaker.userId)}
                              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-semibold border ${
                                isLocallyMuted
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-300'
                              }`}
                              title={
                                isLocallyMuted
                                  ? `Unmute ${speaker.displayName} for me`
                                  : `Mute ${speaker.displayName} locally for me`
                              }
                            >
                              {isLocallyMuted ? 'Unmute' : 'Local Mute'}
                            </button>
                            <button
                              type="button"
                              onClick={() => muteHallParticipant(speaker.userId)}
                              className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-[10px] font-bold text-white flex items-center gap-1 shadow-sm"
                              title={`Mute ${speaker.displayName} in the Hall if disturbing`}
                            >
                              <MicOff className="w-3 h-3" />
                              <span>Mute</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* SECTION 24: Floating Reactions Overlay directly on video */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
              {floatingReactions.map((r) => (
                <div
                  key={r.id}
                  style={{ left: `${r.xOffsetPercent}%` }}
                  className="absolute bottom-16 flex flex-col items-center animate-float-reaction"
                >
                  <span className="text-3xl sm:text-4xl drop-shadow-lg">{r.emoji}</span>
                  <span className="text-[10px] font-semibold text-zinc-200 bg-black/70 px-2 py-0.5 rounded-md mt-0.5">
                    {r.senderName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ALWAYS-VISIBLE FLOATING BREAK TIMER PILL HUD (Shown for all participants even when controls hide or break screen is minimized) */}
          {activeHall.breakState?.isActive && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-35 flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-zinc-950/90 border border-amber-500/50 shadow-2xl backdrop-blur-md">
              <Coffee className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-amber-200 max-w-[150px] sm:max-w-[220px] truncate">
                  {activeHall.breakState.message || 'Interval Break'}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 font-mono-tabular font-extrabold text-amber-300 text-sm">
                  {Math.floor(breakRemainingSec / 60)
                    .toString()
                    .padStart(2, '0')}
                  :
                  {(breakRemainingSec % 60).toString().padStart(2, '0')}
                </span>
                {activeHall.breakState.isPaused && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/40">
                    Timer Paused
                  </span>
                )}
              </div>

              {isCurrentUserHost && (
                <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-zinc-800">
                  <button
                    type="button"
                    onClick={() => hostAdjustIntervalBreak(-30)}
                    className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] font-mono text-zinc-200 border border-zinc-700"
                    title="Subtract 30s"
                  >
                    -30s
                  </button>
                  <button
                    type="button"
                    onClick={() => hostAdjustIntervalBreak(60)}
                    className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] font-mono text-zinc-200 border border-zinc-700"
                    title="Add 1m"
                  >
                    +1m
                  </button>
                  <button
                    type="button"
                    onClick={hostTogglePauseIntervalBreak}
                    className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] font-semibold text-amber-300 border border-zinc-700"
                    title={activeHall.breakState.isPaused ? 'Resume Timer' : 'Pause Timer'}
                  >
                    {activeHall.breakState.isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    onClick={() => hostEndIntervalBreak(true)}
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-[10px] font-bold text-white"
                    title="End Break & Resume Movie"
                  >
                    End
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsBreakCinemaOverlayMinimized((prev) => !prev)}
                className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-zinc-300 hover:text-white transition-colors"
                title={
                  isBreakCinemaOverlayMinimized
                    ? 'Expand full-screen Break Timer display'
                    : 'Minimize overlay to see paused video frame'
                }
              >
                {isBreakCinemaOverlayMinimized ? 'Full Timer' : 'Peek Video'}
              </button>
            </div>
          )}

          {/* INTERMISSION BREAK OVERLAY (Synchronized movie pause + countdown timer for all participants) */}
          {activeHall.breakState?.isActive && !isBreakCinemaOverlayMinimized && (
            <div className="absolute inset-0 z-28 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-semibold mb-3 shadow-lg shadow-amber-950/40 animate-pulse">
                <Coffee className="w-4 h-4 text-amber-400" />
                <span>
                  {activeHall.breakState.isPaused
                    ? 'INTERVAL BREAK · TIMER PAUSED BY HOST'
                    : 'INTERVAL BREAK ACTIVE · SYNCHRONIZED FOR ALL PARTICIPANTS'}
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl md:text-5xl font-display font-bold text-white max-w-xl mb-2 drop-shadow-lg">
                {activeHall.breakState.message || 'Popcorn & Rest Break 🍿'}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mb-5 flex flex-wrap items-center justify-center gap-1.5">
                <span>
                  Movie paused at{' '}
                  <strong className="font-mono-tabular text-zinc-200">
                    {formatDurationMs(activeHall.positionMs)}
                  </strong>{' '}
                  by <strong className="text-zinc-200">{activeHall.breakState.startedByName}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300">
                  {activeHall.breakState.isPaused
                    ? 'Countdown paused · Waiting for host'
                    : 'Resumes automatically when timer finishes'}
                </span>
              </p>

              <div className="relative flex flex-col items-center justify-center mb-5">
                <div className="text-6xl sm:text-8xl md:text-9xl font-mono-tabular font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-amber-200 tracking-wider drop-shadow-2xl">
                  {Math.floor(breakRemainingSec / 60)
                    .toString()
                    .padStart(2, '0')}
                  :
                  {(breakRemainingSec % 60).toString().padStart(2, '0')}
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs sm:text-sm text-amber-300/90 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Total Break:{' '}
                    {Math.floor((activeHall.breakState.totalDurationSec || 180) / 60)
                      .toString()
                      .padStart(2, '0')}
                    :
                    {((activeHall.breakState.totalDurationSec || 180) % 60)
                      .toString()
                      .padStart(2, '0')}{' '}
                    · Live synced across {activeHall.viewerCount} participant
                    {activeHall.viewerCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <div className="w-full max-w-md h-2.5 bg-zinc-800/80 rounded-full overflow-hidden mb-6 border border-white/10 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-400 transition-all duration-500 ease-linear"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        (breakRemainingSec / Math.max(1, activeHall.breakState.totalDurationSec)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>

              {isCurrentUserHost ? (
                <div className="flex flex-col items-center gap-3 z-30">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => hostAdjustIntervalBreak(-60)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1 transition-colors shadow-md"
                      title="Subtract 1 minute from break timer"
                    >
                      <Minus className="w-3.5 h-3.5 text-rose-400" />
                      <span>-1 MIN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => hostAdjustIntervalBreak(-30)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1 transition-colors shadow-md"
                      title="Subtract 30 seconds from break timer"
                    >
                      <Minus className="w-3.5 h-3.5 text-rose-400" />
                      <span>-30 SEC</span>
                    </button>
                    <button
                      type="button"
                      onClick={hostTogglePauseIntervalBreak}
                      className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md ${
                        activeHall.breakState.isPaused
                          ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
                          : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-200'
                      }`}
                      title={
                        activeHall.breakState.isPaused
                          ? 'Resume Break Countdown Timer'
                          : 'Pause Break Countdown Timer'
                      }
                    >
                      {activeHall.breakState.isPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>START / RESUME TIMER</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>PAUSE TIMER</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={hostResetIntervalBreak}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors shadow-md"
                      title="Reset timer to full break duration"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>RESET</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => hostAdjustIntervalBreak(30)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1 transition-colors shadow-md"
                      title="Add 30 seconds to break timer"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>+30 SEC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => hostAdjustIntervalBreak(60)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1 transition-colors shadow-md"
                      title="Add 1 minute to break timer"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>+1 MIN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => hostAdjustIntervalBreak(180)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1 transition-colors shadow-md"
                      title="Add 3 minutes to break timer"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>+3 MIN</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowIntervalBreakModal(true)}
                      className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors"
                    >
                      <Timer className="w-4 h-4" />
                      <span>CUSTOM TIMER SETTINGS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => hostEndIntervalBreak(true)}
                      className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-rose-950/50 hover:scale-105 active:scale-95"
                      title="End Break & Resume Movie Now (Auto-plays for all viewers)"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>END BREAK & RESUME MOVIE</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-xs text-zinc-300 font-mono bg-zinc-900/80 px-4 py-2.5 rounded-xl border border-zinc-800 flex items-center gap-2">
                    <Timer className="w-4 h-4 text-amber-400" />
                    <span>
                      Host ({activeHall.hostName}) controls the break timer · Movie resumes automatically at 00:00
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OVERLAY 1: TOP BAR OVERLAY ON VIDEO */}
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
            className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-b from-black/95 via-black/60 to-transparent ${
              areControlsVisible
                ? 'opacity-100 pointer-events-auto transition-opacity duration-150 ease-out'
                : 'opacity-0 pointer-events-none transition-opacity duration-300 ease-in'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={leaveHall}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/90 border border-white/15 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors shrink-0 backdrop-blur-md"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Home</span>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    {activeHall.status}
                  </span>
                  <span aria-hidden="true" className="text-zinc-600">·</span>
                  <span className="text-zinc-300 font-medium truncate">
                    Hosted by {activeHall.hostName}
                  </span>
                  <span aria-hidden="true" className="text-zinc-600">·</span>
                  <span className="text-zinc-400 font-mono-tabular">
                    {activeHall.viewerCount} watching
                  </span>
                  {activeHall.sourceType === 'DEVICE_LOCAL' ? (
                    <>
                      <span aria-hidden="true" className="text-zinc-600">·</span>
                      <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        Playing directly from device · No upload
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className="text-zinc-600">·</span>
                      <span className="text-emerald-400 font-medium inline-flex items-center gap-1">
                        <Film className="w-3 h-3" />
                        Direct Video Stream
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-sm sm:text-base font-bold text-zinc-100 truncate drop-shadow-md">
                  {activeHall.title}
                </h1>
              </div>
            </div>

            {/* Layout Switcher, Max Video, & Minimized Restore Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setForceLandscapeLayout((prev) => !prev)}
                className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-black/60 hover:bg-black/90 border border-white/15 text-xs text-zinc-300 flex items-center gap-1.5 backdrop-blur-md"
                title="Toggle Portrait / Landscape Hall Layout"
              >
                <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">
                  {useSideBySideLandscape ? 'Landscape UI' : 'Portrait UI'}
                </span>
              </button>

              {useSideBySideLandscape && (
                <button
                  onClick={() => {
                    if (sidePanelMinimized) {
                      setSidePanelMinimized(false);
                    } else if (sidebarWidth > 220) {
                      setSidebarWidth(210);
                    } else {
                      setSidePanelMinimized(true);
                    }
                  }}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-black/60 hover:bg-black/90 border border-white/15 text-xs text-zinc-200 flex items-center gap-1.5 transition-colors backdrop-blur-md"
                  title="Maximize video space"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden md:inline">
                    {sidePanelMinimized
                      ? 'Show Chat'
                      : sidebarWidth <= 220
                      ? 'Hide Sidebar (100% Video)'
                      : 'Max Video'}
                  </span>
                </button>
              )}

              {useSideBySideLandscape && sidePanelMinimized && (
                <button
                  onClick={() => setSidePanelMinimized(false)}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg shadow-rose-950/60"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>CHAT / PEOPLE</span>
                </button>
              )}
            </div>
          </div>

          {/* OVERLAY 2: BOTTOM VIDEO PLAYER CONTROL BUTTONS AND REMOTE BUTTONS OVERLAY ON VIDEO */}
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
            className={`absolute bottom-0 left-0 right-0 z-30 px-4 py-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent space-y-2.5 ${
              areControlsVisible
                ? 'opacity-100 pointer-events-auto transition-opacity duration-150 ease-out'
                : 'opacity-0 pointer-events-none transition-opacity duration-300 ease-in'
            }`}
          >
            {/* Progress / Seek Bar Overlay */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono-tabular text-zinc-200 w-16 drop-shadow">
                {formatDurationMs(activeHall.positionMs)}
              </span>

              {isCurrentUserHost ? (
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, activeHall.durationMs)}
                  value={activeHall.positionMs}
                  onChange={(e) => {
                    const nextMs = Number(e.target.value);
                    hostSeek(nextMs);
                    if (youTubeVideoId) {
                      ytPlayerRef.current?.seekToMs(nextMs);
                    } else if (videoRef.current && videoRef.current.duration > 0) {
                      videoRef.current.currentTime =
                        (nextMs / Math.max(1, activeHall.durationMs)) * videoRef.current.duration;
                    }
                  }}
                  className="flex-1 h-1.5 bg-zinc-700/80 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  title="Host Authoritative Seek Bar"
                />
              ) : (
                <div
                  className="flex-1 h-1.5 bg-zinc-800/80 rounded-full overflow-hidden backdrop-blur-xs"
                  title="Host controls playback position"
                >
                  <div
                    className="h-full bg-rose-500 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (activeHall.positionMs / Math.max(1, activeHall.durationMs)) * 100
                      )}%`,
                    }}
                  />
                </div>
              )}

              <span className="text-xs font-mono-tabular text-zinc-300 w-16 text-right drop-shadow">
                {formatDurationMs(activeHall.durationMs)}
              </span>
            </div>

            {/* Overlay Control & Remote Buttons Row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Left Group: Host Playback Controls OR Viewer Sync Status */}
              <div className="flex items-center gap-1.5">
                {isCurrentUserHost ? (
                  <>
                    <button
                      onClick={() => {
                        if (activeHall.isPlaying) {
                          hostPause();
                          ytPlayerRef.current?.pause();
                        } else {
                          hostPlay();
                          ytPlayerRef.current?.play();
                        }
                      }}
                      className="min-h-[42px] min-w-[42px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors shadow-md"
                      title={activeHall.isPlaying ? 'Pause Hall' : 'Play Hall'}
                    >
                      {activeHall.isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        const nextMs = Math.max(0, activeHall.positionMs - 10000);
                        hostSkip(-10000);
                        if (youTubeVideoId) {
                          ytPlayerRef.current?.seekToMs(nextMs);
                        } else if (videoRef.current) {
                          videoRef.current.currentTime = nextMs / 1000;
                        }
                      }}
                      className="min-h-[42px] px-2.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-xs font-mono-tabular text-zinc-200 flex items-center gap-1 backdrop-blur-md"
                      title="-10 sec"
                    >
                      <Rewind className="w-3.5 h-3.5" />
                      <span>-10s</span>
                    </button>

                    <button
                      onClick={() => {
                        const nextMs = Math.min(
                          activeHall.durationMs || 7200000,
                          activeHall.positionMs + 10000
                        );
                        hostSkip(10000);
                        if (youTubeVideoId) {
                          ytPlayerRef.current?.seekToMs(nextMs);
                        } else if (videoRef.current) {
                          videoRef.current.currentTime = nextMs / 1000;
                        }
                      }}
                      className="min-h-[42px] px-2.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-xs font-mono-tabular text-zinc-200 flex items-center gap-1 backdrop-blur-md"
                      title="+10 sec"
                    >
                      <span>+10s</span>
                      <FastForward className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        const speeds = [0.75, 1, 1.25, 1.5, 2];
                        const next =
                          speeds[(speeds.indexOf(activeHall.playbackSpeed) + 1) % speeds.length];
                        hostSetPlaybackSpeed(next);
                        ytPlayerRef.current?.setPlaybackRate(next);
                      }}
                      className="min-h-[42px] px-2.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-xs font-mono-tabular text-zinc-200 backdrop-blur-md"
                      title="Playback Speed"
                    >
                      {activeHall.playbackSpeed}x
                    </button>

                    {/* Subtitle & Audio Track Selectors */}
                    <button
                      onClick={() => {
                        const order: ('OFF' | 'EN' | 'AR')[] = ['OFF', 'EN', 'AR'];
                        setSubtitleTrack(order[(order.indexOf(subtitleTrack) + 1) % order.length]);
                      }}
                      className={`min-h-[42px] px-2.5 rounded-xl text-xs font-medium flex items-center gap-1 backdrop-blur-md ${
                        subtitleTrack !== 'OFF'
                          ? 'bg-rose-600/30 border border-rose-500 text-rose-200'
                          : 'bg-black/60 hover:bg-black/80 border border-white/10 text-zinc-300'
                      }`}
                      title="Subtitle Track"
                    >
                      <Captions className="w-3.5 h-3.5" />
                      <span>{subtitleTrack}</span>
                    </button>

                    <button
                      onClick={() =>
                        setAudioTrack((prev) =>
                          prev === 'SURROUND_5_1' ? 'STEREO' : 'SURROUND_5_1'
                        )
                      }
                      className="hidden sm:flex min-h-[42px] px-2.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-xs text-zinc-300 items-center gap-1 backdrop-blur-md"
                      title="Audio Track"
                    >
                      <span>{audioTrack === 'SURROUND_5_1' ? '5.1' : 'Stereo'}</span>
                    </button>

                    {/* Remote Button: Change Movie */}
                    <div className="relative">
                      <button
                        onClick={() => setShowChangeMovieMenu((prev) => !prev)}
                        className="min-h-[42px] px-3 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-xs font-medium text-zinc-200 flex items-center gap-1.5 backdrop-blur-md"
                      >
                        <Film className="w-3.5 h-3.5 text-rose-400" />
                        <span className="hidden lg:inline">Change Movie</span>
                      </button>
                      {showChangeMovieMenu && (
                        <div className="absolute bottom-12 left-0 w-60 rounded-xl bg-zinc-950 border border-zinc-800 p-2 shadow-2xl z-40 space-y-1">
                          <div className="text-[11px] font-semibold text-zinc-400 px-2 py-1">
                            Switch Hall Movie
                          </div>
                          {libraryItems.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                hostChangeMovie(item);
                                setShowChangeMovieMenu(false);
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-zinc-900 text-xs text-zinc-200 truncate"
                            >
                              {item.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Remote Button: Share Screen / App */}
                    <button
                      onClick={() => setShowSharePrivacyModal(true)}
                      className="min-h-[42px] px-3 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-xs font-medium text-zinc-200 flex items-center gap-1.5 backdrop-blur-md"
                      title="Share Android Application or Screen"
                    >
                      <AppWindow className="w-3.5 h-3.5 text-rose-400" />
                      <span className="hidden xl:inline">Share App</span>
                    </button>

                    {/* Remote Button: Interval Break & Timer Control (Visible on all screen sizes for Host) */}
                    <button
                      onClick={() => setShowIntervalBreakModal(true)}
                      className={`min-h-[42px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md transition-all ${
                        activeHall.breakState?.isActive
                          ? 'bg-amber-600/35 border-amber-500 text-amber-200 shadow-lg shadow-amber-950/50 animate-pulse'
                          : 'bg-black/60 hover:bg-black/80 border-white/10 text-zinc-200'
                      }`}
                      title="Host Break & Timer Control: Pause movie and set a countdown timer visible to all participants"
                    >
                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {activeHall.breakState?.isActive
                          ? `Break (${Math.floor(breakRemainingSec / 60)
                              .toString()
                              .padStart(2, '0')}:${(breakRemainingSec % 60)
                              .toString()
                              .padStart(2, '0')})`
                          : 'Break / Timer'}
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-300 backdrop-blur-md">
                    {activeHall.breakState?.isActive ? (
                      <>
                        <Coffee className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        <span className="text-amber-200 font-semibold">
                          Interval Break ({Math.floor(breakRemainingSec / 60)}:{(breakRemainingSec % 60).toString().padStart(2, '0')})
                        </span>
                      </>
                    ) : (
                      <>
                        <Radio className="w-3.5 h-3.5 text-rose-400" />
                        <span>
                          Synced to Host ({activeHall.hostName}) ·{' '}
                          {activeHall.isPlaying ? 'Playing' : 'Paused'}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Local Volume Control Overlay (Accessible to both Host and Members on all devices) */}
                <div className="flex items-center gap-1.5 ml-1 bg-black/60 border border-white/10 rounded-xl px-2 py-1 backdrop-blur-md">
                  <button
                    onClick={() => {
                      const next = !movieMuted;
                      setMovieMuted(next);
                      if (videoRef.current) videoRef.current.muted = next;
                      ytPlayerRef.current?.setMuted(next);
                    }}
                    className="min-h-[32px] min-w-[32px] rounded-lg hover:bg-white/10 text-zinc-200 flex items-center justify-center"
                    title="Mute / Unmute Volume"
                  >
                    {movieMuted || movieVolume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-zinc-100" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={movieMuted ? 0 : movieVolume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMovieVolume(v);
                      setMovieMuted(v === 0);
                      if (videoRef.current) {
                        videoRef.current.volume = v;
                        videoRef.current.muted = v === 0;
                      }
                      ytPlayerRef.current?.setVolume(v);
                      ytPlayerRef.current?.setMuted(v === 0);
                    }}
                    className="w-16 sm:w-24 h-1.5 bg-zinc-700/80 rounded-lg appearance-none cursor-pointer accent-rose-500"
                    title="Adjust Local Volume"
                  />
                  <span className="text-[10px] font-mono-tabular text-zinc-300 w-8 text-right">
                    {movieMuted ? '0%' : `${Math.round(movieVolume * 100)}%`}
                  </span>
                </div>
              </div>

              {/* Right Group: Mic Voice-Over, Camera, Reaction, Fullscreen, End / Leave Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleLocalMic}
                  className={`min-h-[42px] px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors backdrop-blur-md relative text-xs font-semibold ${
                    myHallMember?.micEnabled
                      ? 'bg-emerald-600/35 border border-emerald-500 text-emerald-100 shadow-lg shadow-emerald-950/50'
                      : 'bg-black/60 hover:bg-black/80 border border-white/10 text-zinc-300'
                  }`}
                  title={
                    myHallMember?.micEnabled
                      ? `Disable Microphone Voice-Over (Live Level: ${localMicLevel}%)`
                      : 'Enable Live Microphone Voice-Over Feed'
                  }
                >
                  {myHallMember?.micEnabled ? (
                    <>
                      <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span className="hidden sm:inline">Voice-Over ON</span>
                      <span className="font-mono-tabular text-[10px] text-emerald-300">
                        {localMicLevel}%
                      </span>
                      <span
                        className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-black ${
                          localMicLevel > 12 ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'
                        }`}
                      />
                    </>
                  ) : (
                    <>
                      <MicOff className="w-4 h-4 text-zinc-400" />
                      <span className="hidden sm:inline">Voice-Over</span>
                    </>
                  )}
                </button>

                {hallMembers.some((m) => m.userId !== currentUser.id && m.micEnabled) && (
                  <button
                    onClick={muteAllOtherParticipants}
                    className="min-h-[42px] px-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 border border-rose-400/40 text-xs font-bold text-white flex items-center gap-1 backdrop-blur-md shadow-md"
                    title="Mute all disturbing participants in the Hall"
                  >
                    <MicOff className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Mute Others</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    toggleLocalCamera();
                    if (!myHallMember?.cameraEnabled) {
                      setSidePanelMinimized(false);
                      setCamerasCollapsed(false);
                      if (sidePanelMode !== 'SPLIT' && sidePanelMode !== 'CHAT' && sidePanelMode !== 'CAMERAS') {
                        setSidePanelMode('SPLIT');
                      }
                    }
                  }}
                  className={`min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center transition-colors backdrop-blur-md relative ${
                    myHallMember?.cameraEnabled
                      ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-200'
                      : 'bg-black/60 hover:bg-black/80 border border-white/10 text-zinc-400'
                  }`}
                  title={myHallMember?.cameraEnabled ? 'Turn Camera Off' : 'Turn Device Camera On (Chat Box)'}
                >
                  {myHallMember?.cameraEnabled ? (
                    <>
                      <Camera className="w-4 h-4" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-black animate-pulse" />
                    </>
                  ) : (
                    <CameraOff className="w-4 h-4" />
                  )}
                </button>

                {/* Floating Reaction Trigger Button */}
                <button
                  onClick={() => sendHallReaction('❤️')}
                  className="min-h-[42px] min-w-[42px] rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-base flex items-center justify-center active:scale-90 transition-transform backdrop-blur-md"
                  title="Send Live Reaction"
                >
                  ❤️
                </button>

                <button
                  onClick={handleToggleFullscreen}
                  className="min-h-[42px] min-w-[42px] rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-zinc-200 flex items-center justify-center backdrop-blur-md"
                  title="Toggle Fullscreen Landscape"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>

                {isCurrentUserHost ? (
                  <button
                    onClick={() => setShowEndHallConfirm(true)}
                    className="min-h-[42px] px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>End Hall</span>
                  </button>
                ) : (
                  <button
                    onClick={leaveHall}
                    className="min-h-[42px] px-3 rounded-xl bg-black/60 hover:bg-black/80 border border-white/15 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 backdrop-blur-md"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Leave</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RESIZABLE DIVIDER HANDLE (Landscape / Fullscreen) */}
        {useSideBySideLandscape && !sidePanelMinimized && (
          <div
            onMouseDown={handleStartResize}
            onTouchStart={handleStartResize}
            onDoubleClick={() => setSidebarWidth(175)}
            className={`w-1.5 relative group cursor-col-resize select-none shrink-0 transition-colors flex items-center justify-center z-30 ${
              isResizingSidebar ? 'bg-rose-500' : 'bg-zinc-800/80 hover:bg-rose-500/70'
            }`}
            title="Drag to adjust sidebar width · Double-click to reset (175px)"
          >
            <div className="w-0.5 h-8 rounded-full bg-zinc-600 group-hover:bg-rose-200 transition-colors" />
          </div>
        )}

        {/* SECTION 18: FULLSCREEN / LANDSCAPE RIGHT-SIDE COLLABORATION PANEL */}
        {useSideBySideLandscape && !sidePanelMinimized && (
          <aside
            style={{ width: `${sidebarWidth}px` }}
            className={`h-full border-l border-zinc-800/90 flex flex-col shrink-0 overflow-hidden ${
              isResizingSidebar ? 'select-none pointer-events-none' : ''
            }`}
          >
            {renderCollaborationBody()}
          </aside>
        )}

        {/* SECTION 21: TABLET PORTRAIT RESIZABLE COLLABORATION PANEL BELOW VIDEO */}
        {isTabletPortrait && (
          <div className="flex-1 flex flex-col min-h-0 border-t border-zinc-800">
            <div className="h-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-center gap-2">
              <button
                onClick={() =>
                  setTabletVideoHeightPct((p) => (p === 52 ? 38 : p === 38 ? 65 : 52))
                }
                className="w-12 h-1 rounded-full bg-zinc-600 hover:bg-rose-500 transition-colors"
                title="Click to resize Tablet Portrait split"
              />
            </div>
            {renderCollaborationBody()}
          </div>
        )}

        {/* SECTION 20: MOBILE PORTRAIT COMPACT CONTROLS BAR & BOTTOM SHEET */}
        {!useSideBySideLandscape && !isTabletPortrait && (
          <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-200">
                LIVE · {activeHall.viewerCount} watching
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSidePanelMode('CHAT');
                    setMobileBottomSheetOpen(true);
                  }}
                  className="min-h-[40px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                  <span>Chat Sheet</span>
                </button>
                <button
                  onClick={() => {
                    setSidePanelMode('PEOPLE');
                    setMobileBottomSheetOpen(true);
                  }}
                  className="min-h-[40px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-rose-400" />
                  <span>People</span>
                </button>
              </div>
            </div>

            {renderCollaborationBody()}

            {mobileBottomSheetOpen && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end">
                <div className="h-[72vh] rounded-t-3xl bg-[#111115] border-t border-zinc-800 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                    <div className="w-10 h-1.5 bg-zinc-700 rounded-full mx-auto" />
                    <button
                      onClick={() => setMobileBottomSheetOpen(false)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-zinc-400 hover:text-zinc-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {renderCollaborationBody()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 39: HOST ENDS HALL CONFIRMATION MODAL */}
      {showEndHallConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">End Movie Hall?</h3>
                <p className="text-xs text-zinc-400">Everyone will be disconnected.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowEndHallConfirm(false)}
                className="min-h-[44px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200"
              >
                CANCEL
              </button>
              <button
                onClick={async () => {
                  setShowEndHallConfirm(false);
                  await endMovieHallAsHost();
                }}
                className="min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
              >
                END HALL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 41: INTERVAL BREAK SETUP MODAL */}
      {showIntervalBreakModal && (
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
                    Pause movie with a synchronized countdown timer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIntervalBreakModal(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If break already active, offer resume option */}
            {activeHall.breakState?.isActive && (
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
                    hostEndIntervalBreak(true);
                    setShowIntervalBreakModal(false);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shrink-0 shadow-md"
                >
                  Resume Now
                </button>
              </div>
            )}

            {/* Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300">Choose Break Duration:</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { label: '30 Sec', sec: 30, desc: 'Quick Check' },
                  { label: '1 Min', sec: 60, desc: 'Water' },
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

            {/* Custom Minutes & Seconds */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Custom Timer Duration (Minutes & Seconds):</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={Math.floor(selectedBreakSec / 60)}
                    onChange={(e) => {
                      const mins = Math.max(0, Math.min(120, Number(e.target.value) || 0));
                      const secs = selectedBreakSec % 60;
                      setSelectedBreakSec(Math.max(10, mins * 60 + secs));
                    }}
                    className="w-20 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs text-zinc-400">min</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    step={5}
                    value={selectedBreakSec % 60}
                    onChange={(e) => {
                      const secs = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                      const mins = Math.floor(selectedBreakSec / 60);
                      setSelectedBreakSec(Math.max(10, mins * 60 + secs));
                    }}
                    className="w-20 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs text-zinc-400">sec</span>
                </div>
                <span className="text-xs font-mono-tabular text-amber-300 font-semibold">
                  Total: {Math.floor(selectedBreakSec / 60).toString().padStart(2, '0')}:
                  {(selectedBreakSec % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Break Title / Message */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Break Message / Reason:</label>
              <input
                type="text"
                value={breakMessage}
                onChange={(e) => setBreakMessage(e.target.value)}
                placeholder="e.g. Popcorn & Refreshment Break 🍿"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Info notice */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-2.5 text-xs text-zinc-300">
              <Timer className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Movie will pause automatically. All viewers will see the synchronized countdown. When timer reaches 00:00, the movie will automatically resume playing!
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowIntervalBreakModal(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  hostStartIntervalBreak(selectedBreakSec, breakMessage);
                  setShowIntervalBreakModal(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-amber-950/40 transition-transform active:scale-95"
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>
                  START BREAK (
                  {Math.floor(selectedBreakSec / 60)
                    .toString()
                    .padStart(2, '0')}
                  :
                  {(selectedBreakSec % 60).toString().padStart(2, '0')})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <AppSharePrivacyModal
        isOpen={showSharePrivacyModal}
        onClose={() => setShowSharePrivacyModal(false)}
      />
    </div>
  );
};
