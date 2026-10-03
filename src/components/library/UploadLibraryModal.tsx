import React, { useRef, useState } from 'react';
import { CheckCircle2, CloudUpload, Film, Loader2, X } from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';
import { LibraryCategory } from '../../types';
import { formatFileSize } from '../../utils/media';

interface UploadLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadLibraryModal: React.FC<UploadLibraryModalProps> = ({ isOpen, onClose }) => {
  const { uploadVideoToTeamLibrary } = useChillMate();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LibraryCategory>('MOVIES');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  if (!isOpen) return null;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setProgress(5);
    await uploadVideoToTeamLibrary(
      selectedFile,
      title || selectedFile.name,
      description,
      category,
      (pct) => setProgress(pct)
    );
    setUploading(false);
    setCompleted(true);
    setTimeout(() => {
      setCompleted(false);
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setProgress(0);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">ADD TO TEAM LIBRARY</h2>
              <p className="text-xs text-zinc-400">
                Explicit upload to Firebase Storage for Team Library
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
              <span>Uploaded to Team Library!</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="w-full min-h-[46px] rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors"
          >
            {uploading ? `Uploading (${progress}%)` : 'UPLOAD TO TEAM LIBRARY'}
          </button>
        </form>
      </div>
    </div>
  );
};
