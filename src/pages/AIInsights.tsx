import { useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { BrainCircuit, RefreshCw, Sparkles, Utensils } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { AppShell } from '../components/BottomNav';
import { EmptyState } from '../components/EmptyState';
import { MemberSelector } from '../components/MemberSelector';
import { useFamily } from '../hooks/useFamily';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { fetchHealthInsights } from '../services/gemini';
import { addDaysISO, getTodayISO } from '../utils/helpers';
import { getT } from '../utils/i18n';

export default function AIInsights() {
  const { family, members, healthRecords, medicines, mealPlans, aiInsights, language } = useFamily();
  const t = getT(language);

  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!selectedId && members.length > 0) {
      setSelectedId(members[0].id);
    }
  }, [members, selectedId]);

  const activeMember = members.find((m) => m.id === selectedId) ?? members[0];
  const cachedInsight = activeMember ? aiInsights[activeMember.id] : undefined;

  const runAnalysis = async () => {
    if (!family || !activeMember) return;
    setLoading(true);
    setErrorMsg('');

    const cutoffDate = addDaysISO(getTodayISO(), -30);
    const memberRecords = healthRecords.filter(
      (r) => r.memberId === activeMember.id && r.date >= cutoffDate
    );

    const bpReadings = memberRecords
      .filter((r) => r.type === 'BP')
      .map((r) => ({ date: r.date, value: r.value }));
    const sugarReadings = memberRecords
      .filter((r) => r.type === 'Sugar')
      .map((r) => ({ date: r.date, value: r.value }));

    const recentMeals = Object.values(mealPlans)
      .slice(0, 7)
      .map((p) => ({
        date: p.date,
        breakfast: p.breakfast ?? [],
        lunch: p.lunch ?? [],
        dinner: p.dinner ?? [],
        snacks: p.snacks ?? [],
      }));

    const activeMeds = medicines
      .filter((m) => m.memberId === activeMember.id && m.active)
      .map((m) => ({ name: m.name, dosage: m.dosage, frequency: m.frequency }));

    try {
      const result = await fetchHealthInsights({
        memberName: activeMember.name,
        age: activeMember.age,
        gender: activeMember.gender,
        conditions: activeMember.conditions,
        bpReadings,
        sugarReadings,
        recentMeals,
        activeMedicines: activeMeds,
        language,
      });

      await setDoc(doc(db, 'families', family.id, 'aiInsights', activeMember.id), {
        ownerUid: family.createdBy,
        memberId: activeMember.id,
        analysis: (result.analysis || 'No analysis available').slice(0, 6000),
        foodPatterns: (result.foodPatterns || '').slice(0, 4000),
        language,
        timestamp: serverTimestamp(),
      });

      toast.success(language === 'ta' ? 'AI ஆலோசனை தயார்!' : 'AI health insights updated!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze health data';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
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
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900">{t.insights.title}</h1>
            <p className="text-sm text-slate-600">{t.insights.subtitle}</p>
          </div>
          {activeMember && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void runAnalysis()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 min-h-[44px] whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {loading
                  ? 'Analyzing...'
                  : cachedInsight
                    ? t.insights.reanalyzeBtn
                    : t.insights.analyzeBtn}
              </span>
            </button>
          )}
        </div>

        <MemberSelector
          members={members}
          selectedId={activeMember?.id ?? ''}
          onSelect={(id) => {
            setSelectedId(id);
            setErrorMsg('');
          }}
        />

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-red-800">{errorMsg}</p>
            <button
              type="button"
              onClick={() => void runAnalysis()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t.insights.retry}</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 animate-pulse">
              <div className="h-5 w-48 bg-slate-200 rounded-lg" />
              <div className="h-4 w-full bg-slate-100 rounded-lg" />
              <div className="h-4 w-5/6 bg-slate-100 rounded-lg" />
              <div className="h-4 w-4/5 bg-slate-100 rounded-lg" />
              <div className="h-4 w-2/3 bg-slate-100 rounded-lg" />
            </div>
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 animate-pulse">
              <div className="h-5 w-40 bg-slate-200 rounded-lg" />
              <div className="h-4 w-full bg-slate-100 rounded-lg" />
              <div className="h-4 w-3/4 bg-slate-100 rounded-lg" />
            </div>
          </div>
        ) : !activeMember ? (
          <EmptyState
            icon={<BrainCircuit className="w-6 h-6" />}
            title="No family members"
            description="Add a family member first to run AI health insights."
          />
        ) : !cachedInsight ? (
          <EmptyState
            icon={<Sparkles className="w-6 h-6" />}
            title={t.insights.analyzeBtn}
            description={t.insights.noAnalysis}
            actionLabel={t.insights.analyzeBtn}
            onAction={() => void runAnalysis()}
          />
        ) : (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{t.insights.analysisTitle}</h2>
                    <p className="text-xs text-slate-500">
                      {activeMember.name} · {activeMember.conditions.join(', ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {cachedInsight.analysis}
              </div>
            </section>

            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Utensils className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">{t.insights.foodPatternsTitle}</h2>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {cachedInsight.foodPatterns ||
                  'Add meals in the Meal Planner to receive personalized Indian kitchen swap suggestions.'}
              </p>
            </section>
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
