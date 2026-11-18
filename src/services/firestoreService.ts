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
  DEFAULT_GRADE_WEIGHTS,
  DEFAULT_SCHOOL_SETTINGS,
  GradeRecord,
  GradeWeights,
  NotificationItem,
  Schedule,
  SchoolClass,
  SchoolSettings,
  Semester,
  Student,
  Subject,
  Teacher,
  UserProfile,
  UserRole,
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

export function computeFinalScore(
  scores: {
    tugas: number;
    kuis: number;
    ulanganHarian: number;
    pts: number;
    pas: number;
    praktik: number;
  },
  weights: GradeWeights = DEFAULT_GRADE_WEIGHTS
): { finalScore: number; letterGrade: string } {
  const totalWeight =
    weights.tugas +
      weights.kuis +
      weights.ulanganHarian +
      weights.pts +
      weights.pas +
      weights.praktik || 100;

  const weighted =
    (scores.tugas * weights.tugas +
      scores.kuis * weights.kuis +
      scores.ulanganHarian * weights.ulanganHarian +
      scores.pts * weights.pts +
      scores.pas * weights.pas +
      scores.praktik * weights.praktik) /
    totalWeight;

  const finalScore = Math.min(100, Math.max(0, Math.round(weighted * 100) / 100));

  let letterGrade = 'E';
  if (finalScore >= 90) letterGrade = 'A';
  else if (finalScore >= 85) letterGrade = 'A-';
  else if (finalScore >= 80) letterGrade = 'B+';
  else if (finalScore >= 75) letterGrade = 'B';
  else if (finalScore >= 70) letterGrade = 'B-';
  else if (finalScore >= 65) letterGrade = 'C+';
  else if (finalScore >= 60) letterGrade = 'C';
  else if (finalScore >= 50) letterGrade = 'D';

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
      return snap.data() as SchoolSettings;
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
  const path = `account_invites/${emailLower}`;
  try {
    await setDoc(doc(db, 'account_invites', emailLower), {
      email: emailLower,
      role: invite.role,
      linkedEntityId: sanitizeId(invite.linkedEntityId),
      fullName: boundString(invite.fullName, 120),
      identityCode: boundString(invite.identityCode || '', 64),
      status: invite.status || 'pending',
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
      tugas: number;
      kuis: number;
      ulanganHarian: number;
      pts: number;
      pas: number;
      praktik: number;
    };
    weights: GradeWeights;
    minScore: number;
    maxScore: number;
    existingGrade?: GradeRecord;
    note?: string;
  },
  actor: { uid: string; name: string; role: UserRole }
): Promise<void> {
  const { scores, minScore, maxScore } = params;
  const scoreValues = Object.values(scores);
  for (const val of scoreValues) {
    if (Number.isNaN(val) || val < minScore || val > maxScore) {
      throw new Error(`Nilai harus berada dalam rentang ${minScore} hingga ${maxScore}.`);
    }
  }

  const { finalScore, letterGrade } = computeFinalScore(scores, params.weights);
  const id = getGradeDocId(
    params.semesterId,
    params.classId,
    params.subjectId,
    params.student.id
  );
  const path = `grades/${id}`;

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
        ...scores,
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
        ...scores,
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
      details: `Nilai Akhir: ${finalScore} (${letterGrade})`,
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
      { id: 'cls_10_ipa1', name: 'X IPA 1', gradeLevel: 'X', capacity: 36, room: 'R-101' },
      { id: 'cls_11_ipa1', name: 'XI IPA 1', gradeLevel: 'XI', capacity: 36, room: 'R-201' },
      { id: 'cls_12_ipa1', name: 'XII IPA 1', gradeLevel: 'XII', capacity: 36, room: 'R-301' },
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
      await setDoc(doc(db, colName, docId), {
        ...rest,
        id: docId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
