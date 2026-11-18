import React, { useEffect, useState } from 'react';
import { Bell, Globe, LogOut, Save, Trash2, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/BottomNav';
import { useFamily } from '../hooks/useFamily';
import type { BloodGroup, Gender } from '../types/health';
import { getT } from '../utils/i18n';

export default function Settings() {
  const {
    family,
    language,
    setLanguage,
    updateFamilyDetails,
    addFamilyMember,
    logout,
    deleteFamilyWorkspace,
  } = useFamily();
  const navigate = useNavigate();
  const t = getT(language);

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
      toast.success('Family member added!');
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
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6 max-w-4xl"
      >
        <h1 className="text-2xl font-bold text-slate-900">{t.settings.title}</h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Family Profile Edit */}
          <form
            onSubmit={handleSaveFamily}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">{t.settings.familyName}</h2>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">{t.settings.familyName}</label>
              <input
                type="text"
                required
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">{t.settings.emergencyContact}</label>
              <input
                type="tel"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 min-h-[44px] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{t.settings.saveFamily}</span>
            </button>
          </form>

          {/* Language & Notifications */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="space-y-2.5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>{t.settings.language}</span>
              </h2>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => void setLanguage('en')}
                  className={`py-2.5 text-sm font-semibold rounded-lg cursor-pointer ${
                    language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => void setLanguage('ta')}
                  className={`py-2.5 text-sm font-semibold rounded-lg cursor-pointer ${
                    language === 'ta' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  தமிழ் (Tamil)
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                <span>{t.settings.notifications}</span>
              </h3>
              <button
                type="button"
                onClick={async () => {
                  if (typeof Notification === 'undefined') return;
                  const res = await Notification.requestPermission();
                  toast.success(`Notification permission: ${res}`);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Request Browser Notification Permission
              </button>
            </div>
          </div>
        </div>

        {/* Add Member Quick Form */}
        <form
          onSubmit={handleAddMember}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-600" />
            <span>Add Another Family Member</span>
          </h2>
          <div className="grid sm:grid-cols-5 gap-3">
            <input
              type="text"
              required
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Name"
              className="sm:col-span-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <input
              type="number"
              min={0}
              max={120}
              value={memberAge}
              onChange={(e) => setMemberAge(e.target.value)}
              placeholder="Age"
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
            />
            <select
              value={memberGender}
              onChange={(e) => setMemberGender(e.target.value as Gender)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="Other">Other</option>
            </select>
            <select
              value={memberBlood}
              onChange={(e) => setMemberBlood(e.target.value as BloodGroup)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono bg-white"
            >
              {(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as BloodGroup[]).map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              value={memberConditions}
              onChange={(e) => setMemberConditions(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
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
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 min-h-[44px] cursor-pointer"
            >
              Add Member
            </button>
          </div>
        </form>

        {/* Account & Danger Zone */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-4">
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

          <div className="bg-red-50/50 border border-red-200 rounded-2xl p-6 space-y-3">
            <h2 className="text-base font-bold text-red-900">{t.settings.deleteFamily}</h2>
            <p className="text-xs text-red-700">{t.settings.deleteConfirm}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="Type DELETE"
                className="flex-1 px-3 py-2 rounded-xl border border-red-200 bg-white text-sm font-mono"
              />
              <button
                type="button"
                disabled={deleting || deleteText.trim() !== 'DELETE'}
                onClick={() => void handleDeleteWorkspace()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
