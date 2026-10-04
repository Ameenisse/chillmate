/**
 * Fullscreen helper with auto-landscape orientation lock for mobile & desktop devices.
 */
export async function enterFullscreenLandscape(element: HTMLElement): Promise<boolean> {
  if (!element) return false;
  let nativeSucceeded = false;
  try {
    // 1. Request element fullscreen across all browsers
    if (element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: 'hide' } as any);
      nativeSucceeded = true;
    } else if ((element as any).webkitRequestFullscreen) {
      await (element as any).webkitRequestFullscreen();
      nativeSucceeded = true;
    } else if ((element as any).mozRequestFullScreen) {
      await (element as any).mozRequestFullScreen();
      nativeSucceeded = true;
    } else if ((element as any).msRequestFullscreen) {
      await (element as any).msRequestFullscreen();
      nativeSucceeded = true;
    } else {
      // iOS Safari fallback: check video element directly
      const video = element.querySelector('video');
      if (video && (video as any).webkitEnterFullscreen) {
        try {
          (video as any).webkitEnterFullscreen();
          nativeSucceeded = true;
        } catch {}
      }
    }
  } catch (err) {
    console.warn('Native fullscreen request was blocked or unsupported (falling back to simulated CSS viewport):', err);
  }

  // 2. Lock screen orientation to landscape on mobile / tablet devices
  try {
    const orientation = window.screen?.orientation;
    if (orientation && typeof (orientation as any).lock === 'function') {
      try {
        await (orientation as any).lock('landscape');
      } catch {
        try {
          await (orientation as any).lock('landscape-primary');
        } catch {}
      }
    } else if ((window.screen as any)?.lockOrientation) {
      try {
        (window.screen as any).lockOrientation('landscape');
      } catch {}
    }
  } catch (orientationErr) {
    // Orientation lock may fail if prohibited by iframe permissions or user device settings
    console.log('Screen orientation lock notice:', orientationErr);
  }

  return true;
}

export async function exitFullscreenLandscape(): Promise<void> {
  try {
    // 1. Exit native fullscreen
    if (document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    }

    // 2. Unlock orientation back to default
    const orientation = window.screen?.orientation;
    if (orientation && typeof orientation.unlock === 'function') {
      try {
        orientation.unlock();
      } catch {}
    } else if ((window.screen as any)?.unlockOrientation) {
      try {
        (window.screen as any).unlockOrientation();
      } catch {}
    }
  } catch (err) {
    console.warn('Exit fullscreen error:', err);
  }
}

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  return !!(
    document.fullscreenElement || 
    (document as any).webkitFullscreenElement || 
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

export function onFullscreenChange(callback: (isActive: boolean) => void): () => void {
  const handler = () => {
    callback(isFullscreenActive());
  };
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('mozfullscreenchange', handler);
    document.removeEventListener('MSFullscreenChange', handler);
  };
}
