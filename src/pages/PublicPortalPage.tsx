import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Calendar,
  ExternalLink,
  Globe,
  GraduationCap,
  LogIn,
  Mail,
  MapPin,
  Megaphone,
  Moon,
  Phone,
  Sun,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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

const HERO_CAMPUS_IMG = '/src/assets/images/school_campus_hero_1795012759323.jpg';
const PRINCIPAL_IMG = '/src/assets/images/avatar_principal_portrait_1795012760302.jpg';
const LIBRARY_IMG = '/src/assets/images/campus_library_study_1795012760559.jpg';

export function PublicPortalPage({
  onOpenLogin,
}: {
  onOpenLogin: (initialRole?: UserRole) => void;
}) {
  const { schoolSettings, theme, toggleTheme } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [calendarFilter, setCalendarFilter] = useState<string>('Semua');
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [wpPosts, setWpPosts] = useState<WordPressPost[]>([]);

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
    if (!schoolSettings.wpSyncEnabled || !schoolSettings.wpShowOnPublicHome || !schoolSettings.wpSiteUrl) {
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
  }, [schoolSettings.wpSyncEnabled, schoolSettings.wpShowOnPublicHome, schoolSettings.wpSiteUrl, schoolSettings.wpCategoryId]);

  const activeYear = academicYears.find((y) => y.isActive) || academicYears[0];
  const activeSem = semesters.find((s) => s.isActive) || semesters[0];
  const calendarEvents: AcademicCalendarEvent[] = schoolSettings.calendarEvents || [];
  const filteredEvents =
    calendarFilter === 'Semua'
      ? calendarEvents
      : calendarEvents.filter((e) => e.category === calendarFilter);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#091322] text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B172A]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#beranda"
            className="flex items-center gap-3 min-w-0 shrink-0"
          >
            <img
              src={schoolSettings.logoUrl || '/src/assets/images/school_crest_logo_1795012759504.jpg'}
              alt={`Logo ${schoolSettings.schoolName}`}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0"
            />
            <span className="font-display font-bold text-base sm:text-lg tracking-tight text-[#0F294A] dark:text-white whitespace-nowrap truncate max-w-[220px] sm:max-w-xs">
              {schoolSettings.schoolName}
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#beranda"
              className="hover:text-[#0F294A] dark:hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              Beranda
            </a>
            <a
              href="#informasi"
              className="hover:text-[#0F294A] dark:hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              Akademik
            </a>
            <a
              href="#pengumuman"
              className="hover:text-[#0F294A] dark:hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              Pengumuman
            </a>
            <a
              href="#kalender"
              className="hover:text-[#0F294A] dark:hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              Kalender
            </a>
            <a
              href="#kontak"
              className="hover:text-[#0F294A] dark:hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              Kontak
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Ubah tema tampilan"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => onOpenLogin()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-4 h-4" />
              Masuk Portal
            </button>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section id="beranda" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:pt-14 lg:pb-16">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10">
            <div>
              <p className="text-xs font-semibold tracking-wide text-sky-700 dark:text-cyan-400 mb-3">
                School Academic Portal · NPSN {schoolSettings.npsn || '20102588'}
              </p>
              <h1
                className="font-display font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.15] mb-4"
                style={{ fontSize: 'clamp(1.9rem, 3.2vw, 2.85rem)', textWrap: 'balance' }}
              >
                {schoolSettings.welcomeTitle || 'Portal Akademik Sekolah Terintegrasi'}
              </h1>
              <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed mb-6">
                {schoolSettings.welcomeMessage}
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-8">
                <button
                  type="button"
                  onClick={() => onOpenLogin()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  Masuk ke Portal Akademik
                </button>
                <a
                  href="#pengumuman"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Pengumuman Sekolah
                </a>
              </div>
            </div>

            {/* Principal Welcome Attribution */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center gap-4">
              <img
                src={PRINCIPAL_IMG}
                alt={schoolSettings.principalName || 'Kepala Sekolah'}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {schoolSettings.principalName || 'Kepala Sekolah'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kepala {schoolSettings.schoolName}
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[300px] lg:min-h-[460px] bg-slate-200 dark:bg-slate-800">
            <img
              src={HERO_CAMPUS_IMG}
              alt={`Lingkungan Kampus ${schoolSettings.schoolName}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#091322]/85 via-[#091322]/25 to-transparent flex items-end p-6 sm:p-8">
              <div>
                <p className="text-xs font-medium text-cyan-300 mb-1">
                  Akreditasi {schoolSettings.accreditation || 'A (Unggul)'}
                </p>
                <p className="text-white font-display font-bold text-lg sm:text-xl leading-snug">
                  {schoolSettings.tagline || 'Unggul dalam Prestasi dan Berkarakter'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4-column Academic Info Strip below Hero */}
        <div
          id="informasi"
          className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Tahun Ajaran Aktif</p>
            <p className="text-xl font-bold font-display text-[#0F294A] dark:text-white mt-1 tabular-nums">
              {activeYear?.name || '2026/2027'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {activeYear ? `${activeYear.startDate} s.d. ${activeYear.endDate}` : 'Kalender Resmi Sekolah'}
            </p>
          </div>
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Semester Berjalan</p>
            <p className="text-xl font-bold font-display text-[#0F294A] dark:text-white mt-1">
              Semester {activeSem?.name || 'Ganjil'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Penilaian & Presensi Terintegrasi
            </p>
          </div>
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Kurikulum & Mata Pelajaran</p>
            <p className="text-xl font-bold font-display text-[#0F294A] dark:text-white mt-1 tabular-nums">
              {subjects.length > 0 ? `${subjects.length} Mata Pelajaran` : 'Kurikulum Merdeka'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Evaluasi Terstruktur Tugas–PAS
            </p>
          </div>
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Akses Peran Portal</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => onOpenLogin('admin')}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/40"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => onOpenLogin('teacher')}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/40"
              >
                Guru
              </button>
              <button
                type="button"
                onClick={() => onOpenLogin('student')}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/40"
              >
                Siswa
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
              <Megaphone className="w-5 h-5 text-sky-600 dark:text-cyan-400" />
              Pengumuman Terbaru
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Informasi resmi sekolah untuk seluruh warga belajar dan orang tua/wali.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenLogin()}
            className="text-sm font-semibold text-sky-700 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0"
          >
            Masuk untuk pengumuman kelas →
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
              Belum ada pengumuman publik yang dipublikasikan.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Administrator dapat menerbitkan pengumuman sekolah melalui dashboard portal.
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
                    <span>{ann.publishDate}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ann.authorName}</span>
                    {ann.isPinned && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-sky-700 dark:text-cyan-400 font-semibold">Disematkan</span>
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
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-cyan-400 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {ann.attachmentName || 'Lihat Lampiran'}
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
                  <Globe className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                  Berita & Artikel Website Sekolah (WordPress)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Tersinkronisasi langsung dari portal berita WordPress resmi sekolah.
                </p>
              </div>
              {schoolSettings.wpSiteUrl && (
                <a
                  href={schoolSettings.wpSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-cyan-400 hover:underline whitespace-nowrap"
                >
                  Kunjungi Website WordPress
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
                            <span className="text-sky-700 dark:text-cyan-400 font-semibold">
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
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-cyan-400 hover:underline"
                    >
                      Baca Artikel Lengkap
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
                  <Calendar className="w-5 h-5 text-sky-600 dark:text-cyan-400" />
                  Kalender Akademik
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Jadwal kegiatan akademik, ujian, dan agenda penting semester berjalan.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 shrink-0">
                {['Semua', 'Akademik', 'Ujian', 'Kegiatan'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCalendarFilter(cat)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      calendarFilter === cat
                        ? 'bg-white dark:bg-[#0F294A] text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Tidak ada agenda pada kategori ini.
                </div>
              ) : (
                filteredEvents.map((ev) => (
                  <div key={ev.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-1">
                        <span className="font-mono-tabular font-medium text-sky-700 dark:text-cyan-400">
                          {ev.date}
                          {ev.endDate ? ` — ${ev.endDate}` : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ev.category}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{ev.title}</h3>
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
              alt="Perpustakaan Digital Sekolah"
              referrerPolicy="no-referrer"
              className="w-full h-56 object-cover"
            />
            <div className="p-6">
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-sky-600 dark:text-cyan-400" />
                Ekosistem Belajar Terpadu
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                Guru mengelola presensi harian dan penilaian berbasis bobot kurikulum secara langsung, sementara siswa memantau jadwal, kehadiran, dan rapor hasil belajar dengan aman.
              </p>
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Mata Pelajaran Aktif</p>
                  <p className="font-bold text-base text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {subjects.length || 'Sesuai Kurikulum'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Verifikasi Identitas</p>
                  <p className="font-bold text-base text-slate-900 dark:text-white mt-0.5">
                    Kartu Akun QR
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
        className="bg-[#0A1D37] text-slate-200 border-t border-slate-800 mt-8"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-5">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={schoolSettings.logoUrl || '/src/assets/images/school_crest_logo_1795012759504.jpg'}
                  alt={schoolSettings.schoolName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-lg object-cover bg-white"
                />
                <div>
                  <p className="font-display font-bold text-white text-base">
                    {schoolSettings.schoolName}
                  </p>
                  <p className="text-xs text-cyan-300">School Academic Portal</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed max-w-md">
                {schoolSettings.tagline}
              </p>
            </div>

            <div className="md:col-span-4 space-y-2.5 text-sm">
              <p className="font-semibold text-white mb-2">Informasi Kontak Sekolah</p>
              <p className="flex items-start gap-2.5 text-slate-300">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>{schoolSettings.address}</span>
              </p>
              <p className="flex items-center gap-2.5 text-slate-300">
                <Phone className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="tabular-nums">{schoolSettings.phone}</span>
              </p>
              <p className="flex items-center gap-2.5 text-slate-300">
                <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{schoolSettings.email}</span>
              </p>
              {schoolSettings.website && (
                <p className="flex items-center gap-2.5 text-slate-300">
                  <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{schoolSettings.website}</span>
                </p>
              )}
            </div>

            <div className="md:col-span-3">
              <p className="font-semibold text-white mb-3">Akses Portal</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onOpenLogin('admin')}
                  className="text-left text-sm text-slate-300 hover:text-cyan-300 transition-colors"
                >
                  Login Administrator →
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLogin('teacher')}
                  className="text-left text-sm text-slate-300 hover:text-cyan-300 transition-colors"
                >
                  Login Guru & Pengajar →
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLogin('student')}
                  className="text-left text-sm text-slate-300 hover:text-cyan-300 transition-colors"
                >
                  Login Siswa →
                </button>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} {schoolSettings.schoolName}. School Academic Portal.</p>
            <p>Terintegrasi Firebase Authentication & Cloud Firestore</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
