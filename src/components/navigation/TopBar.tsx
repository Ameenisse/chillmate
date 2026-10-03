import React from 'react';
import { ChevronDown, Crown, LogOut } from 'lucide-react';
import { useChillMate } from '../../context/ChillMateContext';
import { ActiveTab } from '../../types';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeTab, onSelectTab }) => {
  const {
    teams,
    activeTeam,
    selectTeam,
    currentUser,
    isSuperAdmin,
    registeredUsers,
    setIsSuperAdminModalOpen,
    signOutUser,
  } = useChillMate();

  const pendingCount = registeredUsers.filter(
    (u) => u.accountStatus === 'PENDING'
  ).length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 h-14 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800/80">
      {/* Zone 1: Single text element wordmark */}
      <button
        onClick={() => onSelectTab('HOME')}
        className="text-xl font-bold tracking-tight text-white hover:text-rose-400 transition-colors whitespace-nowrap"
      >
        Chill Mate
      </button>

      {/* Zone 2: 4 clean text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
        {(
          [
            { id: 'HOME', label: 'Home' },
            { id: 'LIBRARY', label: 'Library' },
            { id: 'TEAM', label: 'Team' },
            { id: 'PROFILE', label: 'Profile' },
          ] as { id: ActiveTab; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`transition-colors whitespace-nowrap ${
              activeTab === item.id
                ? 'text-white underline underline-offset-8 decoration-rose-500 decoration-2'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Zone 3: Team Selector, Super Admin (Golden button for Ameen), Profile & Sign Out */}
      <div className="flex items-center gap-2">
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setIsSuperAdminModalOpen(true)}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 shadow-md shadow-amber-950/40"
            title="Open Super Admin User Control Panel"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Super Admin</span>
            {pendingCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-zinc-950 text-amber-400 font-mono-tabular text-[10px]">
                {pendingCount}
              </span>
            )}
          </button>
        )}

        {teams.length > 0 && (
          <div className="relative hidden sm:block">
            <select
              value={activeTeam.id}
              onChange={(e) => selectTeam(e.target.value)}
              aria-label="Select Team"
              className="min-h-[38px] appearance-none pl-3 pr-7 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        <PWAInstallButton />

        <button
          onClick={() => onSelectTab('PROFILE')}
          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-100 transition-colors whitespace-nowrap shrink-0"
          title="Open Profile"
        >
          {currentUser.displayName}
        </button>

        <button
          type="button"
          onClick={() => void signOutUser()}
          className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-600 border border-zinc-800 hover:border-rose-500 text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};
