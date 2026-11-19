import toast from 'react-hot-toast';

export type AppNotificationPermission = NotificationPermission | 'unsupported';

export function getNotificationPermission(): AppNotificationPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestAppNotificationPermission(): Promise<AppNotificationPermission> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return Notification.permission;
  }
}

export function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(880, now, 0.16);
    playTone(1174.66, now + 0.18, 0.24);
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Browser autoplay policies can block Web Audio prior to gesture
  }
}

async function getReadyServiceWorker(timeoutMs = 1200): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return registration;
  } catch {
    return null;
  }
}

export async function showMedicineNotification(params: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  withToast?: boolean;
}): Promise<{ deliveredOs: boolean }> {
  const { title, body, tag = 'rabbit-mediko-reminder', url = '/medicines', withToast = true } = params;

  playNotificationChime();

  if (withToast) {
    toast(`${title}: ${body}`, {
      duration: 6000,
      icon: '💊',
    });
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return { deliveredOs: false };
  }

  // Prefer ServiceWorkerRegistration.showNotification so Android Chrome & installed PWAs work reliably
  const swReg = await getReadyServiceWorker();
  if (swReg && typeof swReg.showNotification === 'function') {
    try {
      await swReg.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag,
        data: { url },
      });
      return { deliveredOs: true };
    } catch {
      // Fall through to window.Notification
    }
  }

  try {
    const n = new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag,
    });
    n.onclick = () => {
      window.focus();
      if (window.location.pathname !== url) {
        window.location.assign(url);
      }
      n.close();
    };
    return { deliveredOs: true };
  } catch {
    return { deliveredOs: false };
  }
}
