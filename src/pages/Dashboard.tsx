import { useMemo, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  CalendarHeart,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Pill,
  Plus,
  QrCode,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/BottomNav';
import { useFamily } from '../hooks/useFamily';
import { db, getFriendlyFirebaseError } from '../services/firebase';
import { getBPStatus, getSugarStatus } from '../utils/healthRules';
import { formatLongDate, getInitials, getTimeGreeting, getTodayISO } from '../utils/helpers';
import { getT } from '../utils/i18n';

export default function Dashboard() {
  const { user, family, members, healthRecords, medicines, medicineLogs, mealPlans, language } = useFamily();
  const t = getT(language);
  const todayISO = getTodayISO();
  const [copiedCode, setCopiedCode] = useState(false);

  const todayPlan = mealPlans[todayISO];

  // Build today's medicine dose list
  const todayDoses = useMemo(() => {
    const list: Array<{
      logId: string;
      medicineId: string;
      medicineName: string;
      dosage: string;
      memberId: string;
      memberName: string;
      time: string;
      taken: boolean;
    }> = [];

    const activeMeds = medicines.filter(
      (m) => m.active && (!m.startDate || m.startDate <= todayISO) && (!m.endDate || m.endDate >= todayISO)
    );
    for (const med of activeMeds) {
      const member = members.find((mem) => mem.id === med.memberId);
      for (const slotTime of med.times) {
        const sanitizedTime = slotTime.replace(/[^a-zA-Z0-9]/g, '');
        const logId = `${med.id}_${todayISO}_${sanitizedTime}`;
        const taken = medicineLogs.some((l) => l.id === logId);
        list.push({
          logId,
          medicineId: med.id,
          medicineName: med.name,
          dosage: med.dosage,
          memberId: med.memberId,
          memberName: member?.name ?? 'Family',
          time: slotTime,
          taken,
        });
      }
    }
    return list.sort((a, b) => a.time.localeCompare(b.time));
  }, [medicines, members, medicineLogs, todayISO]);

  // Compute health alerts from latest BP & Sugar readings per member
  const healthAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      memberId: string;
      memberName: string;
      metric: string;
      value: string;
      date: string;
      status: 'high' | 'low';
    }> = [];

    for (const member of members) {
      const memberRecords = healthRecords.filter((r) => r.memberId === member.id);
      const latestBP = memberRecords.find((r) => r.type === 'BP');
      if (latestBP) {
        const bpStat = getBPStatus(latestBP.systolic, latestBP.diastolic);
        if (bpStat !== 'normal') {
          alerts.push({
            id: latestBP.id,
            memberId: member.id,
            memberName: member.name,
            metric: 'Blood Pressure',
            value: latestBP.value,
            date: latestBP.date,
            status: bpStat,
          });
        }
      }
      const latestSugar = memberRecords.find((r) => r.type === 'Sugar');
      if (latestSugar) {
        const sugarStat = getSugarStatus(latestSugar.numericValue);
        if (sugarStat !== 'normal') {
          alerts.push({
            id: latestSugar.id,
            memberId: member.id,
            memberName: member.name,
            metric: 'Fasting Sugar',
            value: latestSugar.value,
            date: latestSugar.date,
            status: sugarStat,
          });
        }
      }
    }
    return alerts;
  }, [members, healthRecords]);

  const toggleDose = async (dose: (typeof todayDoses)[number]) => {
    if (!family) return;
    const ref = doc(db, 'families', family.id, 'medicineLogs', dose.logId);
    try {
      if (dose.taken) {
        await deleteDoc(ref);
        toast.success(`${dose.medicineName} marked pending`);
      } else {
        await setDoc(ref, {
          ownerUid: user?.uid ?? family.createdBy,
          medicineId: dose.medicineId,
          memberId: dose.memberId,
          date: todayISO,
          time: dose.time,
          takenAt: serverTimestamp(),
        });
        toast.success(`${dose.medicineName} ${t.dashboard.taken}!`);
      }
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    }
  };

  const takenCount = todayDoses.filter((d) => d.taken).length;
  const plannedMealsCount = todayPlan
    ? (['breakfast', 'lunch', 'dinner', 'snacks'] as const).reduce(
        (sum, slot) => sum + ((todayPlan[slot]?.length ?? 0) > 0 ? 1 : 0),
        0
      )
    : 0;

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full min-w-0 space-y-6"
      >
        {/* Header Greeting & Shareable Code */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-slate-500">{formatLongDate(language)}</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">
              {getTimeGreeting(language)}, {family?.familyName || 'Family'}
            </h1>
          </div>
          {family?.inviteCode && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(family.inviteCode!);
                  setCopiedCode(true);
                  toast.success(
                    language === 'ta'
                      ? `குடும்பக் குறியீடு நகலெடுக்கப்பட்டது: ${family.inviteCode}`
                      : `Invite code copied: ${family.inviteCode}`
                  );
                  setTimeout(() => setCopiedCode(false), 2000);
                } catch {
                  toast.error('Could not copy invite code');
                }
              }}
              className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-mono font-semibold hover:bg-emerald-100 transition-colors min-h-[40px] whitespace-nowrap shrink-0 cursor-pointer"
              title="Copy Family Invite Code"
            >
              <span className="font-sans text-xs font-medium text-emerald-700">
                {language === 'ta' ? 'குறியீடு:' : 'Invite Code:'}
              </span>
              <span className="tracking-wider">{family.inviteCode}</span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-emerald-700" />
              )}
            </button>
          )}
        </div>

        {/* 4-Metric KPI Summary Strip */}
        <section aria-label="Family overview" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link
            to="/vault"
            className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-emerald-300 transition-colors min-w-0"
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span className="truncate">{t.dashboard.familyMembers}</span>
              <Users className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <p className="mt-2 text-2xl font-mono font-bold text-slate-900 tabular-nums">
              {members.length}
            </p>
          </Link>

          <Link
            to="/medicines"
            className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-emerald-300 transition-colors min-w-0"
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span className="truncate">{t.dashboard.todaysMedicines}</span>
              <Pill className="w-4 h-4 text-blue-600 shrink-0" />
            </div>
            <p className="mt-2 text-2xl font-mono font-bold text-slate-900 tabular-nums">
              {takenCount}/{todayDoses.length}
            </p>
          </Link>

          <Link
            to="/vault"
            className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-emerald-300 transition-colors min-w-0"
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span className="truncate">{t.dashboard.healthAlerts}</span>
              <Activity
                className={`w-4 h-4 shrink-0 ${
                  healthAlerts.length > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              />
            </div>
            <p
              className={`mt-2 text-2xl font-mono font-bold tabular-nums ${
                healthAlerts.length > 0 ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {healthAlerts.length}
            </p>
          </Link>

          <Link
            to="/meals"
            className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-emerald-300 transition-colors min-w-0"
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span className="truncate">{t.dashboard.todaysMeals}</span>
              <CalendarHeart className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <p className="mt-2 text-2xl font-mono font-bold text-slate-900 tabular-nums">
              {plannedMealsCount}/4
            </p>
          </Link>
        </section>

        {/* Family Members Horizontal Strip */}
        <section aria-label={t.dashboard.familyMembers} className="min-w-0 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">{t.dashboard.familyMembers}</h2>
            <Link to="/vault" className="text-xs font-medium text-emerald-700 hover:underline">
              {t.nav.vault}
            </Link>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
            {members.map((m) => (
              <Link
                key={m.id}
                to={`/vault?member=${m.id}`}
                className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shrink-0 hover:border-emerald-300 transition-colors min-w-[200px] max-w-[260px]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 font-semibold text-sm flex items-center justify-center shrink-0">
                  {getInitials(m.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {m.age}y · {m.bloodGroup} · {m.conditions.join(', ')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Health Alerts */}
        <section aria-label={t.dashboard.healthAlerts} className="min-w-0">
          {healthAlerts.length === 0 ? (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
              <p className="text-sm font-medium text-emerald-950">{t.dashboard.allVitalsNormal}</p>
            </div>
          ) : (
            <div className="bg-red-50/80 border border-red-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {t.dashboard.healthAlerts} ({healthAlerts.length})
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {healthAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    to={`/vault?member=${alert.memberId}`}
                    className="bg-white border border-red-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-red-300 transition-colors min-w-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{alert.memberName}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {alert.metric} · {alert.date}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-bold text-red-600 tabular-nums">{alert.value}</p>
                      <p className="text-[11px] font-semibold text-red-700">
                        {alert.status === 'high' ? 'High' : 'Low'} · {t.dashboard.highAlert}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Main 2-Column Content */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Today's Medicines */}
          <section className="lg:col-span-7 min-w-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">{t.dashboard.todaysMedicines}</h2>
              <Link to="/medicines" className="text-xs font-medium text-emerald-700 hover:underline inline-flex items-center gap-1 shrink-0">
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {todayDoses.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">{t.dashboard.noMedicinesToday}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayDoses.map((dose) => (
                  <button
                    key={dose.logId}
                    type="button"
                    onClick={() => void toggleDose(dose)}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 rounded-xl px-2 transition-colors min-h-[52px] cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                          dose.taken
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${dose.taken ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {dose.medicineName} · {dose.dosage}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{dose.memberName}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">{dose.time}</span>
                      <p className={`text-[11px] font-medium ${dose.taken ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {dose.taken ? t.dashboard.taken : t.dashboard.pending}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Right Column: Today's Meals & Quick Actions */}
          <div className="lg:col-span-5 min-w-0 space-y-6">
            {/* Quick Actions 2x2 */}
            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5">
              <h2 className="text-base font-semibold text-slate-900">{t.dashboard.quickActions}</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/vault"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors flex flex-col gap-2 min-h-[76px]"
                >
                  <Activity className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-900">{t.dashboard.addRecord}</span>
                </Link>
                <Link
                  to="/meals"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors flex flex-col gap-2 min-h-[76px]"
                >
                  <CalendarHeart className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-900">{t.dashboard.planMeal}</span>
                </Link>
                <Link
                  to="/medicines"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors flex flex-col gap-2 min-h-[76px]"
                >
                  <Pill className="w-5 h-5 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-900">{t.dashboard.addMedicine}</span>
                </Link>
                <Link
                  to="/emergency-qr"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50/40 transition-colors flex flex-col gap-2 min-h-[76px]"
                >
                  <QrCode className="w-5 h-5 text-red-600" />
                  <span className="text-xs font-semibold text-slate-900">{t.dashboard.emergencyQR}</span>
                </Link>
              </div>
            </section>

            {/* Today's Meal Plan */}
            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">{t.dashboard.todaysMeals}</h2>
                <Link to="/meals" className="text-xs font-medium text-emerald-700 hover:underline inline-flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Link>
              </div>
              {!todayPlan ? (
                <p className="text-sm text-slate-500 py-4">{t.dashboard.noMealsPlanned}</p>
              ) : (
                <div className="divide-y divide-slate-100 text-sm">
                  {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map((slot) => (
                    <div key={slot} className="py-2.5 flex items-baseline justify-between gap-4">
                      <span className="text-xs font-semibold text-slate-500 capitalize w-20 shrink-0">
                        {t.meals[slot]}
                      </span>
                      <span className="text-sm text-slate-900 text-right break-words min-w-0">
                        {todayPlan[slot]?.length ? todayPlan[slot].join(', ') : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-1 flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Smart Diabetes & BP warning checks active</span>
              </div>
            </section>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
