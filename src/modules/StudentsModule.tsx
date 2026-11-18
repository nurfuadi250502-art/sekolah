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
  deleteStudent,
  makeId,
  saveStudent,
} from '../services/firestoreService';
import {
  exportStudentsPdf,
  exportToExcel,
  parseExcelOrCsvFile,
} from '../services/exportService';
import { Gender, Student, StudentStatus } from '../types/portal';

const PAGE_SIZE = 10;

const emptyForm = (): Omit<Student, 'createdAt' | 'updatedAt'> => ({
  id: '',
  userId: '',
  nis: '',
  nisn: '',
  fullName: '',
  gender: 'L',
  birthPlace: '',
  birthDate: '',
  address: '',
  phone: '',
  email: '',
  parentName: '',
  classId: '',
  className: '',
  entryYear: new Date().getFullYear(),
  status: 'active',
  photoUrl: '',
});

export function StudentsModule() {
  const { userProfile, effectiveRole, schoolSettings, sendResetPassword } = useAuth();
  const { loading, students, classes, accountInvites } = usePortalData();
  const { showToast } = useToast();

  const isAdmin = effectiveRole === 'admin';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => {
        if (classFilter !== 'all' && s.classId !== classFilter) return false;
        if (statusFilter !== 'all' && s.status !== statusFilter) return false;
        if (!q) return true;
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q) ||
          s.nisn.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, classFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAdd = () => {
    setIsEditing(false);
    setForm({ ...emptyForm(), classId: classes[0]?.id || '', className: classes[0]?.name || '' });
    setFormOpen(true);
  };

  const openEdit = (s: Student) => {
    setIsEditing(true);
    setForm({ ...s });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    if (!form.nis.trim() || !form.nisn.trim() || !form.fullName.trim() || !form.email.trim()) {
      showToast('error', 'Data belum lengkap', 'NIS, NISN, Nama Lengkap, dan Email wajib diisi.');
      return;
    }
    const cls = classes.find((c) => c.id === form.classId);
    setSaving(true);
    try {
      await saveStudent(
        {
          ...form,
          className: cls?.name || form.className || '',
          isNew: !isEditing,
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role },
        students
      );
      showToast(
        'success',
        isEditing ? 'Data Siswa Diperbarui' : 'Siswa Baru Ditambahkan',
        `${form.fullName} (NIS ${form.nis}) berhasil disimpan.`
      );
      setFormOpen(false);
    } catch (err) {
      showToast('error', 'Gagal Menyimpan Siswa', err instanceof Error ? err.message : 'Kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Student) => {
    if (!userProfile) return;
    if (!window.confirm(`Hapus permanen data siswa ${s.fullName} (NIS ${s.nis})?`)) return;
    try {
      await deleteStudent(s, {
        uid: userProfile.uid,
        name: userProfile.displayName,
        role: userProfile.role,
      });
      showToast('success', 'Data Siswa Dihapus', `${s.fullName} telah dihapus.`);
    } catch (err) {
      showToast('error', 'Gagal Menghapus', err instanceof Error ? err.message : 'Kesalahan');
    }
  };

  const handleProvisionInvite = async (s: Student) => {
    if (!userProfile) return;
    try {
      await createAccountInvite(
        {
          email: s.email,
          role: 'student',
          linkedEntityId: s.id,
          fullName: s.fullName,
          identityCode: s.nis,
          status: 'pending',
        },
        { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role }
      );
      showToast(
        'success',
        'Akun Portal Disiapkan',
        `Email ${s.email} kini diizinkan mengaktifkan Portal Siswa.`
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
      if (rows.length === 0) {
        showToast('error', 'File kosong', 'Tidak ada baris data yang terbaca.');
        return;
      }
      let imported = 0;
      let skipped = 0;
      const localList = [...students];

      for (const row of rows) {
        const nis = String(row.NIS || row.nis || '').trim();
        const nisn = String(row.NISN || row.nisn || '').trim();
        const fullName = String(row['Nama Lengkap'] || row.fullName || row.nama || '').trim();
        const email = String(row.Email || row.email || '').trim().toLowerCase();
        if (!nis || !nisn || !fullName || !email) {
          skipped++;
          continue;
        }
        const classLabel = String(row.Kelas || row.className || '').trim();
        const matchedClass =
          classes.find((c) => c.name.toLowerCase() === classLabel.toLowerCase()) || classes[0];

        try {
          const newId = makeId('stu');
          const item: Omit<Student, 'createdAt' | 'updatedAt'> = {
            id: newId,
            userId: '',
            nis,
            nisn,
            fullName,
            gender: (String(row['L/P'] || row.gender || 'L').toUpperCase() === 'P' ? 'P' : 'L') as Gender,
            birthPlace: String(row['Tempat Lahir'] || row.birthPlace || ''),
            birthDate: String(row['Tanggal Lahir'] || row.birthDate || ''),
            address: String(row.Alamat || row.address || ''),
            phone: String(row.Telepon || row.phone || ''),
            email,
            parentName: String(row['Nama Orang Tua'] || row.parentName || ''),
            classId: matchedClass?.id || 'cls_default',
            className: matchedClass?.name || classLabel || 'Belum Ditentukan',
            entryYear: Number(row['Tahun Masuk'] || row.entryYear) || new Date().getFullYear(),
            status: 'active',
            photoUrl: '',
          };
          await saveStudent(
            { ...item, isNew: true },
            { uid: userProfile.uid, name: userProfile.displayName, role: userProfile.role },
            localList
          );
          localList.push(item);
          imported++;
        } catch {
          skipped++;
        }
      }
      showToast(
        'success',
        'Impor Data Selesai',
        `${imported} siswa berhasil diimpor, ${skipped} baris dilewati (duplikat/tidak lengkap).`
      );
    } catch (err) {
      showToast('error', 'Gagal Impor File', err instanceof Error ? err.message : 'Format tidak valid');
    } finally {
      e.target.value = '';
    }
  };

  const handleExportExcel = () => {
    exportToExcel(
      `Data_Siswa_${new Date().toISOString().slice(0, 10)}`,
      'Siswa',
      filtered.map((s) => ({
        NIS: s.nis,
        NISN: s.nisn,
        'Nama Lengkap': s.fullName,
        'L/P': s.gender,
        'Tempat Lahir': s.birthPlace || '',
        'Tanggal Lahir': s.birthDate || '',
        Alamat: s.address || '',
        Telepon: s.phone || '',
        Email: s.email,
        'Nama Orang Tua': s.parentName || '',
        Kelas: s.className || s.classId,
        'Tahun Masuk': s.entryYear,
        Status: s.status,
      }))
    );
    showToast('success', 'Ekspor Excel Berhasil', `${filtered.length} baris diekspor.`);
  };

  return (
    <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
      <TableToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Cari nama siswa, NIS, NISN, atau email..."
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] text-slate-700 dark:text-slate-200"
            >
              <option value="all">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] text-slate-700 dark:text-slate-200"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="graduated">Lulus</option>
              <option value="transferred">Pindah</option>
            </select>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => exportStudentsPdf(filtered, schoolSettings)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
            {isAdmin && (
              <>
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
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
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
                  Tambah Siswa
                </button>
              </>
            )}
          </div>
        }
      />

      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="pt-4">
          <EmptyState
            title="Belum ada data siswa yang sesuai"
            description="Tambahkan data siswa baru secara manual atau impor daftar siswa dari file Excel/CSV."
            action={
              isAdmin ? (
                <button
                  type="button"
                  onClick={openAdd}
                  className="px-4 py-2 rounded-lg bg-[#0F294A] text-white text-xs font-semibold"
                >
                  Tambah Siswa Pertama
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-3">NIS / NISN</th>
                  <th className="py-3 px-3">Nama Lengkap</th>
                  <th className="py-3 px-3">Kelas</th>
                  <th className="py-3 px-3">Email & Akun</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {paginated.map((s) => {
                  const invite = accountInvites.find((inv) => inv.email === s.email.toLowerCase());
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono-tabular text-xs">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{s.nis}</p>
                        <p className="text-slate-500 dark:text-slate-400">{s.nisn}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {s.fullName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {s.gender === 'L' ? 'Laki-laki' : 'Perempuan'} · Masuk {s.entryYear}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-xs font-medium text-slate-700 dark:text-slate-200">
                        {s.className || s.classId}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <p className="text-slate-700 dark:text-slate-200">{s.email}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {s.userId
                            ? 'Akun Terhubung'
                            : invite
                              ? 'Undangan Aktif'
                              : 'Belum Diundang'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold">
                        <span
                          className={
                            s.status === 'active'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : s.status === 'inactive'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-sky-700 dark:text-cyan-400'
                          }
                        >
                          {s.status === 'active'
                            ? 'Aktif'
                            : s.status === 'inactive'
                              ? 'Nonaktif'
                              : s.status === 'graduated'
                                ? 'Lulus'
                                : 'Pindah'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailStudent(s)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Detail Siswa"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleProvisionInvite(s)}
                                className="p-1.5 rounded-lg text-sky-600 dark:text-cyan-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                                title="Aktifkan / Undang Akun Portal"
                              >
                                <MailCheck className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void sendResetPassword(s.email).then(() =>
                                    showToast('success', 'Reset Terkirim', `Email reset dikirim ke ${s.email}`)
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
                                onClick={() => openEdit(s)}
                                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Edit Siswa"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(s)}
                                className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Hapus Siswa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
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
        open={Boolean(detailStudent)}
        onClose={() => setDetailStudent(null)}
        title="Profil Detail Siswa"
        subtitle={detailStudent ? `NIS ${detailStudent.nis} · NISN ${detailStudent.nisn}` : ''}
      >
        {detailStudent && (
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Nama Lengkap</p>
              <p className="font-semibold">{detailStudent.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Jenis Kelamin</p>
              <p className="font-semibold">{detailStudent.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Tempat, Tanggal Lahir</p>
              <p className="font-semibold">
                {detailStudent.birthPlace || '-'}, {detailStudent.birthDate || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Kelas / Tahun Masuk</p>
              <p className="font-semibold">
                {detailStudent.className || detailStudent.classId} ({detailStudent.entryYear})
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Email Login</p>
              <p className="font-semibold">{detailStudent.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">No. Telepon</p>
              <p className="font-semibold">{detailStudent.phone || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Nama Orang Tua / Wali</p>
              <p className="font-semibold">{detailStudent.parentName || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Alamat</p>
              <p className="font-semibold">{detailStudent.address || '-'}</p>
            </div>
          </div>
        )}
      </ModalShell>

      {/* Create / Edit Modal */}
      <ModalShell
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={isEditing ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
        subtitle="Pastikan NIS dan NISN unik untuk setiap peserta didik."
      >
        <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">NIS *</label>
            <input
              required
              value={form.nis}
              onChange={(e) => setForm({ ...form, nis: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">NISN *</label>
            <input
              required
              value={form.nisn}
              onChange={(e) => setForm({ ...form, nisn: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Nama Lengkap *</label>
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
            <label className="block text-xs font-medium mb-1">Kelas *</label>
            <select
              required
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            >
              <option value="">Pilih Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Tempat Lahir</label>
            <input
              value={form.birthPlace}
              onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Tanggal Lahir</label>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
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
          <div>
            <label className="block text-xs font-medium mb-1">Nama Orang Tua / Wali</label>
            <input
              value={form.parentName}
              onChange={(e) => setForm({ ...form, parentName: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Tahun Masuk</label>
              <input
                type="number"
                value={form.entryYear}
                onChange={(e) => setForm({ ...form, entryYear: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
                <option value="graduated">Lulus</option>
                <option value="transferred">Pindah</option>
              </select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Alamat Lengkap</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">URL Foto Profil (opsional)</label>
            <input
              value={form.photoUrl}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              placeholder="https://..."
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
              {saving ? 'Menyimpan...' : 'Simpan Data Siswa'}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
