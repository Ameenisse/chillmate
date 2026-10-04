import React, { useCallback, useEffect, useState } from 'react';
import { Delete, KeyRound, LogOut, X } from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';

export const AppLockScreen: React.FC = () => {
  const {
    currentUser,
    currentAccount,
    unlockAppWithPin,
    updateUserAppLockPin,
    signOutUser,
  } = useChillMate();

  const expectedPin = (currentAccount?.appLockPin || currentUser.appLockPin || '').trim();
  const pinTargetLength = Math.max(4, expectedPin.length || 4);

  const [pinInput, setPinInput] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot PIN recovery modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const attemptUnlock = useCallback(
    (candidatePin: string) => {
      const res = unlockAppWithPin(candidatePin);
      if (!res.ok) {
        setErrorShake(true);
        setErrorMessage('Incorrect PIN Code');
        window.setTimeout(() => {
          setPinInput('');
          setErrorShake(false);
        }, 420);
      } else {
        setErrorMessage(null);
      }
    },
    [unlockAppWithPin]
  );

  const handleDigitClick = useCallback(
    (digit: string) => {
      setErrorMessage(null);
      setPinInput((prev) => {
        if (prev.length >= pinTargetLength) return prev;
        const next = prev + digit;
        if (next.length === pinTargetLength) {
          window.setTimeout(() => {
            attemptUnlock(next);
          }, 120);
        }
        return next;
      });
    },
    [pinTargetLength, attemptUnlock]
  );

  const handleBackspace = useCallback(() => {
    setErrorMessage(null);
    setPinInput((prev) => prev.slice(0, -1));
  }, []);

  // Support physical keyboard digits and Backspace
  useEffect(() => {
    if (showForgotModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitClick(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter' && pinInput.trim().length >= 4) {
        e.preventDefault();
        attemptUnlock(pinInput);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForgotModal, handleDigitClick, handleBackspace, pinInput, attemptUnlock]);

  const handleResetPinWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);

    const accountPassword = currentAccount?.password || '';
    if (accountPassword && recoveryPassword !== accountPassword) {
      setRecoveryError('Incorrect account password. Please try again or Sign Out.');
      return;
    }

    await updateUserAppLockPin({
      enabled: false,
      pin: '',
    });
    setShowForgotModal(false);
    setRecoveryPassword('');
  };

  return (
    <div className="min-h-screen w-full bg-[#e31b23] text-white flex flex-col items-center justify-between py-10 px-6 select-none relative overflow-hidden">
      {/* Top Section: Custom Rounded Square Play Logo & Title */}
      <div className="flex flex-col items-center pt-4 sm:pt-8 space-y-7">
        {/* Custom Play Icon inside Rounded White Square Outline matching reference */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[22px] border-[4.5px] border-white flex items-center justify-center shadow-sm">
          <svg
            viewBox="0 0 64 64"
            className="w-16 h-16 sm:w-20 sm:h-20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Large White Play Triangle */}
            <path
              d="M23 13.5C23 11.4 25.35 10.15 27.1 11.3L49.2 25.8C50.75 26.82 50.75 29.1 49.2 30.12L27.1 44.62C25.35 45.77 23 44.52 23 42.42V13.5Z"
              fill="white"
            />
            {/* Bottom Left White Dot (Progress Scrubber Head) */}
            <circle cx="19.5" cy="48.5" r="4.2" fill="white" />
            {/* Bottom Horizontal White Bar (Timeline Track) */}
            <rect x="26" y="46.2" width="22.5" height="4.6" rx="2.3" fill="white" />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-[28px] font-medium tracking-normal text-white text-center">
          Enter your PIN Code
        </h1>
      </div>

      {/* Middle Section: 4 Circular PIN Indicator Dots */}
      <div className="flex flex-col items-center my-6 space-y-3">
        <div
          className={`flex items-center justify-center gap-6 sm:gap-7 transition-transform ${
            errorShake ? 'translate-x-2' : ''
          }`}
        >
          {Array.from({ length: pinTargetLength }).map((_, idx) => {
            const isFilled = idx < pinInput.length;
            return (
              <span
                key={idx}
                className={`w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full transition-all duration-150 ${
                  isFilled
                    ? 'bg-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                    : 'bg-white/55'
                }`}
              />
            );
          })}
        </div>

        {errorMessage && (
          <div className="text-xs font-semibold text-white/95 tracking-wide pt-1">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Bottom Section: 3x4 Circular Keypad */}
      <div className="w-full max-w-[330px] sm:max-w-[360px] pb-4">
        <div className="grid grid-cols-3 gap-y-5 sm:gap-y-6 gap-x-6 sm:gap-x-8 place-items-center">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitClick(digit)}
              className="w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-full border-[2.5px] border-white flex items-center justify-center text-3xl sm:text-[34px] font-bold text-white hover:bg-white/15 active:bg-white/25 active:scale-95 transition-all focus:outline-none"
            >
              {digit}
            </button>
          ))}

          {/* Bottom-Left: FORGOT? */}
          <button
            type="button"
            onClick={() => {
              setRecoveryError(null);
              setShowForgotModal(true);
            }}
            className="min-h-[48px] px-2 text-sm sm:text-base font-bold tracking-wider text-white/85 hover:text-white uppercase transition-colors focus:outline-none"
          >
            FORGOT?
          </button>

          {/* Bottom-Center: 0 */}
          <button
            type="button"
            onClick={() => handleDigitClick('0')}
            className="w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-full border-[2.5px] border-white flex items-center justify-center text-3xl sm:text-[34px] font-bold text-white hover:bg-white/15 active:bg-white/25 active:scale-95 transition-all focus:outline-none"
          >
            0
          </button>

          {/* Bottom-Right: Subtle Backspace when typing */}
          <div className="w-20 h-20 sm:w-[88px] sm:h-[88px] flex items-center justify-center">
            {pinInput.length > 0 && (
              <button
                type="button"
                onClick={handleBackspace}
                className="w-14 h-14 rounded-full hover:bg-white/15 active:bg-white/25 flex items-center justify-center text-white/90 hover:text-white transition-all focus:outline-none"
                title="Delete"
              >
                <Delete className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FORGOT? Recovery / Switch User Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 p-6 text-zinc-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <KeyRound className="w-4 h-4 text-rose-500" />
                <span>Forgot App Lock PIN?</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Signed in as <strong className="text-zinc-200">{currentUser.displayName}</strong> (
              {currentAccount?.email || currentUser.email}). Enter your account password to reset your App Lock PIN, or sign out.
            </p>

            <form onSubmit={handleResetPinWithPassword} className="space-y-3">
              <input
                type="password"
                value={recoveryPassword}
                onChange={(e) => {
                  setRecoveryError(null);
                  setRecoveryPassword(e.target.value);
                }}
                placeholder="Enter account password..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-rose-500"
              />

              {recoveryError && (
                <div className="text-[11px] text-rose-400 font-medium">{recoveryError}</div>
              )}

              <button
                type="submit"
                className="w-full min-h-[42px] rounded-xl bg-[#e31b23] hover:bg-rose-600 text-xs font-bold text-white transition-colors"
              >
                Reset &amp; Disable App Lock PIN
              </button>
            </form>

            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">Switch account?</span>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
