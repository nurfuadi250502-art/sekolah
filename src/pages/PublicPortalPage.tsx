import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  ChevronRight,
  ExternalLink,
  Globe,
  GraduationCap,
  LogIn,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  Moon,
  Phone,
  Sun,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSwitcher, useLanguage } from '../contexts/LanguageContext';
import {
  fetchPublicAcademicInfo,
  fetchPublicAnnouncements,
} from '../services/firestoreService';
import { fetchWordPressPosts } from '../services/wordpressService';
import {
  AcademicCalendarEvent,
  AcademicYear,
  Announcement,
  Semester,
  Subject,
  UserRole,
  WordPressPost,
} from '../types/portal';

const PONDOK_LOGO = '/assets/aistudio/logo_pondok_7b601747.png';
const HERO_CAMPUS_IMG = '/src/assets/images/school_campus_hero_1795012759323.jpg';
const PRINCIPAL_IMG = '/src/assets/images/avatar_principal_portrait_1795012760302.jpg';
const LIBRARY_IMG = '/src/assets/images/campus_library_study_1795012760559.jpg';

export function PublicPortalPage({
  onOpenLogin,
}: {
  onOpenLogin: (initialRole?: UserRole) => void;
}) {
  const { schoolSettings, theme, toggleTheme } = useAuth();
  const { t, isRtl } = useLanguage();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [calendarFilter, setCalendarFilter] = useState<string>('Semua');
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [wpPosts, setWpPosts] = useState<WordPressPost[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const resolvedLogo =
    !schoolSettings.logoUrl ||
    schoolSettings.logoUrl === '/src/assets/images/school_crest_logo_1795012759504.jpg'
      ? PONDOK_LOGO
      : schoolSettings.logoUrl;

  useEffect(() => {
    let active = true;
    async function loadPublic() {
      const [anns, info] = await Promise.all([
        fetchPublicAnnouncements(),
        fetchPublicAcademicInfo(),
      ]);
      if (!active) return;
      setAnnouncements(anns);
      setAcademicYears(info.academicYears);
      setSemesters(info.semesters);
      setSubjects(info.subjects);
      setLoadingPublic(false);
    }
    void loadPublic();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !schoolSettings.wpSyncEnabled ||
      !schoolSettings.wpShowOnPublicHome ||
      !schoolSettings.wpSiteUrl
    ) {
      setWpPosts([]);
      return;
    }
    let active = true;
    void fetchWordPressPosts(schoolSettings.wpSiteUrl, {
      categoryId: schoolSettings.wpCategoryId,
      perPage: 3,
    })
      .then((posts) => {
        if (active) setWpPosts(posts);
      })
      .catch(() => {
        if (active) setWpPosts([]);
      });
    return () => {
      active = false;
    };
  }, [
    schoolSettings.wpSyncEnabled,
    schoolSettings.wpShowOnPublicHome,
    schoolSettings.wpSiteUrl,
    schoolSettings.wpCategoryId,
  ]);

  const activeYear = academicYears.find((y) => y.isActive) || academicYears[0];
  const activeSem = semesters.find((s) => s.isActive) || semesters[0];
  const calendarEvents: AcademicCalendarEvent[] = schoolSettings.calendarEvents || [];
  const filteredEvents =
    calendarFilter === 'Semua'
      ? calendarEvents
      : calendarEvents.filter((e) => e.category === calendarFilter);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#091322] text-slate-900 dark:text-slate-100">
      {/* Top Utility Contact Bar (Inspired by Picture 1) */}
      <div className="bg-[#121820] text-slate-200 border-b border-white/10 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0 overflow-hidden">
            <span className="hidden sm:inline font-medium text-slate-300 whitespace-nowrap">
              {t('topInfo')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-200 whitespace-nowrap tabular-nums">
              <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {schoolSettings.phone}
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5 text-slate-200 truncate">
              <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              {schoolSettings.email}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSwitcher variant="dark" />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-md border border-white/15 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Ubah tema tampilan"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onOpenLogin()}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] uppercase tracking-wide transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3 h-3" />
              {t('loginPortal')}
            </button>
          </div>
        </div>
      </div>

      {/* Full-Bleed Atmospheric Hero with Pondok Logo Background */}
      <section
        id="beranda"
        className="relative overflow-hidden bg-[#06181A] text-white"
      >
        {/* Subtle campus backdrop layer */}
        <img
          src={HERO_CAMPUS_IMG}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity scale-105"
        />

        {/* Deep emerald-navy atmospheric gradient */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[#06171A]/95 via-[#0B2D25]/85 to-[#081C2E]/95"
        />

        {/* Warm ambient radial spotlight behind the Pondok crest */}
        <div
          aria-hidden="true"
          className="hidden sm:block absolute right-[4%] lg:right-[9%] top-1/2 -translate-y-1/2 w-[380px] h-[380px] lg:w-[540px] lg:h-[540px] rounded-full bg-amber-400/15 blur-3xl pointer-events-none"
        />

        {/* Prominent Pondok Logo Background Watermark / Emblem */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-y-0 right-0 w-full lg:w-[58%] flex items-center justify-center lg:justify-end pr-0 lg:pr-14 overflow-hidden"
        >
          <img
            src={PONDOK_LOGO}
            alt=""
            className="w-[340px] sm:w-[440px] lg:w-[520px] max-w-none object-contain opacity-30 sm:opacity-40 lg:opacity-65 drop-shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
            style={{
              WebkitMaskImage:
                'radial-gradient(circle at center, rgba(0,0,0,0.98) 54%, rgba(0,0,0,0) 82%)',
              maskImage:
                'radial-gradient(circle at center, rgba(0,0,0,0.98) 54%, rgba(0,0,0,0) 82%)',
            }}
          />
        </div>

        {/* Directional dark scrim on the left so hero text stays razor-sharp */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#061419]/95 via-[#061419]/75 to-transparent"
        />

        {/* Overlay Navigation Header inside Hero (matching Picture 1) */}
        <header className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-3">
          <div className="flex items-center justify-between gap-6">
            <a href="#beranda" className="flex items-center gap-3.5 min-w-0 shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/95 p-1 shadow-md border border-amber-400/50 flex items-center justify-center shrink-0">
                <img
                  src={resolvedLogo}
                  alt={`Logo ${schoolSettings.schoolName}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300 truncate">
                  Modern Islamic Boarding School
                </p>
                <span className="font-display font-extrabold text-base sm:text-xl tracking-tight text-white block truncate max-w-[210px] sm:max-w-sm">
                  {schoolSettings.schoolName}
                </span>
              </div>
            </a>

            <nav className="hidden lg:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-slate-100">
              <a
                href="#beranda"
                className="py-1.5 border-b-2 border-amber-400 text-white whitespace-nowrap"
              >
                {t('navHome')}
              </a>
              <a
                href="#informasi"
                className="py-1.5 border-b-2 border-transparent hover:border-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                {t('navAcademic')}
              </a>
              <a
                href="#pengumuman"
                className="py-1.5 border-b-2 border-transparent hover:border-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                {t('navAnnouncements')}
              </a>
              <a
                href="#kalender"
                className="py-1.5 border-b-2 border-transparent hover:border-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                {t('navCalendar')}
              </a>
              <a
                href="#kontak"
                className="py-1.5 border-b-2 border-transparent hover:border-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                {t('navContact')}
              </a>
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenLogin()}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded border border-amber-400/70 bg-amber-400/15 hover:bg-amber-400 hover:text-slate-950 text-amber-300 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                {t('masukPortal')}
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="lg:hidden p-2 rounded-lg border border-white/20 text-white hover:bg-white/10"
                aria-label="Toggle navigasi"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden mt-3 p-4 rounded-xl bg-[#091822]/95 border border-white/15 backdrop-blur-md flex flex-col gap-3 text-xs font-bold uppercase tracking-wider">
              <a href="#beranda" onClick={() => setMobileMenuOpen(false)} className="text-amber-300">
                {t('navHome')}
              </a>
              <a href="#informasi" onClick={() => setMobileMenuOpen(false)} className="text-slate-100">
                {t('navAcademic')}
              </a>
              <a href="#pengumuman" onClick={() => setMobileMenuOpen(false)} className="text-slate-100">
                {t('navAnnouncements')}
              </a>
              <a href="#kalender" onClick={() => setMobileMenuOpen(false)} className="text-slate-100">
                {t('navCalendar')}
              </a>
              <a href="#kontak" onClick={() => setMobileMenuOpen(false)} className="text-slate-100">
                {t('navContact')}
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLogin();
                }}
                className="mt-1 py-2.5 px-4 rounded bg-amber-400 text-slate-950 font-extrabold text-center"
              >
                {t('masukPortal')}
              </button>
            </div>
          )}
        </header>

        {/* Hero Main Content Area */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20">
          <div className="max-w-2xl">
            <p className="font-display text-lg sm:text-2xl font-bold text-amber-400 tracking-tight mb-2">
              {t('heroEyebrow')}
            </p>
            <h1
              className="font-display font-extrabold text-white tracking-tight leading-[1.06] mb-3"
              style={{ fontSize: 'clamp(2.15rem, 4.4vw, 3.85rem)', textWrap: 'balance' }}
            >
              {schoolSettings.welcomeTitle || schoolSettings.schoolName}
            </h1>
            <p className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-amber-400 tracking-tight mb-5 tabular-nums">
              {t('heroTermPrefix')} {activeYear?.name || '2026/2027'} · {t('heroSemester')} {activeSem?.name || 'Ganjil'}
            </p>
            <p className="text-slate-200/95 text-sm sm:text-base leading-relaxed max-w-xl mb-7">
              {schoolSettings.welcomeMessage}
            </p>

            {/* Primary Gold CTA + Secondary Outline */}
            <div className="flex flex-wrap items-center gap-3.5 mb-8">
              <button
                type="button"
                onClick={() => onOpenLogin()}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-sm bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-extrabold uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-colors whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                {t('masukPortal')}
              </button>
              <a
                href="#pengumuman"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-sm border border-white/30 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold uppercase tracking-wider backdrop-blur-sm transition-colors whitespace-nowrap"
              >
                {t('heroSecondaryBtn')}
              </a>
            </div>

            {/* Principal / Mudir Attribution */}
            <div className="inline-flex items-center gap-3.5 pt-4 border-t border-white/15">
              <img
                src={PRINCIPAL_IMG}
                alt={schoolSettings.principalName || 'Pimpinan / Kepala Sekolah'}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border-2 border-amber-400/70 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {schoolSettings.principalName || 'Pimpinan Pondok / Kepala Sekolah'}
                </p>
                <p className="text-xs text-amber-300/90 truncate">
                  {schoolSettings.schoolName} · {t('accreditationLabel')} {schoolSettings.accreditation || 'A (Unggul)'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom 3-Column Translucent Feature Bar (Signature Layout from Picture 1) */}
        <div className="relative z-10 bg-black/50 backdrop-blur-md border-t border-white/15">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/15">
              <div className="py-5 md:pe-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-amber-400 shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-extrabold text-sm sm:text-base uppercase tracking-wide text-white leading-snug">
                    {t('feature1Title')}
                  </h2>
                  <p className="text-xs text-slate-300 truncate mt-0.5">
                    {t('heroTermPrefix')} {activeYear?.name || '2026/2027'} · NPSN {schoolSettings.npsn || '20102588'}
                  </p>
                  <a
                    href="#kalender"
                    className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 mt-1.5"
                  >
                    {t('feature1Action')}
                    <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                  </a>
                </div>
              </div>

              <div className="py-5 md:px-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-amber-400 shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-extrabold text-sm sm:text-base uppercase tracking-wide text-white leading-snug">
                    {t('feature2Title')} {subjects.length > 0 ? `(${subjects.length})` : ''}
                  </h2>
                  <p className="text-xs text-slate-300 truncate mt-0.5">
                    {t('feature2Sub')}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenLogin('teacher')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 mt-1.5"
                  >
                    {t('feature2Action')}
                    <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="py-5 md:ps-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-amber-400 shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-extrabold text-sm sm:text-base uppercase tracking-wide text-white leading-snug">
                    {t('feature3Title')}
                  </h2>
                  <p className="text-xs text-slate-300 truncate mt-0.5">
                    {t('feature3Sub')}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenLogin('student')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 mt-1.5"
                  >
                    {t('feature3Action')}
                    <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-column Academic Info & Quick Access Strip */}
      <section
        id="informasi"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('statYearLabel')}</p>
            <p className="text-xl font-bold font-display text-[#0F294A] dark:text-white mt-1 tabular-nums">
              {activeYear?.name || '2026/2027'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {activeYear ? `${activeYear.startDate} — ${activeYear.endDate}` : 'Kalender Resmi Sekolah'}
            </p>
          </div>
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('statSemLabel')}</p>
            <p className="text-xl font-bold font-display text-[#0F294A] dark:text-white mt-1">
              {t('heroSemester')} {activeSem?.name || 'Ganjil'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('statSemSub')}
            </p>
          </div>
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('statSubjectLabel')}</p>
            <p className="text-xl font-bold font-display text-[#0F294A] dark:text-white mt-1 tabular-nums">
              {subjects.length > 0 ? `${subjects.length} ${t('statSubjectUnit')}` : t('feature2Title')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('statSubjectSub')}
            </p>
          </div>
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('statRoleLabel')}</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => onOpenLogin('admin')}
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-500/20"
              >
                {t('roleAdmin')}
              </button>
              <button
                type="button"
                onClick={() => onOpenLogin('teacher')}
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-500/20"
              >
                {t('roleTeacher')}
              </button>
              <button
                type="button"
                onClick={() => onOpenLogin('student')}
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-500/20"
              >
                {t('roleStudent')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Announcements */}
      <section
        id="pengumuman"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 dark:border-slate-800"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2.5">
              <Megaphone className="w-5 h-5 text-emerald-700 dark:text-amber-400" />
              {t('annTitle')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {t('annSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenLogin()}
            className="text-sm font-semibold text-emerald-800 dark:text-amber-400 hover:underline whitespace-nowrap shrink-0"
          >
            {t('annLoginCta')}
          </button>
        </div>

        {loadingPublic ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-44 rounded-xl bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {t('annEmptyTitle')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('annEmptySub')}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {announcements.slice(0, 6).map((ann) => (
              <article
                key={ann.id}
                className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-2">
                    <span className="font-mono-tabular">{ann.publishDate}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ann.authorName}</span>
                    {ann.isPinned && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 dark:text-amber-400 font-semibold">
                          {t('annPinned')}
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug mb-2">
                    {ann.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4">
                    {ann.content}
                  </p>
                </div>
                {ann.attachmentUrl && (
                  <a
                    href={ann.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-amber-400 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {ann.attachmentName || t('annViewAttachment')}
                  </a>
                )}
              </article>
            ))}
          </div>
        )}

        {wpPosts.length > 0 && (
          <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
              <div>
                <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-700 dark:text-amber-400" />
                  {t('wpTitle')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {t('wpSubtitle')}
                </p>
              </div>
              {schoolSettings.wpSiteUrl && (
                <a
                  href={schoolSettings.wpSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-amber-400 hover:underline whitespace-nowrap"
                >
                  {t('wpVisit')}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {wpPosts.map((post) => (
                <article
                  key={post.id}
                  className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {post.featuredImage && (
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-40 object-cover border-b border-slate-200 dark:border-slate-800"
                      />
                    )}
                    <div className="p-5">
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-2">
                        <span className="font-mono-tabular">{post.date}</span>
                        {post.categories[0] && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-700 dark:text-amber-400 font-semibold">
                              {post.categories[0]}
                            </span>
                          </>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white leading-snug mb-2">
                        {post.title}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    </div>
                  </div>
                  <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800">
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-amber-400 hover:underline"
                    >
                      {t('wpReadMore')}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Academic Calendar & Learning Environment */}
      <section
        id="kalender"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 dark:border-slate-800"
      >
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-emerald-700 dark:text-amber-400" />
                  {t('calTitle')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {t('calSubtitle')}
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 shrink-0">
                {(
                  [
                    { id: 'Semua', label: t('calFilterAll') },
                    { id: 'Akademik', label: t('calFilterAcademic') },
                    { id: 'Ujian', label: t('calFilterExam') },
                    { id: 'Kegiatan', label: t('calFilterEvent') },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCalendarFilter(cat.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      calendarFilter === cat.id
                        ? 'bg-white dark:bg-[#0F294A] text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t('calEmpty')}
                </div>
              ) : (
                filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-1">
                        <span className="font-mono-tabular font-medium text-emerald-700 dark:text-amber-400">
                          {ev.date}
                          {ev.endDate ? ` — ${ev.endDate}` : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ev.category}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {ev.title}
                      </h3>
                      {ev.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <img
              src={LIBRARY_IMG}
              alt="Perpustakaan Digital Pondok"
              referrerPolicy="no-referrer"
              className="w-full h-56 object-cover"
            />
            <div className="p-6">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-700 dark:text-amber-400" />
                {t('ecoTitle')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                {t('ecoDesc')}
              </p>
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">{t('ecoSubjectsLabel')}</p>
                  <p className="font-bold text-base text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {subjects.length || t('feature2Title')}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">{t('ecoCardLabel')}</p>
                  <p className="font-bold text-base text-slate-900 dark:text-white mt-0.5">
                    {t('ecoCardValue')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact & Footer */}
      <footer
        id="kontak"
        className="bg-[#081A1F] text-slate-200 border-t border-white/10 mt-8"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-5">
              <div className="flex items-center gap-3.5 mb-4">
                <img
                  src={resolvedLogo}
                  alt={schoolSettings.schoolName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl object-contain bg-white/95 p-1"
                />
                <div>
                  <p className="font-display font-bold text-white text-base">
                    {schoolSettings.schoolName}
                  </p>
                  <p className="text-xs text-amber-400">Modern Islamic Boarding School</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed max-w-md">
                {schoolSettings.tagline}
              </p>
            </div>

            <div className="md:col-span-4 space-y-2.5 text-sm">
              <p className="font-semibold text-white mb-2">{t('footerContactTitle')}</p>
              <p className="flex items-start gap-2.5 text-slate-300">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{schoolSettings.address}</span>
              </p>
              <p className="flex items-center gap-2.5 text-slate-300">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="tabular-nums">{schoolSettings.phone}</span>
              </p>
              <p className="flex items-center gap-2.5 text-slate-300">
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{schoolSettings.email}</span>
              </p>
              {schoolSettings.website && (
                <p className="flex items-center gap-2.5 text-slate-300">
                  <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{schoolSettings.website}</span>
                </p>
              )}
            </div>

            <div className="md:col-span-3">
              <p className="font-semibold text-white mb-3">{t('footerPortalTitle')}</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onOpenLogin('admin')}
                  className="text-start text-sm text-slate-300 hover:text-amber-300 transition-colors"
                >
                  {t('footerLoginAdmin')}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLogin('teacher')}
                  className="text-start text-sm text-slate-300 hover:text-amber-300 transition-colors"
                >
                  {t('footerLoginTeacher')}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLogin('student')}
                  className="text-start text-sm text-slate-300 hover:text-amber-300 transition-colors"
                >
                  {t('footerLoginStudent')}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} {schoolSettings.schoolName}. School Academic Portal.</p>
            <p>Terintegrasi Firebase Authentication &amp; Cloud Firestore</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
