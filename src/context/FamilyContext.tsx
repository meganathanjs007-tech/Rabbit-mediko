import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../services/firebase';
import { generateInviteCode, generateSecureId } from '../utils/helpers';
import type {
  AiInsight,
  Family,
  FamilyInvite,
  FamilyMember,
  GroceryItem,
  HealthRecord,
  Language,
  MealPlan,
  Medicine,
  MedicineLog,
  UserProfile,
} from '../types/health';

export interface MemberInput {
  name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  bloodGroup: FamilyMember['bloodGroup'];
  allergies: string[];
  conditions: string[];
}

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
    members: MemberInput[];
  }) => Promise<{ familyId: string; inviteCode: string }>;
  lookupInviteCode: (
    code: string
  ) => Promise<{ code: string; familyId: string; familyName: string } | null>;
  joinFamilyWithCode: (params: {
    code: string;
    member: MemberInput;
  }) => Promise<{ familyId: string; familyName: string }>;
  ensureInviteCode: (regenerate?: boolean) => Promise<string | null>;
  leaveFamily: () => Promise<void>;
  addFamilyMember: (member: MemberInput & { emergencyContact?: string }) => Promise<void>;
  updateFamilyDetails: (familyName: string, emergencyContact: string) => Promise<void>;
  syncEmergencyCard: (member: FamilyMember, overrideMeds?: Medicine[]) => Promise<void>;
  deleteFamilyWorkspace: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextValue | undefined>(undefined);

function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function sanitizeUserFields(user: User) {
  const email = user.email?.trim().slice(0, 160);
  const phone = user.phoneNumber?.trim().slice(0, 32);
  const displayName = user.displayName?.trim().slice(0, 100);
  return {
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(displayName ? { displayName } : {}),
  };
}

