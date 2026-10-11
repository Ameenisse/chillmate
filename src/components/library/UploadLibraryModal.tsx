import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Film,
  Folder,
  FolderPlus,
  Loader2,
  Lock,
  Users,
  X,
} from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';
import { LibraryCategory } from '../../types';
import { formatFileSize } from '../../utils/media';

interface UploadLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadLibraryModal: React.FC<UploadLibraryModalProps> = ({ isOpen, onClose }) => {
  const {
    uploadVideoToTeamLibrary,
    activeLibraryScope,
    teams,
    getFoldersForScope,
    createLibraryFolder,
  } = useChillMate();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LibraryCategory>('MOVIES');
  const [targetScope, setTargetScope] = useState<'SELF' | string>(activeLibraryScope);
  const [selectedFolder, setSelectedFolder] = useState<string>('Action & Sci-Fi');
  const [customNewFolder, setCustomNewFolder] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  const foldersForTargetScope = getFoldersForScope(targetScope);

  useEffect(() => {
    if (isOpen) {
      setTargetScope(activeLibraryScope);
    }
  }, [isOpen, activeLibraryScope]);

  if (!isOpen) return null;

  const isTargetSelf = targetScope === 'SELF' || !teams.some((t) => t.id === targetScope);
  const selectedTeamName =
    teams.find((t) => t.id === targetScope)?.name || 'Team';

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    const finalFolder = customNewFolder.trim() || selectedFolder || undefined;
    if (customNewFolder.trim()) {
      createLibraryFolder(customNewFolder.trim(), targetScope);
    }
    setUploading(true);
    setProgress(5);
    await uploadVideoToTeamLibrary(
      selectedFile,
      title || selectedFile.name,
      description,
      category,
      (pct) => setProgress(pct),
      targetScope,
      finalFolder
    );
    setUploading(false);
    setCompleted(true);
    setTimeout(() => {
      setCompleted(false);
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setCustomNewFolder('');
      setProgress(0);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                {isTargetSelf ? 'UPLOAD TO SELF LIBRARY' : `UPLOAD TO ${selectedTeamName.toUpperCase()} LIBRARY`}
              </h2>
              <p className="text-xs text-zinc-400">
                {isTargetSelf
                  ? 'Private upload — only you can see and manage this video'
                  : `Shared with ${selectedTeamName} members — only Team Owner can delete`}
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

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Destination Library Selector */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Destination Library
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope('SELF')}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors ${
                  isTargetSelf
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>My Self Library (Only Me)</span>
                </span>
                <span className="text-[10px] text-emerald-400">Private</span>
              </button>

              {teams.map((t) => {
                const active = targetScope === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTargetScope(t.id)}
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors ${
                      active
                        ? 'bg-rose-600/20 border-rose-500 text-rose-100'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Users className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="truncate">{t.name} Team Library</span>
                    </span>
                    <span className="text-[10px] text-rose-400 shrink-0">Team Shared</span>
                  </button>
                );
              })}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setSelectedFile(f);
                if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
              }
            }}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-dashed border-zinc-700 text-center space-y-1.5 transition-colors"
          >
            <Film className="w-6 h-6 text-rose-400 mx-auto" />
            <div className="text-xs font-semibold text-zinc-200">
              {selectedFile ? selectedFile.name : 'Choose Video File to Upload'}
            </div>
            <div className="text-[11px] text-zinc-500">
              {selectedFile
                ? formatFileSize(selectedFile.size)
                : 'Note: To watch without uploading, use "Play From Device" instead'}
            </div>
          </button>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Movie or Video Title"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {(['MOVIES', 'VIDEOS'] as LibraryCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`min-h-[40px] rounded-xl text-xs font-semibold transition-colors ${
                    category === cat
                      ? 'bg-rose-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Movie Folder Selector */}
          <div className="space-y-2">
            <label className="block text-xs text-zinc-400">
              Movie Folder (Movies Manage by Folders)
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedFolder('');
                  setCustomNewFolder('');
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                  selectedFolder === '' && !customNewFolder.trim()
                    ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                No Folder
              </button>
              {foldersForTargetScope.map((folder) => {
                const active = selectedFolder === folder && !customNewFolder.trim();
                return (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => {
                      setSelectedFolder(folder);
                      setCustomNewFolder('');
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Folder className="w-3 h-3 text-amber-400" />
                    <span>{folder}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <FolderPlus className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customNewFolder}
                onChange={(e) => setCustomNewFolder(e.target.value)}
                placeholder="Or type a new Movie Folder name..."
                maxLength={60}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional synopsis or notes for your team..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  Uploading to Firebase Storage...
                </span>
                <span className="font-mono-tabular">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {completed && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isTargetSelf
                  ? 'Uploaded to your Personal Self Library!'
                  : `Uploaded to ${selectedTeamName} Library!`}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="w-full min-h-[46px] rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors"
          >
            {uploading
              ? `Uploading (${progress}%)`
              : isTargetSelf
              ? 'UPLOAD TO MY SELF LIBRARY'
              : `UPLOAD TO ${selectedTeamName.toUpperCase()} LIBRARY`}
          </button>
        </form>
      </div>
    </div>
  );
};
