import { useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { BrainCircuit, ExternalLink, Globe, Loader2, RefreshCw, Search, Sparkles, Utensils } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { AppShell } from '../components/BottomNav';
import { EmptyState } from '../components/EmptyState';
import { MemberSelector } from '../components/MemberSelector';
import { useFamily } from '../hooks/useFamily';
import { db } from '../services/firebase';
import { fetchHealthInsights, searchGroundedHealthInfo, type GroundedSource } from '../services/gemini';
import { addDaysISO, getTodayISO } from '../utils/helpers';
import { getT } from '../utils/i18n';

export default function AIInsights() {
  const { user, family, members, healthRecords, medicines, mealPlans, aiInsights, language } = useFamily();
  const t = getT(language);

  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{ answer: string; sources: GroundedSource[] } | null>(null);

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
    const watchVitals = memberRecords
      .filter((r) => r.type === 'HeartRate' || r.type === 'SpO2')
      .slice(0, 10)
      .map((r) => ({ date: r.date, type: r.type, value: r.value }));
    const doctorVisits = memberRecords
      .filter((r) => r.type === 'DoctorVisit')
      .slice(0, 5)
      .map((r) => ({ date: r.date, doctorName: r.doctorName || r.value, notes: r.notes || '' }));

    const recentMeals = Object.values(mealPlans)
      .sort((a, b) => b.date.localeCompare(a.date))
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
        allergies: activeMember.allergies,
        bpReadings,
        sugarReadings,
        watchVitals,
        doctorVisits,
        recentMeals,
        activeMedicines: activeMeds,
        language,
      });

      const docRef = doc(db, 'families', family.id, 'aiInsights', activeMember.id);
      try {
        await setDoc(docRef, {
          ownerUid: cachedInsight?.ownerUid ?? user?.uid ?? family.createdBy,
          memberId: activeMember.id,
          analysis: (result.analysis || 'No analysis available').slice(0, 6000),
          foodPatterns: (result.foodPatterns || '').slice(0, 4000),
          language,
          timestamp: serverTimestamp(),
        });
      } catch (fsErr) {
        console.warn('Could not save cached AI insight to Firestore:', fsErr);
      }

      toast.success(language === 'ta' ? 'AI ஆலோசனை தயார்!' : 'AI health insights updated!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze health data';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const runHealthSearch = async (customQuery?: string) => {
    const q = (customQuery ?? searchQuery).trim();
    if (!q) return;
    if (customQuery) setSearchQuery(customQuery);
    setSearching(true);

    const latestRecs = activeMember
      ? healthRecords.filter((r) => r.memberId === activeMember.id).slice(0, 5)
      : [];
    const latestVitals = latestRecs.map((r) => `${r.type}: ${r.value} (${r.date})`).join(', ');

    try {
      const res = await searchGroundedHealthInfo({
        query: q,
        memberName: activeMember?.name,
        age: activeMember?.age,
        conditions: activeMember?.conditions,
        allergies: activeMember?.allergies,
        latestVitals,
        language,
      });
      setSearchResult(res);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Health search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full min-w-0 space-y-6"
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
                  ? language === 'ta'
                    ? 'ஆய்வு செய்கிறது...'
                    : 'Analyzing...'
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
          <div className="space-y-4">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl px-4 py-3 text-xs font-medium text-emerald-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-pulse text-emerald-600 shrink-0" />
              <span>
                {language === 'ta'
                  ? `${activeMember?.name ?? ''} உடல்நல பதிவுகள், உணவு மற்றும் மருந்துகளை ஆய்வு செய்கிறது...`
                  : `Analyzing ${activeMember?.name ?? 'member'}'s vitals, meals, and active medicines...`}
              </span>
            </div>
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
            <section className="lg:col-span-7 min-w-0 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900">{t.insights.analysisTitle}</h2>
                    <p className="text-xs text-slate-500 truncate">
                      {activeMember.name} · {activeMember.conditions.join(', ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words">
                {cachedInsight.analysis}
              </div>
            </section>

            <section className="lg:col-span-5 min-w-0 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
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

        {/* Grounded AI Health Research (Google Search) */}
        <section className="w-full min-w-0 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">
                  {language === 'ta'
                    ? 'உடனடி மருத்துவத் தகவல் தேடல் (Google Search AI)'
                    : 'Verified Health Search (Google Search Grounded AI)'}
                </h2>
                <p className="text-xs text-slate-500">
                  {language === 'ta'
                    ? 'BP, சர்க்கரை, இதயத் துடிப்பு, SpO2 மற்றும் உணவு குறித்த சமீபத்திய வழிகாட்டுதல்களைக் கேளுங்கள்.'
                    : 'Ask about BP, sugar, smartwatch HR/SpO2 ranges, or medication precautions with cited sources.'}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runHealthSearch();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'ta'
                  ? 'கேள்வி கேளுங்கள் (எ.கா. சர்க்கரை நோயாளிகளுக்கான சிறந்த இரவு உணவு)...'
                  : 'Ask a health question (e.g., Latest normal resting heart rate & BP guidelines)...'
              }
              className="flex-1 min-w-0 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 min-h-[44px] shrink-0 cursor-pointer"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{searching ? (language === 'ta' ? 'தேடுகிறது...' : 'Searching...') : (language === 'ta' ? 'கேள்' : 'Search AI')}</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {(language === 'ta'
              ? [
                  'இயல்பான BP மற்றும் இதயத் துடிப்பு அளவு என்ன?',
                  'சர்க்கரை நோய்க்கு ஏற்ற தென்னிந்திய உணவுகள்',
                  'SpO2 அளவு குறைந்தால் என்ன செய்ய வேண்டும்?',
                ]
              : [
                  'What are normal BP, HR, and SpO2 levels?',
                  'Best South Indian low-GI dinner options',
                  'When should I see a doctor for high blood sugar?',
                ]
            ).map((sample) => (
              <button
                key={sample}
                type="button"
                disabled={searching}
                onClick={() => void runHealthSearch(sample)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-slate-700 cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>

          {searchResult && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words">
                {searchResult.answer}
              </div>
              {searchResult.sources.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {language === 'ta' ? 'சரிபார்க்கப்பட்ட ஆதாரங்கள்' : 'Google Search Sources'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {searchResult.sources.map((src, idx) => (
                      <a
                        key={`${src.uri}-${idx}`}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 max-w-full"
                      >
                        <span className="truncate max-w-[220px]">{src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </motion.div>
    </AppShell>
  );
}
