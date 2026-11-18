import React, { useState } from 'react';
import { Check, HeartPulse, Plus, Trash2, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useFamily } from '../hooks/useFamily';
import type { BloodGroup, Gender } from '../types/health';
import { getInitials } from '../utils/helpers';
import { getT } from '../utils/i18n';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const ALLERGY_OPTIONS = ['None', 'Peanut', 'Dust', 'Penicillin', 'Dairy', 'Shellfish'];
const CONDITION_OPTIONS = ['None', 'Diabetes', 'BP', 'Asthma', 'Thyroid', 'Heart', 'Kidney'];

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
  const { language, setLanguage, saveFamilySetup } = useFamily();
  const navigate = useNavigate();
  const t = getT(language);

  const [familyName, setFamilyName] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('+91 ');
  const [membersList, setMembersList] = useState<DraftMember[]>([]);

  const [name, setName] = useState('');
  const [age, setAge] = useState('35');
  const [gender, setGender] = useState<Gender>('M');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [allergies, setAllergies] = useState<string[]>(['None']);
  const [conditions, setConditions] = useState<string[]>(['None']);
  const [saving, setSaving] = useState(false);

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

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
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

    setName('');
    setAge('30');
    setAllergies(['None']);
    setConditions(['None']);
    toast.success(language === 'ta' ? 'உறுப்பினர் சேர்க்கப்பட்டார்' : 'Member added to list');
  };

  const handleContinue = async () => {
    if (membersList.length === 0) {
      toast.error(t.setup.needOneMember);
      return;
    }
    setSaving(true);
    try {
      await saveFamilySetup({
        familyName: familyName.trim() || 'My Family',
        emergencyContact: emergencyContact.trim(),
        members: membersList,
      });
      toast.success(language === 'ta' ? 'குடும்பம் சேமிக்கப்பட்டது!' : 'Family vault created!');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save family');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t.setup.title}</h1>
              <p className="text-sm text-slate-600">{t.setup.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left Form */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6"
          >
            <div className="grid sm:grid-cols-2 gap-4 pb-5 border-b border-slate-100">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">{t.setup.familyNameLabel}</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder={t.setup.familyNamePlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">{t.setup.emergencyContactLabel}</label>
                <input
                  type="tel"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder={t.setup.emergencyContactPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>{t.setup.addMemberTitle}</span>
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">{t.setup.nameLabel} *</label>
                  <input
                    type="text"
                    required
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
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors min-h-[44px] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.setup.addMemberBtn}</span>
              </button>
            </form>
          </motion.div>

          {/* Right Added Members List */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{t.setup.membersAdded}</h2>
              <span className="text-xs font-mono text-slate-500 tabular-nums">{membersList.length} added</span>
            </div>

            {membersList.length === 0 ? (
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
              </div>
            )}

            <button
              type="button"
              disabled={membersList.length === 0 || saving}
              onClick={handleContinue}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors min-h-[48px] cursor-pointer"
            >
              {saving ? 'Saving...' : t.setup.continueBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
