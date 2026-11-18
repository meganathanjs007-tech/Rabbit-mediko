import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { addDaysISO, generateSecureId, getTodayISO } from '../utils/helpers';
import { db, handleFirestoreError, OperationType } from './firebase';

export async function seedDemoFamily(
  uid: string,
  userEmail?: string | null,
  userPhone?: string | null
): Promise<string> {
  const familyId = generateSecureId('fam');
  const emergencyPhone = '+91 98401 22334';
  const today = getTodayISO();

  // 1. Create Family root first so rules recognize membership for subcollections
  try {
    await setDoc(doc(db, 'families', familyId), {
      familyName: 'Sharma Family',
      createdBy: uid,
      memberUids: [uid],
      emergencyContact: emergencyPhone,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `families/${familyId}`);
  }

  const rameshId = generateSecureId('mem');
  const lakshmiId = generateSecureId('mem');
  const priyaId = generateSecureId('mem');

  const rameshCardId = generateSecureId('card');
  const lakshmiCardId = generateSecureId('card');
  const priyaCardId = generateSecureId('card');

  // 2. Members & Public Emergency Cards (6 docs)
  try {
    const batch1 = writeBatch(db);

    batch1.set(doc(db, 'families', familyId, 'members', rameshId), {
      ownerUid: uid,
      name: 'Ramesh Sharma',
      age: 58,
      gender: 'M',
      bloodGroup: 'B+',
      allergies: ['Penicillin'],
      conditions: ['Diabetes', 'BP'],
      emergencyContact: emergencyPhone,
      cardId: rameshCardId,
      createdAt: serverTimestamp(),
    });

    batch1.set(doc(db, 'families', familyId, 'members', lakshmiId), {
      ownerUid: uid,
      name: 'Lakshmi Sharma',
      age: 54,
      gender: 'F',
      bloodGroup: 'O+',
      allergies: ['None'],
      conditions: ['Thyroid'],
      emergencyContact: emergencyPhone,
      cardId: lakshmiCardId,
      createdAt: serverTimestamp(),
    });

    batch1.set(doc(db, 'families', familyId, 'members', priyaId), {
      ownerUid: uid,
      name: 'Priya Sharma',
      age: 24,
      gender: 'F',
      bloodGroup: 'A+',
      allergies: ['Peanut'],
      conditions: ['None'],
      emergencyContact: emergencyPhone,
      cardId: priyaCardId,
      createdAt: serverTimestamp(),
    });

    batch1.set(doc(db, 'emergencyCards', rameshCardId), {
      familyId,
      ownerUid: uid,
      memberId: rameshId,
      name: 'Ramesh Sharma',
      age: 58,
      gender: 'M',
      bloodGroup: 'B+',
      allergies: ['Penicillin'],
      conditions: ['Diabetes', 'BP'],
      emergencyContact: emergencyPhone,
      activeMedicines: ['Metformin 500mg (1 Tablet, Twice)', 'Amlodipine 5mg (1 Tablet, Once)'],
      updatedAt: serverTimestamp(),
    });

    batch1.set(doc(db, 'emergencyCards', lakshmiCardId), {
      familyId,
      ownerUid: uid,
      memberId: lakshmiId,
      name: 'Lakshmi Sharma',
      age: 54,
      gender: 'F',
      bloodGroup: 'O+',
      allergies: ['None'],
      conditions: ['Thyroid'],
      emergencyContact: emergencyPhone,
      activeMedicines: ['Thyronorm 50mcg (1 Tablet, Once)'],
      updatedAt: serverTimestamp(),
    });

    batch1.set(doc(db, 'emergencyCards', priyaCardId), {
      familyId,
      ownerUid: uid,
      memberId: priyaId,
      name: 'Priya Sharma',
      age: 24,
      gender: 'F',
      bloodGroup: 'A+',
      allergies: ['Peanut'],
      conditions: ['None'],
      emergencyContact: emergencyPhone,
      activeMedicines: [],
      updatedAt: serverTimestamp(),
    });

    await batch1.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `families/${familyId}/members`);
  }

  // 3. BP Readings (7 docs)
  try {
    const batch2 = writeBatch(db);
    const bpReadings = [
      { offset: -12, sys: 144, dia: 92 },
      { offset: -10, sys: 138, dia: 88 },
      { offset: -8, sys: 132, dia: 84 },
      { offset: -6, sys: 126, dia: 82 },
      { offset: -4, sys: 122, dia: 78 },
      { offset: -2, sys: 118, dia: 76 },
      { offset: 0, sys: 134, dia: 86 },
    ];

    for (const bp of bpReadings) {
      batch2.set(doc(db, 'families', familyId, 'healthRecords', generateSecureId('rec')), {
        ownerUid: uid,
        memberId: rameshId,
        type: 'BP',
        value: `${bp.sys}/${bp.dia} mmHg`,
        systolic: bp.sys,
        diastolic: bp.dia,
        date: addDaysISO(today, bp.offset),
        notes: bp.sys > 120 ? 'Morning check — slightly elevated' : 'Resting morning check',
        createdAt: serverTimestamp(),
      });
    }
    await batch2.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `families/${familyId}/healthRecords`);
  }

  // 4. Sugar Readings + Doctor Visits (7 docs)
  try {
    const batch3 = writeBatch(db);
    const sugarReadings = [
      { offset: -9, val: 142 },
      { offset: -7, val: 134 },
      { offset: -5, val: 118 },
      { offset: -3, val: 96 },
      { offset: 0, val: 126 },
    ];

    for (const sg of sugarReadings) {
      batch3.set(doc(db, 'families', familyId, 'healthRecords', generateSecureId('rec')), {
        ownerUid: uid,
        memberId: rameshId,
        type: 'Sugar',
        value: `${sg.val} mg/dL`,
        numericValue: sg.val,
        date: addDaysISO(today, sg.offset),
        notes: 'Fasting blood glucose',
        createdAt: serverTimestamp(),
      });
    }

    batch3.set(doc(db, 'families', familyId, 'healthRecords', generateSecureId('rec')), {
      ownerUid: uid,
      memberId: rameshId,
      type: 'DoctorVisit',
      value: 'Quarterly Diabetes & BP Review',
      date: addDaysISO(today, -14),
      doctorName: 'Dr. S. Karthikeyan (Apollo Clinic)',
      notes: 'Continue Metformin 500mg twice daily and reduce evening salt intake. Follow-up in 3 months.',
      createdAt: serverTimestamp(),
    });

    batch3.set(doc(db, 'families', familyId, 'healthRecords', generateSecureId('rec')), {
      ownerUid: uid,
      memberId: lakshmiId,
      type: 'DoctorVisit',
      value: 'TSH Follow-up Consultation',
      date: addDaysISO(today, -20),
      doctorName: 'Dr. Meena Sundaram',
      notes: 'TSH level stable at 2.8 mIU/L. Continue Thyronorm 50mcg empty stomach.',
      createdAt: serverTimestamp(),
    });

    await batch3.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `families/${familyId}/healthRecords`);
  }

  // 5. Medicines + Meal Plans (10 docs)
  try {
    const batch4 = writeBatch(db);

    batch4.set(doc(db, 'families', familyId, 'medicines', generateSecureId('med')), {
      ownerUid: uid,
      memberId: rameshId,
      name: 'Metformin 500mg',
      dosage: '1 Tablet',
      frequency: 'Twice',
      times: ['08:00', '20:00'],
      startDate: addDaysISO(today, -30),
      endDate: addDaysISO(today, 60),
      expiryDate: addDaysISO(today, 120),
      active: true,
      createdAt: serverTimestamp(),
    });

    batch4.set(doc(db, 'families', familyId, 'medicines', generateSecureId('med')), {
      ownerUid: uid,
      memberId: rameshId,
      name: 'Amlodipine 5mg',
      dosage: '1 Tablet',
      frequency: 'Once',
      times: ['09:00'],
      startDate: addDaysISO(today, -30),
      endDate: addDaysISO(today, 60),
      expiryDate: addDaysISO(today, 5),
      active: true,
      createdAt: serverTimestamp(),
    });

    batch4.set(doc(db, 'families', familyId, 'medicines', generateSecureId('med')), {
      ownerUid: uid,
      memberId: lakshmiId,
      name: 'Thyronorm 50mcg',
      dosage: '1 Tablet',
      frequency: 'Once',
      times: ['06:30'],
      startDate: addDaysISO(today, -45),
      endDate: addDaysISO(today, 90),
      expiryDate: addDaysISO(today, 90),
      active: true,
      createdAt: serverTimestamp(),
    });

    const weeklyMenus = [
      {
        breakfast: ['Idli', 'Sambar'],
        lunch: ['Rice', 'Sambar', 'Vegetable Kootu'],
        dinner: ['Chapati', 'Dal Tadka'],
        snacks: ['Sprouts Salad'],
      },
      {
        breakfast: ['Ragi Koozh', 'Upma'],
        lunch: ['Rice', 'Rasam', 'Curd Rice'],
        dinner: ['Dosa', 'Sambar'],
        snacks: ['Oats Porridge'],
      },
      {
        breakfast: ['Pongal', 'Sambar'],
        lunch: ['Chapati', 'Dal Tadka', 'Vegetable Kootu'],
        dinner: ['Idli', 'Rasam'],
        snacks: ['Sprouts Salad'],
      },
      {
        breakfast: ['Oats Porridge', 'Idli'],
        lunch: ['Rice', 'Sambar', 'Curd Rice'],
        dinner: ['Chapati', 'Vegetable Kootu'],
        snacks: ['Upma'],
      },
      {
        breakfast: ['Dosa', 'Sambar'],
        lunch: ['Rice', 'Rasam', 'Dal Tadka'],
        dinner: ['Ragi Koozh', 'Chapati'],
        snacks: ['Sprouts Salad'],
      },
      {
        breakfast: ['Upma', 'Idli'],
        lunch: ['Biriyani', 'Curd Rice'],
        dinner: ['Dosa', 'Sambar'],
        snacks: ['Oats Porridge'],
      },
      {
        breakfast: ['Pongal', 'Sambar'],
        lunch: ['Rice', 'Sambar', 'Vegetable Kootu'],
        dinner: ['Chapati', 'Dal Tadka'],
        snacks: ['Curd Rice'],
      },
    ];

    weeklyMenus.forEach((menu, idx) => {
      const dateISO = addDaysISO(today, idx);
      batch4.set(doc(db, 'families', familyId, 'mealPlans', dateISO), {
        ownerUid: uid,
        date: dateISO,
        ...menu,
        updatedAt: serverTimestamp(),
      });
    });

    await batch4.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `families/${familyId}/medicines`);
  }

  // 6. Sample Grocery List (7 docs)
  try {
    const batch5 = writeBatch(db);
    const sampleGroceries: Array<{ name: string; category: 'Vegetables' | 'Grains' | 'Dairy' | 'Others'; checked: boolean }> = [
      { name: 'Tomatoes & Drumstick', category: 'Vegetables', checked: false },
      { name: 'Bottle Gourd & Spinach', category: 'Vegetables', checked: false },
      { name: 'Whole Wheat Atta', category: 'Grains', checked: true },
      { name: 'Toor Dal & Moong Dal', category: 'Grains', checked: false },
      { name: 'Ragi (Finger Millet) Flour', category: 'Grains', checked: false },
      { name: 'Fresh Curd & Low-fat Milk', category: 'Dairy', checked: false },
      { name: 'Tamarind & Sambar Powder', category: 'Others', checked: true },
    ];

    for (const item of sampleGroceries) {
      batch5.set(doc(db, 'families', familyId, 'grocery', generateSecureId('grc')), {
        ownerUid: uid,
        ...item,
        createdAt: serverTimestamp(),
      });
    }
    await batch5.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `families/${familyId}/grocery`);
  }

  // 7. Link UserProfile to familyId last so listeners see fully populated data
  const userRef = doc(db, 'users', uid);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, { familyId });
    } else {
      await setDoc(userRef, {
        uid,
        familyId,
        language: 'en',
        ...(userEmail ? { email: userEmail } : {}),
        ...(userPhone ? { phone: userPhone } : {}),
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }

  return familyId;
}
