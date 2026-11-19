import { highOilFoods, highSaltFoods, highSugarFoods } from '../services/foodData';
import type { FamilyMember, MealWarning } from '../types/health';

export function evaluateMealWarnings(foodInput: string, members: FamilyMember[]): MealWarning[] {
  const normalized = foodInput.trim().toLowerCase();
  if (!normalized) return [];

  const warnings: MealWarning[] = [];

  const isHighSugar = highSugarFoods.some((item) => normalized.includes(item));
  const isHighSalt = highSaltFoods.some((item) => normalized.includes(item));
  const isHighOil = highOilFoods.some((item) => normalized.includes(item));

  for (const member of members) {
    const conditions = member.conditions.map((c) => c.toLowerCase());
    const allergies = member.allergies.map((a) => a.toLowerCase());

    if (conditions.includes('diabetes') && isHighSugar) {
      warnings.push({
        memberId: member.id,
        memberName: member.name,
        condition: 'Diabetes',
        severity: 'danger',
        tamilMessage: `⚠️ இந்த உணவு ${member.name} உடைய Diabetes-க்கு நல்லதல்ல. தொடரவா?`,
        englishMessage: `${foodInput} is high in sugar/refined carbs and may spike blood glucose for ${member.name} (Diabetes). Continue anyway?`,
      });
    }

    if (conditions.includes('bp') && isHighSalt) {
      warnings.push({
        memberId: member.id,
        memberName: member.name,
        condition: 'BP',
        severity: 'warning',
        tamilMessage: `⚠️ இந்த உணவு ${member.name} உடைய BP-க்கு நல்லதல்ல (அதிக உப்பு). தொடரவா?`,
        englishMessage: `${foodInput} is high in sodium/salt and can elevate blood pressure for ${member.name} (BP). Continue anyway?`,
      });
    }

    if (conditions.includes('heart') && isHighOil) {
      warnings.push({
        memberId: member.id,
        memberName: member.name,
        condition: 'Heart',
        severity: 'danger',
        tamilMessage: `⚠️ இந்த உணவு ${member.name} உடைய இதய ஆரோக்கியத்திற்கு நல்லதல்ல (அதிக எண்ணெய்). தொடரவா?`,
        englishMessage: `${foodInput} is deep-fried / high-oil and is not recommended for ${member.name} (Heart condition). Continue anyway?`,
      });
    }

    if (conditions.includes('kidney') && isHighSalt) {
      warnings.push({
        memberId: member.id,
        memberName: member.name,
        condition: 'Kidney',
        severity: 'warning',
        tamilMessage: `⚠️ இந்த உணவு ${member.name} உடைய சிறுநீரக ஆரோக்கியத்திற்கு நல்லதல்ல. தொடரவா?`,
        englishMessage: `${foodInput} contains high sodium which puts extra strain on kidneys for ${member.name}. Continue anyway?`,
      });
    }

    for (const allergy of allergies) {
      if (allergy !== 'none' && allergy.length > 1 && normalized.includes(allergy)) {
        warnings.push({
          memberId: member.id,
          memberName: member.name,
          condition: `Allergy (${allergy})`,
          severity: 'danger',
          tamilMessage: `⚠️ ${member.name}-க்கு ${allergy} ஒவ்வாமை (Allergy) உள்ளது. தொடரவா?`,
          englishMessage: `${foodInput} may trigger ${member.name}'s ${allergy} allergy. Continue anyway?`,
        });
      }
    }
  }

  return warnings;
}

export function getBPStatus(systolic?: number, diastolic?: number): 'normal' | 'low' | 'high' {
  if (!systolic || !diastolic) return 'normal';
  if (systolic > 120 || diastolic > 80) return 'high';
  if (systolic < 90 || diastolic < 60) return 'low';
  return 'normal';
}

export function getSugarStatus(val?: number): 'normal' | 'low' | 'high' {
  if (val === undefined || val === null) return 'normal';
  if (val > 100) return 'high';
  if (val < 70) return 'low';
  return 'normal';
}

export function getHeartRateStatus(bpm?: number): 'normal' | 'low' | 'high' {
  if (bpm === undefined || bpm === null) return 'normal';
  if (bpm > 100) return 'high';
  if (bpm < 60) return 'low';
  return 'normal';
}

export function getSpO2Status(pct?: number): 'normal' | 'low' {
  if (pct === undefined || pct === null) return 'normal';
  if (pct < 95) return 'low';
  return 'normal';
}

export function getDaysUntilDate(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
