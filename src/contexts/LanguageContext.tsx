import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

export type PortalLanguage = 'id' | 'en' | 'ar';

const TRANSLATIONS = {
  id: {
    // Public Header & Hero
    topInfo: 'Informasi Akademik & Pendaftaran',
    loginPortal: 'Login Portal',
    masukPortal: 'Masuk Portal',
    navHome: 'Home',
    navAcademic: 'Akademik',
    navAnnouncements: 'Pengumuman',
    navCalendar: 'Kalender',
    navContact: 'Kontak',
    heroEyebrow: 'Portal Akademik & Pendidikan Terpadu',
    heroTermPrefix: 'TA',
    heroSemester: 'Semester',
    heroSecondaryBtn: 'Pengumuman & Berita',
    accreditationLabel: 'Akreditasi',
    feature1Title: 'BERKARAKTER & BERPRESTASI',
    feature1Action: 'Lihat Kalender',
    feature2Title: 'KURIKULUM & MAPEL TERPADU',
    feature2Sub: 'Presensi & Penilaian Guru Real-Time',
    feature2Action: 'Portal Guru',
    feature3Title: 'PORTAL SANTRI & SISWA',
    feature3Sub: 'Jadwal, Kehadiran & Rekap Nilai Semester',
    feature3Action: 'Masuk Siswa',

    // Public Info & Sections
    statYearLabel: 'Tahun Ajaran Aktif',
    statSemLabel: 'Semester Berjalan',
    statSemSub: 'Penilaian & Presensi Terintegrasi',
    statSubjectLabel: 'Kurikulum & Mata Pelajaran',
    statSubjectUnit: 'Mata Pelajaran',
    statSubjectSub: 'Evaluasi Ujian Lisan & Ujian Tulis',
    statRoleLabel: 'Akses Peran Portal',
    roleAdmin: 'Admin',
    roleTeacher: 'Guru',
    roleStudent: 'Siswa',
    annTitle: 'Pengumuman Terbaru',
    annSubtitle: 'Informasi resmi sekolah dan pondok pesantren untuk seluruh santri, siswa, dan wali.',
    annLoginCta: 'Masuk untuk pengumuman kelas →',
    annEmptyTitle: 'Belum ada pengumuman publik yang dipublikasikan.',
    annEmptySub: 'Administrator dapat menerbitkan pengumuman sekolah melalui dashboard portal.',
    annPinned: 'Disematkan',
    annViewAttachment: 'Lihat Lampiran',
    wpTitle: 'Berita & Artikel Website Sekolah (WordPress)',
    wpSubtitle: 'Tersinkronisasi langsung dari portal berita WordPress resmi sekolah.',
    wpVisit: 'Kunjungi Website WordPress',
    wpReadMore: 'Baca Artikel Lengkap',
    calTitle: 'Kalender Akademik',
    calSubtitle: 'Jadwal kegiatan akademik, ujian, dan agenda penting semester berjalan.',
    calFilterAll: 'Semua',
    calFilterAcademic: 'Akademik',
    calFilterExam: 'Ujian',
    calFilterEvent: 'Kegiatan',
    calEmpty: 'Tidak ada agenda pada kategori ini.',
    ecoTitle: 'Ekosistem Belajar Terpadu',
    ecoDesc:
      'Asatidz dan guru mengelola presensi harian serta penilaian berbasis bobot kurikulum secara langsung, sementara santri memantau jadwal, kehadiran, dan rapor hasil belajar dengan aman.',
    ecoSubjectsLabel: 'Mata Pelajaran Aktif',
    ecoCardLabel: 'Verifikasi Identitas',
    ecoCardValue: 'Kartu Akun QR',
    footerContactTitle: 'Informasi Kontak',
    footerPortalTitle: 'Akses Portal',
    footerLoginAdmin: 'Login Administrator →',
    footerLoginTeacher: 'Login Guru & Pengajar →',
    footerLoginStudent: 'Login Siswa / Santri →',

    // Login Page
    backToHome: 'Kembali ke Beranda Sekolah',
    portalAdminTitle: 'Portal Administrator',
    portalAdminDesc: 'Pengelolaan penuh data guru, siswa, kelas, nilai, absensi, keamanan, dan laporan.',
    portalTeacherTitle: 'Portal Guru & Pengajar',
    portalTeacherDesc: 'Kelola presensi kelas, edit pelajaran & jadwal, input nilai, dan pengumuman kelas.',
    portalStudentTitle: 'Portal Siswa & Santri',
    portalStudentDesc: 'Pantau jadwal pelajaran, riwayat kehadiran, nilai mata pelajaran, dan pengumuman.',
    guideTitle: 'Panduan Akses Aman',
    guideDesc:
      'Guru & Siswa masuk menggunakan email yang telah didaftarkan oleh Administrator Sekolah melalui akun Google terverifikasi atau aktivasi Email/Password.',
    selectAccessRole: 'Pilih Jenis Akses Portal',
    tabLoginAdmin: 'Login Admin',
    tabLoginTeacher: 'Login Guru',
    tabLoginStudent: 'Login Siswa',
    googleSignIn: 'Masuk dengan Google',
    orWithEmail: 'atau dengan Email & Kata Sandi',
    modeLogin: 'Masuk Akun',
    modeActivate: 'Aktivasi Akun Baru',
    modeReset: 'Reset Password',
    fullNameLabel: 'Nama Lengkap',
    emailLabel: 'Email Terdaftar',
    passwordLabel: 'Kata Sandi',
    newPasswordLabel: 'Buat Kata Sandi Baru',
    btnDashboardLogin: 'Masuk ke Dashboard',
    btnActivateSend: 'Aktivasi & Kirim Verifikasi Email',
    btnResetSend: 'Kirim Tautan Reset Password',

    // Dashboard Layout & Nav
    nav_dashboard: 'Dashboard',
    nav_students: 'Data Siswa',
    nav_teachers: 'Data Guru',
    nav_academics: 'Pelajaran & Jadwal',
    nav_attendance: 'Absensi Online',
    nav_grades: 'Pengelolaan Nilai',
    nav_announcements: 'Pengumuman & Kalender',
    nav_cards: 'Kartu Akun',
    nav_logs: 'Log Aktivitas',
    nav_settings: 'Pengaturan Sekolah',
    nav_account: 'Pengaturan Akun',
    nav_help: 'Bantuan Pengguna',
    rolePreview: 'Pratinjau Tampilan Peran',
    logoutPortal: 'Keluar Portal',
    searchPlaceholder: 'Cari siswa, kelas, mata pelajaran, atau pengumuman...',
    notificationsTitle: 'Notifikasi Terbaru',
    closeLabel: 'Tutup',
    noNotifications: 'Belum ada notifikasi baru.',

    // Academics & Grades Teacher Edit
    tabClasses: 'Daftar Kelas',
    tabSubjects: 'Mata Pelajaran',
    tabPeriods: 'Tahun Ajaran & Semester',
    tabSchedules: 'Jadwal Pelajaran',
    editSubjectTitle: 'Edit Mata Pelajaran',
    editScheduleTitle: 'Edit Jadwal Pelajaran',
    saveChanges: 'Simpan Perubahan',
    cancel: 'Batal',
    gradesTabInput: 'Input & Edit Nilai',
    gradesTabRecap: 'Rekap Nilai & Rapor',
    gradesTabWeights: 'Pengaturan Nilai',
    editGradeTitle: 'Edit Nilai Siswa',
    saveAllGrades: 'Simpan Semua Perubahan',
    ujianLisanLabel: 'Ujian Lisan',
    ujianTulisLabel: 'Ujian Tulis',
  },
  en: {
    // Public Header & Hero
    topInfo: 'Academic & Admission Information',
    loginPortal: 'Portal Login',
    masukPortal: 'Enter Portal',
    navHome: 'Home',
    navAcademic: 'Academics',
    navAnnouncements: 'Announcements',
    navCalendar: 'Calendar',
    navContact: 'Contact',
    heroEyebrow: 'Integrated Academic & Education Portal',
    heroTermPrefix: 'AY',
    heroSemester: 'Semester',
    heroSecondaryBtn: 'News & Announcements',
    accreditationLabel: 'Accreditation',
    feature1Title: 'CHARACTER & ACHIEVEMENT',
    feature1Action: 'View Calendar',
    feature2Title: 'INTEGRATED CURRICULUM',
    feature2Sub: 'Real-Time Teacher Attendance & Grading',
    feature2Action: 'Teacher Portal',
    feature3Title: 'STUDENT & SANTRI PORTAL',
    feature3Sub: 'Schedules, Attendance & Report Cards',
    feature3Action: 'Student Login',

    // Public Info & Sections
    statYearLabel: 'Active Academic Year',
    statSemLabel: 'Current Semester',
    statSemSub: 'Integrated Grading & Attendance',
    statSubjectLabel: 'Curriculum & Subjects',
    statSubjectUnit: 'Subjects',
    statSubjectSub: 'Oral & Written Exam Evaluation',
    statRoleLabel: 'Portal Role Access',
    roleAdmin: 'Admin',
    roleTeacher: 'Teacher',
    roleStudent: 'Student',
    annTitle: 'Latest Announcements',
    annSubtitle: 'Official school and boarding announcements for students, parents, and staff.',
    annLoginCta: 'Sign in for class announcements →',
    annEmptyTitle: 'No public announcements published yet.',
    annEmptySub: 'Administrators can publish school announcements from the portal dashboard.',
    annPinned: 'Pinned',
    annViewAttachment: 'View Attachment',
    wpTitle: 'School Website News & Articles (WordPress)',
    wpSubtitle: 'Synced directly from the official school WordPress news portal.',
    wpVisit: 'Visit WordPress Website',
    wpReadMore: 'Read Full Article',
    calTitle: 'Academic Calendar',
    calSubtitle: 'Academic schedule, exams, and key events for the active semester.',
    calFilterAll: 'All',
    calFilterAcademic: 'Academic',
    calFilterExam: 'Exams',
    calFilterEvent: 'Events',
    calEmpty: 'No events found in this category.',
    ecoTitle: 'Integrated Learning Ecosystem',
    ecoDesc:
      'Teachers manage daily attendance and weighted curriculum assessments directly, while students securely track schedules, attendance history, and grade reports.',
    ecoSubjectsLabel: 'Active Subjects',
    ecoCardLabel: 'Identity Verification',
    ecoCardValue: 'QR Account Card',
    footerContactTitle: 'Contact Information',
    footerPortalTitle: 'Portal Access',
    footerLoginAdmin: 'Administrator Login →',
    footerLoginTeacher: 'Teacher & Staff Login →',
    footerLoginStudent: 'Student / Santri Login →',

    // Login Page
    backToHome: 'Back to School Home',
    portalAdminTitle: 'Administrator Portal',
    portalAdminDesc: 'Full management of teachers, students, classes, grades, attendance, security, and reports.',
    portalTeacherTitle: 'Teacher & Faculty Portal',
    portalTeacherDesc: 'Manage class attendance, edit subjects & schedules, input grades, and class notices.',
    portalStudentTitle: 'Student & Santri Portal',
    portalStudentDesc: 'View class schedules, attendance records, subject grades, and announcements.',
    guideTitle: 'Secure Access Guide',
    guideDesc:
      'Teachers and students sign in using the email registered by the School Administrator via verified Google sign-in or Email/Password activation.',
    selectAccessRole: 'Select Portal Access Role',
    tabLoginAdmin: 'Admin Login',
    tabLoginTeacher: 'Teacher Login',
    tabLoginStudent: 'Student Login',
    googleSignIn: 'Sign in with Google',
    orWithEmail: 'or with Email & Password',
    modeLogin: 'Sign In',
    modeActivate: 'Activate Account',
    modeReset: 'Reset Password',
    fullNameLabel: 'Full Name',
    emailLabel: 'Registered Email',
    passwordLabel: 'Password',
    newPasswordLabel: 'Create New Password',
    btnDashboardLogin: 'Sign In to Dashboard',
    btnActivateSend: 'Activate & Send Verification Email',
    btnResetSend: 'Send Password Reset Link',

    // Dashboard Layout & Nav
    nav_dashboard: 'Dashboard',
    nav_students: 'Students',
    nav_teachers: 'Teachers',
    nav_academics: 'Subjects & Schedules',
    nav_attendance: 'Attendance',
    nav_grades: 'Gradebook',
    nav_announcements: 'Announcements & Calendar',
    nav_cards: 'Account Cards',
    nav_logs: 'Activity Logs',
    nav_settings: 'School Settings',
    nav_account: 'Account Settings',
    nav_help: 'User Guide',
    rolePreview: 'Role View Preview',
    logoutPortal: 'Sign Out',
    searchPlaceholder: 'Search students, classes, subjects, or announcements...',
    notificationsTitle: 'Recent Notifications',
    closeLabel: 'Close',
    noNotifications: 'No new notifications.',

    // Academics & Grades Teacher Edit
    tabClasses: 'Classes',
    tabSubjects: 'Subjects',
    tabPeriods: 'Academic Years & Semesters',
    tabSchedules: 'Class Schedules',
    editSubjectTitle: 'Edit Subject',
    editScheduleTitle: 'Edit Class Schedule',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    gradesTabInput: 'Input & Edit Grades',
    gradesTabRecap: 'Grade Summary & Reports',
    gradesTabWeights: 'Grade Settings',
    editGradeTitle: 'Edit Student Grade',
    saveAllGrades: 'Save All Changes',
    ujianLisanLabel: 'Oral Exam',
    ujianTulisLabel: 'Written Exam',
  },
  ar: {
    // Public Header & Hero
    topInfo: 'معلومات التسجيل والشؤون الأكاديمية',
    loginPortal: 'دخول البوابة',
    masukPortal: 'دخول البوابة',
    navHome: 'الرئيسية',
    navAcademic: 'الأكاديمية',
    navAnnouncements: 'الإعلانات',
    navCalendar: 'التقويم',
    navContact: 'اتصل بنا',
    heroEyebrow: 'البوابة الأكاديمية والتعليمية المتكاملة',
    heroTermPrefix: 'العام الدراسي',
    heroSemester: 'الفصل',
    heroSecondaryBtn: 'الإعلانات والأخبار',
    accreditationLabel: 'الاعتماد',
    feature1Title: 'الأخلاق والتفوق العلمي',
    feature1Action: 'عرض التقويم',
    feature2Title: 'المناهج والمواد الدراسية',
    feature2Sub: 'إدارة الحضور والدرجات بشكل مباشر',
    feature2Action: 'بوابة المعلمين',
    feature3Title: 'بوابة الطلاب والدارسين',
    feature3Sub: 'الجداول والحضور وكشوف الدرجات',
    feature3Action: 'دخول الطلاب',

    // Public Info & Sections
    statYearLabel: 'العام الدراسي النشط',
    statSemLabel: 'الفصل الدراسي الحالي',
    statSemSub: 'تقييم وحضور متكامل',
    statSubjectLabel: 'المنهج والمواد الدراسية',
    statSubjectUnit: 'مادة دراسية',
    statSubjectSub: 'تقييم الاختبار الشفهي والتحريري',
    statRoleLabel: 'بوابات الدخول',
    roleAdmin: 'الإدارة',
    roleTeacher: 'المعلم',
    roleStudent: 'الطالب',
    annTitle: 'أحدث الإعلانات',
    annSubtitle: 'البيانات الرسمية للمدرسة والمعهد لجميع الطلاب وأولياء الأمور.',
    annLoginCta: 'سجل الدخول لإعلانات الفصول ←',
    annEmptyTitle: 'لا توجد إعلانات عامة منشورة حتى الآن.',
    annEmptySub: 'يمكن للإدارة نشر الإعلانات الرسمية عبر لوحة التحكم.',
    annPinned: 'مثبت',
    annViewAttachment: 'عرض المرفق',
    wpTitle: 'أخبار ومقالات موقع المدرسة (ووردبريس)',
    wpSubtitle: 'متزامنة مباشرة مع بوابة الأخبار الرسمية في ووردبريس.',
    wpVisit: 'زيارة موقع ووردبريس',
    wpReadMore: 'قراءة المقال كاملاً',
    calTitle: 'التقويم الأكاديمي',
    calSubtitle: 'مواعيد الأنشطة الدراسية والاختبارات والفعاليات للفصل الحالي.',
    calFilterAll: 'الكل',
    calFilterAcademic: 'أكاديمي',
    calFilterExam: 'اختبارات',
    calFilterEvent: 'أنشطة',
    calEmpty: 'لا توجد فعاليات في هذا التصنيف.',
    ecoTitle: 'بيئة تعليمية متكاملة',
    ecoDesc:
      'يدير المعلمون الحضور اليومي والتقييمات الموزونة بشكل مباشر، بينما يتابع الطلاب الجداول الدراسية وسجل الحضور والنتائج بأمان.',
    ecoSubjectsLabel: 'المواد النشطة',
    ecoCardLabel: 'التحقق من الهوية',
    ecoCardValue: 'بطاقة حساب QR',
    footerContactTitle: 'معلومات التواصل',
    footerPortalTitle: 'الدخول إلى البوابة',
    footerLoginAdmin: 'دخول الإدارة ←',
    footerLoginTeacher: 'دخول المعلمين ←',
    footerLoginStudent: 'دخول الطلاب ←',

    // Login Page
    backToHome: 'العودة إلى الصفحة الرئيسية',
    portalAdminTitle: 'بوابة الإدارة',
    portalAdminDesc: 'إدارة شاملة للمعلمين والطلاب والفصول والدرجات والحضور والأمان والتقارير.',
    portalTeacherTitle: 'بوابة المعلمين والأساتذة',
    portalTeacherDesc: 'إدارة حضور الفصل وتعديل المواد والجداول وإدخال الدرجات وإعلانات الفصل.',
    portalStudentTitle: 'بوابة الطلاب والدارسين',
    portalStudentDesc: 'متابعة الجدول الدراسي وسجل الحضور ودرجات المواد والإعلانات.',
    guideTitle: 'دليل الدخول الآمن',
    guideDesc:
      'يسجل المعلمون والطلاب الدخول بالبريد الإلكتروني المسجل لدى إدارة المدرسة عبر حساب جوجل الموثق أو تفعيل البريد وكلمة المرور.',
    selectAccessRole: 'اختر نوع حساب الدخول',
    tabLoginAdmin: 'دخول الإدارة',
    tabLoginTeacher: 'دخول المعلم',
    tabLoginStudent: 'دخول الطالب',
    googleSignIn: 'الدخول عبر Google',
    orWithEmail: 'أو عبر البريد الإلكتروني وكلمة المرور',
    modeLogin: 'تسجيل الدخول',
    modeActivate: 'تفعيل حساب جديد',
    modeReset: 'استعادة كلمة المرور',
    fullNameLabel: 'الاسم الكامل',
    emailLabel: 'البريد الإلكتروني المسجل',
    passwordLabel: 'كلمة المرور',
    newPasswordLabel: 'إنشاء كلمة مرور جديدة',
    btnDashboardLogin: 'الدخول إلى لوحة التحكم',
    btnActivateSend: 'تفعيل وإرسال رابط التحقق',
    btnResetSend: 'إرسال رابط استعادة كلمة المرور',

    // Dashboard Layout & Nav
    nav_dashboard: 'لوحة التحكم',
    nav_students: 'بيانات الطلاب',
    nav_teachers: 'بيانات المعلمين',
    nav_academics: 'المواد والجداول',
    nav_attendance: 'الحضور الإلكتروني',
    nav_grades: 'إدارة الدرجات',
    nav_announcements: 'الإعلانات والتقويم',
    nav_cards: 'بطاقات الحساب',
    nav_logs: 'سجل النشاطات',
    nav_settings: 'إعدادات المدرسة',
    nav_account: 'إعدادات الحساب',
    nav_help: 'دليل المساعدة',
    rolePreview: 'معاينة صلاحية الدور',
    logoutPortal: 'تسجيل الخروج',
    searchPlaceholder: 'ابحث عن طالب أو فصل أو مادة أو إعلان...',
    notificationsTitle: 'أحدث الإشعارات',
    closeLabel: 'إغلاق',
    noNotifications: 'لا توجد إشعارات جديدة.',

    // Academics & Grades Teacher Edit
    tabClasses: 'الفصول الدراسية',
    tabSubjects: 'المواد الدراسية',
    tabPeriods: 'الأعوام والفصول الدراسية',
    tabSchedules: 'الجدول الدراسي',
    editSubjectTitle: 'تعديل المادة الدراسية',
    editScheduleTitle: 'تعديل الحصة والجدول',
    saveChanges: 'حفظ التغييرات',
    cancel: 'إلغاء',
    gradesTabInput: 'إدخال وتعديل الدرجات',
    gradesTabRecap: 'ملخص الدرجات والشهادات',
    gradesTabWeights: 'إعدادات الدرجات',
    editGradeTitle: 'تعديل درجات الطالب',
    saveAllGrades: 'حفظ جميع التغييرات',
    ujianLisanLabel: 'الاختبار الشفهي',
    ujianTulisLabel: 'الاختبار التحريري',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.id;

interface LanguageContextValue {
  language: PortalLanguage;
  setLanguage: (lang: PortalLanguage) => void;
  t: (key: TranslationKey) => string;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<PortalLanguage>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('portal_lang');
      if (saved === 'id' || saved === 'en' || saved === 'ar') return saved;
    }
    return 'id';
  });

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('portal_lang', language);
  }, [language]);

  const setLanguage = useCallback((lang: PortalLanguage) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return TRANSLATIONS[language][key] || TRANSLATIONS.id[key] || key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isRtl: language === 'ar',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

const LANG_OPTIONS: Array<{ code: PortalLanguage; short: string; label: string }> = [
  { code: 'id', short: 'ID', label: 'Indonesia' },
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'ar', short: 'AR', label: 'العربية' },
];

export function LanguageSwitcher({
  variant = 'light',
}: {
  variant?: 'light' | 'dark';
}) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg border ${
        variant === 'dark'
          ? 'border-white/15 bg-white/5 text-slate-200'
          : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300'
      }`}
      role="group"
      aria-label="Pilihan Bahasa"
    >
      <Globe
        className={`w-3.5 h-3.5 mx-1.5 shrink-0 ${
          variant === 'dark' ? 'text-amber-400' : 'text-sky-600 dark:text-cyan-400'
        }`}
      />
      {LANG_OPTIONS.map((opt) => {
        const active = language === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            title={opt.label}
            onClick={() => setLanguage(opt.code)}
            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap ${
              active
                ? variant === 'dark'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-[#0F294A] text-white dark:bg-sky-600'
                : variant === 'dark'
                  ? 'text-slate-300 hover:text-white hover:bg-white/10'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {opt.code === 'ar' ? 'AR ع' : opt.short}
          </button>
        );
      })}
    </div>
  );
}
