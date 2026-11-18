import React, { useMemo, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Check, MessageCircle, Plus, ShoppingBasket, Sparkles, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { AppShell } from '../components/BottomNav';
import { EmptyState } from '../components/EmptyState';
import { useFamily } from '../hooks/useFamily';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { inferCategoryForItem, MEAL_INGREDIENT_MAP } from '../services/foodData';
import type { GroceryCategory, GroceryItem } from '../types/health';
import { generateSecureId } from '../utils/helpers';
import { getT } from '../utils/i18n';

const CATEGORIES: GroceryCategory[] = ['Vegetables', 'Grains', 'Dairy', 'Others'];

export default function GroceryList() {
  const { family, mealPlans, groceryItems, language } = useFamily();
  const t = getT(language);

  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<GroceryCategory>('Vegetables');
  const [generating, setGenerating] = useState(false);

  const handleAutoGenerate = async () => {
    if (!family) return;
    setGenerating(true);

    try {
      const existingNames = new Set(groceryItems.map((g) => g.name.trim().toLowerCase()));
      const candidates = new Map<string, GroceryCategory>();

      Object.values(mealPlans).forEach((plan) => {
        const allDishes = [
          ...(plan.breakfast ?? []),
          ...(plan.lunch ?? []),
          ...(plan.dinner ?? []),
          ...(plan.snacks ?? []),
        ];

        allDishes.forEach((dish) => {
          const lower = dish.trim().toLowerCase();
          const mapped = MEAL_INGREDIENT_MAP[lower];
          if (mapped) {
            mapped.forEach((ing) => {
              if (!existingNames.has(ing.name.toLowerCase())) {
                candidates.set(ing.name, ing.category);
              }
            });
          } else {
            const matchedKey = Object.keys(MEAL_INGREDIENT_MAP).find((k) => lower.includes(k));
            if (matchedKey) {
              MEAL_INGREDIENT_MAP[matchedKey].forEach((ing) => {
                if (!existingNames.has(ing.name.toLowerCase())) {
                  candidates.set(ing.name, ing.category);
                }
              });
            } else if (!existingNames.has(lower)) {
              candidates.set(dish.trim(), inferCategoryForItem(dish));
            }
          }
        });
      });

      if (candidates.size === 0) {
        toast.success('All weekly meal ingredients are already in your grocery list!');
        setGenerating(false);
        return;
      }

      const entries = Array.from(candidates.entries());
      for (let i = 0; i < entries.length; i += 10) {
        const chunk = entries.slice(i, i + 10);
        const batch = writeBatch(db);
        chunk.forEach(([name, category]) => {
          const id = generateSecureId('grc');
          batch.set(doc(db, 'families', family.id, 'grocery', id), {
            ownerUid: family.createdBy,
            name: name.trim().slice(0, 100),
            category,
            checked: false,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
      toast.success(`Added ${candidates.size} ingredients from weekly meal plans!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `families/${family.id}/grocery`);
    } finally {
      setGenerating(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !newName.trim()) return;
    const id = generateSecureId('grc');
    try {
      await setDoc(doc(db, 'families', family.id, 'grocery', id), {
        ownerUid: family.createdBy,
        name: newName.trim().slice(0, 100),
        category: newCategory,
        checked: false,
        createdAt: serverTimestamp(),
      });
      setNewName('');
      toast.success('Item added');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `families/${family.id}/grocery/${id}`);
    }
  };

  const toggleItem = async (item: GroceryItem) => {
    if (!family) return;
    try {
      await updateDoc(doc(db, 'families', family.id, 'grocery', item.id), {
        checked: !item.checked,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `families/${family.id}/grocery/${item.id}`);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!family) return;
    try {
      await deleteDoc(doc(db, 'families', family.id, 'grocery', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `families/${family.id}/grocery/${itemId}`);
    }
  };

  const clearChecked = async () => {
    if (!family) return;
    const checkedItems = groceryItems.filter((g) => g.checked);
    if (checkedItems.length === 0) return;

    try {
      const batch = writeBatch(db);
      checkedItems.forEach((item) => {
        batch.delete(doc(db, 'families', family.id, 'grocery', item.id));
      });
      await batch.commit();
      toast.success(`Cleared ${checkedItems.length} checked items`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `families/${family.id}/grocery`);
    }
  };

  const whatsappUrl = useMemo(() => {
    const unchecked = groceryItems.filter((g) => !g.checked);
    const lines = CATEGORIES.flatMap((cat) => {
      const catItems = unchecked.filter((i) => i.category === cat);
      if (catItems.length === 0) return [];
      return [`*${cat}:*`, ...catItems.map((i) => `- ${i.name}`), ''];
    });
    const text = `*${family?.familyName || 'Family'} Grocery List (Rabbit Mediko)*\n\n${lines.join('\n')}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [groceryItems, family?.familyName]);

  const total = groceryItems.length;
  const checkedCount = groceryItems.filter((g) => g.checked).length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900">{t.grocery.title}</h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleAutoGenerate()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 min-h-[44px] cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{generating ? 'Generating...' : t.grocery.generateBtn}</span>
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs sm:text-sm font-semibold hover:bg-slate-50 min-h-[44px]"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>{t.grocery.shareWhatsapp}</span>
            </a>
          </div>
        </div>

        {/* Progress Bar + Add Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>{t.grocery.progressLabel}</span>
              <span className="font-mono tabular-nums">
                {checkedCount} / {total} ({pct}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add grocery item (e.g. Coriander Leaves)"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as GroceryCategory)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 min-h-[44px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.grocery.addItemBtn}</span>
            </button>
            {checkedCount > 0 && (
              <button
                type="button"
                onClick={() => void clearChecked()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 min-h-[44px] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t.grocery.clearChecked}</span>
              </button>
            )}
          </form>
        </div>

        {/* Grouped Categories */}
        {groceryItems.length === 0 ? (
          <EmptyState
            icon={<ShoppingBasket className="w-6 h-6" />}
            title="Grocery list is empty"
            description={t.grocery.empty}
            actionLabel={t.grocery.generateBtn}
            onAction={() => void handleAutoGenerate()}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {CATEGORIES.map((category) => {
              const items = groceryItems.filter((g) => g.category === category);
              if (items.length === 0) return null;
              return (
                <section
                  key={category}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h2 className="text-sm font-bold text-slate-900">{category}</h2>
                    <span className="text-xs font-mono text-slate-500 tabular-nums">{items.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => void toggleItem(item)}
                          className="flex-1 flex items-center gap-3 text-left min-h-[40px] cursor-pointer"
                        >
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              item.checked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`text-sm font-medium ${
                              item.checked ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}
                          >
                            {item.name}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
