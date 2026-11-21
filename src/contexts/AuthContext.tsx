import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, db, googleProvider } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { logActivity } from '../services/firestoreService';
import {
  AccountInvite,
  DEFAULT_SCHOOL_SETTINGS,
  normalizeGradeWeights,
  SchoolSettings,
  UserProfile,
  UserRole,
} from '../types/portal';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  effectiveRole: UserRole | null;
  setPreviewRole: (role: UserRole | null) => void;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  schoolSettings: SchoolSettings;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  loginWithGoogle: (expectedRole?: UserRole) => Promise<UserProfile | null>;
  loginWithEmail: (email: string, password: string, expectedRole?: UserRole) => Promise<UserProfile | null>;
  activateEmailAccount: (email: string, password: string, fullName?: string) => Promise<UserProfile | null>;
  sendResetPassword: (email: string) => Promise<void>;
  changeMyPassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapFirebaseAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return 'Provider Email/Password belum diaktifkan di Firebase Console. Gunakan Login Google atau aktifkan Email/Password pada menu Authentication > Sign-in method di Firebase Console.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email atau kata sandi tidak sesuai.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Email ini sudah memiliki akun aktif. Silakan masuk menggunakan tab Login.';
  }
  if (code === 'auth/weak-password') {
    return 'Kata sandi minimal 6 karakter.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Jendela masuk Google ditutup sebelum proses selesai.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Demi keamanan, silakan keluar dan masuk kembali sebelum mengubah kata sandi.';
  }
  return error instanceof Error ? error.message : 'Terjadi kesalahan autentikasi.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(
    DEFAULT_SCHOOL_SETTINGS as SchoolSettings
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('portal_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('portal_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Listen to public school_settings/main
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'school_settings', 'main'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SchoolSettings;
          setSchoolSettings({
            ...DEFAULT_SCHOOL_SETTINGS,
            ...data,
            gradeWeights: normalizeGradeWeights(data.gradeWeights),
          } as SchoolSettings);
        }
      },
      (error) => {
        console.warn('Gagal memantau pengaturan sekolah:', error);
      }
    );
    return () => unsub();
  }, []);

  const resolveOrProvisionProfile = useCallback(
    async (user: User, expectedRole?: UserRole): Promise<UserProfile | null> => {
      const emailLower = (user.email || '').toLowerCase();
      if (!emailLower) {
        throw new Error('Akun tidak memiliki alamat email yang valid.');
      }
      if (!user.emailVerified) {
        await sendEmailVerification(user).catch(() => {});
        await signOut(auth);
        throw new Error(
          'Email Anda belum terverifikasi. Kami telah mengirim tautan verifikasi ke email Anda. Silakan verifikasi terlebih dahulu lalu masuk kembali.'
        );
      }

      const userRef = doc(db, 'users', user.uid);
      let userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const isBootstrap = emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
        if (isBootstrap) {
          const adminProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
            uid: user.uid,
            email: emailLower,
            displayName: user.displayName || 'Administrator Sekolah',
            role: 'admin',
            photoURL: user.photoURL || '',
            isActive: true,
            linkedEntityId: '',
            phone: '',
          };
          await setDoc(userRef, {
            ...adminProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'admins', user.uid), {
            uid: user.uid,
            email: emailLower,
            grantedAt: serverTimestamp(),
          });
          userSnap = await getDoc(userRef);
        } else {
          // Check invite created by Admin
          const inviteRef = doc(db, 'account_invites', emailLower);
          const inviteSnap = await getDoc(inviteRef);
          if (!inviteSnap.exists()) {
            await signOut(auth);
            throw new Error(
              `Email ${emailLower} belum didaftarkan oleh Admin Sekolah. Hubungi Administrator untuk mendaftarkan akun Guru atau Siswa Anda.`
            );
          }
          const invite = inviteSnap.data() as AccountInvite;
          if (invite.status === 'revoked') {
            await signOut(auth);
            throw new Error('Undangan akun Anda telah dicabut oleh Administrator.');
          }

          const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
            uid: user.uid,
            email: emailLower,
            displayName: invite.fullName || user.displayName || emailLower,
            role: invite.role,
            photoURL: user.photoURL || '',
            isActive: true,
            linkedEntityId: invite.linkedEntityId,
            phone: '',
          };

          await setDoc(userRef, {
            ...newProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          if (invite.status === 'pending') {
            await updateDoc(inviteRef, {
              status: 'activated',
              updatedAt: serverTimestamp(),
            });
          }

          const targetCol = invite.role === 'teacher' ? 'teachers' : 'students';
          await updateDoc(doc(db, targetCol, invite.linkedEntityId), {
            userId: user.uid,
            updatedAt: serverTimestamp(),
          }).catch(() => {});

          userSnap = await getDoc(userRef);
        }
      }

      const profile = userSnap.data() as UserProfile;

      if (!profile.isActive) {
        await signOut(auth);
        throw new Error('Akun Anda dinonaktifkan. Hubungi Administrator Sekolah.');
      }

      if (expectedRole && profile.role !== expectedRole) {
        const roleLabel =
          profile.role === 'admin' ? 'Admin' : profile.role === 'teacher' ? 'Guru' : 'Siswa';
        const expectedLabel =
          expectedRole === 'admin' ? 'Admin' : expectedRole === 'teacher' ? 'Guru' : 'Siswa';
        await signOut(auth);
        throw new Error(
          `Akses ditolak pada portal ${expectedLabel}. Akun Anda terdaftar dengan peran ${roleLabel}. Silakan pilih tab login ${roleLabel}.`
        );
      }

      setUserProfile(profile);
      return profile;
    },
    []
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserProfile(null);
        setPreviewRole(null);
        setAuthLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const p = snap.data() as UserProfile;
          if (p.isActive) {
            setUserProfile(p);
          } else {
            await signOut(auth);
            setUserProfile(null);
          }
        } else if (
          user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
          user.emailVerified
        ) {
          await resolveOrProvisionProfile(user);
        } else {
          // Wait for explicit login/activation flow
          setUserProfile(null);
        }
      } catch (err) {
        console.warn('Error hydrating auth state:', err);
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, [resolveOrProvisionProfile]);

  const loginWithGoogle = useCallback(
    async (expectedRole?: UserRole): Promise<UserProfile | null> => {
      setAuthError(null);
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        const profile = await resolveOrProvisionProfile(cred.user, expectedRole);
        if (profile) {
          await logActivity({
            userId: profile.uid,
            userName: profile.displayName,
            userRole: profile.role,
            actionType: 'LOGIN_GOOGLE',
            targetObject: `Portal ${profile.role.toUpperCase()}`,
          });
        }
        return profile;
      } catch (err) {
        const msg = mapFirebaseAuthError(err);
        setAuthError(msg);
        return null;
      }
    },
    [resolveOrProvisionProfile]
  );

  const loginWithEmail = useCallback(
    async (
      email: string,
      password: string,
      expectedRole?: UserRole
    ): Promise<UserProfile | null> => {
      setAuthError(null);
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const profile = await resolveOrProvisionProfile(cred.user, expectedRole);
        if (profile) {
          await logActivity({
            userId: profile.uid,
            userName: profile.displayName,
            userRole: profile.role,
            actionType: 'LOGIN_EMAIL',
            targetObject: `Portal ${profile.role.toUpperCase()}`,
          });
        }
        return profile;
      } catch (err) {
        const msg = mapFirebaseAuthError(err);
        setAuthError(msg);
        return null;
      }
    },
    [resolveOrProvisionProfile]
  );

  const activateEmailAccount = useCallback(
    async (email: string, password: string, fullName?: string): Promise<UserProfile | null> => {
      setAuthError(null);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (fullName) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
        await sendEmailVerification(cred.user);
        await signOut(auth);
        return null;
      } catch (err) {
        const msg = mapFirebaseAuthError(err);
        setAuthError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  const sendResetPassword = useCallback(async (email: string): Promise<void> => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const changeMyPassword = useCallback(async (newPassword: string): Promise<void> => {
    if (!auth.currentUser) throw new Error('Pengguna belum masuk.');
    try {
      await updatePassword(auth.currentUser, newPassword);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    if (userProfile) {
      await logActivity({
        userId: userProfile.uid,
        userName: userProfile.displayName,
        userRole: userProfile.role,
        actionType: 'LOGOUT',
        targetObject: 'Sesi Portal',
      });
    }
    setPreviewRole(null);
    setUserProfile(null);
    await signOut(auth);
  }, [userProfile]);

  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!auth.currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${auth.currentUser.uid}`);
    }
  }, []);

  const effectiveRole: UserRole | null =
    userProfile?.role === 'admin' && previewRole ? previewRole : userProfile?.role || null;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        effectiveRole,
        setPreviewRole,
        authLoading,
        authError,
        clearAuthError: () => setAuthError(null),
        schoolSettings,
        theme,
        toggleTheme,
        loginWithGoogle,
        loginWithEmail,
        activateEmailAccount,
        sendResetPassword,
        changeMyPassword,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
