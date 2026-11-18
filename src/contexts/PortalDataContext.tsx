import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { useAuth } from './AuthContext';
import {
  AcademicYear,
  AccountInvite,
  ActivityLog,
  Announcement,
  AttendanceRecord,
  GradeRecord,
  NotificationItem,
  Schedule,
  SchoolClass,
  Semester,
  Student,
  Subject,
  Teacher,
  UserProfile,
} from '../types/portal';

interface PortalDataContextValue {
  loading: boolean;
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  academicYears: AcademicYear[];
  semesters: Semester[];
  schedules: Schedule[];
  attendance: AttendanceRecord[];
  grades: GradeRecord[];
  announcements: Announcement[];
  activityLogs: ActivityLog[];
  users: UserProfile[];
  accountInvites: AccountInvite[];
  notifications: NotificationItem[];
  activeAcademicYear: AcademicYear | null;
  activeSemester: Semester | null;
  currentTeacher: Teacher | null;
  currentStudent: Student | null;
}

const PortalDataContext = createContext<PortalDataContextValue | undefined>(undefined);

export function PortalDataProvider({ children }: { children: React.ReactNode }) {
  const { userProfile, effectiveRole, authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [accountInvites, setAccountInvites] = useState<AccountInvite[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (authLoading || !userProfile) {
      setLoading(false);
      setStudents([]);
      setTeachers([]);
      setClasses([]);
      setSubjects([]);
      setAcademicYears([]);
      setSemesters([]);
      setSchedules([]);
      setAttendance([]);
      setGrades([]);
      setAnnouncements([]);
      setActivityLogs([]);
      setUsers([]);
      setAccountInvites([]);
      setNotifications([]);
      return;
    }

    setLoading(true);
    const unsubs: Array<() => void> = [];
    const actualRole = userProfile.role;
    const entityId = userProfile.linkedEntityId || '';

    // Public-readable academic metadata
    unsubs.push(
      onSnapshot(
        collection(db, 'subjects'),
        (snap) => setSubjects(snap.docs.map((d) => d.data() as Subject)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'subjects')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'academic_years'),
        (snap) => setAcademicYears(snap.docs.map((d) => d.data() as AcademicYear)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'academic_years')
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'semesters'),
        (snap) => setSemesters(snap.docs.map((d) => d.data() as Semester)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'semesters')
      )
    );

    // Role-scoped queries strictly matching firestore.rules
    if (actualRole === 'admin') {
      unsubs.push(
        onSnapshot(
          collection(db, 'classes'),
          (snap) => setClasses(snap.docs.map((d) => d.data() as SchoolClass)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'students'),
          (snap) => setStudents(snap.docs.map((d) => d.data() as Student)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'students')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'teachers'),
          (snap) => setTeachers(snap.docs.map((d) => d.data() as Teacher)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'teachers')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'schedules'),
          (snap) => setSchedules(snap.docs.map((d) => d.data() as Schedule)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'schedules')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'attendance'),
          (snap) => setAttendance(snap.docs.map((d) => d.data() as AttendanceRecord)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'grades'),
          (snap) => setGrades(snap.docs.map((d) => d.data() as GradeRecord)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'grades')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'announcements'),
          (snap) => setAnnouncements(snap.docs.map((d) => d.data() as Announcement)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'), limit(200)),
          (snap) => setActivityLogs(snap.docs.map((d) => d.data() as ActivityLog)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'activity_logs')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => setUsers(snap.docs.map((d) => d.data() as UserProfile)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'account_invites'),
          (snap) => setAccountInvites(snap.docs.map((d) => d.data() as AccountInvite)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'account_invites')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'notifications'),
          (snap) => setNotifications(snap.docs.map((d) => d.data() as NotificationItem)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
        )
      );
    } else if (actualRole === 'teacher' && entityId) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'classes'), where('teacherIds', 'array-contains', entityId)),
          (snap) => setClasses(snap.docs.map((d) => d.data() as SchoolClass)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'students'), where('assignedTeacherIds', 'array-contains', entityId)),
          (snap) => setStudents(snap.docs.map((d) => d.data() as Student)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'students')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'teachers'), where('id', '==', entityId)),
          (snap) => setTeachers(snap.docs.map((d) => d.data() as Teacher)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'teachers')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'schedules'), where('teacherId', '==', entityId)),
          (snap) => setSchedules(snap.docs.map((d) => d.data() as Schedule)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'schedules')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'attendance'), where('teacherId', '==', entityId)),
          (snap) => setAttendance(snap.docs.map((d) => d.data() as AttendanceRecord)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'grades'), where('teacherId', '==', entityId)),
          (snap) => setGrades(snap.docs.map((d) => d.data() as GradeRecord)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'grades')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'announcements'), where('targetRole', 'in', ['all', 'teacher', 'class'])),
          (snap) => setAnnouncements(snap.docs.map((d) => d.data() as Announcement)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('recipientRole', 'in', ['all', 'teacher'])),
          (snap) => setNotifications(snap.docs.map((d) => d.data() as NotificationItem)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
        )
      );
    } else if (actualRole === 'student' && entityId) {
      unsubs.push(
        onSnapshot(
          collection(db, 'classes'),
          (snap) => setClasses(snap.docs.map((d) => d.data() as SchoolClass)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'students'), where('id', '==', entityId)),
          (snap) => setStudents(snap.docs.map((d) => d.data() as Student)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'students')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'schedules'),
          (snap) => setSchedules(snap.docs.map((d) => d.data() as Schedule)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'schedules')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'attendance'), where('studentId', '==', entityId)),
          (snap) => setAttendance(snap.docs.map((d) => d.data() as AttendanceRecord)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'grades'), where('studentId', '==', entityId)),
          (snap) => setGrades(snap.docs.map((d) => d.data() as GradeRecord)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'grades')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'announcements'), where('targetRole', 'in', ['all', 'student', 'class'])),
          (snap) => setAnnouncements(snap.docs.map((d) => d.data() as Announcement)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('recipientRole', 'in', ['all', 'student'])),
          (snap) => setNotifications(snap.docs.map((d) => d.data() as NotificationItem)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
        )
      );
    }

    setLoading(false);
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authLoading, userProfile]);

  const activeAcademicYear = useMemo(
    () => academicYears.find((y) => y.isActive) || academicYears[0] || null,
    [academicYears]
  );

  const activeSemester = useMemo(
    () => semesters.find((s) => s.isActive) || semesters[0] || null,
    [semesters]
  );

  const currentTeacher = useMemo(() => {
    if (!userProfile) return null;
    if (userProfile.role === 'teacher') {
      return teachers.find((t) => t.id === userProfile.linkedEntityId) || teachers[0] || null;
    }
    if (userProfile.role === 'admin' && effectiveRole === 'teacher') {
      return teachers[0] || null;
    }
    return null;
  }, [userProfile, effectiveRole, teachers]);

  const currentStudent = useMemo(() => {
    if (!userProfile) return null;
    if (userProfile.role === 'student') {
      return students.find((s) => s.id === userProfile.linkedEntityId) || students[0] || null;
    }
    if (userProfile.role === 'admin' && effectiveRole === 'student') {
      return students[0] || null;
    }
    return null;
  }, [userProfile, effectiveRole, students]);

  return (
    <PortalDataContext.Provider
      value={{
        loading,
        students,
        teachers,
        classes,
        subjects,
        academicYears,
        semesters,
        schedules,
        attendance,
        grades,
        announcements,
        activityLogs,
        users,
        accountInvites,
        notifications,
        activeAcademicYear,
        activeSemester,
        currentTeacher,
        currentStudent,
      }}
    >
      {children}
    </PortalDataContext.Provider>
  );
}

export function usePortalData(): PortalDataContextValue {
  const ctx = useContext(PortalDataContext);
  if (!ctx) {
    throw new Error('usePortalData must be used within PortalDataProvider');
  }
  return ctx;
}
