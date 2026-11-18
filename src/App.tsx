import React, { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/ToastProvider';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PortalDataProvider } from './contexts/PortalDataContext';
import { PortalLayout } from './components/layout/PortalLayout';
import { PublicPortalPage } from './pages/PublicPortalPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardModule } from './modules/DashboardModule';
import { StudentsModule } from './modules/StudentsModule';
import { TeachersModule } from './modules/TeachersModule';
import { AcademicsModule } from './modules/AcademicsModule';
import { AttendanceModule } from './modules/AttendanceModule';
import { GradesModule } from './modules/GradesModule';
import { AnnouncementsModule } from './modules/AnnouncementsModule';
import { AccountCardsModule } from './modules/AccountCardsModule';
import { ActivityLogsModule } from './modules/ActivityLogsModule';
import { SchoolSettingsModule } from './modules/SchoolSettingsModule';
import { AccountSettingsModule, HelpCenterModule } from './modules/AccountAndHelpModule';
import { NavTabId, UserRole } from './types/portal';

function PortalRouter() {
  const { userProfile, effectiveRole, authLoading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [loginRole, setLoginRole] = useState<UserRole>('admin');
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#091322]">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-2 border-[#0F294A] border-t-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Memuat School Academic Portal...
          </p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    if (showLogin) {
      return (
        <LoginPage
          initialRole={loginRole}
          onBackHome={() => setShowLogin(false)}
        />
      );
    }
    return (
      <PublicPortalPage
        onOpenLogin={(role) => {
          if (role) setLoginRole(role);
          setShowLogin(true);
        }}
      />
    );
  }

  const role = effectiveRole || userProfile.role;

  const renderModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardModule onNavigate={setActiveTab} />;
      case 'students':
        return role === 'admin' || role === 'teacher' ? (
          <StudentsModule />
        ) : (
          <DashboardModule onNavigate={setActiveTab} />
        );
      case 'teachers':
        return role === 'admin' ? (
          <TeachersModule />
        ) : (
          <DashboardModule onNavigate={setActiveTab} />
        );
      case 'academics':
        return <AcademicsModule />;
      case 'attendance':
        return <AttendanceModule />;
      case 'grades':
        return <GradesModule />;
      case 'announcements':
        return <AnnouncementsModule />;
      case 'cards':
        return role === 'admin' ? (
          <AccountCardsModule />
        ) : (
          <DashboardModule onNavigate={setActiveTab} />
        );
      case 'logs':
        return role === 'admin' ? (
          <ActivityLogsModule />
        ) : (
          <DashboardModule onNavigate={setActiveTab} />
        );
      case 'settings':
        return role === 'admin' ? (
          <SchoolSettingsModule />
        ) : (
          <DashboardModule onNavigate={setActiveTab} />
        );
      case 'account':
        return <AccountSettingsModule />;
      case 'help':
        return <HelpCenterModule />;
      default:
        return <DashboardModule onNavigate={setActiveTab} />;
    }
  };

  return (
    <PortalDataProvider>
      <PortalLayout activeTab={activeTab} onSelectTab={setActiveTab}>
        {renderModule()}
      </PortalLayout>
    </PortalDataProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <PortalRouter />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