function sanitizeTags(tags: string[]): string[] {
  const cleaned = tags
    .map((item) => item.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 15);
  return cleaned.length > 0 ? cleaned : ['None'];
}

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
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
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
              ...sanitizeUserFields(user),
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            console.warn('Could not bootstrap user profile:', err);
            setFamilyLoading(false);
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
        console.warn('User profile snapshot error:', err);
        setFamilyLoading(false);
      }
    );

    return () => unsub();
  }, [authReady, user]);

  // 3. Family root listener
  useEffect(() => {
    if (!authReady || !user || !userProfile?.familyId) return;
    const famId = userProfile.familyId;
    setFamilyLoading(true);
    const famRef = doc(db, 'families', famId);

    const clearStaleFamilyLink = () => {
      setFamily(null);
      setFamilyLoading(false);
      updateDoc(doc(db, 'users', user.uid), { familyId: '' }).catch((clearErr) => {
        console.warn('Could not clear stale familyId:', clearErr);
      });
    };

    const unsub = onSnapshot(
      famRef,
      (snap) => {
        if (snap.exists()) {
          setFamily({ id: snap.id, ...(snap.data() as Omit<Family, 'id'>) });
          setFamilyLoading(false);
        } else {
          // Family was deleted by creator -> recover gracefully to /setup
          clearStaleFamilyLink();
        }
      },
      (err) => {
        console.warn('Family snapshot error:', err);
        clearStaleFamilyLink();
      }
    );

    return () => unsub();
  }, [authReady, user, userProfile?.familyId]);

  // 4. Subcollection real-time listeners (shared across all family memberUids)
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

    const unsubMembers = onSnapshot(
      collection(db, 'families', famId, 'members'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyMember, 'id'>) }));
        setMembers(list);
      },
      (err) => console.warn('Members listener warning:', err)
    );

    const unsubRecords = onSnapshot(
      collection(db, 'families', famId, 'healthRecords'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<HealthRecord, 'id'>) }))
          .sort((a, b) => b.date.localeCompare(a.date));
        setHealthRecords(list);
      },
      (err) => console.warn('Health records listener warning:', err)
    );

    const unsubMeds = onSnapshot(
      collection(db, 'families', famId, 'medicines'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Medicine, 'id'>) }));
        setMedicines(list);
      },
      (err) => console.warn('Medicines listener warning:', err)
    );

    const unsubMedLogs = onSnapshot(
      collection(db, 'families', famId, 'medicineLogs'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MedicineLog, 'id'>) }));
        setMedicineLogs(list);
      },
      (err) => console.warn('Medicine logs listener warning:', err)
    );

    const unsubMeals = onSnapshot(
      collection(db, 'families', famId, 'mealPlans'),
      (snap) => {
        const map: Record<string, MealPlan> = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Omit<MealPlan, 'id'>) };
        });
        setMealPlans(map);
      },
      (err) => console.warn('Meal plans listener warning:', err)
    );

    const unsubGrocery = onSnapshot(
      collection(db, 'families', famId, 'grocery'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GroceryItem, 'id'>) }));
        setGroceryItems(list);
      },
      (err) => console.warn('Grocery listener warning:', err)
    );

    const unsubInsights = onSnapshot(
      collection(db, 'families', famId, 'aiInsights'),
      (snap) => {
        const map: Record<string, AiInsight> = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Omit<AiInsight, 'id'>) };
        });
        setAiInsights(map);
      },
      (err) => console.warn('AI insights listener warning:', err)
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
            ...sanitizeUserFields(user),
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('Language preference sync warning:', err);
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
      .slice(0, 30)
      .map((m) => `${m.name} (${m.dosage}, ${m.frequency})`.slice(0, 120));

    try {
      await setDoc(doc(db, 'emergencyCards', member.cardId), {
        familyId: family.id,
        ownerUid: member.ownerUid || user.uid,
        memberId: member.id,
        name: member.name.trim().slice(0, 80) || 'Member',
        age: Math.min(130, Math.max(0, Number(member.age) || 0)),
        gender: member.gender,
        bloodGroup: member.bloodGroup,
        allergies: sanitizeTags(member.allergies),
        conditions: sanitizeTags(member.conditions),
        emergencyContact: (member.emergencyContact || family.emergencyContact || '').trim().slice(0, 32),
        activeMedicines: activeMedList,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Emergency card sync warning:', err);
    }
  };

  const saveFamilySetup: FamilyContextValue['saveFamilySetup'] = async ({
    familyName,
    emergencyContact,
    members: newMembers,
  }) => {
    if (!user) throw new Error('User must be signed in.');
    const familyId = generateSecureId('fam');
    const inviteCode = generateInviteCode();
    const cleanFamilyName = (familyName.trim() || 'My Family').slice(0, 80);
    const cleanContact = emergencyContact.trim().slice(0, 32);

    try {
      await setDoc(doc(db, 'families', familyId), {
        familyName: cleanFamilyName,
        createdBy: user.uid,
        memberUids: [user.uid],
        emergencyContact: cleanContact,
        inviteCode,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'familyInvites', inviteCode), {
        familyId,
        familyName: cleanFamilyName,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      for (let i = 0; i < newMembers.length; i += 5) {
        const chunk = newMembers.slice(i, i + 5);
        const batch = writeBatch(db);
        for (const m of chunk) {
          const memberId = generateSecureId('mem');
          const cardId = generateSecureId('card');
          const cleanName = (m.name.trim() || 'Member').slice(0, 80);
          const cleanAge = Math.min(130, Math.max(0, Number(m.age) || 0));
          const cleanAllergies = sanitizeTags(m.allergies);
          const cleanConditions = sanitizeTags(m.conditions);

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
          ...sanitizeUserFields(user),
          createdAt: serverTimestamp(),
        });
      }

      return { familyId, inviteCode };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `families/${familyId}`);
    }
  };

  const lookupInviteCode: FamilyContextValue['lookupInviteCode'] = async (rawCode) => {
    const code = normalizeInviteCode(rawCode);
    if (code.length < 6 || code.length > 12) return null;

    try {
      const snap = await getDoc(doc(db, 'familyInvites', code));
      if (!snap.exists()) return null;
      const data = snap.data() as FamilyInvite;
      return {
        code,
        familyId: data.familyId,
        familyName: data.familyName,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `familyInvites/${code}`);
    }
  };

  const joinFamilyWithCode: FamilyContextValue['joinFamilyWithCode'] = async ({ code: rawCode, member }) => {
    if (!user) throw new Error('User must be signed in.');
    const code = normalizeInviteCode(rawCode);
    if (code.length < 6 || code.length > 12) {
      throw new Error('Please enter a valid 6–12 character Family Invite Code.');
    }

    let inviteData: FamilyInvite | null = null;
    try {
      const inviteSnap = await getDoc(doc(db, 'familyInvites', code));
      if (inviteSnap.exists()) {
        inviteData = inviteSnap.data() as FamilyInvite;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `familyInvites/${code}`);
    }

    if (!inviteData) {
      throw new Error('Invalid or expired Family Invite Code. Please check the code and try again.');
    }

    const { familyId, familyName } = inviteData;
    const famRef = doc(db, 'families', familyId);

    try {
      try {
        await updateDoc(famRef, { memberUids: arrayUnion(user.uid) });
      } catch (joinErr) {
        let existingFam;
        try {
          existingFam = await getDoc(famRef);
        } catch {
          throw new Error(
            'Unable to join this family right now. The family may be full (max 25 accounts) or no longer exists.'
          );
        }
        const existingUids = (existingFam.data()?.memberUids as string[] | undefined) ?? [];
        if (!existingFam.exists()) {
          throw new Error('This family workspace no longer exists.');
        }
        if (existingUids.length >= 25 && !existingUids.includes(user.uid)) {
          throw new Error('This family workspace has reached its maximum limit of 25 linked accounts.');
        }
        if (!existingUids.includes(user.uid)) {
          throw joinErr;
        }
      }

      let defaultEmergencyContact = '';
      try {
        const famSnap = await getDoc(famRef);
        if (famSnap.exists()) {
          defaultEmergencyContact = ((famSnap.data()?.emergencyContact as string | undefined) ?? '')
            .trim()
            .slice(0, 32);
        }
      } catch {
        // Non-critical fallback
      }

      const memberId = generateSecureId('mem');
      const cardId = generateSecureId('card');
      const cleanName = (member.name.trim() || 'Member').slice(0, 80);
      const cleanAge = Math.min(130, Math.max(0, Number(member.age) || 0));
      const cleanAllergies = sanitizeTags(member.allergies);
      const cleanConditions = sanitizeTags(member.conditions);

      const batch = writeBatch(db);
      batch.set(doc(db, 'families', familyId, 'members', memberId), {
        ownerUid: user.uid,
        name: cleanName,
        age: cleanAge,
        gender: member.gender,
        bloodGroup: member.bloodGroup,
        allergies: cleanAllergies,
        conditions: cleanConditions,
        emergencyContact: defaultEmergencyContact,
        cardId,
        createdAt: serverTimestamp(),
      });

      batch.set(doc(db, 'emergencyCards', cardId), {
        familyId,
        ownerUid: user.uid,
        memberId,
        name: cleanName,
        age: cleanAge,
        gender: member.gender,
        bloodGroup: member.bloodGroup,
        allergies: cleanAllergies,
        conditions: cleanConditions,
        emergencyContact: defaultEmergencyContact,
        activeMedicines: [],
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, { familyId });
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          familyId,
          language,
          ...sanitizeUserFields(user),
          createdAt: serverTimestamp(),
        });
      }

      return { familyId, familyName };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `families/${familyId}`);
    }
  };

  const ensureInviteCode: FamilyContextValue['ensureInviteCode'] = async (regenerate = false) => {
    if (!user || !family) return null;

    if (family.inviteCode && !regenerate) {
      try {
        const existingInvite = await getDoc(doc(db, 'familyInvites', family.inviteCode));
        if (existingInvite.exists()) {
          return family.inviteCode;
        }
        if (user.uid === family.createdBy) {
          await setDoc(doc(db, 'familyInvites', family.inviteCode), {
            familyId: family.id,
            familyName: family.familyName,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch {
        // Return existing code even if verification hiccups
      }
      return family.inviteCode;
    }

    if (user.uid !== family.createdBy) {
      return family.inviteCode ?? null;
    }

    const oldCode = family.inviteCode;
    const newCode = generateInviteCode();
    try {
      await updateDoc(doc(db, 'families', family.id), { inviteCode: newCode });
      await setDoc(doc(db, 'familyInvites', newCode), {
        familyId: family.id,
        familyName: family.familyName,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      if (oldCode && oldCode !== newCode) {
        try {
          await deleteDoc(doc(db, 'familyInvites', oldCode));
        } catch {
          // Non-critical cleanup
        }
      }
      return newCode;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `families/${family.id}`);
    }
  };

  const leaveFamily = async () => {
    if (!user || !family) return;
    if (user.uid === family.createdBy) {
      throw new Error('Family creator cannot leave; use Delete Family Workspace instead.');
    }
    const famId = family.id;
    try {
      await updateDoc(doc(db, 'families', famId), {
        memberUids: arrayRemove(user.uid),
      }).catch(() => {});
      await updateDoc(doc(db, 'users', user.uid), { familyId: '' });
      setFamily(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `families/${famId}`);
    }
  };

  const addFamilyMember: FamilyContextValue['addFamilyMember'] = async (member) => {
    if (!user || !family) throw new Error('Family not initialized');
    const memberId = generateSecureId('mem');
    const cardId = generateSecureId('card');
    const cleanName = (member.name.trim() || 'Member').slice(0, 80);
    const cleanAge = Math.min(130, Math.max(0, Number(member.age) || 0));
    const contact = (member.emergencyContact ?? family.emergencyContact ?? '').trim().slice(0, 32);
    const cleanAllergies = sanitizeTags(member.allergies);
    const cleanConditions = sanitizeTags(member.conditions);

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'families', family.id, 'members', memberId), {
        ownerUid: user.uid,
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
        ownerUid: user.uid,
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
    const cleanName = (familyName.trim() || 'My Family').slice(0, 80);
    const cleanContact = emergencyContact.trim().slice(0, 32);
    try {
      await updateDoc(doc(db, 'families', family.id), {
        familyName: cleanName,
        emergencyContact: cleanContact,
      });
      if (family.inviteCode && user?.uid === family.createdBy) {
        try {
          const inviteRef = doc(db, 'familyInvites', family.inviteCode);
          const inviteSnap = await getDoc(inviteRef);
          if (inviteSnap.exists()) {
            await updateDoc(inviteRef, { familyName: cleanName });
          }
        } catch {
          // Ignore non-critical invite name sync
        }
      }
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

      if (family.inviteCode && user.uid === family.createdBy) {
        try {
          await deleteDoc(doc(db, 'familyInvites', family.inviteCode));
        } catch {
          // Ignore if invite already missing
        }
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
        lookupInviteCode,
        joinFamilyWithCode,
        ensureInviteCode,
        leaveFamily,
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
