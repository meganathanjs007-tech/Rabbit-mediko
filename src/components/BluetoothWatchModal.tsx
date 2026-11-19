import { useEffect, useRef, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  Battery,
  Bluetooth,
  BluetoothConnected,
  CheckCircle2,
  Droplets,
  ExternalLink,
  HeartPulse,
  Loader2,
  Sparkles,
  Watch,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db, getFriendlyFirebaseError } from '../services/firebase';
import { searchGroundedHealthInfo, type GroundedSource } from '../services/gemini';
import type { FamilyMember, Language } from '../types/health';
import {
  BluetoothBlockedError,
  connectBluetoothWatch,
  isBluetoothBlockedByPolicy,
  isWebBluetoothSupported,
  type WatchConnectionSession,
  type WatchReadingsSnapshot,
} from '../utils/bluetoothWatch';
import { getBPStatus, getHeartRateStatus, getSpO2Status } from '../utils/healthRules';
import { generateSecureId, getTodayISO } from '../utils/helpers';

interface BluetoothWatchModalProps {
  open: boolean;
  onClose: () => void;
  familyId: string;
  actorUid: string;
  member: FamilyMember;
  language: Language;
}

export function BluetoothWatchModal({
  open,
  onClose,
  familyId,
  actorUid,
  member,
  language,
}: BluetoothWatchModalProps) {
  const bluetoothSupported = isWebBluetoothSupported();
  const [policyBlocked, setPolicyBlocked] = useState(() => isBluetoothBlockedByPolicy());
  const sessionRef = useRef<WatchConnectionSession | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [scanAll, setScanAll] = useState(false);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [watchData, setWatchData] = useState<WatchReadingsSnapshot | null>(null);

  const [heartRateInput, setHeartRateInput] = useState('');
  const [spo2Input, setSpo2Input] = useState('');
  const [sysInput, setSysInput] = useState('');
  const [diaInput, setDiaInput] = useState('');

  const [saving, setSaving] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiReport, setAiReport] = useState<{ answer: string; sources: GroundedSource[] } | null>(null);
  const [btError, setBtError] = useState('');

  const fullAppUrl = typeof window !== 'undefined' ? window.location.href : '/';

  useEffect(() => {
    return () => {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
    };
  }, []);

  if (!open) return null;

  const handleConnectWatch = async () => {
    setBtError('');
    setConnecting(true);
    try {
      sessionRef.current?.disconnect();
      const session = await connectBluetoothWatch({
        scanAllDevices: scanAll,
        onReading: (snapshot) => {
          setWatchData(snapshot);
          if (snapshot.heartRate !== undefined) setHeartRateInput(String(snapshot.heartRate));
          if (snapshot.spo2 !== undefined) setSpo2Input(String(snapshot.spo2));
          if (snapshot.systolic !== undefined) setSysInput(String(snapshot.systolic));
          if (snapshot.diastolic !== undefined) setDiaInput(String(snapshot.diastolic));
        },
        onDisconnect: () => {
          setConnectedName(null);
          toast(language === 'ta' ? 'வாட்ச் இணைப்பு துண்டிக்கப்பட்டது' : 'Bluetooth watch disconnected');
        },
      });
      sessionRef.current = session;
      setConnectedName(session.deviceName);
      toast.success(
        language === 'ta'
          ? `${session.deviceName} இணைக்கப்பட்டது!`
          : `Connected to ${session.deviceName}!`
      );
    } catch (err: unknown) {
      if (err instanceof BluetoothBlockedError) {
        setPolicyBlocked(true);
        setBtError('');
      } else {
        const raw = err instanceof Error ? err.message : 'Could not connect to watch';
        if (raw.toLowerCase().includes('permissions policy') || raw.toLowerCase().includes('disallowed by')) {
          setPolicyBlocked(true);
          setBtError('');
        } else if (raw.toLowerCase().includes('cancelled') || raw.toLowerCase().includes('canceled')) {
          setBtError(
            language === 'ta'
              ? 'சாதனத் தேர்வு ரத்து செய்யப்பட்டது. நீங்கள் மீண்டும் முயற்சிக்கலாம் அல்லது கீழே அளவுகளை நேரடியாக உள்ளிடலாம்.'
              : 'Device selection cancelled. You can retry or enter your smartwatch readings manually below.'
          );
        } else {
          setBtError(raw);
        }
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setConnectedName(null);
  };

  const hrVal = heartRateInput ? Number(heartRateInput) : undefined;
  const spo2Val = spo2Input ? Number(spo2Input) : undefined;
  const sysVal = sysInput ? Number(sysInput) : undefined;
  const diaVal = diaInput ? Number(diaInput) : undefined;

  const hrStatus = hrVal && !Number.isNaN(hrVal) ? getHeartRateStatus(hrVal) : 'normal';
  const spo2Status = spo2Val && !Number.isNaN(spo2Val) ? getSpO2Status(spo2Val) : 'normal';
  const bpStatus = sysVal && diaVal && !Number.isNaN(sysVal) && !Number.isNaN(diaVal)
    ? getBPStatus(sysVal, diaVal)
    : 'normal';

  const hasAnyReading =
    (hrVal !== undefined && !Number.isNaN(hrVal) && hrVal > 0) ||
    (spo2Val !== undefined && !Number.isNaN(spo2Val) && spo2Val > 0) ||
    (sysVal !== undefined && diaVal !== undefined && !Number.isNaN(sysVal) && !Number.isNaN(diaVal));

  const hasHealthIssueFlag = hrStatus !== 'normal' || spo2Status !== 'normal' || bpStatus !== 'normal';

  const handleSaveToVault = async () => {
    if (!hasAnyReading) {
      toast.error(language === 'ta' ? 'குறைந்தபட்சம் ஒரு அளவையாவது உள்ளிடவும்' : 'Enter or sync at least one watch reading');
      return;
    }

    setSaving(true);
    const today = getTodayISO();
    const sourceNote = connectedName
      ? `Synced from Bluetooth watch (${connectedName})`
      : 'Smartwatch / wearable reading';

    try {
      if (hrVal && !Number.isNaN(hrVal)) {
        const clampedHr = Math.min(260, Math.max(25, Math.round(hrVal)));
        await setDoc(doc(db, 'families', familyId, 'healthRecords', generateSecureId('hr')), {
          ownerUid: actorUid,
          memberId: member.id,
          type: 'HeartRate',
          value: `${clampedHr} bpm`,
          numericValue: clampedHr,
          date: today,
          notes: sourceNote,
          createdAt: serverTimestamp(),
        });
      }

      if (spo2Val && !Number.isNaN(spo2Val)) {
        const clampedSpo2 = Math.min(100, Math.max(50, Math.round(spo2Val)));
        await setDoc(doc(db, 'families', familyId, 'healthRecords', generateSecureId('ox')), {
          ownerUid: actorUid,
          memberId: member.id,
          type: 'SpO2',
          value: `${clampedSpo2}% SpO2`,
          numericValue: clampedSpo2,
          date: today,
          notes: sourceNote,
          createdAt: serverTimestamp(),
        });
      }

      if (sysVal && diaVal && !Number.isNaN(sysVal) && !Number.isNaN(diaVal)) {
        const sys = Math.min(350, Math.max(30, Math.round(sysVal)));
        const dia = Math.min(250, Math.max(20, Math.round(diaVal)));
        await setDoc(doc(db, 'families', familyId, 'healthRecords', generateSecureId('bp')), {
          ownerUid: actorUid,
          memberId: member.id,
          type: 'BP',
          value: `${sys}/${dia} mmHg`,
          systolic: sys,
          diastolic: dia,
          date: today,
          notes: sourceNote,
          createdAt: serverTimestamp(),
        });
      }

      toast.success(
        language === 'ta'
          ? 'வாட்ச் அளவுகள் Health Vault-ல் சேமிக்கப்பட்டன!'
          : 'Smartwatch readings saved to Health Vault!'
      );
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    } finally {
      setSaving(false);
    }
  };

  const handleCheckWithAI = async () => {
    if (!hasAnyReading) {
      toast.error(language === 'ta' ? 'முதலில் வாட்ச் அளவுகளை உள்ளிடவும்' : 'Sync or enter watch readings first');
      return;
    }

    setAiChecking(true);
    setAiReport(null);
    const parts: string[] = [];
    if (hrVal) parts.push(`Heart Rate: ${hrVal} bpm (${hrStatus})`);
    if (spo2Val) parts.push(`SpO2: ${spo2Val}% (${spo2Status})`);
    if (sysVal && diaVal) parts.push(`BP: ${sysVal}/${diaVal} mmHg (${bpStatus})`);

    try {
      const res = await searchGroundedHealthInfo({
        query:
          language === 'ta'
            ? `எனது ஸ்மார்ட்வாட்ச் அளவுகள் (${parts.join(', ')}) அடிப்படையில் ஏதேனும் உடல்நலப் பிரச்சினைகள் அல்லது கவனிக்க வேண்டிய அறிகுறிகள் உள்ளதா? பாதுகாப்பான வீட்டு பராமரிப்பு மற்றும் எப்போது மருத்துவரை அணுக வேண்டும் என்பதைக் கூறுங்கள்.`
            : `Evaluate these smartwatch readings (${parts.join(', ')}) for potential health issues, normal clinical thresholds, practical precautions, and warning signs requiring a doctor visit.`,
        memberName: member.name,
        age: member.age,
        conditions: member.conditions,
        allergies: member.allergies,
        latestVitals: parts.join('; '),
        language,
      });
      setAiReport(res);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI check failed');
    } finally {
      setAiChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Watch className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {language === 'ta' ? 'புளூடூத் ஸ்மார்ட்வாட்ச் (விருப்பத் தேர்வு)' : 'Bluetooth Watch Connect (Optional)'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'ta'
                  ? `${member.name} · இதயத் துடிப்பு, SpO2 மற்றும் BP பரிசோதனை`
                  : `${member.name} · Optional live BLE sync or manual watch entry`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-900 cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optional Bluetooth Connection Bar */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              {connectedName ? (
                <>
                  <BluetoothConnected className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700">{connectedName}</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    {bluetoothSupported
                      ? language === 'ta'
                        ? 'BLE ஸ்மார்ட்வாட்ச் இணைக்கவும்'
                        : 'Pair BLE Heart Rate / SpO2 / BP Watch'
                      : language === 'ta'
                        ? 'இந்த உலாவியில் Bluetooth இல்லை — கீழே அளவுகளை உள்ளிடலாம்'
                        : 'Web Bluetooth unavailable here — manual entry works anytime'}
                  </span>
                </>
              )}
            </div>

            {watchData?.battery !== undefined && (
              <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-600">
                <Battery className="w-3.5 h-3.5 text-emerald-600" />
                {watchData.battery}%
              </span>
            )}
          </div>

          {bluetoothSupported && policyBlocked ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-2.5">
              <p className="text-xs text-slate-700 leading-relaxed">
                {language === 'ta'
                  ? 'இந்த preview சாளரத்தில் Browser பாதுகாப்பு காரணமாக Bluetooth இணைப்பு தடைசெய்யப்பட்டுள்ளது. நேரடி Bluetooth வாட்ச் இணைப்பிற்கு செயலியை முழுத் தாவலில் (New Tab) திறக்கவும் — அல்லது கீழே வாட்ச் அளவுகளை நேரடியாக உள்ளிடவும்.'
                  : 'Embedded preview windows restrict browser Bluetooth access. Open the app in a full browser tab to pair your watch via Bluetooth, or enter your watch readings directly below.'}
              </p>
              <a
                href={fullAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors min-h-[38px]"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>{language === 'ta' ? 'Bluetooth-க்காக முழுத் தாவலில் திற' : 'Open Full App for Bluetooth'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            bluetoothSupported && (
              <div className="space-y-2.5">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scanAll}
                    onChange={(e) => setScanAll(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    {language === 'ta'
                      ? 'அனைத்து அருகிலுள்ள Bluetooth சாதனங்களையும் காட்டு'
                      : 'Show all nearby Bluetooth devices (recommended for Noise / boAt / Mi watches)'}
                  </span>
                </label>

                <div className="flex flex-wrap gap-2">
                  {!connectedName ? (
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={() => void handleConnectWatch()}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 min-h-[42px] cursor-pointer"
                    >
                      {connecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Bluetooth className="w-4 h-4" />
                      )}
                      <span>
                        {connecting
                          ? language === 'ta'
                            ? 'தேடுகிறது...'
                            : 'Scanning...'
                          : language === 'ta'
                            ? 'வாட்ச் இணை (Optional)'
                            : 'Connect Bluetooth Watch'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 min-h-[40px] cursor-pointer"
                    >
                      Disconnect Watch
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {btError && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
              {btError}
            </p>
          )}
        </div>

        {/* Live / Manual Watch Vitals Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
              <HeartPulse className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Heart Rate (bpm)</span>
            </label>
            <input
              type="number"
              min={25}
              max={260}
              value={heartRateInput}
              onChange={(e) => setHeartRateInput(e.target.value)}
              placeholder="72"
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-blue-500" />
              <span>SpO2 (%)</span>
            </label>
            <input
              type="number"
              min={50}
              max={100}
              value={spo2Input}
              onChange={(e) => setSpo2Input(e.target.value)}
              placeholder="98"
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>BP Sys</span>
            </label>
            <input
              type="number"
              min={30}
              max={350}
              value={sysInput}
              onChange={(e) => setSysInput(e.target.value)}
              placeholder="120"
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">BP Dia</label>
            <input
              type="number"
              min={20}
              max={250}
              value={diaInput}
              onChange={(e) => setDiaInput(e.target.value)}
              placeholder="80"
              className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono tabular-nums"
            />
          </div>
        </div>

        {/* Instant Clinical Threshold Check */}
        {hasAnyReading && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-start gap-2.5 ${
              hasHealthIssueFlag
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {hasHealthIssueFlag ? (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-semibold">
                {hasHealthIssueFlag
                  ? language === 'ta'
                    ? 'கவனிக்க வேண்டிய வாட்ச் அளவு கண்டறியப்பட்டது'
                    : 'Watch reading outside standard resting range'
                  : language === 'ta'
                    ? 'வாட்ச் அளவுகள் இயல்பான வரம்பில் உள்ளன'
                    : 'Watch vitals are within normal resting range'}
              </p>
              <p className="opacity-85">
                {hrVal ? `HR: ${hrVal} bpm (${hrStatus}) · ` : ''}
                {spo2Val ? `SpO2: ${spo2Val}% (${spo2Status}) · ` : ''}
                {sysVal && diaVal ? `BP: ${sysVal}/${diaVal} (${bpStatus})` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={saving || !hasAnyReading}
            onClick={() => void handleSaveToVault()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            <span>{saving ? 'Saving...' : language === 'ta' ? 'Vault-ல் சேமி' : 'Save to Health Vault'}</span>
          </button>

          <button
            type="button"
            disabled={aiChecking || !hasAnyReading}
            onClick={() => void handleCheckWithAI()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            {aiChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-400" />}
            <span>
              {aiChecking
                ? language === 'ta'
                  ? 'AI ஆய்வு செய்கிறது...'
                  : 'Checking with AI...'
                : language === 'ta'
                  ? 'AI மூலம் உடல்நலம் சரிபார்'
                  : 'Check Health Issues with AI'}
            </span>
          </button>
        </div>

        {/* Grounded AI Health Issue Check Result */}
        {aiReport && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Watch Assessment (Google Search Grounded)</span>
            </p>
            <div className="text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed">
              {aiReport.answer}
            </div>
            {aiReport.sources.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Verified Sources
                </p>
                <div className="flex flex-wrap gap-2">
                  {aiReport.sources.map((src, idx) => (
                    <a
                      key={`${src.uri}-${idx}`}
                      href={src.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-white border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 max-w-full"
                    >
                      <span className="truncate max-w-[200px]">{src.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
