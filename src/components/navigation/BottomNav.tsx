import React from 'react';
import { Film, Home, User, Users } from 'lucide-react';
import { ActiveTab } from '../../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'HOME', label: 'HOME', icon: Home },
    { id: 'LIBRARY', label: 'LIBRARY', icon: Film },
    { id: 'TEAM', label: 'TEAM', icon: Users },
    { id: 'PROFILE', label: 'PROFILE', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#09090b]/95 backdrop-blur-md border-t border-zinc-800/90 grid grid-cols-4 items-center">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
              isActive ? 'text-rose-500' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-tight mt-1">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
