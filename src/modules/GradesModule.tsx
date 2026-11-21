import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  FileSpreadsheet,
  History,
  ListChecks,
  Plus,
  Save,
  Sliders,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePortalData } from '../contexts/PortalDataContext';
import { useToast } from '../components/ui/ToastProvider';
import { EmptyState, ModalShell } from '../components/ui/DataTableControls';
import {
  computeFinalScore,
  computeWrittenExamScore,
  getGradeDocId,
  saveGradeEntry,
  saveSchoolSettings,
  saveSubjectGradingConfig,
} from '../services/firestoreService';
import { exportGradesPdf, exportToExcel } from '../services/exportService';
import {
  DEFAULT_GRADE_BANDS,
  getGradeComponentScores,
  GradeRangeBands,
  GradeRecord,
  GradeWeights,
  normalizeGradeWeights,
  RangeCalculationMode,
  SubjectGradingConfig,
  WrittenExamBab,
} from '../types/portal';

interface DraftScore {
  ujianLisan: number;
  ujianTulis: number;
}

interface SubjectConfigDraft {
  ujianLisanWeight: number;
  ujianTulisWeight: number;
  rangeMin: number;
  rangeMax: number;
  rangeMode: RangeCalculationMode;
  kkm: number;
  gradeBands: GradeRangeBands;
  babs: WrittenExamBab[];
}

function makeDefaultBabs(): WrittenExamBab[] {
  return [
    { id: 'bab_1', title: 'BAB 1', questionCount: 5, maxPerQuestion: 10 },
    { id: 'bab_2', title: 'BAB 2', questionCount: 5, maxPerQuestion: 10 },
  ];
}

function buildSubjectConfigDraft(
  existing: SubjectGradingConfig | undefined,
  defaultWeights: GradeWeights,
  defaultMin: number,
  defaultMax: number,
  defaultKkm = 75
): SubjectConfigDraft {
  if (existing) {
    return {
      ujianLisanWeight: existing.ujianLisanWeight,
      ujianTulisWeight: existing.ujianTulisWeight,
      rangeMin: existing.rangeMin,
      rangeMax: existing.rangeMax,
      rangeMode: existing.rangeMode || 'proportional',
      kkm: existing.kkm ?? defaultKkm,
      gradeBands: existing.gradeBands || { ...DEFAULT_GRADE_BANDS },
      babs:
        (existing.babs || []).length > 0
          ? existing.babs.map((b) => ({ ...b }))
          : makeDefaultBabs(),
    };
  }
  return {
    ujianLisanWeight: defaultWeights.ujianLisan,
    ujianTulisWeight: defaultWeights.ujianTulis,
    rangeMin: defaultMin,
    rangeMax: defaultMax,
    rangeMode: 'proportional',
    kkm: defaultKkm,
    gradeBands: { ...DEFAULT_GRADE_BANDS },
    babs: makeDefaultBabs(),
  };
}

