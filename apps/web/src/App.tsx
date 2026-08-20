import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardPage } from './pages/DashboardPage';
import { CandidateFormPage } from './pages/CandidateFormPage';
import { CandidateEditPage } from './pages/CandidateEditPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { AuthPage } from './pages/AuthPage';
import { UserGuidePage } from './pages/UserGuidePage';
import { JobsPage } from './pages/JobsPage';
import { JobDealPage } from './pages/JobDealPage';
import { useTheme } from './theme';
import { AppSidebar } from './components/AppSidebar';
import { fetchCurrentUser } from './api/users';
import { getAuthToken, setAuthToken } from './api/client';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:jobId" element={<JobDealPage />} />
        <Route path="/candidates/new" element={<CandidateFormPage />} />
        <Route path="/candidates/:candidateId/edit" element={<CandidateEditPage />} />
        <Route path="/settings" element={<AccountSettingsPage />} />
        <Route path="/guide" element={<UserGuidePage />} />
      </Route>
    </Routes>
  );
}

function ProtectedLayout() {
  const [theme, toggleTheme] = useTheme();
  const token = getAuthToken();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchCurrentUser,
    enabled: Boolean(token),
    retry: false,
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return <p className="p-8 text-center text-sm text-ink-3">Loading account…</p>;
  }

  if (!data?.dbUser) {
    setAuthToken(null);
    return <Navigate to="/login" replace />;
  }

  function handleLogout() {
    setAuthToken(null);
    window.location.href = '/login';
  }

  return (
    <div className="flex min-h-screen bg-app text-ink" data-theme={theme}>
      <AppSidebar
        userName={data.dbUser.name}
        role={data.dbUser.role}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden p-8">
        <Outlet context={{ theme, toggleTheme }} />
      </main>
    </div>
  );
}
