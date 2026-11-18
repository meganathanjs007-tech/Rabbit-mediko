import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../services/firebase';
import { generateSecureId } from '../utils/helpers';
import type {
  AiInsight,
  Family,
  FamilyMember,
  GroceryItem,
  HealthRecord,
  Language,
  MealPlan,
  Medicine,
  MedicineLog,
  UserProfile,
} from '../types/health';

interface FamilyContextValue {
  user: User | null;
  authReady: boolean;
  userProfile: UserProfile | null;
  family: Family | null;
  familyLoading: boolean;
  members: FamilyMember[];
  healthRecords: HealthRecord[];
  medicines: Medicine[];
  medicineLogs: MedicineLog[];
  mealPlans: Record<string, MealPlan>;
  groceryItems: GroceryItem[];
  aiInsights: Record<string, AiInsight>;
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  logout: () => Promise<void>;
  saveFamilySetup: (params: {
    familyName: string;
    emergencyContact: string;
    members: Array<{
      name: string;
      age: number;
      gender: 'M' | 'F' | 'Other';
      bloodGroup: FamilyMember['bloodGroup'];
      allergies: string[];
      conditions: string[];
    }>;
  }) => Promise<string>;
  addFamilyMember: (member: {
    name: string;
    age: number;
    gender: 'M' | 'F' | 'Other';
    bloodGroup: FamilyMember['bloodGroup'];
    allergies: string[];
    conditions: string[];
    emergencyContact?: string;
  }) => Promise<void>;
  updateFamilyDetails: (familyName: string, emergencyContact: string) => Promise<void>;
  syncEmergencyCard: (member: FamilyMember, overrideMeds?: Medicine[]) => Promise<void>;
  deleteFamilyWorkspace: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextValue | undefined>(undefined);

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [familyLoading, setFamilyLoading] = useState(true);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicineLogs, setMedicineLogs] = useState<MedicineLog[]>([]);
  const [mealPlans, setMealPlans] = useState<Record<string, MealPlan>>({});
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [aiInsights, setAiInsights] = useState<Record<string, AiInsight>>({});
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('rabbit_mediko_lang');
    return saved === 'ta' ? 'ta' : 'en';
  });

  // 1. Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setUserProfile(null);
        setFamily(null);
        setMembers([]);
        setHealthRecords([]);
        setMedicines([]);
        setMedicineLogs([]);
        setMealPlans({});
        setGroceryItems([]);
        setAiInsights({});
        setFamilyLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // 2. User profile listener & auto-bootstrap
  useEffect(() => {
    if (!authReady || !user) return;
    setFamilyLoading(true);
    const userRef = doc(db, 'users', user.uid);

    const unsub = onSnapshot(
      userRef,
      async (snap) => {
        if (!snap.exists()) {
          const initialLang = localStorage.getItem('rabbit_mediko_lang') === 'ta' ? 'ta' : 'en';
          try {
            await setDoc(userRef, {
              uid: user.uid,
              language: initialLang,
              ...(user.email ? { email: user.email } : {}),
              ...(user.phoneNumber ? { phone: user.phoneNumber } : {}),
              ...(user.displayName ? { displayName: user.displayName } : {}),
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
          }
          return;
        }
        const data = snap.data() as UserProfile;
        setUserProfile(data);
        if (data.language === 'ta' || data.language === 'en') {
          setLanguageState(data.language);
          localStorage.setItem('rabbit_mediko_lang', data.language);
        }
        if (!data.familyId) {
          setFamily(null);
          setFamilyLoading(false);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }
    );

    return () => unsub();
  }, [authReady, user]);

  // 3. Family root listener
  useEffect(() => {
    if (!authReady || !user || !userProfile?.familyId) return;
    const famId = userProfile.familyId;
    const famRef = doc(db, 'families', famId);

    const unsub = onSnapshot(
      famRef,
      (snap) => {
        if (snap.exists()) {
          setFamily({ id: snap.id, ...(snap.data() as Omit<Family, 'id'>) });
        } else {
          setFamily(null);
        }
        setFamilyLoading(false);
      },
      (err) => {
        setFamilyLoading(false);
        handleFirestoreError(err, OperationType.GET, `families/${famId}`);
      }
    );

    return () => unsub();
  }, [authReady, user, userProfile?.familyId]);

  // 4. Subcollection real-time listeners (strictly gated on family & ownerUid)
  useEffect(() => {
    if (!authReady || !user || !family) {
      setMembers([]);
      setHealthRecords([]);
      setMedicines([]);
      setMedicineLogs([]);
      setMealPlans({});
      setGroceryItems([]);
      setAiInsights({});
      return;
    }
    const famId = family.id;
    const ownerUid = family.createdBy;

    const unsubMembers = onSnapshot(
      query(collection(db, 'families', famId, 'members'), where('ownerUid', '==', ownerUid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyMember, 'id'>) }));
        setMembers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `families/${famId}/members`)
    );

    const unsubRecords = onSnapshot(
      query(collection(db, 'families', famId, 'healthRecords'), where('ownerUid', '==', ownerUid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<HealthRecord, 'id'>) }))
          .sort((a, b) => b.date.localeCompare(a.date));
        setHealthRecords(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `families/${famId}/healthRecords`)
    );

    const unsubMeds = onSnapshot(
      query(collection(db, 'families', famId, 'medicines'), where('ownerUid', '==', ownerUid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Medicine, 'id'>) }));
        setMedicines(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `families/${famId}/medicines`)
    );

    const unsubMedLogs = onSnapshot(
      query(collection(db, 'families', famId, 'medicineLogs'), where('ownerUid', '==', ownerUid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MedicineLog, 'id'>) }));
        setMedicineLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `families/${famId}/medicineLogs`)
    );

    const unsubMeals = onSnapshot(
      query(collection(db, 'families', famId, 'mealPlans'), where('ownerUid', '==', ownerUid)),
      (snap) => {
        const map: Record<string, MealPlan> = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Omit<MealPlan, 'id'>) };
        });
        setMealPlans(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `families/${famId}/mealPlans`)
    );

    const unsubGrocery = onSnapshot(
      query(collection(db, 'families', famId, 'grocery'), where('ownerUid', '==', ownerUid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GroceryItem, 'id'>) }));
        setGroceryItems(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `families/${famId}/grocery`)
    );

    const unsubInsights = onSnapshot(
      query(collection(db, 'families', famId, 'aiInsights'), where('ownerUid', '==', ownerUid)),
      (snap) => {
        const map: Record<string, AiInsight> = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Omit<AiInsight, 'id'>) };
        });
        setAiInsights(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `families/${famId}/aiInsights`)
    );

    return () => {
      unsubMembers();
      unsubRecords();
      unsubMeds();
      unsubMedLogs();
      unsubMeals();
      unsubGrocery();
      unsubInsights();
    };
  }, [authReady, user, family]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('rabbit_mediko_lang', lang);
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          await updateDoc(userRef, { language: lang });
        } else {
          await setDoc(userRef, {
            uid: user.uid,
            language: lang,
            ...(user.email ? { email: user.email } : {}),
            ...(user.phoneNumber ? { phone: user.phoneNumber } : {}),
            ...(user.displayName ? { displayName: user.displayName } : {}),
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const syncEmergencyCard = async (member: FamilyMember, overrideMeds?: Medicine[]) => {
    if (!user || !family) return;
    const activeMedList = (overrideMeds ?? medicines)
      .filter((m) => m.memberId === member.id && m.active)
      .map((m) => `${m.name} (${m.dosage}, ${m.frequency})`);

    try {
      await setDoc(doc(db, 'emergencyCards', member.cardId), {
        familyId: family.id,
        ownerUid: family.createdBy,
        memberId: member.id,
        name: member.name,
        age: member.age,
        gender: member.gender,
        bloodGroup: member.bloodGroup,
        allergies: member.allergies,
        conditions: member.conditions,
        emergencyContact: member.emergencyContact || family.emergencyContact || '',
        activeMedicines: activeMedList,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `emergencyCards/${member.cardId}`);
    }
  };

  const saveFamilySetup: FamilyContextValue['saveFamilySetup'] = async ({
    familyName,
    emergencyContact,
    members: newMembers,
  }) => {
    if (!user) throw new Error('User must be signed in.');
    const familyId = generateSecureId('fam');

    try {
      await setDoc(doc(db, 'families', familyId), {
        familyName: familyName.trim().slice(0, 80),
        createdBy: user.uid,
        memberUids: [user.uid],
        emergencyContact: emergencyContact.trim().slice(0, 32),
        createdAt: serverTimestamp(),
      });

      for (let i = 0; i < newMembers.length; i += 5) {
        const chunk = newMembers.slice(i, i + 5);
        const batch = writeBatch(db);
        for (const m of chunk) {
          const memberId = generateSecureId('mem');
          const cardId = generateSecureId('card');
          const cleanName = m.name.trim().slice(0, 80);
          const cleanContact = emergencyContact.trim().slice(0, 32);
          const cleanAge = Math.min(130, Math.max(0, Number(m.age) || 0));
          const cleanAllergies = m.allergies.length > 0 ? m.allergies.slice(0, 15) : ['None'];
          const cleanConditions = m.conditions.length > 0 ? m.conditions.slice(0, 15) : ['None'];

          batch.set(doc(db, 'families', familyId, 'members', memberId), {
            ownerUid: user.uid,
            name: cleanName,
            age: cleanAge,
            gender: m.gender,
            bloodGroup: m.bloodGroup,
            allergies: cleanAllergies,
            conditions: cleanConditions,
            emergencyContact: cleanContact,
            cardId,
            createdAt: serverTimestamp(),
          });

          batch.set(doc(db, 'emergencyCards', cardId), {
            familyId,
            ownerUid: user.uid,
            memberId,
            name: cleanName,
            age: cleanAge,
            gender: m.gender,
            bloodGroup: m.bloodGroup,
            allergies: cleanAllergies,
            conditions: cleanConditions,
            emergencyContact: cleanContact,
            activeMedicines: [],
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, { familyId });
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          familyId,
          language,
          ...(user.email ? { email: user.email } : {}),
          ...(user.phoneNumber ? { phone: user.phoneNumber } : {}),
          ...(user.displayName ? { displayName: user.displayName } : {}),
          createdAt: serverTimestamp(),
        });
      }

      return familyId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `families/${familyId}`);
    }
  };

  const addFamilyMember: FamilyContextValue['addFamilyMember'] = async (member) => {
    if (!user || !family) throw new Error('Family not initialized');
    const memberId = generateSecureId('mem');
    const cardId = generateSecureId('card');
    const cleanName = member.name.trim().slice(0, 80);
    const cleanAge = Math.min(130, Math.max(0, Number(member.age) || 0));
    const contact = (member.emergencyContact ?? family.emergencyContact ?? '').trim().slice(0, 32);
    const cleanAllergies = member.allergies.length > 0 ? member.allergies.slice(0, 15) : ['None'];
    const cleanConditions = member.conditions.length > 0 ? member.conditions.slice(0, 15) : ['None'];

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'families', family.id, 'members', memberId), {
        ownerUid: family.createdBy,
        name: cleanName,
        age: cleanAge,
        gender: member.gender,
        bloodGroup: member.bloodGroup,
        allergies: cleanAllergies,
        conditions: cleanConditions,
        emergencyContact: contact,
        cardId,
        createdAt: serverTimestamp(),
      });

      batch.set(doc(db, 'emergencyCards', cardId), {
        familyId: family.id,
        ownerUid: family.createdBy,
        memberId,
        name: cleanName,
        age: cleanAge,
        gender: member.gender,
        bloodGroup: member.bloodGroup,
        allergies: cleanAllergies,
        conditions: cleanConditions,
        emergencyContact: contact,
        activeMedicines: [],
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `families/${family.id}/members/${memberId}`);
    }
  };

  const updateFamilyDetails = async (familyName: string, emergencyContact: string) => {
    if (!family) return;
    try {
      await updateDoc(doc(db, 'families', family.id), {
        familyName: familyName.trim().slice(0, 80),
        emergencyContact: emergencyContact.trim().slice(0, 32),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `families/${family.id}`);
    }
  };

  const deleteFamilyWorkspace = async () => {
    if (!user || !family) return;
    const famId = family.id;
    try {
      const refsToDelete = [
        ...members.map((m) => doc(db, 'families', famId, 'members', m.id)),
        ...members.map((m) => doc(db, 'emergencyCards', m.cardId)),
        ...healthRecords.map((r) => doc(db, 'families', famId, 'healthRecords', r.id)),
        ...medicines.map((m) => doc(db, 'families', famId, 'medicines', m.id)),
        ...medicineLogs.map((l) => doc(db, 'families', famId, 'medicineLogs', l.id)),
        ...Object.values(mealPlans).map((p) => doc(db, 'families', famId, 'mealPlans', p.id)),
        ...groceryItems.map((g) => doc(db, 'families', famId, 'grocery', g.id)),
        ...Object.values(aiInsights).map((a) => doc(db, 'families', famId, 'aiInsights', a.id)),
      ];

      for (let i = 0; i < refsToDelete.length; i += 10) {
        const chunk = refsToDelete.slice(i, i + 10);
        const batch = writeBatch(db);
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      await updateDoc(doc(db, 'users', user.uid), { familyId: '' });
      await deleteDoc(doc(db, 'families', famId));
      setFamily(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `families/${famId}`);
    }
  };

  return (
    <FamilyContext.Provider
      value={{
        user,
        authReady,
        userProfile,
        family,
        familyLoading,
        members,
        healthRecords,
        medicines,
        medicineLogs,
        mealPlans,
        groceryItems,
        aiInsights,
        language,
        setLanguage,
        logout,
        saveFamilySetup,
        addFamilyMember,
        updateFamilyDetails,
        syncEmergencyCard,
        deleteFamilyWorkspace,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamilyContext() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamilyContext must be used inside FamilyProvider');
  return ctx;
}
