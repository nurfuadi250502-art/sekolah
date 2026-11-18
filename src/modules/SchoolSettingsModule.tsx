import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  Code2,
  Copy,
  DatabaseBackup,
  Download,
  ExternalLink,
  Globe,
  KeyRound,
  RefreshCw,
  Save,
  Shield,
  Upload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePortalData } from '../contexts/PortalDataContext';
import { useToast } from '../components/ui/ToastProvider';
import {
  exportPortalBackup,
  restorePortalBackup,
  saveSchoolSettings,
  updateUserAccess,
} from '../services/firestoreService';
import {
  buildWordPressIframeEmbed,
  buildWordPressShortcodeSnippet,
  fetchWordPressCategories,
  fetchWordPressPosts,
  getWordPressPublishStatus,
  testWordPressConnection,
  WordPressConnectionResult,
  WordPressPublishStatus,
} from '../services/wordpressService';
import {
  SchoolSettings,
  UserRole,
  WordPressCategory,
  WordPressPost,
} from '../types/portal';

export function SchoolSettingsModule() {
  const { userProfile, schoolSettings, sendResetPassword } = useAuth();
  const { users, accountInvites } = usePortalData();
  const { showToast } = useToast();
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'profile' | 'wordpress' | 'access' | 'backup'>('profile');
  const [form, setForm] = useState<Omit<SchoolSettings, 'updatedAt'>>(schoolSettings);
  const [saving, setSaving] = useState(false);

  // WordPress integration state
  const [wpTesting, setWpTesting] = useState(false);
  const [wpConnInfo, setWpConnInfo] = useState<WordPressConnectionResult | null>(null);
  const [wpCategories, setWpCategories] = useState<WordPressCategory[]>([]);
  const [wpPreviewPosts, setWpPreviewPosts] = useState<WordPressPost[]>([]);
  const [wpPublishStatus, setWpPublishStatus] = useState<WordPressPublishStatus>({
    configured: false,
    hasEnvSiteUrl: false,
    maskedUsername: '',
  });
  const [copiedKey, setCopiedKey] = useState<'iframe' | 'php' | null>(null);

  useEffect(() => {
    setForm(schoolSettings);
  }, [schoolSettings]);

  useEffect(() => {
    if (tab !== 'wordpress') return;
    let active = true;
    void getWordPressPublishStatus().then((status) => {
      if (active) setWpPublishStatus(status);
    });
    if (schoolSettings.wpSiteUrl) {
      void Promise.all([
        fetchWordPressCategories(schoolSettings.wpSiteUrl).catch(() => []),
        fetchWordPressPosts(schoolSettings.wpSiteUrl, {
          categoryId: schoolSettings.wpCategoryId,
          perPage: 3,
        }).catch(() => []),
      ]).then(([cats, posts]) => {
        if (!active) return;
        setWpCategories(cats);
        setWpPreviewPosts(posts);
      });
    }
    return () => {
      active = false;
    };
  }, [tab, schoolSettings.wpSiteUrl, schoolSettings.wpCategoryId]);

  const handleTestWordPress = async () => {
    if (!form.wpSiteUrl?.trim()) {
      showToast('error', 'Masukkan URL Situs WordPress terlebih dahulu');
      return;
    }
    setWpTesting(true);
    setWpConnInfo(null);
    try {
      const info = await testWordPressConnection(form.wpSiteUrl);
      setWpConnInfo(info);
      if (info.siteUrl) {
        setForm((prev) => ({ ...prev, wpSiteUrl: info.siteUrl }));
      }
      const [cats, posts] = await Promise.all([
        fetchWordPressCategories(info.siteUrl || form.wpSiteUrl).catch(() => []),
        fetchWordPressPosts(info.siteUrl || form.wpSiteUrl, {
          categoryId: form.wpCategoryId,
          perPage: 3,
        }).catch(() => []),
      ]);
      setWpCategories(cats);
      setWpPreviewPosts(posts);
      showToast(
        'success',
        'Terhubung ke WordPress',
        `${info.siteName || 'Situs WordPress'} (${info.totalPosts ?? 0} artikel terdeteksi)`
      );
    } catch (err) {
      showToast(
        'error',
        'Koneksi WordPress Gagal',
        err instanceof Error ? err.message : 'Pastikan URL benar dan REST API aktif.'
      );
    } finally {
      setWpTesting(false);
    }
  };

  const handleCopySnippet = async (key: 'iframe' | 'php', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showToast('success', 'Kode berhasil disalin ke clipboard');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      showToast('error', 'Gagal menyalin kode');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setSaving(true);
    try {
      await saveSchoolSettings(form, {
        uid: userProfile.uid,
        name: userProfile.displayName,
        role: userProfile.role,
      });
      showToast('success', 'Profil Sekolah Diperbarui');
    } catch (err) {
      showToast('error', 'Gagal Menyimpan', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const handleBackupDownload = async () => {
    if (!userProfile) return;
    try {
      const backup = await exportPortalBackup({
        uid: userProfile.uid,
        name: userProfile.displayName,
        role: userProfile.role,
      });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_Portal_Akademik_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Backup Database Diunduh');
    } catch (err) {
      showToast('error', 'Gagal Backup', err instanceof Error ? err.message : '');
    }
  };

  const handleRestoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, Record<string, unknown>[]>;
      const count = await restorePortalBackup(parsed, {
        uid: userProfile.uid,
        name: userProfile.displayName,
        role: userProfile.role,
      });
      showToast('success', 'Pemulihan Database Selesai', `${count} dokumen berhasil dipulihkan.`);
    } catch (err) {
      showToast('error', 'Gagal Memulihkan Backup', err instanceof Error ? err.message : '');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('profile')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold ${
            tab === 'profile'
              ? 'bg-[#0F294A] text-white dark:bg-sky-600'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          Profil & Identitas Sekolah
        </button>
        <button
          type="button"
          onClick={() => setTab('wordpress')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold ${
            tab === 'wordpress'
              ? 'bg-[#0F294A] text-white dark:bg-sky-600'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          Integrasi WordPress
        </button>
        <button
          type="button"
          onClick={() => setTab('access')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold ${
            tab === 'access'
              ? 'bg-[#0F294A] text-white dark:bg-sky-600'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          Hak Akses Pengguna ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('backup')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold ${
            tab === 'backup'
              ? 'bg-[#0F294A] text-white dark:bg-sky-600'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          Backup & Pemulihan Data
        </button>
      </div>

      {/* PROFILE SEKOLAH */}
      {tab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <Building2 className="w-4 h-4 text-sky-600" />
            Identitas & Pengaturan Umum Sekolah
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium mb-1">Nama Sekolah *</label>
              <input
                required
                value={form.schoolName}
                onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">URL Logo Sekolah</label>
              <input
                value={form.logoUrl || ''}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Tagline / Motto</label>
              <input
                value={form.tagline || ''}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Nama Kepala Sekolah</label>
              <input
                value={form.principalName || ''}
                onChange={(e) => setForm({ ...form, principalName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Judul Sambutan Beranda</label>
              <input
                value={form.welcomeTitle || ''}
                onChange={(e) => setForm({ ...form, welcomeTitle: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Sambutan Singkat *</label>
              <textarea
                required
                rows={3}
                value={form.welcomeMessage}
                onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">NPSN</label>
              <input
                value={form.npsn || ''}
                onChange={(e) => setForm({ ...form, npsn: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Akreditasi</label>
              <input
                value={form.accreditation || ''}
                onChange={(e) => setForm({ ...form, accreditation: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Telepon Sekolah *</label>
              <input
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Email Resmi Sekolah *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">Alamat Lengkap Sekolah *</label>
              <input
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
            <p className="font-bold text-slate-900 dark:text-white">Kebijakan Fitur Siswa</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowStudentReportDownload}
                onChange={(e) => setForm({ ...form, allowStudentReportDownload: e.target.checked })}
              />
              <span>Izinkan siswa mengunduh laporan hasil belajar (PDF/Excel)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowStudentPhotoChange}
                onChange={(e) => setForm({ ...form, allowStudentPhotoChange: e.target.checked })}
              />
              <span>Izinkan siswa mengubah foto profil akunnya</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan Sekolah'}
            </button>
          </div>
        </form>
      )}

      {/* WORDPRESS INTEGRATION */}
      {tab === 'wordpress' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveProfile}
            className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                  Koneksi Website WordPress Sekolah (WP REST API)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Hubungkan situs WordPress sekolah untuk menampilkan berita & artikel secara langsung di beranda portal dan modul pengumuman.
                </p>
              </div>
              {wpConnInfo?.ok && (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Terhubung: {wpConnInfo.siteName}
                </span>
              )}
            </div>

            <div className="grid sm:grid-cols-12 gap-4 text-xs">
              <div className="sm:col-span-8">
                <label className="block font-medium mb-1">URL Situs WordPress Sekolah</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={form.wpSiteUrl || ''}
                    onChange={(e) => setForm({ ...form, wpSiteUrl: e.target.value })}
                    placeholder="https://website-sekolah.sch.id"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleTestWordPress()}
                    disabled={wpTesting}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${wpTesting ? 'animate-spin' : ''}`} />
                    {wpTesting ? 'Menguji...' : 'Uji Koneksi'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Pastikan di dashboard WordPress Anda, menu <strong>Settings → Permalinks</strong> sudah disetel ke <strong>Post name</strong> agar REST API (<code>/wp-json/wp/v2/posts</code>) aktif.
                </p>
              </div>

              <div className="sm:col-span-4">
                <label className="block font-medium mb-1">Filter Kategori Artikel</label>
                <select
                  value={form.wpCategoryId || ''}
                  onChange={(e) => setForm({ ...form, wpCategoryId: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                >
                  <option value="">Semua Kategori Berita</option>
                  {wpCategories.map((cat) => (
                    <option key={cat.id} value={String(cat.id)}>
                      {cat.name} ({cat.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.wpSyncEnabled)}
                  onChange={(e) => setForm({ ...form, wpSyncEnabled: e.target.checked })}
                />
                <span>Aktifkan sinkronisasi artikel dari WordPress ke Portal Akademik</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.wpShowOnPublicHome !== false}
                  onChange={(e) => setForm({ ...form, wpShowOnPublicHome: e.target.checked })}
                />
                <span>Tampilkan berita terbaru WordPress di Halaman Utama Publik Portal</span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 text-white text-xs font-semibold"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan WordPress'}
              </button>
            </div>
          </form>

          {/* Preview of synced WordPress posts */}
          {wpPreviewPosts.length > 0 && (
            <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold">Pratinjau Artikel dari WordPress</h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Menampilkan {wpPreviewPosts.length} artikel terbaru
                </span>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {wpPreviewPosts.map((post) => (
                  <div
                    key={post.id}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                        {post.date} · {post.authorName}
                      </p>
                      <h5 className="text-sm font-bold text-slate-900 dark:text-white mt-1 line-clamp-2">
                        {post.title}
                      </h5>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-3">
                        {post.excerpt}
                      </p>
                    </div>
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-cyan-400 hover:underline"
                    >
                      Buka di WordPress
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Server-side Publishing Status */}
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                Publikasi Pengumuman Portal ke WordPress (Dua Arah)
              </h4>
              <span
                className={`text-xs font-semibold ${
                  wpPublishStatus.configured
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {wpPublishStatus.configured
                  ? `Aktif (Akun: ${wpPublishStatus.maskedUsername})`
                  : 'Mode Baca Saja (Kredensial Server Belum Diisi)'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Untuk mengirim pengumuman dari Portal langsung menjadi artikel WordPress, buat <strong>Application Password</strong> di dashboard WordPress (<em>Users → Profile → Application Passwords</em>), lalu simpan variabel server berikut di menu <strong>Secrets</strong>:
            </p>
            <div className="grid sm:grid-cols-3 gap-2 text-xs font-mono bg-slate-50 dark:bg-[#162742] border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div>
                <span className="text-slate-500">WP_USERNAME</span>
                <p className="text-slate-800 dark:text-slate-200">username_admin_wp</p>
              </div>
              <div>
                <span className="text-slate-500">WP_APP_PASSWORD</span>
                <p className="text-slate-800 dark:text-slate-200">xxxx xxxx xxxx xxxx</p>
              </div>
              <div>
                <span className="text-slate-500">WP_SITE_URL (opsional)</span>
                <p className="text-slate-800 dark:text-slate-200">https://sekolah.sch.id</p>
              </div>
            </div>
          </div>

          {/* Embed Portal inside WordPress */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                  Sematkan Portal di Halaman WordPress (HTML Block)
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopySnippet(
                      'iframe',
                      buildWordPressIframeEmbed(window.location.origin)
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {copiedKey === 'iframe' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedKey === 'iframe' ? 'Disalin' : 'Salin HTML'}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tambahkan blok <strong>Custom HTML</strong> di editor Gutenberg / Elementor WordPress, lalu tempel kode ini agar portal tampil langsung di website sekolah Anda.
              </p>
              <pre className="text-[11px] font-mono bg-slate-950 text-slate-100 rounded-lg p-3 overflow-x-auto leading-relaxed">
                {buildWordPressIframeEmbed(window.location.origin)}
              </pre>
            </div>

            <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                  Shortcode WordPress (functions.php / Code Snippets)
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopySnippet(
                      'php',
                      buildWordPressShortcodeSnippet(window.location.origin)
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {copiedKey === 'php' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedKey === 'php' ? 'Disalin' : 'Salin PHP'}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Menyediakan shortcode <code>[school_academic_portal]</code> dan{' '}
                <code>[school_portal_announcements]</code> yang menarik pengumuman terbaru secara otomatis via API JSON portal.
              </p>
              <pre className="text-[11px] font-mono bg-slate-950 text-slate-100 rounded-lg p-3 overflow-x-auto max-h-56 leading-relaxed">
                {buildWordPressShortcodeSnippet(window.location.origin)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ACCESS MANAGEMENT */}
      {tab === 'access' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-sky-600" />
              Daftar Akun Teraktivasi & Kontrol Hak Akses
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2.5 px-3">Pengguna</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Peran</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi Keamanan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-3 px-3 font-semibold">{u.displayName}</td>
                      <td className="py-3 px-3">{u.email}</td>
                      <td className="py-3 px-3">
                        <select
                          disabled={u.uid === userProfile?.uid}
                          value={u.role}
                          onChange={(e) =>
                            userProfile &&
                            void updateUserAccess(
                              u,
                              { role: e.target.value as UserRole },
                              {
                                uid: userProfile.uid,
                                name: userProfile.displayName,
                                role: userProfile.role,
                              }
                            ).then(() => showToast('success', 'Peran Pengguna Diubah'))
                          }
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742]"
                        >
                          <option value="admin">Admin</option>
                          <option value="teacher">Guru</option>
                          <option value="student">Siswa</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        <span className={u.isActive ? 'text-emerald-600' : 'text-rose-600'}>
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            void sendResetPassword(u.email)
                              .then(() => showToast('success', 'Email reset password dikirim'))
                              .catch((err) =>
                                showToast('error', 'Gagal', err instanceof Error ? err.message : '')
                              )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <KeyRound className="w-3 h-3" />
                          Reset Password
                        </button>
                        {u.uid !== userProfile?.uid && (
                          <button
                            type="button"
                            onClick={() =>
                              userProfile &&
                              void updateUserAccess(
                                u,
                                { isActive: !u.isActive },
                                {
                                  uid: userProfile.uid,
                                  name: userProfile.displayName,
                                  role: userProfile.role,
                                }
                              ).then(() => showToast('success', 'Status Akun Diperbarui'))
                            }
                            className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
            <h3 className="text-sm font-bold mb-3">
              Daftar Undangan Aktivasi Akun ({accountInvites.length})
            </h3>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {accountInvites.length === 0 ? (
                <p className="py-4 text-slate-500">
                  Belum ada undangan akun. Gunakan tombol aktivasi akun pada modul Data Siswa atau Data Guru.
                </p>
              ) : (
                accountInvites.map((inv) => (
                  <div key={inv.email} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {inv.fullName} ({inv.email})
                      </p>
                      <p className="text-slate-500">
                        Peran: {inv.role} · ID Entitas: {inv.linkedEntityId}
                      </p>
                    </div>
                    <span className="font-semibold uppercase text-sky-700 dark:text-cyan-400">
                      {inv.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* BACKUP & RESTORE */}
      {tab === 'backup' && (
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <DatabaseBackup className="w-6 h-6 text-sky-600" />
            <h3 className="text-sm font-bold">Ekspor Backup Database (JSON)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Unduh seluruh data akademik (siswa, guru, kelas, mapel, jadwal, nilai, absensi, dan pengumuman) sebagai cadangan terstruktur.
            </p>
            <button
              type="button"
              onClick={() => void handleBackupDownload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F294A] dark:bg-sky-600 text-white text-xs font-semibold"
            >
              <Download className="w-4 h-4" />
              Unduh Backup JSON
            </button>
          </div>

          <div className="bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <Upload className="w-6 h-6 text-amber-600" />
            <h3 className="text-sm font-bold">Pemulihan Data (Restore JSON)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Unggah file backup JSON resmi yang pernah diunduh dari portal untuk memulihkan koleksi data akademik ke Cloud Firestore.
            </p>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json"
              onChange={handleRestoreUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Upload className="w-4 h-4" />
              Pilih File Backup (.json)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
