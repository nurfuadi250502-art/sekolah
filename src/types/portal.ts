import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'teacher' | 'student';
export type Gender = 'L' | 'P';
export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'transferred';
export type EmploymentStatus = 'PNS' | 'PPPK' | 'GTY' | 'Honorer' | 'inactive';
export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
export type AnnouncementTarget = 'all' | 'teacher' | 'student' | 'class';
export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

export interface GradeWeights {
  tugas: number;
  kuis: number;
  ulanganHarian: number;
  pts: number;
  pas: number;
  praktik: number;
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
  tugas: number;
  kuis: number;
  ulanganHarian: number;
  pts: number;
  pas: number;
  praktik: number;
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
  tugas: 15,
  kuis: 10,
  ulanganHarian: 20,
  pts: 20,
  pas: 25,
  praktik: 10,
};

export const DEFAULT_SCHOOL_SETTINGS: Omit<SchoolSettings, 'updatedAt'> = {
  schoolName: 'SMA Negeri Harapan Nusantara',
  tagline: 'Unggul dalam Prestasi, Berkarakter, dan Berdaya Saing Global',
  welcomeTitle: 'Selamat Datang di Portal Akademik Terpadu',
  welcomeMessage:
    'School Academic Portal merupakan platform manajemen pendidikan terintegrasi yang menghubungkan administrator sekolah, tenaga pendidik, dan peserta didik dalam satu ekosistem akademik yang transparan, akurat, dan real-time.',
  principalName: 'Dra. Ratna Kusumawati, M.Pd.',
  logoUrl: '/src/assets/images/school_crest_logo_1795012759504.jpg',
  address: 'Jl. Pendidikan Raya No. 45, Kebayoran Baru, Jakarta Selatan 12160',
  phone: '(021) 724-8890',
  email: 'akademik@harapan-nusantara.sch.id',
  website: 'https://harapan-nusantara.sch.id',
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
      description: 'Ujian akhir semester ganjil seluruh jenjang kelas X, XI, dan XII.',
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
