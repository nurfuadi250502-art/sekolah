import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LanguageSwitcher, useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/ui/ToastProvider';
import { UserRole } from '../types/portal';

type AuthMode = 'login' | 'activate' | 'reset';

export function LoginPage({
  initialRole = 'admin',
  onBackHome,
}: {
  initialRole?: UserRole;
  onBackHome: () => void;
}) {
  const {
    schoolSettings,
    theme,
    toggleTheme,
    loginWithGoogle,
    loginWithEmail,
    activateEmailAccount,
    sendResetPassword,
    authError,
    clearAuthError,
  } = useAuth();
  const { showToast } = useToast();
  const { t, isRtl } = useLanguage();

  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);

  const roleInfo = {
    admin: {
      title: t('portalAdminTitle'),
      desc: t('portalAdminDesc'),
      icon: ShieldCheck,
    },
    teacher: {
      title: t('portalTeacherTitle'),
      desc: t('portalTeacherDesc'),
      icon: BookOpenCheck,
    },
    student: {
      title: t('portalStudentTitle'),
      desc: t('portalStudentDesc'),
      icon: GraduationCap,
    },
  }[selectedRole];

  const handleGoogleLogin = async () => {
    setBusy(true);
    clearAuthError();
    try {
      const profile = await loginWithGoogle(selectedRole);
      if (profile) {
        showToast('success', 'Berhasil Masuk', `Selamat datang, ${profile.displayName}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('error', 'Email wajib diisi');
      return;
    }
    setBusy(true);
    clearAuthError();
    try {
      if (authMode === 'login') {
        const profile = await loginWithEmail(email, password, selectedRole);
        if (profile) {
          showToast('success', 'Berhasil Masuk', `Selamat datang, ${profile.displayName}`);
        }
      } else if (authMode === 'activate') {
        if (password.length < 6) {
          showToast('error', 'Kata sandi minimal 6 karakter');
          return;
        }
        await activateEmailAccount(email, password, fullName);
        showToast(
          'success',
          'Email Verifikasi Terkirim',
          'Silakan buka kotak masuk email Anda dan klik tautan verifikasi sebelum login.'
        );
        setAuthMode('login');
      } else {
        await sendResetPassword(email);
        showToast(
          'success',
          'Tautan Reset Password Terkirim',
          'Periksa email Anda untuk mengatur ulang kata sandi secara aman.'
        );
        setAuthMode('login');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses permintaan.';
      showToast('error', 'Autentikasi Gagal', msg);
    } finally {
      setBusy(false);
    }
  };

  const ActiveRoleIcon = roleInfo.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#091322] flex flex-col">
      {/* Minimal Header */}
      <header className="px-4 sm:px-8 h-16 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B172A]">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#0F294A] dark:hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
          {t('backToHome')}
        </button>
        <div className="flex items-center gap-2.5">
          <LanguageSwitcher variant="light" />
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Ubah tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-4xl w-full grid lg:grid-cols-12 bg-white dark:bg-[#0F1E33] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Left Navy Panel */}
          <div className="lg:col-span-5 bg-[#0F294A] text-white p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-8">
                <img
                  src={
                    !schoolSettings.logoUrl ||
                    schoolSettings.logoUrl === '/src/assets/images/school_crest_logo_1795012759504.jpg'
                      ? '/assets/aistudio/logo_pondok_7b601747.png'
                      : schoolSettings.logoUrl
                  }
                  alt={schoolSettings.schoolName}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-lg object-contain bg-white/95 p-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm leading-tight truncate">
                    {schoolSettings.schoolName}
                  </p>
                  <p className="text-xs text-cyan-300">School Academic Portal</p>
                </div>
              </div>

              <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-cyan-300 mb-4">
                <ActiveRoleIcon className="w-6 h-6" />
              </div>
              <h1 className="font-display text-2xl font-bold leading-snug mb-2">
                {roleInfo.title}
              </h1>
              <p className="text-sm text-slate-200 leading-relaxed">{roleInfo.desc}</p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/15 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-white">{t('guideTitle')}</p>
              <p>{t('guideDesc')}</p>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lg:col-span-7 p-6 sm:p-10">
            {/* 3 Role Tabs */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                {t('selectAccessRole')}
              </p>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                {(
                  [
                    { id: 'admin', label: t('tabLoginAdmin') },
                    { id: 'teacher', label: t('tabLoginTeacher') },
                    { id: 'student', label: t('tabLoginStudent') },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedRole(tab.id);
                      clearAuthError();
                    }}
                    className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                      selectedRole === tab.id
                        ? 'bg-[#0F294A] text-white dark:bg-sky-600 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {authError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                {authError}
              </div>
            )}

            {/* Google Sign-In Primary Button */}
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#162742] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              {busy
                ? '...'
                : `${t('googleSignIn')} (${
                    selectedRole === 'admin'
                      ? t('roleAdmin')
                      : selectedRole === 'teacher'
                        ? t('roleTeacher')
                        : t('roleStudent')
                  })`}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span>{t('orWithEmail')}</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Mode Switch */}
            <div className="flex items-center gap-4 text-xs font-medium mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={
                  authMode === 'login'
                    ? 'text-sky-700 dark:text-cyan-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }
              >
                {t('modeLogin')}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('activate')}
                className={
                  authMode === 'activate'
                    ? 'text-sky-700 dark:text-cyan-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }
              >
                {t('modeActivate')}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('reset')}
                className={
                  authMode === 'reset'
                    ? 'text-sky-700 dark:text-cyan-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }
              >
                {t('modeReset')}
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {authMode === 'activate' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('fullNameLabel')}
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sesuai data yang didaftarkan sekolah"
                      className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('emailLabel')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@sekolah.sch.id"
                    className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>
              </div>

              {authMode !== 'reset' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {authMode === 'activate' ? t('newPasswordLabel') : t('passwordLabel')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#162742] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0F294A] hover:bg-[#173B69] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                {authMode === 'login'
                  ? t('btnDashboardLogin')
                  : authMode === 'activate'
                    ? t('btnActivateSend')
                    : t('btnResetSend')}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
