import React, { useState } from 'react';
import { AlertTriangle, AppWindow, BellOff, Monitor, ShieldAlert, X } from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';
import { ASSETS } from '../../utils/media';

interface AppSharePrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartedSimulatedAppShare?: () => void;
}

export const AppSharePrivacyModal: React.FC<AppSharePrivacyModalProps> = ({
  isOpen,
  onClose,
  onStartedSimulatedAppShare,
}) => {
  const {
    activeHall,
    startMovieHall,
    startHostScreenOrAppShare,
    screenShareError,
    clearScreenShareError,
  } = useChillMate();

  const [shareMode, setShareMode] = useState<'APP_SHARE' | 'SCREEN_SHARE'>('APP_SHARE');
  const [dndChecked, setDndChecked] = useState(true);

  if (!isOpen) return null;

  const handleContinue = async () => {
    clearScreenShareError();
    if (!activeHall) {
      await startMovieHall({
        title: shareMode === 'APP_SHARE' ? 'Application Presentation' : 'Full Screen Share',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        posterUrl: ASSETS.posterAlpine,
        backdropUrl: ASSETS.backdropCinema,
        sourceType: shareMode,
        shareType: shareMode,
        durationMs: 3600000,
      });
    }
    const started = await startHostScreenOrAppShare(shareMode);
    if (started) {
      onClose();
    }
  };

  const handleStartSingleAppStream = async () => {
    clearScreenShareError();
    if (!activeHall) {
      await startMovieHall({
        title: 'Android App Presentation (MediaProjection)',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        posterUrl: ASSETS.posterAlpine,
        backdropUrl: ASSETS.backdropCinema,
        sourceType: 'APP_SHARE',
        shareType: 'APP_SHARE',
        durationMs: 3600000,
      });
    }
    onStartedSimulatedAppShare?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">SHARE SCREEN / APP</h2>
              <p className="text-xs text-zinc-400">Android MediaProjection Privacy Notice</p>
            </div>
          </div>
          <button
            onClick={() => {
              clearScreenShareError();
              onClose();
            }}
            className="min-h-[40px] min-w-[40px] rounded-lg text-zinc-400 hover:text-zinc-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 28: Prefer Single Application sharing */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setShareMode('APP_SHARE')}
            className={`p-3.5 rounded-xl border text-left transition-colors ${
              shareMode === 'APP_SHARE'
                ? 'bg-rose-600/15 border-rose-500/40 text-zinc-100'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <AppWindow className="w-4 h-4 text-rose-400 mb-1.5" />
            <div className="text-xs font-semibold">Single Application</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Recommended · Only selected app</div>
          </button>

          <button
            type="button"
            onClick={() => setShareMode('SCREEN_SHARE')}
            className={`p-3.5 rounded-xl border text-left transition-colors ${
              shareMode === 'SCREEN_SHARE'
                ? 'bg-rose-600/15 border-rose-500/40 text-zinc-100'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Monitor className="w-4 h-4 text-rose-400 mb-1.5" />
            <div className="text-xs font-semibold">Full Screen</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Shares entire display</div>
          </button>
        </div>

        {/* Section 29: Mandatory Privacy Notice & Do Not Disturb recommendation */}
        <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3">
          <p className="text-xs font-medium text-zinc-200 leading-relaxed">
            "Everything visible on your screen may be shared with Movie Hall viewers."
          </p>
          <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={dndChecked}
              onChange={(e) => setDndChecked(e.target.checked)}
              className="rounded accent-rose-500"
            />
            <BellOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Enable Do Not Disturb (Recommended to hide personal notifications)</span>
          </label>
        </div>

        {/* Section 30: Protected Video / Blocked Capture Message */}
        {screenShareError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2.5">
            <div className="flex items-start gap-2 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{screenShareError}</span>
            </div>
            <button
              type="button"
              onClick={handleStartSingleAppStream}
              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
            >
              Share Supported App Window Instead
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              clearScreenShareError();
              onClose();
            }}
            className="min-h-[46px] rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="min-h-[46px] rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors"
          >
            CONTINUE
          </button>
        </div>
      </div>
    </div>
  );
};
