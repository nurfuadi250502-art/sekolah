import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Save,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortalData } from '../contexts/PortalDataContext';
import { useToast } from '../components/ui/ToastProvider';
import { EmptyState, ModalShell } from '../components/ui/DataTableControls';
import {
  getAttendanceDocId,
  saveBatchAttendance,
} from '../services/firestoreService';
import { exportAttendancePdf, exportToExcel } from '../services/exportService';
import { AttendanceRecord, AttendanceStatus } from '../types/portal';

type RecapRange = 'daily' | 'weekly' | 'monthly' | 'semester';

export function AttendanceModule() {
  const { userProfile, effectiveRole, schoolSettings } = useAuth();
  const {
    students,
    classes,
    subjects,
    teachers,
    attendance,
    activeSemester,
    currentTeacher,
    currentStudent,
  } = usePortalData();
  const { showToast } = useToast();

  const role = effectiveRole || 'student';
  const canEdit = role === 'admin' || role === 'teacher';

  const [modeTab, setModeTab] = useState<'input' | 'recap'>(canEdit ? 'input' : 'recap');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [draftMap, setDraftMap] = useState<
    Record<string, { status: AttendanceStatus; notes: string }>
  >({});
  const [saving, setSaving] = useState(false);

  // Recap states
  const [recapRange, setRecapRange] = useState<RecapRange>('monthly');
  const [recapClassId, setRecapClassId] = useState('all');
  const [historyItem, setHistoryItem] = useState<AttendanceRecord | null>(null);

  const availableClasses = useMemo(() => {
    if (role === 'teacher' && currentTeacher) {
      return classes.filter((c) => (currentTeacher.classIds || []).includes(c.id));
    }
    return classes;
  }, [classes, role, currentTeacher]);

  const availableSubjects = useMemo(() => {
    if (role === 'teacher' && currentTeacher) {
      return subjects.filter((s) => (currentTeacher.subjectIds || []).includes(s.id));
    }
    return subjects;
  }, [subjects, role, currentTeacher]);

  useEffect(() => {
    if (!selectedClassId && availableClasses.length > 0) {
      setSelectedClassId(availableClasses[0].id);
    }
  }, [availableClasses, selectedClassId]);

  useEffect(() => {
    if (!selectedSubjectId && availableSubjects.length > 0) {
      setSelectedSubjectId(availableSubjects[0].id);
    }
  }, [availableSubjects, selectedSubjectId]);

  const classStudents = useMemo(
    () =>
      students
        .filter((s) => s.classId === selectedClassId && s.status === 'active')
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [students, selectedClassId]
  );

  // Sync draftMap whenever class/subject/date/attendance changes
  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId || !selectedDate) return;
    const next: Record<string, { status: AttendanceStatus; notes: string }> = {};
    for (const s of classStudents) {
      const docId = getAttendanceDocId(selectedDate, selectedClassId, selectedSubjectId, s.id);
      const existing = attendance.find((a) => a.id === docId);
      next[s.id] = {
        status: existing?.status || 'Hadir',
        notes: existing?.notes || '',
      };
    }
    setDraftMap(next);
  }, [classStudents, attendance, selectedDate, selectedClassId, selectedSubjectId]);

  const handleSaveSession = async () => {
    if (!userProfile || !selectedClassId || !selectedSubjectId) return;
    if (classStudents.length === 0) {
      showToast('error', 'Kelas kosong', 'Tidak ada siswa aktif di kelas ini.');
      return;
    }

    const cls = classes.find((c) => c.id === selectedClassId);
    const sub = subjects.find((s) => s.id === selectedSubjectId);
    const teacherObj = currentTeacher || teachers[0];
    const teacherId = teacherObj?.id || userProfile.linkedEntityId || userProfile.uid;
    const teacherName = teacherObj?.fullName || userProfile.displayName;

    setSaving(true);
    try {
      const entries = classStudents.map((student) => {
        const docId = getAttendanceDocId(selectedDate, selectedClassId, selectedSubjectId, student.id);
        const existingRecord = attendance.find((a) => a.id === docId);
        const draft = draftMap[student.id] || { status: 'Hadir' as AttendanceStatus, notes: '' };
        return {
          student,
          status: draft.status,
          notes: draft.notes,
          existingRecord,
        };
      });

      await saveBatchAttendance(
        entries,
        {
          date: selectedDate,
          classId: selectedClassId,
          className: cls?.name || selectedClassId,
          subjectId: selectedSubjectId,
          subjectName: sub?.name || selectedSubjectId,
          teacherId,
          teacherUserId: teacherObj?.userId || userProfile.uid,
          teacherName,
          semesterId: activeSemester?.id || 'sem_default',
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast(
        'success',
        'Absensi Tersimpan',
        `Presensi ${cls?.name} · ${sub?.name} (${selectedDate}) berhasil disimpan tanpa duplikasi.`
      );
    } catch (err) {
      showToast('error', 'Gagal Menyimpan Absensi', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  // Filtered recap records
  const recapRecords = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const monthPrefix = todayStr.slice(0, 7);

    return attendance
      .filter((a) => {
        if (role === 'student' && currentStudent && a.studentId !== currentStudent.id) {
          return false;
        }
        if (recapClassId !== 'all' && a.classId !== recapClassId) return false;
        if (recapRange === 'daily' && a.date !== todayStr) return false;
        if (recapRange === 'weekly' && a.date < weekAgo) return false;
        if (recapRange === 'monthly' && !a.date.startsWith(monthPrefix)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, role, currentStudent, recapClassId, recapRange]);

  const summaryStats = useMemo(() => {
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 };
    for (const r of recapRecords) {
      if (r.status in counts) counts[r.status]++;
    }
    return counts;
  }, [recapRecords]);

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setModeTab('input')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              modeTab === 'input'
                ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Input / Edit Absensi
          </button>
          <button
            type="button"
            onClick={() => setModeTab('recap')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              modeTab === 'recap'
                ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Rekap & Laporan Absensi
          </button>
        </div>
      )}

      {/* INPUT ATTENDANCE VIEW */}
      {canEdit && modeTab === 'input' && (
        <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Pilih Kelas</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Pilih Mata Pelajaran</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                {availableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tanggal Pertemuan</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
          </div>

          {classStudents.length === 0 ? (
            <EmptyState
              title="Tidak ada siswa di kelas terpilih"
              description="Pastikan kelas telah memiliki siswa aktif atau pilih kelas yang Anda ampu."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <th className="py-2.5 px-3">NIS</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">Status Kehadiran</th>
                      <th className="py-2.5 px-3">Catatan</th>
                      <th className="py-2.5 px-3 text-right">Status Sesi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {classStudents.map((stu) => {
                      const docId = getAttendanceDocId(
                        selectedDate,
                        selectedClassId,
                        selectedSubjectId,
                        stu.id
                      );
                      const existing = attendance.find((a) => a.id === docId);
                      const draft = draftMap[stu.id] || { status: 'Hadir' as AttendanceStatus, notes: '' };
                      return (
                        <tr key={stu.id}>
                          <td className="py-3 px-3 font-mono-tabular text-xs">{stu.nis}</td>
                          <td className="py-3 px-3 font-semibold">{stu.fullName}</td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1.5">
                              {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() =>
                                    setDraftMap((prev) => ({
                                      ...prev,
                                      [stu.id]: { ...draft, status: st },
                                    }))
                                  }
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                                    draft.status === st
                                      ? st === 'Hadir'
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : st === 'Izin'
                                          ? 'bg-sky-600 text-white border-sky-600'
                                          : st === 'Sakit'
                                            ? 'bg-amber-600 text-white border-amber-600'
                                            : 'bg-rose-600 text-white border-rose-600'
                                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              value={draft.notes}
                              onChange={(e) =>
                                setDraftMap((prev) => ({
                                  ...prev,
                                  [stu.id]: { ...draft, notes: e.target.value },
                                }))
                              }
                              placeholder="Opsional..."
                              className="w-full min-w-[140px] px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                            />
                          </td>
                          <td className="py-3 px-3 text-right text-xs">
                            {existing ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Tercatat
                              </span>
                            ) : (
                              <span className="text-slate-400">Belum dicatat</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveSession}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Menyimpan Presensi...' : 'Simpan Absensi Pertemuan'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* RECAP VIEW (ALL ROLES) */}
      {(modeTab === 'recap' || !canEdit) && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as AttendanceStatus[]).map((st) => (
              <div
                key={st}
                className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-4"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">{st}</p>
                <p className="text-2xl font-bold font-display mt-1 tabular-nums">
                  {summaryStats[st]}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {(
                    [
                      { id: 'daily', label: 'Harian' },
                      { id: 'weekly', label: 'Mingguan' },
                      { id: 'monthly', label: 'Bulanan' },
                      { id: 'semester', label: 'Semester' },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRecapRange(r.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                        recapRange === r.id
                          ? 'bg-white dark:bg-[#0F294A] text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {canEdit && (
                  <select
                    value={recapClassId}
                    onChange={(e) => setRecapClassId(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                  >
                    <option value="all">Semua Kelas</option>
                    {availableClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportToExcel(
                      `Rekap_Absensi_${recapRange}`,
                      'Absensi',
                      recapRecords.map((r) => ({
                        Tanggal: r.date,
                        NIS: r.studentNis || '',
                        'Nama Siswa': r.studentName || '',
                        Kelas: r.className || '',
                        'Mata Pelajaran': r.subjectName || '',
                        Status: r.status,
                        Guru: r.teacherName || '',
                        Catatan: r.notes || '',
                      }))
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportAttendancePdf(
                      recapRecords,
                      `Periode: ${recapRange.toUpperCase()} · Total ${recapRecords.length} catatan`,
                      schoolSettings
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            </div>

            {recapRecords.length === 0 ? (
              <EmptyState
                title="Belum ada data absensi pada periode ini"
                description="Pilih rentang waktu lain (misal Semester) atau catat presensi siswa terlebih dahulu."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Siswa</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3">Mata Pelajaran</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Catatan</th>
                      <th className="py-2.5 px-3 text-right">Riwayat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {recapRecords.slice(0, 100).map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 px-3 font-mono-tabular text-xs">{r.date}</td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-xs">{r.studentName}</p>
                          <p className="text-[11px] text-slate-500 font-mono-tabular">{r.studentNis}</p>
                        </td>
                        <td className="py-3 px-3 text-xs">{r.className}</td>
                        <td className="py-3 px-3 text-xs">{r.subjectName}</td>
                        <td className="py-3 px-3 text-xs font-bold">
                          <span
                            className={
                              r.status === 'Hadir'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : r.status === 'Izin'
                                  ? 'text-sky-600 dark:text-cyan-400'
                                  : r.status === 'Sakit'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500">{r.notes || '-'}</td>
                        <td className="py-3 px-3 text-right">
                          {(r.history || []).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setHistoryItem(r)}
                              className="inline-flex items-center gap-1 text-xs text-sky-700 dark:text-cyan-400 hover:underline"
                            >
                              <History className="w-3.5 h-3.5" />
                              {r.history?.length} ubah
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ModalShell
        open={Boolean(historyItem)}
        onClose={() => setHistoryItem(null)}
        title="Riwayat Perubahan Absensi"
        subtitle={historyItem ? `${historyItem.studentName} · ${historyItem.date}` : ''}
      >
        {historyItem && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {(historyItem.history || []).map((h, i) => (
              <div key={i} className="py-3">
                <p className="font-semibold">
                  {h.previousStatus} → {h.newStatus}
                </p>
                <p className="text-slate-500 mt-0.5">
                  Oleh {h.changedByName} · {new Date(h.changedAt).toLocaleString('id-ID')}
                </p>
                {h.notes && <p className="text-slate-600 dark:text-slate-300 mt-1">{h.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </ModalShell>
    </div>
  );
}
