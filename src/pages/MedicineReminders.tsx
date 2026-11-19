import React, { useEffect, useMemo, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AlertTriangle, Bell, BellRing, Check, Pill, Plus, Send, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { AppShell } from '../components/BottomNav';
import { EmptyState } from '../components/EmptyState';
import { useFamily } from '../hooks/useFamily';
import { db, getFriendlyFirebaseError } from '../services/firebase';
import type { Medicine, MedicineFrequency } from '../types/health';
import { getDaysUntilDate } from '../utils/healthRules';
import { generateSecureId, getTodayISO } from '../utils/helpers';
import { getT } from '../utils/i18n';
import {
  getNotificationPermission,
  requestAppNotificationPermission,
  showMedicineNotification,
  type AppNotificationPermission,
} from '../utils/notifications';

export default function MedicineReminders() {
  const { user, family, members, medicines, medicineLogs, syncEmergencyCard, language } = useFamily();
  const t = getT(language);
  const todayISO = getTodayISO();

  const [modalOpen, setModalOpen] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('1 Tablet');
  const [frequency, setFrequency] = useState<MedicineFrequency>('Once');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [notifPermission, setNotifPermission] = useState<AppNotificationPermission>(() =>
    getNotificationPermission()
  );

  useEffect(() => {
    if (!memberId && members.length > 0) {
      setMemberId(members[0].id);
    }
  }, [members, memberId]);

  const handleFrequencyChange = (freq: MedicineFrequency) => {
    setFrequency(freq);
    if (freq === 'Once') setTimes(['08:00']);
    if (freq === 'Twice') setTimes(['08:00', '20:00']);
    if (freq === 'Thrice') setTimes(['08:00', '14:00', '20:00']);
  };

  const requestNotificationPermission = async () => {
    const perm = await requestAppNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      toast.success(t.medicines.notificationsEnabled);
      await showMedicineNotification({
        title: 'Rabbit Mediko',
        body:
          language === 'ta'
            ? 'மருந்து நினைவூட்டல்கள் இயக்கப்பட்டுள்ளன!'
            : 'Medicine reminders are enabled across the app!',
        tag: 'rm-enabled',
        url: '/medicines',
        withToast: false,
      });
    } else if (perm === 'denied') {
      toast.error(
        language === 'ta'
          ? 'உலாவி அமைப்புகளில் Notifications அனுமதிக்கவும்.'
          : 'Notifications are blocked in your browser site settings.'
      );
    } else if (perm === 'unsupported') {
      toast('OS push is unsupported in this view; sound & in-app alerts remain active.', { duration: 4000 });
    }
  };

  const handleSendTest = async () => {
    const result = await showMedicineNotification({
      title: 'Rabbit Mediko · Test Reminder',
      body:
        language === 'ta'
          ? 'சோதனை மருந்து நினைவூட்டல் வெற்றிகரமாக இயங்குகிறது!'
          : 'Your medicine reminder alert & chime are working!',
      tag: `rm-test-${Date.now()}`,
      url: '/medicines',
      withToast: true,
    });
    if (!result.deliveredOs && notifPermission !== 'granted') {
      toast('Enable notifications to also receive lock-screen alerts.', { duration: 3500 });
    }
  };

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !memberId || !name.trim()) return;

    setSaving(true);
    const actorUid = user?.uid ?? family.createdBy;
    const medId = generateSecureId('med');
    const cleanName = name.trim().slice(0, 120);
    const cleanDosage = (dosage.trim() || '1 Tablet').slice(0, 60);
    const cleanTimes = times.filter(Boolean).slice(0, 6);
    if (cleanTimes.length === 0) cleanTimes.push('08:00');

    const newMed: Medicine = {
      id: medId,
      ownerUid: actorUid,
      memberId,
      name: cleanName,
      dosage: cleanDosage,
      frequency,
      times: cleanTimes,
      startDate: startDate || todayISO,
      ...(endDate ? { endDate } : {}),
      ...(expiryDate ? { expiryDate } : {}),
      active: true,
    };

    try {
      await setDoc(doc(db, 'families', family.id, 'medicines', medId), {
        ownerUid: actorUid,
        memberId: newMed.memberId,
        name: newMed.name,
        dosage: newMed.dosage,
        frequency: newMed.frequency,
        times: newMed.times,
        startDate: newMed.startDate,
        ...(newMed.endDate ? { endDate: newMed.endDate } : {}),
        ...(newMed.expiryDate ? { expiryDate: newMed.expiryDate } : {}),
        active: true,
        createdAt: serverTimestamp(),
      });

      const targetMember = members.find((m) => m.id === memberId);
      if (targetMember) {
        await syncEmergencyCard(targetMember, [...medicines, newMed]);
      }

      toast.success(language === 'ta' ? 'மருந்து சேமிக்கப்பட்டது!' : 'Medicine schedule saved!');
      setName('');
      setModalOpen(false);
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (med: Medicine) => {
    if (!family) return;
    try {
      await updateDoc(doc(db, 'families', family.id, 'medicines', med.id), {
        active: !med.active,
      });
      const updatedList = medicines.map((m) => (m.id === med.id ? { ...m, active: !med.active } : m));
      const targetMember = members.find((m) => m.id === med.memberId);
      if (targetMember) {
        await syncEmergencyCard(targetMember, updatedList);
      }
      toast.success(!med.active ? 'Reminder activated' : 'Reminder paused');
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    }
  };

  const handleDeleteMedicine = async (med: Medicine) => {
    if (!family) return;
    try {
      await deleteDoc(doc(db, 'families', family.id, 'medicines', med.id));
      const remaining = medicines.filter((m) => m.id !== med.id);
      const targetMember = members.find((m) => m.id === med.memberId);
      if (targetMember) {
        await syncEmergencyCard(targetMember, remaining);
      }
      toast.success('Medicine removed');
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    }
  };

  const toggleDoseTaken = async (med: Medicine, slotTime: string) => {
    if (!family) return;
    const sanitizedTime = slotTime.replace(/[^a-zA-Z0-9]/g, '');
    const logId = `${med.id}_${todayISO}_${sanitizedTime}`;
    const alreadyTaken = medicineLogs.some((l) => l.id === logId);
    const ref = doc(db, 'families', family.id, 'medicineLogs', logId);

    try {
      if (alreadyTaken) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, {
          ownerUid: user?.uid ?? family.createdBy,
          medicineId: med.id,
          memberId: med.memberId,
          date: todayISO,
          time: slotTime,
          takenAt: serverTimestamp(),
        });
        toast.success(`${med.name} (${slotTime}) taken!`);
      }
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    }
  };

  const { totalDoses, takenDoses } = useMemo(() => {
    let total = 0;
    let taken = 0;
    for (const med of medicines.filter(
      (m) => m.active && (!m.startDate || m.startDate <= todayISO) && (!m.endDate || m.endDate >= todayISO)
    )) {
      for (const slotTime of med.times) {
        total += 1;
        const sanitizedTime = slotTime.replace(/[^a-zA-Z0-9]/g, '');
        const logId = `${med.id}_${todayISO}_${sanitizedTime}`;
        if (medicineLogs.some((l) => l.id === logId)) taken += 1;
      }
    }
    return { totalDoses: total, takenDoses: taken };
  }, [medicines, medicineLogs, todayISO]);

  const pct = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full min-w-0 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900">{t.medicines.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void requestNotificationPermission()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px] cursor-pointer"
            >
              {notifPermission === 'granted' ? (
                <>
                  <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t.medicines.notificationsEnabled}</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{t.medicines.enableNotifications}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleSendTest()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px] cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{language === 'ta' ? 'சோதனை' : 'Test Alert'}</span>
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 min-h-[44px] cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{t.medicines.addMedicine}</span>
            </button>
          </div>
        </div>

        {notifPermission === 'denied' && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {language === 'ta'
                ? 'உலாவியில் Notifications தடுக்கப்பட்டுள்ளது; எனினும் செயலியில் ஒலி மற்றும் திரை நினைவூட்டல்கள் இயங்கும்.'
                : 'Browser notifications are blocked in site settings. In-app banners and chime alerts remain active while using Rabbit Mediko.'}
            </span>
          </div>
        )}

        {/* Today's Progress Ring Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={radius} stroke="#E2E8F0" strokeWidth="7" fill="none" />
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  stroke="#10B981"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  fill="none"
                  className="transition-all duration-300"
                />
              </svg>
              <span className="absolute text-sm font-mono font-bold text-slate-900 tabular-nums">
                {pct}%
              </span>
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="text-base font-semibold text-slate-900">{t.medicines.todayProgress}</h2>
              <p className="text-sm text-slate-600 font-mono tabular-nums">
                {takenDoses} of {totalDoses} scheduled doses taken today
              </p>
            </div>
          </div>
        </div>

        {/* Grouped by Member */}
        {medicines.length === 0 ? (
          <EmptyState
            icon={<Pill className="w-6 h-6" />}
            title="No medicines scheduled yet"
            description={t.medicines.noMedicines}
            actionLabel={t.medicines.addMedicine}
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <div className="space-y-6">
            {members.map((member) => {
              const memMeds = medicines.filter((m) => m.memberId === member.id);
              if (memMeds.length === 0) return null;
              return (
                <section key={member.id} className="space-y-3 min-w-0">
                  <h3 className="text-sm font-bold text-slate-700">
                    {member.name} · {memMeds.length} {memMeds.length === 1 ? 'prescription' : 'prescriptions'}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {memMeds.map((med) => {
                      const daysLeft = getDaysUntilDate(med.expiryDate);
                      const isExpiring = daysLeft !== null && daysLeft <= 7;

                      return (
                        <div
                          key={med.id}
                          className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 min-w-0 ${
                            !med.active ? 'border-slate-200 opacity-70' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-0.5 min-w-0">
                              <h4 className="text-base font-bold text-slate-900 truncate">{med.name}</h4>
                              <p className="text-xs text-slate-500">
                                {med.dosage} · {med.frequency} daily
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => void toggleActive(med)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                                  med.active
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-slate-100 border-slate-200 text-slate-600'
                                }`}
                              >
                                {med.active ? 'Active' : 'Paused'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteMedicine(med)}
                                className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                                aria-label={`Delete ${med.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {isExpiring && (
                            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2 text-xs font-medium text-amber-900">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                {daysLeft !== null && daysLeft < 0
                                  ? `${t.medicines.expired} (${med.expiryDate})`
                                  : `${t.medicines.expiringSoon}: ${med.expiryDate} (${daysLeft}d left)`}
                              </span>
                            </div>
                          )}

                          {/* Dose times */}
                          <div className="flex flex-wrap gap-2">
                            {med.times.map((slotTime) => {
                              const sanitizedTime = slotTime.replace(/[^a-zA-Z0-9]/g, '');
                              const logId = `${med.id}_${todayISO}_${sanitizedTime}`;
                              const taken = medicineLogs.some((l) => l.id === logId);

                              return (
                                <button
                                  key={slotTime}
                                  type="button"
                                  disabled={!med.active}
                                  onClick={() => void toggleDoseTaken(med, slotTime)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-semibold transition-colors min-h-[40px] cursor-pointer ${
                                    taken
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-emerald-400'
                                  }`}
                                >
                                  {taken && <Check className="w-3.5 h-3.5" />}
                                  <span>{slotTime}</span>
                                  <span className="font-sans font-medium opacity-90">
                                    · {taken ? t.dashboard.taken : 'Take'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Add Medicine Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">{t.medicines.addMedicine}</h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMedicine} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">Member</label>
                  <select
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                    required
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">{t.medicines.medicineName}</label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Metformin 500mg"
                      className="w-full min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">{t.medicines.dosage}</label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      placeholder="1 Tablet"
                      className="w-full min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">{t.medicines.frequency}</label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                    {(['Once', 'Twice', 'Thrice'] as const).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => handleFrequencyChange(freq)}
                        className={`py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                          frequency === freq ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">{t.medicines.times}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {times.map((tm, idx) => (
                      <input
                        key={idx}
                        type="time"
                        value={tm}
                        onChange={(e) => {
                          const next = [...times];
                          next[idx] = e.target.value;
                          setTimes(next);
                        }}
                        className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        required
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">{t.medicines.startDate}</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">{t.medicines.expiryDate}</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">{t.medicines.endDate}</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 min-h-[48px] cursor-pointer"
                >
                  {saving ? 'Saving...' : t.medicines.saveMedicine}
                </button>
              </form>
            </div>
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
