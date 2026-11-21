import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'teacher' | 'student';
export type Gender = 'L' | 'P';
export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'transferred';
export type EmploymentStatus = 'PNS' | 'PPPK' | 'GTY' | 'Honorer' | 'inactive';
export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
export type AnnouncementTarget = 'all' | 'teacher' | 'student' | 'class';
export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

export interface GradeWeights {
  ujianLisan: number;
  ujianTulis: number;
}

export type RangeCalculationMode = 'proportional' | 'direct';

export interface WrittenExamBab {
  id: string;
  title: string;
  questionCount: number;
  maxPerQuestion: number;
}

export interface GradeRangeBands {
  aMin: number;
  bMin: number;
  cMin: number;
  dMin: number;
}

export const DEFAULT_GRADE_BANDS: GradeRangeBands = {
  aMin: 90,
  bMin: 75,
  cMin: 60,
  dMin: 50,
};

export interface WrittenBabScoreEntry {
  babId: string;
  babTitle: string;
  questionScores: number[];
  maxPerQuestion: number;
  subtotal: number;
  maxTotal: number;
}

export interface SubjectGradingConfig {
  id: string;
  subjectId: string;
  subjectName?: string;
  ujianLisanWeight: number;
  ujianTulisWeight: number;
  rangeMin: number;
  rangeMax: number;
  rangeMode: RangeCalculationMode;
  babs: WrittenExamBab[];
  kkm?: number;
  gradeBands?: GradeRangeBands;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AcademicCalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  category: 'Akademik' | 'Ujian' | 'Libur' | 'Kegiatan';
  description?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  isActive: boolean;
  linkedEntityId?: string;
  phone?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AccountInvite {
  email: string;
  role: 'teacher' | 'student';
  linkedEntityId: string;
  fullName: string;
  identityCode?: string;
  status: 'pending' | 'activated' | 'revoked';
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Student {
  id: string;
  userId?: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: Gender;
  birthPlace?: string;
  birthDate?: string;
  address?: string;
  phone?: string;
  email: string;
  parentName?: string;
  classId: string;
  className?: string;
  entryYear: number;
  status: StudentStatus;
  photoUrl?: string;
  assignedTeacherIds?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Teacher {
  id: string;
  userId?: string;
  nip?: string;
  teacherCode: string;
  fullName: string;
  gender: Gender;
  address?: string;
  phone?: string;
  email: string;
  subjectIds: string[];
  subjectNames?: string[];
  classIds: string[];
  classNames?: string[];
  employmentStatus: EmploymentStatus;
  photoUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: string;
  homeroomTeacherId?: string;
  homeroomTeacherName?: string;
  academicYearId: string;
  capacity: number;
  room?: string;
  teacherIds?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  category?: string;
  gradeLevel?: string;
  kkm: number;
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Semester {
  id: string;
  academicYearId: string;
  academicYearName?: string;
  name: 'Ganjil' | 'Genap';
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Schedule {
  id: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherUserId?: string;
  teacherName?: string;
  semesterId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AttendanceChangeHistory {
  changedAt: string;
  changedBy: string;
  changedByName: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentUserId?: string;
  studentName?: string;
  studentNis?: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherUserId?: string;
  teacherName?: string;
  semesterId: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
  updatedBy: string;
  history?: AttendanceChangeHistory[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GradeChangeHistory {
  changedAt: string;
  changedBy: string;
  changedByName: string;
  previousFinal: number;
  newFinal: number;
  note?: string;
}

export interface GradeRecord {
  id: string;
  studentId: string;
  studentUserId?: string;
  studentName?: string;
  studentNis?: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherId: string;
  teacherUserId?: string;
  teacherName?: string;
  semesterId: string;
  academicYearId?: string;
  ujianLisan: number;
  ujianTulis: number;
  writtenDetails?: WrittenBabScoreEntry[];
  tugas?: number;
  kuis?: number;
  ulanganHarian?: number;
  pts?: number;
  pas?: number;
  praktik?: number;
  finalScore: number;
  letterGrade: string;
  updatedBy: string;
  history?: GradeChangeHistory[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetRole: AnnouncementTarget;
  targetClassId?: string;
  targetClassName?: string;
  publishDate: string;
  expiryDate?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  authorId: string;
  authorName: string;
  authorRole: 'admin' | 'teacher';
  isPinned?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole | 'system';
  actionType: string;
  targetObject: string;
  details?: string;
  createdAt?: Timestamp;
}

export interface SchoolSettings {
  schoolName: string;
  tagline?: string;
  welcomeTitle?: string;
  welcomeMessage: string;
  principalName?: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  npsn?: string;
  accreditation?: string;
  gradeWeights: GradeWeights;
  minScore: number;
  maxScore: number;
  allowStudentReportDownload: boolean;
  allowStudentPhotoChange: boolean;
  calendarEvents?: AcademicCalendarEvent[];
  wpSiteUrl?: string;
  wpSyncEnabled?: boolean;
  wpShowOnPublicHome?: boolean;
  wpCategoryId?: string;
  updatedAt?: Timestamp;
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface WordPressPost {
  id: number;
  title: string;
  excerpt: string;
  contentText: string;
  date: string;
  link: string;
  authorName: string;
  featuredImage?: string;
  categories: string[];
}

export interface NotificationItem {
  id: string;
  recipientUserId?: string;
  recipientRole: 'all' | 'admin' | 'teacher' | 'student';
  title: string;
  message: string;
  category: 'announcement' | 'grade' | 'attendance' | 'system';
  isRead: boolean;
  createdAt?: Timestamp;
}

export const DEFAULT_GRADE_WEIGHTS: GradeWeights = {
  ujianLisan: 50,
  ujianTulis: 50,
};

export function normalizeGradeWeights(
  raw?: Partial<GradeWeights> | Record<string, unknown> | null
): GradeWeights {
  if (
    raw &&
    typeof raw.ujianLisan === 'number' &&
    typeof raw.ujianTulis === 'number' &&
    !Number.isNaN(raw.ujianLisan) &&
    !Number.isNaN(raw.ujianTulis)
  ) {
    return {
      ujianLisan: Math.max(0, Math.min(100, raw.ujianLisan)),
      ujianTulis: Math.max(0, Math.min(100, raw.ujianTulis)),
    };
  }
  return { ...DEFAULT_GRADE_WEIGHTS };
}

export function getGradeComponentScores(
  g?: Partial<GradeRecord> | null
): { ujianLisan: number; ujianTulis: number } {
  if (!g) return { ujianLisan: 0, ujianTulis: 0 };
  const ujianLisan =
    typeof g.ujianLisan === 'number' && !Number.isNaN(g.ujianLisan)
      ? g.ujianLisan
      : Number(g.praktik ?? g.tugas ?? 0);
  const ujianTulis =
    typeof g.ujianTulis === 'number' && !Number.isNaN(g.ujianTulis)
      ? g.ujianTulis
      : Number(g.pas ?? g.pts ?? 0);
  return { ujianLisan, ujianTulis };
}

export const DEFAULT_SCHOOL_SETTINGS: Omit<SchoolSettings, 'updatedAt'> = {
  schoolName: 'Pondok Modern Darul Ittihad Cakru',
  tagline: 'Modern Islamic Boarding School · Unggul dalam Prestasi, Berkarakter, dan Berakhlak Mulia',
  welcomeTitle: 'Portal Akademik Darul Ittihad Cakru',
  welcomeMessage:
    'Platform manajemen pendidikan dan kepesantrenan terpadu yang menghubungkan administrator, asatidz/guru, dan santri/siswa dalam satu ekosistem akademik yang transparan, akurat, dan real-time.',
  principalName: 'Dra. Ratna Kusumawati, M.Pd.',
  logoUrl: '/assets/aistudio/logo_pondok_7b601747.png',
  address: 'Cakru, Kencong, Kabupaten Jember, Jawa Timur',
  phone: '(021) 724-8890',
  email: 'akademik@darulittihad-cakru.sch.id',
  website: 'https://darulittihad-cakru.sch.id',
  npsn: '20102588',
  accreditation: 'A (Unggul)',
  gradeWeights: DEFAULT_GRADE_WEIGHTS,
  minScore: 0,
  maxScore: 100,
  allowStudentReportDownload: true,
  allowStudentPhotoChange: true,
  calendarEvents: [
    {
      id: 'cal-1',
      title: 'Awal Semester Ganjil Tahun Ajaran 2026/2027',
      date: '2026-07-13',
      category: 'Akademik',
      description: 'Pembukaan kegiatan belajar mengajar aktif dan masa pengenalan lingkungan sekolah.',
    },
    {
      id: 'cal-2',
      title: 'Penilaian Tengah Semester (PTS) Ganjil',
      date: '2026-09-21',
      endDate: '2026-09-26',
      category: 'Ujian',
      description: 'Pelaksanaan evaluasi tengah semester berbasis kelas.',
    },
    {
      id: 'cal-3',
      title: 'Penilaian Akhir Semester (PAS) Ganjil',
      date: '2026-11-30',
      endDate: '2026-12-08',
      category: 'Ujian',
      description: 'Ujian akhir semester ganjil seluruh jenjang kelas 1 sampai 6.',
    },
    {
      id: 'cal-4',
      title: 'Pembagian Rapor Semester Ganjil',
      date: '2026-12-18',
      category: 'Akademik',
      description: 'Penyerahan hasil belajar semester ganjil dan publikasi nilai melalui portal.',
    },
  ],
  wpSiteUrl: '',
  wpSyncEnabled: false,
  wpShowOnPublicHome: true,
  wpCategoryId: '',
};

export type NavTabId =
  | 'dashboard'
  | 'students'
  | 'teachers'
  | 'academics'
  | 'attendance'
  | 'grades'
  | 'announcements'
  | 'cards'
  | 'logs'
  | 'settings'
  | 'account'
  | 'help';
