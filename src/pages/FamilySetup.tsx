import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { useFamily } from '../hooks/useFamily';
import type { BloodGroup, Gender } from '../types/health';
import { getInitials } from '../utils/helpers';
import { getT } from '../utils/i18n';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const ALLERGY_OPTIONS = ['None', 'Peanut', 'Dust', 'Penicillin', 'Dairy', 'Shellfish'];
const CONDITION_OPTIONS = ['None', 'Diabetes', 'BP', 'Asthma', 'Thyroid', 'Heart', 'Kidney'];

type SetupMode = 'choose' | 'create' | 'join' | 'created';

interface DraftMember {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  bloodGroup: BloodGroup;
  allergies: string[];
  conditions: string[];
}

export default function FamilySetup() {
  const {
    user,
    family,
    language,
    setLanguage,
    logout,
    saveFamilySetup,
    lookupInviteCode,
    joinFamilyWithCode,
  } = useFamily();
  const navigate = useNavigate();
  const t = getT(language);

  const [mode, setMode] = useState<SetupMode>('choose');
  const isSubmittingRef = useRef(false);

  // Create Family state
  const [familyName, setFamilyName] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('+91 ');
  const [membersList, setMembersList] = useState<DraftMember[]>([]);
  const [createdResult, setCreatedResult] = useState<{
    familyName: string;
    inviteCode: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Member fields (shared cleanly between Create & Join flows)
  const [name, setName] = useState(() => user?.displayName ?? '');
  const [age, setAge] = useState('32');
  const [gender, setGender] = useState<Gender>('M');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [allergies, setAllergies] = useState<string[]>(['None']);
  const [conditions, setConditions] = useState<string[]>(['None']);
  const [saving, setSaving] = useState(false);

  // Join Family state
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifiedInvite, setVerifiedInvite] = useState<{
    code: string;
    familyId: string;
    familyName: string;
  } | null>(null);
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    if (user?.displayName && !name && mode !== 'create') {
      setName(user.displayName);
    }
  }, [user?.displayName, name, mode]);

  // If user already belongs to a family and didn't just create one, take them to Dashboard
  useEffect(() => {
    if (family && !isSubmittingRef.current && mode !== 'created' && !createdResult) {
      navigate('/dashboard', { replace: true });
    }
  }, [family, mode, createdResult, navigate]);

  const resetMemberForm = (prefillName = '') => {
    setName(prefillName);
    setAge('30');
    setGender('M');
    setBloodGroup('O+');
    setAllergies(['None']);
    setConditions(['None']);
  };

  const toggleTag = (current: string[], setFn: (v: string[]) => void, value: string) => {
    if (value === 'None') {
      setFn(['None']);
      return;
    }
    const withoutNone = current.filter((item) => item !== 'None');
    if (withoutNone.includes(value)) {
      const next = withoutNone.filter((item) => item !== value);
      setFn(next.length > 0 ? next : ['None']);
    } else {
      setFn([...withoutNone, value]);
    }
  };

  const handleAddMemberToList = () => {
    if (!name.trim()) {
      toast.error(language === 'ta' ? 'உறுப்பினர் பெயரை உள்ளிடவும்' : 'Please enter member name');
      return;
    }
    const numericAge = Number(age);
    if (Number.isNaN(numericAge) || numericAge < 0 || numericAge > 120) {
      toast.error(language === 'ta' ? 'சரியான வயதை உள்ளிடவும்' : 'Please enter a valid age');
      return;
    }

    setMembersList((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        age: numericAge,
        gender,
        bloodGroup,
        allergies,
        conditions,
      },
    ]);

    resetMemberForm('');
    toast.success(language === 'ta' ? 'உறுப்பினர் சேர்க்கப்பட்டார்' : 'Member added to list');
  };

  const handleRegisterFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim()) {
      toast.error(language === 'ta' ? 'குடும்பத்தின் பெயரை உள்ளிடவும்' : 'Please enter your family name');
      return;
    }

    const finalMembers: DraftMember[] = [...membersList];
    if (name.trim()) {
      const numericAge = Number(age);
      if (Number.isNaN(numericAge) || numericAge < 0 || numericAge > 120) {
        toast.error(language === 'ta' ? 'சரியான வயதை உள்ளிடவும்' : 'Please enter a valid age');
        return;
      }
      finalMembers.push({
        id: `${Date.now()}-self`,
        name: name.trim(),
        age: numericAge,
        gender,
        bloodGroup,
        allergies,
        conditions,
      });
    }

    if (finalMembers.length === 0) {
      toast.error(t.setup.needOneMember);
      return;
    }

    setSaving(true);
    isSubmittingRef.current = true;
    try {
      const cleanFamName = familyName.trim();
      const result = await saveFamilySetup({
        familyName: cleanFamName,
        emergencyContact: emergencyContact.trim(),
        members: finalMembers,
      });
      setCreatedResult({
        familyName: cleanFamName,
        inviteCode: result.inviteCode,
      });
      setMode('created');
      toast.success(
        language === 'ta'
          ? 'குடும்பம் உருவாக்கப்பட்டது! உங்கள் குடும்பக் குறியீடு தயார்.'
          : 'Family registered! Share your invite code with family members.'
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to register family');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  const handleVerifyInviteCode = async (rawCode?: string) => {
    const targetCode = (rawCode ?? inviteCodeInput).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCodeError('');
    if (targetCode.length < 6) {
      setVerifiedInvite(null);
      setCodeError(
        language === 'ta'
          ? 'சரியான 8 எழுத்து குடும்பக் குறியீட்டை உள்ளிடவும்'
          : 'Enter a valid 6–12 character Family Invite Code'
      );
      return null;
    }

    setVerifyingCode(true);
    try {
      const found = await lookupInviteCode(targetCode);
      if (!found) {
        setVerifiedInvite(null);
        setCodeError(
          language === 'ta'
            ? 'இந்த குடும்பக் குறியீடு தவறானது அல்லது காலாவதியானது.'
            : 'Family Invite Code not found. Please check the code and try again.'
        );
        return null;
      }
      setVerifiedInvite(found);
      return found;
    } catch (err: unknown) {
      setVerifiedInvite(null);
      setCodeError(err instanceof Error ? err.message : 'Could not verify code');
      return null;
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = inviteCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanedCode.length < 6) {
      setCodeError(
        language === 'ta'
          ? 'சரியான குடும்பக் குறியீட்டை உள்ளிடவும்'
          : 'Please enter a valid Family Invite Code'
      );
      return;
    }

    if (!name.trim()) {
      toast.error(language === 'ta' ? 'உங்கள் பெயரை உள்ளிடவும்' : 'Please enter your full name');
      return;
    }
    const numericAge = Number(age);
    if (Number.isNaN(numericAge) || numericAge < 0 || numericAge > 120) {
      toast.error(language === 'ta' ? 'சரியான வயதை உள்ளிடவும்' : 'Please enter a valid age');
      return;
    }

    setSaving(true);
    isSubmittingRef.current = true;
    try {
      const invite = verifiedInvite?.code === cleanedCode ? verifiedInvite : await handleVerifyInviteCode(cleanedCode);
      if (!invite) {
        setSaving(false);
        isSubmittingRef.current = false;
        return;
      }

      const joined = await joinFamilyWithCode({
        code: cleanedCode,
        member: {
          name: name.trim(),
          age: numericAge,
          gender,
          bloodGroup,
          allergies,
          conditions,
        },
      });
      toast.success(
        language === 'ta'
          ? `${joined.familyName} குடும்பத்தில் வெற்றிகரமாக இணைந்தீர்கள்!`
          : `Welcome to ${joined.familyName}!`
      );
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to join family');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  const copyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast.success(language === 'ta' ? 'குறியீடு நகலெடுக்கப்பட்டது!' : 'Invite code copied!');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Unable to copy code');
    }
  };

  const whatsappShareUrl = createdResult
    ? `https://wa.me/?text=${encodeURIComponent(
        `Join our "${createdResult.familyName}" health vault on Rabbit Mediko!\n\nFamily Invite Code: *${createdResult.inviteCode}*\n\nSign in with Google, select "Join Existing Family", and enter this code.`
      )}`
    : '#';

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#F8FAFC] py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="md" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                {language === 'ta' ? 'குடும்ப அமைப்பு · Rabbit Mediko' : 'Family Setup · Rabbit Mediko'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                {user?.email
                  ? language === 'ta'
                    ? `சரிபார்க்கப்பட்ட கணக்கு: ${user.email}`
                    : `Signed in as ${user.email}`
                  : t.setup.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => void setLanguage('en')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
                  language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => void setLanguage('ta')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
                  language === 'ta' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                தமிழ்
              </button>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.settings.logout}</span>
            </button>
          </div>
        </div>

        {/* Mode 1: Choose Create New Family or Join Existing Family */}
        {mode === 'choose' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto pt-4 space-y-6"
          >
            <div className="text-center space-y-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {language === 'ta' ? 'Google கணக்கு சரிபார்க்கப்பட்டது' : 'Google Account Verified'}
                </span>
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                {language === 'ta'
                  ? 'புதிய குடும்பத்தை உருவாக்கவும் அல்லது இணையவும்'
                  : 'Create a New Family or Join an Existing One'}
              </h2>
              <p className="text-sm text-slate-600 max-w-xl mx-auto">
                {language === 'ta'
                  ? 'புதிய குடும்பம் தொடங்கினால் ஒரு குடும்பக் குறியீடு கிடைக்கும். ஏற்கனவே குடும்பக் குறியீடு இருந்தால் அதைப் பயன்படுத்தி உடனே சேரலாம்.'
                  : 'Start a new family workspace to receive a shareable invite code, or enter a family code to join with your personal profile.'}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => {
                  resetMemberForm(user?.displayName ?? '');
                  setMembersList([]);
                  setMode('create');
                }}
                className="group text-left bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all space-y-4 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Users className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-slate-900">
                    {language === 'ta' ? 'புதிய குடும்பம் உருவாக்கு' : 'Create New Family'}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {language === 'ta'
                      ? 'குடும்பப் பெயர் & உறுப்பினர் விவரங்களைப் பதிவு செய்து குடும்பக் குறியீட்டைப் பெறுங்கள்.'
                      : 'Register your family details & members and generate a unique invite code.'}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                  <span>{language === 'ta' ? 'தொடங்கவும்' : 'Get Started'}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetMemberForm(user?.displayName ?? '');
                  setInviteCodeInput('');
                  setVerifiedInvite(null);
                  setCodeError('');
                  setMode('join');
                }}
                className="group text-left bg-white border-2 border-slate-200 hover:border-blue-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all space-y-4 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-slate-900">
                    {language === 'ta' ? 'குடும்பத்தில் சேரு (Code)' : 'Join Existing Family'}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {language === 'ta'
                      ? 'குடும்பக் குறியீட்டை உள்ளிட்டு உங்கள் பெயர் & உடல்நல விவரங்களுடன் உள்ளே செல்லுங்கள்.'
                      : 'Enter a Family Invite Code along with your name & health profile to enter.'}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                  <span>{language === 'ta' ? 'குறியீட்டுடன் சேர்' : 'Join with Code'}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {/* Mode 2: Create New Family & Register */}
        {mode === 'create' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{language === 'ta' ? 'திரும்பிச் செல்' : 'Back to options'}</span>
            </button>

            <form onSubmit={handleRegisterFamily} className="grid lg:grid-cols-12 gap-6 items-start">
              {/* Left Form */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6"
              >
                <div className="grid sm:grid-cols-2 gap-4 pb-5 border-b border-slate-100">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      {t.setup.familyNameLabel} *
                    </label>
                    <input
                      type="text"
                      required
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder={t.setup.familyNamePlaceholder}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      {t.setup.emergencyContactLabel}
                    </label>
                    <input
                      type="tel"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder={t.setup.emergencyContactPlaceholder}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    <span>{t.setup.addMemberTitle}</span>
                  </h2>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">
                        {t.setup.nameLabel} {membersList.length === 0 ? '*' : ''}
                      </label>
                      <input
                        type="text"
                        required={membersList.length === 0}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ramesh"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-700">{t.setup.ageLabel}</label>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-700">{t.setup.genderLabel}</label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value as Gender)}
                          className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        >
                          <option value="M">M</option>
                          <option value="F">F</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-700">{t.setup.bloodGroupLabel}</label>
                        <select
                          value={bloodGroup}
                          onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                          className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        >
                          {BLOOD_GROUPS.map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-slate-700">{t.setup.allergiesLabel}</span>
                    <div className="flex flex-wrap gap-2">
                      {ALLERGY_OPTIONS.map((tag) => {
                        const active = allergies.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(allergies, setAllergies, tag)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors min-h-[36px] cursor-pointer ${
                              active
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                            <span>{tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-slate-700">{t.setup.conditionsLabel}</span>
                    <div className="flex flex-wrap gap-2">
                      {CONDITION_OPTIONS.map((tag) => {
                        const active = conditions.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(conditions, setConditions, tag)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors min-h-[36px] cursor-pointer ${
                              active
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                            <span>{tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddMemberToList}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors min-h-[44px] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t.setup.addMemberBtn}</span>
                  </button>
                </div>
              </motion.div>

              {/* Right Added Members List & Register CTA */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">{t.setup.membersAdded}</h2>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {membersList.length + (name.trim() ? 1 : 0)} total
                  </span>
                </div>

                {membersList.length === 0 && !name.trim() ? (
                  <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-xl">
                    {t.setup.needOneMember}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {membersList.map((m) => (
                      <div key={m.id} className="py-3.5 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 font-semibold text-sm flex items-center justify-center shrink-0">
                            {getInitials(m.name)}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                            <p className="text-xs text-slate-500">
                              {m.age} yrs · {m.gender} · Blood {m.bloodGroup}
                            </p>
                            <p className="text-xs text-slate-600">
                              Conditions: {m.conditions.join(', ')} · Allergies: {m.allergies.join(', ')}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMembersList((prev) => prev.filter((item) => item.id !== m.id))}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 cursor-pointer"
                          aria-label={`Remove ${m.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {name.trim() && (
                      <div className="py-3.5 flex items-start gap-3 bg-emerald-50/40 rounded-xl px-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-semibold text-sm flex items-center justify-center shrink-0">
                          {getInitials(name)}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-slate-900">
                            {name.trim()} <span className="text-xs font-normal text-emerald-700">(Ready)</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            {age || 0} yrs · {gender} · Blood {bloodGroup}
                          </p>
                          <p className="text-xs text-slate-600">
                            Conditions: {conditions.join(', ')} · Allergies: {allergies.join(', ')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || (!name.trim() && membersList.length === 0)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors min-h-[48px] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{language === 'ta' ? 'பதிவு செய்கிறது...' : 'Registering Family...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {language === 'ta' ? 'குடும்பத்தை பதிவு செய்து குறியீடு பெறு' : 'Register Family & Get Code'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Mode 3: Family Created — Show Generated Invite Code */}
        {mode === 'created' && createdResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-6"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-slate-900">
                {language === 'ta'
                  ? `${createdResult.familyName} தயாராக உள்ளது!`
                  : `${createdResult.familyName} is Ready!`}
              </h2>
              <p className="text-sm text-slate-600">
                {language === 'ta'
                  ? 'மற்ற குடும்ப உறுப்பினர்கள் "குடும்பத்தில் சேரு" வழியாக இணைய இந்தக் குறியீட்டைப் பகிரவும்.'
                  : 'Share this unique invite code so other family members can join with their own Google account.'}
              </p>
            </div>

            <div className="bg-emerald-50/70 border-2 border-dashed border-emerald-300 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                {language === 'ta' ? 'உங்கள் குடும்ப அழைப்பு குறியீடு' : 'Family Invite Code'}
              </p>
              <p className="text-3xl sm:text-4xl font-mono font-bold tracking-[0.2em] text-slate-900 select-all">
                {createdResult.inviteCode}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => void copyInviteCode(createdResult.inviteCode)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? (language === 'ta' ? 'நகலெடுக்கப்பட்டது' : 'Copied') : (language === 'ta' ? 'குறியீட்டை நகலெடு' : 'Copy Code')}</span>
                </button>
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{language === 'ta' ? 'WhatsApp-ல் பகிர்' : 'Share on WhatsApp'}</span>
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors min-h-[48px] inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t.setup.continueBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Mode 4: Join Existing Family with Invite Code & Member Details */}
        {mode === 'join' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{language === 'ta' ? 'திரும்பிச் செல்' : 'Back to options'}</span>
            </button>

            <motion.form
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleJoinFamily}
              className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6"
            >
              {/* Invite Code Verification Box */}
              <div className="space-y-3 pb-5 border-b border-slate-100">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-blue-600" />
                    <span>
                      {language === 'ta' ? '1. குடும்பக் குறியீட்டை உள்ளிடவும்' : '1. Enter Family Invite Code'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    {language === 'ta'
                      ? 'குடும்பத்தை உருவாக்கியவரிடமிருந்து பெற்ற 8-எழுத்து குறியீட்டை உள்ளிடவும்.'
                      : 'Ask your family creator for the 8-character invite code (e.g. RM7K4P2N).'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={inviteCodeInput}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      setInviteCodeInput(val);
                      setCodeError('');
                      if (verifiedInvite && verifiedInvite.code !== val) {
                        setVerifiedInvite(null);
                      }
                      if (val.length === 8) {
                        void handleVerifyInviteCode(val);
                      }
                    }}
                    placeholder="RM7K4P2N"
                    className="w-full min-w-0 flex-1 px-4 py-3 rounded-xl border border-slate-200 text-base font-mono font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
                  />
                  <button
                    type="button"
                    disabled={verifyingCode || inviteCodeInput.trim().length < 6}
                    onClick={() => void handleVerifyInviteCode()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 min-h-[46px] cursor-pointer"
                  >
                    {verifyingCode ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span>{language === 'ta' ? 'சரிபார்' : 'Verify Code'}</span>
                  </button>
                </div>

                {verifiedInvite && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {language === 'ta'
                        ? `சரிபார்க்கப்பட்ட குடும்பம்: ${verifiedInvite.familyName}`
                        : `Verified Family: ${verifiedInvite.familyName}`}
                    </span>
                  </div>
                )}

                {codeError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
                    {codeError}
                  </div>
                )}
              </div>

              {/* Personal Member Details */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                  <span>
                    {language === 'ta' ? '2. உங்கள் சுய விவரங்கள்' : '2. Your Profile Details'}
                  </span>
                </h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">{t.setup.nameLabel} *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Priya"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">{t.setup.ageLabel}</label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">{t.setup.genderLabel}</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as Gender)}
                        className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      >
                        <option value="M">M</option>
                        <option value="F">F</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-700">{t.setup.bloodGroupLabel}</label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                        className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      >
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg} value={bg}>
                            {bg}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-medium text-slate-700">{t.setup.allergiesLabel}</span>
                  <div className="flex flex-wrap gap-2">
                    {ALLERGY_OPTIONS.map((tag) => {
                      const active = allergies.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(allergies, setAllergies, tag)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors min-h-[36px] cursor-pointer ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-medium text-slate-700">{t.setup.conditionsLabel}</span>
                  <div className="flex flex-wrap gap-2">
                    {CONDITION_OPTIONS.map((tag) => {
                      const active = conditions.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(conditions, setConditions, tag)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors min-h-[36px] cursor-pointer ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || inviteCodeInput.trim().length < 6 || !name.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors min-h-[48px] inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{language === 'ta' ? 'குடும்பத்தில் இணைகிறது...' : 'Joining Family...'}</span>
                  </>
                ) : (
                  <>
                    <span>{language === 'ta' ? 'குடும்பத்தில் சேர்ந்து உள்ளே செல்' : 'Join Family & Enter App'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.form>
          </div>
        )}
      </div>
    </div>
  );
}
