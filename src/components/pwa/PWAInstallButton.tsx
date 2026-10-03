import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        title="Install Chill Mate App"
      >
        <Download className="w-3.5 h-3.5 text-rose-500" />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        title="Install on Android / iOS"
      >
        <Smartphone className="w-3.5 h-3.5 text-rose-500" />
        <span className="hidden sm:inline">{isIOS ? 'Install on iOS' : 'Get Android App'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-zinc-100">Install Chill Mate</h3>
              <button
                onClick={() => setShowGuide(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Install Chill Mate to your Android phone, tablet, or home screen for full-screen standalone Movie Halls and direct local device playback.
            </p>
            <div className="space-y-2.5 text-xs text-zinc-300 bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 mb-5">
              <p>1. Open your browser menu (<strong>⋮</strong> on Chrome Android or <strong>Share</strong> on Safari).</p>
              <p>2. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
              <p>3. Launch <strong>Chill Mate</strong> from your home screen in standalone mode.</p>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