export function GradesModule() {
  const { userProfile, effectiveRole, schoolSettings } = useAuth();
  const { t } = useLanguage();
  const {
    students,
    classes,
    subjects,
    subjectGradingConfigs,
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

  const normalizedSchoolWeights = useMemo(
    () => normalizeGradeWeights(schoolSettings.gradeWeights),
    [schoolSettings.gradeWeights]
  );

  const [tab, setTab] = useState<'input' | 'recap' | 'weights'>(canEdit ? 'input' : 'recap');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [draftScores, setDraftScores] = useState<Record<string, DraftScore>>({});
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [historyGrade, setHistoryGrade] = useState<GradeRecord | null>(null);

  // Direct Edit Grade modal (from Rekap Nilai)
  const [editingGrade, setEditingGrade] = useState<GradeRecord | null>(null);
  const [editDraft, setEditDraft] = useState<DraftScore>({
    ujianLisan: 0,
    ujianTulis: 0,
  });
  const [editNote, setEditNote] = useState('');
  const [savingEditModal, setSavingEditModal] = useState(false);

  // Admin global school weight configuration
  const [weights, setWeights] = useState<GradeWeights>(normalizedSchoolWeights);
  const [minScore, setMinScore] = useState(schoolSettings.minScore ?? 0);
  const [maxScore, setMaxScore] = useState(schoolSettings.maxScore ?? 100);

  // Per-subject Range, BABs & Written Score Calculator (Admin & Guru)
  const [configDraft, setConfigDraft] = useState<SubjectConfigDraft>(() =>
    buildSubjectConfigDraft(
      undefined,
      normalizedSchoolWeights,
      schoolSettings.minScore ?? 0,
      schoolSettings.maxScore ?? 100,
      75
    )
  );
  const [savingSubjectConfig, setSavingSubjectConfig] = useState(false);
  const [calcStudentId, setCalcStudentId] = useState('');
  const [calcLisanScore, setCalcLisanScore] = useState(0);
  const [babQuestionScores, setBabQuestionScores] = useState<Record<string, number[]>>({});
  const [savingCalcGrade, setSavingCalcGrade] = useState(false);

  useEffect(() => {
    setWeights(normalizedSchoolWeights);
    setMinScore(schoolSettings.minScore ?? 0);
    setMaxScore(schoolSettings.maxScore ?? 100);
  }, [normalizedSchoolWeights, schoolSettings.minScore, schoolSettings.maxScore]);

  const availableClasses = useMemo(() => {
    if (role === 'teacher' && currentTeacher) {
      const assigned = classes.filter((c) => (currentTeacher.classIds || []).includes(c.id));
      return assigned.length > 0 ? assigned : classes;
    }
    return classes;
  }, [classes, role, currentTeacher]);

  const availableSubjects = useMemo(() => {
    if (role === 'teacher' && currentTeacher) {
      const assigned = subjects.filter((s) => (currentTeacher.subjectIds || []).includes(s.id));
      return assigned.length > 0 ? assigned : subjects;
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

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );

  const savedSubjectConfig = useMemo(
    () => subjectGradingConfigs.find((c) => c.subjectId === selectedSubjectId),
    [subjectGradingConfigs, selectedSubjectId]
  );

  // Sync subject config draft when selected subject or saved Firestore config changes
  useEffect(() => {
    setConfigDraft(
      buildSubjectConfigDraft(
        savedSubjectConfig,
        normalizedSchoolWeights,
        schoolSettings.minScore ?? 0,
        schoolSettings.maxScore ?? 100,
        selectedSubject?.kkm ?? 75
      )
    );
  }, [
    savedSubjectConfig,
    selectedSubject?.kkm,
    normalizedSchoolWeights,
    schoolSettings.minScore,
    schoolSettings.maxScore,
  ]);

  const activeWeights: GradeWeights = useMemo(
    () =>
      savedSubjectConfig
        ? {
            ujianLisan: savedSubjectConfig.ujianLisanWeight,
            ujianTulis: savedSubjectConfig.ujianTulisWeight,
          }
        : normalizedSchoolWeights,
    [savedSubjectConfig, normalizedSchoolWeights]
  );

  const activeRangeMin = savedSubjectConfig?.rangeMin ?? (schoolSettings.minScore ?? 0);
  const activeRangeMax = savedSubjectConfig?.rangeMax ?? (schoolSettings.maxScore ?? 100);
  const activeGradeBands = savedSubjectConfig?.gradeBands;

  const classStudents = useMemo(
    () =>
      students
        .filter((s) => s.classId === selectedClassId && s.status === 'active')
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [students, selectedClassId]
  );

  const semesterId = activeSemester?.id || 'sem_default';

  // Ensure calculator selected student stays valid within current class
  useEffect(() => {
    if (classStudents.length === 0) {
      setCalcStudentId('');
      return;
    }
    if (!calcStudentId || !classStudents.some((s) => s.id === calcStudentId)) {
      setCalcStudentId(classStudents[0].id);
    }
  }, [classStudents, calcStudentId]);

  // Populate draft table scores for Input & Edit Nilai
  useEffect(() => {
    const next: Record<string, DraftScore> = {};
    for (const s of classStudents) {
      const id = getGradeDocId(semesterId, selectedClassId, selectedSubjectId, s.id);
      const existing = grades.find((g) => g.id === id);
      const comp = getGradeComponentScores(existing);
      next[s.id] = {
        ujianLisan: comp.ujianLisan,
        ujianTulis: comp.ujianTulis,
      };
    }
    setDraftScores(next);
  }, [classStudents, grades, semesterId, selectedClassId, selectedSubjectId]);

  // Populate BAB question scores when selected calculator student/class/subject changes
  useEffect(() => {
    if (!calcStudentId || !selectedClassId || !selectedSubjectId) {
      setBabQuestionScores({});
      setCalcLisanScore(0);
      return;
    }
    const gradeId = getGradeDocId(semesterId, selectedClassId, selectedSubjectId, calcStudentId);
    const existing = grades.find((g) => g.id === gradeId);
    const comp = getGradeComponentScores(existing);
    setCalcLisanScore(comp.ujianLisan);

    const nextMap: Record<string, number[]> = {};
    const existingDetails = existing?.writtenDetails || [];
    for (const bab of configDraft.babs) {
      const matched = existingDetails.find((d) => d.babId === bab.id);
      const qCount = Math.max(1, Math.min(100, bab.questionCount || 1));
      const arr = Array.from({ length: qCount }, (_, idx) =>
        matched && typeof matched.questionScores?.[idx] === 'number'
          ? matched.questionScores[idx]
          : 0
      );
      nextMap[bab.id] = arr;
    }
    setBabQuestionScores(nextMap);
  }, [calcStudentId, selectedClassId, selectedSubjectId, semesterId, grades, configDraft.babs]);

  const writtenCalcResult = useMemo(
    () =>
      computeWrittenExamScore(configDraft.babs, babQuestionScores, {
        rangeMin: configDraft.rangeMin,
        rangeMax: configDraft.rangeMax,
        rangeMode: configDraft.rangeMode,
      }),
    [configDraft.babs, babQuestionScores, configDraft.rangeMin, configDraft.rangeMax, configDraft.rangeMode]
  );

  const calcPreviewFinal = useMemo(
    () =>
      computeFinalScore(
        {
          ujianLisan: calcLisanScore,
          ujianTulis: writtenCalcResult.convertedScore,
        },
        {
          ujianLisan: configDraft.ujianLisanWeight,
          ujianTulis: configDraft.ujianTulisWeight,
        },
        configDraft.gradeBands,
        configDraft.rangeMax
      ),
    [
      calcLisanScore,
      writtenCalcResult.convertedScore,
      configDraft.ujianLisanWeight,
      configDraft.ujianTulisWeight,
      configDraft.gradeBands,
      configDraft.rangeMax,
    ]
  );

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
          writtenDetails: existingGrade?.writtenDetails,
          weights: activeWeights,
          gradeBands: activeGradeBands,
          minScore: activeRangeMin,
          maxScore: activeRangeMax,
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

  const handleSaveAllGrades = async () => {
    if (!userProfile || classStudents.length === 0) return;
    const cls = classes.find((c) => c.id === selectedClassId);
    const sub = subjects.find((s) => s.id === selectedSubjectId);
    const teacherObj = currentTeacher || teachers[0];

    setSavingAll(true);
    try {
      for (const student of classStudents) {
        const scores = draftScores[student.id];
        if (!scores) continue;
        const gradeId = getGradeDocId(semesterId, selectedClassId, selectedSubjectId, student.id);
        const existingGrade = grades.find((g) => g.id === gradeId);

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
            writtenDetails: existingGrade?.writtenDetails,
            weights: activeWeights,
            gradeBands: activeGradeBands,
            minScore: activeRangeMin,
            maxScore: activeRangeMax,
            existingGrade,
          },
          { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
        );
      }
      showToast(
        'success',
        'Semua Nilai Tersimpan',
        `Berhasil menyimpan nilai untuk ${classStudents.length} siswa.`
      );
    } catch (err) {
      showToast('error', 'Simpan Massal Gagal', err instanceof Error ? err.message : '');
    } finally {
      setSavingAll(false);
    }
  };

  const openEditGradeModal = (g: GradeRecord) => {
    setEditingGrade(g);
    setEditDraft(getGradeComponentScores(g));
    setEditNote('');
  };

  const handleSaveEditGradeModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !editingGrade) return;
    const stu = students.find((s) => s.id === editingGrade.studentId) || {
      id: editingGrade.studentId,
      userId: editingGrade.studentUserId,
      nis: editingGrade.studentNis || '',
      nisn: '',
      fullName: editingGrade.studentName || '',
      gender: 'L' as const,
      email: '',
      classId: editingGrade.classId,
      entryYear: new Date().getFullYear(),
      status: 'active' as const,
    };

    const modalSubjectCfg = subjectGradingConfigs.find(
      (c) => c.subjectId === editingGrade.subjectId
    );
    const modalWeights = modalSubjectCfg
      ? {
          ujianLisan: modalSubjectCfg.ujianLisanWeight,
          ujianTulis: modalSubjectCfg.ujianTulisWeight,
        }
      : normalizedSchoolWeights;
    const modalMin = modalSubjectCfg?.rangeMin ?? (schoolSettings.minScore ?? 0);
    const modalMax = modalSubjectCfg?.rangeMax ?? (schoolSettings.maxScore ?? 100);

    setSavingEditModal(true);
    try {
      await saveGradeEntry(
        {
          student: stu,
          classId: editingGrade.classId,
          className: editingGrade.className || editingGrade.classId,
          subjectId: editingGrade.subjectId,
          subjectName: editingGrade.subjectName || editingGrade.subjectId,
          teacherId: editingGrade.teacherId,
          teacherUserId: editingGrade.teacherUserId || userProfile.uid,
          teacherName: editingGrade.teacherName || userProfile.displayName,
          semesterId: editingGrade.semesterId,
          academicYearId: editingGrade.academicYearId || activeAcademicYear?.id || 'ay_default',
          scores: editDraft,
          writtenDetails: editingGrade.writtenDetails,
          weights: modalWeights,
          gradeBands: modalSubjectCfg?.gradeBands,
          minScore: modalMin,
          maxScore: modalMax,
          existingGrade: editingGrade,
          note: editNote.trim() || 'Pembaruan nilai oleh pengajar',
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      setEditingGrade(null);
      showToast('success', 'Nilai Diperbarui', `Nilai ${stu.fullName} berhasil diperbarui.`);
    } catch (err) {
      showToast('error', 'Gagal Memperbarui Nilai', err instanceof Error ? err.message : '');
    } finally {
      setSavingEditModal(false);
    }
  };

  const handleSaveGlobalWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const total = Number(weights.ujianLisan) + Number(weights.ujianTulis);
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
      showToast('success', 'Pengaturan Default Sekolah Disimpan');
    } catch (err) {
      showToast('error', 'Gagal Menyimpan Bobot', err instanceof Error ? err.message : '');
    }
  };

  const handleSaveSubjectConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !selectedSubjectId) {
      showToast('error', 'Pilih Mata Pelajaran Terlebih Dahulu');
      return;
    }
    setSavingSubjectConfig(true);
    try {
      await saveSubjectGradingConfig(
        {
          subjectId: selectedSubjectId,
          subjectName: selectedSubject?.name || selectedSubjectId,
          ujianLisanWeight: configDraft.ujianLisanWeight,
          ujianTulisWeight: configDraft.ujianTulisWeight,
          rangeMin: configDraft.rangeMin,
          rangeMax: configDraft.rangeMax,
          rangeMode: configDraft.rangeMode,
          babs: configDraft.babs,
          kkm: configDraft.kkm,
          gradeBands: configDraft.gradeBands,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast(
        'success',
        'Konfigurasi & Range Mapel Tersimpan',
        `${selectedSubject?.name || selectedSubjectId} (${configDraft.babs.length} BAB, Range ${configDraft.rangeMin}–${configDraft.rangeMax}).`
      );
    } catch (err) {
      showToast('error', 'Gagal Menyimpan Konfigurasi', err instanceof Error ? err.message : '');
    } finally {
      setSavingSubjectConfig(false);
    }
  };

  const handleSaveCalculatorGrade = async () => {
    if (!userProfile || !calcStudentId || !selectedClassId || !selectedSubjectId) return;
    const student = classStudents.find((s) => s.id === calcStudentId);
    if (!student) return;

    const cls = classes.find((c) => c.id === selectedClassId);
    const sub = subjects.find((s) => s.id === selectedSubjectId);
    const teacherObj = currentTeacher || teachers[0];
    const gradeId = getGradeDocId(semesterId, selectedClassId, selectedSubjectId, student.id);
    const existingGrade = grades.find((g) => g.id === gradeId);

    setSavingCalcGrade(true);
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
          scores: {
            ujianLisan: Number(calcLisanScore) || 0,
            ujianTulis: writtenCalcResult.convertedScore,
          },
          writtenDetails: writtenCalcResult.writtenDetails,
          weights: {
            ujianLisan: configDraft.ujianLisanWeight,
            ujianTulis: configDraft.ujianTulisWeight,
          },
          gradeBands: configDraft.gradeBands,
          minScore: configDraft.rangeMin,
          maxScore: configDraft.rangeMax,
          existingGrade,
          note: `Perhitungan Ujian Tulis per BAB (${writtenCalcResult.totalEarned}/${writtenCalcResult.totalMax})`,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast(
        'success',
        'Nilai Ujian Tulis & Lisan Disimpan',
        `${student.fullName}: Tulis ${writtenCalcResult.convertedScore}, Lisan ${calcLisanScore}, Akhir ${calcPreviewFinal.finalScore} (${calcPreviewFinal.letterGrade}).`
      );
    } catch (err) {
      showToast('error', 'Gagal Menyimpan Nilai', err instanceof Error ? err.message : '');
    } finally {
      setSavingCalcGrade(false);
    }
  };

  const addBabRow = () => {
    setConfigDraft((prev) => {
      const nextNum = prev.babs.length + 1;
      return {
        ...prev,
        babs: [
          ...prev.babs,
          {
            id: `bab_${Date.now()}_${nextNum}`,
            title: `BAB ${nextNum}`,
            questionCount: 5,
            maxPerQuestion: 10,
          },
        ],
      };
    });
  };

  const updateBabRow = (idx: number, patch: Partial<WrittenExamBab>) => {
    setConfigDraft((prev) => ({
      ...prev,
      babs: prev.babs.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }));
  };

  const removeBabRow = (idx: number) => {
    setConfigDraft((prev) => {
      if (prev.babs.length <= 1) return prev;
      return {
        ...prev,
        babs: prev.babs.filter((_, i) => i !== idx),
      };
    });
  };

  const handleOpenCalculatorForStudent = (studentId: string) => {
    setCalcStudentId(studentId);
    setTab('weights');
  };

  const visibleGrades = useMemo(() => {
    if (role === 'student' && currentStudent) {
      return grades.filter((g) => g.studentId === currentStudent.id);
    }
    return grades;
  }, [grades, role, currentStudent]);

  const canDownloadReport =
    role !== 'student' || schoolSettings.allowStudentReportDownload;

  const totalMaxRawScore = useMemo(
    () =>
      configDraft.babs.reduce(
        (acc, b) => acc + Math.max(1, b.questionCount) * Math.max(1, b.maxPerQuestion),
        0
      ),
    [configDraft.babs]
  );

  const totalQuestionsCount = useMemo(
    () => configDraft.babs.reduce((acc, b) => acc + Math.max(1, b.questionCount), 0),
    [configDraft.babs]
  );

  const currentStudentIndex = classStudents.findIndex((s) => s.id === calcStudentId);

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
            {t('gradesTabInput')}
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
            {t('gradesTabRecap')}
          </button>
          <button
            type="button"
            onClick={() => setTab('weights')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'weights'
                ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t('gradesTabWeights')}
          </button>
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#162742] border border-slate-200 dark:border-slate-700 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Rentang nilai mapel: <strong className="font-mono-tabular">{activeRangeMin}–{activeRangeMax}</strong> · Bobot:{' '}
              <strong>{t('ujianLisanLabel')} {activeWeights.ujianLisan}%</strong> ·{' '}
              <strong>{t('ujianTulisLabel')} {activeWeights.ujianTulis}%</strong>
              {savedSubjectConfig && (
                <span className="ml-2 text-sky-700 dark:text-cyan-400 font-semibold">
                  ({savedSubjectConfig.babs.length} BAB Soal Tersedia)
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setTab('weights')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-[#0F1E33] text-sky-700 dark:text-cyan-400 font-semibold whitespace-nowrap hover:bg-sky-50 dark:hover:bg-sky-950/40"
            >
              <Calculator className="w-3.5 h-3.5" />
              Hitung Ujian Tulis (BAB) & Range
            </button>
          </div>

          {classStudents.length === 0 ? (
            <EmptyState
              title="Belum ada siswa aktif pada kelas ini"
              description="Pilih kelas yang memiliki peserta didik aktif untuk memulai penilaian."
            />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2.5 px-2">Siswa</th>
                      <th className="py-2.5 px-2">{t('ujianLisanLabel')}</th>
                      <th className="py-2.5 px-2">{t('ujianTulisLabel')}</th>
                      <th className="py-2.5 px-2">Nilai Akhir</th>
                      <th className="py-2.5 px-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {classStudents.map((stu) => {
                      const sc = draftScores[stu.id] || {
                        ujianLisan: 0,
                        ujianTulis: 0,
                      };
                      const gradeId = getGradeDocId(
                        semesterId,
                        selectedClassId,
                        selectedSubjectId,
                        stu.id
                      );
                      const existingGrade = grades.find((g) => g.id === gradeId);
                      const preview = computeFinalScore(
                        sc,
                        activeWeights,
                        activeGradeBands,
                        activeRangeMax
                      );

                      return (
                        <tr key={stu.id}>
                          <td className="py-2.5 px-2 min-w-[170px]">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {stu.fullName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono-tabular">{stu.nis}</p>
                          </td>
                          <td className="py-2.5 px-2">
                            <input
                              type="number"
                              step="0.01"
                              min={activeRangeMin}
                              max={activeRangeMax}
                              value={sc.ujianLisan}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setDraftScores((prev) => ({
                                  ...prev,
                                  [stu.id]: { ...sc, ujianLisan: val },
                                }));
                              }}
                              className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular text-center"
                            />
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                min={activeRangeMin}
                                max={activeRangeMax}
                                value={sc.ujianTulis}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setDraftScores((prev) => ({
                                    ...prev,
                                    [stu.id]: { ...sc, ujianTulis: val },
                                  }));
                                }}
                                className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular text-center"
                              />
                              <button
                                type="button"
                                onClick={() => handleOpenCalculatorForStudent(stu.id)}
                                title="Input Nilai Ujian Tulis per BAB & Nomor"
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-medium text-sky-700 dark:text-cyan-400"
                              >
                                <Calculator className="w-3 h-3" />
                                BAB
                                {(existingGrade?.writtenDetails || []).length > 0 && (
                                  <span>({existingGrade?.writtenDetails?.length})</span>
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 font-mono-tabular font-bold text-sky-700 dark:text-cyan-400">
                            {preview.finalScore} ({preview.letterGrade})
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <button
                              type="button"
                              disabled={savingStudentId === stu.id || savingAll}
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
              <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={savingAll}
                  onClick={() => void handleSaveAllGrades()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingAll ? '...' : t('saveAllGrades')}
                </button>
              </div>
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
                      visibleGrades.map((g) => {
                        const comp = getGradeComponentScores(g);
                        return {
                          NIS: g.studentNis || '',
                          'Nama Siswa': g.studentName || '',
                          Kelas: g.className || '',
                          'Mata Pelajaran': g.subjectName || '',
                          'Ujian Lisan': comp.ujianLisan,
                          'Ujian Tulis': comp.ujianTulis,
                          'Nilai Akhir': g.finalScore,
                          Predikat: g.letterGrade,
                        };
                      })
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
                    <th className="py-2.5 px-2 text-right">{t('ujianLisanLabel')}</th>
                    <th className="py-2.5 px-2 text-right">{t('ujianTulisLabel')}</th>
                    <th className="py-2.5 px-2 text-right">Nilai Akhir</th>
                    <th className="py-2.5 px-2 text-center">Predikat</th>
                    {canEdit && <th className="py-2.5 px-2 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {visibleGrades.map((g) => {
                    const comp = getGradeComponentScores(g);
                    return (
                      <tr key={g.id}>
                        <td className="py-3 px-2 font-semibold">{g.studentName}</td>
                        <td className="py-3 px-2">{g.className}</td>
                        <td className="py-3 px-2">
                          <span>{g.subjectName}</span>
                          {(g.writtenDetails || []).length > 0 && (
                            <span className="ml-1.5 text-[11px] text-sky-700 dark:text-cyan-400">
                              ({g.writtenDetails?.length} BAB)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-mono-tabular">
                          {comp.ujianLisan}
                        </td>
                        <td className="py-3 px-2 text-right font-mono-tabular">
                          {comp.ujianTulis}
                        </td>
                        <td className="py-3 px-2 text-right font-mono-tabular font-bold text-sky-700 dark:text-cyan-400">
                          {g.finalScore}
                        </td>
                        <td className="py-3 px-2 text-center font-bold">{g.letterGrade}</td>
                        {canEdit && (
                          <td className="py-3 px-2 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditGradeModal(g)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                              {(g.history || []).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setHistoryGrade(g)}
                                  title="Lihat Riwayat Perubahan"
                                  className="inline-flex items-center gap-1 text-sky-700 dark:text-cyan-400 hover:underline"
                                >
                                  <History className="w-3.5 h-3.5" />
                                  {g.history?.length}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PENGATURAN NILAI (GURU & ADMIN): RANGE MAPEL, BAB/NOMOR UJIAN TULIS, & KALKULATOR INPUT NILAI */}
      {canEdit && tab === 'weights' && (
        <div className="space-y-6">
          {/* Subject Config + Range + BAB Structure */}
          <form
            onSubmit={handleSaveSubjectConfig}
            className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold">
                    Pengaturan RANGE & Struktur Soal Ujian Tulis per Mata Pelajaran
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Guru dan Admin dapat menentukan bobot, RANGE nilai mapel, serta susunan BAB dan jumlah nomor soal Ujian Tulis.
                  </p>
                </div>
              </div>
              <div className="min-w-[230px]">
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Pilih Mata Pelajaran
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                >
                  {availableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bobot & Range per Mapel */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block font-medium mb-1">Bobot Ujian Lisan (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={configDraft.ujianLisanWeight}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setConfigDraft((prev) => ({
                      ...prev,
                      ujianLisanWeight: val,
                      ujianTulisWeight: 100 - val,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Bobot Ujian Tulis (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={configDraft.ujianTulisWeight}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setConfigDraft((prev) => ({
                      ...prev,
                      ujianTulisWeight: val,
                      ujianLisanWeight: 100 - val,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">RANGE Minimum Mapel</label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={configDraft.rangeMin}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, rangeMin: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">RANGE Maksimum Mapel</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={configDraft.rangeMax}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, rangeMax: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium mb-1">Rumus Perhitungan RANGE Ujian Tulis</label>
                <select
                  value={configDraft.rangeMode}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({
                      ...prev,
                      rangeMode: e.target.value as RangeCalculationMode,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                >
                  <option value="proportional">
                    Konversi Proporsional (Skor / Skor Maks → Range Min–Max)
                  </option>
                  <option value="direct">
                    Akumulasi Skor Langsung (Dibatasi Range Min–Max)
                  </option>
                </select>
              </div>
            </div>

            {/* Grade Predicate Bands */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block font-medium mb-1">KKM Mapel</label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={configDraft.kkm}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, kkm: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                />
              </div>
              {(
                [
                  { key: 'aMin', label: 'Batas Minimal A' },
                  { key: 'bMin', label: 'Batas Minimal B' },
                  { key: 'cMin', label: 'Batas Minimal C' },
                  { key: 'dMin', label: 'Batas Minimal D' },
                ] as const
              ).map((band) => (
                <div key={band.key}>
                  <label className="block font-medium mb-1">{band.label}</label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={configDraft.gradeBands[band.key]}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({
                        ...prev,
                        gradeBands: {
                          ...prev.gradeBands,
                          [band.key]: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                  />
                </div>
              ))}
            </div>

            {/* Dynamic BAB & Question Count Structure */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                    <ListChecks className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                    Susunan BAB & Jumlah Nomor Soal Ujian Tulis
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tentukan berapa BAB soal ujian tulis serta jumlah nomor dan skor maksimal per nomor pada tiap BAB.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addBabRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah BAB Soal
                </button>
              </div>

              <div className="space-y-2">
                {configDraft.babs.map((bab, idx) => {
                  const babMax =
                    Math.max(1, bab.questionCount) * Math.max(1, bab.maxPerQuestion);
                  return (
                    <div
                      key={bab.id}
                      className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-slate-50 dark:bg-[#162742] border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div className="col-span-12 sm:col-span-5">
                        <label className="block text-[11px] font-medium mb-1">
                          Judul BAB #{idx + 1}
                        </label>
                        <input
                          value={bab.title}
                          onChange={(e) => updateBabRow(idx, { title: e.target.value })}
                          placeholder={`BAB ${idx + 1}`}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1E33]"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-3">
                        <label className="block text-[11px] font-medium mb-1">
                          Jumlah Nomor
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={bab.questionCount}
                          onChange={(e) =>
                            updateBabRow(idx, {
                              questionCount: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1E33] font-mono-tabular"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-2">
                        <label className="block text-[11px] font-medium mb-1">
                          Maks / Nomor
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={bab.maxPerQuestion}
                          onChange={(e) =>
                            updateBabRow(idx, {
                              maxPerQuestion: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1E33] font-mono-tabular"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2 pb-1">
                        <span className="text-[11px] font-mono-tabular font-semibold text-slate-600 dark:text-slate-300">
                          Maks {babMax}
                        </span>
                        <button
                          type="button"
                          disabled={configDraft.babs.length <= 1}
                          onClick={() => removeBabRow(idx)}
                          title="Hapus BAB"
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Total Struktur: <strong>{configDraft.babs.length} BAB</strong> ·{' '}
                  <strong>{totalQuestionsCount} Nomor Soal</strong> · Total Skor Maksimal{' '}
                  <strong className="font-mono-tabular text-sky-700 dark:text-cyan-400">
                    {totalMaxRawScore}
                  </strong>
                </p>
                <button
                  type="submit"
                  disabled={savingSubjectConfig}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingSubjectConfig
                    ? 'Menyimpan...'
                    : 'Simpan Konfigurasi, Range & BAB Mapel'}
                </button>
              </div>
            </div>
          </form>

          {/* Perhitungan & Input Nilai Ujian Tulis Siswa per BAB & Nomor */}
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold">
                    Perhitungan & Input Nilai Ujian Tulis (Per BAB & Nomor Soal)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Masukkan skor tiap nomor soal di setiap BAB. Nilai Ujian Tulis terhitung otomatis sesuai RANGE mapel.
                  </p>
                </div>
              </div>
              {classStudents.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    disabled={currentStudentIndex <= 0}
                    onClick={() =>
                      currentStudentIndex > 0 &&
                      setCalcStudentId(classStudents[currentStudentIndex - 1].id)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Sebelumnya
                  </button>
                  <span className="font-mono-tabular text-slate-500 px-1">
                    {currentStudentIndex + 1}/{classStudents.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentStudentIndex >= classStudents.length - 1}
                    onClick={() =>
                      currentStudentIndex < classStudents.length - 1 &&
                      setCalcStudentId(classStudents[currentStudentIndex + 1].id)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                  >
                    Berikutnya
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Kelas</label>
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
                <label className="block font-medium mb-1">Siswa</label>
                <select
                  value={calcStudentId}
                  onChange={(e) => setCalcStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                >
                  {classStudents.length === 0 ? (
                    <option value="">Tidak ada siswa aktif di kelas ini</option>
                  ) : (
                    classStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.nis})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">
                  Nilai {t('ujianLisanLabel')} (Range {configDraft.rangeMin}–{configDraft.rangeMax})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={configDraft.rangeMin}
                  max={configDraft.rangeMax}
                  value={calcLisanScore}
                  onChange={(e) => setCalcLisanScore(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                />
              </div>
            </div>

            {classStudents.length === 0 ? (
              <EmptyState
                title="Pilih kelas dengan siswa aktif"
                description="Belum ada siswa aktif pada kelas yang dipilih."
              />
            ) : (
              <div className="space-y-4">
                {configDraft.babs.map((bab) => {
                  const qCount = Math.max(1, Math.min(100, bab.questionCount || 1));
                  const maxPerQ = Math.max(1, bab.maxPerQuestion || 1);
                  const scores = babQuestionScores[bab.id] || Array(qCount).fill(0);
                  const babDetail = writtenCalcResult.writtenDetails.find(
                    (d) => d.babId === bab.id
                  );

                  return (
                    <div
                      key={bab.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#162742]/70 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {bab.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {qCount} Nomor Soal · Maks {maxPerQ} per nomor · Subtotal:{' '}
                            <strong className="font-mono-tabular text-sky-700 dark:text-cyan-400">
                              {babDetail?.subtotal ?? 0} / {babDetail?.maxTotal ?? qCount * maxPerQ}
                            </strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() =>
                              setBabQuestionScores((prev) => ({
                                ...prev,
                                [bab.id]: Array(qCount).fill(maxPerQ),
                              }))
                            }
                            className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1E33] font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Benar Semua ({maxPerQ})
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setBabQuestionScores((prev) => ({
                                ...prev,
                                [bab.id]: Array(qCount).fill(0),
                              }))
                            }
                            className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1E33] font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Reset 0
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
                        {Array.from({ length: qCount }, (_, qIdx) => (
                          <div key={qIdx} className="space-y-1">
                            <label className="block text-[11px] font-medium text-slate-500 text-center">
                              No. {qIdx + 1}
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              max={maxPerQ}
                              value={scores[qIdx] ?? 0}
                              onChange={(e) => {
                                const raw = Number(e.target.value);
                                const clamped = Number.isNaN(raw)
                                  ? 0
                                  : Math.max(0, Math.min(maxPerQ, raw));
                                setBabQuestionScores((prev) => {
                                  const copy = [...(prev[bab.id] || Array(qCount).fill(0))];
                                  while (copy.length < qCount) copy.push(0);
                                  copy[qIdx] = clamped;
                                  return { ...prev, [bab.id]: copy };
                                });
                              }}
                              className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1E33] font-mono-tabular text-center"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Calculation Result & Save Bar */}
                <div className="p-4 rounded-xl bg-[#0F294A]/5 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs flex-1">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Total Skor Soal</p>
                      <p className="text-base font-bold font-mono-tabular text-slate-900 dark:text-white">
                        {writtenCalcResult.totalEarned} / {writtenCalcResult.totalMax}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">
                        RANGE ({configDraft.rangeMin}–{configDraft.rangeMax})
                      </p>
                      <p className="text-base font-bold font-mono-tabular text-sky-700 dark:text-cyan-400">
                        {writtenCalcResult.convertedScore}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">{t('ujianLisanLabel')}</p>
                      <p className="text-base font-bold font-mono-tabular text-slate-900 dark:text-white">
                        {calcLisanScore}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Nilai Akhir & Predikat</p>
                      <p className="text-base font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400">
                        {calcPreviewFinal.finalScore} ({calcPreviewFinal.letterGrade})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={savingCalcGrade}
                    onClick={() => void handleSaveCalculatorGrade()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {savingCalcGrade ? 'Menyimpan...' : 'Simpan Nilai Ujian Tulis & Lisan Siswa'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ADMIN GLOBAL SCHOOL DEFAULTS */}
          {isAdmin && (
            <form
              onSubmit={handleSaveGlobalWeights}
              className="max-w-2xl bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold">Pengaturan Default Sekolah (Admin)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Digunakan sebagai nilai bawaan apabila mata pelajaran belum memiliki pengaturan RANGE khusus.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-medium mb-1">Ujian Lisan (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights.ujianLisan}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setWeights({ ujianLisan: val, ujianTulis: 100 - val });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Ujian Tulis (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights.ujianTulis}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setWeights({ ujianTulis: val, ujianLisan: 100 - val });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                  />
                </div>
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
                Simpan Pengaturan Default Sekolah
              </button>
            </form>
          )}
        </div>
      )}

      {/* Edit Grade Modal (Admin & Guru) */}
      <ModalShell
        open={Boolean(editingGrade)}
        onClose={() => setEditingGrade(null)}
        title={t('editGradeTitle')}
        subtitle={
          editingGrade
            ? `${editingGrade.studentName} · ${editingGrade.className} · ${editingGrade.subjectName}`
            : ''
        }
      >
        {editingGrade && (
          <form onSubmit={handleSaveEditGradeModal} className="space-y-4 text-xs">
            {(() => {
              const modalCfg = subjectGradingConfigs.find(
                (c) => c.subjectId === editingGrade.subjectId
              );
              const modalWeights = modalCfg
                ? {
                    ujianLisan: modalCfg.ujianLisanWeight,
                    ujianTulis: modalCfg.ujianTulisWeight,
                  }
                : normalizedSchoolWeights;
              const modalMin = modalCfg?.rangeMin ?? (schoolSettings.minScore ?? 0);
              const modalMax = modalCfg?.rangeMax ?? (schoolSettings.maxScore ?? 100);
              const previewModal = computeFinalScore(
                editDraft,
                modalWeights,
                modalCfg?.gradeBands,
                modalMax
              );

              return (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium mb-1">{t('ujianLisanLabel')}</label>
                      <input
                        type="number"
                        step="0.01"
                        min={modalMin}
                        max={modalMax}
                        value={editDraft.ujianLisan}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, ujianLisan: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">{t('ujianTulisLabel')}</label>
                      <input
                        type="number"
                        step="0.01"
                        min={modalMin}
                        max={modalMax}
                        value={editDraft.ujianTulis}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, ujianTulis: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] font-mono-tabular"
                      />
                    </div>
                  </div>

                  {(editingGrade.writtenDetails || []).length > 0 && (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#162742] border border-slate-200 dark:border-slate-700 space-y-1">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">
                        Rincian Skor BAB Ujian Tulis Tersimpan:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {editingGrade.writtenDetails?.map((d) => (
                          <span
                            key={d.babId}
                            className="px-2 py-1 rounded bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-700 font-mono-tabular"
                          >
                            {d.babTitle}: {d.subtotal}/{d.maxTotal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#162742] border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      Pratinjau Nilai Akhir ({modalWeights.ujianLisan}% / {modalWeights.ujianTulis}%):
                    </span>
                    <span className="font-mono-tabular font-bold text-sm text-sky-700 dark:text-cyan-400">
                      {previewModal.finalScore} ({previewModal.letterGrade})
                    </span>
                  </div>
                </>
              );
            })()}

            <div>
              <label className="block font-medium mb-1">Catatan Perubahan (opsional)</label>
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Misal: Perbaikan nilai ujian lisan"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingGrade(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={savingEditModal}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white font-semibold"
              >
                <Save className="w-3.5 h-3.5" />
                {savingEditModal ? '...' : t('saveChanges')}
              </button>
            </div>
          </form>
        )}
      </ModalShell>

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
                {h.note && <p className="text-slate-600 dark:text-slate-300 mt-1">{h.note}</p>}
              </div>
            ))}
          </div>
        )}
      </ModalShell>
    </div>
  );
}
