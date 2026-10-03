import React, { useRef, useState } from 'react';
import { Film, HardDrive, Play, Radio, ShieldCheck, Upload, X } from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';
import { ASSETS, formatFileSize } from '../../utils/media';

interface DeviceVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceVideoModal: React.FC<DeviceVideoModalProps> = ({ isOpen, onClose }) => {
  const {
    localDeviceVideoFile,
    localDeviceVideoUrl,
    selectDeviceVideoFile,
    startWatchAlone,
    startMovieHall,
  } = useChillMate();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [customTitle, setCustomTitle] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      selectDeviceVideoFile(file);
      setCustomTitle(file.name);
    }
  };

  const activeFileName = localDeviceVideoFile?.name || '';
  const activePlayableUrl = localDeviceVideoUrl || '';

  const handlePlayAlone = () => {
    if (!activePlayableUrl) return;
    startWatchAlone({
      title: customTitle.trim() || activeFileName || 'Local Video',
      videoUrl: activePlayableUrl,
      posterUrl: ASSETS.posterInterstellar,
      sourceType: 'DEVICE_LOCAL',
      localFileName: activeFileName || 'video.mp4',
      localFileSize: localDeviceVideoFile?.size || 0,
      durationMs: 7340000,
    });
    onClose();
  };

  const handleStartHallFromDevice = async () => {
    if (!activePlayableUrl) return;
    await startMovieHall({
      title: customTitle.trim() || activeFileName || 'Local Video',
      videoUrl: activePlayableUrl,
      posterUrl: ASSETS.posterInterstellar,
      backdropUrl: ASSETS.backdropCinema,
      sourceType: 'DEVICE_LOCAL',
      shareType: 'DEVICE_STREAM',
      durationMs: 7340000,
      initialPositionMs: 0,
      localFileName: activeFileName || 'video.mp4',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Play From Device</h2>
              <p className="text-xs text-zinc-400">
                Playing directly from device · No upload required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-lg text-zinc-400 hover:text-zinc-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.mkv,.webm,.mov"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-100 flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4 text-rose-400" />
              <span>Open Android / System File Picker</span>
            </button>
          </div>

          {activePlayableUrl ? (
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-100 truncate">{activeFileName}</span>
                <span className="font-mono-tabular text-zinc-400">
                  {formatFileSize(localDeviceVideoFile?.size || 1480000000)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Playing directly from device · No upload to Firebase Storage</span>
              </div>
              <div className="pt-1">
                <label className="block text-[11px] text-zinc-400 mb-1">Hall / Session Title</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="movie.mp4"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 leading-relaxed">
              Select any video file from your device storage. Chill Mate plays it locally with Media3 or streams your presentation directly to the Movie Hall via WebRTC/LiveKit without uploading the file.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            disabled={!activePlayableUrl}
            onClick={handlePlayAlone}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-700 text-xs font-semibold text-zinc-100 flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>PLAY ALONE</span>
          </button>
          <button
            disabled={!activePlayableUrl}
            onClick={handleStartHallFromDevice}
            className="min-h-[48px] px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-lg shadow-rose-950/50"
          >
            <Radio className="w-4 h-4" />
            <span>START MOVIE HALL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
