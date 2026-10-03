import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  Film,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react';
import {
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  useChillMate,
} from '../../context/ChillMateContext';

interface AuthScreenProps {
  isAdminRoute?: boolean;
  onExitAdminRoute?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isAdminRoute = false,
  onExitAdminRoute,
}) => {
  const {
    currentAccount,
    signInWithEmail,
    signUpWithEmail,
    continueWithGoogle,
    signOutUser,
  } = useChillMate();

  const [authTab, setAuthTab] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Google account fallback modal if popup is blocked by preview iframe
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [googleEmailInput, setGoogleEmailInput] = useState('');

  const clearFills = () => {
    setDisplayName('');
    setEmail('');
    setPassword('');
    setGoogleNameInput('');
    setGoogleEmailInput('');
  };

  // APPROVAL GATE SCREEN: Shown when user has signed up or signed in with PENDING / SUSPENDED / DECLINED status
  if (currentAccount && currentAccount.accountStatus !== 'APPROVED') {
    const isPending = currentAccount.accountStatus === 'PENDING';
    const isSuspended = currentAccount.accountStatus === 'SUSPENDED';

    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl bg-zinc-950 border border-zinc-800 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                  isPending
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                }`}
              >
                {isPending ? (
                  <Clock className="w-6 h-6 animate-pulse" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-400">
                  Chill Mate Security & Approval Gate
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-zinc-100">
                  {isPending
                    ? 'Awaiting Super Admin Approval'
                    : isSuspended
                    ? 'Account Suspended'
                    : 'Access Request Declined'}
                </h1>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Account Name</span>
              <span className="font-semibold text-zinc-100">
                {currentAccount.displayName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Registered Email</span>
              <span className="font-mono-tabular text-zinc-200">
                {currentAccount.email}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Registration Source</span>
              <span className="font-medium text-zinc-200">
                {currentAccount.authSource === 'GOOGLE'
                  ? 'Google Account'
                  : 'Email & Password'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Live Gate Status</span>
              <span
                className={`font-semibold ${
                  isPending ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {currentAccount.accountStatus}
              </span>
            </div>
          </div>

          {isPending ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs text-amber-200/90 leading-relaxed">
              <div className="font-semibold text-amber-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Real-Time Approval Gate Active</span>
              </div>
              <p>
                Your registration request has been submitted. Unapproved accounts
                cannot enter Chill Mate until{' '}
                <strong className="text-white">
                  Super Admin Ameen ({SUPER_ADMIN_EMAIL})
                </strong>{' '}
                approves your access.
              </p>
              <p className="text-amber-300/80">
                This screen listens in real time — as soon as Super Admin Ameen
                clicks <strong>&ldquo;Approve Access&rdquo;</strong> in the Super
                Admin Panel, your session will unlock automatically.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 leading-relaxed">
              {isSuspended
                ? `Your account has been suspended by Super Admin Ameen (${SUPER_ADMIN_EMAIL}). Please contact the administrator to reactivate your access.`
                : `Your registration request was declined by Super Admin Ameen (${SUPER_ADMIN_EMAIL}).`}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out / Switch Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (isAdminRoute || authTab === 'SIGN_IN') {
      const res = await signInWithEmail(email, password);
      setSubmitting(false);
      if (!res.ok) {
        setError(res.error || 'Unable to sign in.');
        return;
      }
      if (
        isAdminRoute &&
        res.account &&
        res.account.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase() &&
        res.account.systemRole !== 'SUPER_ADMIN'
      ) {
        setError('Access denied. Only Super Admin Ameen can sign in via /admin.');
        await signOutUser();
        return;
      }
      clearFills();
    } else {
      const res = await signUpWithEmail({
        displayName,
        email,
        password,
      });
      setSubmitting(false);
      if (!res.ok) {
        setError(res.error || 'Unable to register account.');
        return;
      }
      clearFills();
    }
  };

  const handleGoogleClick = async () => {
    setError(null);
    const res = await continueWithGoogle();
    if (!res.ok) {
      if (res.error === 'GOOGLE_ACCOUNT_PROMPT_NEEDED') {
        setShowGooglePrompt(true);
        return;
      }
      setError(res.error || 'Google sign-in could not be completed.');
    }
  };

  const handleGooglePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmailInput.trim()) return;
    setError(null);
    const res = await continueWithGoogle({
      email: googleEmailInput.trim(),
      displayName: googleNameInput.trim() || googleEmailInput.split('@')[0],
    });
    if (!res.ok) {
      setError(res.error || 'Google sign-in failed.');
      return;
    }
    setShowGooglePrompt(false);
    clearFills();
  };

  const handleQuickFillSuperAdmin = () => {
    setAuthTab('SIGN_IN');
    setEmail(SUPER_ADMIN_EMAIL);
    setPassword(SUPER_ADMIN_PASSWORD);
    setError(null);
  };

  const handleInstantSuperAdminSignIn = async () => {
    setError(null);
    setEmail(SUPER_ADMIN_EMAIL);
    setPassword(SUPER_ADMIN_PASSWORD);
    setSubmitting(true);
    await signInWithEmail(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    setSubmitting(false);
    clearFills();
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-zinc-950 border border-zinc-800 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${
                isAdminRoute
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
              }`}
            >
              {isAdminRoute ? (
                <Crown className="w-5 h-5" />
              ) : (
                <Film className="w-5 h-5" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                {isAdminRoute ? 'Chill Mate · Super Admin' : 'Chill Mate'}
              </h1>
              <p className="text-xs text-zinc-400">
                {isAdminRoute
                  ? 'Restricted /admin Control Portal'
                  : 'Private Team Movie Hall & Direct Cinema'}
              </p>
            </div>
          </div>

          {isAdminRoute && onExitAdminRoute && (
            <button
              type="button"
              onClick={onExitAdminRoute}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 transition-colors"
            >
              App Home
            </button>
          )}
        </div>

        {/* If NOT on /admin route, show Sign In / Sign Up Tabs + Continue with Google */}
        {!isAdminRoute && (
          <>
            <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('SIGN_IN');
                  setError(null);
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                  authTab === 'SIGN_IN'
                    ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('SIGN_UP');
                  setError(null);
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                  authTab === 'SIGN_UP'
                    ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Continue with Google Button */}
            <button
              type="button"
              onClick={() => void handleGoogleClick()}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.54-5.17 3.54-8.97z"
                />
                <path
                  fill="#34A853"
                  d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96h-4.01v3.14C3.515 21.3 7.615 24 12.255 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.535 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62h-4.01C.705 8.24.255 10.06.255 12s.45 3.76 1.27 5.38l4.01-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0 7.615 0 3.515 2.7 1.525 6.62l4.01 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {showGooglePrompt && (
              <form
                onSubmit={handleGooglePromptSubmit}
                className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3"
              >
                <div className="text-xs font-semibold text-zinc-200">
                  Enter Google Account Details
                </div>
                <input
                  type="text"
                  value={googleNameInput}
                  onChange={(e) => setGoogleNameInput(e.target.value)}
                  placeholder="Your Name (e.g. Omar Ali)"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                />
                <input
                  type="email"
                  required
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 min-h-[38px] rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                  >
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGooglePrompt(false)}
                    className="px-3 min-h-[38px] rounded-xl bg-zinc-800 text-xs text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
              <div className="h-px flex-1 bg-zinc-800" />
              <span>or continue with email</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>
          </>
        )}

        {/* Email / Password Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {!isAdminRoute && authTab === 'SIGN_UP' && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  isAdminRoute ? SUPER_ADMIN_EMAIL : 'you@example.com'
                }
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isAdminRoute && authTab === 'SIGN_UP' && (
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                New registrations are placed in <strong>PENDING</strong> status until Super Admin Ameen approves your request.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-lg ${
              isAdminRoute
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/50'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
            }`}
          >
            <span>
              {isAdminRoute
                ? 'Sign In as Super Admin'
                : authTab === 'SIGN_IN'
                ? 'Sign In to Chill Mate'
                : 'Create Account (Request Access)'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick-Fill Super Admin Credentials on /admin route */}
        {isAdminRoute && (
          <div className="pt-3 border-t border-zinc-800/90 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-amber-400/90">
              <span className="font-semibold flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                In-Built Super Admin Shortcut
              </span>
              <span className="font-mono-tabular text-zinc-400">
                {SUPER_ADMIN_EMAIL}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleQuickFillSuperAdmin}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-500/30 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Quick-Fill Credentials</span>
              </button>
              <button
                type="button"
                onClick={() => void handleInstantSuperAdminSignIn()}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-zinc-950 flex items-center justify-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Instant Admin Login</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
