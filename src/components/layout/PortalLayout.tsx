import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  CalendarCheck,
  CreditCard,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LanguageSwitcher, TranslationKey, useLanguage } from '../../contexts/LanguageContext';
import { usePortalData } from '../../contexts/PortalDataContext';
import { markNotificationRead } from '../../services/firestoreService';
import { NavTabId, UserRole } from '../../types/portal';

interface NavItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student'] },
  { id: 'students', label: 'Data Siswa', icon: GraduationCap, roles: ['admin', 'teacher'] },
  { id: 'teachers', label: 'Data Guru', icon: Users, roles: ['admin'] },
  { id: 'academics', label: 'Kelas & Jadwal', icon: BookOpen, roles: ['admin', 'teacher', 'student'] },
  { id: 'attendance', label: 'Absensi Online', icon: CalendarCheck, roles: ['admin', 'teacher', 'student'] },
  { id: 'grades', label: 'Pengelolaan Nilai', icon: Award, roles: ['admin', 'teacher', 'student'] },
  { id: 'announcements', label: 'Pengumuman & Kalender', icon: Megaphone, roles: ['admin', 'teacher', 'student'] },
  { id: 'cards', label: 'Kartu Akun', icon: CreditCard, roles: ['admin'] },
  { id: 'logs', label: 'Log Aktivitas', icon: Activity, roles: ['admin'] },
  { id: 'settings', label: 'Pengaturan Sekolah', icon: Settings, roles: ['admin'] },
  { id: 'account', label: 'Pengaturan Akun', icon: UserCog, roles: ['admin', 'teacher', 'student'] },
  { id: 'help', label: 'Bantuan Pengguna', icon: HelpCircle, roles: ['admin', 'teacher', 'student'] },
];

export function PortalLayout({
  activeTab,
  onSelectTab,
  children,
}: {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  children: React.ReactNode;
}) {
  const {
    userProfile,
    effectiveRole,
    setPreviewRole,
    schoolSettings,
    theme,
    toggleTheme,
    logout,
  } = useAuth();
  const { students, teachers, classes, subjects, announcements, notifications } = usePortalData();
  const { t, isRtl } = useLanguage();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');

  const role = effectiveRole || 'student';
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.roles.includes(role)),
    [role]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const searchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: Array<{ label: string; meta: string; tab: NavTabId }> = [];

    for (const s of students) {
      if (s.fullName.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q)) {
        results.push({ label: s.fullName, meta: `Siswa · NIS ${s.nis}`, tab: 'students' });
      }
    }
    if (role === 'admin') {
      for (const t of teachers) {
        if (t.fullName.toLowerCase().includes(q) || t.teacherCode.toLowerCase().includes(q)) {
          results.push({ label: t.fullName, meta: `Guru · ${t.teacherCode}`, tab: 'teachers' });
        }
      }
    }
    for (const c of classes) {
      if (c.name.toLowerCase().includes(q)) {
        results.push({ label: c.name, meta: `Kelas · Tingkat ${c.gradeLevel}`, tab: 'academics' });
      }
    }
    for (const sub of subjects) {
      if (sub.name.toLowerCase().includes(q) || sub.code.toLowerCase().includes(q)) {
        results.push({ label: sub.name, meta: `Mata Pelajaran · ${sub.code}`, tab: 'academics' });
      }
    }
    for (const ann of announcements) {
      if (ann.title.toLowerCase().includes(q)) {
        results.push({ label: ann.title, meta: `Pengumuman · ${ann.publishDate}`, tab: 'announcements' });
      }
    }
    return results.slice(0, 8);
  }, [globalQuery, students, teachers, classes, subjects, announcements, role]);

  const roleLabel =
    role === 'admin' ? t('roleAdmin') : role === 'teacher' ? t('roleTeacher') : t('roleStudent');
  const activeTitle = t(('nav_' + activeTab) as TranslationKey);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#091322] text-slate-900 dark:text-slate-100">
      {/* Desktop & Mobile Sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden no-print"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 start-0 z-50 w-64 bg-[#0A1D37] text-slate-200 flex flex-col border-e border-slate-800/80 transition-transform duration-200 lg:static lg:translate-x-0 no-print ${
          mobileMenuOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={
                !schoolSettings.logoUrl ||
                schoolSettings.logoUrl === '/src/assets/images/school_crest_logo_1795012759504.jpg'
                  ? '/assets/aistudio/logo_pondok_7b601747.png'
                  : schoolSettings.logoUrl
              }
              alt={schoolSettings.schoolName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-contain bg-white/95 p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-white truncate">
                {schoolSettings.schoolName}
              </p>
              <p className="text-[11px] text-cyan-300 truncate">Academic Portal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sky-500/20 text-cyan-300'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t(('nav_' + item.id) as TranslationKey)}</span>
              </button>
            );
          })}
        </nav>

        {/* Admin Role Preview Switcher */}
        {userProfile?.role === 'admin' && (
          <div className="px-3 py-3 border-t border-white/10">
            <p className="text-[11px] text-slate-400 mb-1.5 px-1">{t('rolePreview')}</p>
            <div className="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-lg">
              {(['admin', 'teacher', 'student'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setPreviewRole(r === 'admin' ? null : r);
                    onSelectTab('dashboard');
                  }}
                  className={`py-1 text-[11px] font-semibold rounded transition-colors ${
                    role === r ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r === 'admin' ? t('roleAdmin') : r === 'teacher' ? t('roleTeacher') : t('roleStudent')}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-300 hover:bg-rose-500/15 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>{t('logoutPortal')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-[#0B172A] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                {activeTitle}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                {schoolSettings.schoolName} · {roleLabel}
              </p>
            </div>
          </div>

          {/* Global Search */}
          <div className="relative hidden md:block flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full ps-9 pe-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#162742] text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            {searchResults.length > 0 && (
              <div className="absolute inset-x-0 mt-1.5 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 z-50">
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelectTab(res.tab);
                      setGlobalQuery('');
                    }}
                    className="w-full text-start px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {res.label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                      {res.meta}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Utilities */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSwitcher variant="light" />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Ubah tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Notifikasi"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute end-0 mt-2 w-80 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {t('notificationsTitle')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      {t('closeLabel')}
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                        {t('noNotifications')}
                      </p>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            void markNotificationRead(n);
                            setNotifOpen(false);
                            if (n.category === 'announcement') onSelectTab('announcements');
                          }}
                          className={`w-full text-left p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                            !n.isRead ? 'bg-sky-50/50 dark:bg-sky-950/20' : ''
                          }`}
                        >
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onSelectTab('account')}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#0F294A] text-white text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (userProfile?.displayName || 'U').slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="hidden sm:block text-left min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[130px]">
                  {userProfile?.displayName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {roleLabel}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
