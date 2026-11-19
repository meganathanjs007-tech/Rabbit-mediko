import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellRing,
  Check,
  Copy,
  Globe,
  KeyRound,
  LogOut,
  MessageCircle,
  RefreshCw,
  Save,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/BottomNav';
import { useFamily } from '../hooks/useFamily';
import { getFriendlyFirebaseError } from '../services/firebase';
import type { BloodGroup, Gender } from '../types/health';
import { getT } from '../utils/i18n';
import {
  getNotificationPermission,
  requestAppNotificationPermission,
  showMedicineNotification,
  type AppNotificationPermission,
} from '../utils/notifications';

export default function Settings() {
  const {
    user,
    family,
    language,
    setLanguage,
    updateFamilyDetails,
    ensureInviteCode,
    leaveFamily,
    addFamilyMember,
    logout,
    deleteFamilyWorkspace,
  } = useFamily();
  const navigate = useNavigate();
  const t = getT(language);
  const isCreator = Boolean(user && family && user.uid === family.createdBy);

  const [familyName, setFamilyName] = useState(family?.familyName ?? '');
  const [emergencyContact, setEmergencyContact] = useState(family?.emergencyContact ?? '');
  const [saving, setSaving] = useState(false);

  const [memberName, setMemberName] = useState('');
  const [memberAge, setMemberAge] = useState('30');
  const [memberGender, setMemberGender] = useState<Gender>('M');
  const [memberBlood, setMemberBlood] = useState<BloodGroup>('O+');
  const [memberConditions, setMemberConditions] = useState('None');

  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [rotatingCode, setRotatingCode] = useState(false);
  const [notifPermission, setNotifPermission] = useState<AppNotificationPermission>(() =>
    getNotificationPermission()
  );

  useEffect(() => {
    if (family) {
      setFamilyName(family.familyName);
      setEmergencyContact(family.emergencyContact ?? '');
    }
  }, [family]);

  const handleSaveFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim()) return;
    setSaving(true);
    try {
      await updateFamilyDetails(familyName, emergencyContact);
      toast.success(language === 'ta' ? 'குடும்ப விவரம் புதுப்பிக்கப்பட்டது' : 'Family details updated!');
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;
    setSaving(true);
    try {
      await addFamilyMember({
        name: memberName,
        age: Number(memberAge) || 30,
        gender: memberGender,
        bloodGroup: memberBlood,
        allergies: ['None'],
        conditions: [memberConditions],
      });
      setMemberName('');
      toast.success(language === 'ta' ? 'குடும்ப உறுப்பினர் சேர்க்கப்பட்டார்!' : 'Family member added!');
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (deleteText.trim() !== 'DELETE') {
      toast.error(t.settings.deleteConfirm);
      return;
    }
    setDeleting(true);
    try {
      await deleteFamilyWorkspace();
      toast.success('Family workspace deleted.');
      navigate('/setup', { replace: true });
    } catch (err) {
      toast.error(getFriendlyFirebaseError(err, language));
    } finally {
      setDeleting(false);
    }
  };

  const handleEnableNotifications = async () => {
    const perm = await requestAppNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      toast.success(t.medicines.notificationsEnabled);
      await showMedicineNotification({
        title: 'Rabbit Mediko',
        body:
          language === 'ta'
            ? 'மருந்து நினைவூட்டல்கள் இப்போது இயங்குகின்றன!'
            : 'Medicine reminders are now active!',
        tag: 'rm-test-welcome',
        url: '/medicines',
        withToast: false,
      });
    } else if (perm === 'denied') {
      toast.error(
        language === 'ta'
          ? 'உலாவி அமைப்புகளில் Notifications தடுக்கப்பட்டுள்ளது.'
          : 'Notifications are blocked in your browser site settings.'
      );
    } else if (perm === 'unsupported') {
      toast.error('Browser notifications are unavailable here; in-app sound & banners remain active.');
    }
  };

  const handleTestNotification = async () => {
    const res = await showMedicineNotification({
      title: 'Rabbit Mediko · Reminder Test',
      body:
        language === 'ta'
          ? 'மருந்து நினைவூட்டல் சரியாக வேலை செய்கிறது!'
          : 'Medicine reminder alert is working properly!',
      tag: `rm-test-${Date.now()}`,
      url: '/medicines',
      withToast: true,
    });
    if (!res.deliveredOs && notifPermission !== 'granted') {
      toast('Tip: Tap "Enable Alerts" to also receive OS/lock-screen notifications.', { duration: 4000 });
    }
  };

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full min-w-0 max-w-5xl mx-auto space-y-5 sm:space-y-6"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">{t.settings.title}</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {language === 'ta'
              ? 'குடும்ப விவரங்கள், மொழி, அறிவிப்புகள் மற்றும் செயலி நிறுவல்'
              : 'Manage family details, invite code, language, alerts, and app installation.'}
          </p>
        </div>

        {/* Family Invite Code Card */}
        {family && (
          <section className="w-full min-w-0 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{language === 'ta' ? 'குடும்ப அழைப்பு குறியீடு' : 'Family Invite Code'}</span>
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {language === 'ta'
                  ? 'மற்ற குடும்ப உறுப்பினர்கள் இந்தக் குறியீட்டைப் பயன்படுத்தி உங்கள் குடும்பத்தில் சேரலாம்.'
                  : 'Share this code with family members so they can join after signing in with Google.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {family.inviteCode ? (
                <>
                  <span className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm sm:text-base font-mono font-bold tracking-widest text-emerald-900 select-all">
                    {family.inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(family.inviteCode!);
                        setCopiedCode(true);
                        toast.success(language === 'ta' ? 'குறியீடு நகலெடுக்கப்பட்டது!' : 'Invite code copied!');
                        setTimeout(() => setCopiedCode(false), 2000);
                      } catch {
                        toast.error('Failed to copy code');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[40px] cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Join our "${family.familyName}" health vault on Rabbit Mediko!\n\nFamily Invite Code: *${family.inviteCode}*`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 min-h-[40px]"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </>
              ) : (
                <span className="text-xs text-slate-500">
                  {language === 'ta' ? 'இன்னும் குறியீடு உருவாக்கப்படவில்லை' : 'No invite code generated yet'}
                </span>
              )}

              {isCreator && (
                <button
                  type="button"
                  disabled={rotatingCode}
                  onClick={async () => {
                    setRotatingCode(true);
                    try {
                      const code = await ensureInviteCode(true);
                      if (code) {
                        toast.success(
                          language === 'ta'
                            ? `புதிய குடும்பக் குறியீடு: ${code}`
                            : `New invite code generated: ${code}`
                        );
                      }
                    } catch (err) {
                      toast.error(getFriendlyFirebaseError(err, language));
                    } finally {
                      setRotatingCode(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-h-[40px] cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rotatingCode ? 'animate-spin' : ''}`} />
                  <span>{family.inviteCode ? (language === 'ta' ? 'புதிய குறியீடு' : 'Regenerate') : 'Generate Code'}</span>
                </button>
              )}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {/* Family Profile Edit */}
          <form
            onSubmit={handleSaveFamily}
            className="w-full min-w-0 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">{t.settings.familyName}</h2>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">{t.settings.familyName}</label>
              <input
                type="text"
                required
                disabled={!isCreator}
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="w-full min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">{t.settings.emergencyContact}</label>
              <input
                type="tel"
                disabled={!isCreator}
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                className="w-full min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
              />
            </div>
            {isCreator ? (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 min-h-[44px] cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{t.settings.saveFamily}</span>
              </button>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                {language === 'ta'
                  ? 'குடும்பப் பெயர் மற்றும் முதன்மை அவசர எண்ணை குடும்ப உருவாக்குநர் மட்டுமே மாற்ற முடியும்.'
                  : 'Only the family creator can edit the family name and primary emergency contact.'}
              </p>
            )}
          </form>

          {/* Language & Notifications */}
          <div className="w-full min-w-0 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
            <div className="space-y-2.5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t.settings.language}</span>
              </h2>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => void setLanguage('en')}
                  className={`py-2.5 text-sm font-semibold rounded-lg cursor-pointer transition-colors ${
                    language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => void setLanguage('ta')}
                  className={`py-2.5 text-sm font-semibold rounded-lg cursor-pointer transition-colors ${
                    language === 'ta' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  தமிழ் (Tamil)
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  {notifPermission === 'granted' ? (
                    <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Bell className="w-4 h-4 text-blue-600 shrink-0" />
                  )}
                  <span>{t.settings.notifications}</span>
                </h3>
                <span
                  className={`text-xs font-semibold ${
                    notifPermission === 'granted'
                      ? 'text-emerald-700'
                      : notifPermission === 'denied'
                        ? 'text-red-600'
                        : 'text-slate-500'
                  }`}
                >
                  {notifPermission === 'granted'
                    ? 'Active'
                    : notifPermission === 'denied'
                      ? 'Blocked'
                      : 'Off'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleEnableNotifications()}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 min-h-[42px] cursor-pointer"
                >
                  {notifPermission === 'granted'
                    ? t.medicines.notificationsEnabled
                    : t.medicines.enableNotifications}
                </button>
                <button
                  type="button"
                  onClick={() => void handleTestNotification()}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 min-h-[42px] cursor-pointer"
                >
                  {language === 'ta' ? 'சோதனை அறிவிப்பு அனுப்பு' : 'Send Test Notification'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add Member Quick Form */}
        <form
          onSubmit={handleAddMember}
          className="w-full min-w-0 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Add Another Family Member</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <input
              type="text"
              required
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Name"
              className="sm:col-span-2 w-full min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <input
              type="number"
              min={0}
              max={120}
              value={memberAge}
              onChange={(e) => setMemberAge(e.target.value)}
              placeholder="Age"
              className="w-full min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
            />
            <select
              value={memberGender}
              onChange={(e) => setMemberGender(e.target.value as Gender)}
              className="w-full min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="Other">Other</option>
            </select>
            <select
              value={memberBlood}
              onChange={(e) => setMemberBlood(e.target.value as BloodGroup)}
              className="w-full min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono bg-white"
            >
              {(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as BloodGroup[]).map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <select
              value={memberConditions}
              onChange={(e) => setMemberConditions(e.target.value)}
              className="w-full sm:w-auto min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="None">Condition: None</option>
              <option value="Diabetes">Condition: Diabetes</option>
              <option value="BP">Condition: BP</option>
              <option value="Thyroid">Condition: Thyroid</option>
              <option value="Heart">Condition: Heart</option>
              <option value="Asthma">Condition: Asthma</option>
              <option value="Kidney">Condition: Kidney</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 min-h-[44px] cursor-pointer"
            >
              Add Member
            </button>
          </div>
        </form>

        {/* Account & Danger Zone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          <div className="w-full min-w-0 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">Account</h2>
              <p className="text-sm text-slate-600">Sign out of your Rabbit Mediko session on this device.</p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 min-h-[44px] cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.settings.logout}</span>
              </button>
            </div>
          </div>

          {isCreator ? (
            <div className="w-full min-w-0 bg-red-50/50 border border-red-200 rounded-2xl p-4 sm:p-6 space-y-3">
              <h2 className="text-base font-bold text-red-900">{t.settings.deleteFamily}</h2>
              <p className="text-xs text-red-700">{t.settings.deleteConfirm}</p>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full min-w-0 flex-1 px-3 py-2.5 rounded-xl border border-red-200 bg-white text-sm font-mono"
                />
                <button
                  type="button"
                  disabled={deleting || deleteText.trim() !== 'DELETE'}
                  onClick={() => void handleDeleteWorkspace()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 min-h-[44px] shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full min-w-0 bg-amber-50/60 border border-amber-200 rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-amber-950">
                  {language === 'ta' ? 'குடும்பத்திலிருந்து வெளியேறு' : 'Leave Family'}
                </h2>
                <p className="text-xs text-amber-800">
                  {language === 'ta'
                    ? 'நீங்கள் இந்த குடும்பத்திலிருந்து வெளியேறி புதிய குடும்பத்தை உருவாக்கலாம் அல்லது வேறொன்றில் சேரலாம்.'
                    : 'Disconnect your account from this family so you can create or join another family.'}
                </p>
              </div>
              <div>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await leaveFamily();
                      toast.success(language === 'ta' ? 'குடும்பத்திலிருந்து வெளியேறினீர்கள்' : 'Left family workspace');
                      navigate('/setup', { replace: true });
                    } catch (err) {
                      toast.error(getFriendlyFirebaseError(err, language));
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 min-h-[44px] cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{language === 'ta' ? 'வெளியேறு' : 'Leave Family'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AppShell>
  );
}
