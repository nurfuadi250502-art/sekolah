import React, { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { HelpCircle, KeyRound, Mail, Save, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortalData } from '../contexts/PortalDataContext';
import { useToast } from '../components/ui/ToastProvider';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';

export function AccountSettingsModule() {
  const {
    userProfile,
    schoolSettings,
    changeMyPassword,
    sendResetPassword,
    refreshProfile,
  } = useAuth();
  const { currentStudent, currentTeacher } = usePortalData();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  if (!userProfile) return null;

  const canChangePhoto =
    userProfile.role !== 'student' || schoolSettings.allowStudentPhotoChange;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        displayName: displayName.trim() || userProfile.displayName,
        phone: phone.trim(),
        updatedAt: serverTimestamp(),
      };
      if (canChangePhoto) {
        updates.photoURL = photoURL.trim();
      }
      await updateDoc(doc(db, 'users', userProfile.uid), updates);

      if (userProfile.role === 'student' && currentStudent && canChangePhoto) {
        await updateDoc(doc(db, 'students', currentStudent.id), {
          photoUrl: photoURL.trim(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
      if (userProfile.role === 'teacher' && currentTeacher) {
        await updateDoc(doc(db, 'teachers', currentTeacher.id), {
          phone: phone.trim(),
          photoUrl: photoURL.trim(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      await refreshProfile();
      showToast('success', 'Profil Akun Diperbarui');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('error', 'Kata sandi baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'Konfirmasi kata sandi tidak cocok');
      return;
    }
    try {
      await changeMyPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      showToast('success', 'Kata Sandi Berhasil Diubah');
    } catch (err) {
      showToast('error', 'Gagal Mengubah Kata Sandi', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form
        onSubmit={handleSaveProfile}
        className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
      >
        <h3 className="text-sm font-bold flex items-center gap-2">
          <User className="w-4 h-4 text-sky-600" />
          Profil Pribadi Akun
        </h3>
        <div className="text-xs space-y-3">
          <div>
            <label className="block font-medium mb-1">Email Login (Terverifikasi)</label>
            <input
              disabled
              value={userProfile.email}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 opacity-75"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Nama Tampilan</label>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Nomor Telepon</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">
              URL Foto Profil {!canChangePhoto && '(Dinonaktifkan Admin)'}
            </label>
            <input
              disabled={!canChangePhoto}
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] disabled:opacity-60"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white text-xs font-semibold"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Menyimpan...' : 'Simpan Profil'}
        </button>
      </form>

      <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-sky-600" />
          Keamanan & Kata Sandi
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium mb-1">Kata Sandi Baru</label>
            <input
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Konfirmasi Kata Sandi Baru</label>
            <input
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white text-xs font-semibold"
          >
            Perbarui Kata Sandi
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Atau kirim tautan reset kata sandi terverifikasi ke email Anda:
          </p>
          <button
            type="button"
            onClick={() =>
              void sendResetPassword(userProfile.email)
                .then(() => showToast('success', 'Email Reset Terkirim'))
                .catch((err) => showToast('error', 'Gagal', err instanceof Error ? err.message : ''))
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
          >
            <Mail className="w-3.5 h-3.5" />
            Kirim Email Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}

export function HelpCenterModule() {
  const { schoolSettings } = useAuth();
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-bold flex items-center gap-2 mb-2">
          <HelpCircle className="w-5 h-5 text-sky-600" />
          Pusat Bantuan Pengguna — School Academic Portal
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Panduan penggunaan sistem manajemen akademik berdasarkan peran akses Anda.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-bold text-[#0F294A] dark:text-cyan-300">
            Panduan Administrator
          </h3>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4">
            <li>Kelola Tahun Ajaran, Semester, Kelas, dan Mata Pelajaran di menu Kelas & Jadwal.</li>
            <li>Tambah atau impor data Siswa/Guru via Excel/CSV, lalu klik ikon aktivasi akun agar mereka bisa login.</li>
            <li>Cetak Kartu Akun QR satuan atau massal di menu Kartu Akun.</li>
            <li>Pantau log audit di Log Aktivitas dan lakukan Backup JSON berkala di Pengaturan Sekolah.</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-bold text-[#0F294A] dark:text-cyan-300">
            Panduan Guru Pengajar
          </h3>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4">
            <li>Akses daftar kelas dan siswa yang ditugaskan kepada Anda pada menu Data Siswa & Kelas.</li>
            <li>Input absensi harian per kelas dan mata pelajaran; sistem mencegah duplikasi otomatis.</li>
            <li>Input nilai Tugas, Kuis, UH, PTS, PAS, dan Praktik; Nilai Akhir terhitung otomatis.</li>
            <li>Terbitkan pengumuman khusus kelas dan unduh rekap PDF/Excel.</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-bold text-[#0F294A] dark:text-cyan-300">
            Panduan Siswa
          </h3>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4">
            <li>Masuk menggunakan email yang telah didaftarkan Admin Sekolah (Google Sign-In atau aktivasi email).</li>
            <li>Pantau jadwal pelajaran mingguan dan riwayat kehadiran Anda secara real-time.</li>
            <li>Lihat rincian nilai per mata pelajaran dan unduh rapor PDF jika diizinkan sekolah.</li>
            <li>Jika mengalami kendala akun, hubungi Admin ({schoolSettings.email}).</li>
          </ul>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-slate-900 dark:text-white">
            Catatan Konfigurasi Login Email/Password di Firebase Console
          </p>
          <p className="mt-1">
            Login Google aktif secara bawaan. Jika sekolah ingin menggunakan login Email & Kata Sandi manual selain Google Sign-In, pastikan provider <strong>Email/Password</strong> sudah diaktifkan pada menu <em>Authentication → Sign-in method</em> di Firebase Console proyek Anda.
          </p>
        </div>
      </div>
    </div>
  );
}
