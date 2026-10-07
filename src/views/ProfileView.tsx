import React, { useEffect, useState } from 'react';
import {
  Check,
  Code2,
  Crown,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Unlock,
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
    updateUserAppLockPin,
    lockAppNow,
    selfLibraryItems,
    teams,
    teamLibraryItemsByTeam,
    viewportPreset,
    setViewportPreset,
    liveKitToken,
  } = useChillMate();

  const [displayNameInput, setDisplayNameInput] = useState(currentUser.displayName);
  const [savedProfile, setSavedProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const existingPin = (currentAccount?.appLockPin || currentUser.appLockPin || '').trim();
  const isPinCurrentlyEnabled = Boolean(
    (currentAccount?.appLockEnabled ?? currentUser.appLockEnabled) && existingPin
  );

  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinFeedback, setPinFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setDisplayNameInput(currentUser.displayName);
  }, [currentUser.displayName]);

  const pendingCount = registeredUsers.filter(
    (u) => u.accountStatus === 'PENDING'
  ).length;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    const res = await updateUserProfile(displayNameInput);
    if (!res.ok) {
      setProfileError(
        res.error || 'Username is already taken. Each user must have a unique username.'
      );
      return;
    }
    setSavedProfile(true);
    setTimeout(() => setSavedProfile(false), 1800);
  };

  const handleSaveAppLockPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinFeedback(null);

    const cleanNewPin = newPinInput.replace(/\D/g, '').trim();
    const cleanConfirmPin = confirmPinInput.replace(/\D/g, '').trim();

    if (cleanNewPin.length !== 4) {
      setPinFeedback({
        type: 'error',
        message: 'PIN Code must be 4 digits (0–9).',
      });
      return;
    }

    if (cleanNewPin !== cleanConfirmPin) {
      setPinFeedback({
        type: 'error',
        message: 'New PIN and Confirm PIN do not match.',
      });
      return;
    }

    const res = await updateUserAppLockPin({
      enabled: true,
      pin: cleanNewPin,
      currentPin: isPinCurrentlyEnabled ? currentPinInput : undefined,
    });

    if (!res.ok) {
      setPinFeedback({
        type: 'error',
        message: res.error || 'Could not update App Lock PIN.',
      });
      return;
    }

    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinFeedback({
      type: 'success',
      message: isPinCurrentlyEnabled
        ? 'Your Individual App Lock PIN has been updated!'
        : 'Individual App Lock PIN enabled! Your account is now PIN-protected.',
    });
  };

  const handleDisableAppLockPin = async () => {
    setPinFeedback(null);

    const res = await updateUserAppLockPin({
      enabled: false,
      pin: '',
    });

    if (!res.ok) {
      setPinFeedback({
        type: 'error',
        message: res.error || 'Could not disable App Lock PIN.',
      });
      return;
    }

    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinFeedback({
      type: 'success',
      message: 'Individual App Lock PIN disabled. The app will now open directly without a lock screen.',
    });
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
            <label className="block text-xs text-zinc-400 mb-1.5">
              Unique Username / Display Name
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={displayNameInput}
              onChange={(e) => {
                setProfileError(null);
                setDisplayNameInput(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          {profileError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 font-medium">
              {profileError}
            </div>
          )}

          <button
            type="submit"
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-2 transition-colors"
          >
            {savedProfile ? <Check className="w-4 h-4" /> : null}
            <span>{savedProfile ? 'Profile Saved' : 'Save Profile'}</span>
          </button>
        </form>

        {/* Individual User App Lock System (PIN) */}
        <form
          onSubmit={handleSaveAppLockPin}
          className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Lock className="w-4 h-4 text-rose-400" />
                <span>Individual App Lock System (PIN)</span>
                <span aria-hidden="true" className="text-zinc-600">·</span>
                <span
                  className={`text-xs font-semibold ${
                    isPinCurrentlyEnabled ? 'text-emerald-400' : 'text-zinc-400'
                  }`}
                >
                  {isPinCurrentlyEnabled
                    ? 'ENABLED (LOCK SCREEN ACTIVE)'
                    : 'DISABLED (OPENS APP DIRECTLY)'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                When Individual Lock Screen is not enabled, Chill Mate opens directly without any PIN prompt. Enable a personal PIN here if you want to require PIN unlock on app open.
              </p>
            </div>

            {isPinCurrentlyEnabled && (
              <button
                type="button"
                onClick={lockAppNow}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-semibold text-emerald-300 flex items-center gap-2 shrink-0 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock App Now</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {isPinCurrentlyEnabled && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Current PIN (Required to change/remove)
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={12}
                    value={currentPinInput}
                    onChange={(e) => {
                      setPinFeedback(null);
                      setCurrentPinInput(e.target.value);
                    }}
                    placeholder="Current PIN..."
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono-tabular text-zinc-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                {isPinCurrentlyEnabled ? 'New 4-Digit PIN Code' : 'Set 4-Digit PIN Code'}
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPinInput}
                  onChange={(e) => {
                    setPinFeedback(null);
                    setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  }}
                  placeholder="Enter 4-digit PIN..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono-tabular text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                Confirm 4-Digit PIN Code
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPinInput}
                  onChange={(e) => {
                    setPinFeedback(null);
                    setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  }}
                  placeholder="Re-enter 4-digit PIN..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono-tabular text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {pinFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium ${
                pinFeedback.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {pinFeedback.message}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-2 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {isPinCurrentlyEnabled ? 'Update App Lock PIN' : 'Enable App Lock PIN'}
              </span>
            </button>

            {isPinCurrentlyEnabled && (
              <button
                type="button"
                onClick={() => void handleDisableAppLockPin()}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-rose-600/20 border border-zinc-800 hover:border-rose-500/40 text-xs font-semibold text-zinc-300 hover:text-rose-300 flex items-center gap-2 transition-colors"
              >
                <Unlock className="w-4 h-4" />
                <span>Disable / Remove App Lock PIN</span>
              </button>
            )}
          </div>
        </form>

        {/* Multi-Library Access & Ownership Overview */}
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">
              Your Multi-Library Spaces (Self Library + Team Libraries)
            </h2>
            <span className="text-xs text-zinc-400 font-mono-tabular">
              {1 + teams.length} {1 + teams.length === 1 ? 'Library' : 'Libraries'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div>
                <div className="font-semibold text-zinc-100">My Self Library (Private)</div>
                <div className="text-[11px] text-zinc-400">
                  Only you can see &amp; manage your personal videos
                </div>
              </div>
              <span className="font-mono-tabular font-semibold text-emerald-400">
                {selfLibraryItems.length} videos
              </span>
            </div>
            {teams.map((t) => {
              const count = (teamLibraryItemsByTeam[t.id] || []).length;
              const isOwner = t.ownerId === currentUser.id;
              return (
                <div
                  key={t.id}
                  className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-zinc-100 truncate">
                      {t.name} Team Library
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {isOwner
                        ? 'You are Team Owner · Can manage & delete videos'
                        : 'Team Member · View & watch only (Owner manages deletes)'}
                    </div>
                  </div>
                  <span className="font-mono-tabular font-semibold text-rose-400 shrink-0">
                    {count} videos
                  </span>
                </div>
              );
            })}
          </div>
        </div>
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
