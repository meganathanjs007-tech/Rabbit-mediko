/**
 * Security Rule Validation Suite — Rabbit Mediko
 * Documents the Dirty Dozen payload test assertions matching firestore.rules.
 */
export const DIRTY_DOZEN_CASES = [
  {
    name: '1. Unauthenticated Write to Members',
    path: '/families/fam_1/members/m1',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Shadow Field Injection on UserProfile',
    path: '/users/user_1',
    payload: { uid: 'user_1', language: 'en', createdAt: 'SERVER_TIME', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Cross-User Profile Access',
    path: '/users/user_b',
    auth: { uid: 'user_a', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Family Hijack on Create',
    path: '/families/fam_evil',
    auth: { uid: 'attacker', email_verified: true },
    payload: { familyName: 'Evil', createdBy: 'victim', memberUids: ['attacker'], createdAt: 'SERVER_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. ID Poisoning with Invalid Characters',
    path: '/families/fam_1/members/bad!id#with$chars',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Unbounded Array / String Poisoning',
    path: '/families/fam_1/members/m1',
    payload: { allergies: new Array(50).fill('Peanut') },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Client Timestamp Forgery',
    path: '/families/fam_1/healthRecords/r1',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Immutable Field Mutation (createdBy)',
    path: '/families/fam_1',
    operation: 'update',
    payload: { createdBy: 'attacker' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Blanket List Query on Emergency Cards',
    path: '/emergencyCards',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Emergency Card Owner Spoofing',
    path: '/emergencyCards/card_12345678',
    auth: { uid: 'attacker', email_verified: true },
    payload: { familyId: 'fam_victim', ownerUid: 'victim' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Type Poisoning on Grocery Check Update',
    path: '/families/fam_1/grocery/g1',
    operation: 'update',
    payload: { checked: 'yes' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Cross-Family Subcollection Write',
    path: '/families/fam_A/mealPlans/2026-11-18',
    auth: { uid: 'user_B', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
