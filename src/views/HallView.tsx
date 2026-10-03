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
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FastForward,
  Film,
  Globe,
  HardDrive,
  Headphones,
  LogOut,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  Pause,
  Play,
  Power,
  Radio,
  Rewind,
  Send,
  Smartphone,
  Speaker,
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

const REACTION_EMOJIS: ReactionEmoji[] = ['❤️', '😂', '😮', '🔥', '👏', '🥹'];

type SidePanelMode = 'SPLIT' | 'CAMERAS' | 'CHAT' | 'ACTIVITY' | 'PEOPLE';

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
    leaveHall,
    endMovieHallAsHost,
    respondToJoinRequest,
    sendHallChatMessage,
    sendHallReaction,
    toggleLocalMic,
    toggleLocalCamera,
    activeScreenStream,
    stopHostScreenShare,
    viewportPreset,
  } = useChillMate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<YouTubeVideoPlayerHandle | null>(null);
  const hallContainerRef = useRef<HTMLDivElement | null>(null);
  const localCamVideoRef = useRef<HTMLVideoElement | null>(null);
  const [usedProxyStream, setUsedProxyStream] = useState<boolean>(false);

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

  // Inactivity auto-hide for all control buttons & remote buttons in video preview area (within 2 seconds)
  const [areControlsVisible, setAreControlsVisible] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleVideoAreaActivity = useCallback(() => {
    setAreControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false);
    }, 2000);
  }, []);

  useEffect(() => {
    handleVideoAreaActivity();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [handleVideoAreaActivity]);

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
  const [chatInput, setChatInput] = useState<string>('');
  const [localCamStream, setLocalCamStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (showChangeMovieMenu || showSharePrivacyModal || showEndHallConfirm) {
      setAreControlsVisible(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [showChangeMovieMenu, showSharePrivacyModal, showEndHallConfirm]);

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
    if (streamUrl.toLowerCase().includes('.m3u8') && Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
    } else if (video.src !== streamUrl) {
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
        video.play().catch(() => {});
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

  // Sync local camera preview when participant enables camera (Section 26)
  useEffect(() => {
    let active = true;
    if (myHallMember?.cameraEnabled) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: false })
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          setLocalCamStream(stream);
          if (localCamVideoRef.current) {
            localCamVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          // Camera hardware unavailable in sandbox; tile shows live indicator fallback
        });
    } else {
      if (localCamStream) {
        localCamStream.getTracks().forEach((t) => t.stop());
        setLocalCamStream(null);
      }
    }
    return () => {
      active = false;
    };
  }, [myHallMember?.cameraEnabled]);

  // Sidebar drag-resizing listeners (Mouse + Touch)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = startXRef.current - e.clientX; // Moving left widens sidebar, moving right widens video
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

  const handleToggleFullscreen = async () => {
    if (!hallContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await hallContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
        setForceLandscapeLayout(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
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
                  setSidebarWidth(175); // Reset to default 175px
                } else {
                  setSidebarWidth(380); // Expand sidebar for wider chat
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
                  <Check className="w-3 h-3" />
                  <span>ACCEPT</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TOP SECTION OF SPLIT OR FULL CAMERAS VIEW (Section 18 & 26) */}
      {(sidePanelMode === 'SPLIT' || sidePanelMode === 'CAMERAS') && (
        <div
          className={`${
            sidePanelMode === 'CAMERAS'
              ? 'flex-1 overflow-y-auto'
              : camerasCollapsed
              ? 'shrink-0 border-b border-zinc-800/90'
              : 'shrink-0 border-b border-zinc-800/90'
          } p-2 sm:p-2.5 flex flex-col gap-2`}
        >
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-zinc-300 truncate">
                Cameras ({hallMembers.length})
              </span>
              {sidePanelMode === 'SPLIT' && (
                <button
                  type="button"
                  onClick={() => setCamerasCollapsed((prev) => !prev)}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 transition-colors shrink-0"
                  title={camerasCollapsed ? 'Show cameras box view' : 'Collapse cameras to maximize chat height'}
                >
                  {camerasCollapsed ? 'Show' : 'Hide / Max Chat'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Voice route switcher */}
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
                className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center gap-1 border border-zinc-800"
                title="Switch Voice Audio Output (Speaker / Bluetooth)"
              >
                {audioOutputRoute === 'BLUETOOTH' ? (
                  <Bluetooth className="w-3 h-3 text-sky-400" />
                ) : audioOutputRoute === 'HEADPHONES' ? (
                  <Headphones className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Speaker className="w-3 h-3 text-rose-400" />
                )}
                <span className="hidden lg:inline text-[10px]">{audioOutputRoute}</span>
              </button>
            </div>
          </div>

          {/* BOX VIEW: Camera participant tiles in 1-column responsive box grid (aspect-[4/3]) */}
          {!camerasCollapsed && (
            <div
              className={`grid grid-cols-1 gap-2.5 ${
                sidePanelMode === 'CAMERAS'
                  ? 'flex-1 min-h-0 overflow-y-auto'
                  : 'max-h-[260px] overflow-y-auto'
              } pr-0.5 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent`}
            >
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
                        ref={localCamVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : member.cameraEnabled ? (
                      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-sm font-bold text-rose-200 shadow-inner">
                          {member.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-semibold text-zinc-200">
                        {member.displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[10px] bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-white/5">
                      <span className="text-zinc-100 font-medium truncate max-w-[105px]">
                        {member.displayName} {member.role === 'HOST' ? '(Host)' : ''}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {member.micEnabled ? (
                          <Mic className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <MicOff className="w-3 h-3 text-zinc-500" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sidePanelMode === 'CAMERAS' && (
            <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5 mt-auto">
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
          )}
        </div>
      )}

      {/* CHAT SECTION (Shown in SPLIT and CHAT modes — Section 18 & 25) */}
      {(sidePanelMode === 'SPLIT' || sidePanelMode === 'CHAT') && (
        <div className="flex-1 flex flex-col min-h-0">
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
          {/* Volume Mixer (Section 27: Separate local controls for MOVIE VOLUME & VOICE VOLUME) */}
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
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">
                Approved in Hall ({hallMembers.length})
              </span>
            </div>

            {hallMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-semibold text-zinc-200">
                    {m.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-100">
                      {m.displayName}{' '}
                      <span className="text-[11px] font-normal text-zinc-400">
                        · {m.role}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {m.micEnabled ? 'Mic On' : 'Muted'} · {m.cameraEnabled ? 'Cam On' : 'Cam Off'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
        <div className="bg-rose-950/90 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0">
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
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-xs text-amber-200 shrink-0">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="font-semibold">
              Host connection lost · Reconnecting... (Grace period active — Hall preserved)
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
        {/* LEFT / TOP: MOVIE PRESENTATION SURFACE */}
        <div
          onMouseMove={handleVideoAreaActivity}
          onMouseEnter={handleVideoAreaActivity}
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
          } relative bg-black flex flex-col justify-between overflow-hidden ${
            !areControlsVisible ? 'cursor-none' : 'cursor-default'
          }`}
        >
          {/* Top Overlay inside Video Area */}
          <div
            className={`relative z-20 flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-b from-black/90 via-black/45 to-transparent transition-opacity duration-300 ease-in-out ${
              areControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={leaveHall}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-900/85 hover:bg-zinc-800 border border-zinc-700/70 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors shrink-0"
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
                <h1 className="text-sm sm:text-base font-bold text-zinc-100 truncate">
                  {activeHall.title}
                </h1>
              </div>
            </div>

            {/* Layout Switcher, Max Video, & Minimized Restore Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setForceLandscapeLayout((prev) => !prev)}
                className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-zinc-900/85 hover:bg-zinc-800 border border-zinc-700/70 text-xs text-zinc-300 flex items-center gap-1.5"
                title="Toggle Portrait / Landscape Hall Layout"
              >
                <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">
                  {useSideBySideLandscape ? 'Landscape UI' : 'Portrait UI'}
                </span>
              </button>

              {/* Quick More Space For Video toggle */}
              {useSideBySideLandscape && (
                <button
                  onClick={() => {
                    if (sidePanelMinimized) {
                      setSidePanelMinimized(false);
                    } else if (sidebarWidth > 220) {
                      setSidebarWidth(210); // Ultra-slim, maximum video space
                    } else {
                      setSidePanelMinimized(true); // 100% video
                    }
                  }}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-zinc-900/85 hover:bg-zinc-800 border border-zinc-700/70 text-xs text-zinc-200 flex items-center gap-1.5 transition-colors"
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

              {/* SECTION 19: Floating button when fullscreen side panel is minimized */}
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

          {/* Center Native Direct Video or YouTube Video Element */}
          <div className="relative flex-1 min-h-0 min-w-0 w-full h-full flex items-center justify-center overflow-hidden">
            {/* Transparent wake-up overlay for touch/mouse interaction when controls are auto-hidden */}
            {!areControlsVisible && (
              <div
                onClick={handleVideoAreaActivity}
                onTouchStart={handleVideoAreaActivity}
                onMouseMove={handleVideoAreaActivity}
                className="absolute inset-0 z-10 cursor-pointer"
                title="Click or tap to show video controls"
              />
            )}
            {youTubeVideoId ? (
              <YouTubeVideoPlayer
                ref={ytPlayerRef}
                videoId={youTubeVideoId}
                title={activeHall.title}
                isPlaying={activeHall.isPlaying}
                positionMs={activeHall.positionMs}
                playbackSpeed={activeHall.playbackSpeed || 1}
                muted={movieMuted}
                volume={movieVolume}
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
                className="w-full h-full"
              />
            ) : (
              <video
                ref={videoRef}
                className="w-full h-full max-w-full max-h-full object-contain"
                playsInline
                onTimeUpdate={(e) => {
                  if (!isCurrentUserHost) return;
                  const v = e.currentTarget;
                  if (v.duration > 0) {
                    // Keep authoritative position advancing smoothly
                    hostUpdatePositionSilent(activeHall.positionMs);
                  }
                }}
                onError={() => {
                  const v = videoRef.current;
                  if (
                    v &&
                    !usedProxyStream &&
                    activeHall.videoUrl &&
                    activeHall.videoUrl.startsWith('http')
                  ) {
                    setUsedProxyStream(true);
                    v.src = `/api/video/stream?url=${encodeURIComponent(activeHall.videoUrl)}`;
                    v.load();
                    if (activeHall.isPlaying) {
                      v.play().catch(() => {});
                    }
                  }
                }}
              />
            )}

            {subtitleTrack !== 'OFF' && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-lg bg-black/80 text-zinc-100 text-xs sm:text-sm font-medium pointer-events-none">
                {subtitleTrack === 'EN'
                  ? '[English CC] "Do not go gentle into that good night..."'
                  : '[العربية] "لا تدخل في ذلك الليل الطويل بهدوء..."'}
              </div>
            )}

            {/* SECTION 24: Floating Reactions Overlay (floats upward, scales, fades out in ~2s) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
              {floatingReactions.map((r) => (
                <div
                  key={r.id}
                  style={{ left: `${r.xOffsetPercent}%` }}
                  className="absolute bottom-12 flex flex-col items-center animate-float-reaction"
                >
                  <span className="text-3xl sm:text-4xl drop-shadow-lg">{r.emoji}</span>
                  <span className="text-[10px] font-semibold text-zinc-200 bg-black/70 px-2 py-0.5 rounded-md mt-0.5">
                    {r.senderName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM PLAYER BAR: STRICT HOST vs VIEWER SEPARATION (Sections 4, 16, 17) */}
          <div
            className={`relative z-20 px-4 py-3 bg-gradient-to-t from-black/95 via-black/75 to-transparent space-y-2.5 transition-opacity duration-300 ease-in-out ${
              areControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Progress / Seek Bar */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono-tabular text-zinc-200 w-16">
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
                  className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  title="Host Authoritative Seek Bar"
                />
              ) : (
                <div
                  className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden"
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

              <span className="text-xs font-mono-tabular text-zinc-400 w-16 text-right">
                {formatDurationMs(activeHall.durationMs)}
              </span>
            </div>

            {/* Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Left Group: Host Playback Controls OR Viewer Notice */}
              <div className="flex items-center gap-1.5">
                {isCurrentUserHost ? (
                  <>
                    {/* SECTION 16: HOST PLAYER CONTROLS */}
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
                      className="min-h-[42px] min-w-[42px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors"
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
                        ytPlayerRef.current?.seekToMs(nextMs);
                      }}
                      className="min-h-[42px] px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono-tabular text-zinc-200 flex items-center gap-1"
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
                        ytPlayerRef.current?.seekToMs(nextMs);
                      }}
                      className="min-h-[42px] px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono-tabular text-zinc-200 flex items-center gap-1"
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
                      className="min-h-[42px] px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono-tabular text-zinc-200"
                      title="Playback Speed"
                    >
                      {activeHall.playbackSpeed}x
                    </button>

                    {/* Subtitle & Audio Track Selectors (Section 16) */}
                    <button
                      onClick={() => {
                        const order: ('OFF' | 'EN' | 'AR')[] = ['OFF', 'EN', 'AR'];
                        setSubtitleTrack(order[(order.indexOf(subtitleTrack) + 1) % order.length]);
                      }}
                      className={`min-h-[42px] px-2.5 rounded-xl text-xs font-medium flex items-center gap-1 ${
                        subtitleTrack !== 'OFF'
                          ? 'bg-rose-600/20 border border-rose-500/40 text-rose-300'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
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
                      className="hidden sm:flex min-h-[42px] px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 items-center gap-1"
                      title="Audio Track"
                    >
                      <span>{audioTrack === 'SURROUND_5_1' ? '5.1' : 'Stereo'}</span>
                    </button>

                    {/* Change Movie */}
                    <div className="relative">
                      <button
                        onClick={() => setShowChangeMovieMenu((prev) => !prev)}
                        className="min-h-[42px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5"
                      >
                        <Film className="w-3.5 h-3.5 text-rose-400" />
                        <span className="hidden lg:inline">Change Movie</span>
                      </button>
                      {showChangeMovieMenu && (
                        <div className="absolute bottom-12 left-0 w-60 rounded-xl bg-zinc-950 border border-zinc-800 p-2 shadow-2xl z-30 space-y-1">
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

                    {/* Share Screen / App */}
                    <button
                      onClick={() => setShowSharePrivacyModal(true)}
                      className="min-h-[42px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5"
                      title="Share Android Application or Screen"
                    >
                      <AppWindow className="w-3.5 h-3.5 text-rose-400" />
                      <span className="hidden xl:inline">Share App</span>
                    </button>
                  </>
                ) : (
                  /* SECTION 17: VIEWER PLAYER — No Play/Pause/Seek/Forward/Rewind! */
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
                    <Radio className="w-3.5 h-3.5 text-rose-400" />
                    <span>
                      Synced to Host ({activeHall.hostName}) ·{' '}
                      {activeHall.isPlaying ? 'Playing' : 'Paused'}
                    </span>
                  </div>
                )}

                {/* Local Volume Control (Available to both Host & Viewer) */}
                <div className="flex items-center gap-1.5 ml-1">
                  <button
                    onClick={() => {
                      const next = !movieMuted;
                      setMovieMuted(next);
                      if (videoRef.current) videoRef.current.muted = next;
                      ytPlayerRef.current?.setMuted(next);
                    }}
                    className="min-h-[42px] min-w-[42px] rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center"
                    title="Local Movie Volume"
                  >
                    {movieMuted || movieVolume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
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
                    className="w-16 sm:w-20 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500 hidden sm:block"
                  />
                </div>
              </div>

              {/* Right Group: Mic, Camera, Reactions, Fullscreen, Leave / End Hall */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleLocalMic}
                  className={`min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center transition-colors ${
                    myHallMember?.micEnabled
                      ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400'
                  }`}
                  title={myHallMember?.micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {myHallMember?.micEnabled ? (
                    <Mic className="w-4 h-4" />
                  ) : (
                    <MicOff className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={toggleLocalCamera}
                  className={`min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center transition-colors ${
                    myHallMember?.cameraEnabled
                      ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400'
                  }`}
                  title={myHallMember?.cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {myHallMember?.cameraEnabled ? (
                    <Camera className="w-4 h-4" />
                  ) : (
                    <CameraOff className="w-4 h-4" />
                  )}
                </button>

                {/* Quick Heart Reaction */}
                <button
                  onClick={() => sendHallReaction('❤️')}
                  className="min-h-[42px] min-w-[42px] rounded-xl bg-zinc-900 hover:bg-zinc-800 text-base flex items-center justify-center active:scale-90 transition-transform"
                  title="Send Reaction"
                >
                  ❤️
                </button>

                <button
                  onClick={handleToggleFullscreen}
                  className="min-h-[42px] min-w-[42px] rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center"
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
                    className="min-h-[42px] px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>End Hall</span>
                  </button>
                ) : (
                  <button
                    onClick={leaveHall}
                    className="min-h-[42px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5"
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
            {/* Compact Mobile Portrait Hall Controls Bar */}
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

            {/* Slide-up Bottom Sheet when triggered on phone portrait */}
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

      <AppSharePrivacyModal
        isOpen={showSharePrivacyModal}
        onClose={() => setShowSharePrivacyModal(false)}
      />
    </div>
  );
};
