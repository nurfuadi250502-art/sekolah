# Security Specification — School Academic Portal

## 1. Data Invariants

1. **Identity & Privilege Invariant**: A user cannot self-assign `role: 'admin'` during registration. Only the bootstrapped owner email (`nurfuadi250502@gmail.com` with `email_verified == true`) or an existing verified Admin in `/admins/{uid}` can hold or grant administrative privileges.
2. **Invite-Gated Teacher/Student Activation**: A non-admin user may only create their own `/users/{uid}` profile with `role: 'teacher'` or `role: 'student'` if a matching `/account_invites/{email}` document exists with the exact same `role` and `linkedEntityId`.
3. **Attendance Anti-Duplication & Assignment Invariant**: Attendance documents use a deterministic ID (`{date}_{classId}_{subjectId}_{studentId}`). Only an Admin or a verified Teacher assigned to that class/subject may create or update attendance, and `studentId` + `classId` + `subjectId` must reference existing records. Students cannot create, update, or delete attendance.
4. **Grade Integrity & Range Invariant**: Grade documents use a deterministic ID (`{semesterId}_{classId}_{subjectId}_{studentId}`). All numeric scores (`tugas`, `kuis`, `ulanganHarian`, `pts`, `pas`, `praktik`, `finalScore`) must be numbers in `[0, 100]`. Students cannot create, update, or delete grades.
5. **PII Isolation Invariant**: Collections holding personal emails, phone numbers, or home addresses (`users`, `students`, `teachers`, `account_invites`) never allow blanket `isSignedIn()` reads. Students can only read their own `students` and `users` documents; Teachers can only read `students` in their assigned classes or their own profile; Admins have full access.
6. **Immutable Audit Trail Invariant**: `activity_logs` documents are append-only for authenticated users logging their own `userId == request.auth.uid`, and can NEVER be updated or deleted by any client (including Admins via client rules if immutable, or read-only for Admins).
7. **Temporal & Structural Integrity**: All `createdAt` fields must equal `request.time` on create and remain unchanged on update. All `updatedAt` fields must equal `request.time`. All string fields enforce strict `.size()` upper bounds and IDs match `^[a-zA-Z0-9_\-]+$`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Privilege Escalation on Signup**: Unprivileged user writes `/users/{uid}` with `{ role: "admin" }`. -> `PERMISSION_DENIED`.
2. **Role Tampering on Update**: Student updates `/users/{uid}` changing `role` from `"student"` to `"teacher"`. -> `PERMISSION_DENIED`.
3. **Unverified Email Spoofing**: Token has `email: "nurfuadi250502@gmail.com"` and `email_verified: false`. -> `PERMISSION_DENIED`.
4. **Student Grade Manipulation**: Student writes to `/grades/{gradeId}` setting `pas: 100`. -> `PERMISSION_DENIED`.
5. **Student Attendance Forgery**: Student updates `/attendance/{attId}` changing `status: "Alpa"` to `"Hadir"`. -> `PERMISSION_DENIED`.
6. **Shadow / Ghost Field Injection**: Teacher creates grade with extra field `isBypassed: true`. -> `PERMISSION_DENIED` (`hasOnly` check).
7. **Score Out-of-Bounds Poisoning**: Teacher submits grade with `tugas: 150` or `kuis: -10`. -> `PERMISSION_DENIED`.
8. **Path / ID Poisoning**: Attacker writes document with 500-character ID or invalid characters `../../admin`. -> `PERMISSION_DENIED` (`isValidId`).
9. **Blanket PII Scraping**: Student runs `getDocs(collection(db, 'students'))` without filtering to own `userId`. -> `PERMISSION_DENIED`.
10. **Audit Log Tampering**: User attempts `deleteDoc` or `updateDoc` on `/activity_logs/{logId}` to erase evidence. -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Client sends `createdAt: Timestamp.fromMillis(0)` instead of `serverTimestamp()`. -> `PERMISSION_DENIED`.
12. **Teacher Cross-Class Tampering**: Teacher attempts to write grades for a `classId` not assigned to them. -> `PERMISSION_DENIED`.
