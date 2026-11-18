import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { Language, MealWarning } from '../types/health';
import { getT } from '../utils/i18n';

interface HealthWarningModalProps {
  open: boolean;
  dishName: string;
  warnings: MealWarning[];
  language: Language;
  onCancel: () => void;
  onConfirm: () => void;
}

export function HealthWarningModal({
  open,
  dishName,
  warnings,
  language,
  onCancel,
  onConfirm,
}: HealthWarningModalProps) {
  if (!open || warnings.length === 0) return null;
  const t = getT(language);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{t.meals.warningTitle}</h3>
            <p className="text-sm text-slate-500">
              {dishName} · {warnings.length} {warnings.length === 1 ? 'alert' : 'alerts'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {warnings.map((w, idx) => (
            <div
              key={`${w.memberId}-${idx}`}
              className={`rounded-xl p-3.5 border ${
                w.severity === 'danger'
                  ? 'bg-red-50/70 border-red-200 text-red-950'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  {w.memberName} · {w.condition}
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug">{w.tamilMessage}</p>
              <p className="text-xs opacity-85 mt-1 leading-relaxed">{w.englishMessage}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors min-h-[44px] cursor-pointer"
          >
            {t.meals.chooseHealthier}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors min-h-[44px] cursor-pointer"
          >
            {t.meals.proceedAnyway}
          </button>
        </div>
      </div>
    </div>
  );
}
