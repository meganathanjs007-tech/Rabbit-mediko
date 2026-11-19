import React, { useEffect, useMemo, useState } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  Activity,
  Download,
  ExternalLink,
  FileText,
  Plus,
  Stethoscope,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/BottomNav';
import { EmptyState } from '../components/EmptyState';
import { MemberSelector } from '../components/MemberSelector';
import { useFamily } from '../hooks/useFamily';
import { db, getFriendlyFirebaseError, storage } from '../services/firebase';
import type { HealthRecordType } from '../types/health';
import { getBPStatus, getSugarStatus } from '../utils/healthRules';
import { generateSecureId, getTodayISO } from '../utils/helpers';
import { getT } from '../utils/i18n';
import { exportMemberHealthPdf } from '../utils/pdfReport';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function HealthVault() {
  const { user, family, members, healthRecords, language } = useFamily();
  const t = getT(language);
  const [searchParams] = useSearchParams();

  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);

  const [entryType, setEntryType] = useState<HealthRecordType>('BP');
  const [date, setDate] = useState(getTodayISO());
  const [systolic, setSystolic] = useState('120');
  const [diastolic, setDiastolic] = useState('80');
  const [sugarVal, setSugarVal] = useState('95');
  const [doctorName, setDoctorName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const paramId = searchParams.get('member');
    if (paramId && members.some((m) => m.id === paramId)) {
      setSelectedMemberId(paramId);
    } else if (!selectedMemberId && members.length > 0) {
      setSelectedMemberId(members[0].id);
    }
  }, [members, searchParams, selectedMemberId]);

  const activeMember = members.find((m) => m.id === selectedMemberId) ?? members[0];

  const memberRecords = useMemo(
    () => (activeMember ? healthRecords.filter((r) => r.memberId === activeMember.id) : []),
    [healthRecords, activeMember]
  );

  const bpList = useMemo(
    () =>
      memberRecords
        .filter((r) => r.type === 'BP')
        .slice(0, 7)
        .reverse(),
    [memberRecords]
  );

  const sugarList = useMemo(
    () =>
      memberRecords
        .filter((r) => r.type === 'Sugar')
        .slice(0, 7)
        .reverse(),
    [memberRecords]
  );

  const reportsList = useMemo(
    () => memberRecords.filter((r) => r.type === 'Report'),
    [memberRecords]
  );

  const visitsList = useMemo(
    () => memberRecords.filter((r) => r.type === 'DoctorVisit'),
    [memberRecords]
  );

  const latestBP = bpList[bpList.length - 1];
  const latestBPStatus = latestBP ? getBPStatus(latestBP.systolic, latestBP.diastolic) : 'normal';

  const latestSugar = sugarList[sugarList.length - 1];
  const latestSugarStatus = latestSugar ? getSugarStatus(latestSugar.numericValue) : 'normal';

  const bpChartData = {
    labels: bpList.map((r) => r.date.slice(5)),
    datasets: [
      {
        label: 'Systolic',
        data: bpList.map((r) => r.systolic ?? 0),
        borderColor: latestBPStatus === 'normal' ? '#10B981' : '#EF4444',
        backgroundColor: latestBPStatus === 'normal' ? '#10B981' : '#EF4444',
        tension: 0.3,
        pointRadius: 4,
      },
      {
        label: 'Diastolic',
        data: bpList.map((r) => r.diastolic ?? 0),
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F6',
        tension: 0.3,
        pointRadius: 4,
      },
    ],
  };

  const sugarChartData = {
    labels: sugarList.map((r) => r.date.slice(5)),
    datasets: [
      {
        label: 'Fasting Sugar (mg/dL)',
        data: sugarList.map((r) => r.numericValue ?? 0),
        borderColor: latestSugarStatus === 'normal' ? '#10B981' : '#EF4444',
        backgroundColor: latestSugarStatus === 'normal' ? '#10B981' : '#EF4444',
        tension: 0.3,
        pointRadius: 4,
      },
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, font: { size: 11 } },
      },
    },
    scales: {
      y: {
        grid: { color: 'rgba(148,163,184,0.15)' },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  const handleSaveReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !activeMember) return;
    setSaving(true);
    const recId = generateSecureId('rec');

    const cleanNotes = notes.trim().slice(0, 1000);
    const cleanDoctor = doctorName.trim().slice(0, 120);
    const cleanDate = date && date.length >= 8 ? date.slice(0, 32) : getTodayISO();

    const actorUid = user?.uid ?? family.createdBy;
    try {
      if (entryType === 'BP') {
        const sys = Math.min(350, Math.max(30, Number(systolic) || 120));
        const dia = Math.min(250, Math.max(20, Number(diastolic) || 80));
        await setDoc(doc(db, 'families', family.id, 'healthRecords', recId), {
          ownerUid: actorUid,
          memberId: activeMember.id,
          type: 'BP',
          value: `${sys}/${dia} mmHg`,
          systolic: sys,
          diastolic: dia,
          date: cleanDate,
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          createdAt: serverTimestamp(),
        });
      } else if (entryType === 'Sugar') {
        const val = Math.min(1500, Math.max(0, Number(sugarVal) || 95));
        await setDoc(doc(db, 'families', family.id, 'healthRecords', recId), {
          ownerUid: actorUid,
          memberId: activeMember.id,
          type: 'Sugar',
          value: `${val} mg/dL`,
          numericValue: val,
          date: cleanDate,
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          createdAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'families', family.id, 'healthRecords', recId), {
          ownerUid: actorUid,
          memberId: activeMember.id,
          type: 'DoctorVisit',
          value: cleanDoctor || 'Doctor Consultation',
          date: cleanDate,
          doctorName: cleanDoctor,
          notes: cleanNotes,
          createdAt: serverTimestamp(),
        });
      }

      toast.success(language === 'ta' ? 'பதிவு சேமிக்கப்பட்டது!' : 'Health record saved!');
      setNotes('');
      setDoctorName('');
      setModalOpen(false);
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !family || !activeMember) return;

    setUploading(true);
    try {
      const rawName = (file.name || 'Report').trim() || 'Report';
      const storageSafeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
      const storageRef = ref(storage, `families/${family.id}/reports/${Date.now()}_${storageSafeName}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const recId = generateSecureId('rep');
      await setDoc(doc(db, 'families', family.id, 'healthRecords', recId), {
        ownerUid: user?.uid ?? family.createdBy,
        memberId: activeMember.id,
        type: 'Report',
        value: rawName.slice(0, 120),
        date: getTodayISO(),
        fileUrl: downloadUrl.slice(0, 2000),
        fileName: rawName.slice(0, 200),
        createdAt: serverTimestamp(),
      });
      toast.success(language === 'ta' ? 'அறிக்கை பதிவேற்றப்பட்டது!' : 'Report uploaded!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(`Storage upload failed (${msg}). Ensure Firebase Storage is enabled in Firebase Console.`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!family) return;
    try {
      await deleteDoc(doc(db, 'families', family.id, 'healthRecords', recordId));
      toast.success(language === 'ta' ? 'பதிவு நீக்கப்பட்டது' : 'Entry removed');
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    }
  };

  const handleExportPdf = () => {
    if (!activeMember) return;
    try {
      const filename = exportMemberHealthPdf({
        member: activeMember,
        familyName: family?.familyName,
        emergencyContact: family?.emergencyContact,
        records: memberRecords,
      });
      toast.success(
        language === 'ta'
          ? `PDF அறிக்கை பதிவிறக்கப்பட்டது (${filename})`
          : `PDF report downloaded (${filename})`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to export PDF');
    }
  };

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900">{t.vault.title}</h1>
          {activeMember && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors min-h-[44px] cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>{language === 'ta' ? 'PDF அறிக்கை பதிவிறக்கு' : 'Export PDF Report'}</span>
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors min-h-[44px] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.vault.addReading}</span>
              </button>
            </div>
          )}
        </div>

        <MemberSelector
          members={members}
          selectedId={activeMember?.id ?? ''}
          onSelect={setSelectedMemberId}
        />

        {!activeMember ? (
          <EmptyState
            icon={<Activity className="w-6 h-6" />}
            title="No family members found"
            description="Add family members in Settings or Family Setup to track vitals."
          />
        ) : (
          <>
            {/* Profile Summary Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">{activeMember.name}</h2>
                <p className="text-sm text-slate-600">
                  {activeMember.age} yrs · {activeMember.gender} · Blood Group{' '}
                  <span className="font-mono font-semibold text-red-700">{activeMember.bloodGroup}</span>
                </p>
              </div>
              <div className="text-xs sm:text-right text-slate-600 space-y-1">
                <p>
                  <span className="font-semibold text-slate-800">Conditions:</span>{' '}
                  {activeMember.conditions.join(', ')}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Allergies:</span>{' '}
                  {activeMember.allergies.join(', ')}
                </p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* BP Chart */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{t.vault.bpChartTitle}</h3>
                    <p className="text-xs text-slate-500">{t.vault.normalBP}</p>
                  </div>
                  {latestBP && (
                    <div className="text-right">
                      <p className="text-base font-mono font-bold tabular-nums text-slate-900">
                        {latestBP.value}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          latestBPStatus === 'normal' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {latestBPStatus === 'normal' ? 'Normal' : latestBPStatus === 'high' ? 'High BP' : 'Low BP'}
                      </p>
                    </div>
                  )}
                </div>

                {bpList.length === 0 ? (
                  <p className="text-sm text-slate-400 py-14 text-center">{t.vault.noRecords}</p>
                ) : (
                  <div className="h-56">
                    <Line data={bpChartData} options={chartOptions} />
                  </div>
                )}
              </div>

              {/* Sugar Chart */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{t.vault.sugarChartTitle}</h3>
                    <p className="text-xs text-slate-500">{t.vault.normalSugar}</p>
                  </div>
                  {latestSugar && (
                    <div className="text-right">
                      <p className="text-base font-mono font-bold tabular-nums text-slate-900">
                        {latestSugar.value}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          latestSugarStatus === 'normal' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {latestSugarStatus === 'normal'
                          ? 'Normal'
                          : latestSugarStatus === 'high'
                            ? 'High Sugar'
                            : 'Low Sugar'}
                      </p>
                    </div>
                  )}
                </div>

                {sugarList.length === 0 ? (
                  <p className="text-sm text-slate-400 py-14 text-center">{t.vault.noRecords}</p>
                ) : (
                  <div className="h-56">
                    <Line data={sugarChartData} options={chartOptions} />
                  </div>
                )}
              </div>
            </div>

            {/* Reports & Doctor Visits */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Reports Upload & List */}
              <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>{t.vault.reportsTitle}</span>
                  </h3>
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer min-h-[40px]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploading ? 'Uploading...' : t.vault.uploadReport}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={uploading}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {reportsList.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">{t.vault.noReports}</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {reportsList.map((rep) => (
                      <div key={rep.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{rep.fileName || rep.value}</p>
                          <p className="text-xs text-slate-500 font-mono">{rep.date}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {rep.fileUrl && (
                            <a
                              href={rep.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDeleteRecord(rep.id)}
                            className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                            aria-label="Delete report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Doctor Visits Log */}
              <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-blue-600" />
                    <span>{t.vault.visitsTitle}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEntryType('DoctorVisit');
                      setModalOpen(true);
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    + Log Visit
                  </button>
                </div>

                {visitsList.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">{t.vault.noVisits}</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {visitsList.map((visit) => (
                      <div key={visit.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                            <span>{visit.date}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans font-semibold text-slate-800">
                              {visit.doctorName || visit.value}
                            </span>
                          </div>
                          {visit.notes && (
                            <p className="text-sm text-slate-700 leading-relaxed">{visit.notes}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRecord(visit.id)}
                          className="p-2 text-slate-400 hover:text-red-600 shrink-0 cursor-pointer"
                          aria-label="Delete visit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {/* Add Reading Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">{t.vault.addReading}</h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveReading} className="space-y-4">
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                  {(['BP', 'Sugar', 'DoctorVisit'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEntryType(type)}
                      className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        entryType === type ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      {type === 'DoctorVisit' ? 'Doctor Visit' : type}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">{t.vault.date}</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                  />
                </div>

                {entryType === 'BP' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">{t.vault.systolic}</label>
                      <input
                        type="number"
                        min={50}
                        max={280}
                        required
                        value={systolic}
                        onChange={(e) => setSystolic(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">{t.vault.diastolic}</label>
                      <input
                        type="number"
                        min={30}
                        max={180}
                        required
                        value={diastolic}
                        onChange={(e) => setDiastolic(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                      />
                    </div>
                  </div>
                )}

                {entryType === 'Sugar' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">{t.vault.sugarValue}</label>
                    <input
                      type="number"
                      min={30}
                      max={700}
                      required
                      value={sugarVal}
                      onChange={(e) => setSugarVal(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                    />
                  </div>
                )}

                {entryType === 'DoctorVisit' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">{t.vault.doctorName}</label>
                    <input
                      type="text"
                      required
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      placeholder="e.g. Dr. S. Karthikeyan"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">{t.vault.notes}</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional clinical notes..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 min-h-[48px] cursor-pointer"
                >
                  {saving ? 'Saving...' : t.vault.saveRecord}
                </button>
              </form>
            </div>
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
