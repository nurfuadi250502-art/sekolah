import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import {
  AcademicYear,
  AccountInvite,
  ActivityLog,
  Announcement,
  AttendanceRecord,
  AttendanceStatus,
  DEFAULT_GRADE_BANDS,
  DEFAULT_GRADE_WEIGHTS,
  DEFAULT_SCHOOL_SETTINGS,
  GradeRangeBands,
  GradeRecord,
  GradeWeights,
  normalizeGradeWeights,
  NotificationItem,
  RangeCalculationMode,
  Schedule,
  SchoolClass,
  SchoolSettings,
  Semester,
  Student,
  Subject,
  SubjectGradingConfig,
  Teacher,
  UserProfile,
  UserRole,
  WrittenBabScoreEntry,
  WrittenExamBab,
} from '../types/portal';

export function makeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function sanitizeId(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export function boundString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function computeWrittenExamScore(
  babs: WrittenExamBab[],
  scoresByBabId: Record<string, number[]>,
  range: { rangeMin: number; rangeMax: number; rangeMode: RangeCalculationMode }
): {
  writtenDetails: WrittenBabScoreEntry[];
  totalEarned: number;
  totalMax: number;
  convertedScore: number;
} {
  let totalEarned = 0;
  let totalMax = 0;
  const writtenDetails: WrittenBabScoreEntry[] = [];

  for (const bab of babs) {
    const qCount = Math.max(1, Math.min(100, Math.round(bab.questionCount || 1)));
    const maxPerQ = Math.max(1, Number(bab.maxPerQuestion || 1));
    const rawList = scoresByBabId[bab.id] || [];
    const questionScores: number[] = [];
    let babSubtotal = 0;

    for (let i = 0; i < qCount; i++) {
      const val = Math.max(0, Math.min(maxPerQ, Number(rawList[i] ?? 0)));
      const cleanVal = Number.isNaN(val) ? 0 : Math.round(val * 100) / 100;
      questionScores.push(cleanVal);
      babSubtotal += cleanVal;
    }

    const babMaxTotal = Math.round(qCount * maxPerQ * 100) / 100;
    babSubtotal = Math.round(babSubtotal * 100) / 100;
    totalEarned += babSubtotal;
    totalMax += babMaxTotal;

    writtenDetails.push({
      babId: bab.id,
      babTitle: bab.title,
      questionScores,
      maxPerQuestion: maxPerQ,
      subtotal: babSubtotal,
      maxTotal: babMaxTotal,
    });
  }

  totalEarned = Math.round(totalEarned * 100) / 100;
  totalMax = Math.round(totalMax * 100) / 100;

  const rMin = Number(range.rangeMin ?? 0);
  const rMax = Number(range.rangeMax ?? 100);
  let rawConverted = rMin;
  if (range.rangeMode === 'direct') {
    rawConverted = Math.min(rMax, Math.max(rMin, totalEarned));
  } else {
    rawConverted =
      totalMax > 0 ? rMin + (totalEarned / totalMax) * (rMax - rMin) : rMin;
    rawConverted = Math.min(rMax, Math.max(rMin, rawConverted));
  }

  return {
    writtenDetails,
    totalEarned,
    totalMax,
    convertedScore: Math.round(rawConverted * 100) / 100,
  };
}

export function computeFinalScore(
  scores: {
    ujianLisan: number;
    ujianTulis: number;
  },
  weights: GradeWeights = DEFAULT_GRADE_WEIGHTS,
  gradeBands?: GradeRangeBands,
  maxScale = 100
): { finalScore: number; letterGrade: string } {
  const safeWeights = normalizeGradeWeights(weights);
  const totalWeight = safeWeights.ujianLisan + safeWeights.ujianTulis || 100;

  const weighted =
    (Number(scores.ujianLisan || 0) * safeWeights.ujianLisan +
      Number(scores.ujianTulis || 0) * safeWeights.ujianTulis) /
    totalWeight;

  const upperBound = Math.max(100, Number(maxScale || 100));
  const finalScore = Math.min(upperBound, Math.max(0, Math.round(weighted * 100) / 100));

  const bands = gradeBands || DEFAULT_GRADE_BANDS;
  const evalScore =
    !gradeBands && maxScale > 0 && maxScale !== 100
      ? (finalScore / maxScale) * 100
      : finalScore;

  let letterGrade = 'E';
  if (evalScore >= bands.aMin) letterGrade = 'A';
  else if (evalScore >= bands.bMin) letterGrade = 'B';
  else if (evalScore >= bands.cMin) letterGrade = 'C';
  else if (evalScore >= bands.dMin) letterGrade = 'D';

  return { finalScore, letterGrade };
}

export async function logActivity(params: {
  userId: string;
  userName: string;
  userRole: UserRole | 'system';
  actionType: string;
  targetObject: string;
  details?: string;
}): Promise<void> {
  const id = makeId('log');
  try {
    await setDoc(doc(db, 'activity_logs', id), {
      id,
      userId: sanitizeId(params.userId),
      userName: boundString(params.userName || 'Pengguna', 120),
      userRole: params.userRole,
      actionType: boundString(params.actionType, 64),
      targetObject: boundString(params.targetObject, 200),
      details: boundString(params.details || '', 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Gagal mencatat log aktivitas:', error);
  }
}

export async function createNotification(params: {
  recipientUserId?: string;
  recipientRole: 'all' | 'admin' | 'teacher' | 'student';
  title: string;
  message: string;
  category: 'announcement' | 'grade' | 'attendance' | 'system';
}): Promise<void> {
  const id = makeId('ntf');
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      ...(params.recipientUserId ? { recipientUserId: sanitizeId(params.recipientUserId) } : {}),
      recipientRole: params.recipientRole,
      title: boundString(params.title, 160),
      message: boundString(params.message, 400),
      category: params.category,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Gagal membuat notifikasi:', error);
  }
}

export async function getSchoolSettings(): Promise<SchoolSettings> {
  try {
    const snap = await getDoc(doc(db, 'school_settings', 'main'));
    if (snap.exists()) {
      const data = snap.data() as SchoolSettings;
      return {
        ...DEFAULT_SCHOOL_SETTINGS,
        ...data,
        gradeWeights: normalizeGradeWeights(data.gradeWeights),
      } as SchoolSettings;
    }
    return DEFAULT_SCHOOL_SETTINGS as SchoolSettings;
  } catch (error) {
    console.warn('Menggunakan pengaturan sekolah default:', error);
    return DEFAULT_SCHOOL_SETTINGS as SchoolSettings;
  }
}

export async function saveSchoolSettings(
  data: Omit<SchoolSettings, 'updatedAt'>,
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  try {
    await setDoc(doc(db, 'school_settings', 'main'), {
      schoolName: boundString(data.schoolName, 160),
      tagline: boundString(data.tagline || '', 240),
      welcomeTitle: boundString(data.welcomeTitle || '', 160),
      welcomeMessage: boundString(data.welcomeMessage, 2000),
      principalName: boundString(data.principalName || '', 120),
      logoUrl: boundString(data.logoUrl || '', 500),
      address: boundString(data.address, 300),
      phone: boundString(data.phone, 40),
      email: boundString(data.email, 160),
      website: boundString(data.website || '', 160),
      npsn: boundString(data.npsn || '', 32),
      accreditation: boundString(data.accreditation || '', 20),
      gradeWeights: data.gradeWeights,
      minScore: Number(data.minScore ?? 0),
      maxScore: Number(data.maxScore ?? 100),
      allowStudentReportDownload: Boolean(data.allowStudentReportDownload),
      allowStudentPhotoChange: Boolean(data.allowStudentPhotoChange),
      calendarEvents: (data.calendarEvents || []).slice(0, 100),
      wpSiteUrl: boundString(data.wpSiteUrl || '', 240),
      wpSyncEnabled: Boolean(data.wpSyncEnabled),
      wpShowOnPublicHome:
        data.wpShowOnPublicHome === undefined ? true : Boolean(data.wpShowOnPublicHome),
      wpCategoryId: boundString(data.wpCategoryId || '', 40),
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: 'UPDATE_SCHOOL_SETTINGS',
      targetObject: data.schoolName,
      details: 'Memperbarui profil sekolah, integrasi WordPress, atau kalender akademik',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'school_settings/main');
  }
}

// Public announcements & academic info
export async function fetchPublicAnnouncements(): Promise<Announcement[]> {
  try {
    const q = query(
      collection(db, 'announcements'),
      where('targetRole', '==', 'all'),
      limit(12)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as Announcement)
      .sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));
  } catch (error) {
    console.warn('Gagal memuat pengumuman publik:', error);
    return [];
  }
}

export async function fetchPublicAcademicInfo(): Promise<{
  academicYears: AcademicYear[];
  semesters: Semester[];
  subjects: Subject[];
}> {
  try {
    const [yearsSnap, semSnap, subSnap] = await Promise.all([
      getDocs(collection(db, 'academic_years')),
      getDocs(collection(db, 'semesters')),
      getDocs(collection(db, 'subjects')),
    ]);
    return {
      academicYears: yearsSnap.docs.map((d) => d.data() as AcademicYear),
      semesters: semSnap.docs.map((d) => d.data() as Semester),
      subjects: subSnap.docs.map((d) => d.data() as Subject),
    };
  } catch (error) {
    console.warn('Gagal memuat info akademik publik:', error);
    return { academicYears: [], semesters: [], subjects: [] };
  }
}

// Sync teacherIds across classes and students so teacher security rules stay accurate
export async function syncClassTeacherAssignments(): Promise<void> {
  try {
    const [teachersSnap, classesSnap, studentsSnap] = await Promise.all([
      getDocs(collection(db, 'teachers')),
      getDocs(collection(db, 'classes')),
      getDocs(collection(db, 'students')),
    ]);

    const classToTeachers = new Map<string, Set<string>>();
    for (const tDoc of teachersSnap.docs) {
      const t = tDoc.data() as Teacher;
      if (t.employmentStatus === 'inactive') continue;
      for (const cid of t.classIds || []) {
        if (!classToTeachers.has(cid)) classToTeachers.set(cid, new Set());
        classToTeachers.get(cid)!.add(t.id);
      }
    }

    const batch = writeBatch(db);
    let ops = 0;

    for (const cDoc of classesSnap.docs) {
      const c = cDoc.data() as SchoolClass;
      const desired = Array.from(classToTeachers.get(c.id) || []).slice(0, 50);
      if (c.homeroomTeacherId && !desired.includes(c.homeroomTeacherId)) {
        desired.push(c.homeroomTeacherId);
      }
      batch.update(cDoc.ref, {
        teacherIds: desired,
        updatedAt: serverTimestamp(),
      });
      ops++;
    }

    for (const sDoc of studentsSnap.docs) {
      const s = sDoc.data() as Student;
      const desired = Array.from(classToTeachers.get(s.classId) || []).slice(0, 50);
      batch.update(sDoc.ref, {
        assignedTeacherIds: desired,
        updatedAt: serverTimestamp(),
      });
      ops++;
    }

    if (ops > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.warn('Sinkronisasi penugasan kelas-guru dilewati:', error);
  }
}

// STUDENTS CRUD
export async function saveStudent(
  payload: Omit<Student, 'createdAt' | 'updatedAt'> & { isNew?: boolean },
  actor: { uid: string; name: string; role: UserRole },
  existingStudents: Student[]
): Promise<void> {
  const nisClean = boundString(payload.nis, 40);
  const nisnClean = boundString(payload.nisn, 40);

  const duplicate = existingStudents.find(
    (s) => s.id !== payload.id && (s.nis === nisClean || s.nisn === nisnClean)
  );
  if (duplicate) {
    throw new Error(
      duplicate.nis === nisClean
        ? `NIS ${nisClean} sudah terdaftar atas nama ${duplicate.fullName}.`
        : `NISN ${nisnClean} sudah terdaftar atas nama ${duplicate.fullName}.`
    );
  }

  const id = sanitizeId(payload.id || makeId('stu'));
  const path = `students/${id}`;
  try {
    const classTeachersSnap = payload.classId
      ? await getDoc(doc(db, 'classes', payload.classId))
      : null;
    const assignedTeacherIds =
      classTeachersSnap && classTeachersSnap.exists()
        ? ((classTeachersSnap.data() as SchoolClass).teacherIds || []).slice(0, 50)
        : payload.assignedTeacherIds || [];

    const docData: Record<string, unknown> = {
      id,
      userId: boundString(payload.userId || '', 128),
      nis: nisClean,
      nisn: nisnClean,
      fullName: boundString(payload.fullName, 120),
      gender: payload.gender,
      birthPlace: boundString(payload.birthPlace || '', 80),
      birthDate: boundString(payload.birthDate || '', 20),
      address: boundString(payload.address || '', 300),
      phone: boundString(payload.phone || '', 32),
      email: boundString(payload.email, 160).toLowerCase(),
      parentName: boundString(payload.parentName || '', 120),
      classId: boundString(payload.classId, 128),
      className: boundString(payload.className || '', 64),
      entryYear: Number(payload.entryYear) || new Date().getFullYear(),
      status: payload.status,
      photoUrl: boundString(payload.photoUrl || '', 500),
      assignedTeacherIds,
      updatedAt: serverTimestamp(),
    };

    if (payload.isNew) {
      docData.createdAt = serverTimestamp();
      await setDoc(doc(db, 'students', id), docData);
    } else {
      await updateDoc(doc(db, 'students', id), docData);
    }

    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: payload.isNew ? 'CREATE_STUDENT' : 'UPDATE_STUDENT',
      targetObject: `${docData.fullName} (${nisClean})`,
      details: `Kelas ${docData.className || docData.classId}`,
    });
  } catch (error) {
    handleFirestoreError(error, payload.isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteStudent(
  student: Student,
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const path = `students/${student.id}`;
  try {
    await deleteDoc(doc(db, 'students', student.id));
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: 'DELETE_STUDENT',
      targetObject: `${student.fullName} (${student.nis})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// TEACHERS CRUD
export async function saveTeacher(
  payload: Omit<Teacher, 'createdAt' | 'updatedAt'> & { isNew?: boolean },
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const id = sanitizeId(payload.id || makeId('tch'));
  const path = `teachers/${id}`;
  try {
    const docData: Record<string, unknown> = {
      id,
      userId: boundString(payload.userId || '', 128),
      nip: boundString(payload.nip || '', 40),
      teacherCode: boundString(payload.teacherCode, 40),
      fullName: boundString(payload.fullName, 120),
      gender: payload.gender,
      address: boundString(payload.address || '', 300),
      phone: boundString(payload.phone || '', 32),
      email: boundString(payload.email, 160).toLowerCase(),
      subjectIds: (payload.subjectIds || []).slice(0, 30),
      subjectNames: (payload.subjectNames || []).slice(0, 30),
      classIds: (payload.classIds || []).slice(0, 40),
      classNames: (payload.classNames || []).slice(0, 40),
      employmentStatus: payload.employmentStatus,
      photoUrl: boundString(payload.photoUrl || '', 500),
      updatedAt: serverTimestamp(),
    };

    if (payload.isNew) {
      docData.createdAt = serverTimestamp();
      await setDoc(doc(db, 'teachers', id), docData);
    } else {
      await updateDoc(doc(db, 'teachers', id), docData);
    }

    await syncClassTeacherAssignments();
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: payload.isNew ? 'CREATE_TEACHER' : 'UPDATE_TEACHER',
      targetObject: `${docData.fullName} (${docData.teacherCode})`,
    });
  } catch (error) {
    handleFirestoreError(error, payload.isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteTeacher(
  teacher: Teacher,
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const path = `teachers/${teacher.id}`;
  try {
    await deleteDoc(doc(db, 'teachers', teacher.id));
    await syncClassTeacherAssignments();
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: 'DELETE_TEACHER',
      targetObject: `${teacher.fullName} (${teacher.teacherCode})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ACCOUNT INVITES (PROVISIONING TEACHER/STUDENT ACCOUNTS WITHOUT PLAINTEXT PASSWORDS)
export async function createAccountInvite(
  invite: Omit<AccountInvite, 'createdAt' | 'updatedAt' | 'createdBy'>,
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const emailLower = boundString(invite.email, 160).toLowerCase();
  const linkedEntityId = sanitizeId(invite.linkedEntityId);
  if (!emailLower || !linkedEntityId) {
    throw new Error('Email dan ID entitas wajib diisi untuk menyiapkan akun.');
  }
  const path = `account_invites/${emailLower}`;
  try {
    const inviteRef = doc(db, 'account_invites', emailLower);
    const existingSnap = await getDoc(inviteRef);
    const existingStatus = existingSnap.exists()
      ? (existingSnap.data() as AccountInvite).status
      : undefined;
    const nextStatus =
      existingStatus === 'activated' && (!invite.status || invite.status === 'pending')
        ? 'activated'
        : invite.status || 'pending';

    if (existingSnap.exists()) {
      await updateDoc(inviteRef, {
        email: emailLower,
        role: invite.role,
        linkedEntityId,
        fullName: boundString(invite.fullName, 120),
        identityCode: boundString(invite.identityCode || '', 64),
        status: nextStatus,
        createdBy: actor.uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(inviteRef, {
        email: emailLower,
        role: invite.role,
        linkedEntityId,
        fullName: boundString(invite.fullName, 120),
        identityCode: boundString(invite.identityCode || '', 64),
        status: nextStatus,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: 'PROVISION_ACCOUNT',
      targetObject: `${invite.fullName} (${emailLower})`,
      details: `Peran: ${invite.role}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserAccess(
  user: UserProfile,
  updates: { role?: UserRole; isActive?: boolean },
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    if (updates.role === 'admin') {
      await setDoc(doc(db, 'admins', user.uid), {
        uid: user.uid,
        email: user.email,
        grantedAt: serverTimestamp(),
      });
    } else if (updates.role) {
      await deleteDoc(doc(db, 'admins', user.uid)).catch(() => {});
    }
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: 'UPDATE_USER_ACCESS',
      targetObject: `${user.displayName} (${user.email})`,
      details: JSON.stringify(updates),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// CLASSES, SUBJECTS, ACADEMIC YEARS, SEMESTERS, SCHEDULES
export async function saveClass(
  payload: Omit<SchoolClass, 'createdAt' | 'updatedAt'> & { isNew?: boolean },
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const id = sanitizeId(payload.id || makeId('cls'));
  const path = `classes/${id}`;
  try {
    const data: Record<string, unknown> = {
      id,
      name: boundString(payload.name, 64),
      gradeLevel: boundString(payload.gradeLevel, 20),
      homeroomTeacherId: boundString(payload.homeroomTeacherId || '', 128),
      homeroomTeacherName: boundString(payload.homeroomTeacherName || '', 120),
      academicYearId: boundString(payload.academicYearId, 128),
      capacity: Math.min(100, Math.max(1, Number(payload.capacity) || 36)),
      room: boundString(payload.room || '', 40),
      teacherIds: (payload.teacherIds || []).slice(0, 50),
      updatedAt: serverTimestamp(),
    };
    if (payload.isNew) {
      data.createdAt = serverTimestamp();
      await setDoc(doc(db, 'classes', id), data);
    } else {
      await updateDoc(doc(db, 'classes', id), data);
    }
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: payload.isNew ? 'CREATE_CLASS' : 'UPDATE_CLASS',
      targetObject: String(data.name),
    });
  } catch (error) {
    handleFirestoreError(error, payload.isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveSubject(
  payload: Omit<Subject, 'createdAt' | 'updatedAt'> & { isNew?: boolean },
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const id = sanitizeId(payload.id || makeId('sub'));
  const path = `subjects/${id}`;
  try {
    const data: Record<string, unknown> = {
      id,
      code: boundString(payload.code, 24),
      name: boundString(payload.name, 100),
      category: boundString(payload.category || 'Umum', 60),
      gradeLevel: boundString(payload.gradeLevel || 'Semua', 20),
      kkm: Math.min(100, Math.max(0, Number(payload.kkm) || 75)),
      description: boundString(payload.description || '', 300),
      updatedAt: serverTimestamp(),
    };
    if (payload.isNew) {
      data.createdAt = serverTimestamp();
      await setDoc(doc(db, 'subjects', id), data);
    } else {
      await updateDoc(doc(db, 'subjects', id), data);
    }
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: payload.isNew ? 'CREATE_SUBJECT' : 'UPDATE_SUBJECT',
      targetObject: `${data.code} - ${data.name}`,
    });
  } catch (error) {
    handleFirestoreError(error, payload.isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveAcademicYear(
  payload: Omit<AcademicYear, 'createdAt' | 'updatedAt'> & { isNew?: boolean },
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const id = sanitizeId(payload.id || makeId('ay'));
  const path = `academic_years/${id}`;
  try {
    if (payload.isActive) {
      const existing = await getDocs(collection(db, 'academic_years'));
      const batch = writeBatch(db);
      for (const d of existing.docs) {
        if (d.id !== id && d.data().isActive) {
          batch.update(d.ref, { isActive: false, updatedAt: serverTimestamp() });
        }
      }
      await batch.commit();
    }

    const data: Record<string, unknown> = {
      id,
      name: boundString(payload.name, 40),
      startDate: boundString(payload.startDate, 20),
      endDate: boundString(payload.endDate, 20),
      isActive: Boolean(payload.isActive),
      updatedAt: serverTimestamp(),
    };
    if (payload.isNew) {
      data.createdAt = serverTimestamp();
      await setDoc(doc(db, 'academic_years', id), data);
    } else {
      await updateDoc(doc(db, 'academic_years', id), data);
    }
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: 'SAVE_ACADEMIC_YEAR',
      targetObject: String(data.name),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveSemester(
  payload: Omit<Semester, 'createdAt' | 'updatedAt'> & { isNew?: boolean },
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const id = sanitizeId(payload.id || makeId('sem'));
  const path = `semesters/${id}`;
  try {
    if (payload.isActive) {
      const existing = await getDocs(collection(db, 'semesters'));
      const batch = writeBatch(db);
      for (const d of existing.docs) {
        if (d.id !== id && d.data().isActive) {
          batch.update(d.ref, { isActive: false, updatedAt: serverTimestamp() });
        }
      }
      await batch.commit();
    }

    const data: Record<string, unknown> = {
      id,
      academicYearId: sanitizeId(payload.academicYearId),
      academicYearName: boundString(payload.academicYearName || '', 40),
      name: payload.name,
      startDate: boundString(payload.startDate || '', 20),
      endDate: boundString(payload.endDate || '', 20),
      isActive: Boolean(payload.isActive),
      updatedAt: serverTimestamp(),
    };
    if (payload.isNew) {
      data.createdAt = serverTimestamp();
      await setDoc(doc(db, 'semesters', id), data);
    } else {
      await updateDoc(doc(db, 'semesters', id), data);
    }
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: 'SAVE_SEMESTER',
      targetObject: `${data.name} (${data.academicYearName})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveSchedule(
  payload: Omit<Schedule, 'createdAt' | 'updatedAt'> & { isNew?: boolean },
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const id = sanitizeId(payload.id || makeId('sch'));
  const path = `schedules/${id}`;
  try {
    const data: Record<string, unknown> = {
      id,
      classId: sanitizeId(payload.classId),
      className: boundString(payload.className || '', 64),
      subjectId: sanitizeId(payload.subjectId),
      subjectName: boundString(payload.subjectName || '', 100),
      teacherId: sanitizeId(payload.teacherId),
      teacherUserId: boundString(payload.teacherUserId || '', 128),
      teacherName: boundString(payload.teacherName || '', 120),
      semesterId: sanitizeId(payload.semesterId),
      dayOfWeek: payload.dayOfWeek,
      startTime: boundString(payload.startTime, 10),
      endTime: boundString(payload.endTime, 10),
      room: boundString(payload.room || '', 40),
      updatedAt: serverTimestamp(),
    };
    if (payload.isNew) {
      data.createdAt = serverTimestamp();
      await setDoc(doc(db, 'schedules', id), data);
    } else {
      await updateDoc(doc(db, 'schedules', id), data);
    }
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: payload.isNew ? 'CREATE_SCHEDULE' : 'UPDATE_SCHEDULE',
      targetObject: `${data.className} · ${data.subjectName} (${data.dayOfWeek})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCollectionDoc(
  collectionName: 'classes' | 'subjects' | 'academic_years' | 'semesters' | 'schedules' | 'announcements',
  docId: string,
  label: string,
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    await deleteDoc(doc(db, collectionName, docId));
    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: `DELETE_${collectionName.toUpperCase()}`,
      targetObject: label,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ATTENDANCE (ANTI-DUPLICATION DETERMINISTIC ID)
export function getAttendanceDocId(
  date: string,
  classId: string,
  subjectId: string,
  studentId: string
): string {
  return sanitizeId(`${date}_${classId}_${subjectId}_${studentId}`);
}

export async function saveBatchAttendance(
  entries: Array<{
    student: Student;
    status: AttendanceStatus;
    notes?: string;
    existingRecord?: AttendanceRecord;
  }>,
  meta: {
    date: string;
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    teacherId: string;
    teacherUserId: string;
    teacherName: string;
    semesterId: string;
  },
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const path = `attendance/batch_${meta.date}_${meta.classId}`;
  try {
    for (const item of entries) {
      const id = getAttendanceDocId(meta.date, meta.classId, meta.subjectId, item.student.id);
      const docRef = doc(db, 'attendance', id);
      const existing = item.existingRecord;

      if (existing) {
        const nextHistory = [...(existing.history || [])];
        if (existing.status !== item.status || (existing.notes || '') !== (item.notes || '')) {
          nextHistory.push({
            changedAt: new Date().toISOString(),
            changedBy: actor.uid,
            changedByName: actor.name,
            previousStatus: existing.status,
            newStatus: item.status,
            notes: boundString(item.notes || '', 120),
          });
        }
        await updateDoc(docRef, {
          status: item.status,
          notes: boundString(item.notes || '', 240),
          history: nextHistory.slice(-50),
          updatedBy: actor.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(docRef, {
          id,
          studentId: sanitizeId(item.student.id),
          studentUserId: boundString(item.student.userId || '', 128),
          studentName: boundString(item.student.fullName, 120),
          studentNis: boundString(item.student.nis, 40),
          classId: sanitizeId(meta.classId),
          className: boundString(meta.className, 64),
          subjectId: sanitizeId(meta.subjectId),
          subjectName: boundString(meta.subjectName, 100),
          teacherId: sanitizeId(meta.teacherId),
          teacherUserId: boundString(meta.teacherUserId, 128),
          teacherName: boundString(meta.teacherName, 120),
          semesterId: sanitizeId(meta.semesterId),
          date: boundString(meta.date, 20),
          status: item.status,
          notes: boundString(item.notes || '', 240),
          updatedBy: actor.uid,
          history: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: 'SAVE_ATTENDANCE',
      targetObject: `${meta.className} · ${meta.subjectName} (${meta.date})`,
      details: `Memproses absensi untuk ${entries.length} siswa`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// GRADES (ANTI-DUPLICATION DETERMINISTIC ID + AUTOMATIC WEIGHTED FINAL SCORE)
export function getGradeDocId(
  semesterId: string,
  classId: string,
  subjectId: string,
  studentId: string
): string {
  return sanitizeId(`${semesterId}_${classId}_${subjectId}_${studentId}`);
}

export async function saveGradeEntry(
  params: {
    student: Student;
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    teacherId: string;
    teacherUserId: string;
    teacherName: string;
    semesterId: string;
    academicYearId: string;
    scores: {
      ujianLisan: number;
      ujianTulis: number;
    };
    writtenDetails?: WrittenBabScoreEntry[];
    weights: GradeWeights;
    gradeBands?: GradeRangeBands;
    minScore: number;
    maxScore: number;
    existingGrade?: GradeRecord;
    note?: string;
  },
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const { scores, minScore, maxScore } = params;
  const scoreValues = [scores.ujianLisan, scores.ujianTulis];
  for (const val of scoreValues) {
    if (Number.isNaN(val) || val < minScore || val > maxScore) {
      throw new Error(`Nilai harus berada dalam rentang ${minScore} hingga ${maxScore}.`);
    }
  }

  const { finalScore, letterGrade } = computeFinalScore(
    scores,
    params.weights,
    params.gradeBands,
    maxScore
  );
  const id = getGradeDocId(
    params.semesterId,
    params.classId,
    params.subjectId,
    params.student.id
  );
  const path = `grades/${id}`;

  const sanitizedWrittenDetails = (params.writtenDetails || []).slice(0, 30).map((b) => ({
    babId: sanitizeId(b.babId),
    babTitle: boundString(b.babTitle, 80),
    questionScores: (b.questionScores || []).slice(0, 100).map((n) => Number(n) || 0),
    maxPerQuestion: Number(b.maxPerQuestion) || 1,
    subtotal: Number(b.subtotal) || 0,
    maxTotal: Number(b.maxTotal) || 0,
  }));

  try {
    const docRef = doc(db, 'grades', id);
    if (params.existingGrade) {
      const nextHistory = [...(params.existingGrade.history || [])];
      nextHistory.push({
        changedAt: new Date().toISOString(),
        changedBy: actor.uid,
        changedByName: actor.name,
        previousFinal: params.existingGrade.finalScore,
        newFinal: finalScore,
        note: boundString(params.note || 'Pembaruan nilai', 120),
      });

      await updateDoc(docRef, {
        ujianLisan: Number(scores.ujianLisan) || 0,
        ujianTulis: Number(scores.ujianTulis) || 0,
        ...(params.writtenDetails ? { writtenDetails: sanitizedWrittenDetails } : {}),
        finalScore,
        letterGrade,
        history: nextHistory.slice(-50),
        updatedBy: actor.uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        id,
        studentId: sanitizeId(params.student.id),
        studentUserId: boundString(params.student.userId || '', 128),
        studentName: boundString(params.student.fullName, 120),
        studentNis: boundString(params.student.nis, 40),
        classId: sanitizeId(params.classId),
        className: boundString(params.className, 64),
        subjectId: sanitizeId(params.subjectId),
        subjectName: boundString(params.subjectName, 100),
        teacherId: sanitizeId(params.teacherId),
        teacherUserId: boundString(params.teacherUserId, 128),
        teacherName: boundString(params.teacherName, 120),
        semesterId: sanitizeId(params.semesterId),
        academicYearId: sanitizeId(params.academicYearId),
        ujianLisan: Number(scores.ujianLisan) || 0,
        ujianTulis: Number(scores.ujianTulis) || 0,
        writtenDetails: sanitizedWrittenDetails,
        finalScore,
        letterGrade,
        updatedBy: actor.uid,
        history: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: params.existingGrade ? 'UPDATE_GRADE' : 'CREATE_GRADE',
      targetObject: `${params.student.fullName} · ${params.subjectName}`,
      details: `Lisan: ${scores.ujianLisan}, Tulis: ${scores.ujianTulis} → Akhir: ${finalScore} (${letterGrade})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveSubjectGradingConfig(
  config: Omit<SubjectGradingConfig, 'id' | 'updatedBy' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const subjectId = sanitizeId(config.subjectId);
  if (!subjectId) {
    throw new Error('Mata pelajaran belum dipilih.');
  }
  const lisanW = Number(config.ujianLisanWeight);
  const tulisW = Number(config.ujianTulisWeight);
  if (lisanW + tulisW !== 100) {
    throw new Error('Total bobot Ujian Lisan + Ujian Tulis harus 100%.');
  }
  const rangeMin = Number(config.rangeMin);
  const rangeMax = Number(config.rangeMax);
  if (Number.isNaN(rangeMin) || Number.isNaN(rangeMax) || rangeMin < 0 || rangeMax > 1000 || rangeMin >= rangeMax) {
    throw new Error('Range nilai mapel tidak valid (Minimum harus < Maksimum, maks 1000).');
  }

  const babs = (config.babs || []).slice(0, 30).map((b, idx) => ({
    id: sanitizeId(b.id || `bab_${idx + 1}`),
    title: boundString(b.title || `BAB ${idx + 1}`, 80),
    questionCount: Math.max(1, Math.min(100, Math.round(Number(b.questionCount) || 1))),
    maxPerQuestion: Math.max(1, Math.min(100, Number(b.maxPerQuestion) || 1)),
  }));

  const path = `subject_grading_configs/${subjectId}`;
  try {
    const docRef = doc(db, 'subject_grading_configs', subjectId);
    const existingSnap = await getDoc(docRef);
    const basePayload = {
      id: subjectId,
      subjectId,
      subjectName: boundString(config.subjectName || '', 100),
      ujianLisanWeight: lisanW,
      ujianTulisWeight: tulisW,
      rangeMin,
      rangeMax,
      rangeMode: config.rangeMode === 'direct' ? 'direct' : 'proportional',
      babs,
      kkm: Math.max(0, Math.min(1000, Number(config.kkm ?? 75))),
      gradeBands: config.gradeBands || DEFAULT_GRADE_BANDS,
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    };

    if (existingSnap.exists()) {
      await updateDoc(docRef, basePayload);
    } else {
      await setDoc(docRef, {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    }

    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: 'SAVE_SUBJECT_GRADING_CONFIG',
      targetObject: config.subjectName || subjectId,
      details: `Range ${rangeMin}-${rangeMax}, Lisan ${lisanW}% / Tulis ${tulisW}%, ${babs.length} BAB`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ANNOUNCEMENTS
export async function saveAnnouncement(
  payload: Omit<Announcement, 'createdAt' | 'updatedAt'> & { isNew?: boolean },
  actor: { uid: string; name: string; role: 'admin' | 'teacher' }
): Promise<void> {
  const id = sanitizeId(payload.id || makeId('ann'));
  const path = `announcements/${id}`;
  try {
    const data: Record<string, unknown> = {
      id,
      title: boundString(payload.title, 160),
      content: boundString(payload.content, 4000),
      targetRole: payload.targetRole,
      targetClassId: boundString(payload.targetClassId || '', 128),
      targetClassName: boundString(payload.targetClassName || '', 64),
      publishDate: boundString(payload.publishDate, 20),
      expiryDate: boundString(payload.expiryDate || '', 20),
      attachmentName: boundString(payload.attachmentName || '', 160),
      attachmentUrl: boundString(payload.attachmentUrl || '', 500),
      authorId: actor.uid,
      authorName: boundString(actor.name, 120),
      authorRole: actor.role,
      isPinned: Boolean(payload.isPinned),
      updatedAt: serverTimestamp(),
    };

    if (payload.isNew) {
      data.createdAt = serverTimestamp();
      await setDoc(doc(db, 'announcements', id), data);
      await createNotification({
        recipientRole:
          payload.targetRole === 'class' ? 'student' : payload.targetRole,
        title: `Pengumuman Baru: ${data.title}`,
        message: boundString(payload.content, 180),
        category: 'announcement',
      });
    } else {
      await updateDoc(doc(db, 'announcements', id), data);
    }

    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: payload.isNew ? 'CREATE_ANNOUNCEMENT' : 'UPDATE_ANNOUNCEMENT',
      targetObject: String(data.title),
      details: `Target: ${payload.targetRole}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// INITIALIZE BASE ACADEMIC SETUP (NON-DUMMY REAL STRUCTURE FOR EMPTY PRODUCTION PORTAL)
export async function initializeSchoolBaseline(actor: {
  uid: string;
  name: string;
  role: UserRole;
}): Promise<void> {
  try {
    const yearId = 'ay_2026_2027';
    const semId = 'sem_2026_ganjil';
    await setDoc(doc(db, 'school_settings', 'main'), {
      ...DEFAULT_SCHOOL_SETTINGS,
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'academic_years', yearId), {
      id: yearId,
      name: '2026/2027',
      startDate: '2026-07-13',
      endDate: '2027-06-19',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'semesters', semId), {
      id: semId,
      academicYearId: yearId,
      academicYearName: '2026/2027',
      name: 'Ganjil',
      startDate: '2026-07-13',
      endDate: '2026-12-18',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const starterSubjects = [
      { id: 'sub_mat', code: 'MAT', name: 'Matematika', category: 'Wajib', kkm: 75 },
      { id: 'sub_bin', code: 'BIN', name: 'Bahasa Indonesia', category: 'Wajib', kkm: 75 },
      { id: 'sub_big', code: 'BIG', name: 'Bahasa Inggris', category: 'Wajib', kkm: 75 },
      { id: 'sub_inf', code: 'INF', name: 'Informatika', category: 'Peminatan', kkm: 78 },
    ];
    for (const s of starterSubjects) {
      await setDoc(doc(db, 'subjects', s.id), {
        ...s,
        gradeLevel: 'Semua',
        description: `Mata pelajaran ${s.name}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const starterClasses = [
      { id: 'cls_1a', name: 'Kelas 1A', gradeLevel: '1', capacity: 36, room: 'R-101' },
      { id: 'cls_2a', name: 'Kelas 2A', gradeLevel: '2', capacity: 36, room: 'R-102' },
      { id: 'cls_3a', name: 'Kelas 3A', gradeLevel: '3', capacity: 36, room: 'R-103' },
      { id: 'cls_4a', name: 'Kelas 4A', gradeLevel: '4', capacity: 36, room: 'R-201' },
      { id: 'cls_5a', name: 'Kelas 5A', gradeLevel: '5', capacity: 36, room: 'R-202' },
      { id: 'cls_6a', name: 'Kelas 6A', gradeLevel: '6', capacity: 36, room: 'R-203' },
    ];
    for (const c of starterClasses) {
      await setDoc(doc(db, 'classes', c.id), {
        ...c,
        academicYearId: yearId,
        homeroomTeacherId: '',
        homeroomTeacherName: '',
        teacherIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await setDoc(doc(db, 'announcements', 'ann_welcome_portal'), {
      id: 'ann_welcome_portal',
      title: 'Aktivasi Portal Akademik Tahun Ajaran 2026/2027',
      content:
        'Selamat datang di School Academic Portal. Seluruh guru dan siswa diimbau untuk segera mengaktifkan akun portal masing-masing menggunakan email terdaftar untuk mengakses jadwal pelajaran, presensi digital, dan hasil belajar.',
      targetRole: 'all',
      targetClassId: '',
      targetClassName: '',
      publishDate: '2026-11-18',
      expiryDate: '2027-06-30',
      attachmentName: '',
      attachmentUrl: '',
      authorId: actor.uid,
      authorName: actor.name,
      authorRole: 'admin',
      isPinned: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logActivity({
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      actionType: 'INIT_SCHOOL_BASELINE',
      targetObject: 'Struktur Dasar Tahun Ajaran, Semester, Kelas & Mapel',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'school_baseline');
  }
}

// BACKUP & RESTORE
export async function exportPortalBackup(actor: {
  uid: string;
  name: string;
  role: UserRole;
}): Promise<Record<string, unknown[]>> {
  const collectionsToBackup = [
    'students',
    'teachers',
    'classes',
    'subjects',
    'academic_years',
    'semesters',
    'schedules',
    'attendance',
    'grades',
    'announcements',
    'school_settings',
  ];
  const backup: Record<string, unknown[]> = {};
  for (const colName of collectionsToBackup) {
    const snap = await getDocs(collection(db, colName));
    backup[colName] = snap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  }
  await logActivity({
    userId: actor.uid,
    userName: actor.name,
    userRole: actor.role,
    actionType: 'EXPORT_BACKUP',
    targetObject: 'Database Backup JSON',
  });
  return backup;
}

export async function restorePortalBackup(
  backup: Record<string, Record<string, unknown>[]>,
  actor: { uid: string; name: string; role: UserRole }
): Promise<number> {
  const allowedCols = [
    'academic_years',
    'semesters',
    'subjects',
    'classes',
    'teachers',
    'students',
    'schedules',
    'announcements',
  ];
  let count = 0;
  for (const colName of allowedCols) {
    const items = backup[colName];
    if (!Array.isArray(items)) continue;
    for (const rawItem of items) {
      const { _docId, createdAt: _c, updatedAt: _u, ...rest } = rawItem;
      const docId = sanitizeId(String(_docId || rest.id || makeId('res')));
      const docRef = doc(db, colName, docId);
      const existingDoc = await getDoc(docRef);
      if (existingDoc.exists()) {
        await updateDoc(docRef, {
          ...rest,
          id: docId,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(docRef, {
          ...rest,
          id: docId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      count++;
    }
  }
  await logActivity({
    userId: actor.uid,
    userName: actor.name,
    userRole: actor.role,
    actionType: 'RESTORE_BACKUP',
    targetObject: `Memulihkan ${count} dokumen`,
  });
  return count;
}

export async function fetchRecentLogs(maxCount = 100): Promise<ActivityLog[]> {
  try {
    const q = query(
      collection(db, 'activity_logs'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ActivityLog);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'activity_logs');
  }
}

export async function markNotificationRead(item: NotificationItem): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', item.id), { isRead: true });
  } catch (error) {
    console.warn('Gagal menandai notifikasi terbaca:', error);
  }
}
