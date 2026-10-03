import React, { useState } from 'react';
import {
  Check,
  Code2,
  Crown,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
  User,
} from 'lucide-react';
import { useChillMate } from '../context/ChillMateContext';
import { ViewportPreset } from '../types';

interface ProfileViewProps {
  onOpenAndroidSource: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onOpenAndroidSource }) => {
  const {
    currentUser,
    currentAccount,
    isSuperAdmin,
    registeredUsers,
    setIsSuperAdminModalOpen,
    signOutUser,
    updateUserProfile,
    viewportPreset,
    setViewportPreset,
    liveKitToken,
  } = useChillMate();

  const [displayNameInput, setDisplayNameInput] = useState(currentUser.displayName);
  const [savedProfile, setSavedProfile] = useState(false);

  const pendingCount = registeredUsers.filter(
    (u) => u.accountStatus === 'PENDING'
  ).length;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile(displayNameInput);
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 1800);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
      <div className="rounded-3xl bg-zinc-900/70 border border-zinc-800 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 border ${
              isSuperAdmin
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                : 'bg-rose-600/20 border-rose-500/40 text-rose-200'
            }`}
          >
            {currentUser.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 truncate">
                {currentUser.displayName}
              </h1>
              <span aria-hidden="true" className="text-zinc-600">
                ·
              </span>
              <span
                className={`text-xs font-semibold ${
                  isSuperAdmin ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {isSuperAdmin ? 'SUPER_ADMIN' : 'APPROVED MEMBER'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {currentAccount?.email || currentUser.email || 'ameen.isse@gmail.com'} ·{' '}
              <span>
                Source:{' '}
                {currentAccount?.authSource === 'GOOGLE'
                  ? 'Google OAuth'
                  : 'Email / Password'}
              </span>{' '}
              · <span className="text-emerald-400">Persistent Session Active</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setIsSuperAdminModalOpen(true)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-zinc-950 flex items-center gap-2 transition-colors shadow-lg shadow-amber-950/40"
            >
              <Crown className="w-4 h-4" />
              <span>Super Admin ({pendingCount} Pending)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-rose-600 border border-zinc-700 hover:border-rose-500 text-xs font-semibold text-zinc-200 hover:text-white flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Profile Setup Form */}
        <form
          onSubmit={handleSaveProfile}
          className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <User className="w-4 h-4 text-rose-400" />
            <span>Profile Setup</span>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Display Name</label>
            <input
              type="text"
              required
              maxLength={80}
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <button
            type="submit"
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-2 transition-colors"
          >
            {savedProfile ? <Check className="w-4 h-4" /> : null}
            <span>{savedProfile ? 'Profile Saved' : 'Save Profile'}</span>
          </button>
        </form>
      </div>

      {/* Responsive Android Device Form Factor Simulator */}
      <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Adaptive Android WindowSizeClass Layout Mode
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Preview Phone Portrait (Bottom Sheet), Tablet Portrait (Resizable Split), or Tablet/Fullscreen Landscape (72% Movie + 28% Side Panel).
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(
            [
              { id: 'AUTO', label: 'Auto Responsive', icon: Monitor },
              { id: 'PHONE_PORTRAIT', label: 'Phone Portrait', icon: Smartphone },
              { id: 'TABLET_PORTRAIT', label: 'Tablet Portrait', icon: Tablet },
              { id: 'TABLET_LANDSCAPE', label: 'Tablet Landscape', icon: Monitor },
            ] as { id: ViewportPreset; label: string; icon: React.ElementType }[]
          ).map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => setViewportPreset(mode.id)}
                className={`min-h-[48px] p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
                  viewportPreset === mode.id
                    ? 'bg-rose-600/15 border-rose-500/40 text-zinc-100'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Native Android Kotlin / Jetpack Compose Source Package Card */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Native Android Architecture + Firebase Security Rules Deployed</span>
          </div>
          <h3 className="text-base font-bold text-zinc-100">
            Kotlin · Jetpack Compose · Media3 · LiveKit · ForegroundService
          </h3>
          <p className="text-xs text-zinc-400">
            Inspect or download the complete Android Studio Kotlin source files, Gradle configuration, AndroidManifest, and LiveKit token verification.
            {liveKitToken ? ' (Active LiveKit JWT verified)' : ''}
          </p>
        </div>

        <button
          onClick={onOpenAndroidSource}
          className="min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 flex items-center gap-2 shrink-0 transition-colors"
        >
          <Code2 className="w-4 h-4" />
          <span>View Kotlin / Compose Source</span>
        </button>
      </div>
    </div>
  );
};
