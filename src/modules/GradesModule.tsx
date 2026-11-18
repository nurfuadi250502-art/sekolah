import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  History,
  Save,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortalData } from '../contexts/PortalDataContext';
import { useToast } from '../components/ui/ToastProvider';
import { EmptyState, ModalShell } from '../components/ui/DataTableControls';
import {
  computeFinalScore,
  getGradeDocId,
  saveGradeEntry,
  saveSchoolSettings,
} from '../services/firestoreService';
import { exportGradesPdf, exportToExcel } from '../services/exportService';
import { GradeRecord, GradeWeights } from '../types/portal';

interface DraftScore {
  tugas: number;
  kuis: number;
  ulanganHarian: number;
  pts: number;
  pas: number;
  praktik: number;
}

export function GradesModule() {
  const { userProfile, effectiveRole, schoolSettings } = useAuth();
  const {
    students,
    classes,
    subjects,
    teachers,
    grades,
    activeAcademicYear,
    activeSemester,
    currentTeacher,
    currentStudent,
  } = usePortalData();
  const { showToast } = useToast();

  const role = effectiveRole || 'student';
  const canEdit = role === 'admin' || role === 'teacher';
  const isAdmin = role === 'admin';

  const [tab, setTab] = useState<'input' | 'recap' | 'weights'>(canEdit ? 'input' : 'recap');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [draftScores, setDraftScores] = useState<Record<string, DraftScore>>({});
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [historyGrade, setHistoryGrade] = useState<GradeRecord | null>(null);

  // Admin weight configuration
  const [weights, setWeights] = useState<GradeWeights>(schoolSettings.gradeWeights);
  const [minScore, setMinScore] = useState(schoolSettings.minScore ?? 0);
  const [maxScore, setMaxScore] = useState(schoolSettings.maxScore ?? 100);

  useEffect(() => {
    setWeights(schoolSettings.gradeWeights);
    setMinScore(schoolSettings.minScore ?? 0);
    setMaxScore(schoolSettings.maxScore ?? 100);
  }, [schoolSettings]);

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

  const semesterId = activeSemester?.id || 'sem_default';

  useEffect(() => {
    const next: Record<string, DraftScore> = {};
    for (const s of classStudents) {
      const id = getGradeDocId(semesterId, selectedClassId, selectedSubjectId, s.id);
      const existing = grades.find((g) => g.id === id);
      next[s.id] = {
        tugas: existing?.tugas ?? 0,
        kuis: existing?.kuis ?? 0,
        ulanganHarian: existing?.ulanganHarian ?? 0,
        pts: existing?.pts ?? 0,
        pas: existing?.pas ?? 0,
        praktik: existing?.praktik ?? 0,
      };
    }
    setDraftScores(next);
  }, [classStudents, grades, semesterId, selectedClassId, selectedSubjectId]);

  const handleSaveStudentGrade = async (studentId: string) => {
    if (!userProfile) return;
    const student = classStudents.find((s) => s.id === studentId);
    const scores = draftScores[studentId];
    if (!student || !scores) return;

    const cls = classes.find((c) => c.id === selectedClassId);
    const sub = subjects.find((s) => s.id === selectedSubjectId);
    const teacherObj = currentTeacher || teachers[0];
    const gradeId = getGradeDocId(semesterId, selectedClassId, selectedSubjectId, student.id);
    const existingGrade = grades.find((g) => g.id === gradeId);

    setSavingStudentId(studentId);
    try {
      await saveGradeEntry(
        {
          student,
          classId: selectedClassId,
          className: cls?.name || selectedClassId,
          subjectId: selectedSubjectId,
          subjectName: sub?.name || selectedSubjectId,
          teacherId: teacherObj?.id || userProfile.linkedEntityId || userProfile.uid,
          teacherUserId: teacherObj?.userId || userProfile.uid,
          teacherName: teacherObj?.fullName || userProfile.displayName,
          semesterId,
          academicYearId: activeAcademicYear?.id || 'ay_default',
          scores,
          weights: schoolSettings.gradeWeights,
          minScore: schoolSettings.minScore ?? 0,
          maxScore: schoolSettings.maxScore ?? 100,
          existingGrade,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast('success', 'Nilai Tersimpan', `Nilai ${student.fullName} berhasil diperbarui.`);
    } catch (err) {
      showToast('error', 'Validasi / Simpan Gagal', err instanceof Error ? err.message : '');
    } finally {
      setSavingStudentId(null);
    }
  };

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const total =
      weights.tugas +
      weights.kuis +
      weights.ulanganHarian +
      weights.pts +
      weights.pas +
      weights.praktik;
    if (total !== 100) {
      showToast('error', 'Total Bobot Harus 100%', `Saat ini total bobot adalah ${total}%.`);
      return;
    }
    try {
      await saveSchoolSettings(
        {
          ...schoolSettings,
          gradeWeights: weights,
          minScore,
          maxScore,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast('success', 'Bobot Penilaian Disimpan');
    } catch (err) {
      showToast('error', 'Gagal Menyimpan Bobot', err instanceof Error ? err.message : '');
    }
  };

  const visibleGrades = useMemo(() => {
    if (role === 'student' && currentStudent) {
      return grades.filter((g) => g.studentId === currentStudent.id);
    }
    return grades;
  }, [grades, role, currentStudent]);

  const canDownloadReport =
    role !== 'student' || schoolSettings.allowStudentReportDownload;

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setTab('input')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'input'
                ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Input & Edit Nilai
          </button>
          <button
            type="button"
            onClick={() => setTab('recap')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'recap'
                ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Rekap Nilai & Rapor
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setTab('weights')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                tab === 'weights'
                  ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Pengaturan Bobot Nilai
            </button>
          )}
        </div>
      )}

      {/* INPUT GRADE VIEW */}
      {canEdit && tab === 'input' && (
        <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Kelas</label>
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
              <label className="block text-xs font-medium mb-1">Mata Pelajaran</label>
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
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rentang nilai aktif: {schoolSettings.minScore}–{schoolSettings.maxScore} · Bobot otomatis: Tugas {schoolSettings.gradeWeights.tugas}%, Kuis {schoolSettings.gradeWeights.kuis}%, UH {schoolSettings.gradeWeights.ulanganHarian}%, PTS {schoolSettings.gradeWeights.pts}%, PAS {schoolSettings.gradeWeights.pas}%, Praktik {schoolSettings.gradeWeights.praktik}%.
          </p>

          {classStudents.length === 0 ? (
            <EmptyState
              title="Belum ada siswa aktif pada kelas ini"
              description="Pilih kelas yang memiliki peserta didik aktif untuk memulai penilaian."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-2">Siswa</th>
                    <th className="py-2.5 px-2">Tugas</th>
                    <th className="py-2.5 px-2">Kuis</th>
                    <th className="py-2.5 px-2">UH</th>
                    <th className="py-2.5 px-2">PTS</th>
                    <th className="py-2.5 px-2">PAS</th>
                    <th className="py-2.5 px-2">Praktik</th>
                    <th className="py-2.5 px-2">Akhir</th>
                    <th className="py-2.5 px-2 text-right">Simpan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {classStudents.map((stu) => {
                    const sc = draftScores[stu.id] || {
                      tugas: 0,
                      kuis: 0,
                      ulanganHarian: 0,
                      pts: 0,
                      pas: 0,
                      praktik: 0,
                    };
                    const preview = computeFinalScore(sc, schoolSettings.gradeWeights);

                    return (
                      <tr key={stu.id}>
                        <td className="py-2.5 px-2 min-w-[150px]">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {stu.fullName}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono-tabular">{stu.nis}</p>
                        </td>
                        {(['tugas', 'kuis', 'ulanganHarian', 'pts', 'pas', 'praktik'] as const).map(
                          (field) => (
                            <td key={field} className="py-2.5 px-1.5">
                              <input
                                type="number"
                                min={schoolSettings.minScore}
                                max={schoolSettings.maxScore}
                                value={sc[field]}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setDraftScores((prev) => ({
                                    ...prev,
                                    [stu.id]: { ...sc, [field]: val },
                                  }));
                                }}
                                className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular text-center"
                              />
                            </td>
                          )
                        )}
                        <td className="py-2.5 px-2 font-mono-tabular font-bold text-sky-700 dark:text-cyan-400">
                          {preview.finalScore} ({preview.letterGrade})
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            type="button"
                            disabled={savingStudentId === stu.id}
                            onClick={() => void handleSaveStudentGrade(stu.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white font-semibold disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {savingStudentId === stu.id ? '...' : 'Simpan'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RECAP VIEW (ALL ROLES) */}
      {(tab === 'recap' || !canEdit) && (
        <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">
                {role === 'student' ? 'Rekap Hasil Belajar Saya' : 'Rekapitulasi Nilai Akademik'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeSemester ? `Semester ${activeSemester.name}` : ''} ·{' '}
                {activeAcademicYear ? `TA ${activeAcademicYear.name}` : ''}
              </p>
            </div>
            {canDownloadReport && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportToExcel(
                      `Rekap_Nilai_${new Date().toISOString().slice(0, 10)}`,
                      'Nilai',
                      visibleGrades.map((g) => ({
                        NIS: g.studentNis || '',
                        'Nama Siswa': g.studentName || '',
                        Kelas: g.className || '',
                        'Mata Pelajaran': g.subjectName || '',
                        Tugas: g.tugas,
                        Kuis: g.kuis,
                        UH: g.ulanganHarian,
                        PTS: g.pts,
                        PAS: g.pas,
                        Praktik: g.praktik,
                        'Nilai Akhir': g.finalScore,
                        Predikat: g.letterGrade,
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
                    exportGradesPdf(
                      visibleGrades,
                      `Rekap Nilai Akademik · Total ${visibleGrades.length} entri`,
                      schoolSettings
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh Laporan PDF
                </button>
              </div>
            )}
          </div>

          {visibleGrades.length === 0 ? (
            <EmptyState
              title="Belum ada nilai tercatat"
              description="Nilai akan muncul setelah guru melakukan input dan penyimpanan penilaian."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-2">Siswa</th>
                    <th className="py-2.5 px-2">Kelas</th>
                    <th className="py-2.5 px-2">Mata Pelajaran</th>
                    <th className="py-2.5 px-2 text-right">Tugas</th>
                    <th className="py-2.5 px-2 text-right">Kuis</th>
                    <th className="py-2.5 px-2 text-right">UH</th>
                    <th className="py-2.5 px-2 text-right">PTS</th>
                    <th className="py-2.5 px-2 text-right">PAS</th>
                    <th className="py-2.5 px-2 text-right">Praktik</th>
                    <th className="py-2.5 px-2 text-right">Nilai Akhir</th>
                    <th className="py-2.5 px-2 text-center">Predikat</th>
                    {canEdit && <th className="py-2.5 px-2 text-right">Riwayat</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {visibleGrades.map((g) => (
                    <tr key={g.id}>
                      <td className="py-3 px-2 font-semibold">{g.studentName}</td>
                      <td className="py-3 px-2">{g.className}</td>
                      <td className="py-3 px-2">{g.subjectName}</td>
                      <td className="py-3 px-2 text-right font-mono-tabular">{g.tugas}</td>
                      <td className="py-3 px-2 text-right font-mono-tabular">{g.kuis}</td>
                      <td className="py-3 px-2 text-right font-mono-tabular">{g.ulanganHarian}</td>
                      <td className="py-3 px-2 text-right font-mono-tabular">{g.pts}</td>
                      <td className="py-3 px-2 text-right font-mono-tabular">{g.pas}</td>
                      <td className="py-3 px-2 text-right font-mono-tabular">{g.praktik}</td>
                      <td className="py-3 px-2 text-right font-mono-tabular font-bold text-sky-700 dark:text-cyan-400">
                        {g.finalScore}
                      </td>
                      <td className="py-3 px-2 text-center font-bold">{g.letterGrade}</td>
                      {canEdit && (
                        <td className="py-3 px-2 text-right">
                          {(g.history || []).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setHistoryGrade(g)}
                              className="inline-flex items-center gap-1 text-sky-700 dark:text-cyan-400 hover:underline"
                            >
                              <History className="w-3.5 h-3.5" />
                              {g.history?.length}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ADMIN WEIGHTS CONFIG */}
      {isAdmin && tab === 'weights' && (
        <form
          onSubmit={handleSaveWeights}
          className="max-w-xl bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-bold">Konfigurasi Bobot & Rentang Penilaian</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {(
              [
                { key: 'tugas', label: 'Tugas (%)' },
                { key: 'kuis', label: 'Kuis (%)' },
                { key: 'ulanganHarian', label: 'Ulangan Harian (%)' },
                { key: 'pts', label: 'PTS (%)' },
                { key: 'pas', label: 'PAS (%)' },
                { key: 'praktik', label: 'Praktik/Proyek (%)' },
              ] as const
            ).map((item) => (
              <div key={item.key}>
                <label className="block font-medium mb-1">{item.label}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={weights[item.key]}
                  onChange={(e) => setWeights({ ...weights, [item.key]: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs pt-2">
            <div>
              <label className="block font-medium mb-1">Nilai Minimum</label>
              <input
                type="number"
                min={0}
                max={99}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Nilai Maksimum</label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white text-xs font-semibold"
          >
            Simpan Pengaturan Bobot
          </button>
        </form>
      )}

      <ModalShell
        open={Boolean(historyGrade)}
        onClose={() => setHistoryGrade(null)}
        title="Riwayat Perubahan Nilai"
        subtitle={historyGrade ? `${historyGrade.studentName} · ${historyGrade.subjectName}` : ''}
      >
        {historyGrade && (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {(historyGrade.history || []).map((h, i) => (
              <div key={i} className="py-3">
                <p className="font-semibold font-mono-tabular">
                  Nilai Akhir: {h.previousFinal} → {h.newFinal}
                </p>
                <p className="text-slate-500 mt-0.5">
                  Oleh {h.changedByName} · {new Date(h.changedAt).toLocaleString('id-ID')}
                </p>
              </div>
            ))}
          </div>
        )}
      </ModalShell>
    </div>
  );
}
