# Rabbit Mediko — Payload-First Security Specification

## 1. Data Invariants
1. **User Isolation**: A user document at `/users/{uid}` can only be read, created, or updated by the authenticated, verified user whose `request.auth.uid == uid` and whose payload `uid == request.auth.uid`.
2. **Family Access Boundary**: A family document at `/families/{familyId}` can only be created by a verified user with `createdBy == request.auth.uid` and `request.auth.uid in memberUids` (bounded `1..10`). Subcollections under `/families/{familyId}/...` can only be accessed if the user is in the parent family's `memberUids` and `ownerUid == family.createdBy` (on list/query checks).
3. **Immutable Ownership & Timestamps**: `createdBy`, `uid`, `ownerUid`, and `createdAt` cannot be modified after creation. All `createdAt` / `updatedAt` / `takenAt` / `timestamp` fields must match `request.time`.
4. **Public Emergency Card Isolation**: `/emergencyCards/{cardId}` exposes ONLY emergency-card medical summary fields via single-document `get` (never `list`) for unauthenticated paramedics scanning a QR code. Writes to `/emergencyCards/{cardId}` are strictly restricted to the verified `ownerUid` who owns the referenced `families/{familyId}`.
5. **Bounded Arrays & Strings**: Every string field has strict `.size()` bounds; every array (`allergies`, `conditions`, `times`, `breakfast`, `lunch`, `dinner`, `snacks`, `memberUids`, `activeMedicines`) is strictly bounded in length.
6. **Zero Shadow Fields**: Every create checks `data.keys().hasAll(...) && data.keys().hasOnly(...)`; every update checks `isValid[Entity](incoming())` and `incoming().diff(existing()).affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Write**: Writing to `/families/fam_1/members/m1` with `request.auth == null`.
2. **Shadow Field Injection**: Creating `/users/{uid}` with an extra ghost field `{ uid, language: 'en', createdAt, isAdmin: true }`.
3. **Cross-User Spoofing**: Authenticated user A (`uidA`) attempting to read or write `/users/uidB`.
4. **Family Hijack on Create**: Creating `/families/fam_evil` with `createdBy: "victim_uid"`.
5. **ID Poisoning (Oversized Doc ID)**: Creating `/families/{familyId}/members/<200-char-invalid-id!@#>` with non-alphanumeric or oversized ID.
6. **Unbounded Array / Denial of Wallet**: Creating a `FamilyMember` with 50 allergy items or a 10,000-char name string.
7. **Timestamp Forgery**: Creating a `HealthRecord` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
8. **Immutable Field Mutation**: Updating `/families/{familyId}` to change `createdBy` or `createdAt`.
9. **Blanket List Scraping on Emergency Cards**: Running a collection `list` query on `/emergencyCards` without a known `cardId`.
10. **Emergency Card Spoofing**: Writing `/emergencyCards/card_victim` where `ownerUid != request.auth.uid` or referencing a `familyId` the caller does not belong to.
11. **Type Poisoning on Update**: Updating `/families/{familyId}/grocery/{itemId}` setting `checked: "yes"` (string instead of boolean).
12. **Cross-Family Subcollection Write**: Authenticated user B attempting to write `/families/fam_A/mealPlans/2026-11-18` where user B is not in `fam_A.memberUids`.
