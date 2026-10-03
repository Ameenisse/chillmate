import React, { useEffect, useState } from 'react';
import { ChillMateProvider, useChillMate } from './context/ChillMateContext';
import { ActiveTab } from './types';
import { TopBar } from './components/navigation/TopBar';
import { BottomNav } from './components/navigation/BottomNav';
import { HomeView } from './views/HomeView';
import { LibraryView } from './views/LibraryView';
import { TeamView } from './views/TeamView';
import { ProfileView } from './views/ProfileView';
import { HallView } from './views/HallView';
import { PersonalPlayerModal } from './components/player/PersonalPlayerModal';
import { DeviceVideoModal } from './components/library/DeviceVideoModal';
import { DirectUrlModal } from './components/library/DirectUrlModal';
import { UploadLibraryModal } from './components/library/UploadLibraryModal';
import { VideoDetailModal } from './components/library/VideoDetailModal';
import { AppSharePrivacyModal } from './components/hall/AppSharePrivacyModal';
import { AndroidSourceModal } from './components/android/AndroidSourceModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { AuthScreen } from './components/auth/AuthScreen';
import { SuperAdminControlModal } from './components/admin/SuperAdminControlModal';

const checkIsAdminUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname.toLowerCase();
  const h = window.location.hash.toLowerCase();
  return p === '/admin' || p.startsWith('/admin/') || h === '#/admin' || h.startsWith('#/admin/');
};

const ChillMateContent: React.FC = () => {
  const {
    isAuthenticated,
    isSuperAdmin,
    isSuperAdminModalOpen,
    setIsSuperAdminModalOpen,
    isInsideHall,
    activeHall,
    viewportPreset,
  } = useChillMate();

  const [activeTab, setActiveTab] = useState<ActiveTab>('HOME');
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(checkIsAdminUrl);

  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [directUrlModalOpen, setDirectUrlModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [shareAppModalOpen, setShareAppModalOpen] = useState(false);
  const [androidSourceOpen, setAndroidSourceOpen] = useState(false);

  useEffect(() => {
    const syncRoute = () => setIsAdminRoute(checkIsAdminUrl());
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const navigatePath = (targetPath: string) => {
    try {
      window.history.pushState({}, '', targetPath);
    } catch {
      // ignore in restricted iframe contexts
    }
    setIsAdminRoute(targetPath.toLowerCase().startsWith('/admin'));
  };

  // Dedicated Hidden Browser URL Route: /admin
  if (isAdminRoute) {
    if (!isAuthenticated || !isSuperAdmin) {
      return (
        <AuthScreen
          isAdminRoute={true}
          onExitAdminRoute={() => navigatePath('/')}
        />
      );
    }
    return (
      <SuperAdminControlModal
        isOpen={true}
        isStandalonePage={true}
        onClose={() => navigatePath('/')}
      />
    );
  }

  // First-Time App Open / Signed-Out / Pending Approval Gate Screen
  if (!isAuthenticated) {
    return <AuthScreen isAdminRoute={false} />;
  }

  const containerWidthClass =
    viewportPreset === 'PHONE_PORTRAIT'
      ? 'max-w-[420px] mx-auto border-x border-zinc-800/80 min-h-screen shadow-2xl'
      : viewportPreset === 'TABLET_PORTRAIT'
      ? 'max-w-[768px] mx-auto border-x border-zinc-800/80 min-h-screen shadow-2xl'
      : 'w-full min-h-screen';

  return (
    <div className={`bg-[#09090b] text-zinc-100 ${containerWidthClass}`}>
      <TopBar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="min-h-[calc(100vh-7.5rem)]">
        {activeTab === 'HOME' && (
          <HomeView
            onNavigateTab={setActiveTab}
            onOpenDeviceModal={() => setDeviceModalOpen(true)}
            onOpenDirectUrlModal={() => setDirectUrlModalOpen(true)}
            onOpenShareAppModal={() => setShareAppModalOpen(true)}
          />
        )}

        {activeTab === 'LIBRARY' && (
          <LibraryView
            onOpenDeviceModal={() => setDeviceModalOpen(true)}
            onOpenDirectUrlModal={() => setDirectUrlModalOpen(true)}
            onOpenUploadModal={() => setUploadModalOpen(true)}
          />
        )}

        {activeTab === 'TEAM' && <TeamView onNavigateTab={setActiveTab} />}

        {activeTab === 'PROFILE' && (
          <ProfileView onOpenAndroidSource={() => setAndroidSourceOpen(true)} />
        )}
      </main>

      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Active Movie Hall Overlay (Host & Viewer Hall Modes) */}
      {isInsideHall && activeHall && <HallView />}

      {/* Watch Alone Personal Player */}
      <PersonalPlayerModal />

      {/* Video Details Modal */}
      <VideoDetailModal />

      {/* Device Local Video Modal (No upload required) */}
      <DeviceVideoModal
        isOpen={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
      />

      {/* Direct URL Modal */}
      <DirectUrlModal
        isOpen={directUrlModalOpen}
        onClose={() => setDirectUrlModalOpen(false)}
      />

      {/* Optional Upload to Team Library Modal */}
      <UploadLibraryModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
      />

      {/* Screen / App Share Privacy Modal */}
      <AppSharePrivacyModal
        isOpen={shareAppModalOpen}
        onClose={() => setShareAppModalOpen(false)}
      />

      {/* Native Android Kotlin / Jetpack Compose Source Package Modal */}
      <AndroidSourceModal
        isOpen={androidSourceOpen}
        onClose={() => setAndroidSourceOpen(false)}
      />

      {/* Super Admin Control Panel (Accessible exclusively to ameen.isse@gmail.com) */}
      <SuperAdminControlModal
        isOpen={isSuperAdminModalOpen}
        onClose={() => setIsSuperAdminModalOpen(false)}
      />

      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <ChillMateProvider>
      <ChillMateContent />
    </ChillMateProvider>
  );
}
