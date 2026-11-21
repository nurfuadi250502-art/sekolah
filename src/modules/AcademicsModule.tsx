import React, { useMemo, useState } from 'react';
import { Calendar, Edit2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePortalData } from '../contexts/PortalDataContext';
import { useToast } from '../components/ui/ToastProvider';
import { EmptyState, ModalShell } from '../components/ui/DataTableControls';
import {
  deleteCollectionDoc,
  saveAcademicYear,
  saveClass,
  saveSchedule,
  saveSemester,
  saveSubject,
} from '../services/firestoreService';
import { DayOfWeek, Schedule, Subject } from '../types/portal';

type SubTab = 'classes' | 'subjects' | 'periods' | 'schedules';

export function AcademicsModule() {
  const { userProfile, effectiveRole } = useAuth();
  const { t } = useLanguage();
  const {
    classes,
    subjects,
    teachers,
    academicYears,
    semesters,
    schedules,
    activeAcademicYear,
    activeSemester,
    currentStudent,
    currentTeacher,
  } = usePortalData();
  const { showToast } = useToast();

  const isAdmin = effectiveRole === 'admin';
  const isTeacher = effectiveRole === 'teacher';
  const canEditSubject = isAdmin || isTeacher;
  const [tab, setTab] = useState<SubTab>(isAdmin ? 'classes' : isTeacher ? 'subjects' : 'schedules');

  // Class form
  const [clsName, setClsName] = useState('');
  const [clsGrade, setClsGrade] = useState('1');
  const [clsRoom, setClsRoom] = useState('');
  const [clsCap, setClsCap] = useState(36);
  const [clsHomeroomId, setClsHomeroomId] = useState('');

  // Subject form
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subCat, setSubCat] = useState('Wajib');
  const [subKkm, setSubKkm] = useState(75);

  // Academic Year / Semester form
  const [ayName, setAyName] = useState('2026/2027');
  const [ayStart, setAyStart] = useState('2026-07-13');
  const [ayEnd, setAyEnd] = useState('2027-06-19');
  const [semYearId, setSemYearId] = useState('');
  const [semName, setSemName] = useState<'Ganjil' | 'Genap'>('Ganjil');

  // Schedule form
  const [schClassId, setSchClassId] = useState('');
  const [schSubId, setSchSubId] = useState('');
  const [schTeacherId, setSchTeacherId] = useState('');
  const [schDay, setSchDay] = useState<DayOfWeek>('Senin');
  const [schStart, setSchStart] = useState('07:30');
  const [schEnd, setSchEnd] = useState('09:00');
  const [schRoom, setSchRoom] = useState('');

  // Edit Subject modal state (Admin & Guru)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubCode, setEditSubCode] = useState('');
  const [editSubName, setEditSubName] = useState('');
  const [editSubCat, setEditSubCat] = useState('Wajib');
  const [editSubGrade, setEditSubGrade] = useState('Semua');
  const [editSubKkm, setEditSubKkm] = useState(75);
  const [editSubDesc, setEditSubDesc] = useState('');
  const [savingSubject, setSavingSubject] = useState(false);

  // Edit Schedule modal state (Admin & Guru for own schedules)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editSchClassId, setEditSchClassId] = useState('');
  const [editSchSubId, setEditSchSubId] = useState('');
  const [editSchTeacherId, setEditSchTeacherId] = useState('');
  const [editSchDay, setEditSchDay] = useState<DayOfWeek>('Senin');
  const [editSchStart, setEditSchStart] = useState('07:30');
  const [editSchEnd, setEditSchEnd] = useState('09:00');
  const [editSchRoom, setEditSchRoom] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  const visibleSchedules = useMemo(() => {
    if (effectiveRole === 'student' && currentStudent) {
      return schedules.filter((s) => s.classId === currentStudent.classId);
    }
    if (effectiveRole === 'teacher' && currentTeacher) {
      return schedules.filter((s) => s.teacherId === currentTeacher.id);
    }
    return schedules;
  }, [schedules, effectiveRole, currentStudent, currentTeacher]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !clsName.trim()) return;
    const hr = teachers.find((t) => t.id === clsHomeroomId);
    try {
      await saveClass(
        {
          id: '',
          name: clsName,
          gradeLevel: clsGrade,
          homeroomTeacherId: hr?.id || '',
          homeroomTeacherName: hr?.fullName || '',
          academicYearId: activeAcademicYear?.id || 'ay_default',
          capacity: clsCap,
          room: clsRoom,
          teacherIds: hr ? [hr.id] : [],
          isNew: true,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      setClsName('');
      setClsRoom('');
      showToast('success', 'Kelas Ditambahkan');
    } catch (err) {
      showToast('error', 'Gagal', err instanceof Error ? err.message : '');
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !subCode.trim() || !subName.trim()) return;
    try {
      await saveSubject(
        {
          id: '',
          code: subCode.toUpperCase(),
          name: subName,
          category: subCat,
          gradeLevel: 'Semua',
          kkm: subKkm,
          description: '',
          isNew: true,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      setSubCode('');
      setSubName('');
      showToast('success', 'Mata Pelajaran Ditambahkan');
    } catch (err) {
      showToast('error', 'Gagal', err instanceof Error ? err.message : '');
    }
  };

  const openEditSubject = (sub: Subject) => {
    setEditingSubject(sub);
    setEditSubCode(sub.code);
    setEditSubName(sub.name);
    setEditSubCat(sub.category || 'Wajib');
    setEditSubGrade(sub.gradeLevel || 'Semua');
    setEditSubKkm(sub.kkm ?? 75);
    setEditSubDesc(sub.description || '');
  };

  const handleSaveEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !editingSubject || !editSubCode.trim() || !editSubName.trim()) return;
    setSavingSubject(true);
    try {
      await saveSubject(
        {
          id: editingSubject.id,
          code: editSubCode.toUpperCase(),
          name: editSubName,
          category: editSubCat,
          gradeLevel: editSubGrade,
          kkm: editSubKkm,
          description: editSubDesc,
          isNew: false,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      setEditingSubject(null);
      showToast('success', 'Pelajaran Diperbarui', `${editSubName} berhasil diperbarui.`);
    } catch (err) {
      showToast('error', 'Gagal Memperbarui Pelajaran', err instanceof Error ? err.message : '');
    } finally {
      setSavingSubject(false);
    }
  };

  const openEditSchedule = (sch: Schedule) => {
    setEditingSchedule(sch);
    setEditSchClassId(sch.classId);
    setEditSchSubId(sch.subjectId);
    setEditSchTeacherId(sch.teacherId);
    setEditSchDay(sch.dayOfWeek);
    setEditSchStart(sch.startTime);
    setEditSchEnd(sch.endTime);
    setEditSchRoom(sch.room || '');
  };

  const handleSaveEditSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !editingSchedule) return;
    const cls = classes.find((c) => c.id === editSchClassId);
    const sub = subjects.find((s) => s.id === editSchSubId);
    const tch = teachers.find((tItem) => tItem.id === editSchTeacherId);
    setSavingSchedule(true);
    try {
      await saveSchedule(
        {
          id: editingSchedule.id,
          classId: isAdmin ? editSchClassId : editingSchedule.classId,
          className: isAdmin ? cls?.name || editingSchedule.className || '' : editingSchedule.className || '',
          subjectId: editSchSubId,
          subjectName: sub?.name || editingSchedule.subjectName || '',
          teacherId: isAdmin ? editSchTeacherId : editingSchedule.teacherId,
          teacherUserId: isAdmin
            ? tch?.userId || editingSchedule.teacherUserId || ''
            : editingSchedule.teacherUserId || '',
          teacherName: isAdmin
            ? tch?.fullName || editingSchedule.teacherName || ''
            : editingSchedule.teacherName || '',
          semesterId: editingSchedule.semesterId,
          dayOfWeek: editSchDay,
          startTime: editSchStart,
          endTime: editSchEnd,
          room: editSchRoom,
          isNew: false,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      setEditingSchedule(null);
      showToast('success', 'Jadwal Pelajaran Diperbarui');
    } catch (err) {
      showToast('error', 'Gagal Memperbarui Jadwal', err instanceof Error ? err.message : '');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    try {
      await saveAcademicYear(
        {
          id: '',
          name: ayName,
          startDate: ayStart,
          endDate: ayEnd,
          isActive: true,
          isNew: true,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast('success', 'Tahun Ajaran Aktif Disimpan');
    } catch (err) {
      showToast('error', 'Gagal', err instanceof Error ? err.message : '');
    }
  };

  const handleAddSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const ayId = semYearId || activeAcademicYear?.id || academicYears[0]?.id;
    const ay = academicYears.find((y) => y.id === ayId);
    if (!ayId) {
      showToast('error', 'Buat Tahun Ajaran terlebih dahulu');
      return;
    }
    try {
      await saveSemester(
        {
          id: '',
          academicYearId: ayId,
          academicYearName: ay?.name || '',
          name: semName,
          isActive: true,
          isNew: true,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast('success', 'Semester Aktif Disimpan');
    } catch (err) {
      showToast('error', 'Gagal', err instanceof Error ? err.message : '');
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !schClassId || !schSubId || !schTeacherId) {
      showToast('error', 'Pilih kelas, mata pelajaran, dan guru pengampu');
      return;
    }
    const cls = classes.find((c) => c.id === schClassId);
    const sub = subjects.find((s) => s.id === schSubId);
    const tch = teachers.find((t) => t.id === schTeacherId);
    try {
      await saveSchedule(
        {
          id: '',
          classId: schClassId,
          className: cls?.name || '',
          subjectId: schSubId,
          subjectName: sub?.name || '',
          teacherId: schTeacherId,
          teacherUserId: tch?.userId || '',
          teacherName: tch?.fullName || '',
          semesterId: activeSemester?.id || 'sem_default',
          dayOfWeek: schDay,
          startTime: schStart,
          endTime: schEnd,
          room: schRoom || cls?.room || '',
          isNew: true,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast('success', 'Jadwal Pelajaran Disimpan');
    } catch (err) {
      showToast('error', 'Gagal', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="space-y-6">
      {/* Segmented Sub-navigation */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
        {(
          [
            { id: 'classes', label: t('tabClasses'), roles: ['admin', 'teacher'] },
            { id: 'subjects', label: t('tabSubjects'), roles: ['admin', 'teacher', 'student'] },
            { id: 'periods', label: t('tabPeriods'), roles: ['admin'] },
            { id: 'schedules', label: t('tabSchedules'), roles: ['admin', 'teacher', 'student'] },
          ] as const
        )
          .filter((item) => (item.roles as readonly string[]).includes(effectiveRole || 'student'))
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-[#0F294A] text-white dark:bg-sky-600'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
      </div>

      {/* CLASSES TAB */}
      {tab === 'classes' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {isAdmin && (
            <form
              onSubmit={handleAddClass}
              className="lg:col-span-4 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 h-fit"
            >
              <h3 className="text-sm font-bold">Tambah Kelas Baru</h3>
              <div>
                <label className="block text-xs font-medium mb-1">Nama Kelas *</label>
                <input
                  required
                  value={clsName}
                  onChange={(e) => setClsName(e.target.value)}
                  placeholder="Contoh: 1A"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Tingkat</label>
                  <select
                    value={clsGrade}
                    onChange={(e) => setClsGrade(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                  >
                    <option value="1">Kelas 1</option>
                    <option value="2">Kelas 2</option>
                    <option value="3">Kelas 3</option>
                    <option value="4">Kelas 4</option>
                    <option value="5">Kelas 5</option>
                    <option value="6">Kelas 6</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Kapasitas</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={clsCap}
                    onChange={(e) => setClsCap(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Ruangan</label>
                <input
                  value={clsRoom}
                  onChange={(e) => setClsRoom(e.target.value)}
                  placeholder="Misal: R-102"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Wali Kelas</label>
                <select
                  value={clsHomeroomId}
                  onChange={(e) => setClsHomeroomId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                >
                  <option value="">Pilih Wali Kelas (Opsional)</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Simpan Kelas
              </button>
            </form>
          )}

          <div
            className={`${
              isAdmin ? 'lg:col-span-8' : 'lg:col-span-12'
            } bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5`}
          >
            <h3 className="text-sm font-bold mb-4">Daftar Rombongan Belajar</h3>
            {classes.length === 0 ? (
              <EmptyState title="Belum ada kelas" description="Tambahkan kelas pada formulir di samping." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3">Tingkat</th>
                      <th className="py-2.5 px-3">Ruang</th>
                      <th className="py-2.5 px-3">Wali Kelas</th>
                      <th className="py-2.5 px-3">Kapasitas</th>
                      {isAdmin && <th className="py-2.5 px-3 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {classes.map((c) => (
                      <tr key={c.id}>
                        <td className="py-3 px-3 font-semibold">{c.name}</td>
                        <td className="py-3 px-3 text-xs">
                          {c.gradeLevel?.startsWith('Kelas') ? c.gradeLevel : `Kelas ${c.gradeLevel}`}
                        </td>
                        <td className="py-3 px-3 text-xs">{c.room || '-'}</td>
                        <td className="py-3 px-3 text-xs">{c.homeroomTeacherName || '-'}</td>
                        <td className="py-3 px-3 text-xs tabular-nums">{c.capacity} siswa</td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                userProfile &&
                                void deleteCollectionDoc('classes', c.id, c.name, {
                                  uid: userProfile.uid,
                                  name: userProfile.displayName,
                                  role: userProfile.role,
                                })
                              }
                              className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBJECTS TAB */}
      {tab === 'subjects' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {isAdmin && (
            <form
              onSubmit={handleAddSubject}
              className="lg:col-span-4 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 h-fit"
            >
              <h3 className="text-sm font-bold">Tambah Mata Pelajaran</h3>
              <div>
                <label className="block text-xs font-medium mb-1">Kode Mapel *</label>
                <input
                  required
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="Contoh: FIS"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Nama Mata Pelajaran *</label>
                <input
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Contoh: Fisika"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Kelompok</label>
                  <select
                    value={subCat}
                    onChange={(e) => setSubCat(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                  >
                    <option value="Wajib">Wajib</option>
                    <option value="Peminatan">Peminatan</option>
                    <option value="Muatan Lokal">Muatan Lokal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">KKM</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={subKkm}
                    onChange={(e) => setSubKkm(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Simpan Mata Pelajaran
              </button>
            </form>
          )}

          <div
            className={`${
              isAdmin ? 'lg:col-span-8' : 'lg:col-span-12'
            } bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold">{t('tabSubjects')}</h3>
              {isTeacher && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Guru dapat mengedit nama, kelompok, tingkat, KKM, dan deskripsi pelajaran.
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    <th className="py-2.5 px-3">Kode</th>
                    <th className="py-2.5 px-3">Mata Pelajaran</th>
                    <th className="py-2.5 px-3">Kelompok</th>
                    <th className="py-2.5 px-3">KKM</th>
                    {canEditSubject && <th className="py-2.5 px-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {subjects.map((sub) => (
                    <tr key={sub.id}>
                      <td className="py-3 px-3 font-mono-tabular text-xs font-semibold">{sub.code}</td>
                      <td className="py-3 px-3">
                        <p className="font-semibold">{sub.name}</p>
                        {sub.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {sub.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs">{sub.category || '-'}</td>
                      <td className="py-3 px-3 text-xs tabular-nums">{sub.kkm}</td>
                      {canEditSubject && (
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditSubject(sub)}
                              title={t('editSubjectTitle')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() =>
                                  userProfile &&
                                  void deleteCollectionDoc('subjects', sub.id, sub.name, {
                                    uid: userProfile.uid,
                                    name: userProfile.displayName,
                                    role: userProfile.role,
                                  })
                                }
                                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ACADEMIC YEARS & SEMESTERS TAB */}
      {tab === 'periods' && isAdmin && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold">Tahun Ajaran</h3>
            <form onSubmit={handleAddYear} className="grid grid-cols-3 gap-2">
              <input
                required
                value={ayName}
                onChange={(e) => setAyName(e.target.value)}
                placeholder="2026/2027"
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
              <input
                type="date"
                required
                value={ayStart}
                onChange={(e) => setAyStart(e.target.value)}
                className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
              <input
                type="date"
                required
                value={ayEnd}
                onChange={(e) => setAyEnd(e.target.value)}
                className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
              <button
                type="submit"
                className="col-span-3 py-2 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white text-xs font-semibold"
              >
                Simpan & Aktifkan Tahun Ajaran
              </button>
            </form>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {academicYears.map((y) => (
                <div key={y.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{y.name}</p>
                    <p className="text-slate-500">
                      {y.startDate} s.d. {y.endDate}
                    </p>
                  </div>
                  <span className={y.isActive ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                    {y.isActive ? 'Aktif' : 'Arsip'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold">Semester</h3>
            <form onSubmit={handleAddSemester} className="grid grid-cols-2 gap-2">
              <select
                value={semYearId || activeAcademicYear?.id || ''}
                onChange={(e) => setSemYearId(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
              <select
                value={semName}
                onChange={(e) => setSemName(e.target.value as 'Ganjil' | 'Genap')}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
              <button
                type="submit"
                className="col-span-2 py-2 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white text-xs font-semibold"
              >
                Simpan & Aktifkan Semester
              </button>
            </form>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {semesters.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">
                      Semester {s.name} ({s.academicYearName})
                    </p>
                  </div>
                  <span className={s.isActive ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                    {s.isActive ? 'Aktif' : 'Arsip'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULES TAB */}
      {tab === 'schedules' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {isAdmin && (
            <form
              onSubmit={handleAddSchedule}
              className="lg:col-span-4 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 h-fit"
            >
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600" />
                Buat Jadwal Pelajaran
              </h3>
              <select
                required
                value={schClassId}
                onChange={(e) => setSchClassId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                <option value="">Pilih Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                required
                value={schSubId}
                onChange={(e) => setSchSubId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                <option value="">Pilih Mata Pelajaran</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                required
                value={schTeacherId}
                onChange={(e) => setSchTeacherId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                <option value="">Pilih Guru Pengampu</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={schDay}
                  onChange={(e) => setSchDay(e.target.value as DayOfWeek)}
                  className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                >
                  {(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as DayOfWeek[]).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={schStart}
                  onChange={(e) => setSchStart(e.target.value)}
                  className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                />
                <input
                  type="time"
                  value={schEnd}
                  onChange={(e) => setSchEnd(e.target.value)}
                  className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                />
              </div>
              <input
                value={schRoom}
                onChange={(e) => setSchRoom(e.target.value)}
                placeholder="Ruang Kelas (opsional)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white text-xs font-semibold"
              >
                Tambah ke Jadwal
              </button>
            </form>
          )}

          <div
            className={`${
              isAdmin ? 'lg:col-span-8' : 'lg:col-span-12'
            } bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5`}
          >
            <h3 className="text-sm font-bold mb-4">Jadwal Pelajaran Mingguan</h3>
            {visibleSchedules.length === 0 ? (
              <EmptyState
                title="Belum ada jadwal pelajaran"
                description="Jadwal pelajaran akan muncul setelah ditetapkan oleh Administrator Sekolah."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <th className="py-2.5 px-3">Hari & Jam</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3">Mata Pelajaran</th>
                      <th className="py-2.5 px-3">Guru</th>
                      <th className="py-2.5 px-3">Ruang</th>
                      {canEditSubject && <th className="py-2.5 px-3 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {visibleSchedules.map((sch) => {
                      const canEditThisSchedule =
                        isAdmin ||
                        (isTeacher &&
                          (sch.teacherId === currentTeacher?.id ||
                            sch.teacherUserId === userProfile?.uid));
                      return (
                        <tr key={sch.id}>
                          <td className="py-3 px-3 text-xs font-mono-tabular font-semibold">
                            {sch.dayOfWeek}, {sch.startTime}–{sch.endTime}
                          </td>
                          <td className="py-3 px-3 text-xs font-semibold">{sch.className}</td>
                          <td className="py-3 px-3 text-xs">{sch.subjectName}</td>
                          <td className="py-3 px-3 text-xs">{sch.teacherName}</td>
                          <td className="py-3 px-3 text-xs">{sch.room || '-'}</td>
                          {canEditSubject && (
                            <td className="py-3 px-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                {canEditThisSchedule && (
                                  <button
                                    type="button"
                                    onClick={() => openEditSchedule(sch)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      userProfile &&
                                      void deleteCollectionDoc(
                                        'schedules',
                                        sch.id,
                                        `${sch.className} ${sch.subjectName}`,
                                        {
                                          uid: userProfile.uid,
                                          name: userProfile.displayName,
                                          role: userProfile.role,
                                        }
                                      )
                                    }
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                                  >
                                    <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* Edit Subject Modal (Admin & Guru) */}
      <ModalShell
        open={Boolean(editingSubject)}
        onClose={() => setEditingSubject(null)}
        title={t('editSubjectTitle')}
        subtitle={editingSubject ? `${editingSubject.code} · ${editingSubject.name}` : ''}
      >
        <form onSubmit={handleSaveEditSubject} className="space-y-4 text-xs">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Kode Mapel *</label>
              <input
                required
                value={editSubCode}
                onChange={(e) => setEditSubCode(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Nama Mata Pelajaran *</label>
              <input
                required
                value={editSubName}
                onChange={(e) => setEditSubName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium mb-1">Kelompok</label>
              <select
                value={editSubCat}
                onChange={(e) => setEditSubCat(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                <option value="Wajib">Wajib</option>
                <option value="Peminatan">Peminatan</option>
                <option value="Muatan Lokal">Muatan Lokal</option>
                <option value="Kepesantrenan">Kepesantrenan</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Tingkat</label>
              <input
                value={editSubGrade}
                onChange={(e) => setEditSubGrade(e.target.value)}
                placeholder="Semua / Kelas 1–6"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">KKM</label>
              <input
                type="number"
                min={0}
                max={100}
                value={editSubKkm}
                onChange={(e) => setEditSubKkm(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Deskripsi / Silabus Singkat</label>
            <textarea
              rows={3}
              value={editSubDesc}
              onChange={(e) => setEditSubDesc(e.target.value)}
              placeholder="Ringkasan materi pembelajaran atau catatan pelajaran..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditingSubject(null)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={savingSubject}
              className="px-5 py-2 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white font-semibold"
            >
              {savingSubject ? '...' : t('saveChanges')}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Edit Schedule Modal (Admin & Guru for own schedule) */}
      <ModalShell
        open={Boolean(editingSchedule)}
        onClose={() => setEditingSchedule(null)}
        title={t('editScheduleTitle')}
        subtitle={
          editingSchedule ? `${editingSchedule.className} · ${editingSchedule.subjectName}` : ''
        }
      >
        <form onSubmit={handleSaveEditSchedule} className="space-y-4 text-xs">
          {isAdmin && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Kelas</label>
                <select
                  value={editSchClassId}
                  onChange={(e) => setEditSchClassId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Guru Pengampu</label>
                <select
                  value={editSchTeacherId}
                  onChange={(e) => setEditSchTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                >
                  {teachers.map((tch) => (
                    <option key={tch.id} value={tch.id}>
                      {tch.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="block font-medium mb-1">Mata Pelajaran</label>
            <select
              value={editSchSubId}
              onChange={(e) => setEditSchSubId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium mb-1">Hari</label>
              <select
                value={editSchDay}
                onChange={(e) => setEditSchDay(e.target.value as DayOfWeek)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                {(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as DayOfWeek[]).map(
                  (d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Jam Mulai</label>
              <input
                type="time"
                value={editSchStart}
                onChange={(e) => setEditSchStart(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Jam Selesai</label>
              <input
                type="time"
                value={editSchEnd}
                onChange={(e) => setEditSchEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Ruang Kelas</label>
            <input
              value={editSchRoom}
              onChange={(e) => setEditSchRoom(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditingSchedule(null)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={savingSchedule}
              className="px-5 py-2 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white font-semibold"
            >
              {savingSchedule ? '...' : t('saveChanges')}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
