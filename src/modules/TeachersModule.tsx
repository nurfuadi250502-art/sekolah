import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  KeyRound,
  MailCheck,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortalData } from '../contexts/PortalDataContext';
import { useToast } from '../components/ui/ToastProvider';
import {
  EmptyState,
  ModalShell,
  PaginationBar,
  TableSkeleton,
  TableToolbar,
} from '../components/ui/DataTableControls';
import {
  createAccountInvite,
  deleteTeacher,
  makeId,
  saveTeacher,
} from '../services/firestoreService';
import {
  exportTeachersPdf,
  exportToExcel,
  parseExcelOrCsvFile,
} from '../services/exportService';
import { EmploymentStatus, Gender, Teacher } from '../types/portal';

const PAGE_SIZE = 10;

const emptyTeacher = (): Omit<Teacher, 'createdAt' | 'updatedAt'> => ({
  id: '',
  userId: '',
  nip: '',
  teacherCode: '',
  fullName: '',
  gender: 'L',
  address: '',
  phone: '',
  email: '',
  subjectIds: [],
  subjectNames: [],
  classIds: [],
  classNames: [],
  employmentStatus: 'GTY',
  photoUrl: '',
});

export function TeachersModule() {
  const { userProfile, schoolSettings, sendResetPassword } = useAuth();
  const { loading, teachers, classes, subjects, accountInvites } = usePortalData();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [detailTeacher, setDetailTeacher] = useState<Teacher | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(emptyTeacher());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers
      .filter((t) => {
        if (subjectFilter !== 'all' && !(t.subjectIds || []).includes(subjectFilter)) {
          return false;
        }
        if (!q) return true;
        return (
          t.fullName.toLowerCase().includes(q) ||
          t.teacherCode.toLowerCase().includes(q) ||
          (t.nip || '').toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [teachers, subjectFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAdd = () => {
    setIsEditing(false);
    setForm(emptyTeacher());
    setFormOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setIsEditing(true);
    setForm({ ...t });
    setFormOpen(true);
  };

  const toggleIdInList = (list: string[], id: string) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    if (!form.teacherCode.trim() || !form.fullName.trim() || !form.email.trim()) {
      showToast('error', 'Data belum lengkap', 'Kode Guru, Nama Lengkap, dan Email wajib diisi.');
      return;
    }

    const subjectNames = subjects
      .filter((s) => form.subjectIds.includes(s.id))
      .map((s) => s.name);
    const classNames = classes
      .filter((c) => form.classIds.includes(c.id))
      .map((c) => c.name);

    setSaving(true);
    try {
      await saveTeacher(
        {
          ...form,
          subjectNames,
          classNames,
          isNew: !isEditing,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast(
        'success',
        isEditing ? 'Data Guru Diperbarui' : 'Guru Baru Ditambahkan',
        `${form.fullName} berhasil disimpan.`
      );
      setFormOpen(false);
    } catch (err) {
      showToast('error', 'Gagal Menyimpan Guru', err instanceof Error ? err.message : 'Kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: Teacher) => {
    if (!userProfile) return;
    if (!window.confirm(`Hapus permanen data guru ${t.fullName}?`)) return;
    try {
      await deleteTeacher(t, {
        uid: userProfile.uid,
        name: userProfile.displayName,
        role: userProfile.role,
      });
      showToast('success', 'Data Guru Dihapus', `${t.fullName} telah dihapus.`);
    } catch (err) {
      showToast('error', 'Gagal Menghapus', err instanceof Error ? err.message : 'Kesalahan');
    }
  };

  const handleProvisionInvite = async (t: Teacher) => {
    if (!userProfile) return;
    try {
      await createAccountInvite(
        {
          email: t.email,
          role: 'teacher',
          linkedEntityId: t.id,
          fullName: t.fullName,
          identityCode: t.nip || t.teacherCode,
          status: 'pending',
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast(
        'success',
        'Akun Guru Disiapkan',
        `Email ${t.email} kini diizinkan mengaktifkan Portal Guru.`
      );
    } catch (err) {
      showToast('error', 'Gagal Menyiapkan Akun', err instanceof Error ? err.message : 'Kesalahan');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;
    try {
      const rows = await parseExcelOrCsvFile(file);
      let imported = 0;
      for (const row of rows) {
        const teacherCode = String(row['Kode Guru'] || row.teacherCode || '').trim();
        const fullName = String(row['Nama Lengkap'] || row.fullName || '').trim();
        const email = String(row.Email || row.email || '').trim().toLowerCase();
        if (!teacherCode || !fullName || !email) continue;

        await saveTeacher(
          {
            id: makeId('tch'),
            userId: '',
            nip: String(row.NIP || row.nip || ''),
            teacherCode,
            fullName,
            gender: (String(row['L/P'] || row.gender || 'L').toUpperCase() === 'P' ? 'P' : 'L') as Gender,
            address: String(row.Alamat || row.address || ''),
            phone: String(row.Telepon || row.phone || ''),
            email,
            subjectIds: [],
            subjectNames: [],
            classIds: [],
            classNames: [],
            employmentStatus: 'GTY',
            photoUrl: '',
            isNew: true,
          },
          { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
        );
        imported++;
      }
      showToast('success', 'Impor Guru Selesai', `${imported} data guru berhasil ditambahkan.`);
    } catch (err) {
      showToast('error', 'Gagal Impor', err instanceof Error ? err.message : 'Format salah');
    } finally {
      e.target.value = '';
    }
  };

  const handleExportExcel = () => {
    exportToExcel(
      `Data_Guru_${new Date().toISOString().slice(0, 10)}`,
      'Guru',
      filtered.map((t) => ({
        'Kode Guru': t.teacherCode,
        'NIP/NUPTK': t.nip || '',
        'Nama Lengkap': t.fullName,
        'L/P': t.gender,
        'Mata Pelajaran': (t.subjectNames || []).join(', '),
        'Kelas Diajar': (t.classNames || []).join(', '),
        'Status Kepegawaian': t.employmentStatus,
        Telepon: t.phone || '',
        Email: t.email,
        Alamat: t.address || '',
      }))
    );
    showToast('success', 'Ekspor Excel Berhasil', `${filtered.length} guru diekspor.`);
  };

  return (
    <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
      <TableToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Cari nama guru, NIP, kode guru, atau email..."
        filters={
          <select
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] text-slate-700 dark:text-slate-200"
          >
            <option value="all">Semua Mata Pelajaran</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => exportTeachersPdf(filtered, schoolSettings)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Upload className="w-3.5 h-3.5" />
              Impor CSV/Excel
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Guru
            </button>
          </div>
        }
      />

      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="pt-4">
          <EmptyState
            title="Belum ada data guru"
            description="Tambahkan data guru dan tetapkan penugasan kelas serta mata pelajaran yang diampu."
            action={
              <button
                type="button"
                onClick={openAdd}
                className="px-4 py-2 rounded-lg bg-[#0F294A] text-white text-xs font-semibold"
              >
                Tambah Guru Pertama
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-3">Kode / NIP</th>
                  <th className="py-3 px-3">Nama Guru</th>
                  <th className="py-3 px-3">Penugasan Mapel & Kelas</th>
                  <th className="py-3 px-3">Email & Akun</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {paginated.map((t) => {
                  const invite = accountInvites.find((inv) => inv.email === t.email.toLowerCase());
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono-tabular text-xs">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {t.teacherCode}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">{t.nip || '-'}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {t.fullName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t.phone || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {(t.subjectNames || []).join(', ') || 'Belum ada mapel'}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                          Kelas: {(t.classNames || []).join(', ') || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <p>{t.email}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t.userId ? 'Akun Terhubung' : invite ? 'Undangan Aktif' : 'Belum Diundang'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold">
                        <span
                          className={
                            t.employmentStatus === 'inactive'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {t.employmentStatus === 'inactive' ? 'Nonaktif' : t.employmentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailTeacher(t)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Detail Guru"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleProvisionInvite(t)}
                            className="p-1.5 rounded-lg text-sky-600 dark:text-cyan-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                            title="Aktifkan / Undang Akun Portal"
                          >
                            <MailCheck className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void sendResetPassword(t.email).then(() =>
                                showToast('success', 'Reset Terkirim', `Email reset dikirim ke ${t.email}`)
                              ).catch((err) =>
                                showToast('error', 'Gagal Reset', err instanceof Error ? err.message : '')
                              )
                            }
                            className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            title="Kirim Email Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit Guru"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(t)}
                            className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Hapus Guru"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Detail Modal */}
      <ModalShell
        open={Boolean(detailTeacher)}
        onClose={() => setDetailTeacher(null)}
        title="Detail Profil Guru"
        subtitle={detailTeacher ? `Kode ${detailTeacher.teacherCode} · NIP ${detailTeacher.nip || '-'}` : ''}
      >
        {detailTeacher && (
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Nama Lengkap</p>
              <p className="font-semibold">{detailTeacher.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status Kepegawaian</p>
              <p className="font-semibold">{detailTeacher.employmentStatus}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="font-semibold">{detailTeacher.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Telepon</p>
              <p className="font-semibold">{detailTeacher.phone || '-'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Mata Pelajaran Diampu</p>
              <p className="font-semibold">{(detailTeacher.subjectNames || []).join(', ') || '-'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Kelas Penugasan</p>
              <p className="font-semibold">{(detailTeacher.classNames || []).join(', ') || '-'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Alamat</p>
              <p className="font-semibold">{detailTeacher.address || '-'}</p>
            </div>
          </div>
        )}
      </ModalShell>

      {/* Form Modal */}
      <ModalShell
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={isEditing ? 'Edit Data Guru' : 'Tambah Guru Baru'}
        subtitle="Tetapkan mata pelajaran dan kelas yang diajar untuk kontrol akses Guru."
      >
        <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Kode / ID Guru *</label>
            <input
              required
              value={form.teacherCode}
              onChange={(e) => setForm({ ...form, teacherCode: e.target.value })}
              placeholder="Misal: GR-01"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">NIP / NUPTK</label>
            <input
              value={form.nip}
              onChange={(e) => setForm({ ...form, nip: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Nama Lengkap & Gelar *</label>
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Jenis Kelamin</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Status Kepegawaian</label>
            <select
              value={form.employmentStatus}
              onChange={(e) =>
                setForm({ ...form, employmentStatus: e.target.value as EmploymentStatus })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            >
              <option value="PNS">PNS</option>
              <option value="PPPK">PPPK</option>
              <option value="GTY">GTY</option>
              <option value="Honorer">Honorer</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email Akun *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">No. Telepon</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1.5">Penugasan Mata Pelajaran</label>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto">
              {subjects.length === 0 ? (
                <p className="text-xs text-slate-400">Belum ada mata pelajaran.</p>
              ) : (
                subjects.map((sub) => (
                  <label key={sub.id} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.subjectIds.includes(sub.id)}
                      onChange={() =>
                        setForm({ ...form, subjectIds: toggleIdInList(form.subjectIds, sub.id) })
                      }
                    />
                    <span>{sub.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1.5">Penugasan Kelas Diajar</label>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto">
              {classes.length === 0 ? (
                <p className="text-xs text-slate-400">Belum ada kelas.</p>
              ) : (
                classes.map((c) => (
                  <label key={c.id} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.classIds.includes(c.id)}
                      onChange={() =>
                        setForm({ ...form, classIds: toggleIdInList(form.classIds, c.id) })
                      }
                    />
                    <span>{c.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Alamat</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Data Guru'}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
