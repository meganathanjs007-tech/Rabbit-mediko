import { useEffect } from 'react';
import { useFamily } from '../hooks/useFamily';
import { getTodayISO } from '../utils/helpers';
import { showMedicineNotification } from '../utils/notifications';

const NOTIF_STORAGE_PREFIX = 'rm_med_notif_';

function parseMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function cleanupOldNotificationKeys(todayISO: string) {
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NOTIF_STORAGE_PREFIX) && !k.startsWith(`${NOTIF_STORAGE_PREFIX}${todayISO}_`)) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }
}

export function MedicineNotificationManager() {
  const { family, members, medicines, medicineLogs, language } = useFamily();

  useEffect(() => {
    if (!family || medicines.length === 0) return;

    const checkDueMedicines = () => {
      const todayISO = getTodayISO();
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      cleanupOldNotificationKeys(todayISO);

      for (const med of medicines) {
        if (!med.active) continue;
        if (med.startDate && med.startDate > todayISO) continue;
        if (med.endDate && med.endDate < todayISO) continue;

        const member = members.find((m) => m.id === med.memberId);
        const memberLabel = member?.name ?? (language === 'ta' ? 'குடும்பம்' : 'Family');

        for (const slotTime of med.times) {
          const slotMinutes = parseMinutes(slotTime);
          if (slotMinutes === null) continue;

          // Grace window: trigger within 0..5 minutes after scheduled dose time
          const diff = nowMinutes - slotMinutes;
          if (diff < 0 || diff > 5) continue;

          const sanitizedTime = slotTime.replace(/[^a-zA-Z0-9]/g, '');
          const logId = `${med.id}_${todayISO}_${sanitizedTime}`;
          const alreadyTaken = medicineLogs.some((l) => l.id === logId);
          if (alreadyTaken) continue;

          const dedupKey = `${NOTIF_STORAGE_PREFIX}${todayISO}_${med.id}_${sanitizedTime}`;
          try {
            if (localStorage.getItem(dedupKey)) continue;
            localStorage.setItem(dedupKey, '1');
          } catch {
            // Continue even if localStorage fails
          }

          const title = `Rabbit Mediko · ${memberLabel}`;
          const body =
            language === 'ta'
              ? `${med.name} (${med.dosage}) எடுத்துக்கொள்ளும் நேரம் — ${slotTime}`
              : `Time for ${med.name} (${med.dosage}) — ${slotTime}`;

          void showMedicineNotification({
            title,
            body,
            tag: logId,
            url: '/medicines',
            withToast: true,
          });
        }
      }
    };

    checkDueMedicines();
    const intervalId = window.setInterval(checkDueMedicines, 15000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDueMedicines();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [family, members, medicines, medicineLogs, language]);

  return null;
}
