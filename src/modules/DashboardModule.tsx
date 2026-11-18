import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Database,
  GraduationCap,
  Layers,
  Megaphone,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { usePortalData } from '../contexts/PortalDataContext';
import { useToast } from '../components/ui/ToastProvider';
import { initializeSchoolBaseline } from '../services/firestoreService';
import { NavTabId } from '../types/portal';

const CHART_COLORS = ['#0F294A', '#0284C7', '#06B6D4', '#16A34A', '#D97706', '#DC2626'];

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className="text-2xl font-bold font-display text-slate-900 dark:text-white mt-1.5 tabular-nums">
          {value}
        </p>
        {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{sub}</p>}
      </div>
      <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-cyan-400 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

export function DashboardModule({
  onNavigate,
}: {
  onNavigate: (tab: NavTabId) => void;
}) {
  const { userProfile, effectiveRole, schoolSettings } = useAuth();
  const {
    students,
    teachers,
    classes,
    subjects,
    schedules,
    attendance,
    grades,
    announcements,
    activityLogs,
    users,
    activeAcademicYear,
    activeSemester,
    currentTeacher,
    currentStudent,
  } = usePortalData();
  const { showToast } = useToast();
  const [initializing, setInitializing] = useState(false);

  const role = effectiveRole || 'student';

  const handleInitBaseline = async () => {
    if (!userProfile) return;
    setInitializing(true);
    try {
      await initializeSchoolBaseline({
        uid: userProfile.uid,
        name: userProfile.displayName,
        role: userProfile.role,
      });
      showToast(
        'success',
        'Struktur Awal Portal Berhasil Dibuat',
        'Tahun ajaran, semester aktif, kelas dasar, mata pelajaran, dan pengaturan sekolah telah disimpan ke Firestore.'
      );
    } catch (err) {
      showToast('error', 'Gagal Inisialisasi', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setInitializing(false);
    }
  };

  // Shared attendance percentage
  const attendanceRate = useMemo(() => {
    if (attendance.length === 0) return '0%';
    const present = attendance.filter((a) => a.status === 'Hadir').length;
    return `${Math.round((present / attendance.length) * 100)}%`;
  }, [attendance]);

  // 1. Students per class chart
  const studentsPerClassData = useMemo(() => {
    return classes.map((c) => ({
      name: c.name,
      jumlah: students.filter((s) => s.classId === c.id && s.status === 'active').length,
    }));
  }, [classes, students]);

  // 2. Attendance status breakdown
  const attendanceBreakdownData = useMemo(() => {
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };
    for (const a of attendance) {
      if (a.status in counts) counts[a.status]++;
    }
    return [
      { name: 'Hadir', value: counts.Hadir, color: '#16A34A' },
      { name: 'Izin', value: counts.Izin, color: '#0284C7' },
      { name: 'Sakit', value: counts.Sakit, color: '#D97706' },
      { name: 'Alpa', value: counts.Alpa, color: '#DC2626' },
    ];
  }, [attendance]);

  // 3. Average grades by subject
  const gradesBySubjectData = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const g of grades) {
      const label = g.subjectName || g.subjectId;
      const cur = map.get(label) || { sum: 0, count: 0 };
      cur.sum += g.finalScore || 0;
      cur.count += 1;
      map.set(label, cur);
    }
    return Array.from(map.entries()).map(([subject, stat]) => ({
      subject,
      rataRata: Math.round((stat.sum / stat.count) * 10) / 10,
    }));
  }, [grades]);

  // 4. Activity frequency by action category
  const activityChartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of activityLogs.slice(0, 60)) {
      const key = l.actionType.split('_')[0] || 'SISTEM';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([aksi, total]) => ({ aksi, total }));
  }, [activityLogs]);

  // ADMIN DASHBOARD
  if (role === 'admin') {
    const activeStudentsCount = students.filter((s) => s.status === 'active').length;
    const activeAccountsCount = users.filter((u) => u.isActive).length;

    return (
      <div className="space-y-6">
        {classes.length === 0 && subjects.length === 0 && (
          <div className="bg-white dark:bg-[#0F1E33] border border-sky-200 dark:border-sky-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                Inisialisasi Struktur Dasar Sekolah di Cloud Firestore
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
                Database portal masih kosong. Klik tombol di samping untuk membuat Tahun Ajaran aktif (2026/2027), Semester Ganjil, kelas awal, mata pelajaran inti, dan profil sekolah default agar siap digunakan.
              </p>
            </div>
            <button
              type="button"
              disabled={initializing}
              onClick={handleInitBaseline}
              className="px-4 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {initializing ? 'Menyiapkan...' : 'Buat Struktur Dasar Sekolah'}
            </button>
          </div>
        )}

        {/* 8 Real-time KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Siswa"
            value={students.length}
            sub={`${activeStudentsCount} siswa berstatus aktif`}
            icon={GraduationCap}
          />
          <StatCard
            label="Total Guru"
            value={teachers.length}
            sub={`${teachers.filter((t) => t.employmentStatus !== 'inactive').length} guru aktif`}
            icon={Users}
          />
          <StatCard
            label="Total Kelas"
            value={classes.length}
            sub={activeAcademicYear ? `TA ${activeAcademicYear.name}` : 'Semua tingkat'}
            icon={Layers}
          />
          <StatCard
            label="Total Mata Pelajaran"
            value={subjects.length}
            sub={activeSemester ? `Semester ${activeSemester.name}` : 'Kurikulum aktif'}
            icon={BookOpen}
          />
          <StatCard
            label="Jumlah Siswa Aktif"
            value={activeStudentsCount}
            sub="Terdaftar aktif belajar"
            icon={UserCheck}
          />
          <StatCard
            label="Jumlah Akun Aktif"
            value={activeAccountsCount}
            sub="Admin, Guru & Siswa terverifikasi"
            icon={CheckCircle2}
          />
          <StatCard
            label="Persentase Kehadiran"
            value={attendanceRate}
            sub={`Dari ${attendance.length} catatan presensi`}
            icon={CalendarCheckBadge}
          />
          <StatCard
            label="Aktivitas Terbaru"
            value={activityLogs.length}
            sub="Log audit sistem tercatat"
            icon={Activity}
          />
        </div>

        {/* 4 Interactive Visualizations */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Jumlah Siswa per Kelas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Distribusi siswa aktif pada masing-masing rombongan belajar
            </p>
            <div className="h-64">
              {studentsPerClassData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Belum ada data kelas dan siswa.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={studentsPerClassData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="jumlah" name="Siswa" fill="#0284C7" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Komposisi Kehadiran Siswa
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Rekap status Hadir, Izin, Sakit, dan Alpa
            </p>
            <div className="h-64">
              {attendance.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Belum ada catatan absensi.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceBreakdownData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={3}
                    >
                      {attendanceBreakdownData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Perkembangan Rata-Rata Nilai per Mata Pelajaran
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Kalkulasi otomatis nilai akhir berbobot (skala 0–100)
            </p>
            <div className="h-64">
              {gradesBySubjectData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Belum ada nilai yang diinput guru.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gradesBySubjectData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="rataRata"
                      name="Rata-Rata"
                      stroke="#06B6D4"
                      fill="#06B6D4"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Grafik Aktivitas Pengguna
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Ringkasan kategori aktivitas sistem terbaru
            </p>
            <div className="h-64">
              {activityChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Belum ada log aktivitas tercatat.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="aksi" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="total" name="Jumlah Aksi" fill="#0F294A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activities & Announcements */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Aktivitas Pengguna Terbaru
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('logs')}
                className="text-xs font-semibold text-sky-700 dark:text-cyan-400 hover:underline"
              >
                Lihat Semua →
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {activityLogs.length === 0 ? (
                <p className="py-6 text-xs text-slate-500 text-center">Belum ada aktivitas.</p>
              ) : (
                activityLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {log.actionType} · {log.targetObject}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {log.userName} ({log.userRole})
                      </p>
                    </div>
                    <span className="text-[11px] font-mono-tabular text-slate-400 shrink-0">
                      {log.createdAt?.toDate
                        ? log.createdAt.toDate().toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Pengumuman Terakhir
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('announcements')}
                className="text-xs font-semibold text-sky-700 dark:text-cyan-400 hover:underline"
              >
                Kelola →
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {announcements.length === 0 ? (
                <p className="py-6 text-xs text-slate-500 text-center">Belum ada pengumuman.</p>
              ) : (
                announcements.slice(0, 5).map((ann) => (
                  <div key={ann.id} className="py-3">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {ann.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {ann.publishDate} · Target: {ann.targetRole}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // TEACHER DASHBOARD
  if (role === 'teacher') {
    const teacherClasses = currentTeacher
      ? classes.filter((c) => (currentTeacher.classIds || []).includes(c.id))
      : classes;
    const teacherSchedules = currentTeacher
      ? schedules.filter((s) => s.teacherId === currentTeacher.id)
      : schedules;

    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-sky-700 dark:text-cyan-400">
              Dashboard Guru Pengajar
            </p>
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white mt-0.5">
              {currentTeacher?.fullName || userProfile?.displayName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Kode Guru: {currentTeacher?.teacherCode || '-'} · Mata Pelajaran:{' '}
              {(currentTeacher?.subjectNames || []).join(', ') || 'Sesuai Penugasan'}
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('attendance')}
              className="px-4 py-2 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold"
            >
              Input Absensi
            </button>
            <button
              type="button"
              onClick={() => onNavigate('grades')}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Input Nilai
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Kelas Diampu" value={teacherClasses.length} icon={Layers} />
          <StatCard label="Siswa Diampu" value={students.length} icon={GraduationCap} />
          <StatCard label="Sesi Jadwal" value={teacherSchedules.length} icon={Calendar} />
          <StatCard label="Tingkat Kehadiran" value={attendanceRate} icon={TrendingUp} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Rata-Rata Nilai Kelas yang Diampu
            </h3>
            <div className="h-64">
              {gradesBySubjectData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Belum ada nilai yang diinput.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradesBySubjectData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                    <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="rataRata" name="Rata-Rata" fill="#0284C7" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Jadwal Mengajar Anda
            </h3>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {teacherSchedules.length === 0 ? (
                <p className="py-8 text-xs text-slate-500 text-center">
                  Belum ada jadwal mengajar yang ditetapkan Admin.
                </p>
              ) : (
                teacherSchedules.slice(0, 6).map((sch) => (
                  <div key={sch.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {sch.subjectName} · {sch.className}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Ruang {sch.room || '-'}
                      </p>
                    </div>
                    <span className="text-xs font-mono-tabular text-sky-700 dark:text-cyan-400">
                      {sch.dayOfWeek}, {sch.startTime}–{sch.endTime}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STUDENT DASHBOARD
  const myGrades = currentStudent
    ? grades.filter((g) => g.studentId === currentStudent.id)
    : grades;
  const avgGrade =
    myGrades.length > 0
      ? (myGrades.reduce((acc, g) => acc + g.finalScore, 0) / myGrades.length).toFixed(1)
      : '0';
  const mySchedules = currentStudent
    ? schedules.filter((s) => s.classId === currentStudent.classId)
    : schedules;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-sky-700 dark:text-cyan-400">
            Dashboard Akademik Siswa
          </p>
          <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white mt-0.5">
            {currentStudent?.fullName || userProfile?.displayName}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            NIS: {currentStudent?.nis || '-'} · Kelas: {currentStudent?.className || '-'} ·{' '}
            {activeSemester ? `Semester ${activeSemester.name}` : schoolSettings.schoolName}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('grades')}
            className="px-4 py-2 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold"
          >
            Lihat Nilai & Rapor
          </button>
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Riwayat Absensi
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Rata-Rata Nilai" value={avgGrade} sub="Skala 0–100" icon={Award} />
        <StatCard label="Kehadiran Saya" value={attendanceRate} sub={`${attendance.length} pertemuan`} icon={UserCheck} />
        <StatCard label="Mata Pelajaran Dinilai" value={myGrades.length} icon={BookOpen} />
        <StatCard label="Pengumuman Sekolah" value={announcements.length} icon={Megaphone} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Capaian Nilai per Mata Pelajaran
          </h3>
          <div className="h-64">
            {myGrades.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada nilai yang dipublikasikan.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={myGrades.map((g) => ({
                    mapel: g.subjectName || g.subjectId,
                    nilai: g.finalScore,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="mapel" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="nilai" name="Nilai Akhir" fill="#06B6D4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Jadwal Pelajaran Kelas
          </h3>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {mySchedules.length === 0 ? (
              <p className="py-8 text-xs text-slate-500 text-center">
                Belum ada jadwal pelajaran untuk kelas Anda.
              </p>
            ) : (
              mySchedules.slice(0, 6).map((sch) => (
                <div key={sch.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {sch.subjectName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {sch.teacherName} · Ruang {sch.room || '-'}
                    </p>
                  </div>
                  <span className="text-xs font-mono-tabular text-sky-700 dark:text-cyan-400">
                    {sch.dayOfWeek}, {sch.startTime}–{sch.endTime}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarCheckBadge(props: { className?: string }) {
  return <CheckCircle2 {...props} />;
}
