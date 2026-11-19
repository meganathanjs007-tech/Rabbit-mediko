export type Language = 'en' | 'ta';

export type Gender = 'M' | 'F' | 'Other';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';

export type HealthRecordType = 'BP' | 'Sugar' | 'HeartRate' | 'SpO2' | 'Report' | 'DoctorVisit';

export type MedicineFrequency = 'Once' | 'Twice' | 'Thrice';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type GroceryCategory = 'Vegetables' | 'Grains' | 'Dairy' | 'Others';

export interface UserProfile {
  uid: string;
  familyId?: string;
  phone?: string;
  email?: string;
  displayName?: string;
  language: Language;
  createdAt?: unknown;
}

export interface Family {
  id: string;
  familyName: string;
  createdBy: string;
  memberUids: string[];
  emergencyContact?: string;
  inviteCode?: string;
  createdAt?: unknown;
}

export interface FamilyInvite {
  familyId: string;
  familyName: string;
  createdBy: string;
  createdAt?: unknown;
}

export interface FamilyMember {
  id: string;
  ownerUid: string;
  name: string;
  age: number;
  gender: Gender;
  bloodGroup: BloodGroup;
  allergies: string[];
  conditions: string[];
  emergencyContact?: string;
  cardId: string;
  createdAt?: unknown;
}

export interface HealthRecord {
  id: string;
  ownerUid: string;
  memberId: string;
  type: HealthRecordType;
  value: string;
  systolic?: number;
  diastolic?: number;
  numericValue?: number;
  date: string;
  fileUrl?: string;
  fileName?: string;
  doctorName?: string;
  notes?: string;
  createdAt?: unknown;
}

export interface Medicine {
  id: string;
  ownerUid: string;
  memberId: string;
  name: string;
  dosage: string;
  frequency: MedicineFrequency;
  times: string[];
  startDate: string;
  endDate?: string;
  expiryDate?: string;
  active: boolean;
  createdAt?: unknown;
}

export interface MedicineLog {
  id: string;
  ownerUid: string;
  medicineId: string;
  memberId: string;
  date: string;
  time: string;
  takenAt?: unknown;
}

export interface MealPlan {
  id: string;
  ownerUid: string;
  date: string;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  snacks: string[];
  updatedAt?: unknown;
}

export interface GroceryItem {
  id: string;
  ownerUid: string;
  name: string;
  category: GroceryCategory;
  checked: boolean;
  createdAt?: unknown;
}

export interface AiInsight {
  id: string;
  ownerUid: string;
  memberId: string;
  analysis: string;
  foodPatterns?: string;
  language: Language;
  timestamp?: unknown;
}

export interface EmergencyCard {
  id: string;
  familyId: string;
  ownerUid: string;
  memberId: string;
  name: string;
  age: number;
  gender: Gender;
  bloodGroup: BloodGroup;
  allergies: string[];
  conditions: string[];
  emergencyContact?: string;
  activeMedicines: string[];
  updatedAt?: unknown;
}

export interface MealWarning {
  memberId: string;
  memberName: string;
  condition: string;
  severity: 'warning' | 'danger';
  tamilMessage: string;
  englishMessage: string;
}
