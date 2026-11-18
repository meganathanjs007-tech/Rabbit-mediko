import React, { useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CalendarHeart, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { AppShell } from '../components/BottomNav';
import { HealthWarningModal } from '../components/HealthWarningModal';
import { useFamily } from '../hooks/useFamily';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { quickAddFoods } from '../services/foodData';
import { fetchMealSuggestions, type SuggestedMeal } from '../services/gemini';
import type { MealSlot, MealWarning } from '../types/health';
import { evaluateMealWarnings } from '../utils/healthRules';
import { formatShortDate, getTodayISO, getWeekDates } from '../utils/helpers';
import { getT } from '../utils/i18n';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export default function MealPlanner() {
  const { family, members, mealPlans, language } = useFamily();
  const t = getT(language);

  const weekDates = useMemo(() => getWeekDates(getTodayISO()), []);
  const [activeSlot, setActiveSlot] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [foodInput, setFoodInput] = useState('');

  const [pendingDish, setPendingDish] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<MealWarning[]>([]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedMeal[]>([]);

  const persistDishToSlot = async (dateISO: string, slot: MealSlot, dish: string) => {
    if (!family) return;
    const existing = mealPlans[dateISO];
    const currentDishes = existing?.[slot] ?? [];
    if (currentDishes.includes(dish)) {
      toast.success(`${dish} is already in ${t.meals[slot]}`);
      return;
    }

    const updatedPlan = {
      ownerUid: family.createdBy,
      date: dateISO,
      breakfast: existing?.breakfast ?? [],
      lunch: existing?.lunch ?? [],
      dinner: existing?.dinner ?? [],
      snacks: existing?.snacks ?? [],
      [slot]: [...currentDishes, dish].slice(0, 15),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'families', family.id, 'mealPlans', dateISO), updatedPlan);
      toast.success(`${dish} added!`);
      setFoodInput('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `families/${family.id}/mealPlans/${dateISO}`);
    }
  };

  const handleTryAddDish = (dishName: string) => {
    if (!activeSlot) return;
    const cleaned = dishName.trim();
    if (!cleaned) return;

    const triggered = evaluateMealWarnings(cleaned, members);
    if (triggered.length > 0) {
      setPendingDish(cleaned);
      setWarnings(triggered);
      return;
    }
    void persistDishToSlot(activeSlot.date, activeSlot.slot, cleaned);
  };

  const handleRemoveDish = async (dateISO: string, slot: MealSlot, dishIndex: number) => {
    if (!family) return;
    const existing = mealPlans[dateISO];
    if (!existing) return;

    const nextSlot = existing[slot].filter((_, idx) => idx !== dishIndex);
    try {
      await setDoc(doc(db, 'families', family.id, 'mealPlans', dateISO), {
        ownerUid: family.createdBy,
        date: dateISO,
        breakfast: existing.breakfast ?? [],
        lunch: existing.lunch ?? [],
        dinner: existing.dinner ?? [],
        snacks: existing.snacks ?? [],
        [slot]: nextSlot,
        updatedAt: serverTimestamp(),
      });
      toast.success(language === 'ta' ? 'உணவு நீக்கப்பட்டது' : 'Dish removed');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `families/${family.id}/mealPlans/${dateISO}`);
    }
  };

  const handleAiSuggest = async () => {
    if (!activeSlot) return;
    setAiLoading(true);
    try {
      const allConditions = Array.from(
        new Set(members.flatMap((m) => m.conditions).filter((c) => c !== 'None'))
      );
      const allAllergies = Array.from(
        new Set(members.flatMap((m) => m.allergies).filter((a) => a !== 'None'))
      );
      const suggestions = await fetchMealSuggestions({
        memberName: family?.familyName || 'Family',
        conditions: allConditions,
        allergies: allAllergies,
        mealSlot: activeSlot.slot,
        language,
      });
      setAiSuggestions(suggestions);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not fetch AI suggestions');
    } finally {
      setAiLoading(false);
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
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <CalendarHeart className="w-6 h-6 text-emerald-600" />
              <span>{t.meals.title}</span>
            </h1>
            <p className="text-sm text-slate-600">{t.meals.subtitle}</p>
          </div>
          <div className="text-xs text-slate-500">
            Active checks:{' '}
            <span className="font-medium text-slate-800">
              {Array.from(new Set(members.flatMap((m) => m.conditions).filter((c) => c !== 'None'))).join(', ') || 'General Wellness'}
            </span>
          </div>
        </div>

        {/* 7-Day Planner Grid */}
        <div className="space-y-4">
          {weekDates.map((dateISO, dayIdx) => {
            const plan = mealPlans[dateISO];
            const isToday = dayIdx === 0;
            return (
              <div
                key={dateISO}
                className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 ${
                  isToday ? 'border-emerald-300' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {formatShortDate(dateISO, language)}
                    </span>
                    {isToday && (
                      <span className="text-xs font-semibold text-emerald-700">· Today</span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">{dateISO}</span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {SLOTS.map((slot) => {
                    const dishes = plan?.[slot] ?? [];
                    return (
                      <div
                        key={slot}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 flex flex-col justify-between gap-2.5 min-h-[108px]"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                              {t.meals[slot]}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSlot({ date: dateISO, slot });
                                setAiSuggestions([]);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 min-h-[32px] px-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          </div>

                          {dishes.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Empty slot</p>
                          ) : (
                            <div className="space-y-1">
                              {dishes.map((dish, idx) => (
                                <div
                                  key={`${dish}-${idx}`}
                                  className="flex items-center justify-between gap-2 bg-white border border-slate-200/70 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800"
                                >
                                  <span className="truncate">{dish}</span>
                                  <button
                                    type="button"
                                    onClick={() => void handleRemoveDish(dateISO, slot, idx)}
                                    className="text-slate-400 hover:text-red-600 shrink-0 cursor-pointer"
                                    aria-label={`Remove ${dish}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Slot Add Modal */}
        {activeSlot && (
          <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 p-6 shadow-xl space-y-5 max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {t.meals[activeSlot.slot]} · {formatShortDate(activeSlot.date, language)}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Safety warnings check Diabetes, BP, Heart & Allergies automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSlot(null)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-900 cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleTryAddDish(foodInput);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={foodInput}
                  onChange={(e) => setFoodInput(e.target.value)}
                  placeholder={t.meals.addFoodPlaceholder}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 min-h-[44px] whitespace-nowrap cursor-pointer"
                >
                  {t.meals.addToSlot}
                </button>
              </form>

              {/* Quick Add Dishes */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">{t.meals.quickAdd}</p>
                <div className="flex flex-wrap gap-2">
                  {quickAddFoods.map((food) => (
                    <button
                      key={food}
                      type="button"
                      onClick={() => handleTryAddDish(food)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-xs font-medium text-slate-800 transition-colors min-h-[36px] cursor-pointer"
                    >
                      + {food}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Suggest Button */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void handleAiSuggest()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors min-h-[44px] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>{aiLoading ? 'Thinking in Tamil...' : t.meals.aiSuggest}</span>
                </button>

                {aiSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-emerald-700">{t.meals.aiSuggestionsTitle}</p>
                    {aiSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.tamilTitle} ({item.name})
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed">{item.reason}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTryAddDish(item.name)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shrink-0 cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <HealthWarningModal
          open={Boolean(pendingDish && warnings.length > 0)}
          dishName={pendingDish ?? ''}
          warnings={warnings}
          language={language}
          onCancel={() => {
            setPendingDish(null);
            setWarnings([]);
          }}
          onConfirm={() => {
            if (activeSlot && pendingDish) {
              void persistDishToSlot(activeSlot.date, activeSlot.slot, pendingDish);
            }
            setPendingDish(null);
            setWarnings([]);
          }}
        />
      </motion.div>
    </AppShell>
  );
}
